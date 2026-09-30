import { EvidenceItem } from '../types';

type FetchLike = typeof fetch;

export interface PortugalCadastreParcel {
  localId: string | null;
  parcelId: string;
  nationalCadastralReference: string | null;
  areaM2: number | null;
  geometryPoints?: [number, number][];
  referencePoint?: [number, number];
}

export interface PortugalCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  parcel?: PortugalCadastreParcel;
  geometryPoints?: [number, number][];
  evidence: EvidenceItem[];
  limitation: string;
}

const SOURCE_NAME = 'Direção-Geral do Território — Cadastro Predial / Carta Cadastral';
const WFS_URL = 'https://snicws.dgterritorio.gov.pt/geoserver/inspire/ows';
const WMS_URL = 'https://snicws.dgterritorio.gov.pt/geoserver/inspire/ows';
const PORTAL = 'https://snic.dgterritorio.gov.pt/visualizadorcadastro';
const today = () => new Date().toISOString().slice(0, 10);

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 9000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/geo+json, application/json', 'User-Agent': 'GroundSurf/1.0 Portugal cadastral evidence' }, signal: controller.signal });
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

function firstOuterRing(geometry: any): [number, number][] | undefined {
  if (!geometry) return undefined;
  let ring: any[] | undefined;
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates?.[0])) ring = geometry.coordinates[0];
  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates?.[0]?.[0])) ring = geometry.coordinates[0][0];
  if (!ring) return undefined;
  const points = ring.map((pair: any) => {
    const lng = Number(pair?.[0]); const lat = Number(pair?.[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] as [number, number] : null;
  }).filter((p: [number, number] | null): p is [number, number] => Boolean(p));
  return points.length >= 3 ? points : undefined;
}

function pointInRing(point: [number, number], ring: [number, number][]): boolean {
  const [lat, lng] = point; let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lngI] = ring[i]; const [latJ, lngJ] = ring[j];
    const crosses = ((lngI > lng) !== (lngJ > lng)) && (lat < (latJ - latI) * (lng - lngI) / ((lngJ - lngI) || Number.EPSILON) + latI);
    if (crosses) inside = !inside;
  }
  return inside;
}

function centroid(points: [number, number][]): [number, number] {
  return points.reduce((sum, p) => [sum[0] + p[0], sum[1] + p[1]], [0, 0]).map(v => v / points.length) as [number, number];
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) { const n = Number(value.replace(',', '.')); return Number.isFinite(n) ? n : null; }
  if (value && typeof value === 'object') {
    const raw = value as Record<string, unknown>;
    for (const key of ['value', 'area', 'areaValue']) {
      const n = numberValue(raw[key]); if (n !== null) return n;
    }
  }
  return null;
}

function property(props: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (props[key] !== undefined && props[key] !== null && props[key] !== '') return props[key];
  }
  return undefined;
}

function queryUrl(lat: number, lng: number): string {
  const delta = 0.005;
  const params = new URLSearchParams({
    service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'cp:CadastralParcel',
    srsName: 'EPSG:4326', outputFormat: 'application/json', count: '50',
    BBOX: `${(lng - delta).toFixed(6)},${(lat - delta).toFixed(6)},${(lng + delta).toFixed(6)},${(lat + delta).toFixed(6)},EPSG:4326`
  });
  return `${WFS_URL}?${params.toString()}`;
}

function unavailable(reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA', claim: string): PortugalCadastreResult {
  const evidence: EvidenceItem = {
    id: 'pt-dgt-cadastre-unavailable', category: 'Cadastre & identification', claim, status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE_NAME, sourceUrl: WFS_URL, datasetDate: today(), spatialRelationship: 'Selected site coordinate',
    calculationMethod: 'DGT INSPIRE cadastral WFS bbox query in EPSG:4326', confidence: 'Low',
    limitation: 'Portugal cadastral coverage is incomplete and is concentrated predominantly in the southern half of mainland Portugal. A failed or empty query therefore cannot be interpreted as absence of a property or as proof of benign conditions; the official cadastral map and competent records remain necessary for verification.',
    value: { reasonCode }
  };
  return { success: false, reasonCode, sourceName: SOURCE_NAME, sourceUrl: WFS_URL, datasetDate: today(), evidence: [evidence], limitation: evidence.limitation };
}

export async function queryPortugalCadastre(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<PortugalCadastreResult> {
  const url = queryUrl(lat, lng);
  const response = await fetchJson(fetcher, url);
  if (!response) return unavailable('SOURCE_UNAVAILABLE', 'The DGT INSPIRE cadastral service could not be reached or did not return valid JSON.');
  if (!Array.isArray(response.features)) return unavailable('MALFORMED_DATA', 'The DGT cadastral response did not contain the expected feature collection.');
  if (!response.features.length) return unavailable('NO_DATA', 'The DGT cadastral service returned no published cadastral parcel in the immediate search envelope.');

  const site: [number, number] = [lat, lng];
  const candidates = response.features.map((feature: any) => {
    const ring = firstOuterRing(feature?.geometry);
    const props = (feature?.properties || {}) as Record<string, unknown>;
    const rpRaw = property(props, 'referencePoint', 'cp:referencePoint');
    const coords = (rpRaw && typeof rpRaw === 'object' && Array.isArray((rpRaw as any).coordinates)) ? (rpRaw as any).coordinates : null;
    const referencePoint = coords && coords.length >= 2 ? [Number(coords[1]), Number(coords[0])] as [number, number] : undefined;
    return { feature, ring, referencePoint, contains: Boolean(ring && pointInRing(site, ring)) };
  });
  const selected = candidates.find((candidate: any) => candidate.contains) || candidates.find((candidate: any) => candidate.ring) || candidates[0];
  const props = (selected.feature?.properties || {}) as Record<string, unknown>;

  const localId = text(property(props, 'inspireId', 'inspire:inspireId')) || text(selected.feature?.id);
  const parcelId = text(property(props, 'label', 'inspire:label'));
  const nationalRef = text(property(props, 'nationalCadastralReference', 'cp:nationalCadastralReference', 'nationalCadastralReference'));
  const areaM2 = numberValue(property(props, 'areaValue', 'area', 'cp:areaValue'));
  if (!parcelId) return unavailable('MALFORMED_DATA', 'The DGT cadastral feature was returned without a usable parcel label.');

  const points = selected.ring;
  const referencePoint = selected.referencePoint || (points ? centroid(points) : undefined);
  const parcel: PortugalCadastreParcel = { localId, parcelId, nationalCadastralReference: nationalRef, areaM2, geometryPoints: points, referencePoint };
  const evidence: EvidenceItem = {
    id: 'pt-dgt-cadastre', category: 'Cadastre & identification',
    claim: `DGT Cadastro Predial identifies published cadastral parcel ${parcel.parcelId}${nationalRef ? ` (NIC ${nationalRef})` : ''}${areaM2 !== null ? ` with registered area ${areaM2.toLocaleString('pt-PT')} m²` : ''} at the selected location.`,
    status: 'VERIFIED', sourceName: SOURCE_NAME, sourceUrl: url, datasetDate: today(),
    spatialRelationship: selected.contains ? 'Official DGT cadastral parcel polygon containing the selected coordinate' : 'Published DGT cadastral parcel returned in the immediate search envelope',
    calculationMethod: 'DGT INSPIRE CadastralParcel WFS bbox query with local point-in-polygon selection', confidence: selected.contains ? 'High' : 'Medium',
    value: { parcelId: parcel.parcelId, nationalCadastralReference: nationalRef, areaM2, geometryPointCount: points?.length || 0 },
    limitation: 'DGT states that cadastral coverage is incomplete and predominantly concentrated in the southern half of mainland Portugal. The mapped parcel is official cadastral context but does not establish ownership, title, easements or encumbrances; legal boundary questions require the competent cadastral and land-registry records.'
  };
  return { success: true, sourceName: SOURCE_NAME, sourceUrl: url, datasetDate: today(), parcel, geometryPoints: points, evidence: [evidence], limitation: evidence.limitation };
}

export function applyPortugalCadastreToReport(report: any, result: PortugalCadastreResult, fallbackAreaM2?: number): void {
  if (!report || !result?.success || !result.parcel) {
    if (result?.evidence?.length) report?.evidenceRegistry?.push(...result.evidence);
    return;
  }
  const parcel = result.parcel;
  report.parcel = {
    ...(report.parcel || {}), status: 'VERIFIED', isOfficialGeometry: Boolean(parcel.geometryPoints?.length),
    parcelId: parcel.parcelId, nationalCadastralReference: parcel.nationalCadastralReference,
    officialAreaM2: parcel.areaM2 ?? report.parcel?.officialAreaM2 ?? fallbackAreaM2 ?? null,
    areaCalculatedM2: report.parcel?.areaCalculatedM2 ?? fallbackAreaM2 ?? null,
    geometryPoints: parcel.geometryPoints, cadastralSource: 'DGT Cadastro Predial / INSPIRE'
  };
  report.evidenceRegistry.push(...result.evidence);
}

export const PORTUGAL_CADASTRAL_CONTEXT = { viewServiceUrl: WMS_URL, viewLayer: 'cadastralparcel', viewStyle: 'generic', attribution: '© Direção-Geral do Território — Cadastro Predial' , portal: PORTAL };
