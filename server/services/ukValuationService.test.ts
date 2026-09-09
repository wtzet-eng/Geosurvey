import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichUKValuationFromEvidence, queryUKLandValuationEvidence, selectEnglandResidentialLandValue } from './ukValuationService';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

test('England benchmark selector prefers residential land value over density and unrelated values', () => {
  const rows: any[][] = [
    ['Local authority', 'Residential land value central scenario (£/ha)', 'Dwellings per hectare', 'Industrial land value (£/ha)'],
    ['Manchester', 5_000_000, 40, 1_200_000]
  ];
  assert.equal(selectEnglandResidentialLandValue(rows, 'Manchester'), 5_000_000);
});

test('England benchmark selector accepts a central residential land-value column whose header also describes density', () => {
  const rows: any[][] = [
    ['Residential land values', 'Residential land values'],
    ['Scenario', 'Central density / median house-price scenario'],
    ['Measure', 'Land value (£/ha)'],
    ['Local authority', 'Value'],
    ['Manchester City Council', 5_200_000]
  ];
  assert.equal(selectEnglandResidentialLandValue(rows, 'Manchester'), 5_200_000);
});

test('England benchmark selector tolerates council naming differences and can match a LAD code', () => {
  const rows: any[][] = [
    ['Local authority code', 'Local authority', 'Central residential land value (£/ha)'],
    ['E06000060', 'Buckinghamshire Council', 4_100_000]
  ];
  assert.equal(selectEnglandResidentialLandValue(rows, 'Buckinghamshire', 'E06000060'), 4_100_000);
});

test('England benchmark selector supports workbooks expressed in £ million per hectare', () => {
  const rows: any[][] = [
    ['Local authority', 'Central residential land value (£ million per hectare)'],
    ['Bristol, City of', 4.25]
  ];
  assert.equal(selectEnglandResidentialLandValue(rows, 'Bristol'), 4_250_000);
});

test('Wales does not inherit an England MHCLG valuation or trigger workbook download', async () => {
  let workbookRequests = 0;
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('Local_Authority_Districts')) return json({ features: [{ attributes: { LAD24CD: 'W06000015', LAD24NM: 'Cardiff' } }] });
    if (url.includes('Land_value_estimates_for_policy_appraisal_2023.xlsx')) workbookRequests += 1;
    return new Response('', { status: 404 });
  }) as typeof fetch;

  const evidence = await queryUKLandValuationEvidence(51.48, -3.18, fetcher);
  assert.equal(evidence.status, 'REQUIRES_VERIFICATION');
  assert.equal(evidence.id, 'uk-mhclg-land-valuation-coverage-excluded');
  assert.match(evidence.limitation, /England-only/i);
  assert.equal(workbookRequests, 0);
});

test('England MHCLG benchmark produces a wide land-only screening range and no comparable-deed claim', () => {
  const report: any = {
    parcel: { areaCalculatedM2: 1000 },
    terrain: { averageSlopeDegrees: 2 },
    infrastructure: { roadAccess: { estimatedDistanceM: 15, directAccessVerified: true } },
    valuation: { indicativePricePerSqm: 195, indicativeMedianPrice: 195000 },
    evidenceRegistry: [{ id: 'valuation-indicative-model', category: 'Market Valuation & Economics', status: 'MODELLED', sourceName: 'old', limitation: 'old' }]
  };
  const evidence: any = {
    id: 'uk-mhclg-land-valuation', category: 'Land market valuation', status: 'MODELLED',
    claim: 'MHCLG benchmark for Manchester', sourceName: 'MHCLG Land value estimates for policy appraisal 2023',
    sourceUrl: 'https://www.gov.uk/government/publications/land-value-estimates-for-policy-appraisal-2023', datasetDate: '2026-03-16',
    spatialRelationship: 'Local authority Manchester', calculationMethod: 'Official MHCLG residential £/ha benchmark', confidence: 'Low',
    limitation: 'Policy-appraisal benchmark; planning and servicing assumptions are not parcel evidence.',
    value: { localAuthorityCode: 'E08000003', localAuthorityName: 'Manchester', landValuePerHa: 5_000_000, benchmarkPricePerSqm: 500, lowFactor: 0.45, highFactor: 1.75, sourceName: 'MHCLG Land value estimates for policy appraisal 2023', sourceUrl: 'https://www.gov.uk/government/publications/land-value-estimates-for-policy-appraisal-2023', datasetYear: '2023', publishedDate: '2026-03-16' }
  };

  enrichUKValuationFromEvidence(report, evidence);
  assert.equal(report.valuation.status, 'MODELLED');
  assert.equal(report.valuation.indicativePricePerSqm, 500);
  assert.equal(report.valuation.indicativeMedianPrice, 500_000);
  assert.equal(report.valuation.indicativeMinPrice, 225_000);
  assert.equal(report.valuation.indicativeMaxPrice, 875_000);
  assert.equal(report.valuation.comparableEvidenceCount, 0);
  assert.match(report.valuation.disclaimer, /LAND VALUE ONLY/i);
  assert.match(report.valuation.disclaimer, /policy-appraisal estimates rather than market valuations/i);
  assert.match(report.valuation.disclaimer, /planning permission/i);
  assert.match(report.evidenceRegistry[0].sourceName, /MHCLG/i);
});

test('unavailable UK valuation clears the legacy £195/m² result rather than falling back', () => {
  const report: any = {
    valuation: { status: 'MODELLED', indicativeMinPrice: 160000, indicativeMaxPrice: 230000, indicativeMedianPrice: 195000, indicativePricePerSqm: 195, currency: 'GBP' },
    evidenceRegistry: []
  };
  enrichUKValuationFromEvidence(report, {
    id: 'uk-mhclg-land-valuation-unavailable', category: 'Land market valuation', claim: 'MHCLG source unavailable', status: 'REQUIRES_VERIFICATION', sourceName: 'MHCLG', sourceUrl: 'https://www.gov.uk/', datasetDate: '2026-03-16', spatialRelationship: 'site', calculationMethod: 'source query', confidence: 'Low', limitation: 'No fallback', value: { reasonCode: 'SOURCE_UNAVAILABLE' }
  } as any);
  assert.equal(report.valuation.status, 'REQUIRES_VERIFICATION');
  assert.ok(Number.isNaN(report.valuation.indicativeMedianPrice));
  assert.match(report.valuation.methodology, /No generic £\/m² fallback/i);
  assert.doesNotMatch(report.valuation.methodology, /195/);
});
