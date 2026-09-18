[Reading 12 lines from start (total: 12 lines, 0 remaining)]

import assert from 'node:assert/strict';
import test from 'node:test';
import { getFrontPageI18n } from '../utils/i18nTitle';

test('Danish front page does not fall back to English core copy', () => {
  const text = Object.values(getFrontPageI18n('da')).join('\n');
  for (const phrase of ['European Real Estate & Geotechnical Intelligence', 'Define site boundary', 'Configuration & Parameters', 'Site Area', 'Country (Europe)', 'Report Language']) {
    assert.doesNotMatch(text, new RegExp(phrase.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&'), 'i'), phrase);
  }
  assert.match(text, /Europæisk platform/);
  assert.match(text, /Grundareal/);
});

[executed on device: toma (e8359509-e325-4515-b2ff-2da47ff811ad)]