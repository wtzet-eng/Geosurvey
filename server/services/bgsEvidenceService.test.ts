import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchBgsSiteEvidence, ukGeotechnicalDesignFallback } from './bgsEvidenceService';

const endpoints = { detailed: 'https://test/detailed', regional: 'https://test/regional', hydrogeology: 'https://test/hydro', boreholes: 'https://test/boreholes' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const mockFetch = (routes: (url: string) => unknown): typeof fetch => (async (input: string | URL | Request) => { const url = String(input); const value = routes(url); return value === undefined ? json({}, 404) : json(value); }) as typeof fetch;

const liveBedrockShape = { features: [{ attributes: { OBJECTID: 42, LEX: 'WAW', LEX_RCS_I: 'WAW-MDST', LEX_RCS_D: 'WARWICKSHIRE GROUP - MUDSTONE, SILTSTONE AND SANDSTONE', LEX_D: 'WARWICKSHIRE GROUP', RCS: 'MDST', RCS_D: 'MUDSTONE, SILTSTONE AND SANDSTONE', MIN_TIME_D: 'DUCKMANTIAN', MAX_TIME_D: 'BOLSOVIAN', MIN_PERIOD: 'CARBONIFEROUS', MAX_PERIOD: 'CARBONIFEROUS', MAX_EPOCH: 'PENNSYLVANIAN', MAX_ERA: 'PALAEOZOIC', RANK: 'GROUP', NOM_SCALE: '1:50 000' } }] };
const liveSuperficialShape = { features: [{ attributes: { OBJECTID: 99, LEX: 'ALV', LEX_RCS_D: 'ALLUVIUM - CLAY, SILT, SAND AND GRAVEL', LEX_D: 'ALLUVIUM', RCS: 'CLSS', RCS_D: 'CLAY, SILT, SAND AND GRAVEL', MAX_PERIOD: 'QUATERNARY', NOM_SCALE: '1:50 000' } }] };
const emptyContexts = (url: string) => url === `${endpoints.hydrogeology}?f=pjson` || url === `${endpoints.boreholes}?f=pjson` ? { layers: [] } : undefined;

test('live BGS detailed fields map explicitly and superficial geology remains separate', async () => {
  const result = await fetchBgsSiteEvidence(52, -1, mockFetch(url => {
    if (url.includes('/detailed/4/query')) return liveBedrockShape;
    if (url.includes('/detailed/3/query')) return liveSuperficialShape;
    return emptyContexts(url);
  }), endpoints);
  assert.equal(result.geology.tier, 1);
  assert.equal(result.geology.unitName, 'WARWICKSHIRE GROUP');
  assert.equal(result.geology.lithology, 'MUDSTONE, SILTSTONE AND SANDSTONE');
  assert.equal(result.geology.geologicalAge, 'DUCKMANTIAN – BOLSOVIAN – PENNSYLVANIAN – PALAEOZOIC');
  assert.equal(result.geology.superficialDeposit, 'ALLUVIUM');
  assert.equal(result.geology.superficialLithology, 'CLAY, SILT, SAND AND GRAVEL');
  assert.equal(result.geology.scale, '1:50 000');
  assert.match(result.geology.sourceUrl, /\/4$/);
});

test('regional BGS layers 3 and 2 are queried when detailed bedrock has no feature', async () => {
  const result = await fetchBgsSiteEvidence(52, -1, mockFetch(url => {
    if (url.includes('/detailed/4/query') || url.includes('/detailed/3/query')) return { features: [] };
    if (url.includes('/regional/3/query')) return liveBedrockShape;
    if (url.includes('/regional/2/query')) return liveSuperficialShape;
    return emptyContexts(url);
  }), endpoints);
  assert.equal(result.geology.tier, 2); assert.equal(result.geology.unitName, 'WARWICKSHIRE GROUP'); assert.match(result.geology.sourceUrl, /\/3$/);
});

test('detailed superficial evidence is preserved while regional supplies missing bedrock', async () => {
  const result = await fetchBgsSiteEvidence(52, -1, mockFetch(url => {
    if (url.includes('/detailed/4/query')) return { features: [] };
    if (url.includes('/detailed/3/query')) return liveSuperficialShape;
    if (url.includes('/regional/3/query')) return liveBedrockShape;
    if (url.includes('/regional/2/query')) return { features: [] };
    return emptyContexts(url);
  }), endpoints);
  assert.equal(result.geology.tier, 2); assert.equal(result.geology.unitName, 'WARWICKSHIRE GROUP'); assert.equal(result.geology.superficialDeposit, 'ALLUVIUM');
});

test('missing one BGS field does not discard the other mapped scientific fields', async () => {
  const partial = { features: [{ attributes: { LEX: 'WAW', LEX_RCS_D: 'WARWICKSHIRE GROUP - MUDSTONE', MIN_PERIOD: 'CARBONIFEROUS', MAX_ERA: 'PALAEOZOIC', NOM_SCALE: '1:50 000' } }] };
  const result = await fetchBgsSiteEvidence(52, -1, mockFetch(url => url.includes('/detailed/4/query') ? partial : url.includes('/detailed/3/query') ? { features: [] } : emptyContexts(url)), endpoints);
  assert.equal(result.geology.unitName, 'WARWICKSHIRE GROUP - MUDSTONE'); assert.equal(result.geology.lithology, 'MUDSTONE'); assert.equal(result.geology.geologicalAge, 'CARBONIFEROUS – PALAEOZOIC');
});

test('all unavailable BGS geology remains explicit and does not infer a unit', async () => {
  const result = await fetchBgsSiteEvidence(52, -1, mockFetch(() => undefined), endpoints);
  assert.equal(result.geology.available, false); assert.equal(result.geology.tier, 4); assert.equal(result.geology.unitName, null); assert.equal(result.geology.lithology, null); assert.equal(result.geology.geologicalAge, null); assert.equal(result.geology.status, 'REQUIRES_VERIFICATION');
});

test('modelled groundwater and nearby boreholes remain separate contextual evidence', async () => {
  const result = await fetchBgsSiteEvidence(52, -1, mockFetch(url => {
    if (/\/(detailed|regional)\/[234]\/query/.test(url)) return { features: [] };
    if (url === `${endpoints.hydrogeology}?f=pjson`) return { layers: [{ id: 7, name: 'Modelled depth to groundwater' }] };
    if (url === `${endpoints.boreholes}?f=pjson`) return { layers: [{ id: 8, name: 'Borehole records' }] };
    if (url.includes('/hydro/7/query')) return { features: [{ attributes: { DEPTH_RANGE: '3–5 m' } }] };
    if (url.includes('/boreholes/8/query')) return { features: [{ attributes: { BOREHOLE_ID: 'BH-42' }, geometry: { x: -1.02, y: 52.01 } }] };
  }), endpoints);
  assert.equal(result.groundwater.status, 'MODELLED'); assert.equal(result.groundwater.modelledDepth, '3–5 m'); assert.match(result.groundwater.limitation, /not a measured parcel-specific/i);
  assert.equal(result.boreholes.count, 1); assert.equal(result.boreholes.nearestRecordId, 'BH-42'); assert.ok(result.boreholes.nearestDistanceKm! > 0); assert.match(result.boreholes.limitation, /contextual/i);
});

test('UK design geotechnical values remain unavailable without explicit engineering evidence', () => {
  const values = ukGeotechnicalDesignFallback(); assert.match(values.bearingCapacity, /Not available/); assert.ok(Number.isNaN(values.frictionAngle)); assert.ok(Number.isNaN(values.cohesion)); assert.match(values.hydraulicConductivity, /Not available/); assert.match(values.drainageClass, /Not available/);
});
