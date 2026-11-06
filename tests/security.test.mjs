import test from 'node:test';
import assert from 'node:assert/strict';
import { validOrigin, createSubmissionLimiter } from '../server/security.js';
import { validateField } from '../src/fields.js';

test('produção exige HTTPS, origem exata e um dos dois domínios autorizados', () => {
  const env = { VERCEL: '1', VERCEL_ENV: 'production' };
  const headers = { host: 'formulario.caiotimoteo.com.br', origin: 'https://formulario.caiotimoteo.com.br', 'sec-fetch-site': 'same-origin' };
  assert.equal(validOrigin(headers, env), true);
  for (const origin of [undefined, 'null', 'http://formulario.caiotimoteo.com.br', 'https://evil.example', 'https://formulario.caiotimoteo.com.br/evil']) {
    assert.equal(validOrigin({ ...headers, origin }, env), false);
  }
  assert.equal(validOrigin({ ...headers, 'sec-fetch-site': 'cross-site' }, env), false);
  assert.equal(validOrigin({ host: 'evil.example', origin: 'https://evil.example' }, env), false);
  assert.equal(validOrigin({ host: 'dev-gps-form.vercel.app', origin: 'https://dev-gps-form.vercel.app' }, env), true);
  assert.equal(validOrigin({ host: 'localhost:3000', origin: 'http://localhost:3000' }, {}), true);
});

test('limite bloqueia a 11ª tentativa, separa IPs e expira após um minuto', () => {
  let time = 1000;
  const limit = createSubmissionLimiter({ now: () => time });
  const env = { VERCEL: '1' };
  const request = ip => ({ headers: { 'x-vercel-forwarded-for': ip, 'x-forwarded-for': '198.51.100.9' } });
  for (let i = 0; i < 10; i++) assert.equal(limit(request('192.0.2.1'), env).allowed, true);
  assert.deepEqual(limit(request('192.0.2.1'), env), { allowed: false, retryAfter: 60 });
  assert.equal(limit(request('192.0.2.2'), env).allowed, true);
  time += 60_000;
  assert.equal(limit(request('192.0.2.1'), env).allowed, true);
});

test('cabeçalhos de proxy arbitrários não criam identidades fora da Vercel', () => {
  const limit = createSubmissionLimiter({ limit: 1 });
  const req = { socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-vercel-forwarded-for': '192.0.2.1' } };
  assert.equal(limit(req, {}).allowed, true);
  req.headers['x-vercel-forwarded-for'] = '192.0.2.2';
  assert.equal(limit(req, {}).allowed, false);
});

test('respostas ambíguas ou com caracteres de controle não viram reply-to', () => {
  for (const email of ['a@example.com,b@example.com', 'a\u0000@example.com', 'Nome<a@example.com>', 'a@example.com\r\nBcc:b@example.com']) assert.ok(validateField('email', email));
  assert.equal(validateField('email', 'pessoa+curso@example.com'), '');
});
