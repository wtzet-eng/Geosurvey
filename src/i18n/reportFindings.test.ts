import test from 'node:test';
import assert from 'node:assert/strict';
import { distinctProse, riskSeverity } from './reportFindings';

test('explicit high classifications stand out across report languages', () => {
  for (const value of ['High', ' HIGH ', 'Very High', 'Hoch', 'Wysokie', 'Élevé', 'Alto', 'Korkea', 'Hoog']) assert.equal(riskSeverity(value), 'high');
  for (const value of ['Low', 'Negligible', 'Requires verification', 'No high risk identified', '1 in 20 homes have high radon']) assert.equal(riskSeverity(value), 'other');
  assert.equal(riskSeverity('Umiarkowane'), 'moderate');
});

test('section prose removes repeated sentences but preserves new results and decimals', () => {
  assert.equal(distinctProse('Mapped unit: limestone. Mapped unit: limestone. Slope is 3.5 degrees.'), 'Mapped unit: limestone. Slope is 3.5 degrees.');
  assert.equal(distinctProse('Mapped unit: limestone. Check foundations.', 'Mapped unit: limestone.'), 'Check foundations.');
  assert.equal(distinctProse('No mapped overlap. No mapped overlap nearby.'), 'No mapped overlap. No mapped overlap nearby.');
  assert.equal(distinctProse(undefined), '');
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EvidenceScoreCard } from '../components/EvidenceScoreCard';
import type { EvidenceQualityScore } from '../types';

test('zero coverage remains zero and is explicitly separated from risk', () => {
  const score = { totalScore: 0, verifiedCount: 0, modelledCount: 0, unverifiedCount: 6 } as EvidenceQualityScore;
  const html = renderToStaticMarkup(React.createElement(EvidenceScoreCard, {score}));
  assert.match(html, /Data coverage/);
  assert.match(html, /not site quality or risk/);
  assert.match(html, /width:0%/);
  assert.doesNotMatch(html, /Direct On-Site Evidence|Calculated Quality|Robust Evidence/);
});
