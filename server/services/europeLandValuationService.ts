import type { EvidenceItem, VerifiedSiteReport } from '../types';

type FetchLike = typeof fetch;
type Scope = 'COUNTY' | 'PROVINCE' | 'METRO' | 'NATIONAL';
type EvidenceKind = 'OFFICIAL_TRANSACTION' | 'OFFICIAL_STATISTICAL_MODEL';

export interface EuropeLandBenchmark {
  countryCode: 'AT' | 'ES' | 'FI' | 'IE';
  scope: Scope;
  label: string;
  benchmarkPricePerSqm: number;
  lowFactor: number;
  highFactor: number;
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  evidenceKind: EvidenceKind;
  comparableCount: number;
  limitation: string;
}

export type EuropeLandValuationEvidence = EvidenceItem & {
  value?: EuropeLandBenchmark | { reasonCode: string; detail?: string };
};

const SPAIN_CSV = 'https://cdn.mivau.gob.es/portal-web-mivau/Datos_MIVAU/CSV/VDP004_01.csv';
const SPAIN_SOURCE = 'Ministerio de Vivienda y Agenda Urbana (MIVAU) · Precio Medio del Suelo';
const SPAIN_PAGE = 'https://www.transportes.gob.es/recursos_mfom/comodin/recursos/2025_4t_0.pdf';
const FINLAND_TABLE = 'https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/kihi/11jb.px';
const FINLAND_SOURCE = 'Statistics Finland · Real estate prices · single-family house plots';
const FINLAND_PAGE = 'https://pxdata.stat.fi/PxWeb/pxweb/en/StatFin/StatFin__kihi/11jb.px/';
const IRELAND_COUNTY_CSV = 'https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/RZLPA02/CSV/1.0/en';
const IRELAND_SOURCE = 'Central Statistics Office Ireland · Residentially Zoned Land Prices 2024';
const IRELAND_PAGE = 'https://www.cso.ie/en/releasesandpublications/fp/fp-rzlp/residentiallyzonedlandprices2024/';
const AUSTRIA_SOURCE = 'Statistik Austria · Baugrundstückspreise 2025';
const AUSTRIA_PAGE = 'https://www.statistik.at/statistiken/volkswirtschaft-und-oeffentliche-finanzen/preise-und-preisindizes/immobilien-durchschnittspreise';
const ACRE_M2 = 4046.8564224;

const today = () => new Date().toISOString().slice(0, 10);
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const normalize = (value?: string) => (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const numeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  let text = value.trim().replace(/\s/g, '').replace(/€/g, '');
  if (!text || ['..', '.', ':'].includes(text)) return null;
  if (text.includes(',') && text.includes('.')) text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  else if (text.includes(',')) {
    const parts = text.split(',');
    text = parts.length === 2 && parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : parts.join('');
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { cells.push(cell.trim()); cell = ''; }
    else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

export function parseDelimitedTable(text: string): Array<Record<string, string>> {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const delimiter = (lines[0].match(/;/g)?.length || 0) > (lines[0].match(/,/g)?.length || 0) ? ';' : ',';
  const headers = splitCsvLine(lines[0], delimiter).map(header => header.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    const cells = splitCsvLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, (cells[index] || '').replace(/^"|"$/g, '').trim()]));
  });
}

function field(row: Record<string, string>, matcher: RegExp): string {
  const key = Object.keys(row).find(name => matcher.test(normalize(name)));
  return key ? row[key] : '';
}

async function fetchText(fetcher: FetchLike, url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetcher(url, { headers: { 'User-Agent': 'GeoSurvey/1.0 European land valuation', Accept: 'text/csv,text/plain,*/*' }, signal: controller.signal });
    return response.ok ? await response.text() : null;
  } catch { return null; }
  finally { clearTimeout(timer); }
}

async function fetchJson(fetcher: FetchLike, url: string, init?: RequestInit): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetcher(url, { ...(init || {}), headers: { 'User-Agent': 'GeoSurvey/1.0 European land valuation', Accept: 'application/json', ...(init?.headers || {}) }, signal: controller.signal });
    return response.ok ? await response.json() : null;
  } catch { return null; }
  finally { clearTimeout(timer); }
}

function modelled(benchmark: EuropeLandBenchmark): EuropeLandValuationEvidence {
  return {
    id: `${benchmark.countryCode.toLowerCase()}-land-valuation`, category: 'Land market valuation',
    claim: `${benchmark.label}: approximately ${benchmark.benchmarkPricePerSqm.toLocaleString('en-US')} €/m² (${benchmark.scope.toLowerCase()} benchmark).`,
    status: 'MODELLED', sourceName: benchmark.sourceName, sourceUrl: benchmark.sourceUrl, datasetDate: benchmark.datasetDate,
    spatialRelationship: benchmark.label,
    calculationMethod: benchmark.evidenceKind === 'OFFICIAL_TRANSACTION' ? 'Official land-transaction price statistic normalized to €/m²' : 'Official statistical land-price benchmark normalized to €/m²',
    confidence: benchmark.scope === 'NATIONAL' ? 'Low' : 'Medium', limitation: benchmark.limitation, value: benchmark
  };
}

function unavailable(countryCode: string, sourceName: string, sourceUrl: string, detail: string): EuropeLandValuationEvidence {
  return {
    id: `${countryCode.toLowerCase()}-land-valuation-unavailable`, category: 'Land market valuation', claim: detail,
    status: 'REQUIRES_VERIFICATION', sourceName, sourceUrl, datasetDate: today(), spatialRelationship: 'Selected site',
    calculationMethod: 'Country-specific land-price acquisition with fail-closed validation', confidence: 'Low',
    limitation: 'No generic European €/m² fallback is substituted when the country-specific source cannot support the selected site.',
    value: { reasonCode: 'SOURCE_UNAVAILABLE', detail }
  };
}

function austriaBenchmark(): EuropeLandBenchmark {
  return {
    countryCode: 'AT', scope: 'NATIONAL', label: 'Austria 2025 buildable-plot national benchmark', benchmarkPricePerSqm: 135,
    lowFactor: 0.35, highFactor: 2.20, sourceName: AUSTRIA_SOURCE, sourceUrl: AUSTRIA_PAGE, datasetDate: '2025',
    evidenceKind: 'OFFICIAL_STATISTICAL_MODEL', comparableCount: 0,
    limitation: 'Statistik Austria reports a 2025 geometric-mean buildable-plot price derived from 2021–2025 private-purchaser transactions with earlier observations valorised to 2025. Local prices vary extremely; finer local evidence should replace the national fallback where available. Buildings and improvements are excluded and parcel buildability is not established.'
  };
}

export function selectSpainBenchmark(rows: Array<Record<string, string>>, province?: string, autonomousCommunity?: string): EuropeLandBenchmark | null {
  const parsed = rows.map(row => {
    const year = numeric(field(row, /^ano$|^year$/i));
    const quarter = numeric(field(row, /trimestre|quarter/i).replace(/[^0-9]/g, ''));
    const price = numeric(field(row, /^valor(?: m)?$|valor.*m2|precio.*m2|eur.*m2/i));
    return { year, quarter, price, province: field(row, /provincia|province/i), community: field(row, /comunidad.*autonoma|autonomous.*community/i), type: field(row, /^tipo$|type/i) };
  }).filter(item => item.year !== null && item.quarter !== null && item.price !== null && item.price! > 0);
  if (!parsed.length) return null;
  const latestKey = Math.max(...parsed.map(item => item.year! * 10 + item.quarter!));
  const latest = parsed.filter(item => item.year! * 10 + item.quarter! === latestKey);
  const totalish = (value: string) => !value || /total|todos|todas|conjunto|^0$/i.test(value.trim());
  const provinceTarget = normalize(province);
  const communityTarget = normalize(autonomousCommunity);
  const provinceHit = provinceTarget ? latest.find(item => normalize(item.province) === provinceTarget && totalish(item.type)) : undefined;
  const communityHit = communityTarget ? latest.find(item => normalize(item.community) === communityTarget && !item.province && totalish(item.type)) : undefined;
  const nationalHit = latest.find(item => !item.province && !item.community && totalish(item.type));
  const chosen = provinceHit || communityHit || nationalHit;
  if (!chosen) return null;
  const scope: Scope = provinceHit ? 'PROVINCE' : 'NATIONAL';
  return {
    countryCode: 'ES', scope,
    label: provinceHit ? `${provinceHit.province} official urban-land benchmark` : communityHit ? `${communityHit.community} official urban-land benchmark` : 'Spain official urban-land national benchmark',
    benchmarkPricePerSqm: Math.round(chosen.price!), lowFactor: scope === 'PROVINCE' ? 0.55 : 0.40, highFactor: scope === 'PROVINCE' ? 1.65 : 1.90,
    sourceName: SPAIN_SOURCE, sourceUrl: SPAIN_CSV, datasetDate: `${chosen.year}-Q${chosen.quarter}`, evidenceKind: 'OFFICIAL_TRANSACTION', comparableCount: 0,
    limitation: 'Official registered urban/developable-land statistic, not direct parcel comparables. Municipality-size mix, planning status, servicing and local micro-market conditions can differ materially. Buildings and improvements are excluded.'
  };
}

async function querySpain(province: string, community: string, fetcher: FetchLike): Promise<EuropeLandValuationEvidence> {
  const csv = await fetchText(fetcher, SPAIN_CSV);
  const live = csv ? selectSpainBenchmark(parseDelimitedTable(csv), province, community) : null;
  if (live) return modelled(live);
  return modelled({
    countryCode: 'ES', scope: 'NATIONAL', label: 'Spain 2025-Q4 official urban-land national fallback', benchmarkPricePerSqm: 171,
    lowFactor: 0.40, highFactor: 1.90, sourceName: SPAIN_SOURCE, sourceUrl: SPAIN_PAGE, datasetDate: '2025-Q4', evidenceKind: 'OFFICIAL_TRANSACTION', comparableCount: 0,
    limitation: 'A finer geography could not be validated, so the dated 2025-Q4 national registered urban-land mean is used with a wide range. It does not establish parcel buildability or servicing; buildings and improvements are excluded.'
  });
}

function variable(meta: any, matcher: RegExp): any | null {
  return Array.isArray(meta?.variables) ? meta.variables.find((item: any) => matcher.test(String(item.text || item.code || ''))) || null : null;
}
function codeFor(item: any, matcher: RegExp, last = false): string | null {
  const values: string[] = Array.isArray(item?.values) ? item.values : [];
  const texts: string[] = Array.isArray(item?.valueTexts) ? item.valueTexts : [];
  const index = texts.findIndex(text => matcher.test(text));
  if (index >= 0) return values[index] ?? null;
  return values.length ? values[last ? values.length - 1 : 0] : null;
}

export async function queryFinlandBenchmark(municipality: string, fetcher: FetchLike = fetch): Promise<EuropeLandBenchmark | null> {
  const meta = await fetchJson(fetcher, FINLAND_TABLE);
  const region = variable(meta, /region|alue/i); const quarter = variable(meta, /quarter|vuosinelj/i); const info = variable(meta, /information|tiedot/i);
  if (!region || !quarter || !info) return null;
  const metro = /^(helsinki|espoo|vantaa|kauniainen)$/i.test(municipality.trim());
  const regionCode = codeFor(region, metro ? /greater helsinki/i : /^whole country$/i);
  const quarterCode = codeFor(quarter, /$^/, true);
  const priceCode = codeFor(info, /median/i) || codeFor(info, /price per square meter|price per square metre/i);
  if (!regionCode || !quarterCode || !priceCode) return null;
  const body = { query: [
    { code: region.code, selection: { filter: 'item', values: [regionCode] } },
    { code: quarter.code, selection: { filter: 'item', values: [quarterCode] } },
    { code: info.code, selection: { filter: 'item', values: [priceCode] } }
  ], response: { format: 'json-stat2' } };
  const result = await fetchJson(fetcher, FINLAND_TABLE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const price = numeric(Array.isArray(result?.value) ? result.value[0] : result?.value?.['0']);
  if (price === null || price <= 0) return null;
  const index = Array.isArray(quarter.values) ? quarter.values.indexOf(quarterCode) : -1;
  const date = index >= 0 ? quarter.valueTexts?.[index] || quarterCode : quarterCode;
  return {
    countryCode: 'FI', scope: metro ? 'METRO' : 'NATIONAL', label: metro ? 'Greater Helsinki single-family-house plot benchmark' : 'Finland single-family-house plot national benchmark',
    benchmarkPricePerSqm: Math.round(price), lowFactor: metro ? 0.55 : 0.40, highFactor: metro ? 1.65 : 1.90,
    sourceName: FINLAND_SOURCE, sourceUrl: FINLAND_PAGE, datasetDate: String(date), evidenceKind: 'OFFICIAL_TRANSACTION', comparableCount: 0,
    limitation: 'Official plot-price statistic from the National Land Survey real-estate purchase register. It is a statistical benchmark rather than parcel comparables and does not establish planning rights or utilities. Buildings and improvements are excluded.'
  };
}

export function selectIrelandBenchmark(rows: Array<Record<string, string>>, county?: string): EuropeLandBenchmark | null {
  const target = normalize(county).replace(/^county /, '');
  const match = rows.map(row => ({ county: field(row, /county/i), pricePerAcre: numeric(field(row, /median.*price.*acre/i)) }))
    .find(item => item.pricePerAcre !== null && item.pricePerAcre! > 0 && normalize(item.county).replace(/^county /, '') === target);
  if (!match) return null;
  return {
    countryCode: 'IE', scope: 'COUNTY', label: `${match.county} residentially zoned land median`, benchmarkPricePerSqm: Math.round((match.pricePerAcre! / ACRE_M2) * 100) / 100,
    lowFactor: 0.55, highFactor: 1.70, sourceName: IRELAND_SOURCE, sourceUrl: IRELAND_COUNTY_CSV, datasetDate: '2024 (table revised 2026-07-16)', evidenceKind: 'OFFICIAL_TRANSACTION', comparableCount: 0,
    limitation: 'CSO Frontier Series using verified-area residentially zoned land transactions. Some county cells are suppressed and zoning-plan completeness varies. This is a county median, not direct parcel comparables; buildings and improvements are excluded.'
  };
}

async function queryIreland(county: string, fetcher: FetchLike): Promise<EuropeLandValuationEvidence> {
  const csv = await fetchText(fetcher, IRELAND_COUNTY_CSV);
  const countyBenchmark = csv ? selectIrelandBenchmark(parseDelimitedTable(csv), county) : null;
  if (countyBenchmark) return modelled(countyBenchmark);
  return modelled({
    countryCode: 'IE', scope: 'NATIONAL', label: 'Ireland 2024 residentially zoned land national median', benchmarkPricePerSqm: Math.round((231171 / ACRE_M2) * 100) / 100,
    lowFactor: 0.40, highFactor: 2.00, sourceName: IRELAND_SOURCE, sourceUrl: IRELAND_PAGE, datasetDate: '2024 (published 2025-11-05; revised 2026-07-16)', evidenceKind: 'OFFICIAL_TRANSACTION', comparableCount: 0,
    limitation: 'CSO Frontier Series national median from residentially zoned land transactions whose area was verified. Zoning-plan completeness is imperfect and the national fallback is deliberately wide. Buildings and improvements are excluded.'
  });
}

export async function queryEuropeanLandValuationEvidence(countryCode: string, location: { municipality?: string; county?: string; state?: string }, fetcher: FetchLike = fetch): Promise<EuropeLandValuationEvidence | null> {
  const code = countryCode.toUpperCase();
  if (code === 'AT') return modelled(austriaBenchmark());
  if (code === 'ES') return querySpain(location.county || location.municipality || '', location.state || '', fetcher);
  if (code === 'FI') {
    const benchmark = await queryFinlandBenchmark(location.municipality || '', fetcher);
    return benchmark ? modelled(benchmark) : unavailable('FI', FINLAND_SOURCE, FINLAND_PAGE, 'Statistics Finland plot-price data could not be retrieved or validated; no Finnish land value was inferred.');
  }
  if (code === 'IE') return queryIreland(location.county || '', fetcher);
  return null;
}

function removeGenericValuationEvidence(report: VerifiedSiteReport): void {
  report.evidenceRegistry = report.evidenceRegistry.filter(record => record.id !== 'valuation-indicative-model');
}

function clearValuation(report: VerifiedSiteReport, reason: string): void {
  removeGenericValuationEvidence(report);
  report.valuation = {
    ...(report.valuation || {}), status: 'REQUIRES_VERIFICATION', indicativeMinPrice: Number.NaN, indicativeMaxPrice: Number.NaN,
    indicativeMedianPrice: Number.NaN, indicativePricePerSqm: Number.NaN, currency: report.valuation?.currency || 'EUR', comparableEvidenceCount: 0,
    methodology: `${report.countryCode} land value withheld: ${reason}. No generic European land-price fallback is used.`,
    marketTrendDescription: 'No automated land value is presented without a calibrated country-specific land-price benchmark.',
    priceDrivers: [], uncertaintyRating: 'High',
    disclaimer: 'LAND VALUE ONLY. Buildings, structures and other improvements are excluded. This is not a certified property appraisal.'
  };
}

export function enrichEuropeanLandValuation(report: VerifiedSiteReport, evidence: EuropeLandValuationEvidence | null): void {
  if (!evidence || evidence.status !== 'MODELLED' || !evidence.value || !('benchmarkPricePerSqm' in evidence.value)) {
    clearValuation(report, evidence?.claim || 'country-specific land-price evidence was unavailable');
    return;
  }
  const benchmark = evidence.value as EuropeLandBenchmark;
  const area = finite(report.parcel?.officialAreaM2) ?? finite(report.parcel?.areaCalculatedM2);
  if (area === null || area <= 0) { clearValuation(report, 'parcel area was unavailable'); return; }
  removeGenericValuationEvidence(report);
  let adjustment = 1;
  const slope = finite(report.terrain?.averageSlopeDegrees); const road = finite(report.infrastructure?.roadAccess?.estimatedDistanceM); const direct = Boolean(report.infrastructure?.roadAccess?.directAccessVerified);
  if (slope !== null && slope > 10) adjustment *= 0.88;
  if (road !== null && !direct && road > 50) adjustment *= 0.82;
  adjustment *= area > 2500 ? 0.90 : area < 750 ? 1.10 : 1;
  const median = Math.max(1, Math.round(benchmark.benchmarkPricePerSqm * adjustment));
  const min = Math.max(1, Math.round(median * benchmark.lowFactor)); const max = Math.max(min, Math.round(median * benchmark.highFactor));
  report.valuation = {
    ...(report.valuation || {}), status: 'MODELLED', indicativeMinPrice: Math.round(min * area), indicativeMaxPrice: Math.round(max * area), indicativeMedianPrice: Math.round(median * area), indicativePricePerSqm: median,
    currency: 'EUR', comparableEvidenceCount: 0,
    methodology: `Indicative land-only screening from ${benchmark.label} (${benchmark.benchmarkPricePerSqm} €/m² source benchmark), followed by parcel-size${slope !== null ? ', slope' : ''}${road !== null ? ' and mapped road-access' : ''} adjustments. Evidence class: ${benchmark.evidenceKind}. No direct parcel comparable deeds were queried.`,
    marketTrendDescription: `${benchmark.scope.toLowerCase()} benchmark; final screening range ${min}–${max} €/m². ${benchmark.limitation}`,
    priceDrivers: [
      { factor: 'Land-price benchmark', impact: `${benchmark.benchmarkPricePerSqm} €/m² (${benchmark.scope.toLowerCase()})`, weight: 'High' },
      { factor: 'Planning / buildability evidence', impact: 'Not established by the benchmark; requires authoritative local verification', weight: 'High' },
      { factor: 'Road proximity & access', impact: road !== null && !direct && road > 50 ? '-18% screening adjustment' : 'No adverse screening adjustment applied', weight: 'Medium' },
      { factor: 'Terrain topography', impact: slope !== null && slope > 10 ? '-12% screening adjustment' : 'No adverse screening adjustment applied', weight: 'Medium' },
      { factor: 'Parcel area', impact: area > 2500 ? '-10% scale adjustment' : area < 750 ? '+10% scale adjustment' : 'Standard', weight: 'Low' }
    ], uncertaintyRating: 'High', disclaimer: `INDICATIVE LAND VALUE ONLY. ${benchmark.limitation} This is not a certified property appraisal.`
  };
  const source = report.dataSourcesCited?.find(item => item.type === 'Statistical Market Benchmark');
  if (source) { source.name = benchmark.sourceName; source.organization = benchmark.sourceName.split('·')[0].trim(); source.url = benchmark.sourceUrl; source.status = 'MODELLED'; }
  if (report.evidenceScore?.breakdown?.planningAndMarket) {
    report.evidenceScore.breakdown.planningAndMarket.score = benchmark.scope === 'NATIONAL' ? 3 : 5;
    report.evidenceScore.breakdown.planningAndMarket.rationale = `${benchmark.scope} land-price evidence supports a screening benchmark; binding planning rights and parcel-specific comparables remain unverified.`;
  }
}
