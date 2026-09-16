import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichIrelandNationalEvidence, queryIrelandNationalEvidence } from './irelandNationalEvidenceService';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const fetcher: any = async (input: string | URL | Request) => {
  const url = String(input);
  if (url.includes('Bedrock_Geology_Datasets_100K')) return response({ features: [{ attributes: { UNIT_NAME: 'Lucan Formation', DESCRIPT: "Dark limestone & shale ('calp)", STRATCODE: 'LU', SHEETNO: 16 } }] });
  if (url.includes('Quaternary_Sediments_50K')) return response({ features: [{ attributes: { QSED_TYPE: 'Till derived from limestones', QSED_CODE: 'TLs' } }] });
  if (url.includes('Aquifer_Datasets') && url.includes('/2/query')) return response({ features: [{ attributes: { AQUIFERCAT: 'Ll', AQUIFERDES: 'Locally Important Aquifer - Bedrock which is Moderately Productive only in Local Zones' } }] });
  if (url.includes('Groundwater_Vulnerability')) return response({ features: [{ attributes: { VUL_CAT: 'H', VUL_DESC: 'High' } }] });
  if (url.includes('Bedrock_Boreholes_Verified')) return response({ features: [{ attributes: { HOLE_ID: 'CN-51-DOD', LENGTH_M: 39, COUNTY: 'Kildare', DATASOURCE: 'OF-429-2-10', LOG_URL: 'https://example.test/CN-51-DOD.pdf' }, geometry: { x: -6.5639, y: 53.3069 } }] });
  if (url.includes('Landslide_Susceptibility')) return response({ features: [{ attributes: { LSSUSCLASS: 'D', LSSUSDESC: 'Low' } }] });
  if (url.includes('gis.epa.ie') && url.includes('RadonRiskMapofIreland')) return response({ features: [{ properties: { Risk: 'About 1 in 20 homes in this area is likely to have high radon levels' } }] });
  if (url.includes('NPWSDesignatedAreas')) return response({ features: [] });
  if (url.includes('GZT_Current_Plan')) return response({ features: [] });
  if (url.includes('IrishPlanningApplications')) return response({ features: [{ attributes: { PlanningAuthority: 'Kildare County Council', ApplicationNumber: '2460280', DevelopmentDescription: 'Domestic dwelling house', DevelopmentAddress: 'Celbridge', ApplicationStatus: 'APPLICATION FINALISED', Decision: 'CONDITIONAL', LinkAppDetails: 'https://example.test/app' }, geometry: { x: -6.54355, y: 53.33352 } }] });
  throw new Error(`Unexpected URL ${url}`);
};

test('Ireland national evidence keeps authoritative layers distinct and planning contextual', async () => {
  const items = await queryIrelandNationalEvidence(53.332475, -6.545065, fetcher);
  assert.equal(items.length, 10);
  assert.equal(items.find(i => i.id === 'ie-gsi-bedrock')?.status, 'VERIFIED');
  assert.equal((items.find(i => i.id === 'ie-gsi-bedrock')?.value as any)?.unit, 'Lucan Formation');
  assert.equal((items.find(i => i.id === 'ie-gsi-quaternary')?.value as any)?.material, 'Till derived from limestones');
  assert.equal((items.find(i => i.id === 'ie-gsi-aquifer')?.value as any)?.category, 'Ll');
  assert.equal((items.find(i => i.id === 'ie-gsi-groundwater-vulnerability')?.value as any)?.description, 'High');
  assert.equal((items.find(i => i.id === 'ie-gsi-boreholes')?.value as any)?.records[0].id, 'CN-51-DOD');
  assert.equal((items.find(i => i.id === 'ie-gsi-landslide')?.value as any)?.level, 'Low');
  assert.match(String((items.find(i => i.id === 'ie-epa-radon')?.value as any)?.risk), /1 in 20/);
  assert.equal((items.find(i => i.id === 'ie-npws-designations')?.value as any)?.intersects, false);
  assert.equal(items.find(i => i.id === 'ie-myplan-gzt-no-data')?.status, 'REQUIRES_VERIFICATION');
  assert.equal((items.find(i => i.id === 'ie-npad-nearby-applications')?.value as any)?.records[0].applicationNumber, '2460280');

  const report: any = {
    geosurvey_context: {}, soil: { geologicalUnit: '', lithologyType: '', groundwaterRegime: '', estimatedBearingCapacityKpa: 'Not available', estimatedWaterTableDepthM: 'Not available' },
    terrain: { geohazards: { landslideSusceptibility: { status: 'MODELLED', level: 'Negligible', description: '', sourceName: 'terrain' }, radonPotential: { status: 'REQUIRES_VERIFICATION', classification: '', sourceName: '' } } },
    environment: { status: 'MODELLED', sourceName: 'Cross-border context', limitation: '' }
  };
  enrichIrelandNationalEvidence(report, items);
  assert.equal(report.geosurvey_context.geological_unit_name, 'Lucan Formation');
  assert.match(report.soil.groundwaterRegime, /Locally Important Aquifer/);
  assert.equal(report.terrain.geohazards.landslideSusceptibility.level, 'Low');
  assert.match(report.terrain.geohazards.radonPotential.classification, /1 in 20/);
  assert.equal(report.environment.natura2000Intersect, false);
  assert.equal(report.soil.estimatedBearingCapacityKpa, 'Not available');
  assert.equal(report.soil.estimatedWaterTableDepthM, 'Not available');
});

test('Ireland source failures fail closed', async () => {
  const failed: any = async () => response({}, 503);
  const items = await queryIrelandNationalEvidence(53.332475, -6.545065, failed);
  assert.equal(items.length, 10);
  assert.ok(items.every(item => item.status === 'REQUIRES_VERIFICATION'));
  assert.ok(items.every(item => (item.value as any)?.reasonCode === 'SOURCE_UNAVAILABLE'));
});
