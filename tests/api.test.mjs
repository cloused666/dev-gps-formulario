import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/submit.js';

const valid = { name: 'Pessoa Teste', phone: '(11) 99999-8888', email: 'pessoa@example.com', age: '25', platform: 'Instagram', student: 'Sim, sou aluno do Dev GPS', income: 'R$ 2.500', obstacle: 'Preciso de clientes', consent: true };
const call = async body => {
  const response = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await handler({ method: 'POST', body }, response);
  return response;
};

test('API exige consentimento e respostas válidas', async () => {
  assert.equal((await call({ ...valid, consent: false })).code, 400);
  assert.equal((await call({ ...valid, email: 'errado' })).code, 400);
  assert.equal((await call('{')).code, 400);
});

test('API envia respostas ao destinatário configurado', async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.RESEND_API_KEY;
  const oldFrom = process.env.RESEND_FROM_EMAIL;
  let sent;
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM_EMAIL = 'Timoteo Dev <contato@example.com>';
  globalThis.fetch = async (_url, options) => { sent = JSON.parse(options.body); return { ok: true }; };
  try {
    const response = await call(valid);
    assert.equal(response.code, 200);
    assert.deepEqual(sent.to, ['caiotimoteo9@gmail.com']);
    assert.equal(sent.reply_to, 'pessoa@example.com');
    assert.match(sent.html, /Preciso de clientes/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey;
    if (oldFrom === undefined) delete process.env.RESEND_FROM_EMAIL; else process.env.RESEND_FROM_EMAIL = oldFrom;
  }
});
