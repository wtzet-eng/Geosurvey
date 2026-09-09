import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichSlovakiaGroundEvidence, mapSlovakLandslideClass, querySlovakiaGroundEvidence } from './slovakiaGroundEvidenceService';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function slovakFixtureFetch(): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/WebServices/IGR50/MapServer?f=json')) return jsonResponse({ layers: [{ id: 7, name: 'Inžinierskogeologické rajóny', subLayerIds: null }] });
    if (url.includes('/GeologickeMapy/GM50/MapServer/49/query')) return jsonResponse({ features: [{ attributes: { idt: 'Qh_f' } }] });
    if (url.includes('/wgs_geologickeMapy/geologickaMapaSR_200_wgs/MapServer/1/query')) return jsonResponse({ features: [{ attributes: { idvmp: 12, jednotky_s: 'Kvartér', skupiny_sk: 'fluviálne sedimenty', utvar_sk: 'holocén', odd_sk: '', nazov_sk: 'nivné hliny, piesky a štrky' } }] });
    if (url.includes('/WebServices/IGR50/MapServer/7/query')) return jsonResponse({ features: [{ attributes: { rajon: 'F', nazov: 'rajón fluviálnych sedimentov' } }] });
    if (url.includes('/WebServices/HG50/MapServer/3/query')) return jsonResponse({ features: [{ attributes: { nazov: 'štrky a piesky', vek: 'kvartér', typ_priepustnosti: 'medzizrnová', hg_funkcia: 'kolektor', t_kat: 'T3', t_var_id: 'stredná' } }] });
    if (url.includes('/WebServices/HG50/MapServer/4/query')) return jsonResponse({ features: [] });
    if (url.includes('/SvahoveDeformacie_MIL1/MapServer/6/query')) return jsonResponse({ features: [{ attributes: { podrajon: 'II.A', stupen: 'potenciálne nestabilné', charakteri: 'územie náchylné na svahové deformácie' } }] });
    if (url.includes('/WebServices/VRTY/MapServer/1/query')) return jsonResponse({ features: [{ geometry: { x: 18.0857, y: 48.3078 }, attributes: { oznacenievrtuvsprave: 'IG-1', archivnecislo: 'A-100', ucelvrtuskupina: 'inžiniersko-geologický', hlbkadiela: 18 } }] });
    if (url.includes('/WebServices/VRTY/MapServer/0/query')) return jsonResponse({ features: [{ geometry: { x: 18.09, y: 48.31 }, attributes: { oznacenievrtuvsprave: 'HG-2', archivnecislo: 'H-200', ucelvrtuskupina: 'hydrogeologický', hlbkadiela: 35 } }] });
    return jsonResponse({ error: { message: 'unexpected test URL' } }, 404);
  }) as typeof fetch;
}

test('Slovak landslide classes preserve the official stable / potentially unstable / unstable hierarchy', () => {
  assert.equal(mapSlovakLandslideClass('I.'), 'Low');
  assert.equal(mapSlovakLandslideClass('II.A'), 'Moderate');
  assert.equal(mapSlovakLandslideClass('II.B'), 'Moderate');
  assert.equal(mapSlovakLandslideClass('III.C'), 'High');
  assert.equal(mapSlovakLandslideClass(''), 'Not available');
});

test('Slovakia ground acquisition keeps mapped geology, engineering zoning, hydrogeology, landslide and boreholes separate', async () => {
  const items = await querySlovakiaGroundEvidence(48.3076, 18.0845, slovakFixtureFetch());
  const geology50 = items.find(item => item.id === 'sk-sguds-geology-50k');
  const geology = items.find(item => item.id === 'sk-sguds-geology-descriptive-200k');
  const engineering = items.find(item => item.id === 'sk-sguds-engineering-geology-50k');
  const hydro = items.find(item => item.id === 'sk-sguds-hydrogeology');
  const landslide = items.find(item => item.id === 'sk-sguds-landslide-susceptibility');
  const boreholes = items.find(item => item.id === 'sk-sguds-borehole-context');

  assert.equal(geology50?.status, 'VERIFIED');
  assert.equal((geology50?.value as any).unitCode, 'Qh_f');
  assert.equal(geology?.status, 'VERIFIED');
  assert.equal((geology?.value as any).unit, 'Kvartér');
  assert.match((geology?.value as any).description, /piesky a štrky/i);
  assert.equal(engineering?.status, 'VERIFIED');
  assert.equal((engineering?.value as any).zone, 'F');
  assert.equal(hydro?.status, 'VERIFIED');
  assert.equal((hydro?.value as any).permeability, 'medzizrnová');
  assert.equal(landslide?.status, 'VERIFIED');
  assert.equal((landslide?.value as any).level, 'Moderate');
  assert.equal(boreholes?.status, 'VERIFIED');
  assert.equal((boreholes?.value as any).engineeringBoreholes.length, 1);
  assert.equal((boreholes?.value as any).hydrogeologicalBoreholes.length, 1);
  assert.match(boreholes?.limitation || '', /not parcel stratigraphy/i);
});

test('Slovak enrichment promotes official mapped facts but never creates design geotechnical parameters', async () => {
  const items = await querySlovakiaGroundEvidence(48.3076, 18.0845, slovakFixtureFetch());
  const report: any = {
    geosurvey_context: { geological_unit_name: null, lithology_type: null, geological_period_era: null, groundwater_regime: null },
    terrain: { geohazards: { landslideSusceptibility: { status: 'MODELLED', level: 'Low', sourceName: 'Terrain model' } } },
    soil: { estimatedBearingCapacityKpa: undefined, effectiveFrictionAngleDeg: undefined, cohesionKpa: undefined }
  };
  enrichSlovakiaGroundEvidence(report, items);

  assert.equal(report.geosurvey_context.geological_unit_name, 'Kvartér');
  assert.match(report.geosurvey_context.lithology_type, /piesky a štrky/i);
  assert.match(report.geosurvey_context.groundwater_regime, /medzizrnová/i);
  assert.equal(report.terrain.geohazards.landslideSusceptibility.status, 'VERIFIED');
  assert.equal(report.terrain.geohazards.landslideSusceptibility.level, 'Moderate');
  assert.match(report.terrain.geohazards.landslideSusceptibility.sourceName, /ŠGÚDŠ/);
  assert.equal(report.soil.estimatedBearingCapacityKpa, undefined);
  assert.equal(report.soil.effectiveFrictionAngleDeg, undefined);
  assert.equal(report.soil.cohesionKpa, undefined);
  assert.equal((report.ground_context.slovakia_engineering_geology as any).zone, 'F');
});

test('Slovak source failures remain explicit rather than manufacturing geology or hazards', async () => {
  const failingFetch = (async () => new Response('unavailable', { status: 503 })) as typeof fetch;
  const items = await querySlovakiaGroundEvidence(48.3076, 18.0845, failingFetch);
  assert.ok(items.length >= 6);
  assert.ok(items.every(item => item.status === 'REQUIRES_VERIFICATION'));
  assert.ok(!items.some(item => item.id === 'sk-sguds-geology-50k' && item.status === 'VERIFIED'));
  assert.ok(!items.some(item => item.id === 'sk-sguds-landslide-susceptibility' && item.status === 'VERIFIED'));
});
