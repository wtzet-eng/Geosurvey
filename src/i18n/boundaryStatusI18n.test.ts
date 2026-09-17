import test from 'node:test';
import assert from 'node:assert/strict';
import { getBoundaryStatusText } from '../utils/boundaryStatusI18n';

const LOCAL_LANGUAGES = ['de', 'pl', 'nl', 'cs', 'da', 'no', 'sv', 'sk', 'fr', 'es', 'fi'];

test('below-map boundary status is localized in every supported non-English language', () => {
  const english = getBoundaryStatusText('en');
  for (const language of LOCAL_LANGUAGES) {
    const text = getBoundaryStatusText(language);
    assert.notEqual(text.boundarySet, english.boundarySet, `${language} boundary status should be localized`);
    assert.notEqual(text.polygonInstruction, english.polygonInstruction, `${language} polygon instruction should be localized`);
    assert.notEqual(text.autoCalculated, english.autoCalculated, `${language} auto-calculated note should be localized`);
  }
});

test('unknown languages safely fall back to English', () => {
  assert.deepEqual(getBoundaryStatusText('xx'), getBoundaryStatusText('en'));
});
