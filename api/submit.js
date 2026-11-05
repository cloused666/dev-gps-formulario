import { questions, validateField } from '../src/fields.js';

const recipient = 'caiotimoteo9@gmail.com';
const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return res.status(400).json({ error: 'Dados inválidos.' }); }
  if (body.website) return res.status(200).json({ ok: true });
  for (const q of questions) {
    const problem = validateField(q.key, body[q.key]);
    if (problem) return res.status(400).json({ error: `${q.label}: ${problem}` });
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return res.status(503).json({ error: 'O envio de e-mail ainda não foi configurado. Tente novamente mais tarde.' });
  const rows = questions.map(q => `<tr><th style="text-align:left;padding:10px;border-bottom:1px solid #dbe5f4;color:#284a7b">${escapeHtml(q.label)}</th><td style="padding:10px;border-bottom:1px solid #dbe5f4;white-space:pre-wrap">${escapeHtml(String(body[q.key]).trim())}</td></tr>`).join('');
  try {
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [recipient], reply_to: String(body.email).trim(), subject: `Nova solicitação de conversa — ${String(body.name).trim()}`, html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#102443"><h1 style="color:#174681">Nova solicitação de conversa</h1><p>Uma pessoa respondeu ao formulário Dev GPS.</p><table style="border-collapse:collapse;width:100%">${rows}</table></div>` })
    });
    if (!result.ok) {
      console.error('Resend rejected submission:', result.status, await result.text());
      return res.status(502).json({ error: 'Não foi possível enviar agora. Tente novamente em alguns minutos.' });
    }
    return res.status(200).json({ ok: true });
  } catch (cause) {
    console.error('Email delivery failed:', cause);
    return res.status(502).json({ error: 'Não foi possível enviar agora. Tente novamente em alguns minutos.' });
  }
}
