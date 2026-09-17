import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLuxembourgCadastreToReport, queryLuxembourgCadastre } from './luxembourgCadastreService';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const polygon = [[[6.1318,49.6115],[6.1320,49.6115],[6.1320,49.6117],[6.1318,49.6117],[6.1318,49.6115]]];

test('Luxembourg ACT cadastre returns the containing parcel without treating it as a surveyed title boundary', async () => {
  const fetcher: any = async () => response({ features: [{ type:'Feature', geometry:{ type:'Polygon', coordinates: polygon }, properties:{ nummer:'075F00307001832', k_katastergemeinde:75, k_sektion:'F', k_hauptnummer:307, k_zweitnummer:1832, k_code_nature:5025 } }] });
  const result = await queryLuxembourgCadastre(49.6116, 6.1319, fetcher);
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, '075F00307001832');
  assert.equal(result.parcel?.section, 'F');
  assert.ok((result.parcel?.mappedAreaM2 || 0) > 100);
  assert.equal(result.evidence[0].status, 'VERIFIED');
  assert.match(result.evidence[0].limitation, /does not establish ownership/i);

  const report: any = { parcel:{ countryCode:'LU', areaCalculatedM2:1000 }, evidenceRegistry:[{ id:'cadastre-spatial-index' }] };
  applyLuxembourgCadastreToReport(report, result, 1000);
  assert.equal(report.parcel.parcelId, '075F00307001832');
  assert.equal(report.parcel.status, 'VERIFIED');
  assert.equal(report.parcel.isOfficialGeometry, false);
  assert.equal(report.parcel.areaCalculatedM2, 1000);
});

test('Luxembourg ACT source failures fail closed', async () => {
  const failed: any = async () => response({}, 503);
  const result = await queryLuxembourgCadastre(49.6116, 6.1319, failed);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, 'SOURCE_UNAVAILABLE');
  assert.equal(result.evidence[0].status, 'REQUIRES_VERIFICATION');
});
