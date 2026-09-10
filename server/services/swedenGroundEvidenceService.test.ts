import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichSwedenGroundEvidence, querySwedenGroundEvidence } from './swedenGroundEvidenceService';

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const assertCrs84 = (url: string) => {
  assert.match(url, /bbox-crs=/);
  assert.match(decodeURIComponent(url), /CRS84/);
};

test('SGU Sweden acquisition keeps superficial geology, bedrock, wells and groundwater stations separate', async () => {
  const fetcher: typeof fetch = async (input: any) => {
    const url = String(input);
    assertCrs84(url);
    if (url.includes('/jordarter25k-100k/')) return jsonResponse({ features: [{ properties: { jg2_tx: 'Glacial lera', kartering: 'test', karttyp_tx: 'Fältkartläggning' } }] });
    if (url.includes('/berggrund50k-250k/')) return jsonResponse({ features: [{ properties: { geo_enh_tx: 'Svekokarelska orogenen', bergart_tx: 'Granit', tekt_n_tx: 'Svekokarelska orogenen', lito_n_tx: 'Intrusivbergart', rek_skala: '1:50k', rev_dat: '2025-04-10' } }] });
    if (url.includes('/brunnar/')) return jsonResponse({ features: [{ geometry: { type: 'Point', coordinates: [18.0705, 59.3320] }, properties: { obsplatsid: 'well-1', brunnsid: 123, kommunnamn: 'Stockholm', fastighet: 'TEST 1:1', borrdatum: '2024-02-03', totaldjup: 62, jorddjup: 9.5, grundvattenniva: 3.2, nivadatum: '2024-02-03', anvandning: 'Energibrunn', posvardering: 'GPS' } }] });
    if (url.includes('/grundvattennivaer-observerade/')) return jsonResponse({ features: [{ geometry: { type: 'Point', coordinates: [18.08, 59.34] }, properties: { provplatsid: 'gw-1', obsplatsnamn: 'Teststation', akvifer_tx: 'jord, öppet magasin', jordart_tx: 'morän', jorddjup: 4.2, kommun: 'Stockholm', lan: 'Stockholms län', fdat: '2018-01-01', tdat: '2026-08-01' } }] });
    throw new Error(`Unexpected URL: ${url}`);
  };

  const items = await querySwedenGroundEvidence(59.331, 18.068, fetcher);
  assert.equal(items.length, 4);
  assert.equal(items.find(item => item.id === 'se-sgu-surface-geology')?.status, 'VERIFIED');
  assert.equal(items.find(item => item.id === 'se-sgu-bedrock')?.status, 'VERIFIED');
  assert.equal(items.find(item => item.id === 'se-sgu-well-context')?.status, 'VERIFIED');
  assert.equal(items.find(item => item.id === 'se-sgu-groundwater-stations')?.status, 'VERIFIED');
  assert.match(String(items.find(item => item.id === 'se-sgu-surface-geology')?.claim), /Glacial lera/);
  assert.match(String(items.find(item => item.id === 'se-sgu-bedrock')?.claim), /Granit/);

  const report: any = { geosurvey_context: {} };
  enrichSwedenGroundEvidence(report, items);
  assert.equal(report.geosurvey_context.geological_unit_name, 'Svekokarelska orogenen');
  assert.equal(report.geosurvey_context.lithology_type, 'Granit');
  assert.equal(report.geosurvey_context.superficial_deposit, 'Glacial lera');
  assert.equal(report.geosurvey_context.evidence_level, 'VERIFIED');
  assert.equal(report.soil?.estimatedWaterTableDepthM, undefined);
});

test('northern Sweden falls back from detailed superficial geology to SGU 1:250k without inventing finer precision', async () => {
  const fetcher: typeof fetch = async (input: any) => {
    const url = String(input);
    if (url.includes('/jordarter25k-100k/')) return jsonResponse({ features: [] });
    if (url.includes('/jordarter250k/')) return jsonResponse({ features: [{ properties: { jg2_tx: 'Morän' } }] });
    return jsonResponse({ features: [] });
  };
  const items = await querySwedenGroundEvidence(67.85, 20.22, fetcher);
  const surface = items.find(item => item.id === 'se-sgu-surface-geology');
  assert.equal(surface?.status, 'VERIFIED');
  assert.equal((surface?.value as any)?.scale, '1:250 000');
  assert.match(surface?.sourceName || '', /nordligaste Sverige/i);
});

test('SGU source failures fail closed and nearby observations never become parcel design values', async () => {
  const fetcher: typeof fetch = async (input: any) => {
    const url = String(input);
    if (url.includes('/jordarter25k-100k/')) return new Response('down', { status: 503 });
    return jsonResponse({ features: [] });
  };
  const items = await querySwedenGroundEvidence(59.3, 18.1, fetcher);
  const surface = items.find(item => item.id === 'se-sgu-surface-geology-unavailable');
  assert.equal(surface?.status, 'REQUIRES_VERIFICATION');
  assert.equal((surface?.value as any)?.reasonCode, 'SOURCE_UNAVAILABLE');
  assert.ok(items.every(item => item.status === 'REQUIRES_VERIFICATION'));

  const report: any = { soil: { estimatedBearingCapacityKpa: null, effectiveFrictionAngleDeg: null, cohesionKpa: null, estimatedWaterTableDepthM: null }, geosurvey_context: {} };
  enrichSwedenGroundEvidence(report, items);
  assert.equal(report.soil.estimatedBearingCapacityKpa, null);
  assert.equal(report.soil.effectiveFrictionAngleDeg, null);
  assert.equal(report.soil.cohesionKpa, null);
  assert.equal(report.soil.estimatedWaterTableDepthM, null);
});
