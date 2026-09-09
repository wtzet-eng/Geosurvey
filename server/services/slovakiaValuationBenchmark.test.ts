import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSlovakiaValuationBenchmark } from './slovakiaValuationBenchmark';

test('Slovakia uses city residential-plot asking benchmarks before regional values', () => {
  const bratislava = resolveSlovakiaValuationBenchmark('Bratislava', 'Bratislavský kraj');
  assert.equal(bratislava.tier, 'city');
  assert.equal(bratislava.benchmarkPricePerSqm, 312);
  assert.equal(bratislava.evidenceKind, 'ASKING_PRICE');
  assert.match(bratislava.sourceName, /ZoznamRealit/i);

  const kosice = resolveSlovakiaValuationBenchmark('Košice', 'Košický kraj');
  assert.equal(kosice.tier, 'city');
  assert.equal(kosice.benchmarkPricePerSqm, 113);
});

test('Slovakia normalizes diacritics and resolves all eight kraj benchmarks', () => {
  const expected: Array<[string, number]> = [
    ['Bratislavský kraj', 180],
    ['Trnavský kraj', 84],
    ['Nitriansky kraj', 48],
    ['Trenčiansky kraj', 45],
    ['Žilinský kraj', 65],
    ['Banskobystrický kraj', 61],
    ['Košický kraj', 58],
    ['Prešovský kraj', 43]
  ];

  for (const [region, price] of expected) {
    const benchmark = resolveSlovakiaValuationBenchmark('ordinary village', region);
    assert.equal(benchmark.tier, 'region', region);
    assert.equal(benchmark.benchmarkPricePerSqm, price, region);
    assert.equal(benchmark.lowFactor, 0.50);
    assert.equal(benchmark.highFactor, 1.60);
  }
});

test('Slovakia accepts common self-governing-region wording', () => {
  const benchmark = resolveSlovakiaValuationBenchmark('Zelená Voda', 'Trenčiansky samosprávny kraj');
  assert.equal(benchmark.tier, 'region');
  assert.equal(benchmark.benchmarkPricePerSqm, 45);
});

test('Slovakia uses a deliberately wide national asking-price fallback', () => {
  const benchmark = resolveSlovakiaValuationBenchmark('Unknown municipality', 'Unknown region');
  assert.equal(benchmark.tier, 'national');
  assert.equal(benchmark.benchmarkPricePerSqm, 69);
  assert.equal(benchmark.lowFactor, 0.45);
  assert.equal(benchmark.highFactor, 1.70);
  assert.match(benchmark.label, /asking fallback/i);
});
