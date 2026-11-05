import './styles.css';
import { questions, validateField } from './fields.js';

const app = document.querySelector('#form-app');
const saved = JSON.parse(sessionStorage.getItem('devgps-draft') || '{}');
const answers = Object.fromEntries(questions.map(q => [q.key, saved[q.key] || '']));
let step = 0;
let busy = false;
let error = '';
const startedAt = Date.now();

const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const save = () => sessionStorage.setItem('devgps-draft', JSON.stringify(answers));

function fieldMarkup(q) {
  if (q.type === 'select') return `<div class="select-wrap"><select id="answer" name="${q.key}" required aria-describedby="field-hint field-error"><option value="">Selecione uma opção</option>${q.options.map(o => `<option value="${esc(o)}" ${answers[q.key] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select><span class="select-arrow" aria-hidden="true">⌄</span></div>`;
  if (q.type === 'textarea') return `<textarea id="answer" name="${q.key}" placeholder="${esc(q.placeholder)}" maxlength="${q.maxLength}" required aria-describedby="field-hint field-error">${esc(answers[q.key])}</textarea>`;
  return `<input id="answer" name="${q.key}" type="${q.type}" value="${esc(answers[q.key])}" placeholder="${esc(q.placeholder)}" ${q.autocomplete ? `autocomplete="${q.autocomplete}"` : ''} ${q.inputmode ? `inputmode="${q.inputmode}"` : ''} ${q.maxLength ? `maxlength="${q.maxLength}"` : ''} ${q.min ? `min="${q.min}" max="${q.max}"` : ''} required aria-describedby="field-hint field-error" />`;
}

function render() {
  const q = questions[step];
  app.innerHTML = `<div class="progress-meta"><span>ETAPA ${q.number} <span class="meta-of">/ 08</span></span><span>${Math.round((step + 1) / questions.length * 100)}% CONCLUÍDO</span></div>
    <div class="progress" role="progressbar" aria-label="Progresso do formulário" aria-valuemin="0" aria-valuemax="8" aria-valuenow="${step + 1}"><span style="width:${(step + 1) / questions.length * 100}%"></span></div>
    <div class="question-body" key="${q.key}"><span class="question-number">${q.number} <span>—</span> 08</span><h2 id="form-title">${q.title}</h2><p class="question-hint" id="field-hint">${q.hint}</p>
    <form id="question-form" novalidate><label for="answer">${q.label} <span class="required" aria-label="obrigatório">*</span></label>${fieldMarkup(q)}${q.help ? `<p class="field-help">${q.help}</p>` : ''}<p class="field-error" id="field-error" role="alert">${esc(error)}</p>
    ${step === 7 ? '<label class="consent"><input id="consent" type="checkbox" required /><span>Concordo em receber contato do Timoteo Dev sobre esta conversa.</span></label>' : ''}
    <div class="actions"><button type="button" class="back" ${step === 0 ? 'disabled' : ''}><span aria-hidden="true">←</span> Voltar</button><button type="submit" class="next" ${busy ? 'disabled' : ''}>${busy ? 'Enviando...' : step === 7 ? 'Enviar respostas' : 'Continuar'} ${busy ? '' : '<span aria-hidden="true">↗</span>'}</button></div></form></div>`;
  const form = app.querySelector('form');
  const field = app.querySelector('#answer');
  field.addEventListener('input', () => { answers[q.key] = field.value; save(); if (error) { error = ''; app.querySelector('.field-error').textContent = ''; field.removeAttribute('aria-invalid'); } });
  field.addEventListener('change', () => { answers[q.key] = field.value; save(); });
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
  if (!error && step === 7 && !app.querySelector('#consent').checked) error = 'Confirme que podemos entrar em contato com você.';
  if (error) { app.querySelector('.field-error').textContent = error; field.setAttribute('aria-invalid', 'true'); field.focus(); return; }
  if (step < questions.length - 1) { step++; render(); app.querySelector('#answer').focus(); return; }
  if (busy) return;
  busy = true; render();
  try {
    const response = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...answers, consent: true, startedAt }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Não foi possível enviar agora. Tente novamente.');
    sessionStorage.removeItem('devgps-draft');
    app.innerHTML = `<div class="success"><div class="success-icon" aria-hidden="true">✓</div><span class="question-number">TUDO PRONTO</span><h2 id="form-title">Recebi suas respostas<span class="blue-dot">.</span></h2><p>Obrigado por compartilhar seu momento comigo. Vou analisar suas respostas e entrar em contato pelo WhatsApp ou e-mail informado.</p><a class="restart" href="/">Voltar ao início <span aria-hidden="true">↗</span></a></div>`;
  } catch (cause) { busy = false; error = cause.message; render(); app.querySelector('#answer').focus(); }
}

render();
