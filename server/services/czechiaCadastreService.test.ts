import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCzechiaCadastreToReport, queryCzechiaCadastre } from './czechiaCadastreService';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const domain = (...codedValues: Array<[number, string]>) => ({ codedValues: codedValues.map(([code, name]) => ({ code, name })) });

function fixtureFetch(): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/5?f=json')) return jsonResponse({ fields: [
      { name: 'druhcislovanikod', domain: domain([2, 'Pozemková']) },
      { name: 'druhpozemkukod', domain: domain([13, 'zastavěná plocha a nádvoří']) },
      { name: 'zpusobyvyuzitipozemku', domain: domain([14, 'jiná plocha']) }
    ] });
    if (url.includes('/3?f=json')) return jsonResponse({ fields: [
      { name: 'typstavebnihoobjektukod', domain: domain([1, 'budova s číslem popisným']) },
      { name: 'zpusobvyuzitikod', domain: domain([3, 'objekt k bydlení']) },
      { name: 'druhkonstrukcekod', domain: domain([1, 'Cihly, tvárnice, cihlové bloky']) },
      { name: 'pripojenikanalizacekod', domain: domain([1, 'Přípoj na kanalizační síť']) },
      { name: 'pripojeniplynkod', domain: domain([3, 'Bez plynu']) },
      { name: 'pripojenivodovodkod', domain: domain([1, 'S vodovodem']) },
      { name: 'zpusobvytapenikod', domain: domain([1, 'Centrální domovní']) }
    ] });
    if (url.includes('/5/query')) return jsonResponse({ features: [{
      attributes: { id: 123456789, cisloparcely: '123/4', vymeraparcely: 987, druhcislovanikod: 2, druhpozemkukod: 13, zpusobyvyuzitipozemku: 14, katastralniuzemi: 730955 },
      geometry: { rings: [[[14.4200, 50.0800], [14.4210, 50.0800], [14.4210, 50.0810], [14.4200, 50.0810], [14.4200, 50.0800]]] }
    }] });
    if (url.includes('/7/query')) return jsonResponse({ features: [{ attributes: { nazev: 'Staré Město' } }] });
    if (url.includes('/12/query')) return jsonResponse({ features: [{ attributes: { nazev: 'Praha' } }] });
    if (url.includes('/15/query')) return jsonResponse({ features: [{ attributes: { nazev: 'Hlavní město Praha' } }] });
    if (url.includes('/17/query')) return jsonResponse({ features: [{ attributes: { nazev: 'Hlavní město Praha' } }] });
    if (url.includes('/3/query')) return jsonResponse({ features: [{ attributes: {
      kod: 987654321, cisladomovni: '12', typstavebnihoobjektukod: 1, zpusobvyuzitikod: 3,
      dokonceni: Date.UTC(2005, 5, 1), druhkonstrukcekod: 1, obestavenyprostor: 1400,
      pocetbytu: 3, pocetpodlazi: 4, podlahovaplocha: 460, zastavenaplocha: 155,
      pripojenikanalizacekod: 1, pripojeniplynkod: 3, pripojenivodovodkod: 1, zpusobvytapenikod: 1
    } }] });
    return jsonResponse({ error: { message: `Unexpected URL ${url}` } }, 404);
  }) as typeof fetch;
}

test('Czechia RÚIAN returns official parcel geometry, administrative identity and decoded building attributes separately', async () => {
  const result = await queryCzechiaCadastre(50.0805, 14.4205, fixtureFetch());
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelNumber, '123/4');
  assert.equal(result.parcel?.areaM2, 987);
  assert.equal(result.parcel?.landType, 'zastavěná plocha a nádvoří');
  assert.equal(result.parcel?.cadastralAreaName, 'Staré Město');
  assert.equal(result.parcel?.municipality, 'Praha');
  assert.equal(result.parcel?.geometryPoints?.length, 5);
  assert.equal(result.buildings.length, 1);
  assert.equal(result.buildings[0].buildingType, 'budova s číslem popisným');
  assert.equal(result.buildings[0].use, 'objekt k bydlení');
  assert.equal(result.buildings[0].floorAreaM2, 460);
  assert.equal(result.buildings[0].waterConnection, 'S vodovodem');
  assert.equal(result.evidence.find(item => item.id === 'cz-cuzk-ruian-parcel')?.status, 'VERIFIED');
  assert.equal(result.evidence.find(item => item.id === 'cz-cuzk-ruian-buildings')?.status, 'VERIFIED');
  assert.match(result.limitation, /does not establish ownership/i);
  assert.match(result.limitation, /not a structural survey/i);
});

test('Czechia cadastral enrichment replaces generic parcel placeholders without turning building attributes into valuation evidence', async () => {
  const result = await queryCzechiaCadastre(50.0805, 14.4205, fixtureFetch());
  const report: any = {
    parcel: { status: 'REQUIRES_VERIFICATION', countryCode: 'CZ', isOfficialGeometry: false, areaCalculatedM2: 1000, cadastralSource: 'generic' },
    evidenceRegistry: [{ id: 'cadastre-spatial-index', category: 'Cadastre & Identification', status: 'REQUIRES_VERIFICATION' }],
    valuation: { status: 'REQUIRES_VERIFICATION', indicativePricePerSqm: Number.NaN }
  };
  applyCzechiaCadastreToReport(report, result, 1000);
  assert.equal(report.parcel.status, 'VERIFIED');
  assert.equal(report.parcel.parcelId, '123/4');
  assert.equal(report.parcel.officialAreaM2, 987);
  assert.equal(report.parcel.isOfficialGeometry, true);
  assert.equal(report.parcel.commune, 'Praha');
  assert.ok(!report.evidenceRegistry.some((item: any) => item.id === 'cadastre-spatial-index'));
  assert.ok(report.evidenceRegistry.some((item: any) => item.id === 'cz-cuzk-ruian-parcel'));
  assert.equal(report.czechia_cadastre.buildings[0].floorAreaM2, 460);
  assert.equal(Number.isNaN(report.valuation.indicativePricePerSqm), true);
});

test('Czechia parcel-source failure remains explicit rather than inventing a parcel', async () => {
  const failingFetch = (async () => new Response('unavailable', { status: 503 })) as typeof fetch;
  const result = await queryCzechiaCadastre(50.0805, 14.4205, failingFetch);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, 'SOURCE_UNAVAILABLE');
  assert.equal(result.parcel, undefined);
  assert.equal(result.evidence[0].status, 'REQUIRES_VERIFICATION');
});

test('zero returned building polygons are not treated as proof that a Czech parcel is undeveloped', async () => {
  const base = fixtureFetch();
  const noBuildingFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/3/query')) return jsonResponse({ features: [] });
    return base(input as any, init as any);
  }) as typeof fetch;
  const result = await queryCzechiaCadastre(50.0805, 14.4205, noBuildingFetch);
  assert.equal(result.success, true);
  assert.equal(result.buildings.length, 0);
  const evidence = result.evidence.find(item => item.id === 'cz-cuzk-ruian-buildings-no-data');
  assert.equal(evidence?.status, 'REQUIRES_VERIFICATION');
  assert.equal((evidence?.value as any).reasonCode, 'NO_DATA');
});
