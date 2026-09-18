import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichDenmarkGroundEvidence, queryDenmarkGroundEvidence } from './denmarkGroundEvidenceService';

const ok = (body: any) => ({ ok: true, json: async () => body }) as any;

function point(lng: number, lat: number, properties: Record<string, unknown>) {
  return { type: 'Feature', properties, geometry: { type: 'Point', coordinates: [lng, lat] } };
}

test('Denmark acquisition keeps current Jupiter observations and adopted planning evidence separate', async () => {
  const fetcher: any = async (url: string) => {
    assert.doesNotMatch(url, /jordartskort_25000/, 'surface geology is not claimed as an automated WFS capability');
    if (url.includes('jupiter_boringer_seneste_pejling')) {
      return ok({ features: [point(12.551, 55.651, { dgunr: '201.1', vandstandterraen_num: '2.4', pejletidspunkt: '2026-05-20' })] });
    }
    if (url.includes('jupiter_boringer_ws')) {
      return ok({ features: [
        point(12.5505, 55.6505, { dgunr: '201.1', dybde: '22 m.', dybde_num: 22, formanv_tekst: 'Vandforsyning', kode_tekst: 'Aktiv' }),
        point(12.556, 55.655, { dgunr: '201.2', dybde: '31 m.', dybde_num: 31 })
      ] });
    }
    if (url.includes('geoserver.plandata.dk')) {
      return ok({ features: [{ type: 'Feature', properties: { planid: '42', plannr: 'LP-42', plannavn: 'Boligområde ved Testvej', komnavn: 'København', datoikraft: '2024-06-01' }, geometry: { type: 'Polygon', coordinates: [] } }] });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const evidence = await queryDenmarkGroundEvidence(55.65, 12.55, fetcher);
  assert.equal(evidence.length, 3);
  assert.ok(evidence.every(item => item.status === 'VERIFIED'));
  assert.ok(!evidence.some(item => item.id.includes('surface-geology')));

  const boreholes: any = evidence.find(item => item.id === 'dk-jupiter-boreholes');
  assert.equal(boreholes.value.count, 2);
  assert.ok(boreholes.value.nearestDistanceM >= 0);
  assert.equal(boreholes.value.records[0].depthM, 22);
  assert.equal(boreholes.value.records[0].purpose, 'Vandforsyning');
  assert.equal(boreholes.value.records[0].category, 'Aktiv');

  const groundwater: any = evidence.find(item => item.id === 'dk-jupiter-groundwater');
  assert.equal(groundwater.value.count, 1);
  assert.equal(groundwater.value.records[0].depthBelowTerrainM, 2.4);
  assert.equal(groundwater.value.records[0].levelDate, '2026-05-20');

  const planning: any = evidence.find(item => item.id === 'dk-plandata-localplan');
  assert.equal(planning.value.plans[0].name, 'Boligområde ved Testvej');

  const report: any = { planning: {}, soil: { estimatedBearingCapacityKpa: 'Not available', estimatedWaterTableDepthM: 'Not available' } };
  enrichDenmarkGroundEvidence(report, evidence);
  assert.equal(report.planning.status, 'VERIFIED');
  assert.equal(report.planning.planDesignation, 'Boligområde ved Testvej');
  assert.equal(report.soil.estimatedBearingCapacityKpa, 'Not available');
  assert.equal(report.soil.estimatedWaterTableDepthM, 'Not available');
});

test('Denmark source failures fail closed and do not create parcel design values', async () => {
  const fetcher: any = async () => ({ ok: false, json: async () => ({}) });
  const evidence = await queryDenmarkGroundEvidence(55.65, 12.55, fetcher);
  assert.equal(evidence.length, 3);
  assert.ok(evidence.every(item => item.status === 'REQUIRES_VERIFICATION'));
  assert.ok(evidence.every(item => (item.value as any)?.reasonCode === 'SOURCE_UNAVAILABLE'));

  const report: any = { planning: {}, soil: { estimatedBearingCapacityKpa: null, estimatedWaterTableDepthM: null } };
  enrichDenmarkGroundEvidence(report, evidence);
  assert.notEqual(report.planning.status, 'VERIFIED');
  assert.equal(report.soil.estimatedBearingCapacityKpa, null);
  assert.equal(report.soil.estimatedWaterTableDepthM, null);
});

[executed on device: toma (e8359509-e325-4515-b2ff-2da47ff811ad)]