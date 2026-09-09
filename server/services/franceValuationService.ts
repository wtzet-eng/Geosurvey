import type { FranceSiteEvidence } from './franceSiteEvidenceService';

type FetchLike = typeof fetch;

type DvfMutation = {
  valeurfonc?: unknown;
  sterr?: unknown;
  sbati?: unknown;
  codtypbien?: unknown;
  libtypbien?: unknown;
  libnatmut?: unknown;
  idnatmut?: unknown;
  segmtab?: unknown;
  vefa?: unknown;
  datemut?: unknown;
};

type CommuneRecord = { code?: unknown; nom?: unknown; codeDepartement?: unknown };

type LandTransaction = {
  unitPricePerSqm: number;
  landAreaM2: number;
  transactionValueEur: number;
  date: string | null;
};

export interface FranceLandBenchmark {
  scope: 'LOCAL' | 'COMMUNE';
  label: string;
  communeCode: string;
  communeName: string;
  departmentCode: string;
  benchmarkPricePerSqm: number;
  lowFactor: number;
  highFactor: number;
  sampleCount: number;
  rawSampleCount: number;
  q25PricePerSqm: number;
  q75PricePerSqm: number;
  oldestTransactionDate: string | null;
  newestTransactionDate: string | null;
}

const DVF_API = 'https://apidf-preprod.cerema.fr/dvf_opendata/mutations/';
const DVF_SOURCE = 'Cerema DVF+ open-data (DGFiP Demandes de Valeurs Foncières)';
const DVF_SOURCE_URL = 'https://www.data.gouv.fr/datasets/dvf-open-data';
const GEO_COMMUNES_API = 'https://geo.api.gouv.fr/communes';
const MIN_SAMPLE = 5;
const EXCLUDED_DEPARTMENTS = new Set(['57', '67', '68', '976']);
const today = () => new Date().toISOString().slice(0, 10);

const numeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const quantile = (sorted: number[], p: number): number => {
  if (!sorted.length) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  const weight = pos - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const hasBuildableLandSignal = (row: DvfMutation): boolean => {
  const code = String(row.codtypbien ?? '');
  const segment = numeric(row.segmtab);
  return code.startsWith('21') || (segment !== null && segment >= 3);
};

function mutationToLandTransaction(row: DvfMutation): LandTransaction | null {
  if (!String(row.codtypbien ?? '').startsWith('2')) return null;
  if (!hasBuildableLandSignal(row)) return null;
  const nature = text(row.libnatmut);
  if (nature && !/^vente\b/i.test(nature)) return null;
  const mutationType = numeric(row.idnatmut);
  if (mutationType !== null && ![1, 2, 4].includes(mutationType)) return null;
  if (row.vefa === true || String(row.vefa).toLowerCase() === 'true') return null;

  const landAreaM2 = numeric(row.sterr);
  const builtAreaM2 = numeric(row.sbati) ?? 0;
  const transactionValueEur = numeric(row.valeurfonc);
  if (landAreaM2 === null || transactionValueEur === null) return null;
  if (landAreaM2 < 50 || transactionValueEur < 1000 || builtAreaM2 > 1) return null;

  const unitPricePerSqm = transactionValueEur / landAreaM2;
  if (!Number.isFinite(unitPricePerSqm) || unitPricePerSqm <= 0 || unitPricePerSqm > 50000) return null;
  return { unitPricePerSqm, landAreaM2, transactionValueEur, date: text(row.datemut) || null };
}

export function summarizeFranceLandTransactions(rows: DvfMutation[], scope: 'LOCAL' | 'COMMUNE', commune: { code: string; name: string; departmentCode: string }): FranceLandBenchmark | null {
  const raw = rows.map(mutationToLandTransaction).filter((row): row is LandTransaction => Boolean(row));
  if (raw.length < MIN_SAMPLE) return null;

  const initial = raw.map(row => row.unitPricePerSqm).sort((a, b) => a - b);
  let cleaned = raw;
  if (raw.length >= 8) {
    const q1 = quantile(initial, 0.25);
    const q3 = quantile(initial, 0.75);
    const iqr = q3 - q1;
    if (Number.isFinite(iqr) && iqr > 0) {
      const lowFence = Math.max(0, q1 - 1.5 * iqr);
      const highFence = q3 + 1.5 * iqr;
      const filtered = raw.filter(row => row.unitPricePerSqm >= lowFence && row.unitPricePerSqm <= highFence);
      if (filtered.length >= MIN_SAMPLE) cleaned = filtered;
    }
  }

  const prices = cleaned.map(row => row.unitPricePerSqm).sort((a, b) => a - b);
  const median = quantile(prices, 0.5);
  const q25 = quantile(prices, 0.25);
  const q75 = quantile(prices, 0.75);
  if (!Number.isFinite(median) || median <= 0) return null;

  const minimumLow = cleaned.length < 8 ? 0.45 : scope === 'LOCAL' ? 0.60 : 0.50;
  const minimumHigh = cleaned.length < 8 ? 1.80 : scope === 'LOCAL' ? 1.50 : 1.65;
  const lowFactor = clamp(Math.min((q25 / median) * 0.9, minimumLow), 0.25, 0.95);
  const highFactor = clamp(Math.max((q75 / median) * 1.1, minimumHigh), 1.05, 3.0);
  const dates = cleaned.map(row => row.date).filter((date): date is string => Boolean(date)).sort();

  return {
    scope,
    label: scope === 'LOCAL' ? `nearby buildable-land-signalled DVF+ transactions around ${commune.name}` : `commune-wide buildable-land-signalled DVF+ transactions for ${commune.name}`,
    communeCode: commune.code,
    communeName: commune.name,
    departmentCode: commune.departmentCode,
    benchmarkPricePerSqm: Math.round(median),
    lowFactor,
    highFactor,
    sampleCount: cleaned.length,
    rawSampleCount: raw.length,
    q25PricePerSqm: Math.round(q25),
    q75PricePerSqm: Math.round(q75),
    oldestTransactionDate: dates[0] || null,
    newestTransactionDate: dates[dates.length - 1] || null
  };
}

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs: number): Promise<{ ok: boolean; data: any; status?: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { headers: { 'User-Agent': 'GeoSurvey/1.0 France land valuation', Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) return { ok: false, data: null, status: response.status };
    try { return { ok: true, data: await response.json(), status: response.status }; }
    catch { return { ok: false, data: null, status: response.status }; }
  } catch {
    return { ok: false, data: null };
  } finally {
    clearTimeout(timer);
  }
}

async function resolveCommune(lat: number, lng: number, fetcher: FetchLike): Promise<{ code: string; name: string; departmentCode: string } | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), fields: 'code,nom,codeDepartement', format: 'json', geometry: 'centre' });
  const result = await fetchJson(fetcher, `${GEO_COMMUNES_API}?${params}`, 3500);
  const row = Array.isArray(result.data) ? result.data[0] as CommuneRecord | undefined : undefined;
  const code = text(row?.code);
  const name = text(row?.nom);
  const departmentCode = text(row?.codeDepartement);
  return result.ok && code && name && departmentCode ? { code, name, departmentCode } : null;
}

async function queryDvfRows(fetcher: FetchLike, params: URLSearchParams): Promise<{ ok: boolean; rows: DvfMutation[]; count: number; status?: number }> {
  const result = await fetchJson(fetcher, `${DVF_API}?${params}`, 7500);
  const rows = Array.isArray(result.data?.results) ? result.data.results as DvfMutation[] : [];
  const count = numeric(result.data?.count) ?? rows.length;
  return { ok: result.ok && Array.isArray(result.data?.results), rows, count, status: result.status };
}

const baseDvfParams = () => new URLSearchParams({
  codtypbien: '2',
  anneemut_min: String(new Date().getUTCFullYear() - 5),
  fields: 'all',
  page_size: '500',
  ordering: '-datemut'
});

export async function queryFranceLandValuationEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<FranceSiteEvidence> {
  const commune = await resolveCommune(lat, lng, fetcher);
  if (!commune) {
    return {
      id: 'fr-dvf-land-valuation-unavailable', category: 'Land market valuation', claim: 'French commune could not be resolved, so DVF+ buildable-land-signalled transactions were not used.',
      status: 'REQUIRES_VERIFICATION', sourceName: DVF_SOURCE, sourceUrl: DVF_SOURCE_URL, datasetDate: today(), spatialRelationship: 'Selected site coordinate',
      calculationMethod: 'Official French commune lookup followed by Cerema DVF+ buildable-land transaction acquisition', confidence: 'Low', value: { reasonCode: 'SOURCE_UNAVAILABLE' },
      limitation: 'No automated land value is presented when the commune cannot be resolved. This is not evidence that market transactions are absent.', reasonCode: 'SOURCE_UNAVAILABLE'
    };
  }

  if (EXCLUDED_DEPARTMENTS.has(commune.departmentCode)) {
    return {
      id: 'fr-dvf-land-valuation-coverage-excluded', category: 'Land market valuation', claim: `DVF open-data does not provide transaction coverage for department ${commune.departmentCode}; no automated land value was inferred.`,
      status: 'REQUIRES_VERIFICATION', sourceName: DVF_SOURCE, sourceUrl: DVF_SOURCE_URL, datasetDate: today(), spatialRelationship: `${commune.name} (${commune.code}), department ${commune.departmentCode}`,
      calculationMethod: 'DVF statutory/open-data coverage gate', confidence: 'High', value: { reasonCode: 'NO_DATA', commune },
      limitation: 'DVF excludes Alsace-Moselle and Mayotte. A local qualified market source is required for land valuation in this area.', reasonCode: 'NO_DATA'
    };
  }

  const localParams = baseDvfParams();
  const halfSpan = 0.005;
  localParams.set('in_bbox', [lng - halfSpan, lat - halfSpan, lng + halfSpan, lat + halfSpan].map(value => value.toFixed(6)).join(','));
  const communeParams = baseDvfParams();
  communeParams.set('code_insee', commune.code);

  const [localResult, communeResult] = await Promise.all([
    queryDvfRows(fetcher, localParams),
    queryDvfRows(fetcher, communeParams)
  ]);

  const localBenchmark = localResult.ok ? summarizeFranceLandTransactions(localResult.rows, 'LOCAL', commune) : null;
  const communeBenchmark = communeResult.ok ? summarizeFranceLandTransactions(communeResult.rows, 'COMMUNE', commune) : null;
  const benchmark = localBenchmark || communeBenchmark;

  if (!benchmark) {
    const sourceReachable = localResult.ok || communeResult.ok;
    const reasonCode = sourceReachable ? 'NO_DATA' : 'SOURCE_UNAVAILABLE';
    return {
      id: sourceReachable ? 'fr-dvf-land-valuation-no-data' : 'fr-dvf-land-valuation-unavailable', category: 'Land market valuation',
      claim: sourceReachable
        ? `DVF+ was queried near and across ${commune.name}, but fewer than ${MIN_SAMPLE} usable buildable-land-signalled transactions remained after validation.`
        : 'Cerema DVF+ land transaction service could not be reached or validated at analysis time.',
      status: 'REQUIRES_VERIFICATION', sourceName: DVF_SOURCE, sourceUrl: DVF_SOURCE_URL, datasetDate: today(), spatialRelationship: `${commune.name} (${commune.code}) and an approximately 1 km local search box`,
      calculationMethod: 'Cerema DVF+ codtypbien=2 acquisition; requires a terrain-à-bâtir signal (21* code or segmtab>=3), excludes built-area/VEFA/non-sale records, and requires a minimum usable sample', confidence: 'Low',
      value: { reasonCode, commune, localReturned: localResult.count, communeReturned: communeResult.count },
      limitation: sourceReachable
        ? 'Sparse buildable-land-signalled transactions can make a defensible automated land benchmark impossible. No generic French fallback is substituted.'
        : 'Source failure is not evidence that land transactions are absent. No generic French fallback is substituted.',
      reasonCode
    };
  }

  return {
    id: 'fr-dvf-land-valuation', category: 'Land market valuation',
    claim: `${benchmark.sampleCount} usable DVF+ buildable-land-signalled transaction(s) support a ${benchmark.scope === 'LOCAL' ? 'nearby' : 'commune-wide'} median benchmark of approximately ${benchmark.benchmarkPricePerSqm.toLocaleString('fr-FR')} €/m² for ${commune.name}.`,
    status: 'MODELLED', sourceName: DVF_SOURCE, sourceUrl: DVF_SOURCE_URL, datasetDate: today(),
    spatialRelationship: benchmark.scope === 'LOCAL' ? `Approximately 1 km search box around the selected site in ${commune.name}` : `Commune ${commune.name} (${commune.code})`,
    calculationMethod: 'Cerema DVF+ open-data: bare-land hierarchy codtypbien 2* plus terrain-à-bâtir signal (21* code or segmtab>=3); filters non-sales, VEFA, built area and invalid price/area records; IQR outlier control when sample size permits; median €/m² benchmark',
    confidence: benchmark.scope === 'LOCAL' && benchmark.sampleCount >= 8 ? 'Medium' : 'Low',
    value: benchmark,
    limitation: 'Land-only screening benchmark from transactions carrying a buildable-land signal. Buildings and improvements are excluded. The DVF+/Cerema signal does not itself prove current PLU/PLUi buildability, servicing, access, contamination, subdivision potential or equivalent legal/economic comparability for the selected parcel.'
  };
}

function clearUnavailableValuation(report: any, reason: string): void {
  const previous = report.valuation || {};
  report.valuation = {
    ...previous,
    status: 'REQUIRES_VERIFICATION',
    indicativeMinPrice: Number.NaN,
    indicativeMaxPrice: Number.NaN,
    indicativeMedianPrice: Number.NaN,
    indicativePricePerSqm: Number.NaN,
    currency: 'EUR',
    comparableEvidenceCount: 0,
    methodology: `French land value withheld: ${reason}. No generic national €/m² fallback is used.`,
    marketTrendDescription: 'No automated French land value is presented without a sufficient DVF+ buildable-land-signalled transaction sample.',
    uncertaintyRating: 'High',
    disclaimer: 'LAND VALUE ONLY. Buildings, structures and other improvements are excluded. This is not a certified property appraisal.'
  };
  const source = report.dataSourcesCited?.find((item: any) => item.type === 'Statistical Market Benchmark');
  if (source) { source.name = DVF_SOURCE; source.organization = 'Cerema / DGFiP'; source.url = DVF_SOURCE_URL; source.status = 'REQUIRES_VERIFICATION'; }
  if (report.evidenceScore?.breakdown?.planningAndMarket) {
    report.evidenceScore.breakdown.planningAndMarket.score = 0;
    report.evidenceScore.breakdown.planningAndMarket.rationale = 'French DVF+ valuation evidence was unavailable or insufficient; no valuation points are awarded and planning remains unverified.';
  }
}

export function enrichFranceValuationFromEvidence(report: any, evidenceItems: FranceSiteEvidence[]): void {
  const evidence = evidenceItems.find(item => item.id === 'fr-dvf-land-valuation' && item.status === 'MODELLED');
  if (!evidence) {
    const unavailable = evidenceItems.find(item => item.id.startsWith('fr-dvf-land-valuation'));
    clearUnavailableValuation(report, unavailable?.claim || 'live DVF+ evidence was not available');
    return;
  }

  const benchmark = evidence.value as FranceLandBenchmark;
  const areaM2 = numeric(report.parcel?.officialAreaM2) ?? numeric(report.parcel?.areaCalculatedM2);
  if (areaM2 === null || areaM2 <= 0) {
    clearUnavailableValuation(report, 'parcel area was not available');
    return;
  }

  let adjustment = 1;
  const slopeDegrees = numeric(report.terrain?.averageSlopeDegrees);
  const roadDistanceM = numeric(report.infrastructure?.roadAccess?.estimatedDistanceM);
  const directRoadAccess = Boolean(report.infrastructure?.roadAccess?.directAccessVerified);
  if (slopeDegrees !== null && slopeDegrees > 10) adjustment *= 0.88;
  if (roadDistanceM !== null && !directRoadAccess && roadDistanceM > 50) adjustment *= 0.82;
  adjustment *= areaM2 > 2500 ? 0.90 : areaM2 < 750 ? 1.10 : 1.0;

  const unitMedian = Math.max(1, Math.round(benchmark.benchmarkPricePerSqm * adjustment));
  const unitMin = Math.max(1, Math.round(unitMedian * benchmark.lowFactor));
  const unitMax = Math.max(unitMin, Math.round(unitMedian * benchmark.highFactor));
  const totalMedian = Math.round(unitMedian * areaM2);
  const totalMin = Math.round(unitMin * areaM2);
  const totalMax = Math.round(unitMax * areaM2);

  report.valuation = {
    ...(report.valuation || {}),
    status: 'MODELLED',
    indicativeMinPrice: totalMin,
    indicativeMaxPrice: totalMax,
    indicativeMedianPrice: totalMedian,
    indicativePricePerSqm: unitMedian,
    currency: 'EUR',
    methodology: `Indicative land-only benchmark from ${benchmark.sampleCount} usable Cerema DVF+ buildable-land-signalled transactions (${benchmark.scope === 'LOCAL' ? 'nearby search' : `commune ${benchmark.communeName}`}). Median source benchmark ${benchmark.benchmarkPricePerSqm} €/m²; observed central quartiles approximately ${benchmark.q25PricePerSqm}–${benchmark.q75PricePerSqm} €/m². Parcel-size${slopeDegrees !== null ? ', terrain' : ''}${roadDistanceM !== null ? ' and mapped road-access' : ''} screening adjustments were then applied. Buildings and other improvements are excluded.`,
    comparableEvidenceCount: benchmark.sampleCount,
    marketTrendDescription: `DVF+ buildable-land-signalled benchmark based on transactions from ${benchmark.oldestTransactionDate || 'the recent query period'} to ${benchmark.newestTransactionDate || 'the recent query period'}; final screening range ${unitMin.toLocaleString('fr-FR')}–${unitMax.toLocaleString('fr-FR')} €/m².`,
    priceDrivers: [
      { factor: 'DVF+ buildable-land transaction benchmark', impact: `${benchmark.benchmarkPricePerSqm} €/m² median (${benchmark.sampleCount} usable transactions; ${benchmark.scope.toLowerCase()} scope)`, weight: 'High' },
      { factor: 'Planning / buildability evidence', impact: 'Not verified — the DVF+/Cerema buildable-land signal does not prove current equivalent PLU/PLUi rights', weight: 'High' },
      { factor: 'Road proximity & access', impact: roadDistanceM !== null && !directRoadAccess && roadDistanceM > 50 ? '-18% screening adjustment' : 'No adverse screening adjustment applied', weight: 'Medium' },
      { factor: 'Terrain topography', impact: slopeDegrees !== null && slopeDegrees > 10 ? '-12% screening adjustment' : 'No adverse screening adjustment applied', weight: 'Medium' },
      { factor: 'Parcel area', impact: areaM2 > 2500 ? '-10% scale adjustment' : areaM2 < 750 ? '+10% scale adjustment' : 'Standard', weight: 'Low' }
    ],
    uncertaintyRating: 'High',
    disclaimer: 'INDICATIVE LAND VALUE ONLY: automated screening from DVF+ transactions carrying a buildable-land signal. Buildings, structures and other improvements are excluded. The signal does not prove current planning rights. This is not a certified property appraisal or a substitute for local comparable analysis by a qualified valuer.'
  };

  const source = report.dataSourcesCited?.find((item: any) => item.type === 'Statistical Market Benchmark');
  if (source) { source.name = DVF_SOURCE; source.organization = 'Cerema / DGFiP'; source.url = DVF_SOURCE_URL; source.status = 'MODELLED'; }
  if (report.evidenceScore?.breakdown?.planningAndMarket) {
    report.evidenceScore.breakdown.planningAndMarket.score = 6;
    report.evidenceScore.breakdown.planningAndMarket.rationale = `Live Cerema DVF+ buildable-land-signalled evidence supports an indicative land benchmark (${benchmark.sampleCount} usable transactions), while binding planning rights remain unverified.`;
  }
}
