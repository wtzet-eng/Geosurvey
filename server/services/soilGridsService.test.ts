import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchGenuineSoilGridsData } from './soilGridsService';

const originalFetch = globalThis.fetch;

test('SoilGrids WMS raster fallback preserves modelled depth metadata and no design values', async () => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('rest.isric.org')) return new Response('{}', { status: 503 });
    const layer = new URL(url).searchParams.get('QUERY_LAYERS') || '';
    const raw = layer.startsWith('sand_') ? 400 : layer.startsWith('silt_') ? 350 : layer.startsWith('clay_') ? 250 : layer.startsWith('soc_') ? 180 : layer.startsWith('bdod_') ? 135 : 65;
    return new Response(JSON.stringify({ features: [{ properties: { value: raw } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await fetchGenuineSoilGridsData(52, -1);
    assert.equal(result.success, true); assert.match(result.sourceName, /WMS raster/); assert.match(result.datasetVersion, /0–5 cm and 30–60 cm/); assert.equal(result.topsoilSandPct, 40); assert.equal(result.meanBulkDensityGcm3, 1.35); assert.equal(result.meanPhH2O, 6.5); assert.equal(result.stratigraphyProfile.length, 2);
    assert.equal(result.estimatedBearingCapacityKpa, 'Not available'); assert.ok(Number.isNaN(result.effectiveFrictionAngleDeg)); assert.ok(Number.isNaN(result.cohesionKpa)); assert.match(result.limitation, /No bearing capacity/);
  } finally { globalThis.fetch = originalFetch; }
});

test('SoilGrids REST and WMS unavailability remains explicit', async () => {
  globalThis.fetch = (async () => new Response('{}', { status: 503 })) as typeof fetch;
  try { const result = await fetchGenuineSoilGridsData(52, -1); assert.equal(result.success, false); assert.equal(result.usdaTextureClass, 'Not available'); assert.ok(Number.isNaN(result.meanPhH2O)); }
  finally { globalThis.fetch = originalFetch; }
});
