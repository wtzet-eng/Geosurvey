import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FloatingSupportLandSurf, SupportLandSurf, supportLandSurfCopy } from '../components/SupportLandSurf';
import { localizeAspect } from './aspectI18n';

test('support CTA remains visible with the configured Ko-fi destination', () => {
  const html = renderToStaticMarkup(React.createElement(SupportLandSurf));
  assert.match(html, /Support LandSurf/);
  assert.match(html, /Thank you for support/);
  assert.match(html, /https:\/\/ko-fi\.com\/surveyland/);
  assert.match(html, /#496931/i);
});

test('Czech Slovak Danish and Swedish views localize cardinal words while preserving degrees', () => {
  assert.equal(localizeAspect('West (270°)', 'cs', 'údaj není k dispozici'), 'Západ (270°)');
  assert.equal(localizeAspect('North (0°)', 'sk', 'údaj nie je k dispozícii'), 'Sever (0°)');
  assert.equal(localizeAspect('East (83°)', 'da', 'ikke tilgængelig'), 'Øst (83°)');
  assert.equal(localizeAspect('West (281°)', 'sv', 'inte tillgängligt'), 'Väster (281°)');
  assert.equal(localizeAspect('West (270°)', 'no', 'ikke tilgjengelig'), 'Vest (270°)');
});

test('support CTA is localized for report languages', () => {
  const cases = [['hr', /Podržite LandSurf/], ['pl', /Wesprzyj LandSurf/], ['es', /Apoyar LandSurf/], ['sk', /Podporte LandSurf/], ['no', /Støtt LandSurf/], ['sv', /Stöd LandSurf/]] as const;
  for (const [language, expected] of cases) {
    const copy = supportLandSurfCopy(language);
    assert.match(copy.heading, expected);
    const html = renderToStaticMarkup(React.createElement(SupportLandSurf, { language }));
    assert.match(html, expected);
    assert.doesNotMatch(html, /Support LandSurf|Thank you for support|Every supporter receives/i);
  }
});


test('Ko-fi shortcut is stackable below the AI action at the same width', () => {
  const html = renderToStaticMarkup(React.createElement(FloatingSupportLandSurf));
  assert.match(html, /Support LandSurf/);
  assert.match(html, /https:\/\/ko-fi\.com\/surveyland/);
  assert.match(html, /#496931/i);
  assert.match(html, /w-full/);
  assert.doesNotMatch(html, /fixed bottom-4 left-4/);
  assert.match(html, /print:hidden/);
});

test('Spanish support widget copy is fully localized', () => {
  const copy = supportLandSurfCopy('es');
  assert.equal(copy.heading, 'Apoyar LandSurf');
  assert.equal(copy.button, 'Gracias por su apoyo');
  assert.match(copy.body, /Si este informe le resultó útil/);
  assert.match(copy.thanks, /agradecimiento personal/);
  const html = renderToStaticMarkup(React.createElement(SupportLandSurf, { language: 'es' }));
  assert.doesNotMatch(html, /Support LandSurf|If this report was useful|Thank you for support|Every supporter receives/i);
});


test('Slovak support widget copy is fully localized', () => {
  const copy = supportLandSurfCopy('sk');
  assert.equal(copy.heading, 'Podporte LandSurf');
  assert.equal(copy.button, 'Ďakujem za podporu');
  assert.match(copy.body, /Ak bol report užitočný/);
  assert.match(copy.thanks, /osobné poďakovanie/);
  const html = renderToStaticMarkup(React.createElement(SupportLandSurf, { language: 'sk' }));
  assert.doesNotMatch(html, /Support LandSurf|If this report was useful|Thank you for support|Every supporter receives/i);
});
