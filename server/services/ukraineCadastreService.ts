import type { EvidenceItem } from '../types';

type FetchLike = typeof fetch;

export interface UkraineCadastreParcel {
  parcelId: string;
  areaM2: number | null;
  geometryPoints?: [number, number][];
  category?: string | null;
  purpose?: string | null;
}

export interface UkraineCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  parcel?: UkraineCadastreParcel;
  evidence: EvidenceItem[];
  limitation: string;
}

export const UKRAINE_CADASTRE_API = 'https://nsdi.gov.ua/api/v2/geo/parcel';
export const UKRAINE_CADASTRE_PORTAL = 'https://nsdi.gov.ua/';
const SOURCE_NAME = 'Національний геопортал України / Держгеокадастр — інформація про земельну ділянку';
const today = () => new Date().toISOString().slice(0, 10);

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 9000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json', 'User-Agent': 'GroundSurf/1.0 Ukraine cadastral evidence' }, signal: controller.signal });
    if (!response.ok) return null;
    const json = await response.json();
    return json && typeof json === 'object' ? json : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim().replace(/\s+/g, ' ');
  return cleaned || null;
}

function outerRing(geometry: any): [number, number][] | undefined {
  if (!geometry) return undefined;
  let ring: any[] | undefined;
  if (geometry.type === 'Polygon') ring = geometry.coordinates?.[0];
  if (geometry.type === 'MultiPolygon') ring = geometry.coordinates?.[0]?.[0];
  if (!Array.isArray(ring)) return undefined;
  const points = ring.map((pair: any) => {
    const lng = Number(pair?.[0]); const lat = Number(pair?.[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] as [number, number] : null;
  }).filter((p: [number, number] | null): p is [number, number] => Boolean(p));
  return points.length >= 3 ? points : undefined;
}

function unavailable(reasonCode: UkraineCadastreResult['reasonCode'], claim: string): UkraineCadastreResult {
  const evidence: EvidenceItem = {
    id: 'ua-nsdi-cadastre', category: 'Cadastre & identification', claim, status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE_NAME, sourceUrl: UKRAINE_CADASTRE_API, datasetDate: today(), spatialRelationship: 'Selected site coordinate',
    calculationMethod: 'Ukraine NSDI public parcel API query by WGS84 coordinates', confidence: 'Low',
    limitation: 'The Ukrainian NSDI parcel endpoint is public but rate-limited. An empty or failed query cannot be interpreted as proof that a parcel is absent; the official cadastral map and competent records remain the reference for verification.',
    value: { reasonCode }
  };
  return { success: false, reasonCode, sourceName: SOURCE_NAME, sourceUrl: UKRAINE_CADASTRE_API, datasetDate: today(), evidence: [evidence], limitation: evidence.limitation };
}

export async function queryUkraineCadastre(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<UkraineCadastreResult> {
  const url = `${UKRAINE_CADASTRE_API}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
  const response = await fetchJson(fetcher, url);
  if (!response) return unavailable('SOURCE_UNAVAILABLE', 'The Ukrainian NSDI parcel service could not be reached or did not return valid JSON.');
  if (!response.cadnum) return unavailable('NO_DATA', 'The Ukrainian NSDI parcel service returned no cadastral parcel for the selected coordinate.');

  const areaHa = Number(response.area);
  const areaM2 = Number.isFinite(areaHa) ? areaHa * 10000 : null;
  const points = outerRing(response.geom);
  const parcel: UkraineCadastreParcel = {
    parcelId: text(response.cadnum) || 'unknown', areaM2, geometryPoints: points,
    category: text(response.category), purpose: text(response.purpose)
  };
  const evidence: EvidenceItem = {
    id: 'ua-nsdi-cadastre', category: 'Cadastre & identification',
    claim: `Український національний геопортал ідентифікував кадастрову ділянку ${parcel.parcelId}${areaM2 !== null ? ` із зареєстрованою площею ${areaM2.toLocaleString('uk-UA')} м²` : ''}.`,
    status: 'VERIFIED', sourceName: SOURCE_NAME, sourceUrl: url, datasetDate: today(),
    spatialRelationship: points?.length ? 'Official parcel geometry returned for the selected coordinate' : 'Official parcel record returned for the selected coordinate',
    calculationMethod: 'Ukraine NSDI /geo/parcel public API query by WGS84 coordinates', confidence: points?.length ? 'High' : 'Medium',
    value: { parcelId: parcel.parcelId, areaM2, category: parcel.category, purpose: parcel.purpose, geometryPointCount: points?.length || 0 },
    limitation: 'The returned parcel is official cadastral information, but ownership, encumbrances and legal boundary conclusiveness require the competent cadastral and land-register records.'
  };
  return { success: true, sourceName: SOURCE_NAME, sourceUrl: url, datasetDate: today(), parcel, evidence: [evidence], limitation: evidence.limitation };
}

export function applyUkraineCadastreToReport(report: any, result: UkraineCadastreResult, fallbackAreaM2?: number): void {
  if (!report || !result?.success || !result.parcel) {
    if (result?.evidence?.length) report?.evidenceRegistry?.push(...result.evidence);
    return;
  }
  const parcel = result.parcel;
  report.parcel = {
    ...(report.parcel || {}), status: 'VERIFIED', isOfficialGeometry: Boolean(parcel.geometryPoints?.length),
    parcelId: parcel.parcelId, officialAreaM2: parcel.areaM2 ?? report.parcel?.officialAreaM2 ?? fallbackAreaM2 ?? null,
    areaCalculatedM2: report.parcel?.areaCalculatedM2 ?? fallbackAreaM2 ?? null, geometryPoints: parcel.geometryPoints,
    cadastralSource: SOURCE_NAME
  };
  report.evidenceRegistry.push(...result.evidence);
}
