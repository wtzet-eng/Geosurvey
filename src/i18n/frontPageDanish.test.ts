import assert from 'node:assert/strict';
import test from 'node:test';
import { getFrontPageI18n, getLocalizedTagline } from '../utils/i18nTitle';

test('Danish front page does not fall back to English core copy', () => {
  const text = Object.values(getFrontPageI18n('da')).join('\n');
  for (const phrase of ['European Real Estate & Geotechnical Intelligence', 'Define site boundary', 'Configuration & Parameters', 'Site Area', 'Country (Europe)', 'Report Language']) {
    assert.doesNotMatch(text, new RegExp(phrase.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&'), 'i'), phrase);
  }
  assert.match(text, /Europæisk platform/);
  assert.match(text, /Grundareal/);
});
test('homepage decision tagline is localized for every non-English report language', () => {
  for (const language of ['de','pl','nl','cs','da','no','sv','sk','fr','es','fi']) {
    const tagline = getLocalizedTagline(language);
    assert.ok(tagline.length > 20, language);
    assert.doesNotMatch(tagline, /Understand the land|Compare your options|Know what to check next/i, language);
  }
  assert.match(getLocalizedTagline('es'), /Comprenda la parcela/i);
  assert.match(getLocalizedTagline('no'), /Forstå tomten/i);
});

[executed on device: toma (e8359509-e325-4515-b2ff-2da47ff811ad)]