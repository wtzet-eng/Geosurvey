import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FloatingSupportLandSurf, SupportLandSurf } from '../components/SupportLandSurf';
import { localizeAspect } from './aspectI18n';

test('support CTA remains visible with the configured Ko-fi destination', () => {
  const html = renderToStaticMarkup(React.createElement(SupportLandSurf));
  assert.match(html, /Support LandSurf/);
  assert.match(html, /Thank you for support/);
  assert.match(html, /https:\/\/ko-fi\.com\/surveyland/);
  assert.match(html, /#496931/i);
});

test('Czech Slovak and Danish views localize cardinal words while preserving degrees', () => {
  assert.equal(localizeAspect('West (270°)', 'cs', 'údaj není k dispozici'), 'Západ (270°)');
  assert.equal(localizeAspect('North (0°)', 'sk', 'údaj nie je k dispozícii'), 'Sever (0°)');
  assert.equal(localizeAspect('East (83°)', 'da', 'ikke tilgængelig'), 'Øst (83°)');
});


test('floating Ko-fi shortcut remains available for the desktop report corner', () => {
  const html = renderToStaticMarkup(React.createElement(FloatingSupportLandSurf));
  assert.match(html, /Support on Ko-fi/);
  assert.match(html, /https:\/\/ko-fi\.com\/surveyland/);
  assert.match(html, /#496931/i);
});
