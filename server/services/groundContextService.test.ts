import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGroundSamplingLayout, buildSoilSamplingLayout, sampleSoilGridsVariability, summarizeGroundContext } from './groundContextService';

test('ground sampling layout is deterministic, scoped and capped at nine points', () => {
  const layout = buildGroundSamplingLayout(52, 21, 10000, { type: 'polygon', points: [[51.999, 20.999], [51.999, 21.001], [52.001, 21.001], [52.001, 20.999], [52, 20.998], [51.999, 20.999]] });
  assert.equal(layout[0].scope, 'SITE');
  assert.equal(layout[0].id, 'site-centroid');
  assert.ok(layout.filter(point => point.scope === 'PARCEL').length <= 4);
  assert.equal(layout.filter(point => point.scope === 'VICINITY').length, 4);
  assert.ok(layout.length <= 9);
  assert.equal(new Set(layout.map(point => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`)).size, layout.length);
});

test('soil sampling uses at most centroid, two parcel positions and two vicinity positions', () => {
  const layout = buildGroundSamplingLayout(52, 21, 10000, { type: 'polygon', points: [[51.999, 20.999], [51.999, 21.001], [52.001, 21.001], [52.001, 20.999]] });
  const soil = buildSoilSamplingLayout(layout);
  assert.equal(soil.length, 5);
  assert.equal(soil.filter(point => point.scope === 'SITE').length, 1);
  assert.ok(soil.filter(point => point.scope === 'PARCEL').length <= 2);
  assert.ok(soil.filter(point => point.scope === 'VICINITY').length <= 2);
});

test('homogeneous mapped evidence is low variability when supported by multiple samples', () => {
  const summary = summarizeGroundContext([
    { pointId: 'site-centroid', scope: 'SITE', unit: 'Sand', lithology: 'fine sand', sourceName: 'PGI', sourceScale: '1:50,000' },
    { pointId: 'parcel-1', scope: 'PARCEL', unit: 'sand', lithology: 'fine sand', sourceName: 'PGI', sourceScale: '1:50,000' },
    { pointId: 'vicinity-north', scope: 'VICINITY', unit: 'SAND', lithology: 'fine sand', sourceName: 'PGI', sourceScale: '1:50,000' }
  ]);
  assert.equal(summary.variabilityClass, 'LOW');
  assert.equal(summary.distinctMappedUnits.length, 1);
  assert.equal(summary.transitionIndicated, false);
  assert.ok(summary.materialIndicators.includes('GRANULAR'));
});

test('contrasting mapped units increase variability without inventing a boundary distance', () => {
  const summary = summarizeGroundContext([
    { pointId: 'site-centroid', scope: 'SITE', unit: 'Glaciofluvial sand', lithology: 'sand', sourceName: 'PGI' },
    { pointId: 'vicinity-east', scope: 'VICINITY', unit: 'Alluvial deposits', lithology: 'silt and sand', sourceName: 'PGI' }
  ]);
  assert.equal(summary.variabilityClass, 'MODERATE');
  assert.equal(summary.transitionIndicated, true);
  assert.equal(summary.distinctMappedUnits.length, 2);
  assert.doesNotMatch(JSON.stringify(summary), /boundaryDistance|distanceToBoundary|\b\d+\s*m\b/i);
});

test('alluvial and organic context is high-priority variability screening, not engineering evidence', () => {
  const summary = summarizeGroundContext([
    { pointId: 'site-centroid', scope: 'SITE', unit: 'Glaciofluvial sand', lithology: 'sand', sourceName: 'PGI' },
    { pointId: 'parcel-1', scope: 'PARCEL', unit: 'Alluvial deposits', lithology: 'silt', sourceName: 'PGI' },
    { pointId: 'vicinity-south', scope: 'VICINITY', unit: 'Peat and organic deposits', lithology: 'peat', sourceName: 'PGI' }
  ]);
  assert.equal(summary.variabilityClass, 'HIGH');
  assert.ok(summary.materialIndicators.includes('ALLUVIAL'));
  assert.ok(summary.materialIndicators.includes('ORGANIC_OR_PEAT'));
  assert.doesNotMatch(JSON.stringify(summary), /bearing|friction|cohesion|settlement|foundation|groundwater depth|hydraulic conductivity/i);
});

test('insufficient mapped evidence remains explicitly insufficient', () => {
  const summary = summarizeGroundContext([{ pointId: 'site-centroid', scope: 'SITE', unit: null, lithology: null, sourceName: 'PGI' }]);
  assert.equal(summary.variabilityClass, 'INSUFFICIENT_EVIDENCE');
  assert.equal(summary.sampleCount, 0);
  assert.equal(summary.dominantMappedUnit, null);
});

test('SoilGrids multi-point summary remains pedological model evidence only', async () => {
  const layout = buildGroundSamplingLayout(52, 21, 10000, { type: 'polygon', points: [[51.999, 20.999], [51.999, 21.001], [52.001, 21.001], [52.001, 20.999]] });
  let call = 0;
  const fakeFetcher = async () => {
    call += 1;
    return {
      success: true,
      sourceName: 'SoilGrids', sourceUrl: 'x', datasetVersion: '250 m', usdaTextureClass: call % 2 ? 'Sandy Loam' : 'Loam',
      topsoilClayPct: 20 + call, topsoilSandPct: 50 - call, topsoilSiltPct: 30,
      subsoilClayPct: 22, subsoilSandPct: 45, subsoilSiltPct: 33, meanBulkDensityGcm3: 1.3, meanPhH2O: 6.8, meanOrganicCarbonPct: 1.2,
      estimatedBearingCapacityKpa: 'Not available', effectiveFrictionAngleDeg: Number.NaN, cohesionKpa: Number.NaN, hydraulicConductivityMs: 'Not available', drainageClass: 'Not available', frostSusceptibilityClass: 'Not available' as const, topsoilStrippingDepthCm: Number.NaN,
      stratigraphyProfile: [], limitation: 'pedological only'
    };
  };
  const summary = await sampleSoilGridsVariability(layout, undefined, fakeFetcher);
  assert.equal(summary.evidenceType, 'PEDOLOGICAL_MODEL');
  assert.equal(summary.sampleCount, 5);
  assert.equal(summary.validSampleCount, 5);
  assert.equal(summary.variationObserved, true);
  assert.equal(summary.textureClasses.length, 2);
  const unsafe = summary as unknown as Record<string, unknown>;
  for (const field of ['bearingCapacity', 'frictionAngle', 'cohesion', 'settlement', 'foundationRecommendation', 'designGroundwater', 'hydraulicConductivity']) {
    assert.equal(field in unsafe, false, `${field} must not be emitted as a structured SoilGrids variability field`);
  }
  assert.match(summary.limitation, /does not provide bearing capacity/i);
  assert.match(summary.limitation, /pedological context only/i);
});