import { questions, validateField } from '../src/fields.js';

const recipient = 'caiotimoteo9@gmail.com';
const maxBodyBytes = 8192;
const turnstileTestSecrets = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);
const allowedKeys = new Set([...questions.map(question => question.key), 'website', 'turnstileToken', 'submissionId']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export default async function handler(req, res) {
  res.setHeader?.('Cache-Control', 'no-store');
  const reply = (status, error) => res.status(status).json(error ? { error } : { ok: true });

  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return reply(405, 'Método não permitido.');
  }

  const contentType = req.headers?.['content-type'] || '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) return reply(415, 'Envie os dados em JSON.');
  const declaredSize = Number(req.headers?.['content-length'] || 0);
  if (declaredSize > maxBodyBytes) return reply(413, 'O formulário é muito grande.');

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, 'Dados inválidos.');
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > maxBodyBytes) return reply(413, 'O formulário é muito grande.');
  } catch {
    return reply(400, 'Dados inválidos.');
  }

  if (Object.keys(body).some(key => !allowedKeys.has(key))) return reply(400, 'Dados inválidos.');
  if (body.website) return reply(200);

  for (const question of questions) {
    const problem = validateField(question.key, body[question.key]);
    if (problem) return reply(400, `${question.label}: ${problem}`);
  }

  if (typeof body.submissionId !== 'string' || !uuidPattern.test(body.submissionId)) return reply(400, 'Identificador de envio inválido.');
  if (typeof body.turnstileToken !== 'string' || !body.turnstileToken || body.turnstileToken.length > 2048) return reply(403, 'Verificação de segurança inválida. Tente novamente.');

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (!apiKey || !from || !turnstileSecret) return reply(503, 'O envio ainda não foi configurado. Tente novamente mais tarde.');
  const usingTestSecret = turnstileTestSecrets.has(turnstileSecret);
  if (process.env.VERCEL_ENV === 'production' && usingTestSecret) return reply(503, 'A verificação de segurança ainda não foi configurada.');

  const host = req.headers?.host?.split(':')[0]?.toLowerCase();
  if (!host) return reply(400, 'Origem inválida.');
  if (req.headers?.origin) {
    try {
      if (new URL(req.headers.origin).host.toLowerCase() !== req.headers.host.toLowerCase()) return reply(403, 'Origem inválida.');
    } catch {
      return reply(403, 'Origem inválida.');
    }
  }

  try {
    const validationResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: turnstileSecret, response: body.turnstileToken }),
      signal: AbortSignal.timeout(8000),
    });
    const validation = await validationResponse.json();
    if (!validationResponse.ok || !validation.success || (!usingTestSecret && (validation.hostname?.toLowerCase() !== host || validation.action !== 'dev_gps_form'))) {
      return reply(403, 'Verificação de segurança inválida. Tente novamente.');
    }
  } catch (error) {
    console.error('Turnstile verification failed:', error?.name || 'unknown');
    return reply(502, 'Não foi possível verificar o envio. Tente novamente.');
  }

  const rows = questions.map(question => {
    const answer = body[question.key].trim();
    return `<tr><th style="text-align:left;padding:10px;border-bottom:1px solid #dbe5f4;color:#284a7b">${escapeHtml(question.label)}</th><td style="padding:10px;border-bottom:1px solid #dbe5f4;white-space:pre-wrap">${escapeHtml(answer)}</td></tr>`;
  }).join('');
  const plainText = questions.map(question => `${question.label}: ${body[question.key].trim()}`).join('\n\n');

  try {
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `dev-gps/${body.submissionId}` },
      body: JSON.stringify({
        from,
        to: [recipient],
        reply_to: body.email.trim(),
        subject: `Nova solicitação de conversa — ${body.name.trim()}`,
        text: `Uma pessoa respondeu ao formulário Dev GPS.\n\n${plainText}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#102443"><h1 style="color:#174681">Nova solicitação de conversa</h1><p>Uma pessoa respondeu ao formulário Dev GPS.</p><table style="border-collapse:collapse;width:100%">${rows}</table></div>`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) {
      console.error('Email delivery rejected:', result.status);
      return reply(502, 'Não foi possível enviar agora. Tente novamente em alguns minutos.');
    }
    return reply(200);
  } catch (error) {
    console.error('Email delivery failed:', error?.name || 'unknown');
    return reply(502, 'Não foi possível enviar agora. Tente novamente em alguns minutos.');
  }
}
