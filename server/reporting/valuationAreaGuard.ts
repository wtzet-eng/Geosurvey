import type { CanonicalReport } from './canonicalReport';

export const TOTAL_VALUE_CALIBRATION_MAX_AREA_M2 = 50_000;

const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

export function applyValuationAreaGuard(report: CanonicalReport, areaM2: number | null): CanonicalReport {
  if (!areaM2 || !Number.isFinite(areaM2) || areaM2 <= TOTAL_VALUE_CALIBRATION_MAX_AREA_M2) return report;
  const min = finite(report.valuation.min);
  const max = finite(report.valuation.max);
  const median = finite(report.valuation.median);
  if (min === null || max === null) return report;

  const unitMin = Math.round((min / areaM2) * 100) / 100;
  const unitMax = Math.round((max / areaM2) * 100) / 100;
  const unitMedian = median === null ? null : Math.round((median / areaM2) * 100) / 100;
  const claim = `Market context only: ${unitMin.toLocaleString('en-US')}–${unitMax.toLocaleString('en-US')} ${report.valuation.currency}/m². The selected area (${Math.round(areaM2).toLocaleString('en-US')} m²) exceeds LandSurf's ${TOTAL_VALUE_CALIBRATION_MAX_AREA_M2.toLocaleString('en-US')} m² total-value calibration guard, so the benchmark is not extrapolated to a whole-site total.`;

  return {
    ...report,
    valuation: {
      ...report.valuation,
      min: null,
      max: null,
      median: null,
      mode: 'MARKET_CONTEXT',
      unitMin,
      unitMax,
      unitMedian,
      calibrationMaxAreaM2: TOTAL_VALUE_CALIBRATION_MAX_AREA_M2
    },
    evidenceRecords: report.evidenceRecords.map(record => /valuation|market benchmark|price/i.test(`${record.id} ${record.category}`)
      ? { ...record, claim, limitation: `${record.limitation || ''} Total site value is intentionally not estimated for selections above the LandSurf parcel-total calibration guard.`.trim() }
      : record)
  };
}
