import assert from 'node:assert/strict';
import test from 'node:test';
import { getLocalizedSourceTitle, getReportPresentation, localizeAvailabilityReason, localizePresentationValue, presentationTextValues } from './reportPresentation';
import { getEvidenceSources } from '../data/evidenceSources';

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

test('canonical enums and unavailable sentinels never leak into localized presentation values', () => {
  assert.deepEqual(['NEGLIGIBLE', 'LOW', 'MODERATE', 'HIGH'].map(value => localizePresentationValue(value, 'pl')), ['Znikome', 'Niskie', 'Umiarkowane', 'Wysokie']);
  assert.deepEqual(['MODELLED', 'VERIFIED', 'REQUIRES_VERIFICATION'].map(value => localizePresentationValue(value, 'de')), ['Modelliert', 'Verifiziert', 'Prüfung erforderlich']);
  for (const value of ['Not available', 'No data', 'Unknown', 'Unavailable', 'Not assessed', 'Requires verification', 'Not measured']) {
    assert.equal(localizePresentationValue(value, 'pl'), 'Brak danych');
    assert.equal(localizePresentationValue(value, 'de'), 'Keine Daten');
  }
});

test('source display titles are localized without changing canonical source identity', () => {
  const source = getEvidenceSources('PL').find(item => item.id === 'pgi-smgp-50k');
  assert.ok(source);
  const snapshot = structuredClone(source);
  assert.equal(getLocalizedSourceTitle(source.id, source.title, 'pl'), 'Szczegółowa Mapa Geologiczna Polski (SMGP)');
  assert.equal(getLocalizedSourceTitle(source.id, source.title, 'de'), 'Geologische Detailkarte Polens (SMGP)');
  assert.deepEqual(source, snapshot);
  assert.match(source.url, /smgp50k/);
  assert.equal(source.provider, 'PGI-PIB');
});

test('literal svg artifacts are removed only from displayed text', () => {
  assert.equal(localizePresentationValue('<svg class="icon"></svg> CBDG svg', 'pl'), 'CBDG');
  assert.equal(localizePresentationValue('German Basin', 'pl'), 'German Basin');
});

test('production Polish leakage targets and unavailable reasons are localized explicitly', () => {
  assert.equal(localizePresentationValue('Low to Very Low', 'pl'), 'Niskie do bardzo niskiego');
  assert.equal(localizePresentationValue('Eurocode 8 Zone 0–1 (Low to Very Low)', 'pl'), 'Eurocode 8 Zone 0–1 (Niskie do bardzo niskiego)');
  assert.equal(localizePresentationValue('ISRIC soil texture not available', 'pl'), 'Tekstura SoilGrids jest niedostępna');
  assert.equal(localizePresentationValue('MODELLED', 'pl'), 'Modelowane');
  assert.equal(localizePresentationValue('REQUIRES_VERIFICATION', 'pl'), 'Wymaga weryfikacji');
  assert.notEqual(localizeAvailabilityReason('NO_DATA', 'pl'), localizeAvailabilityReason('SOURCE_UNAVAILABLE', 'pl'));
  assert.notEqual(localizeAvailabilityReason('PARAMETER_NOT_PROVIDED', 'pl'), localizeAvailabilityReason('AUTHORITATIVE_DATA_REQUIRED', 'pl'));
});
