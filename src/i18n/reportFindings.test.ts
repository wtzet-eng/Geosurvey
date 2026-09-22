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

test('public evidence card shows evidence states without a numeric quality score', () => {
  const score = { totalScore: 0, verifiedCount: 0, modelledCount: 0, unverifiedCount: 6 } as EvidenceQualityScore;
  const html = renderToStaticMarkup(React.createElement(EvidenceScoreCard, {score}));
  assert.match(html, /Evidence available for this site/);
  assert.match(html, /not whether the site is good or bad/);
  assert.match(html, /Needs verification/);
  assert.doesNotMatch(html, /0\/100|Calculated Quality|Robust Evidence/);
});

import { buyerSummary, decisionIntroCopy, findingsCopy } from './reportFindings';
test('buyer summary does not turn missing evidence into a purchase advantage', () => {
 const result=buyerSummary({risks:[{category:'Landslide',level:'Low',evidence_level:'REQUIRES_VERIFICATION'}],planningConfirmed:false,floodConfirmed:false},'en');
 assert.equal(result.positives.length,0);
 assert.equal(result.checks.length,3);
 assert.match(result.copy.noConcern,/other risks may remain/);
});
test('buyer summary explains supported findings and prioritises high concerns', () => {
 const result=buyerSummary({slope:1.7,risks:[{category:'Radon',level:'Moderate'},{category:'Landslide',level:'High'}],planningConfirmed:true,floodConfirmed:true},'en');
 assert.match(result.positives[0],/1.7°/);
 assert.match(result.concerns[0],/Landslide: High/);
 assert.equal(result.checks.length,1);
});

test('decision-first opening is localized for shared and dedicated country languages', () => {
  const cases = [
    ['de', /Erster Überblick/i],
    ['nl', /eerste controle/i],
    ['fi', /ensitarkistus/i],
    ['fr', /première vérification/i],
    ['es', /primera comprobación/i],
    ['sv', /första kontroll/i],
    ['no', /første kontroll/i],
    ['sk', /prvá kontrola/i],
    ['da', /første vurdering/i],
    ['cs', /první kontrola/i],
    ['hr', /Korisna prva provjera/i],
  ] as const;
  for (const [language, expected] of cases) {
    const opening = decisionIntroCopy(language);
    const buyer = buyerSummary({ slope: 1.2, risks: [], planningConfirmed: false, floodConfirmed: false }, language);
    assert.match(opening.verdict, expected);
    assert.doesNotMatch([opening.verdict, opening.nextTitle, buyer.copy.positive, buyer.copy.checks, findingsCopy(language).findings].join('\n'), /A useful first check|Suitability for development|What still needs checking|Key findings at a glance|Your next checks/i, language);
  }
});

test('Danish and Czech risk labels are understood by the decision summary', () => {
  assert.equal(riskSeverity('Høj'), 'high');
  assert.equal(riskSeverity('Moderat'), 'moderate');
  assert.equal(riskSeverity('Hög'), 'high');
  assert.equal(riskSeverity('Måttlig'), 'moderate');
  assert.equal(riskSeverity('Høy'), 'high');
  assert.equal(riskSeverity('Vysoké'), 'high');
  assert.equal(riskSeverity('Stredné'), 'moderate');
  const sv = buyerSummary({ risks: [{ category: 'Ras och skred', level: 'Försumbar', evidence_level: 'MODELLED' }], planningConfirmed: false, floodConfirmed: false }, 'sv');
  assert.equal(sv.positives.length, 1);
  const da = buyerSummary({ risks: [{ category: 'Radon', level: 'Lav', evidence_level: 'VERIFIED' }], planningConfirmed: true, floodConfirmed: true }, 'da');
  assert.equal(da.positives.length, 1);
});