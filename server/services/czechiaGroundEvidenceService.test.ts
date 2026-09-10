import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichCzechiaGroundEvidence, mapCzechLandslideSusceptibility, mapCzechRadonIndex, queryCzechiaGroundEvidence } from './czechiaGroundEvidenceService';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function czechFixtureFetch(): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/Geologie/geologicka_mapa50/MapServer/2/query')) return jsonResponse({ features: [{ attributes: {
      mapid: '12-34', geneze: 'fluviální', hor_typ: 'sediment', hor_karto: 'písek, štěrk',
      reg_jed: 'Český masiv', era: 'kenozoikum', utvar: 'kvartér', oddeleni: 'holocén', souvrstvi: 'údolní nivy'
    } }] });
    if (url.includes('/Geohazardy/IG_rajony50/MapServer/1/query')) return jsonResponse({ features: [{ attributes: {
      rajon_kod: 'F', rajon_celek: 'nezpevněné sedimenty', nazev: 'rajón fluviálních sedimentů',
      ig_charakter: 'proměnlivé zrnitostní složení', hornina: 'štěrky, písky a hlíny'
    } }] });
    if (url.includes('/Geohazardy/IG_rajony50/MapServer/0/query')) return jsonResponse({ features: [{ attributes: { symbol: 'Q', legenda: 'kvartérní sedimenty' } }] });
    if (url.includes('/HydroGeologie/HG50_mapa/MapServer/3/query')) return jsonResponse({ features: [{ attributes: {
      geologick_jednotka: 'kvartérní fluviální sedimenty', hornina: 'štěrky a písky',
      stratigraficke_zarazeni: 'kvartér', transmisivita_hornin: 'vysoká', popis: 'průlinový kolektor'
    } }] });
    if (url.includes('/HydroGeologie/HG_rajony/MapServer/1/query')) return jsonResponse({ features: [{ attributes: { rajon_id: '1171', nazev: 'Kvartér Labe' } }] });
    if (url.includes('/HydroGeologie/HG_rajony/MapServer/3/query')) return jsonResponse({ features: [] });
    if (url.includes('/HydroGeologie/HG_rajony/MapServer/5/query')) return jsonResponse({ features: [] });
    if (url.includes('/Prozkoumanost/Vrtna_prozkoumanost/MapServer/1/query')) return jsonResponse({ features: [
      { geometry: { x: 14.4220, y: 50.0870 }, attributes: { klic: 'V-100', puv_nazev: 'IG vrt', druh_obj: 'vrt', hloubka: 24, zamereni: 'inženýrská geologie', max_nvz: 1.5, max_q: 8, hornina: 'břidlice', strat: 'ordovik', rok_obj: 2019 } },
      { geometry: { x: 14.43, y: 50.09 }, attributes: { klic: 'H-200', puv_nazev: 'HG vrt', druh_obj: 'vrt', hloubka: 42, zamereni: 'hydrogeologie', max_q: 12, hornina: 'pískovec', strat: 'křída', rok_obj: 2018 } }
    ] });
    if (url.includes('/Prozkoumanost/Vrtna_prozkoumanost/MapServer/5/query')) return jsonResponse({ features: [
      { geometry: { x: 14.43, y: 50.09 }, attributes: { klic: 'H-200', puv_nazev: 'HG vrt', druh_obj: 'vrt', hloubka: 42, zamereni: 'hydrogeologie', max_q: 12, hornina: 'pískovec', strat: 'křída', rok_obj: 2018 } }
    ] });
    if (url.includes('/Geohazardy/sesuvna_nachylnost/MapServer/0/query')) return jsonResponse({ features: [{ attributes: { struktura: 'Třída střední náchylnosti k sesouvání' } }] });
    if (url.includes('/Geohazardy/svahove_deformace/MapServer/1/query')) return jsonResponse({ features: [{ attributes: { id_teren: 'SD-42', nazev: 'sesuv', aktivita: 2, skupina: 1, podskupina: 1, nazku_obec: 'Praha', nazku_katastr: 'Test' } }] });
    if (url.includes('/Geohazardy/radon_komplexni_informace/MapServer/0/query')) return jsonResponse({ features: [{ attributes: { naz_obec: 'Praha', naz_cast: 'Test', hornina50: 'břidlice', radon: 3, iprum: 18, avg_prum_k: 112 } }] });
    if (url.includes('/Dulni_Dila/poddolovana_uzemi/MapServer/1/query')) return jsonResponse({ features: [{ attributes: { id_sur_pod: 999, nazev: 'Test mining area', surovina: 'uhlí', stari: 'historické', projevy: 'možné', presnost: 'ověřeno', dokument: 'archiv', verohodno: 'ano', rok: 1992 } }] });
    return jsonResponse({ error: { message: `unexpected test URL: ${url}` } }, 404);
  }) as typeof fetch;
}

test('Czech landslide and radon classes preserve the official screening hierarchy', () => {
  assert.equal(mapCzechLandslideSusceptibility('Třída nízké náchylnosti'), 'Low');
  assert.equal(mapCzechLandslideSusceptibility('Třída střední náchylnosti'), 'Moderate');
  assert.equal(mapCzechLandslideSusceptibility('Třída vysoké náchylnosti'), 'High');
  assert.equal(mapCzechLandslideSusceptibility(''), 'Not available');
  assert.equal(mapCzechRadonIndex(1), 'Low');
  assert.equal(mapCzechRadonIndex(2), 'Moderate');
  assert.equal(mapCzechRadonIndex(3), 'High');
  assert.equal(mapCzechRadonIndex(4), 'Not available');
});

test('Czechia acquisition keeps geology, engineering geology, hydrogeology, boreholes, susceptibility, deformation, radon and mining separate', async () => {
  const items = await queryCzechiaGroundEvidence(50.0865, 14.4213, czechFixtureFetch());
  const geology = items.find(item => item.id === 'cz-cgs-geology-50k');
  const engineering = items.find(item => item.id === 'cz-cgs-engineering-geology');
  const hydro = items.find(item => item.id === 'cz-cgs-hydrogeology');
  const boreholes = items.find(item => item.id === 'cz-cgs-borehole-context');
  const susceptibility = items.find(item => item.id === 'cz-cgs-landslide-susceptibility');
  const deformation = items.find(item => item.id === 'cz-cgs-slope-deformation-site');
  const radon = items.find(item => item.id === 'cz-cgs-radon');
  const mining = items.find(item => item.id === 'cz-cgs-mining-undermined-site');

  assert.equal(geology?.status, 'VERIFIED');
  assert.equal((geology?.value as any).lithology, 'písek, štěrk');
  assert.equal((geology?.value as any).genesis, 'fluviální');
  assert.match((geology?.value as any).age, /kvartér/i);

  assert.equal(engineering?.status, 'VERIFIED');
  assert.equal((engineering?.value as any).tier, 1);
  assert.equal((engineering?.value as any).scale, '1:50,000');
  assert.equal((engineering?.value as any).code, 'F');
  assert.match((engineering?.value as any).characterization, /proměnlivé/i);

  assert.equal(hydro?.status, 'VERIFIED');
  assert.equal((hydro?.value as any).tier, 1);
  assert.equal((hydro?.value as any).transmissivity, 'vysoká');

  assert.equal(boreholes?.status, 'VERIFIED');
  assert.equal((boreholes?.value as any).boreholes.length, 2);
  assert.equal((boreholes?.value as any).hydrogeologicalBoreholes.length, 1);
  assert.ok((boreholes?.value as any).nearestDistanceM >= 0);
  assert.match(boreholes?.limitation || '', /do not establish the strata/i);

  assert.equal((susceptibility?.value as any).level, 'Moderate');
  assert.equal(deformation?.status, 'VERIFIED');
  assert.equal((deformation?.value as any).count, 1);
  assert.equal((radon?.value as any).classification, 'High');
  assert.equal(mining?.status, 'VERIFIED');
});

test('Czechia enrichment promotes authoritative mapped context but never creates design geotechnical parameters', async () => {
  const items = await queryCzechiaGroundEvidence(50.0865, 14.4213, czechFixtureFetch());
  const report: any = {
    geosurvey_context: { geological_unit_name: null, lithology_type: null, geological_period_era: null, groundwater_regime: null },
    terrain: { geohazards: {
      landslideSusceptibility: { status: 'MODELLED', level: 'Low', sourceName: 'Terrain model', description: '' },
      radonPotential: { status: 'REQUIRES_VERIFICATION', classification: 'Not available', sourceName: 'Generic' },
      miningSubsidence: { status: 'REQUIRES_VERIFICATION', classification: 'Not available', sourceName: 'Generic' }
    } },
    soil: {
      groundwaterRegime: 'Not available',
      estimatedWaterTableDepthM: 'Not available',
      estimatedBearingCapacityKpa: undefined,
      effectiveFrictionAngleDeg: undefined,
      cohesionKpa: undefined
    }
  };
  enrichCzechiaGroundEvidence(report, items);

  assert.equal(report.geosurvey_context.geological_unit_name, 'údolní nivy');
  assert.equal(report.geosurvey_context.lithology_type, 'písek, štěrk');
  assert.match(report.geosurvey_context.geological_period_era, /kvartér/i);
  assert.equal(report.geosurvey_context.genetic_origin, 'fluviální');
  assert.match(report.soil.groundwaterRegime, /vysoká/i);
  assert.equal(report.soil.estimatedWaterTableDepthM, 'Not available');
  assert.equal(report.soil.estimatedBearingCapacityKpa, undefined);
  assert.equal(report.soil.effectiveFrictionAngleDeg, undefined);
  assert.equal(report.soil.cohesionKpa, undefined);

  // A mapped field-verified slope deformation intersecting the site is a stronger warning than regional susceptibility.
  assert.equal(report.terrain.geohazards.landslideSusceptibility.level, 'High');
  assert.equal(report.terrain.geohazards.radonPotential.classification, 'High');
  assert.match(report.terrain.geohazards.miningSubsidence.classification, /undermined area/i);
});

test('Czechia source failures remain explicit and do not manufacture geology, hazards or engineering values', async () => {
  const failingFetch = (async () => new Response('unavailable', { status: 503 })) as typeof fetch;
  const items = await queryCzechiaGroundEvidence(50.0865, 14.4213, failingFetch);
  assert.equal(items.length, 8);
  assert.ok(items.every(item => item.status === 'REQUIRES_VERIFICATION'));
  assert.ok(!items.some(item => item.id === 'cz-cgs-geology-50k' && item.status === 'VERIFIED'));
  assert.ok(!items.some(item => item.id === 'cz-cgs-landslide-susceptibility' && item.status === 'VERIFIED'));
});
