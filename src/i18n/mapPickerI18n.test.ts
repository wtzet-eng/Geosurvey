import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMapPickerText, getMapPickerText } from '../utils/mapPickerI18n';

const LOCAL_LANGUAGES = ['de', 'pl', 'nl', 'cs', 'da', 'no', 'sv', 'sk', 'fr', 'es', 'fi'];

test('map drawing guidance is localized for every supported non-English language', () => {
  const english = getMapPickerText('en');
  for (const language of LOCAL_LANGUAGES) {
    const text = getMapPickerText(language);
    assert.notEqual(text.polygonSelected, english.polygonSelected, `${language} polygon status should be localized`);
    assert.notEqual(text.polygonAdjust, english.polygonAdjust, `${language} polygon guidance should be localized`);
    assert.notEqual(text.rectangleFirst, english.rectangleFirst, `${language} rectangle guidance should be localized`);
    assert.notEqual(text.circleCenter, english.circleCenter, `${language} circle guidance should be localized`);
    assert.notEqual(text.search, english.search, `${language} map search action should be localized`);
    assert.notEqual(text.cornerTooltip, english.cornerTooltip, `${language} corner tooltip should be localized`);
    assert.notEqual(text.closePolygon, english.closePolygon, `${language} close-polygon tooltip should be localized`);
  }
});

test('dynamic corner counts are inserted into localized map guidance', () => {
  for (const language of ['en', ...LOCAL_LANGUAGES]) {
    const text = getMapPickerText(language);
    const rendered = formatMapPickerText(text.finishPolygon, 4);
    assert.match(rendered, /4/);
    assert.doesNotMatch(rendered, /\{count\}/);
  }
});
