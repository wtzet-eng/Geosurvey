import assert from 'node:assert/strict';
import test from 'node:test';
import { CROATIA_GROUNDWATER_LAYER, CROATIA_HV_WMS, fetchCroatiaGroundwaterEvidence, enrichCroatiaGroundwaterEvidence } from './croatiaHydrogeologyService';

const feature = (inside: boolean) => ({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature', id: 'hr.wfd-podzemna-vodna-tijela.10',
    geometry: { type: 'Polygon', coordinates: [inside ? [[15.9,45.7],[16.1,45.7],[16.1,45.9],[15.9,45.9],[15.9,45.7]] : [[15.9,45.7],[16.1,45.7],[16.1,45.8],[15.9,45.8],[15.9,45.7]]] },
    properties: { localId: 'HRCSGI-27', nameText: 'ZAGREB', sizeValue: 988, sizeUoM: 'km2', QuantitativeStatusValue: 2, ChemicalStatusValue: 2, horizons: '1', versionId: 'v1.0', rZoneId: 'HRC' }
  }]
});
const mockFetch = (body: unknown, fail = false): typeof fetch => (async () => {
  if (fail) throw new Error('network');
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

test('Croatia groundwater service resolves the exact containing official body and WFD statuses', async () => {
  const evidence = await fetchCroatiaGroundwaterEvidence(45.815, 15.982, mockFetch(feature(true)));
  assert.equal(evidence.id, 'hr-groundwater-body-site');
  assert.equal(evidence.status, 'VERIFIED');
  assert.match(evidence.claim, /ZAGREB/);
  assert.deepEqual((evidence.value as any).quantitativeStatus, 'Good');
  assert.deepEqual((evidence.value as any).chemicalStatus, 'Good');
  assert.equal(evidence.sourceUrl, CROATIA_HV_WMS);
});

test('Croatia groundwater service rejects a nearby polygon that misses the exact coordinate', async () => {
  const evidence = await fetchCroatiaGroundwaterEvidence(45.815, 15.982, mockFetch(feature(false)));
  assert.equal(evidence.status, 'REQUIRES_VERIFICATION');
  assert.equal((evidence.value as any).reasonCode, 'NO_DATA');
});

test('Croatia groundwater service fails closed when the official service is unavailable', async () => {
  const evidence = await fetchCroatiaGroundwaterEvidence(45.815, 15.982, mockFetch('', true));
  assert.equal(evidence.status, 'REQUIRES_VERIFICATION');
  assert.equal((evidence.value as any).reasonCode, 'SOURCE_UNAVAILABLE');
});

test('Croatia groundwater enrichment preserves the distinction between regional status and parcel groundwater level', () => {
  const report: any = { soil: { groundwaterRegime: 'old', groundwaterNotice: 'old' } };
  const evidence: any = { id: 'hr-groundwater-body-site', status: 'VERIFIED', sourceName: 'Hrvatske vode', sourceUrl: CROATIA_HV_WMS, value: { groundwaterBodyName: 'ZAGREB', groundwaterBodyCode: 'HRCSGI-27', quantitativeStatus: 'Good', chemicalStatus: 'Good' } };
  enrichCroatiaGroundwaterEvidence(report, evidence);
  assert.match(report.soil.groundwaterRegime, /ZAGREB/);
  assert.match(report.soil.groundwaterNotice, /not measured/i);
  assert.equal(report.geosurvey_context.groundwater_body_code, 'HRCSGI-27');
});

void CROATIA_GROUNDWATER_LAYER;
