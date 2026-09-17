import test from 'node:test';
import assert from 'node:assert/strict';
import { getActionText } from '../utils/actionI18n';

const LOCAL_LANGUAGES = ['de', 'pl', 'nl', 'cs', 'da', 'no', 'sv', 'sk', 'fr', 'es', 'fi'];

test('header actions are localized for every supported non-English language', () => {
  const english = getActionText('en');
  for (const language of LOCAL_LANGUAGES) {
    const text = getActionText(language);
    assert.notEqual(text.brandSubtitle, english.brandSubtitle, `${language} brand subtitle should be localized`);
    assert.notEqual(text.defaultLanguageNote, english.defaultLanguageNote, `${language} language note should be localized`);
    assert.notEqual(text.compare, english.compare, `${language} compare label should be localized`);
    assert.notEqual(text.embed, english.embed, `${language} embed label should be localized`);
    assert.notEqual(text.saved, english.saved, `${language} saved label should be localized`);
    assert.notEqual(text.driveTitle, english.driveTitle, `${language} Drive context should be localized`);
    assert.notEqual(text.interpretWithAi, english.interpretWithAi, `${language} AI action should be localized`);
  }
});

test('German action wording is used for the German page', () => {
  const text = getActionText('de-DE');
  assert.equal(text.brandSubtitle, 'Standortanalyse');
  assert.equal(text.defaultLanguageNote, 'Das Land legt die Standardsprache des Berichts fest; eine manuelle Auswahl bleibt erhalten.');
  assert.equal(text.compare, 'Standorte mit KI vergleichen');
  assert.equal(text.embed, 'Widget einbetten');
  assert.equal(text.saved, 'Gespeichert');
  assert.equal(text.interpretWithAi, 'Mit KI interpretieren');
});

test('Norwegian Bokmal resolves to Norwegian action copy', () => {
  assert.deepEqual(getActionText('nb-NO'), getActionText('no'));
});

test('Polish uses preliminary assessment wording for the brand subtitle', () => {
  const text = getActionText('pl-PL');
  assert.equal(text.brandSubtitle, 'Wstępna ocena');
  assert.equal(text.defaultLanguageNote, 'Kraj określa domyślny język raportu; ręcznie wybrany język pozostaje bez zmian.');
});
