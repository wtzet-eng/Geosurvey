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

const dutchLeakage = [
  'Section', 'Source cited by analysis', 'Limitation', 'Requires verification',
  'Modelled', 'Verified', 'Groundwater depth', 'Planning confirmation',
  'Flooding', 'No data', 'Not available', 'Development implications',
  'Indicative land-value range', 'Calculation method', 'Confidence level'
];

const newLanguageLeakage = ['Executive Summary', 'Requires verification', 'Modelled', 'Verified', 'No data', 'Land value only', 'Recommended Investigations'];

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

test('Dutch report presentation dictionary has no known English leakage', () => {
  const text = presentationTextValues('nl').join('\n');
  for (const phrase of dutchLeakage) assert.doesNotMatch(text, new RegExp(`\\b${phrase.replaceAll(' ', '\\s+')}\\b`, 'i'), phrase);
  assert.match(text, /Onderdeel/);
  assert.match(text, /Bron/);
  assert.match(text, /Verificatie vereist/);
});

test('French, Spanish and Finnish report presentation dictionaries avoid known English UI leakage', () => {
  for (const language of ['fr', 'es', 'fi']) {
    const text = presentationTextValues(language).join('\n');
    for (const phrase of newLanguageLeakage) assert.doesNotMatch(text, new RegExp(phrase, 'i'), `${language}: ${phrase}`);
  }
  assert.match(getReportPresentation('fr').executive, /Synthèse/);
  assert.match(getReportPresentation('es').executive, /Resumen/);
  assert.match(getReportPresentation('fi').executive, /Yhteenveto/);
});

test('all report dictionaries expose the same presentation contract', () => {
  const keys = Object.keys(getReportPresentation('en')).sort();
  for (const language of ['de', 'pl', 'nl', 'fr', 'es', 'fi']) {
    assert.deepEqual(Object.keys(getReportPresentation(language)).sort(), keys, language);
  }
});

test('valuation presentation is explicitly land-only in every supported report language', () => {
  const english = getReportPresentation('en');
  assert.match(english.market, /Land/);
  assert.match(english.indicativeRange, /land-value/i);
  assert.match(english.valuationNote, /Land value only/i);
  assert.match(english.valuationNote, /buildings.*structures.*improvements/i);

  const german = getReportPresentation('de');
  assert.match(german.market, /Boden/);
  assert.match(german.indicativeRange, /Bodenwert/i);
  assert.match(german.valuationNote, /Nur Bodenwert/i);
  assert.match(german.valuationNote, /Gebäude.*bauliche Anlagen.*Aufbauten/i);

  const polish = getReportPresentation('pl');
  assert.match(polish.market, /wartość gruntu/i);
  assert.match(polish.indicativeRange, /wartości gruntu/i);
  assert.match(polish.valuationNote, /Wyłącznie wartość gruntu/i);
  assert.match(polish.valuationNote, /budynków.*budowli.*naniesień/i);

  const dutch = getReportPresentation('nl');
  assert.match(dutch.market, /Grondmarkt/i);
  assert.match(dutch.indicativeRange, /grondwaarde/i);
  assert.match(dutch.valuationNote, /Alleen grondwaarde/i);
  assert.match(dutch.valuationNote, /gebouwen.*bouwwerken.*verbeteringen/i);

  const french = getReportPresentation('fr');
  assert.match(french.valuationNote, /Valeur du terrain uniquement/i);
  assert.match(french.valuationNote, /bâtiments.*constructions.*améliorations/i);

  const spanish = getReportPresentation('es');
  assert.match(spanish.valuationNote, /Solo valor del suelo/i);
  assert.match(spanish.valuationNote, /edificios.*construcciones.*mejoras/i);

  const finnish = getReportPresentation('fi');
  assert.match(finnish.valuationNote, /Vain maan arvo/i);
  assert.match(finnish.valuationNote, /rakennukset.*rakenteet.*parannukset/i);
});

test('land-value scope is repeated in the professional disclaimer', () => {
  assert.match(getReportPresentation('en').disclaimerOne, /land-only.*buildings.*structures.*improvements/i);
  assert.match(getReportPresentation('de').disclaimerOne, /Bodenwert.*Gebäude.*bauliche Anlagen.*Aufbauten/i);
  assert.match(getReportPresentation('pl').disclaimerOne, /wartością gruntu.*budynków.*budowli.*naniesień/i);
  assert.match(getReportPresentation('nl').disclaimerOne, /grondwaarde.*gebouwen.*bouwwerken.*verbeteringen/i);
  assert.match(getReportPresentation('fr').disclaimerOne, /terrain.*bâtiments.*constructions.*améliorations/i);
  assert.match(getReportPresentation('es').disclaimerOne, /suelo.*edificios.*construcciones.*mejoras/i);
  assert.match(getReportPresentation('fi').disclaimerOne, /maata.*rakennukset.*rakenteet.*parannukset/i);
});

test('canonical enums and unavailable sentinels never leak into localized presentation values', () => {
  assert.deepEqual(['NEGLIGIBLE', 'LOW', 'MODERATE', 'HIGH'].map(value => localizePresentationValue(value, 'pl')), ['Znikome', 'Niskie', 'Umiarkowane', 'Wysokie']);
  assert.deepEqual(['MODELLED', 'VERIFIED', 'REQUIRES_VERIFICATION'].map(value => localizePresentationValue(value, 'de')), ['Modelliert', 'Verifiziert', 'Prüfung erforderlich']);
  assert.deepEqual(['NEGLIGIBLE', 'LOW', 'MODERATE', 'HIGH'].map(value => localizePresentationValue(value, 'nl')), ['Verwaarloosbaar', 'Laag', 'Matig', 'Hoog']);
  assert.deepEqual(['MODELLED', 'VERIFIED', 'REQUIRES_VERIFICATION'].map(value => localizePresentationValue(value, 'nl')), ['Gemodelleerd', 'Geverifieerd', 'Verificatie vereist']);
  assert.deepEqual(['MODELLED', 'VERIFIED', 'REQUIRES_VERIFICATION'].map(value => localizePresentationValue(value, 'fr')), ['Modélisé', 'Vérifié', 'Vérification requise']);
  assert.deepEqual(['MODELLED', 'VERIFIED', 'REQUIRES_VERIFICATION'].map(value => localizePresentationValue(value, 'es')), ['Modelado', 'Verificado', 'Requiere verificación']);
  assert.deepEqual(['MODELLED', 'VERIFIED', 'REQUIRES_VERIFICATION'].map(value => localizePresentationValue(value, 'fi')), ['Mallinnettu', 'Vahvistettu', 'Vaatii tarkistuksen']);
  for (const value of ['Not available', 'No data', 'Unknown', 'Unavailable', 'Not assessed', 'Requires verification', 'Not measured']) {
    assert.equal(localizePresentationValue(value, 'pl'), 'Brak danych');
    assert.equal(localizePresentationValue(value, 'de'), 'Keine Daten');
    assert.equal(localizePresentationValue(value, 'nl'), 'Geen gegevens');
    assert.equal(localizePresentationValue(value, 'fr'), 'Aucune donnée');
    assert.equal(localizePresentationValue(value, 'es'), 'Sin datos');
    assert.equal(localizePresentationValue(value, 'fi'), 'Ei tietoja');
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

test('Dutch unavailable reasons remain distinct and localized', () => {
  assert.equal(localizePresentationValue('Low to Very Low', 'nl'), 'Laag tot zeer laag');
  assert.equal(localizePresentationValue('ISRIC soil texture not available', 'nl'), 'SoilGrids-textuur niet beschikbaar');
  assert.notEqual(localizeAvailabilityReason('NO_DATA', 'nl'), localizeAvailabilityReason('SOURCE_UNAVAILABLE', 'nl'));
  assert.notEqual(localizeAvailabilityReason('PARAMETER_NOT_PROVIDED', 'nl'), localizeAvailabilityReason('AUTHORITATIVE_DATA_REQUIRED', 'nl'));
});

test('French Spanish and Finnish unavailable reasons remain distinct and localized', () => {
  for (const language of ['fr', 'es', 'fi']) {
    assert.notEqual(localizeAvailabilityReason('NO_DATA', language), localizeAvailabilityReason('SOURCE_UNAVAILABLE', language));
    assert.notEqual(localizeAvailabilityReason('PARAMETER_NOT_PROVIDED', language), localizeAvailabilityReason('AUTHORITATIVE_DATA_REQUIRED', language));
  }
});

test('Polish and Spanish evidence-audit presentation localizes common generated claims', () => {
  assert.equal(localizePresentationValue('Terrain & Topography', 'pl'), 'Teren i topografia');
  assert.equal(localizePresentationValue('Terrain & Topography', 'es'), 'Terreno y topografía');
  assert.match(localizePresentationValue('Mean elevation 159 m a.s.l. with slope gradient of 1.1° (Flat (0-2°))', 'pl'), /Średnia wysokość 159 m n\.p\.m\./);
  assert.match(localizePresentationValue('Mean elevation 656 m a.s.l. with slope gradient of 1.1° (Flat (0-2°))', 'es'), /Altitud media 656 m/);
  assert.match(localizePresentationValue('Soil Texture: Sandy Loam (Sand 65.4%, Silt 25.7%, Clay 8.9%, Mean Density 1.28 g\/cm³, pH 6.1) [MODELLED]', 'pl'), /Tekstura gleby: glina piaszczysta/);
  assert.match(localizePresentationValue('Soil Texture: Loam (Sand 31.6%, Silt 46.9%, Clay 21.6%, Mean Density 1.43 g\/cm³, pH 7.7) [MODELLED]', 'es'), /Textura del suelo: franco/);
  assert.match(localizePresentationValue('Kamień Spatial Planning Authority (MPZP)', 'pl'), /właściwy organ planowania przestrzennego/);
  assert.match(localizePresentationValue('La Guardia competent local planning authority', 'es'), /autoridad urbanística competente/);
});

[executed on device: toma (e8359509-e325-4515-b2ff-2da47ff811ad)]