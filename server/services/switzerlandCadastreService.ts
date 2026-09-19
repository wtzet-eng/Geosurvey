import type { EvidenceItem, VerifiedSiteReport } from '../types';

type FetchLike = typeof fetch;
const AV_WFS = 'https://geodienste.ch/db/av_0/deu';
const AV_TYPE = 'ms:RESF';
const PORTAL = 'https://www.cadastre.ch/';
const SOURCE = 'Amtliche Vermessung Schweiz / geodienste.ch — rechtsgültige Liegenschaften';
const LIMITATION = 'The official cadastral geometry identifies the mapped parcel for screening. It does not establish ownership, land-register rights, easements, encumbrances or the current ÖREB restrictions; verify those in the competent land register and ÖREB cadastre.';
const today = () => new Date().toISOString().slice(0, 10);

export interface SwitzerlandCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
  sourceName: string;
  sourceUrl: string;
  evidence: EvidenceItem[];
  parcel?: {
    parcelId: string;
    egrid: string | null;
    parcelNumber: string | null;
    municipality: string | null;
    canton: string | null;
    officialAreaM2: number | null;
    geometryPoints: [number, number][];
  };
}

const text = (v: unknown): string | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return null;
  const value = v.trim().replace(/\s+/g, ' ');
  return value && !/^(null|none|unknown|n\/a)$/i.test(value) ? value : null;
};
const numberValue = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return null;
  const n = Number(v.trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const first = (attributes: Record<string, any>, names: string[]): string | null => {
  for (const name of names) {
    const direct = text(attributes[name]);
    if (direct) return direct;
    const key = Object.keys(attributes).find(k => k.toLowerCase() === name.toLowerCase());
    if (key) {
      const value = text(attributes[key]);
      if (value) return value;
    }
  }
  return null;
};
const firstNumber = (attributes: Record<string, any>, names: string[]): number | null => {
  for (const name of names) {
    const direct = numberValue(attributes[name]);
    if (direct !== null) return direct;
    const key = Object.keys(attributes).find(k => k.toLowerCase() === name.toLowerCase());
    if (key) {
      const value = numberValue(attributes[key]);
      if (value !== null) return value;
    }
  }
  return null;
};

function pointInRing(lng: number, lat: number, ring: any[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i]?.[0]), yi = Number(ring[i]?.[1]);
    const xj = Number(ring[j]?.[0]), yj = Number(ring[j]?.[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}
function containsPoint(geometry: any, lng: number, lat: number): boolean {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    return Boolean(rings[0] && pointInRing(lng, lat, rings[0]) && !rings.slice(1).some((ring: any[]) => pointInRing(lng, lat, ring)));
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates || []).some((polygon: any[]) => polygon[0] && pointInRing(lng, lat, polygon[0]) && !polygon.slice(1).some((ring: any[]) => pointInRing(lng, lat, ring)));
  }
  return false;
}
function geometryPoints(geometry: any): [number, number][] {
  const rings = geometry?.type === 'Polygon' ? geometry.coordinates : geometry?.type === 'MultiPolygon' ? geometry.coordinates?.[0] : null;
  const ring = Array.isArray(rings?.[0]) ? rings[0] : [];
  return ring
    .map((p: any) => [Number(p?.[1]), Number(p?.[0])] as [number, number])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}
function queryUrl(lat: number, lng: number): string {
  const dy = 20 / 111320;
  const dx = 20 / (111320 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  const p = new URLSearchParams({
    SERVICE: 'WFS', REQUEST: 'GetFeature', VERSION: '2.0.0', TYPENAMES: AV_TYPE,
    OUTPUTFORMAT: 'application/json; subtype=geojson', SRSNAME: 'EPSG:4326',
    // WFS 2.0 follows the formal EPSG:4326 axis order: latitude, longitude.
    BBOX: `${lat - dy},${lng - dx},${lat + dy},${lng + dx},EPSG:4326`,
    COUNT: '50'
  });
  return `${AV_WFS}?${p}`;
}
async function fetchFeatures(lat: number, lng: number, fetcher: FetchLike): Promise<any[] | null> {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const response = await fetcher(queryUrl(lat, lng), {
      headers: { Accept: 'application/geo+json,application/json', 'User-Agent': 'LandSurf/1.0 Switzerland cadastre' },
      signal: ctrl.signal
    });
    if (!response.ok) return null;
    const body: any = await response.json();
    return Array.isArray(body?.features) ? body.features : null;
  } catch { return null; } finally { clearTimeout(timer); }
}
function unavailable(reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA', claim: string): SwitzerlandCadastreResult {
  return {
    success: false, reasonCode, sourceName: SOURCE, sourceUrl: PORTAL,
    evidence: [{
      id: 'ch-av-cadastre-unavailable', category: 'Cadastre & identification', claim, status: 'REQUIRES_VERIFICATION',
      sourceName: SOURCE, sourceUrl: AV_WFS, datasetDate: today(), spatialRelationship: 'Selected site coordinate',
      calculationMethod: 'Official Swiss cadastral WFS 2.0 query with point-in-polygon validation', confidence: 'Low',
      limitation: LIMITATION, value: { reasonCode }
    }]
  };
}

export async function querySwitzerlandCadastre(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<SwitzerlandCadastreResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 45.74 || lat > 47.86 || lng < 5.70 || lng > 10.65) {
    return unavailable('NO_DATA', 'The coordinate is outside expected Swiss official-surveying coverage.');
  }
  const features = await fetchFeatures(lat, lng, fetcher);
  if (features === null) return unavailable('SOURCE_UNAVAILABLE', 'The Swiss official cadastral parcel service could not be queried reliably.');
  const feature = features.find(feature => containsPoint(feature?.geometry, lng, lat));
  if (!feature) return unavailable('NO_DATA', 'The Swiss official cadastral service responded but returned no legally valid parcel polygon containing the selected coordinate.');

  const a = feature.properties || {};
  const egrid = first(a, ['EGRIS_EGRID', 'egrid', 'EGRID', 'egrid_id', 'egridid']);
  const parcelNumber = first(a, ['nummer', 'number', 'parzellennummer', 'liegenschaftsnummer', 'parcel_number', 'parcelnumber', 'label']);
  const parcelId = egrid || parcelNumber || text(feature.id);
  if (!parcelId) return unavailable('MALFORMED_DATA', 'The Swiss cadastral service returned a parcel polygon without a usable EGRID or parcel identifier.');

  const points = geometryPoints(feature.geometry);
  if (points.length < 3) return unavailable('MALFORMED_DATA', 'The Swiss cadastral service returned a parcel record without usable official polygon geometry.');

  const parcel = {
    parcelId,
    egrid,
    parcelNumber,
    municipality: first(a, ['gemeinde', 'municipality', 'gemeindename', 'gemeinde_name']),
    canton: first(a, ['kanton', 'canton', 'kantonskuerzel', 'kanton_code']),
    officialAreaM2: firstNumber(a, ['flaeche', 'flaeche_m2', 'area', 'area_m2', 'official_area_m2']),
    geometryPoints: points
  };
  return {
    success: true, sourceName: SOURCE, sourceUrl: PORTAL, parcel,
    evidence: [{
      id: 'ch-av-cadastre', category: 'Cadastre & identification',
      claim: `Swiss official surveying identifies parcel ${parcelNumber || parcelId}${egrid ? ` (EGRID ${egrid})` : ''}${parcel.officialAreaM2 ? ` with registered area approximately ${Math.round(parcel.officialAreaM2).toLocaleString('en')} m²` : ''}.`,
      status: 'VERIFIED', sourceName: SOURCE, sourceUrl: AV_WFS, datasetDate: today(),
      spatialRelationship: 'Official legally valid cadastral polygon containing the selected coordinate',
      calculationMethod: 'geodienste.ch AV WFS 2.0 RESF query in EPSG:4326 with point-in-polygon validation',
      confidence: 'High', limitation: LIMITATION, value: parcel
    }]
  };
}

export function applySwitzerlandCadastreToReport(report: VerifiedSiteReport & Record<string, any>, result: SwitzerlandCadastreResult, requestedAreaM2: number): void {
  report.evidenceRegistry = Array.isArray(report.evidenceRegistry)
    ? report.evidenceRegistry.filter(item => !/cadastre-spatial-index|cadastre-parcel-id/.test(item.id))
    : [];
  report.evidenceRegistry.push(...result.evidence);
  if (!result.parcel) return;
  report.parcel = {
    ...report.parcel,
    status: 'VERIFIED',
    parcelId: result.parcel.parcelId,
    commune: result.parcel.municipality || report.parcel.commune,
    region: result.parcel.canton || report.parcel.region,
    countryCode: 'CH',
    areaCalculatedM2: requestedAreaM2,
    officialAreaM2: result.parcel.officialAreaM2 ?? undefined,
    geometryPoints: result.parcel.geometryPoints,
    isOfficialGeometry: true,
    cadastralSource: SOURCE,
    datasetDate: today(),
    limitation: LIMITATION
  };
  report.switzerland_cadastre = result.parcel;
}
