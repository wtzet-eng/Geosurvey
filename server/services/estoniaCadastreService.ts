import { EvidenceItem } from '../types';

export interface EstoniaCadastreParcel {
  parcelId: string;
  areaM2: number | null;
  county: string | null;
  municipality: string | null;
  settlement: string | null;
  address: string | null;
  ownershipForm: string | null;
  intendedUses: string[];
  landCoverShares: Record<string, number>;
  cadastralTaxValue: number | null;
  marks: string | null;
  registeredAt: string | null;
  changedAt: string | null;
  geometryPoints?: [number, number][];
}

export interface EstoniaCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  parcel?: EstoniaCadastreParcel;
  geometryPoints?: [number, number][];
  evidence: EvidenceItem[];
  limitation: string;
  viewServiceUrl: string;
  viewLayer: string;
  viewStyle: string;
  viewAttribution: string;
}

type FetchLike = typeof fetch;

const SOURCE_NAME = 'Estonian Land and Spatial Development Board — Cadastral Units';
const WFS_URL = 'https://gsavalik.envir.ee/geoserver/kataster/ows';
const WMS_URL = 'https://gsavalik.envir.ee/geoserver/kataster/ows';
const PORTAL_URL = 'https://maaruum.ee/en/cadastre';
const LAYER = 'kataster:ky_kehtiv';
const today = () => new Date().toISOString().slice(0, 10);

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 9000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/geo+json, application/json', 'User-Agent': 'GroundSurf/1.0 Estonia cadastral evidence' },
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
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim().replace(/\s+/g, ' ');
  return cleaned || null;
}

function number(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
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
    service: 'WFS', version: '2.0.0', request: 'GetFeature',
    typeNames: LAYER, srsName: 'EPSG:4326', outputFormat: 'application/json', count: '50',
    BBOX: `${(lng - delta).toFixed(6)},${(lat - delta).toFixed(6)},${(lng + delta).toFixed(6)},${(lat + delta).toFixed(6)},EPSG:4326`
  });
  return `${WFS_URL}?${params.toString()}`;
}

function unavailable(reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA', claim: string): EstoniaCadastreResult {
  const limitation = 'An empty or failed cadastral query is not evidence that no cadastral unit exists. The open national map is cadastral context; a certified cadastral map extract is the authoritative document for legal boundary questions, and registered rights or encumbrances require the relevant registry records.';
  return {
    success: false, reasonCode, sourceName: SOURCE_NAME, sourceUrl: WFS_URL, datasetDate: today(),
    evidence: [{
      id: 'ee-maaamet-cadastre-unavailable', category: 'Cadastre & identification', claim, status: 'REQUIRES_VERIFICATION',
      sourceName: SOURCE_NAME, sourceUrl: WFS_URL, datasetDate: today(), spatialRelationship: 'Selected site coordinate',
      calculationMethod: 'Estonian current cadastral units WFS query in EPSG:4326', confidence: 'Low', limitation,
      value: { reasonCode }
    }],
    limitation, viewServiceUrl: WMS_URL, viewLayer: LAYER, viewStyle: '', viewAttribution: '© Estonian Land and Spatial Development Board'
  };
}

export async function queryEstoniaCadastre(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<EstoniaCadastreResult> {
  const url = queryUrl(lat, lng);
  const response = await fetchJson(fetcher, url);
  if (!response) return unavailable('SOURCE_UNAVAILABLE', 'The Estonian national cadastral WFS could not be reached or did not return valid JSON.');
  if (!Array.isArray(response.features)) return unavailable('MALFORMED_DATA', 'The Estonian cadastral response did not contain the expected feature collection.');
  if (!response.features.length) return unavailable('NO_DATA', 'The Estonian cadastral service returned no current cadastral unit in the immediate search envelope.');

  const site: [number, number] = [lat, lng];
  const candidates = response.features.map((feature: any) => {
    const ring = firstOuterRing(feature?.geometry);
    return { feature, ring, contains: Boolean(ring && pointInRing(site, ring)), centre: ring ? centroid(ring) : null };
  });
  const selected = candidates.find((item: any) => item.contains)
    || candidates.filter((item: any) => item.centre).sort((a: any, b: any) => distanceSq(site, a.centre) - distanceSq(site, b.centre))[0]
    || candidates[0];

  const p = selected.feature?.properties || {};
  const parcelId = text(p.tunnus);
  if (!parcelId) return unavailable('MALFORMED_DATA', 'The Estonian cadastral feature was returned without its cadastral unit identifier.');

  const parcel: EstoniaCadastreParcel = {
    parcelId,
    areaM2: number(p.pindala), county: text(p.mk_nimi), municipality: text(p.ov_nimi), settlement: text(p.ay_nimi),
    address: text(p.l_aadress), ownershipForm: text(p.omvorm),
    intendedUses: [p.siht1, p.siht2, p.siht3].map(text).filter((value): value is string => Boolean(value)),
    landCoverShares: Object.fromEntries([['arable', number(p.haritav)], ['grassland', number(p.rohumaa)], ['forest', number(p.mets)], ['yard', number(p.ouemaa)], ['other', number(p.muumaa)]].filter(([, value]) => value !== null)),
    cadastralTaxValue: number(p.maks_hind), marks: text(p.marked), registeredAt: text(p.registr), changedAt: text(p.muudet), geometryPoints: selected.ring
  };

  const limitation = 'The current cadastral unit map is official national cadastral context. A certified cadastral map extract is the authoritative document for legal boundary questions; this service does not establish ownership, title, easements or encumbrances. Cadastral quality marks and field/survey information may require separate verification.';
  const evidence: EvidenceItem = {
    id: 'ee-maaamet-cadastre', category: 'Cadastre & identification',
    claim: `The Estonian national cadastral service identifies cadastral unit ${parcel.parcelId}${parcel.areaM2 !== null ? ` with mapped area ${parcel.areaM2.toLocaleString('en-GB')} m²` : ''}${parcel.municipality ? ` in ${parcel.municipality}` : ''}.`,
    status: 'VERIFIED', sourceName: SOURCE_NAME, sourceUrl: url, datasetDate: parcel.changedAt ? parcel.changedAt.slice(0, 10) : today(),
    spatialRelationship: selected.contains ? 'Current cadastral unit polygon containing the selected coordinate' : 'Nearest current cadastral unit returned in the immediate search envelope',
    calculationMethod: 'Estonian cadastral WFS query with local point-in-polygon selection; WGS84 output geometry',
    confidence: selected.contains ? 'High' : 'Medium', limitation,
    value: parcel
  };
  return { success: true, sourceName: SOURCE_NAME, sourceUrl: url, datasetDate: evidence.datasetDate, parcel, geometryPoints: parcel.geometryPoints, evidence: [evidence], limitation, viewServiceUrl: WMS_URL, viewLayer: LAYER, viewStyle: '', viewAttribution: '© Estonian Land and Spatial Development Board' };
}

export function applyEstoniaCadastreToReport(report: any, result: EstoniaCadastreResult, requestedAreaM2: number): void {
  if (!report) return;
  report.evidenceRegistry = Array.isArray(report.evidenceRegistry)
    ? report.evidenceRegistry.filter((record: any) => record?.id !== 'cadastre-spatial-index' && record?.id !== 'cadastre-parcel-id')
    : [];
  report.evidenceRegistry.push(...result.evidence);
  if (!result.success || !result.parcel) return;
  const parcel = result.parcel;
  report.parcel = {
    ...(report.parcel || {}), status: 'VERIFIED', parcelId: parcel.parcelId, countryCode: 'EE',
    commune: parcel.municipality, county: parcel.county, region: parcel.county, geometryPoints: parcel.geometryPoints,
    isOfficialGeometry: Boolean(parcel.geometryPoints?.length && parcel.geometryPoints.length >= 3), areaCalculatedM2: requestedAreaM2,
    officialAreaM2: parcel.areaM2, cadastralSource: SOURCE_NAME, datasetDate: result.datasetDate, limitation: result.limitation,
    address: parcel.address, ownershipForm: parcel.ownershipForm, intendedUses: parcel.intendedUses,
    cadastralTaxValue: parcel.cadastralTaxValue, cadastralMarks: parcel.marks
  };
  report.estonia_cadastre = { sourceName: result.sourceName, sourceUrl: WFS_URL, parcel, limitation: result.limitation };
}

export const ESTONIA_CADASTRE_SOURCE = { sourceName: SOURCE_NAME, serviceUrl: WFS_URL, viewServiceUrl: WMS_URL, viewLayer: LAYER, portalUrl: PORTAL_URL };
