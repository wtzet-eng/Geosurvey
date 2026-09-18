import test from 'node:test';
import assert from 'node:assert/strict';
import { applyValuationAreaGuard, TOTAL_VALUE_CALIBRATION_MAX_AREA_M2 } from './valuationAreaGuard';

const report: any = {
  valuation: { min: 1_000_000, max: 2_000_000, median: 1_500_000, currency: 'EUR', status: 'MODELLED', comparableCount: 0, sourceName: 'Local benchmark' },
  evidenceRecords: [{ id: 'valuation-indicative-model', category: 'Land market valuation', claim: 'Old total claim', limitation: 'Land only.' }]
};

test('normal parcel totals remain unchanged', () => {
  const guarded = applyValuationAreaGuard(report, 10_000);
  assert.equal(guarded.valuation.min, 1_000_000);
  assert.notEqual(guarded.valuation.mode, 'MARKET_CONTEXT');
});

test('large selections retain unit market context but suppress whole-site totals', () => {
  const area = 100_000;
  const guarded = applyValuationAreaGuard(report, area);
  assert.equal(guarded.valuation.mode, 'MARKET_CONTEXT');
  assert.equal(guarded.valuation.min, null);
  assert.equal(guarded.valuation.max, null);
  assert.equal(guarded.valuation.unitMin, 10);
  assert.equal(guarded.valuation.unitMax, 20);
  assert.equal(guarded.valuation.unitMedian, 15);
  assert.equal(guarded.valuation.calibrationMaxAreaM2, TOTAL_VALUE_CALIBRATION_MAX_AREA_M2);
  assert.match(guarded.evidenceRecords[0].claim, /Market context only/i);
  assert.match(guarded.evidenceRecords[0].claim, /not extrapolated/i);
});
