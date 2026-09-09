import { inflateRawSync } from 'node:zlib';
import { EvidenceItem } from '../types';

type FetchLike = typeof fetch;
type SheetRows = Array<Array<string | number | null>>;

type LocalAuthority = { code: string; name: string };

export interface EnglandLandBenchmark {
  localAuthorityCode: string;
  localAuthorityName: string;
  landValuePerHa: number;
  benchmarkPricePerSqm: number;
  lowFactor: number;
  highFactor: number;
  sourceName: string;
  sourceUrl: string;
  datasetYear: string;
  publishedDate: string;
}

const ONS_LAD_QUERY = 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Local_Authority_Districts_December_2024_Boundaries_UK_BGC/FeatureServer/0/query';
const MHCLG_XLSX = 'https://assets.publishing.service.gov.uk/media/69b2d95f912f3f96bf687b1c/Land_value_estimates_for_policy_appraisal_2023.xlsx';
const MHCLG_PAGE = 'https://www.gov.uk/government/publications/land-value-estimates-for-policy-appraisal-2023';
const MHCLG_SOURCE = 'MHCLG Land value estimates for policy appraisal 2023';
const CACHE_MS = 12 * 60 * 60 * 1000;
let workbookCache: { expires: number; rows: SheetRows } | null = null;

const today = () => new Date().toISOString().slice(0, 10);
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const clean = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, ' ');
const normalize = (value: unknown): string => clean(value)
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\b(city|borough|district|council|metropolitan|london borough) of\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function decodeXml(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function unzipEntries(buffer: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = Math.max(0, buffer.length - 65557); i <= buffer.length - 22; i++) {
    if (buffer.readUInt32LE(i) === 0x06054b50) eocd = i;
  }
  if (eocd < 0) throw new Error('XLSX ZIP directory not found');
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < entries; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Malformed XLSX central directory');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLen).toString('utf8');
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Malformed XLSX local header');
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) out.set(name, Buffer.from(raw));
    else if (method === 8) out.set(name, inflateRawSync(raw));
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function sharedStrings(xml: string): string[] {
  const result: string[] = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const parts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(item => decodeXml(item[1]));
    result.push(parts.join(''));
  }
  return result;
}

function columnIndex(reference: string): number {
  const letters = (reference.match(/^[A-Z]+/i)?.[0] || 'A').toUpperCase();
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

function parseSheet(xml: string, strings: string[]): SheetRows {
  const rows: SheetRows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: Array<string | number | null> = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br=["']([^"']+)["']/)?.[1] || 'A1';
      const idx = columnIndex(ref);
      const type = attrs.match(/\bt=["']([^"']+)["']/)?.[1] || '';
      let value: string | number | null = null;
      if (type === 'inlineStr') {
        value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(item => decodeXml(item[1])).join('');
      } else {
        const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        if (raw !== undefined) {
          if (type === 's') value = strings[Number(raw)] ?? '';
          else if (type === 'str') value = decodeXml(raw);
          else { const number = Number(raw); value = Number.isFinite(number) ? number : decodeXml(raw); }
        }
      }
      row[idx] = value;
    }
    if (row.some(value => value !== null && value !== undefined && value !== '')) rows.push(row);
  }
  return rows;
}

export function parseMhclgWorkbook(buffer: Buffer): SheetRows {
  const files = unzipEntries(buffer);
  const strings = files.has('xl/sharedStrings.xml') ? sharedStrings(files.get('xl/sharedStrings.xml')!.toString('utf8')) : [];
  const allRows: SheetRows = [];
  for (const [name, data] of files) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(name)) allRows.push(...parseSheet(data.toString('utf8'), strings));
  }
  return allRows;
}

function headerText(rows: SheetRows, rowIndex: number, colIndex: number): string {
  const values: string[] = [];
  for (let i = Math.max(0, rowIndex - 10); i < rowIndex; i++) {
    const value = clean(rows[i]?.[colIndex]);
    if (value) values.push(value);
  }
  return values.join(' | ');
}

export function selectEnglandResidentialLandValue(rows: SheetRows, localAuthorityName: string): number | null {
  const target = normalize(localAuthorityName);
  let best: { value: number; score: number } | null = null;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row.some(cell => normalize(cell) === target)) continue;
    for (let c = 0; c < row.length; c++) {
      const raw = finite(row[c]);
      if (raw === null || raw <= 0) continue;
      const header = headerText(rows, r, c).toLowerCase();
      let value = raw;
      if (value < 1000 && /(million|£m|gbp\s*m)/i.test(header)) value *= 1_000_000;
      if (value < 10_000 || value > 500_000_000) continue;
      let score = 0;
      if (/residential|housing/.test(header)) score += 6;
      if (/land value|site value|value/.test(header)) score += 4;
      if (/central|mid|typical|average/.test(header)) score += 3;
      if (/hectare|£\/ha|per ha/.test(header)) score += 3;
      if (/density|dwellings|units|floor|agric|industrial|office|retail/.test(header)) score -= 7;
      if (!best || score > best.score) best = { value, score };
    }
  }
  return best && best.score >= 4 ? Math.round(best.value) : null;
}

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs: number): Promise<any | null> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { const response = await fetcher(url, { headers: { 'User-Agent': 'GeoSurvey/1.0 UK land valuation', Accept: 'application/json' }, signal: controller.signal }); return response.ok ? await response.json() : null; }
  catch { return null; } finally { clearTimeout(timer); }
}

async function resolveLocalAuthority(lat: number, lng: number, fetcher: FetchLike): Promise<LocalAuthority | null> {
  const params = new URLSearchParams({
    where: '1=1', geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
    outFields: 'LAD24CD,LAD24NM', returnGeometry: 'false', f: 'json'
  });
  const data = await fetchJson(fetcher, `${ONS_LAD_QUERY}?${params}`, 5000);
  const attrs = data?.features?.[0]?.attributes;
  const code = clean(attrs?.LAD24CD); const name = clean(attrs?.LAD24NM);
  return code && name ? { code, name } : null;
}

async function loadWorkbookRows(fetcher: FetchLike): Promise<SheetRows | null> {
  if (workbookCache && workbookCache.expires > Date.now()) return workbookCache.rows;
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetcher(MHCLG_XLSX, { headers: { 'User-Agent': 'GeoSurvey/1.0 UK land valuation', Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, signal: controller.signal });
    if (!response.ok) return null;
    const rows = parseMhclgWorkbook(Buffer.from(await response.arrayBuffer()));
    workbookCache = { expires: Date.now() + CACHE_MS, rows };
    return rows;
  } catch { return null; } finally { clearTimeout(timer); }
}

export async function queryUKLandValuationEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<EvidenceItem> {
  const authority = await resolveLocalAuthority(lat, lng, fetcher);
  if (!authority) return {
    id: 'uk-mhclg-land-valuation-unavailable', category: 'Land market valuation', claim: 'ONS local-authority resolution failed, so no UK land value was inferred.',
    status: 'REQUIRES_VERIFICATION', sourceName: MHCLG_SOURCE, sourceUrl: MHCLG_PAGE, datasetDate: today(), spatialRelationship: 'Selected site coordinate',
    calculationMethod: 'ONS LAD point lookup followed by MHCLG residential land benchmark lookup', confidence: 'Low', limitation: 'No automated land value is shown when the administrative area cannot be resolved.', value: { reasonCode: 'SOURCE_UNAVAILABLE' }
  };
  if (!authority.code.startsWith('E')) return {
    id: 'uk-mhclg-land-valuation-coverage-excluded', category: 'Land market valuation', claim: `${authority.name} is outside England; the MHCLG 2023 land-value dataset does not cover this part of the UK, so no automated land value was inferred.`,
    status: 'REQUIRES_VERIFICATION', sourceName: MHCLG_SOURCE, sourceUrl: MHCLG_PAGE, datasetDate: today(), spatialRelationship: `${authority.name} (${authority.code})`,
    calculationMethod: 'ONS LAD national coverage gate', confidence: 'High', limitation: 'England-only benchmark. Scotland, Wales and Northern Ireland require their own land-specific evidence; no English fallback is substituted.', value: { reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY', authority }
  };
  const rows = await loadWorkbookRows(fetcher);
  if (!rows) return {
    id: 'uk-mhclg-land-valuation-unavailable', category: 'Land market valuation', claim: 'The official MHCLG land-value workbook could not be retrieved or parsed, so no automated land value was inferred.',
    status: 'REQUIRES_VERIFICATION', sourceName: MHCLG_SOURCE, sourceUrl: MHCLG_PAGE, datasetDate: today(), spatialRelationship: `${authority.name} (${authority.code})`,
    calculationMethod: 'Official MHCLG XLSX acquisition and local-authority benchmark extraction', confidence: 'Low', limitation: 'Source failure is not evidence that the land has no value. The old generic £195/m² fallback is not used.', value: { reasonCode: 'SOURCE_UNAVAILABLE', authority }
  };
  const perHa = selectEnglandResidentialLandValue(rows, authority.name);
  if (!perHa) return {
    id: 'uk-mhclg-land-valuation-no-data', category: 'Land market valuation', claim: `The MHCLG workbook was read but a defensible central residential land benchmark could not be matched for ${authority.name}.`,
    status: 'REQUIRES_VERIFICATION', sourceName: MHCLG_SOURCE, sourceUrl: MHCLG_PAGE, datasetDate: today(), spatialRelationship: `${authority.name} (${authority.code})`,
    calculationMethod: 'Local-authority name match plus central residential £/ha column detection', confidence: 'Low', limitation: 'No generic UK fallback is substituted when the local benchmark cannot be resolved.', value: { reasonCode: 'NO_DATA', authority }
  };
  const benchmark: EnglandLandBenchmark = {
    localAuthorityCode: authority.code, localAuthorityName: authority.name, landValuePerHa: perHa, benchmarkPricePerSqm: perHa / 10000,
    lowFactor: 0.45, highFactor: 1.75, sourceName: MHCLG_SOURCE, sourceUrl: MHCLG_PAGE, datasetYear: '2023', publishedDate: '2026-03-16'
  };
  return {
    id: 'uk-mhclg-land-valuation', category: 'Land market valuation', claim: `MHCLG's 2023 policy-appraisal model gives a central residential land benchmark of approximately £${Math.round(benchmark.benchmarkPricePerSqm).toLocaleString('en-GB')}/m² for ${authority.name}.`,
    status: 'MODELLED', sourceName: MHCLG_SOURCE, sourceUrl: MHCLG_PAGE, datasetDate: '2026-03-16', spatialRelationship: `Local authority ${authority.name} (${authority.code})`,
    calculationMethod: 'Official MHCLG residential land-value estimate for a typical 1 ha serviced site, converted from £/ha to £/m²', confidence: 'Low',
    limitation: 'Policy-appraisal benchmark, not a market valuation. MHCLG assumes a serviced site with planning permission and other standard conditions; those assumptions are NOT evidence that the selected parcel has equivalent planning rights or servicing. Buildings and improvements are excluded.', value: benchmark
  };
}

function clearUKValuation(report: any, reason: string): void {
  report.valuation = { ...(report.valuation || {}), status: 'REQUIRES_VERIFICATION', indicativeMinPrice: Number.NaN, indicativeMaxPrice: Number.NaN, indicativeMedianPrice: Number.NaN, indicativePricePerSqm: Number.NaN, currency: 'GBP', comparableEvidenceCount: 0, methodology: `UK land value withheld: ${reason}. No generic £/m² fallback is used.`, marketTrendDescription: 'No automated UK land value is presented without an applicable England MHCLG benchmark.', uncertaintyRating: 'High', disclaimer: 'LAND VALUE ONLY. Buildings, structures and other improvements are excluded. This is not a certified property appraisal.' };
}

export function enrichUKValuationFromEvidence(report: any, evidence: EvidenceItem): void {
  if (evidence.status !== 'MODELLED' || evidence.id !== 'uk-mhclg-land-valuation') {
    clearUKValuation(report, evidence.claim);
    return;
  }
  const benchmark = evidence.value as EnglandLandBenchmark;
  const areaM2 = finite(report.parcel?.officialAreaM2) ?? finite(report.parcel?.areaCalculatedM2);
  if (!areaM2 || areaM2 <= 0) { clearUKValuation(report, 'parcel area was unavailable'); return; }
  let adjustment = 1;
  const slope = finite(report.terrain?.averageSlopeDegrees);
  const roadDistance = finite(report.infrastructure?.roadAccess?.estimatedDistanceM);
  const directRoad = Boolean(report.infrastructure?.roadAccess?.directAccessVerified);
  if (slope !== null && slope > 10) adjustment *= 0.88;
  if (roadDistance !== null && !directRoad && roadDistance > 50) adjustment *= 0.82;
  adjustment *= areaM2 > 2500 ? 0.90 : areaM2 < 750 ? 1.10 : 1;
  const unitMedian = Math.max(1, Math.round(benchmark.benchmarkPricePerSqm * adjustment));
  const unitMin = Math.max(1, Math.round(unitMedian * benchmark.lowFactor));
  const unitMax = Math.max(unitMin, Math.round(unitMedian * benchmark.highFactor));
  report.valuation = {
    ...(report.valuation || {}), status: 'MODELLED', indicativeMinPrice: Math.round(unitMin * areaM2), indicativeMaxPrice: Math.round(unitMax * areaM2), indicativeMedianPrice: Math.round(unitMedian * areaM2), indicativePricePerSqm: unitMedian, currency: 'GBP', comparableEvidenceCount: 0,
    methodology: `Indicative land-only screening benchmark from MHCLG's 2023 residential land estimate for ${benchmark.localAuthorityName}: £${Math.round(benchmark.benchmarkPricePerSqm)}/m² before parcel-size, terrain and mapped road-access screening adjustments. This is a policy-appraisal residual land model, not completed-sale comparable evidence.`,
    marketTrendDescription: `MHCLG policy-appraisal benchmark published 16 March 2026; screening range ${unitMin.toLocaleString('en-GB')}–${unitMax.toLocaleString('en-GB')} £/m².`,
    priceDrivers: [
      { factor: 'MHCLG local-authority residential land benchmark', impact: `£${Math.round(benchmark.benchmarkPricePerSqm)}/m² (${benchmark.localAuthorityName})`, weight: 'High' },
      { factor: 'Planning / servicing assumptions', impact: 'Not verified — MHCLG benchmark assumes planning permission and a serviced typical site', weight: 'High' },
      { factor: 'Road proximity & access', impact: roadDistance !== null && !directRoad && roadDistance > 50 ? '-18% screening adjustment' : 'No adverse screening adjustment applied', weight: 'Medium' },
      { factor: 'Terrain topography', impact: slope !== null && slope > 10 ? '-12% screening adjustment' : 'No adverse screening adjustment applied', weight: 'Medium' },
      { factor: 'Parcel area', impact: areaM2 > 2500 ? '-10% scale adjustment' : areaM2 < 750 ? '+10% scale adjustment' : 'Standard', weight: 'Low' }
    ], uncertaintyRating: 'High', disclaimer: 'INDICATIVE LAND VALUE ONLY. Buildings, structures and other improvements are excluded. MHCLG values are policy-appraisal estimates rather than market valuations and assume a serviced site with planning permission; those assumptions must be independently verified for the selected parcel.'
  };
  const modelEvidence = report.evidenceRegistry?.find((item: any) => item.id === 'valuation-indicative-model');
  if (modelEvidence) Object.assign(modelEvidence, { claim: evidence.claim, status: 'MODELLED', sourceName: evidence.sourceName, sourceUrl: evidence.sourceUrl, datasetDate: evidence.datasetDate, spatialRelationship: evidence.spatialRelationship, calculationMethod: evidence.calculationMethod, confidence: evidence.confidence, limitation: evidence.limitation, value: benchmark });
}
