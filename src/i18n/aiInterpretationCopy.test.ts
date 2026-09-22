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


test('Slovak AI interpretation shell is localized', () => {
  const copy = aiPanelCopy('sk');
  const text = Object.values(copy).join('\n');
  assert.equal(copy.brand, 'Interpretácia AI LandSurf');
  assert.equal(copy.title, 'Interpretovať zhromaždené dôkazy');
  assert.equal(copy.observations, 'Priame pozorovania');
  assert.equal(copy.interpretation, 'Interpretácia');
  assert.equal(copy.limitations, 'Obmedzenia');
  assert.equal(copy.verifyNext, 'Čo treba overiť ďalej');
  assert.equal(copy.runAgain, 'Spustiť znova');
  assert.equal(copy.confidence, 'Miera istoty');
  assert.equal(copy.high, 'Vysoká');
  assert.equal(copy.medium, 'Stredná');
  assert.equal(copy.low, 'Nízka');
  assert.doesNotMatch(text, /Interpret the collected evidence|AI interpretation|Signed in|Interpretation completed|Direct observations|What to verify next|Run again|Confidence/i);
});


test('German AI interpretation shell is localized', () => {
  const copy = aiPanelCopy('de');
  const text = Object.values(copy).join('\n');
  assert.equal(copy.brand, 'LandSurf KI-Interpretation');
  assert.equal(copy.title, 'Gesammelte Evidenz interpretieren');
  assert.equal(copy.completed, 'Interpretation abgeschlossen');
  assert.equal(copy.observations, 'Direkte Beobachtungen');
  assert.equal(copy.limitations, 'Einschränkungen');
  assert.equal(copy.verifyNext, 'Als Nächstes zu prüfen');
  assert.equal(copy.runAgain, 'Erneut ausführen');
  assert.equal(copy.confidence, 'Konfidenz');
  assert.equal(copy.high, 'Hoch');
  assert.equal(copy.medium, 'Mittel');
  assert.equal(copy.low, 'Niedrig');
  assert.doesNotMatch(text, /Interpret the collected evidence|AI interpretation|Signed in|Interpretation completed|Direct observations|What to verify next|Run again|Confidence/i);
});


test('Croatian AI interpretation shell is localized', () => {
  const copy = aiPanelCopy('hr');
  const text = Object.values(copy).join('\n');
  assert.equal(copy.brand, 'LandSurf AI interpretacija');
  assert.equal(copy.title, 'Protumačite prikupljene dokaze');
  assert.equal(copy.completed, 'Interpretacija dovršena');
  assert.equal(copy.observations, 'Izravna opažanja');
  assert.equal(copy.limitations, 'Ograničenja');
  assert.equal(copy.verifyNext, 'Što provjeriti dalje');
  assert.equal(copy.runAgain, 'Pokreni ponovno');
  assert.equal(copy.confidence, 'Pouzdanost');
  assert.equal(copy.high, 'Visoka');
  assert.equal(copy.medium, 'Srednja');
  assert.equal(copy.low, 'Niska');
  assert.doesNotMatch(text, /Interpret the collected evidence|AI interpretation|Signed in|Interpretation completed|Direct observations|What to verify next|Run again|Confidence/i);
});
