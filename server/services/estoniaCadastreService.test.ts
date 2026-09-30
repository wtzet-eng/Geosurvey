import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEstoniaCadastreToReport, queryEstoniaCadastre } from './estoniaCadastreService';

test('selects the Estonian cadastral unit containing the coordinate', async () => {
  const mockFetch = async () => new Response(JSON.stringify({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[24.9, 59.4], [24.9, 59.41], [24.91, 59.41], [24.91, 59.4], [24.9, 59.4]]] },
      properties: { tunnus: '12345:001:0001', pindala: 523, mk_nimi: 'Harju maakond', ov_nimi: 'Tallinn', ay_nimi: 'Kesklinna linnaosa', l_aadress: 'Testi tn 1', omvorm: 'Eraomand', siht1: 'ELAMUMAA', siht2: null, siht3: null, muudet: '2026-09-01Z', maks_hind: 100000, marked: '-' }
    }]
  })) as Response;

  const result = await queryEstoniaCadastre(59.405, 24.905, mockFetch as any);
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, '12345:001:0001');
  assert.equal(result.parcel?.areaM2, 523);
  assert.equal(result.parcel?.municipality, 'Tallinn');
  assert.equal(result.geometryPoints?.length, 5);
  assert.equal(result.evidence[0].status, 'VERIFIED');

  const report: any = { evidenceRegistry: [], parcel: { status: 'REQUIRES_VERIFICATION' } };
  applyEstoniaCadastreToReport(report, result, 500);
  assert.equal(report.parcel.status, 'VERIFIED');
  assert.equal(report.parcel.parcelId, '12345:001:0001');
  assert.equal(report.parcel.officialAreaM2, 523);
  assert.equal(report.parcel.isOfficialGeometry, true);
});
