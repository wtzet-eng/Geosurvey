import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDenmarkCadastreToReport, queryDenmarkCadastre } from './denmarkCadastreService';

const ok = (body: any) => ({ ok: true, json: async () => body }) as any;

test('Datafordeler parcel query preserves registered area and official registry geometry with legal-boundary caveat', async () => {
  const fetcher: any = async (url: string) => {
    assert.match(url, /wfs\.datafordeler\.dk\/MAT\/MAT_WFS/);
    assert.match(url, /apiKey=test-key/);
    if (url.includes('typeName=jordstykke_current')) {
      assert.match(url, /bbox=/);
      return ok({ features: [{
        type: 'Feature',
        properties: {
          matrikelnummer: '12a', ejerlavLokalId: '2000176', kommuneLokalId: '0101', registreretAreal: 845,
          arealberegningsmetode: 'Areal beregnet efter opmåling - o', id_lokalId: 'parcel-1', faelleslod: false,
          datafordelerOpdateringstid: '2026-09-12T08:00:00Z'
        },
        geometry: { type: 'Polygon', coordinates: [[[12.549,55.649],[12.552,55.649],[12.552,55.652],[12.549,55.652],[12.549,55.649]]] }
      }] });
    }
    if (url.includes('typeName=ejerlav_current')) {
      return ok({ features: [{ type: 'Feature', properties: { id_lokalId: '2000176', ejerlavsnavn: 'Test By' }, geometry: null }] });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await queryDenmarkCadastre(55.65, 12.55, fetcher, 'test-key');
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, 'Test By 12a');
  assert.equal(result.parcel?.registeredAreaM2, 845);
  assert.equal(result.parcel?.municipalityCode, '0101');
  assert.equal(result.parcel?.registryGeometryPoints?.length, 5);
  assert.doesNotMatch(result.sourceUrl, /test-key/);

  const report: any = { evidenceRegistry: [], parcel: {}, evidenceScore: { breakdown: { cadastreAndGeometry: { score: 0 } } } };
  applyDenmarkCadastreToReport(report, result, 900);
  assert.equal(report.parcel.isOfficialGeometry, true);
  assert.equal(report.parcel.officialAreaM2, 845);
  assert.match(report.parcel.limitation, /ikke i sig selv.*grænseafsætning/i);
});

test('Datafordeler cadastre fails closed when API key is absent', async () => {
  let called = false;
  const fetcher: any = async () => { called = true; return ok({ features: [] }); };
  const result = await queryDenmarkCadastre(55.65, 12.55, fetcher, '');
  assert.equal(called, false);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, 'SOURCE_UNAVAILABLE');
  assert.equal(result.evidence[0].status, 'REQUIRES_VERIFICATION');
  assert.match(result.evidence[0].claim, /DATAFORDELER_API_KEY/);
});

test('Datafordeler source failures fail closed', async () => {
  const fetcher: any = async () => ({ ok: false, json: async () => ({}) });
  const result = await queryDenmarkCadastre(55.65, 12.55, fetcher, 'test-key');
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, 'SOURCE_UNAVAILABLE');
  assert.equal(result.evidence[0].status, 'REQUIRES_VERIFICATION');
});
