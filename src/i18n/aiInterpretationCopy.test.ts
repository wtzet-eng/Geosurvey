import test from 'node:test';
import assert from 'node:assert/strict';
import { aiPanelCopy } from '../components/AIInterpretationPanel';

test('Swedish AI interpretation shell is localized', () => {
  const copy = aiPanelCopy('sv');
  const text = Object.values(copy).join('\n');
  assert.match(copy.brand, /AI-tolkning/);
  assert.match(copy.title, /Tolka det insamlade underlaget/);
  assert.match(copy.completed, /Tolkningen är klar/);
  assert.match(copy.verifyNext, /verifieras härnäst/);
  assert.equal(copy.runAgain, 'Kör igen');
  assert.equal(copy.confidence, 'Konfidens');
  assert.equal(copy.high, 'Hög');
  assert.equal(copy.medium, 'Medel');
  assert.equal(copy.low, 'Låg');
  assert.doesNotMatch(text, /Interpret the collected evidence|AI interpretation|Signed in|Interpretation completed|Direct observations|What to verify next|Run again|Confidence/i);
});

test('Spanish AI interpretation shell is localized', () => {
  const copy = aiPanelCopy('es');
  const text = Object.values(copy).join('\n');
  assert.match(copy.brand, /Interpretación de IA de LandSurf/);
  assert.match(copy.title, /Interpretar la evidencia recopilada/);
  assert.match(copy.completed, /Interpretación completada/);
  assert.match(copy.verifyNext, /Qué verificar a continuación/);
  assert.match(copy.confidence, /Confianza/);
  assert.doesNotMatch(text, /Interpret the collected evidence|AI interpretation|Signed in|Interpretation completed|Direct observations|What to verify next/i);
});
