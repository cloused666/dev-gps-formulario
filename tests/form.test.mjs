import test from 'node:test';
import assert from 'node:assert/strict';
import { questions, validateField } from '../src/fields.js';

test('o fluxo tem oito perguntas distintas e apenas Dev GPS como curso', () => {
  assert.equal(questions.length, 8);
  assert.equal(new Set(questions.map(q => q.key)).size, 8);
  assert.deepEqual(questions[5].options, ['Sim, sou aluno do Dev GPS', 'Ainda não sou aluno']);
});

test('validação rejeita dados de contato inválidos e opção fora da lista', () => {
  assert.ok(validateField('phone', '123'));
  assert.ok(validateField('email', 'sem-email'));
  assert.ok(validateField('age', '150'));
  assert.ok(validateField('student', 'Outro curso'));
  assert.equal(validateField('phone', '+55 11 99999-8888'), '');
});
