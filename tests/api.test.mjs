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

async function call(body, headers = {}, method = 'POST') {
  const response = {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(data) { this.data = data; return this; },
  };
  await handler({
    method,
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
  assert.equal((await call(valid, { origin: 'https://outro.example' })).code, 403);
});

test('API rejeita métodos e origens ausentes sem chamar serviços', async () => {
  assert.equal((await call(valid, {}, 'GET')).code, 405);
  assert.equal((await call(valid, { origin: undefined })).code, 403);
  assert.equal((await call(valid, { origin: 'null' })).code, 403);
});

test('API responde 429 antes de chamar Cloudflare ou Resend quando excede limite local', async () => {
  const names = ['VERCEL', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'TURNSTILE_SECRET_KEY'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const oldFetch = globalThis.fetch;
  let requests = 0;
  process.env.VERCEL = '1';
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM_EMAIL = 'Teste <formulario@example.com>';
  process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  globalThis.fetch = async () => { requests++; return { ok: true, json: async () => ({ success: false }) }; };
  try {
    for (let i = 0; i < 10; i++) assert.equal((await call(valid, { 'x-vercel-forwarded-for': '203.0.113.77' })).code, 403);
    const response = await call(valid, { 'x-vercel-forwarded-for': '203.0.113.77' });
    assert.equal(response.code, 429);
    assert.ok(Number(response.headers['Retry-After']) > 0);
    assert.equal(requests, 10);
  } finally {
    globalThis.fetch = oldFetch;
    for (const name of names) if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
  }
});

test('API falha fechada se token é de outro hostname/ação, serviço falha ou chave é de teste em produção', async () => {
  const oldEnv = { ...process.env };
  const oldFetch = globalThis.fetch;
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM_EMAIL = 'Teste <formulario@example.com>';
  process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  let calls = [];
  let verification = { success: true, hostname: 'evil.example', action: 'dev_gps_form' };
  globalThis.fetch = async (url) => { calls.push(url); return url.includes('siteverify') ? { ok: true, json: async () => verification } : { ok: false, status: 500 }; };
  try {
    assert.equal((await call(valid)).code, 403);
    assert.equal(calls.length, 1);
    verification = { success: true, hostname: 'example.com', action: 'another_form' };
    assert.equal((await call(valid)).code, 403);
    assert.equal(calls.length, 2);
    verification = { success: true, hostname: 'example.com', action: 'dev_gps_form' };
    assert.equal((await call(valid)).code, 502);
    assert.equal(calls.length, 4);
    process.env.VERCEL_ENV = 'production';
    process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
    assert.equal((await call(valid, { host: 'formulario.caiotimoteo.com.br', origin: 'https://formulario.caiotimoteo.com.br' })).code, 503);
    assert.equal(calls.length, 4);
    delete process.env.RESEND_API_KEY;
    delete process.env.VERCEL_ENV;
    assert.equal((await call(valid)).code, 503);
  } finally {
    globalThis.fetch = oldFetch;
    for (const name of ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'TURNSTILE_SECRET_KEY', 'VERCEL_ENV']) {
      if (oldEnv[name] === undefined) delete process.env[name]; else process.env[name] = oldEnv[name];
    }
  }
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
