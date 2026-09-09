import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGermanyLandValue, resolveGermanyValuationBenchmark } from './germanyValuationBenchmark';

test('Germany resolves exact city benchmarks before state averages', () => {
  const munich = resolveGermanyValuationBenchmark('München', 'Bayern');
  assert.equal(munich.tier, 'CITY');
  assert.equal(munich.benchmarkPricePerSqm, 3455.08);

  const cologne = resolveGermanyValuationBenchmark('Köln', 'Nordrhein-Westfalen');
  assert.equal(cologne.tier, 'CITY');
  assert.equal(cologne.benchmarkPricePerSqm, 1675.24);

  const frankfurt = resolveGermanyValuationBenchmark('Frankfurt am Main', 'Hessen');
  assert.equal(frankfurt.tier, 'CITY');
  assert.equal(frankfurt.benchmarkPricePerSqm, 1699.17);
});

test('Germany falls back to 2025 state transaction benchmarks', () => {
  assert.equal(resolveGermanyValuationBenchmark('Potsdam', 'Brandenburg').benchmarkPricePerSqm, 158.51);
  assert.equal(resolveGermanyValuationBenchmark('Erfurt', 'Thüringen').benchmarkPricePerSqm, 78.56);
  assert.equal(resolveGermanyValuationBenchmark('Dortmund', 'North Rhine-Westphalia').benchmarkPricePerSqm, 296.64);
});

test('Germany uses the official 2025 national average only as the final fallback', () => {
  const benchmark = resolveGermanyValuationBenchmark('Unknown place', 'Unknown state');
  assert.equal(benchmark.tier, 'NATIONAL');
  assert.equal(benchmark.benchmarkPricePerSqm, 271.86);
  assert.ok(benchmark.highFactor >= 5);
});

test('German valuation applies parcel, terrain and access screening after the regional benchmark', () => {
  const value = calculateGermanyLandValue({ areaM2: 1000, municipality: 'Potsdam', state: 'Brandenburg', slopeDegrees: 12, roadDistanceM: 80, directRoadAccess: false });
  assert.equal(value.benchmark.tier, 'STATE');
  assert.equal(value.unitMedianPrice, Math.round(158.51 * 0.88 * 0.82));
  assert.ok(value.unitMinPrice < value.unitMedianPrice);
  assert.ok(value.unitMaxPrice > value.unitMedianPrice * 3);
  assert.equal(value.totalMedian, value.unitMedianPrice * 1000);
});
