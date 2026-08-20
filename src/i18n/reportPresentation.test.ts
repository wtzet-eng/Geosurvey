import assert from 'node:assert/strict';
import test from 'node:test';
import { getReportPresentation, presentationTextValues } from './reportPresentation';

const polishLeakage = [
  'Section', 'Source', 'Limitation', 'Requires verification', 'Modelled', 'Verified',
  'Groundwater', 'Planning', 'Environment', 'Flooding', 'No data', 'Not available',
  'Interpretation boundary', 'Evidence', 'Development', 'Indicative', 'Calculation',
  'Confidence', 'Source cited by analysis'
];

const germanLeakage = [
  'Section', 'Source cited by analysis', 'Limitation', 'Requires verification',
  'Modelled', 'Verified', 'Groundwater', 'Planning confirmation', 'Environment',
  'Flooding', 'No data', 'Not available', 'Interpretation boundary',
  'Development implications', 'Indicative range', 'Calculation method', 'Confidence level'
];

test('Polish report presentation dictionary has no known English leakage', () => {
  const text = presentationTextValues('pl').join('\n');
  for (const phrase of polishLeakage) assert.doesNotMatch(text, new RegExp(`\\b${phrase.replaceAll(' ', '\\s+')}\\b`, 'i'), phrase);
  assert.match(text, /Sekcja/);
  assert.match(text, /Źródło/);
  assert.match(text, /Wymaga weryfikacji/);
});

test('German report presentation dictionary has no known English leakage', () => {
  const text = presentationTextValues('de').join('\n');
  for (const phrase of germanLeakage) assert.doesNotMatch(text, new RegExp(`\\b${phrase.replaceAll(' ', '\\s+')}\\b`, 'i'), phrase);
  assert.match(text, /Abschnitt/);
  assert.match(text, /Quelle/);
  assert.match(text, /Prüfung erforderlich/);
});

test('English, German and Polish dictionaries expose the same presentation contract', () => {
  const keys = Object.keys(getReportPresentation('en')).sort();
  assert.deepEqual(Object.keys(getReportPresentation('de')).sort(), keys);
  assert.deepEqual(Object.keys(getReportPresentation('pl')).sort(), keys);
});
