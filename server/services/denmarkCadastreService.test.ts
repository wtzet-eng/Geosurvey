import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDenmarkCadastreToReport, queryDenmarkCadastre } from './denmarkCadastreService';

const ok = (body: any) => ({ ok: true, json: async () => body }) as any;

test('DAWA parcel query preserves registered area and official registry geometry with legal-boundary caveat', async () => {
  const fetcher: any = async (url: string) => {
    assert.match(url, /api\.dataforsyningen\.dk\/jordstykker/);
    assert.match(url, /srid=4326/);
    return ok({ features: [{
      type: 'Feature',
      properties: {
        matrikelnr: '12a', ejerlav: { kode: 2000176, navn: 'Test By' }, bfenummer: 123456,
        kommune: { kode: '0101', navn: 'København' }, registreretareal: 845, arealberegningsmetode: 'o',
        featureid: 'parcel-1', 'ændret': '2026-01-02', 'geo_ændret': '2026-02-03'
      },
      geometry: { type: 'Polygon', coordinates: [[[12.55,55.65],[12.551,55.65],[12.551,55.651],[12.55,55.65]]] }
    }] });
  };

  const result = await queryDenmarkCadastre(55.65, 12.55, fetcher);
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, 'Test By 12a');
  assert.equal(result.parcel?.registeredAreaM2, 845);
  assert.equal(result.parcel?.municipalityName, 'København');
  assert.equal(result.parcel?.registryGeometryPoints?.length, 4);

  const report: any = { evidenceRegistry: [], parcel: {}, evidenceScore: { breakdown: { cadastreAndGeometry: { score: 0 } } } };
  applyDenmarkCadastreToReport(report, result, 900);
  assert.equal(report.parcel.isOfficialGeometry, true);
  assert.equal(report.parcel.officialAreaM2, 845);
  assert.match(report.parcel.limitation, /ikke i sig selv.*juridisk grænse/i);
});

test('DAWA failures fail closed', async () => {
  const fetcher: any = async () => ({ ok: false, json: async () => ({}) });
  const result = await queryDenmarkCadastre(55.65, 12.55, fetcher);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, 'SOURCE_UNAVAILABLE');
  assert.equal(result.evidence[0].status, 'REQUIRES_VERIFICATION');
});
