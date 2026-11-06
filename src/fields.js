export const questions = [
  { key: 'name', number: '01', title: 'Como podemos chamar você?', label: 'Nome completo', hint: 'Para começarmos essa conversa do jeito certo.', type: 'text', autocomplete: 'name', placeholder: 'Digite seu nome completo', maxLength: 100 },
  { key: 'phone', number: '02', title: 'Qual é o seu WhatsApp?', label: 'WhatsApp', hint: 'É por lá que vou entrar em contato com você.', type: 'tel', autocomplete: 'tel', placeholder: '(11) 99999-9999', maxLength: 25, help: 'Fora do Brasil? Inclua + e o código do país.' },
  { key: 'email', number: '03', title: 'E o seu melhor e-mail?', label: 'E-mail', hint: 'Para que eu tenha outra forma de falar com você.', type: 'email', autocomplete: 'email', placeholder: 'voce@exemplo.com', maxLength: 254 },
  { key: 'age', number: '04', title: 'Qual é a sua idade?', label: 'Idade', hint: 'Isso me ajuda a entender seu momento atual.', type: 'number', inputmode: 'numeric', placeholder: 'Digite sua idade', min: 1, max: 120 },
  { key: 'platform', number: '05', title: 'Onde você acompanha meu conteúdo?', label: 'Plataforma', hint: 'Escolha a opção que mais combina com você.', type: 'select', options: ['Instagram', 'TikTok', 'YouTube', 'Em mais de uma plataforma'] },
  { key: 'income', number: '06', title: 'Qual é a sua renda atual?', label: 'Renda atual', hint: 'Pode responder do jeito que fizer sentido para você.', type: 'text', placeholder: 'Ex.: R$ 2.500 por mês ou sem renda no momento', maxLength: 160 },
  { key: 'obstacle', number: '07', title: 'O que mais te impede de atingir os 10 mil por mês?', label: 'Sua principal dificuldade', hint: 'Conte com suas palavras. Quero entender seu desafio.', type: 'textarea', placeholder: 'Escreva sua resposta aqui...', maxLength: 1200 },
];

export function validateField(key, value) {
  if (typeof value !== 'string') return 'Preencha este campo para continuar.';
  const v = value.trim();
  if (!v) return 'Preencha este campo para continuar.';
  if (key === 'name' && (v.length < 2 || /[\x00-\x1f\x7f]/.test(v))) return 'Digite seu nome completo.';
  if (key === 'phone' && !/^\+?[\d\s()\-]{10,25}$/.test(v)) return 'Digite um WhatsApp válido.';
  if (key === 'phone' && ((v.match(/\d/g) || []).length < 10 || (v.match(/\d/g) || []).length > 15)) return 'Digite um WhatsApp com 10 a 15 números.';
  if (key === 'email' && (!/^[^\s@<>,;:"\\]+@[^\s@<>,;:"\\]+\.[^\s@<>,;:"\\]+$/.test(v) || /[\x00-\x1f\x7f]/.test(v))) return 'Digite um e-mail válido.';
  if (key === 'age' && (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > 120)) return 'Digite uma idade entre 1 e 120.';
  const q = questions.find(item => item.key === key);
  if (q?.options && !q.options.includes(v)) return 'Escolha uma das opções.';
  if (q?.maxLength && v.length > q.maxLength) return 'Sua resposta é muito longa.';
  return '';
}
