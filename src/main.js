import '@fontsource-variable/dm-sans/wght.css';
import './styles.css';
import { questions, validateField } from './fields.js';

const app = document.querySelector('#form-app');
const saved = (() => {
  try {
    const draft = JSON.parse(sessionStorage.getItem('devgps-draft') || '{}');
    return draft && typeof draft === 'object' && !Array.isArray(draft) ? draft : {};
  }
  catch { return {}; }
})();
const answers = Object.fromEntries(questions.map(q => [q.key, typeof saved[q.key] === 'string' ? saved[q.key] : '']));
let step = 0;
let busy = false;
let error = '';
let website = '';
let submissionId = typeof saved._submissionId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved._submissionId) ? saved._submissionId : crypto.randomUUID();
let turnstileScriptPromise;

const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const save = () => {
  try { sessionStorage.setItem('devgps-draft', JSON.stringify({ ...answers, _submissionId: submissionId })); }
  catch { /* O formulário continua funcionando sem armazenamento local. */ }
};

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileScriptPromise) turnstileScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => {
      if (window.turnstile) return resolve(window.turnstile);
      turnstileScriptPromise = undefined;
      script.remove();
      reject(new Error('Não foi possível carregar a verificação de segurança.'));
    };
    script.onerror = () => { turnstileScriptPromise = undefined; script.remove(); reject(new Error('Não foi possível carregar a verificação de segurança.')); };
    document.head.append(script);
  });
  return turnstileScriptPromise;
}

async function getTurnstileToken() {
  const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY || (import.meta.env.DEV ? '1x00000000000000000000BB' : '');
  if (!sitekey) throw new Error('O envio ainda não foi configurado. Tente novamente mais tarde.');
  const turnstile = await loadTurnstile();
  return new Promise((resolve, reject) => {
    const anchor = document.querySelector('#turnstile-anchor');
    let widgetId;
    const clear = () => { if (widgetId !== undefined) turnstile.remove(widgetId); };
    try {
      widgetId = turnstile.render(anchor, {
        sitekey,
        action: 'dev_gps_form',
        theme: 'dark',
        appearance: 'interaction-only',
        execution: 'execute',
        callback: token => { clear(); resolve(token); },
        'error-callback': () => { clear(); reject(new Error('A verificação de segurança falhou. Tente novamente.')); return true; },
        'expired-callback': () => { clear(); reject(new Error('A verificação expirou. Tente novamente.')); },
      });
      turnstile.execute(widgetId);
    } catch {
      clear();
      reject(new Error('Não foi possível iniciar a verificação de segurança.'));
    }
  });
}

function fieldMarkup(q) {
  if (q.type === 'select') return `<div class="select-wrap"><select id="answer" name="${q.key}" required aria-describedby="field-error"><option value="">Selecione uma opção</option>${q.options.map(o => `<option value="${esc(o)}" ${answers[q.key] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select><span class="select-arrow" aria-hidden="true">⌄</span></div>`;
  if (q.type === 'textarea') return `<textarea id="answer" name="${q.key}" placeholder="${esc(q.placeholder)}" maxlength="${q.maxLength}" required aria-describedby="field-error">${esc(answers[q.key])}</textarea>`;
  return `<input id="answer" name="${q.key}" type="${q.type}" value="${esc(answers[q.key])}" placeholder="${esc(q.placeholder)}" ${q.autocomplete ? `autocomplete="${q.autocomplete}"` : ''} ${q.inputmode ? `inputmode="${q.inputmode}"` : ''} ${q.maxLength ? `maxlength="${q.maxLength}"` : ''} ${q.min ? `min="${q.min}" max="${q.max}"` : ''} required aria-describedby="field-error" />`;
}

function render() {
  const q = questions[step];
  app.innerHTML = `<div class="card-title">FORMULÁRIO DEV GPS</div>
    <div class="progress-meta"><span class="sr-only">Progresso</span><span>${step + 1} / ${questions.length}</span></div>
    <progress class="progress" aria-label="Progresso do formulário" max="${questions.length}" value="${step + 1}"></progress>
    <div class="question-body" key="${q.key}"><h2 id="form-title">${q.title} <span class="required" aria-label="obrigatório">*</span></h2>
    <form id="question-form" novalidate><div class="trap" aria-hidden="true"><label for="website">Deixe em branco</label><input id="website" name="website" type="text" tabindex="-1" autocomplete="off" value="${esc(website)}" /></div><label class="sr-only" for="answer">${q.label}</label>${fieldMarkup(q)}${q.help ? `<p class="field-help">${q.help}</p>` : ''}<p class="field-error" id="field-error" role="alert" tabindex="-1">${esc(error)}</p>
    <div class="actions"><button type="button" class="back" ${step === 0 || busy ? 'disabled' : ''}><span aria-hidden="true">←</span> Voltar</button><button type="submit" class="next" ${busy ? 'disabled' : ''}>${busy ? 'Enviando...' : step === questions.length - 1 ? 'Enviar' : 'Continuar'} ${busy ? '' : '<span aria-hidden="true">→</span>'}</button></div></form></div>`;
  const form = app.querySelector('form');
  const field = app.querySelector('#answer');
  field.disabled = busy;
  field.addEventListener('input', () => { answers[q.key] = field.value; submissionId = crypto.randomUUID(); save(); if (error) { error = ''; app.querySelector('.field-error').textContent = ''; field.removeAttribute('aria-invalid'); } });
  field.addEventListener('change', () => { if (answers[q.key] !== field.value) submissionId = crypto.randomUUID(); answers[q.key] = field.value; save(); });
  app.querySelector('#website').addEventListener('input', event => { website = event.target.value; });
  form.addEventListener('submit', handleSubmit);
  app.querySelector('.back').addEventListener('click', () => { if (step > 0) { step--; error = ''; render(); app.querySelector('#answer').focus(); } });
}

async function handleSubmit(event) {
  event.preventDefault();
  const q = questions[step];
  const field = app.querySelector('#answer');
  answers[q.key] = field.value.trim();
  save();
  error = validateField(q.key, answers[q.key]);
  if (error) { app.querySelector('.field-error').textContent = error; field.setAttribute('aria-invalid', 'true'); field.focus(); return; }
  if (step < questions.length - 1) { step++; render(); app.querySelector('#answer').focus(); return; }
  if (busy) return;
  busy = true; render();
  try {
    const turnstileToken = await getTurnstileToken();
    const response = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...answers, website, submissionId, turnstileToken }), signal: AbortSignal.timeout(20000) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Não foi possível enviar agora. Tente novamente.');
    try { sessionStorage.removeItem('devgps-draft'); } catch { /* Sem armazenamento local. */ }
    app.innerHTML = `<div class="success" role="status"><div class="success-icon" aria-hidden="true">✓</div><span class="question-number">TUDO PRONTO</span><h2 id="form-title" tabindex="-1">Recebi suas respostas<span class="blue-dot">.</span></h2><p>Obrigado por compartilhar seu momento comigo. Vou analisar suas respostas e entrar em contato pelo WhatsApp ou e-mail informado.</p><a class="restart" href="/">Voltar ao início <span aria-hidden="true">↗</span></a></div>`;
    app.querySelector('#form-title').focus();
  } catch (cause) {
    busy = false;
    error = cause?.name === 'TimeoutError' ? 'O envio demorou demais. Confira sua conexão e tente novamente.' : cause instanceof Error ? cause.message : 'Não foi possível enviar agora. Tente novamente.';
    render();
    app.querySelector('.field-error').focus();
  }
}

render();
