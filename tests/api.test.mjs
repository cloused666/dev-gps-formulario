import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/submit.js';

const valid = {
  name: 'Pessoa Teste',
  phone: '(11) 99999-8888',
  email: 'pessoa@example.com',
  age: '25',
  platform: 'Instagram',
  income: 'R$ 2.500',
  obstacle: 'Preciso de clientes',
  website: '',
  submissionId: '3b4d06fb-7cbc-4c9a-8213-ac542dc61f70',
  turnstileToken: 'valid-token',
};

async function call(body, headers = {}) {
  const response = {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(data) { this.data = data; return this; },
  };
  await handler({
    method: 'POST',
    body,
    headers: { host: 'example.com', origin: 'https://example.com', 'content-type': 'application/json', ...headers },
  }, response);
  return response;
}

test('API rejeita entradas inválidas antes de chamar serviços externos', async () => {
  assert.equal((await call({ ...valid, income: '' })).code, 400);
  assert.equal((await call({ ...valid, email: 'errado' })).code, 400);
  assert.equal((await call({ ...valid, name: 'Pessoa\nInjetada' })).code, 400);
  assert.equal((await call({ ...valid, name: ['Pessoa'] })).code, 400);
  assert.equal((await call({ ...valid, extra: 'campo não aceito' })).code, 400);
  assert.equal((await call({ ...valid, turnstileToken: '' })).code, 403);
  assert.equal((await call('{')).code, 400);
  assert.equal((await call({ ...valid, obstacle: 'x'.repeat(9000) })).code, 413);
  assert.equal((await call(valid, { 'content-type': 'text/plain' })).code, 415);
  assert.equal((await call(valid, { origin: 'https://outro.example' })).code, 503);
});

test('API valida Turnstile, envia e-mail escapado e evita duplicatas', async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.RESEND_API_KEY;
  const oldFrom = process.env.RESEND_FROM_EMAIL;
  const oldTurnstile = process.env.TURNSTILE_SECRET_KEY;
  const calls = [];
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM_EMAIL = 'Timoteo Dev <contato@example.com>';
  process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('siteverify')) return { ok: true, json: async () => ({ success: true, hostname: 'example.com', action: 'dev_gps_form' }) };
    return { ok: true };
  };
  try {
    const response = await call({ ...valid, obstacle: '<script>alert(1)</script>' });
    assert.equal(response.code, 200);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.equal(calls.length, 2);
    const sent = JSON.parse(calls[1].options.body);
    assert.deepEqual(sent.to, ['caiotimoteo9@gmail.com']);
    assert.equal(sent.reply_to, 'pessoa@example.com');
    assert.match(sent.html, /&lt;script&gt;/);
    assert.doesNotMatch(sent.html, /<script>/);
    assert.equal(calls[1].options.headers['Idempotency-Key'], `dev-gps/${valid.submissionId}`);
    assert.equal((await call({ ...valid, website: 'spam' })).code, 200);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey;
    if (oldFrom === undefined) delete process.env.RESEND_FROM_EMAIL; else process.env.RESEND_FROM_EMAIL = oldFrom;
    if (oldTurnstile === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = oldTurnstile;
  }
});

test('API não envia e-mail se Turnstile recusar o token ou a origem divergir', async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.RESEND_API_KEY;
  const oldFrom = process.env.RESEND_FROM_EMAIL;
  const oldTurnstile = process.env.TURNSTILE_SECRET_KEY;
  let calls = 0;
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM_EMAIL = 'Timoteo Dev <contato@example.com>';
  process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ success: false }) }; };
  try {
    assert.equal((await call(valid)).code, 403);
    assert.equal(calls, 1);
    assert.equal((await call(valid, { origin: 'https://outro.example' })).code, 403);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey;
    if (oldFrom === undefined) delete process.env.RESEND_FROM_EMAIL; else process.env.RESEND_FROM_EMAIL = oldFrom;
    if (oldTurnstile === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = oldTurnstile;
  }
});
