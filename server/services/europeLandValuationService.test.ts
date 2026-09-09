import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDelimitedTable,
  queryEuropeanLandValuationEvidence,
  queryFinlandBenchmark,
  selectIrelandBenchmark,
  selectSpainBenchmark
} from './europeLandValuationService';

const response = (body: any, status = 200, contentType = 'application/json') => new Response(
  typeof body === 'string' ? body : JSON.stringify(body),
  { status, headers: { 'content-type': contentType } }
);

test('delimited parser handles semicolon CSV and quoted values', () => {
  const rows = parseDelimitedTable('Año;Provincia;Valor €/m²\n2025;"Madrid";321,5\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Provincia, 'Madrid');
  assert.equal(rows[0]['Valor €/m²'], '321,5');
});

test('Spain resolver prefers latest province land statistic over national row', () => {
  const rows = parseDelimitedTable([
    'Año;Trimestre;Tipo;Provincia;Comunidad_Autónoma;Valor €/m²',
    '2025;4;Total;;;171',
    '2025;4;Total;Madrid;Comunidad de Madrid;410',
    '2025;3;Total;Madrid;Comunidad de Madrid;390'
  ].join('\n'));
  const benchmark = selectSpainBenchmark(rows, 'Madrid', 'Comunidad de Madrid');
  assert.ok(benchmark);
  assert.equal(benchmark?.scope, 'PROVINCE');
  assert.equal(benchmark?.benchmarkPricePerSqm, 410);
  assert.equal(benchmark?.datasetDate, '2025-Q4');
  assert.equal(benchmark?.evidenceKind, 'OFFICIAL_TRANSACTION');
});

test('Ireland converts verified residentially zoned land county median from euro per acre to euro per square metre', () => {
  const rows = parseDelimitedTable('County,Median Price per Acre (€)\nKildare,470000\nTipperary,63000\n');
  const kildare = selectIrelandBenchmark(rows, 'County Kildare');
  assert.ok(kildare);
  assert.equal(kildare?.scope, 'COUNTY');
  assert.ok((kildare?.benchmarkPricePerSqm || 0) > 116 && (kildare?.benchmarkPricePerSqm || 0) < 117);
  assert.match(kildare?.sourceName || '', /Central Statistics Office/i);
});

test('Finland PxWeb query selects Greater Helsinki for metro municipalities and latest plot quarter', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const meta = {
    variables: [
      { code: 'Alue', text: 'Region', values: ['ksu', 'pks'], valueTexts: ['Whole country', 'Greater Helsinki'] },
      { code: 'Vuosineljannes', text: 'Quarter', values: ['2026Q1', '2026Q2'], valueTexts: ['2026Q1', '2026Q2'] },
      { code: 'Tiedot', text: 'Information', values: ['keskihinta', 'mediaani'], valueTexts: ['Price per square meter (EUR/m2)', 'Medianprice'] }
    ]
  };
  const fetcher: typeof fetch = async (input: any, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (!init?.method) return response(meta);
    const posted = JSON.parse(String(init.body));
    assert.equal(posted.query[0].selection.values[0], 'pks');
    assert.equal(posted.query[1].selection.values[0], '2026Q2');
    assert.equal(posted.query[2].selection.values[0], 'mediaani');
    return response({ value: [205] });
  };
  const benchmark = await queryFinlandBenchmark('Helsinki', fetcher);
  assert.ok(benchmark);
  assert.equal(benchmark?.scope, 'METRO');
  assert.equal(benchmark?.benchmarkPricePerSqm, 205);
  assert.equal(calls.length, 2);
});

test('Austria returns dated official buildable-plot national benchmark without pretending local precision', async () => {
  const evidence = await queryEuropeanLandValuationEvidence('AT', {});
  assert.ok(evidence);
  assert.equal(evidence?.status, 'MODELLED');
  assert.equal((evidence?.value as any).benchmarkPricePerSqm, 135);
  assert.equal((evidence?.value as any).scope, 'NATIONAL');
  assert.match(evidence?.limitation || '', /local prices vary extremely/i);
});

test('Spain source failure uses only the dated official 2025-Q4 fallback, never a generic Europe price', async () => {
  const fetcher: typeof fetch = async () => response('unavailable', 503, 'text/plain');
  const evidence = await queryEuropeanLandValuationEvidence('ES', { county: 'Madrid' }, fetcher);
  assert.ok(evidence);
  assert.equal((evidence?.value as any).benchmarkPricePerSqm, 171);
  assert.equal((evidence?.value as any).datasetDate, '2025-Q4');
  assert.doesNotMatch(evidence?.claim || '', /155|160/);
});

test('Ireland source failure uses the official 2024 national residentially-zoned-land median', async () => {
  const fetcher: typeof fetch = async () => response('unavailable', 503, 'text/plain');
  const evidence = await queryEuropeanLandValuationEvidence('IE', { county: 'Cork' }, fetcher);
  assert.ok(evidence);
  const value = (evidence?.value as any).benchmarkPricePerSqm;
  assert.ok(value > 57 && value < 58);
  assert.match(evidence?.sourceName || '', /Central Statistics Office/i);
});

test('uncalibrated country has no European valuation evidence provider', async () => {
  assert.equal(await queryEuropeanLandValuationEvidence('IT', {}), null);
  assert.equal(await queryEuropeanLandValuationEvidence('NL', {}), null);
});
