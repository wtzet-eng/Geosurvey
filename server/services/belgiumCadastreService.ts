import type { EvidenceItem, VerifiedSiteReport } from '../types';

type FetchLike = typeof fetch;
const WMS = 'https://ccff02.minfin.fgov.be/geoservices/arcgis/services/INSPIRE/CP/MapServer/WmsServer';
const PORTAL = 'https://financien.belgium.be/nl/E-services/cadgis';
const SOURCE = 'FPS Finance / General Administration of Patrimonial Documentation (GAPD) — INSPIRE Cadastral Parcels';
const LIMITATION = 'The federal cadastral service identifies a mapped cadastral parcel and registered area at the selected coordinate. It does not establish ownership, title rights, easements, encumbrances or a legally surveyed boundary; verify those in the competent cadastral and legal records.';
const today = () => new Date().toISOString().slice(0, 10);

export interface BelgiumCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
  sourceName: string;
  sourceUrl: string;
  evidence: EvidenceItem[];
  parcel?: {
    parcelId: string;
    label: string | null;
    officialAreaM2: number | null;
    datasetVersion: string | null;
    zoningCode: string | null;
    administrativeUnit: string | null;
  };
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() && !/^(null|none|n\/a)$/i.test(v.trim()) ? v.trim() : null;
}
function numberValue(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return null;
  const n = Number(v.trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function queryUrl(lat: number, lng: number): string {
  const d = 0.00012;
  const params = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetFeatureInfo',
    LAYERS: 'Cadastral_Parcel', QUERY_LAYERS: 'Cadastral_Parcel', SRS: 'EPSG:4326',
    BBOX: `${lng-d},${lat-d},${lng+d},${lat+d}`, WIDTH: '201', HEIGHT: '201', X: '100', Y: '100',
    INFO_FORMAT: 'application/geo+json', FEATURE_COUNT: '1'
  });
  return `${WMS}?${params}`;
}
async function fetchFeature(lat: number, lng: number, fetcher: FetchLike): Promise<any | null> {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const response = await fetcher(queryUrl(lat, lng), { headers: { Accept: 'application/geo+json,application/json', 'User-Agent': 'LandSurf/1.0 Belgium cadastre' }, signal: ctrl.signal });
    if (!response.ok) return null;
    const body: any = await response.json();
    return Array.isArray(body?.features) ? body.features[0] || false : null;
  } catch { return null; } finally { clearTimeout(timer); }
}
function unavailable(reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA', claim: string): BelgiumCadastreResult {
  return { success: false, reasonCode, sourceName: SOURCE, sourceUrl: PORTAL, evidence: [{
    id: 'be-gapd-cadastre-unavailable', category: 'Cadastre & identification', claim, status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE, sourceUrl: WMS, datasetDate: today(), spatialRelationship: 'Selected site coordinate',
    calculationMethod: 'Federal INSPIRE cadastral WMS GetFeatureInfo query with fail-closed validation', confidence: 'Low', limitation: LIMITATION, value: { reasonCode }
  }] };
}

export async function queryBelgiumCadastre(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<BelgiumCadastreResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 49.45 || lat > 51.60 || lng < 2.45 || lng > 6.45) {
    return unavailable('NO_DATA', 'The coordinate is outside expected Belgian cadastral coverage.');
  }
  const feature = await fetchFeature(lat, lng, fetcher);
  if (feature === null) return unavailable('SOURCE_UNAVAILABLE', 'The Belgian federal cadastral service could not be queried reliably.');
  if (feature === false) return unavailable('NO_DATA', 'The federal cadastral service returned no parcel at the selected coordinate.');
  const a = feature.properties || {};
  const parcelId = text(a.nationalCadastralReference) || text(a.inspireId_localId);
  if (!parcelId) return unavailable('MALFORMED_DATA', 'The cadastral service returned a feature without a usable national cadastral reference.');
  const parcel = {
    parcelId,
    label: text(a.label),
    officialAreaM2: numberValue(a.areaValue),
    datasetVersion: text(a.inspireId_versionId),
    zoningCode: text(a.zoning),
    administrativeUnit: text(a.administrativeUnit)
  };
  return { success: true, sourceName: SOURCE, sourceUrl: PORTAL, parcel, evidence: [{
    id: 'be-gapd-cadastre', category: 'Cadastre & identification',
    claim: `Belgian federal cadastral mapping identifies parcel ${parcelId}${parcel.officialAreaM2 ? ` with registered area approximately ${Math.round(parcel.officialAreaM2).toLocaleString('en')} m²` : ''}.`,
    status: 'VERIFIED', sourceName: SOURCE, sourceUrl: WMS, datasetDate: parcel.datasetVersion || today(),
    spatialRelationship: 'Federal cadastral feature returned at the selected coordinate',
    calculationMethod: 'FPS Finance INSPIRE Cadastral_Parcel WMS GetFeatureInfo query in EPSG:4326', confidence: 'High', limitation: LIMITATION, value: parcel
  }] };
}

export function applyBelgiumCadastreToReport(report: VerifiedSiteReport & Record<string, any>, result: BelgiumCadastreResult, requestedAreaM2: number): void {
  report.evidenceRegistry = Array.isArray(report.evidenceRegistry) ? report.evidenceRegistry.filter(item => !/cadastre-spatial-index|cadastre-parcel-id/.test(item.id)) : [];
  report.evidenceRegistry.push(...result.evidence);
  if (!result.parcel) return;
  report.parcel = {
    ...report.parcel, status: 'VERIFIED', parcelId: result.parcel.parcelId, countryCode: 'BE', areaCalculatedM2: requestedAreaM2,
    officialAreaM2: result.parcel.officialAreaM2 ?? undefined, isOfficialGeometry: false, cadastralSource: SOURCE,
    datasetDate: result.parcel.datasetVersion || today(), limitation: LIMITATION
  };
  report.belgium_cadastre = result.parcel;
}
