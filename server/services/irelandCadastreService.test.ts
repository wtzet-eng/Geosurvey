import test from 'node:test';
import assert from 'node:assert/strict';
import { applyIrelandCadastreToReport, queryIrelandCadastre } from './irelandCadastreService';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const freeholdFeature = {
  attributes: { SP_ID: 1015659, COUNTY_NAM: 'Kildare', Shape__Area: 3108.91 },
  geometry: { rings: [[[-6.546, 53.332], [-6.544, 53.332], [-6.544, 53.334], [-6.546, 53.334], [-6.546, 53.332]]] }
};

test('Ireland cadastre returns Tailte generalised parcel context without replacing user geometry', async () => {
  const fetcher: any = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('Cadastral_Parcels_Freehold')) return response({ features: [freeholdFeature] });
    if (url.includes('Cadastral_Parcels_Leasehold')) return response({ features: [] });
    throw new Error(`Unexpected URL ${url}`);
  };
  const result = await queryIrelandCadastre(53.332475, -6.545065, fetcher);
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, '1015659');
  assert.equal(result.parcel?.tenure, 'Freehold');
  assert.equal(result.parcel?.county, 'Kildare');
  assert.equal(Math.round(result.parcel?.mappedAreaM2 || 0), 3109);
  assert.match(result.evidence[0].limitation, /generalised/i);

  const report: any = { parcel: { areaCalculatedM2: 4200, isOfficialGeometry: false }, evidenceRegistry: [{ id: 'cadastre-spatial-index' }] };
  applyIrelandCadastreToReport(report, result, 4200);
  assert.equal(report.parcel.areaCalculatedM2, 4200);
  assert.equal(report.parcel.officialAreaM2, undefined);
  assert.equal(report.parcel.isOfficialGeometry, false);
  assert.equal(report.parcel.parcelId, '1015659');
  assert.equal(report.evidenceRegistry.some((item: any) => item.id === 'cadastre-spatial-index'), false);
});

test('Ireland cadastre fails closed when both Tailte services fail', async () => {
  const fetcher: any = async () => response({}, 503);
  const result = await queryIrelandCadastre(53.332475, -6.545065, fetcher);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, 'SOURCE_UNAVAILABLE');
  assert.equal(result.evidence[0].status, 'REQUIRES_VERIFICATION');
});
