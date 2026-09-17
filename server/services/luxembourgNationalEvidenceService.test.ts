import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichLuxembourgNationalEvidence, queryLuxembourgNationalEvidence } from './luxembourgNationalEvidenceService';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const polygon = (properties: any) => ({ type:'Feature', geometry:{ type:'Polygon', coordinates:[[[6.1318,49.6115],[6.1320,49.6115],[6.1320,49.6117],[6.1318,49.6117],[6.1318,49.6115]]] }, properties });

const fetcher: any = async (input: string | URL | Request) => {
  const url = decodeURIComponent(String(input));
  if (url.includes('/2167/6/items')) return response({ features:[polygon({ NOMUNIT_FR:'Grès de Luxembourg', NOMUNIT_DE:'Luxemburger Sandstein', DESCUNIT_FR:'Grès jaunâtre et grès calcareux', ABREVSTRAT:'li2', CODESTRATUNIT:'L12', PERIOD_FR:'Jurassique', AGE_FR:'Hettangien à Sinémurien' })] });
  if (url.includes('/631/items')) return response({ features:[polygon({ CODE_DC:'UL' })] });
  if (url.includes('/2269/items')) return response({ features:[polygon({ NAME:'Lias inferieur (Gres de Luxembourg)', MS_CD_GB:'MES3' })] });
  if (url.includes('/2265/items')) return response({ features:[{ type:'Feature', geometry:{type:'Point',coordinates:[6.1325,49.612]}, properties:{ Station:'FCC-1-57', Name:'Forage Pétrusse' } }] });
  if (url.includes('/2176/items')) return response({ features:[{ type:'Feature', geometry:{type:'Point',coordinates:[6.14,49.62]}, properties:{ NRFORAGE:'FR-037-010', DESIGNAT:'Forage Cessange 1837', PROF_FORAGE:534.85, STRATIGR:'li2 / li1', LIEN:'https://example.test/log.zip' } }] });
  if (url.includes('/698/28/items')) return response({ features:[polygon({ code_com:'C026', categorie:'MIX_u', nom_fichier:'026_PE_MIX_u' })] });
  if (url.includes('/3262/7/items') || url.includes('/3263/11/items')) return response({ features:[] });
  throw new Error(`Unexpected URL ${url}`);
};

test('Luxembourg national evidence keeps geology, groundwater, boreholes, PAG and flood screening distinct', async () => {
  const items = await queryLuxembourgNationalEvidence(49.6116, 6.1319, fetcher);
  assert.equal((items.find(i => i.id === 'lu-geo-geology')?.value as any)?.unitFr, 'Grès de Luxembourg');
  assert.equal((items.find(i => i.id === 'lu-geo-groundwater-body')?.value as any)?.code, 'MES3');
  assert.equal((items.find(i => i.id === 'lu-geo-boreholes')?.value as any)?.records[0].station, 'FCC-1-57');
  assert.equal((items.find(i => i.id === 'lu-pag-zoning')?.value as any)?.categories[0], 'MIX_u');
  assert.equal((items.find(i => i.id === 'lu-flood-screen')?.value as any)?.intersectsHq100, false);
  assert.match(items.find(i => i.id === 'lu-flood-screen')?.limitation || '', /not a hydraulic study/i);

  const report: any = {
    geosurvey_context:{}, soil:{ geologicalUnit:'model', lithologyType:'model', stratigraphicPeriod:'', groundwaterRegime:'', estimatedBearingCapacityKpa:'Not available', estimatedWaterTableDepthM:'Not available' },
    planning:{ status:'MODELLED', hasLocalPlan:false, maxFar:'model', maxCoveragePct:'model', maxBuildingHeightM:'model', setbackRules:'model' },
    terrain:{ floodInundationRisk:{ status:'MODELLED', level:'Low', statutoryZoneStatus:'model', description:'model', sourceName:'model', limitation:'model' } }
  };
  enrichLuxembourgNationalEvidence(report, items);
  assert.equal(report.soil.geologicalUnit, 'Grès de Luxembourg');
  assert.match(report.soil.groundwaterRegime, /MES3/);
  assert.equal(report.planning.planDesignation, 'PAG zoning code MIX_u');
  assert.equal(report.planning.maxFar, 'Requires municipal verification');
  assert.equal(report.planning.setbackRules, 'Requires municipal verification');
  assert.equal(report.terrain.floodInundationRisk.status, 'VERIFIED');
  assert.equal(report.terrain.floodInundationRisk.level, 'Not available');
  assert.equal(report.soil.estimatedBearingCapacityKpa, 'Not available');
  assert.equal(report.soil.estimatedWaterTableDepthM, 'Not available');
});

test('Luxembourg national source failures fail closed', async () => {
  const failed: any = async () => response({}, 503);
  const items = await queryLuxembourgNationalEvidence(49.6116, 6.1319, failed);
  assert.ok(items.length >= 6);
  assert.ok(items.every(item => item.status === 'REQUIRES_VERIFICATION'));
});
