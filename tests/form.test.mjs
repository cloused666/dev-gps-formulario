import test from 'node:test';
import assert from 'node:assert/strict';
import { questions, validateField } from '../src/fields.js';

test('o fluxo tem sete perguntas distintas e não pergunta se a pessoa é aluna', () => {
  assert.equal(questions.length, 7);
  assert.equal(new Set(questions.map(q => q.key)).size, 7);
  assert.equal(questions.some(q => q.key === 'student'), false);
});

test('validação rejeita dados de contato inválidos e opção fora da lista', () => {
  assert.ok(validateField('phone', '123'));
  assert.ok(validateField('email', 'sem-email'));
  assert.ok(validateField('age', '150'));
  assert.ok(validateField('platform', 'Outra plataforma'));
  assert.equal(validateField('phone', '+55 11 99999-8888'), '');
});
