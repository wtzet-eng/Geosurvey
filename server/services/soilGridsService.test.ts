import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchGenuineSoilGridsData } from './soilGridsService';

const originalFetch = globalThis.fetch;
const rawFor = (layer: string) => layer.startsWith('sand_') ? 400 : layer.startsWith('silt_') ? 350 : layer.startsWith('clay_') ? 250 : layer.startsWith('soc_') ? 180 : layer.startsWith('bdod_') ? 135 : 65;

test('SoilGrids WMS parses realistic plain-text GetFeatureInfo values', async () => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input); if (url.includes('rest.isric.org')) return new Response('{}', { status: 503 });
    const layer = new URL(url).searchParams.get('QUERY_LAYERS') || ''; const raw = rawFor(layer);
    return new Response(`GetFeatureInfo results:\nLayer '${layer}'\n  Feature 0:\n    value = '${raw}'\n`, { status: 200, headers: { 'content-type': 'text/plain' } });
  }) as typeof fetch;
  try {
    const result = await fetchGenuineSoilGridsData(52, -1);
    assert.equal(result.success, true); assert.match(result.sourceName, /WMS raster/); assert.match(result.datasetVersion, /0–5 cm and 30–60 cm/); assert.equal(result.topsoilSandPct, 40); assert.equal(result.meanBulkDensityGcm3, 1.35); assert.equal(result.meanPhH2O, 6.5); assert.equal(result.stratigraphyProfile.length, 2);
    assert.equal(result.estimatedBearingCapacityKpa, 'Not available'); assert.ok(Number.isNaN(result.effectiveFrictionAngleDeg)); assert.ok(Number.isNaN(result.cohesionKpa)); assert.match(result.limitation, /No bearing capacity/);
  } finally { globalThis.fetch = originalFetch; }
});

test('SoilGrids WMS parses GML/XML attributes without assuming JSON', async () => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input); if (url.includes('rest.isric.org')) return new Response('{}', { status: 503 });
    const layer = new URL(url).searchParams.get('QUERY_LAYERS') || ''; return new Response(`<msGMLOutput><${layer}_layer><${layer}_feature><FIELDS GRAY_INDEX="${rawFor(layer)}" /></${layer}_feature></${layer}_layer></msGMLOutput>`, { status: 200, headers: { 'content-type': 'application/vnd.ogc.gml' } });
  }) as typeof fetch;
  try { const result = await fetchGenuineSoilGridsData(52, -1); assert.equal(result.success, true); assert.equal(result.topsoilClayPct, 25); assert.equal(result.meanOrganicCarbonPct, 1.8); }
  finally { globalThis.fetch = originalFetch; }
});

test('SoilGrids REST and WMS unavailability remains explicit', async () => {
  globalThis.fetch = (async () => new Response('{}', { status: 503 })) as typeof fetch;
  try { const result = await fetchGenuineSoilGridsData(52, -1); assert.equal(result.success, false); assert.equal(result.usdaTextureClass, 'Not available'); assert.ok(Number.isNaN(result.meanPhH2O)); }
  finally { globalThis.fetch = originalFetch; }
});
