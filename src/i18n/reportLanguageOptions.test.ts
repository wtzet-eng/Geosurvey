import test from 'node:test';
import assert from 'node:assert/strict';
import { getAvailableReportLanguages, getDefaultReportLanguageForCountry, normalizeReportLanguage } from '../utils/reportLanguageOptions';

const codes = (countryCode: string, nativeLanguage: string) =>
  getAvailableReportLanguages(countryCode, nativeLanguage).map(language => language.code);

test('report languages put the selected country native language first and English second', () => {
  assert.deepEqual(codes('CH', 'de').slice(0, 2), ['de', 'en']);
  assert.deepEqual(codes('ES', 'es').slice(0, 2), ['es', 'en']);
  assert.deepEqual(codes('PL', 'pl').slice(0, 2), ['pl', 'en']);
  assert.deepEqual(codes('NL', 'nl').slice(0, 2), ['nl', 'en']);
  assert.deepEqual(codes('FR', 'fr').slice(0, 2), ['fr', 'en']);
  assert.equal(codes('MT', 'mt')[0], 'en');
  assert.equal(codes('MT', 'mt').includes('mt'), false);
});

test('all available report languages remain selectable regardless of screened country', () => {
  const languages = codes('DE', 'de');
  for (const code of ['cs', 'sk', 'hr', 'da', 'no', 'sv', 'fr', 'es', 'fi', 'nl', 'pl']) {
    assert.equal(languages.includes(code), true);
  }
  assert.deepEqual(languages.slice(0, 2), ['de', 'en']);
});

test('all compatible languages use a neutral alphabetical order after the native language and English', () => {
  const switzerland = getAvailableReportLanguages('CH', 'de');
  assert.deepEqual(switzerland.map(language => language.label), [
    'Deutsch (German)',
    'English',
    'Čeština (Czech)',
    'Dansk (Danish)',
    'Español (Spanish)',
    'Français (French)',
    'Hrvatski (Croatian)',
    'Nederlands (Dutch)',
    'Norsk bokmål (Norwegian)',
    'Polski (Polish)',
    'Slovenčina (Slovak)',
    'Suomi (Finnish)',
    'Svenska (Swedish)'
  ]);
});

test('normalization accepts supported languages independently of country', () => {
  assert.equal(normalizeReportLanguage('sv', 'CH'), 'sv');
  assert.equal(normalizeReportLanguage('nb-NO', 'DE'), 'no');
  assert.equal(normalizeReportLanguage('de-CH', 'CH'), 'de');
  assert.equal(normalizeReportLanguage('hr', 'DE'), 'hr');
  assert.equal(normalizeReportLanguage('cs', 'DE'), 'cs');
  assert.equal(normalizeReportLanguage('sk', 'DE'), 'sk');
  assert.deepEqual(codes('HR', 'hr').slice(0, 2), ['hr', 'en']);
});


test('Netherlands defaults to Dutch independently of the browser language', () => {
  assert.equal(normalizeReportLanguage('nl', 'NL'), 'nl');
  assert.deepEqual(codes('NL', 'nl').slice(0, 2), ['nl', 'en']);
});


test('every country follows the same native-language default rule', async () => {
  const { EUROPEAN_COUNTRIES } = await import('../data/countries');
  for (const country of EUROPEAN_COUNTRIES) {
    const expected = normalizeReportLanguage(country.language, country.code);
    assert.equal(
      getDefaultReportLanguageForCountry(country.code),
      expected,
      `${country.code} should default to its configured language when that language is supported, otherwise English`
    );
    assert.equal(
      getAvailableReportLanguages(country.code, country.language)[0].code,
      expected,
      `${country.code} should show its effective default language first`
    );
  }
});
