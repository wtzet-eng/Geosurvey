import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEstoniaNationalEvidenceToReport, queryEstoniaNationalEvidence } from './estoniaNationalEvidenceService';

function jsonResponse(body: any): Response { return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }); }
const polygon = (props: any) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[24.9, 59.4], [24.9, 59.41], [24.91, 59.41], [24.91, 59.4], [24.9, 59.4]]] }, properties: props });

test('maps Estonian superficial geology and hydrogeology and preserves borehole context', async () => {
  const mockFetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('q_avamus_a_50t')) return jsonResponse({ features: [polygon({ litoloogia: 'Peenliiv', stratigr: 'LtQ2', kood: 202 })] });
    if (url.includes('ap_avamus_a_50t')) return jsonResponse({ features: [polygon({ indeks: 'O3vv', kood: 105 })] });
    if (url.includes('hg_veekompleks_a_50t')) return jsonResponse({ features: [polygon({ liik: 'Liivakivi 1', veekiht: 'C–Cm' })] });
    if (url.includes('hg_pvk_kaitstus_a_50t')) return jsonResponse({ features: [polygon({ liik: 'Kaitstud ala', iseloom: 'Põhjaveekiht' })] });
    if (url.includes('typeNames=faktika%3Apuurauk')) return jsonResponse({ features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [24.906, 59.405] }, properties: { gea_id: 7, nimi: 'B-7', pikkus: 22.5, vertikaalne_ulatus: 20 } }] });
    throw new Error(`Unexpected URL ${url}`);
  };

  const result = await queryEstoniaNationalEvidence(59.405, 24.905, mockFetch as any);
  const ids = result.evidence.map(item => item.id);
  assert.equal(ids.includes('ee-egt-superficial-geology'), true);
  assert.equal(ids.includes('ee-egt-bedrock-exposure'), true);
  assert.equal(ids.includes('ee-egt-hydrogeology'), true);
  assert.equal(ids.includes('ee-egt-groundwater-vulnerability'), true);
  assert.equal(ids.includes('ee-egt-borehole-context'), true);
  assert.equal(result.evidence.find(item => item.id === 'ee-egt-superficial-geology')?.status, 'VERIFIED');
  const report: any = { geosurvey_context: { lithology_type: 'Sandy Loam', evidence_level: 'MODELLED' } };
  applyEstoniaNationalEvidenceToReport(report, result.evidence);
  assert.equal(report.geosurvey_context.survey_authority, 'Estonian Geological Survey (EGT)');
  assert.equal(report.geosurvey_context.lithology_type, 'Peenliiv');
  assert.equal(report.geosurvey_context.geological_unit_name, 'Peenliiv (LtQ2)');
  assert.equal(report.geosurvey_context.evidence_level, 'VERIFIED');
});

test('missing Estonian mapped data does not become a negative finding', async () => {
  const mockFetch = async () => jsonResponse({ features: [] });
  const result = await queryEstoniaNationalEvidence(59.405, 24.905, mockFetch as any);
  const open = result.evidence.filter(item => item.status === 'REQUIRES_VERIFICATION');
  assert.ok(open.length >= 4);
  assert.ok(open.every(item => /not evidence|not proof|not returned|review/i.test(item.limitation + ' ' + item.claim)));
});
