import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePolandValuationBenchmark } from './polandValuationBenchmark';

test('uses specific city transaction benchmarks before regional values', () => {
  const warsaw = resolvePolandValuationBenchmark('Warszawa', 'Województwo mazowieckie');
  assert.equal(warsaw.tier, 'city');
  assert.equal(warsaw.benchmarkPricePerSqm, 1009);
  assert.equal(warsaw.lowFactor, 0.70);
  assert.equal(warsaw.highFactor, 1.35);
});

test('normalizes Polish diacritics in city names', () => {
  const lodz = resolvePolandValuationBenchmark('Łódź', 'łódzkie');
  assert.equal(lodz.tier, 'city');
  assert.equal(lodz.benchmarkPricePerSqm, 466);

  const wroclaw = resolvePolandValuationBenchmark('Wrocław', 'dolnośląskie');
  assert.equal(wroclaw.tier, 'city');
  assert.equal(wroclaw.benchmarkPricePerSqm, 543);
});

test('uses voivodeship transaction benchmark for ordinary municipalities and villages', () => {
  const regional = resolvePolandValuationBenchmark('Niepołomice', 'Województwo małopolskie');
  assert.equal(regional.tier, 'voivodeship');
  assert.equal(regional.benchmarkPricePerSqm, 203);
  assert.equal(regional.lowFactor, 0.60);
  assert.equal(regional.highFactor, 1.50);
});

test('uses a wider national transaction fallback where regional coverage is unavailable', () => {
  const fallback = resolvePolandValuationBenchmark('Bydgoszcz', 'kujawsko-pomorskie');
  assert.equal(fallback.tier, 'national');
  assert.equal(fallback.benchmarkPricePerSqm, 188);
  assert.equal(fallback.lowFactor, 0.50);
  assert.equal(fallback.highFactor, 1.70);
});
