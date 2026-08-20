import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchBgsSiteEvidence, ukGeotechnicalDesignFallback } from './bgsEvidenceService';

const endpoints = { detailed: 'https://test/detailed', regional: 'https://test/regional', geoIndex: 'https://test/geo' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const mockFetch = (routes: (url: string) => unknown): typeof fetch => (async (input: string | URL | Request) => {
  const url = String(input); const value = routes(url); return value === undefined ? json({}, 404) : json(value);
}) as typeof fetch;

const bedrock = { features: [{ attributes: { LEX_D: 'German Basin', LITHOLOGY: 'Mudstone', AGE: 'Triassic' } }] };

test('detailed BGS geology wins and preserves scientific fields and tier metadata', async () => {
  const result = await fetchBgsSiteEvidence(52, -1, mockFetch(url => {
    if (url === `${endpoints.detailed}?f=pjson`) return { layers: [{ id: 1, name: 'Bedrock geology' }, { id: 2, name: 'Superficial deposits' }] };
    if (url.includes('/detailed/1/query')) return bedrock;
    if (url.includes('/detailed/2/query')) return { features: [{ attributes: { UNIT_NAME: 'Alluvium' } }] };
    if (url === `${endpoints.geoIndex}?f=pjson`) return { layers: [] };
  }), endpoints);
  assert.equal(result.geology.tier, 1); assert.equal(result.geology.unitName, 'German Basin'); assert.equal(result.geology.lithology, 'Mudstone'); assert.equal(result.geology.geologicalAge, 'Triassic'); assert.equal(result.geology.superficialDeposit, 'Alluvium'); assert.equal(result.geology.status, 'VERIFIED'); assert.equal(result.geology.scale, '1:50,000');
});

test('regional BGS geology is used only when detailed mapping has no usable feature', async () => {
  const result = await fetchBgsSiteEvidence(52, -1, mockFetch(url => {
    if (url === `${endpoints.detailed}?f=pjson`) return { layers: [{ id: 1, name: 'Bedrock geology' }] };
    if (url.includes('/detailed/1/query')) return { features: [] };
    if (url === `${endpoints.regional}?f=pjson`) return { layers: [{ id: 4, name: 'Regional geology' }] };
    if (url.includes('/regional/4/query')) return bedrock;
    if (url === `${endpoints.geoIndex}?f=pjson`) return { layers: [] };
  }), endpoints);
  assert.equal(result.geology.tier, 2); assert.equal(result.geology.scale, '1:625,000'); assert.equal(result.geology.unitName, 'German Basin');
});

test('all unavailable BGS geology remains explicit and does not infer a unit', async () => {
  const result = await fetchBgsSiteEvidence(52, -1, mockFetch(() => undefined), endpoints);
  assert.equal(result.geology.available, false); assert.equal(result.geology.tier, 4); assert.equal(result.geology.unitName, null); assert.equal(result.geology.status, 'REQUIRES_VERIFICATION');
});

test('modelled groundwater and nearby boreholes remain separate contextual evidence', async () => {
  const result = await fetchBgsSiteEvidence(52, -1, mockFetch(url => {
    if (url === `${endpoints.detailed}?f=pjson`) return { layers: [] };
    if (url === `${endpoints.regional}?f=pjson`) return { layers: [] };
    if (url === `${endpoints.geoIndex}?f=pjson`) return { layers: [{ id: 7, name: 'Modelled depth to groundwater' }, { id: 8, name: 'Borehole records' }] };
    if (url.includes('/geo/7/query')) return { features: [{ attributes: { DEPTH_RANGE: '3–5 m' } }] };
    if (url.includes('/geo/8/query')) return { features: [{ attributes: { BOREHOLE_ID: 'BH-42' }, geometry: { x: -1.02, y: 52.01 } }] };
  }), endpoints);
  assert.equal(result.groundwater.status, 'MODELLED'); assert.equal(result.groundwater.modelledDepth, '3–5 m'); assert.match(result.groundwater.limitation, /not a measured parcel-specific/i);
  assert.equal(result.boreholes.count, 1); assert.equal(result.boreholes.nearestRecordId, 'BH-42'); assert.ok(result.boreholes.nearestDistanceKm! > 0); assert.match(result.boreholes.limitation, /contextual/i);
});

test('groundwater and boreholes remain unavailable when context layers are absent', async () => {
  const result = await fetchBgsSiteEvidence(52, -1, mockFetch(url => url.endsWith('?f=pjson') ? { layers: [] } : undefined), endpoints);
  assert.equal(result.groundwater.available, false); assert.equal(result.groundwater.modelledDepth, null); assert.equal(result.boreholes.available, false); assert.equal(result.boreholes.count, 0);
});

test('UK design geotechnical values remain unavailable without explicit engineering evidence', () => {
  const values = ukGeotechnicalDesignFallback();
  assert.match(values.bearingCapacity, /Not available/);
  assert.ok(Number.isNaN(values.frictionAngle));
  assert.ok(Number.isNaN(values.cohesion));
  assert.match(values.hydraulicConductivity, /Not available/);
  assert.match(values.drainageClass, /Not available/);
});
