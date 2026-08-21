import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIndicativeGroundOrientation, renderIndicativeGroundOrientation } from './orientation';
import { CanonicalGeologyEvidence } from '../reporting/canonicalReport';

const geology = (overrides: Partial<CanonicalGeologyEvidence>): CanonicalGeologyEvidence => ({
  unitName: null,
  lithology: null,
  geologicalAge: null,
  groundwaterRegime: null,
  status: 'MODELLED',
  sourceName: 'PGI-PIB',
  sourceUrl: 'https://geolog.pgi.gov.pl/',
  ...overrides
});

test('dense glaciofluvial sand can be broadly favourable only when density is explicit', () => {
  const result = resolveIndicativeGroundOrientation({
    geology: geology({ unitName: 'Piaski wodnolodowcowe', geologicalAge: 'Pleistocene' }),
    stateDescriptor: 'dense'
  });
  assert.equal(result.classification, 'GENERALLY_FAVOURABLE');
  assert.equal(result.designUse, false);
  assert.equal(result.siteSpecific, false);
  assert.ok(result.basis.includes('GENETIC_ORIGIN'));
  assert.ok(result.basis.includes('OBSERVED_STATE'));
});

test('glaciofluvial sand without a density/state observation remains variable', () => {
  const result = resolveIndicativeGroundOrientation({
    geology: geology({ unitName: 'Piaski wodnolodowcowe', geologicalAge: 'Pleistocene' })
  });
  assert.equal(result.classification, 'VARIABLE');
  assert.equal(result.designUse, false);
});

test('recent alluvial sand is not treated like older dense glacial sand', () => {
  const result = resolveIndicativeGroundOrientation({
    geology: geology({ unitName: 'Piaski rzeczne', lithology: 'sand', geologicalAge: 'Holocene' })
  });
  assert.equal(result.classification, 'VARIABLE');
  assert.ok(result.matchedSignals.includes('alluvial/fluvial origin'));
  assert.ok(result.matchedSignals.includes('recent/Holocene context'));
});

test('sand alone is insufficient and never implies density', () => {
  const result = resolveIndicativeGroundOrientation({ geology: geology({ lithology: 'sand' }) });
  assert.equal(result.classification, 'INSUFFICIENT_EVIDENCE');
  assert.ok(!result.matchedSignals.some(signal => signal.includes('dense')));
});

test('loose sand is potentially challenging regardless of generic sand material', () => {
  const result = resolveIndicativeGroundOrientation({ geology: geology({ lithology: 'sand' }), stateDescriptor: 'loose' });
  assert.equal(result.classification, 'POTENTIALLY_CHALLENGING');
});

test('organic deposits and made ground are special concern screening classes', () => {
  assert.equal(resolveIndicativeGroundOrientation({ geology: geology({ unitName: 'Torfy' }) }).classification, 'SPECIAL_CONCERN');
  assert.equal(resolveIndicativeGroundOrientation({ geology: geology({ unitName: 'Nasypy antropogeniczne' }) }).classification, 'SPECIAL_CONCERN');
});

test('orientation rendering is localized and explicitly not for design', () => {
  const resolved = resolveIndicativeGroundOrientation({
    geology: geology({ unitName: 'Piaski wodnolodowcowe' }),
    stateDescriptor: 'dense'
  });
  const pl = renderIndicativeGroundOrientation(resolved, 'pl');
  assert.equal(pl.label, 'Ogólnie korzystne');
  assert.equal(pl.designUse, false);
  assert.match(pl.disclaimer, /nie może być używana do projektowania/i);
});
