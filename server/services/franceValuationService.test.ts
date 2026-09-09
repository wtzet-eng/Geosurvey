import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichFranceValuationFromEvidence, queryFranceLandValuationEvidence, summarizeFranceLandTransactions } from './franceValuationService';

const commune = { code: '33063', name: 'Bordeaux', departmentCode: '33' };
const land = (unitPrice: number, area = 1000, date = '2025-06-01', code = '21', segment: string | undefined = '4') => ({
  codtypbien: code, segmtab: segment, idnatmut: '1', libtypbien: 'TERRAIN DE TYPE TAB', libnatmut: 'Vente', vefa: false,
  valeurfonc: String(unitPrice * area), sterr: String(area), sbati: '0', datemut: date
});
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

function fetcher(localRows: unknown[], communeRows: unknown[], departmentCode = '33'): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('https://geo.api.gouv.fr/communes')) return json([{ code: '33063', nom: 'Bordeaux', codeDepartement: departmentCode }]);
    if (url.includes('/dvf_opendata/mutations/')) {
      const rows = url.includes('in_bbox=') ? localRows : communeRows;
      return json({ count: rows.length, next: null, previous: null, results: rows });
    }
    return json({}, 404);
  }) as typeof fetch;
}

test('DVF summary keeps buildable-land signals and rejects generic natural/built/VEFA/non-land records', () => {
  const rows: any[] = [
    land(80, 1000, '2025-01-01', '20', '3'),
    land(90, 1000, '2025-02-01', '21', undefined),
    land(100, 1000, '2025-03-01', '2311', '4'),
    land(110, 1000, '2025-04-01', '232', '3'),
    land(120, 1000, '2025-05-01', '239', '4'),
    land(5, 1000, '2025-01-15', '20', undefined),
    land(8, 1000, '2025-01-20', '2311', undefined),
    { ...land(900), codtypbien: '1113' },
    { ...land(700), sbati: '120' },
    { ...land(600), vefa: true },
    { ...land(500), libnatmut: 'Echange' },
    { ...land(450), idnatmut: '7' }
  ];
  const summary = summarizeFranceLandTransactions(rows, 'COMMUNE', commune);
  assert.ok(summary);
  assert.equal(summary?.sampleCount, 5);
  assert.equal(summary?.benchmarkPricePerSqm, 100);
  assert.equal(summary?.q25PricePerSqm, 90);
  assert.equal(summary?.q75PricePerSqm, 110);
});

test('generic agricultural/natural bare-land prices do not pull down a buildable-land benchmark', () => {
  const buildable = [90, 100, 110, 120, 130, 140].map(value => land(value));
  const genericNatural = [2, 3, 4, 5, 6, 7].map(value => land(value, 5000, '2025-02-01', '20', undefined));
  const summary = summarizeFranceLandTransactions([...genericNatural, ...buildable], 'COMMUNE', commune);
  assert.ok(summary);
  assert.equal(summary?.sampleCount, 6);
  assert.equal(summary?.benchmarkPricePerSqm, 115);
});

test('nearby DVF buildable-land sample wins when it is sufficient', async () => {
  const local = [70, 80, 90, 100, 110, 120].map(value => land(value));
  const communeWide = [150, 160, 170, 180, 190, 200].map(value => land(value));
  const evidence = await queryFranceLandValuationEvidence(44.84, -0.58, fetcher(local, communeWide));
  assert.equal(evidence.status, 'MODELLED');
  assert.equal(evidence.id, 'fr-dvf-land-valuation');
  assert.equal((evidence.value as any).scope, 'LOCAL');
  assert.equal((evidence.value as any).benchmarkPricePerSqm, 95);
  assert.equal((evidence.value as any).sampleCount, 6);
  assert.match(evidence.calculationMethod, /terrain-à-bâtir signal/i);
});

test('commune DVF sample is used when nearby buildable-land evidence is too sparse', async () => {
  const local = [80, 90, 100].map(value => land(value));
  const communeWide = [100, 110, 120, 130, 140, 150].map(value => land(value));
  const evidence = await queryFranceLandValuationEvidence(44.84, -0.58, fetcher(local, communeWide));
  assert.equal(evidence.status, 'MODELLED');
  assert.equal((evidence.value as any).scope, 'COMMUNE');
  assert.equal((evidence.value as any).benchmarkPricePerSqm, 125);
});

test('insufficient DVF evidence fails closed and never revives a generic French baseline', async () => {
  const evidence = await queryFranceLandValuationEvidence(44.84, -0.58, fetcher([land(90)], [land(100), land(110), land(120)]));
  assert.equal(evidence.status, 'REQUIRES_VERIFICATION');
  assert.equal(evidence.reasonCode, 'NO_DATA');
  const report: any = { valuation: { status: 'MODELLED', indicativeMinPrice: 205000, indicativeMaxPrice: 205000, indicativeMedianPrice: 205000, indicativePricePerSqm: 205, currency: 'EUR' }, evidenceScore: { breakdown: { planningAndMarket: { score: 4, max: 10, rationale: 'old baseline' } } }, dataSourcesCited: [] };
  enrichFranceValuationFromEvidence(report, [evidence as any]);
  assert.equal(report.valuation.status, 'REQUIRES_VERIFICATION');
  assert.ok(Number.isNaN(report.valuation.indicativeMedianPrice));
  assert.doesNotMatch(report.valuation.methodology, /205\s*€?\/m²/i);
  assert.match(report.valuation.methodology, /No generic national/i);
});

test('Alsace-Moselle and Mayotte DVF coverage exclusions fail closed', async () => {
  for (const department of ['57', '67', '68', '976']) {
    const evidence = await queryFranceLandValuationEvidence(48.58, 7.75, fetcher([], [], department));
    assert.equal(evidence.status, 'REQUIRES_VERIFICATION');
    assert.equal(evidence.id, 'fr-dvf-land-valuation-coverage-excluded');
    assert.match(evidence.limitation, /Alsace-Moselle and Mayotte/i);
  }
});

test('valid DVF benchmark enriches report as land-only value with real comparable count', async () => {
  const local = [90, 100, 110, 120, 130, 140, 150, 160].map((value, index) => land(value, 1000, `2025-0${(index % 8) + 1}-01`));
  const evidence = await queryFranceLandValuationEvidence(44.84, -0.58, fetcher(local, []));
  const report: any = { parcel: { areaCalculatedM2: 1000 }, terrain: { averageSlopeDegrees: 2 }, infrastructure: { roadAccess: { estimatedDistanceM: 15, directAccessVerified: true } }, valuation: {}, evidenceScore: { breakdown: { planningAndMarket: { score: 0, max: 10, rationale: '' } } }, dataSourcesCited: [{ name: 'old', organization: 'old', url: '', type: 'Statistical Market Benchmark', status: 'MODELLED' }] };
  enrichFranceValuationFromEvidence(report, [evidence as any]);
  assert.equal(report.valuation.status, 'MODELLED');
  assert.equal(report.valuation.indicativePricePerSqm, 125);
  assert.equal(report.valuation.indicativeMedianPrice, 125000);
  assert.equal(report.valuation.comparableEvidenceCount, 8);
  assert.match(report.valuation.methodology, /buildable-land-signalled/i);
  assert.match(report.valuation.methodology, /Buildings and other improvements are excluded/i);
  assert.match(report.valuation.disclaimer, /LAND VALUE ONLY/i);
  assert.match(report.valuation.disclaimer, /does not prove current planning rights/i);
  assert.match(report.dataSourcesCited[0].name, /Cerema DVF\+/i);
  assert.equal(report.evidenceScore.breakdown.planningAndMarket.score, 6);
});
