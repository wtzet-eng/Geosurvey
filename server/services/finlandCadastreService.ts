import { EvidenceItem } from '../types';

export interface FinlandCadastreParcel {
  localId: string | null;
  parcelId: string;
  nationalCadastralReference: string | null;
  beginLifespanVersion: string | null;
  geometryPoints?: [number, number][];
  referencePoint?: [number, number];
}

export interface FinlandCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  parcel?: FinlandCadastreParcel;
  geometryPoints?: [number, number][];
  evidence: EvidenceItem[];
  limitation: string;
}

type FetchLike = typeof fetch;

const SOURCE_NAME = 'National Land Survey of Finland — INSPIRE Cadastral Parcels';
const WFS_URL = 'https://inspire-wfs.maanmittauslaitos.fi/inspire-wfs/cp/ows';
const WMS_URL = 'https://inspire-wms.maanmittauslaitos.fi/inspire-wms/CP/ows';
const PORTAL = 'https://www.maanmittauslaitos.fi/en/maps-and-spatial-data/expert-users/kartta-ja-paikkatietojen-rajapintapalvelut/inspire-directive';
const today = () => new Date().toISOString().slice(0, 10);

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 9000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/geo+json, application/json', 'User-Agent': 'GroundSurf/1.0 Finland cadastral evidence' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json && typeof json === 'object' ? json : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return value === null || value === undefined ? null : String(value);
  const cleaned = value.trim().replace(/\\s+/g, ' ');
  return cleaned || null;
}

function firstOuterRing(geometry: any): [number, number][] | undefined {
  if (!geometry) return undefined;
  let ring: any[] | undefined;
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates?.[0])) ring = geometry.coordinates[0];
  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates?.[0]?.[0])) ring = geometry.coordinates[0][0];
  if (!ring) return undefined;
  const points = ring.map((pair: any) => {
    const lng = Number(pair?.[0]);
    const lat = Number(pair?.[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] as [number, number] : null;
  }).filter((p: [number, number] | null): p is [number, number] => Boolean(p));
  return points.length >= 3 ? points : undefined;
}

function pointInRing(point: [number, number], ring: [number, number][]): boolean {
  const [lat, lng] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lngI] = ring[i];
    const [latJ, lngJ] = ring[j];
    const crosses = ((lngI > lng) !== (lngJ > lng)) &&
      (lat < (latJ - latI) * (lng - lngI) / ((lngJ - lngI) || Number.EPSILON) + latI);
    if (crosses) inside = !inside;
  }
  return inside;
}

function centroid(points: [number, number][]): [number, number] {
  const sum = points.reduce((acc, [lat, lng]) => [acc[0] + lat, acc[1] + lng], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

function distanceSq(a: [number, number], b: [number, number]): number {
  const dLat = a[0] - b[0];
  const dLng = a[1] - b[1];
  return dLat * dLat + dLng * dLng;
}

function queryUrl(lat: number, lng: number): string {
  const delta = 0.001;
  const params = new URLSearchParams({
    SERVICE: 'WFS',
    VERSION: '2.0.0',
    REQUEST: 'GetFeature',
    TYPENAMES: 'CP:CadastralParcel',
    SRSNAME: 'EPSG:4326',
    OUTPUTFORMAT: 'application/json',
    COUNT: '50',
    BBOX: `${(lng - delta).toFixed(6)},${(lat - delta).toFixed(6)},${(lng + delta).toFixed(6)},${(lat + delta).toFixed(6)},EPSG:4326`
  });
  return `${WFS_URL}?${params.toString()}`;
}

function unavailable(reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA', claim: string): FinlandCadastreResult {
  const evidence: EvidenceItem = {
    id: 'fi-nls-cadastre-unavailable',
    category: 'Cadastre & identification',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE_NAME,
    sourceUrl: WFS_URL,
    datasetDate: today(),
    spatialRelationship: 'Selected site coordinate',
    calculationMethod: 'National Land Survey INSPIRE Cadastral Parcel WFS point-envelope query in EPSG:4326',
    confidence: 'Low',
    limitation: 'An empty or failed WFS query is not evidence that no cadastral parcel exists. The INSPIRE parcel dataset is an official cadastral map source, but legal boundary conclusiveness still depends on cadastral survey documents and the terrain.',
    value: { reasonCode }
  };
  return { success: false, reasonCode, sourceName: SOURCE_NAME, sourceUrl: WFS_URL, datasetDate: today(), evidence: [evidence], limitation: evidence.limitation };
}

export async function queryFinlandCadastre(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<FinlandCadastreResult> {
  const url = queryUrl(lat, lng);
  const response = await fetchJson(fetcher, url);
  if (!response) return unavailable('SOURCE_UNAVAILABLE', 'The National Land Survey INSPIRE cadastral service could not be reached or did not return valid JSON.');
  if (!Array.isArray(response.features)) return unavailable('MALFORMED_DATA', 'The National Land Survey cadastral response did not contain the expected feature collection.');
  if (!response.features.length) return unavailable('NO_DATA', 'The National Land Survey cadastral service returned no parcel polygon in the immediate search envelope.');

  const site: [number, number] = [lat, lng];
  const candidates = response.features.map((feature: any) => {
    const ring = firstOuterRing(feature?.geometry);
    const rp = Array.isArray(feature?.properties?.referencePoint?.coordinates)
      ? [Number(feature.properties.referencePoint.coordinates[1]), Number(feature.properties.referencePoint.coordinates[0])] as [number, number]
      : undefined;
    return {
      feature,
      ring,
      referencePoint: rp,
      contains: Boolean(ring && pointInRing(site, ring))
    };
  });

  const selected = candidates.find((candidate) => candidate.contains)
    || candidates
      .filter((candidate) => candidate.referencePoint)
      .sort((a, b) => distanceSq(site, a.referencePoint!) - distanceSq(site, b.referencePoint!))[0]
    || candidates[0];

  const properties = selected.feature?.properties || {};
  const localId = text(properties?.inspireId?.localId) || text(properties?.identifier?.value)?.split('/').pop() || text(selected.feature?.id);
  const parcelId = text(properties?.label);
  if (!parcelId) return unavailable('MALFORMED_DATA', 'The National Land Survey parcel feature was returned without its cadastral parcel label.');

  const parcel: FinlandCadastreParcel = {
    localId,
    parcelId,
    nationalCadastralReference: text(properties?.nationalCadastralReference),
    beginLifespanVersion: text(properties?.beginLifespanVersion),
    geometryPoints: selected.ring,
    referencePoint: selected.referencePoint
  };

  const geometryPoints = parcel.geometryPoints;
  const evidence: EvidenceItem = {
    id: 'fi-nls-cadastre',
    category: 'Cadastre & identification',
    claim: `The National Land Survey INSPIRE cadastral parcel service identifies parcel ${parcel.parcelId}${parcel.nationalCadastralReference ? ` (national cadastral reference ${parcel.nationalCadastralReference})` : ''} at the selected location.`,
    status: 'VERIFIED',
    sourceName: SOURCE_NAME,
    sourceUrl: url,
    datasetDate: parcel.beginLifespanVersion ? parcel.beginLifespanVersion.slice(0, 10) : today(),
    spatialRelationship: selected.contains ? 'Official INSPIRE cadastral parcel polygon containing the selected coordinate' : 'Nearest official INSPIRE cadastral parcel returned in the immediate search envelope',
    calculationMethod: 'National Land Survey INSPIRE WFS CadastralParcel query with local point-in-polygon selection; WGS84 output geometry',
    confidence: selected.contains ? 'High' : 'Medium',
    limitation: 'The National Land Survey describes the CP product as derived from the Land Information System. The map is official cadastral context, but exact property division is determined from cadastral documents and in the terrain; this service does not establish ownership, title, easements or encumbrances.',
    value: parcel
  };

  return {
    success: true,
    sourceName: SOURCE_NAME,
    sourceUrl: url,
    datasetDate: evidence.datasetDate,
    parcel,
    geometryPoints,
    evidence: [evidence],
    limitation: evidence.limitation
  };
}

export function applyFinlandCadastreToReport(report: any, result: FinlandCadastreResult, requestedAreaM2: number): void {
  if (!report) return;
  report.evidenceRegistry = Array.isArray(report.evidenceRegistry)
    ? report.evidenceRegistry.filter((record: any) => record?.id !== 'cadastre-spatial-index' && record?.id !== 'cadastre-parcel-id')
    : [];
  report.evidenceRegistry.push(...result.evidence);
  if (!result.success || !result.parcel) return;

  const parcel = result.parcel;
  report.parcel = {
    ...(report.parcel || {}),
    status: 'VERIFIED',
    parcelId: parcel.parcelId,
    commune: report.parcel?.commune,
    county: report.parcel?.county,
    voivodeship: report.parcel?.voivodeship,
    region: report.parcel?.region,
    countryCode: 'FI',
    geometryPoints: parcel.geometryPoints,
    isOfficialGeometry: Boolean(parcel.geometryPoints?.length && parcel.geometryPoints.length >= 3),
    areaCalculatedM2: requestedAreaM2,
    officialAreaM2: undefined,
    cadastralSource: SOURCE_NAME,
    datasetDate: result.datasetDate,
    limitation: result.limitation
  };
  report.finland_cadastre = {
    sourceName: result.sourceName,
    sourceUrl: WMS_URL,
    parcel: result.parcel,
    limitation: result.limitation
  };
}

export const FINLAND_CADASTRE_SOURCE = {
  sourceName: SOURCE_NAME,
  serviceUrl: WFS_URL,
  viewServiceUrl: WMS_URL,
  viewLayer: 'CP.CadastralParcel',
  portalUrl: PORTAL
};
