import assert from 'node:assert/strict';
import test from 'node:test';
import { localizePresentationValue } from './reportPresentation';

test('canonical land-use classes are localized without changing unknown scientific text', () => {
  assert.equal(localizePresentationValue('farmland', 'pl'), 'grunty rolne');
  assert.equal(localizePresentationValue('residential', 'pl'), 'zabudowa mieszkaniowa');
  assert.equal(localizePresentationValue('forest', 'de'), 'Wald');
  assert.equal(localizePresentationValue('industrial', 'de'), 'Industriegebiet');
  assert.equal(localizePresentationValue('quarry', 'pl'), 'kamieniołom / obszar wydobywczy');
  assert.equal(localizePresentationValue('German Basin', 'pl'), 'German Basin');
});
