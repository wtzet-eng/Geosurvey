import test from 'node:test';
import assert from 'node:assert/strict';
import { applyNorwayCadastreToReport, queryNorwayCadastre } from './norwayCadastreService';

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

test('Kartverket open property API identifies a Norwegian Matrikkelen unit without claiming a certified boundary', async () => {
  const fetcher: typeof fetch = async (input: any) => {
    const url = String(input);
    assert.match(url, /api\.kartverket\.no\/eiendom\/v1\/punkt\/omrader/);
    assert.match(url, /koordsys=4258/);
    return jsonResponse({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[10.74, 59.91], [10.75, 59.91], [10.75, 59.92], [10.74, 59.92], [10.74, 59.91]]] },
        properties: {
          lokalid: 12345,
          kommunenummer: '0301',
          gardsnummer: 209,
          bruksnummer: 44,
          festenummer: 0,
          seksjonsnummer: 0,
          matrikkelnummertekst: '0301-209/44',
          meterFraPunkt: 0,
          hovedområde: true,
          nøyaktighetsklasseteig: 'Grønn',
          objekttype: 'Teig',
          oppdateringsdato: '2026-09-09'
        }
      }]
    });
  };

  const result = await queryNorwayCadastre(59.915, 10.745, fetcher);
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, '0301-209/44');
  assert.equal(result.parcel?.distanceM, 0);
  assert.equal(result.parcel?.accuracyClass, 'Grønn');
  assert.equal(result.parcel?.registryGeometryPoints?.length, 5);
  assert.match(result.limitation, /incomplete or imprecise/i);
  assert.match(result.limitation, /does not provide boundary type/i);

  const report: any = {
    parcel: { status: 'REQUIRES_VERIFICATION', countryCode: 'NO', isOfficialGeometry: false, areaCalculatedM2: 900, cadastralSource: 'generic' },
    evidenceRegistry: [{ id: 'cadastre-spatial-index' }]
  };
  applyNorwayCadastreToReport(report, result, 900);
  assert.equal(report.parcel.status, 'VERIFIED');
  assert.equal(report.parcel.parcelId, '0301-209/44');
  assert.equal(report.parcel.isOfficialGeometry, false);
  assert.equal(report.parcel.officialAreaM2, undefined);
  assert.equal(report.parcel.geometryPoints, undefined);
  assert.ok(report.evidenceRegistry.some((item: any) => item.id === 'no-kartverket-property'));
});

test('Kartverket empty result fails closed', async () => {
  const fetcher: typeof fetch = async () => jsonResponse({ type: 'FeatureCollection', features: [] });
  const result = await queryNorwayCadastre(60, 10, fetcher);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, 'NO_DATA');
  assert.equal(result.evidence[0].status, 'REQUIRES_VERIFICATION');
});
