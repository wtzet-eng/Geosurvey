import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchGenuineSoilGridsData } from './soilGridsService';

const originalFetch = globalThis.fetch;
const rawFor = (layer: string) => layer.startsWith('sand_') ? 400 : layer.startsWith('silt_') ? 350 : layer.startsWith('clay_') ? 250 : layer.startsWith('soc_') ? 180 : layer.startsWith('bdod_') ? 135 : 65;

function wmsText(layer: string, raw = rawFor(layer)) {
  return new Response(`GetFeatureInfo results:\nLayer '${layer}'\n  Feature 0:\n    value = '${raw}'\n`, { status: 200, headers: { 'content-type': 'text/plain' } });
}

test('SoilGrids WMS parses realistic plain-text GetFeatureInfo values', async () => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('rest.isric.org')) return new Response('{}', { status: 503 });
    const layer = new URL(url).searchParams.get('QUERY_LAYERS') || '';
    return wmsText(layer);
  }) as typeof fetch;
  try {
    const result = await fetchGenuineSoilGridsData(52, -1);
    assert.equal(result.success, true);
    assert.match(result.sourceName, /WMS raster/);
    assert.equal(result.topsoilSandPct, 40);
    assert.equal(result.meanBulkDensityGcm3, 1.35);
    assert.equal(result.meanPhH2O, 6.5);
    assert.equal(result.stratigraphyProfile.length, 2);
    assert.equal(result.estimatedBearingCapacityKpa, 'Not available');
    assert.ok(Number.isNaN(result.effectiveFrictionAngleDeg));
    assert.ok(Number.isNaN(result.cohesionKpa));
    assert.match(result.limitation, /No bearing capacity/i);
  } finally { globalThis.fetch = originalFetch; }
});

test('SoilGrids WMS parses GML/XML attributes without assuming JSON', async () => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('rest.isric.org')) return new Response('{}', { status: 503 });
    const layer = new URL(url).searchParams.get('QUERY_LAYERS') || '';
    return new Response(`<msGMLOutput><${layer}_layer><${layer}_feature><FIELDS GRAY_INDEX="${rawFor(layer)}" /></${layer}_feature></${layer}_layer></msGMLOutput>`, { status: 200, headers: { 'content-type': 'application/vnd.ogc.gml' } });
  }) as typeof fetch;
  try {
    const result = await fetchGenuineSoilGridsData(52, -1);
    assert.equal(result.success, true);
    assert.equal(result.topsoilClayPct, 25);
    assert.equal(result.meanOrganicCarbonPct, 1.8);
  } finally { globalThis.fetch = originalFetch; }
});

test('partial WMS preserves usable texture when optional properties fail', async () => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('rest.isric.org')) return new Response('{}', { status: 503 });
    const layer = new URL(url).searchParams.get('QUERY_LAYERS') || '';
    if (/^(soc|bdod|phh2o)_/.test(layer)) return new Response('temporary failure', { status: 503 });
    return wmsText(layer);
  }) as typeof fetch;
  try {
    const result = await fetchGenuineSoilGridsData(52, 21);
    assert.equal(result.success, true);
    assert.equal(result.usdaTextureClass, 'Loam');
    assert.equal(result.topsoilSandPct, 40);
    assert.equal(result.topsoilSiltPct, 35);
    assert.equal(result.topsoilClayPct, 25);
    assert.ok(Number.isNaN(result.meanBulkDensityGcm3));
    assert.ok(Number.isNaN(result.meanPhH2O));
    assert.ok(Number.isNaN(result.meanOrganicCarbonPct));
    assert.match(result.limitation, /retained even when optional properties are unavailable/i);
  } finally { globalThis.fetch = originalFetch; }
});

test('missing deeper texture does not erase valid topsoil texture', async () => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('rest.isric.org')) return new Response('{}', { status: 503 });
    const layer = new URL(url).searchParams.get('QUERY_LAYERS') || '';
    if (layer.includes('30-60cm')) return new Response('no cell', { status: 404 });
    return wmsText(layer);
  }) as typeof fetch;
  try {
    const result = await fetchGenuineSoilGridsData(52, 21);
    assert.equal(result.success, true);
    assert.equal(result.stratigraphyProfile.length, 1);
    assert.equal(result.topsoilSandPct, 40);
    assert.ok(Number.isNaN(result.subsoilSandPct));
  } finally { globalThis.fetch = originalFetch; }
});

test('REST partial response can provide texture without CEC or ancillary fields', async () => {
  const depths = ['0-5cm', '5-15cm', '15-30cm', '30-60cm'];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('maps.isric.org')) return new Response('{}', { status: 503 });
    const values: Record<string, number> = { sand: 400, silt: 350, clay: 250 };
    const layers = Object.entries(values).map(([name, mean]) => ({ name, depths: depths.map(label => ({ label, values: { mean } })) }));
    return new Response(JSON.stringify({ properties: { layers } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await fetchGenuineSoilGridsData(52, 21);
    assert.equal(result.success, true);
    assert.match(result.sourceName, /REST API/);
    assert.equal(result.usdaTextureClass, 'Loam');
    assert.ok(Number.isNaN(result.meanPhH2O));
    assert.ok(Number.isNaN(result.meanBulkDensityGcm3));
    assert.match(result.limitation, /Partial valid texture depths are retained/i);
  } finally { globalThis.fetch = originalFetch; }
});

test('SoilGrids WMS and REST unavailability remains explicit', async () => {
  globalThis.fetch = (async () => new Response('{}', { status: 503 })) as typeof fetch;
  try {
    const result = await fetchGenuineSoilGridsData(52, -1);
    assert.equal(result.success, false);
    assert.equal(result.usdaTextureClass, 'Not available');
    assert.ok(Number.isNaN(result.meanPhH2O));
  } finally { globalThis.fetch = originalFetch; }
});

test('successful SoilGrids evidence remains pedological and never creates engineering design values', async () => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('rest.isric.org')) return new Response('{}', { status: 503 });
    const layer = new URL(url).searchParams.get('QUERY_LAYERS') || '';
    return wmsText(layer);
  }) as typeof fetch;
  try {
    const result = await fetchGenuineSoilGridsData(52, 21);
    assert.equal(result.success, true);
    assert.equal(result.estimatedBearingCapacityKpa, 'Not available');
    assert.ok(Number.isNaN(result.effectiveFrictionAngleDeg));
    assert.ok(Number.isNaN(result.cohesionKpa));
    assert.ok(Number.isNaN(result.topsoilStrippingDepthCm));
    assert.ok(result.stratigraphyProfile.every(layer => Number.isNaN(layer.estimatedBearingCapacityKpa)));
    assert.match(result.limitation, /No bearing capacity, friction angle, cohesion, settlement/i);
  } finally { globalThis.fetch = originalFetch; }
});
