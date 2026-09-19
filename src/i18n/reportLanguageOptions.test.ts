import test from 'node:test';
import assert from 'node:assert/strict';
import { getAvailableReportLanguages, normalizeReportLanguage } from '../utils/reportLanguageOptions';

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

test('country-specific report packs remain limited to their own countries', () => {
  const sweden = codes('SE', 'sv');
  assert.deepEqual(sweden.slice(0, 2), ['sv', 'en']);
  assert.equal(sweden.includes('sv'), true);
  assert.equal(sweden.includes('sk'), false);
  assert.equal(sweden.includes('cs'), false);
  assert.equal(sweden.includes('da'), false);
  assert.equal(sweden.includes('no'), false);

  const switzerland = codes('CH', 'de');
  for (const code of ['sk', 'cs', 'da', 'no', 'sv']) assert.equal(switzerland.includes(code), false);
});

test('remaining compatible languages use a neutral alphabetical order instead of development order', () => {
  const switzerland = getAvailableReportLanguages('CH', 'de');
  assert.deepEqual(switzerland.map(language => language.label), [
    'Deutsch (German)',
    'English',
    'Español (Spanish)',
    'Français (French)',
    'Nederlands (Dutch)',
    'Polski (Polish)',
    'Suomi (Finnish)'
  ]);
});

test('normalization continues to reject country-specific languages outside their country', () => {
  assert.equal(normalizeReportLanguage('sv', 'SE'), 'sv');
  assert.equal(normalizeReportLanguage('sv', 'CH'), 'en');
  assert.equal(normalizeReportLanguage('nb-NO', 'NO'), 'no');
  assert.equal(normalizeReportLanguage('de-CH', 'CH'), 'de');
});
