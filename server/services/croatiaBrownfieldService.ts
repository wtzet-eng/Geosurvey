import type { EvidenceItem, VerifiedSiteReport } from '../types';

export const CROATIA_BROWNFIELD_WFS = 'https://brownfield.mpgi.hr/ows_public/wfs';
export const CROATIA_BROWNFIELD_TYPE = 'brownfield:brownfield_area';

const SOURCE_NAME = 'Ministry of Physical Planning, Construction and State Assets — Brownfield Area Register';

type FetchLike = typeof fetch;
type Position = [number, number]; // [lng, lat]
type Ring = Position[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];
type Feature = { id?: string; geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> };

export type CroatiaBrownfieldEvidence = EvidenceItem & { reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA' };

const today = () => new Date().toISOString().slice(0, 10);
const clean = (value: unknown): string | null => value === null || value === undefined ? null : (String(value).trim() || null);
const numberValue = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

function pointInRing(point: Position, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if (((b[1] > point[1]) !== (a[1] > point[1])) && point[0] < ((a[0] - b[0]) * (point[1] - b[1])) / (a[1] - b[1]) + b[0]) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: Position, polygon: Polygon): boolean {
  return !!polygon.length && pointInRing(point, polygon[0]) && !polygon.slice(1).some(ring => pointInRing(point, ring));
}

function contains(point: Position, geometry: Feature['geometry']): boolean {
  if (!geometry?.coordinates) return false;
  if (geometry.type === 'Polygon') return pointInPolygon(point, geometry.coordinates as Polygon);
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates as MultiPolygon).some(polygon => pointInPolygon(point, polygon));
  return false;
}

function haversine(a: Position, b: Position): number {
  const R = 6371008.8, rad = Math.PI / 180;
  const p1 = a[1] * rad, p2 = b[1] * rad, dp = (b[1] - a[1]) * rad, dl = (b[0] - a[0]) * rad;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pointToSegmentMeters(point: Position, a: Position, b: Position): number {
  const lat = point[1] * Math.PI / 180;
  const scaleX = 111320 * Math.cos(lat), scaleY = 110540;
  const px = point[0] * scaleX, py = point[1] * scaleY;
  const ax = a[0] * scaleX, ay = a[1] * scaleY, bx = b[0] * scaleX, by = b[1] * scaleY;
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distanceToGeometry(point: Position, geometry: Feature['geometry']): number {
  if (!geometry?.coordinates) return Number.POSITIVE_INFINITY;
  if (contains(point, geometry)) return 0;
  const polygons: Polygon[] = geometry.type === 'Polygon' ? [geometry.coordinates as Polygon] : geometry.type === 'MultiPolygon' ? geometry.coordinates as MultiPolygon : [];
  let best = Number.POSITIVE_INFINITY;
  for (const polygon of polygons) for (const ring of polygon) for (let i = 1; i < ring.length; i++) best = Math.min(best, pointToSegmentMeters(point, ring[i - 1], ring[i]));
  return best;
}

async function fetchJson(fetcher: FetchLike, url: string): Promise<{ status: number; text: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json, text/plain, */*', 'User-Agent': 'LandSurf/1.0 Croatia brownfield evidence' }, signal: controller.signal });
    return { status: response.status, text: response.ok ? await response.text() : '' };
  } catch { return null; }
  finally { clearTimeout(timer); }
}

function buildFeatureSummary(feature: Feature, distanceM: number) {
  const p = feature.properties || {};
  return {
    id: feature.id || null,
    code: clean(p.sifra_brownfield_podrucja),
    name: clean(p.naziv_brownfield_podrucja),
    status: clean(p.status_brownfield_podrucja),
    address: clean(p.adresa),
    previousUse: clean(p.prethodna_namjena_brownfielda),
    currentTemporaryUse: clean(p.nacin_privremenog_koristenja),
    temporaryUse: clean(p.privremeno_koristenje_brownfielda),
    plannedUse: clean(p.namjena_prema_vazecem_prostornom_planu),
    areaM2: numberValue(p.knjizna_povrsina_podrucja) || numberValue(p.tehnicka_graficka_povrsina_podrucja),
    ownershipType: clean(p.tip_vlasnistva),
    ownershipDescription: clean(p.opis_stanja_vlasnistva),
    contaminatedFlag: clean(p.zagadenost_podrucja),
    contaminatedFlagBoolean: p.zagadenost_podrucja_tf === true,
    protectedCultural: clean(p.zasticeno_kulturno_dobro),
    distanceM: Math.round(distanceM)
  };
}

export async function fetchCroatiaBrownfieldEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<CroatiaBrownfieldEvidence> {
  const radiusM = 250;
  const dLat = radiusM / 110540;
  const dLng = radiusM / (111320 * Math.cos(lat * Math.PI / 180));
  const params = new URLSearchParams({
    service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: CROATIA_BROWNFIELD_TYPE,
    outputFormat: 'application/json', count: '25', srsName: 'EPSG:4326',
    bbox: `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat},EPSG:4326`
  });
  const response = await fetchJson(fetcher, `${CROATIA_BROWNFIELD_WFS}?${params}`);
  if (!response) return { id: 'hr-brownfield-service-unavailable', category: 'Previous land use', claim: 'The Croatian Brownfield Area Register could not be reached reliably at analysis time.', status: 'REQUIRES_VERIFICATION', sourceName: SOURCE_NAME, sourceUrl: CROATIA_BROWNFIELD_WFS, datasetDate: today(), spatialRelationship: 'Up to 250 m search radius around selected coordinate', calculationMethod: 'Official WFS query', confidence: 'Low', limitation: 'No conclusion about brownfield status should be drawn when the official register is unavailable.', value: { reasonCode: 'SOURCE_UNAVAILABLE' }, reasonCode: 'SOURCE_UNAVAILABLE' };
  if (response.status < 200 || response.status >= 300 || !response.text) return { id: 'hr-brownfield-service-unavailable', category: 'Previous land use', claim: 'The Croatian Brownfield Area Register returned no usable response.', status: 'REQUIRES_VERIFICATION', sourceName: SOURCE_NAME, sourceUrl: CROATIA_BROWNFIELD_WFS, datasetDate: today(), spatialRelationship: 'Up to 250 m search radius around selected coordinate', calculationMethod: 'Official WFS query', confidence: 'Low', limitation: 'No conclusion about brownfield status should be drawn when the official register is unavailable.', value: { reasonCode: 'SOURCE_UNAVAILABLE' }, reasonCode: 'SOURCE_UNAVAILABLE' };
  try {
    const parsed = JSON.parse(response.text) as { type?: string; features?: Feature[]; totalFeatures?: number };
    if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) throw new Error('malformed');
    const point: Position = [lng, lat];
    const matches = parsed.features.map(feature => ({ feature, distanceM: distanceToGeometry(point, feature.geometry) })).filter(x => x.distanceM <= radiusM).sort((a, b) => a.distanceM - b.distanceM);
    if (!matches.length) return { id: 'hr-brownfield-none', category: 'Previous land use', claim: 'No registered Croatian brownfield area was found within 250 m of the selected coordinate.', status: 'VERIFIED', sourceName: SOURCE_NAME, sourceUrl: CROATIA_BROWNFIELD_WFS, datasetDate: today(), spatialRelationship: 'No register polygon within 250 m', calculationMethod: 'Official WFS bbox query followed by exact point-to-polygon distance calculation', confidence: 'Medium', limitation: 'Absence from the Brownfield Area Register does not prove that a site is free from contamination, historic industrial use, buried structures or other environmental liabilities.', value: { matchCount: 0, searchRadiusM: radiusM } };
    const summaries = matches.slice(0, 5).map(x => buildFeatureSummary(x.feature, x.distanceM));
    const nearest = summaries[0];
    const isOnSite = nearest.distanceM === 0;
    return { id: 'hr-brownfield-register', category: 'Previous land use', claim: isOnSite ? `The selected coordinate falls within registered brownfield area ${nearest.name || nearest.code || 'without a recorded name'}.` : `A registered Croatian brownfield area${nearest.name ? `, ${nearest.name}` : ''} is approximately ${nearest.distanceM} m from the selected coordinate.`, status: 'VERIFIED', sourceName: SOURCE_NAME, sourceUrl: CROATIA_BROWNFIELD_WFS, datasetDate: today(), spatialRelationship: isOnSite ? 'Selected coordinate inside official brownfield polygon' : `Nearest official brownfield polygon approximately ${nearest.distanceM} m away`, calculationMethod: 'Official WFS query, exact point-in-polygon test and geodesic distance screening', confidence: isOnSite ? 'High' : 'Medium', limitation: 'The register identifies brownfield areas and recorded attributes. It is not a complete contaminated-land register; environmental contamination and remediation liability require separate investigation.', value: { searchRadiusM: radiusM, matchCount: summaries.length, onSite: isOnSite, nearest, nearby: summaries } };
  } catch {
    return { id: 'hr-brownfield-malformed', category: 'Previous land use', claim: 'The Croatian Brownfield Area Register returned data that could not be safely interpreted.', status: 'REQUIRES_VERIFICATION', sourceName: SOURCE_NAME, sourceUrl: CROATIA_BROWNFIELD_WFS, datasetDate: today(), spatialRelationship: 'Up to 250 m search radius', calculationMethod: 'Official WFS query', confidence: 'Low', limitation: 'The returned data was not used as evidence because it failed validation.', value: { reasonCode: 'MALFORMED_DATA' }, reasonCode: 'MALFORMED_DATA' };
  }
}

export function enrichCroatiaBrownfieldEvidence(report: VerifiedSiteReport & Record<string, any>, evidence: CroatiaBrownfieldEvidence): void {
  if (evidence.status !== 'VERIFIED') return;
  const value = (evidence.value || {}) as Record<string, any>;
  const nearest = value.nearest as Record<string, any> | undefined;
  report.geosurvey_context = { ...(report.geosurvey_context || {}), brownfield_status: value.onSite ? 'ON_REGISTERED_BROWNFIELD' : value.matchCount ? 'NEARBY_REGISTERED_BROWNFIELD' : 'NO_REGISTERED_BROWNFIELD_WITHIN_250M', brownfield_search_radius_m: value.searchRadiusM, brownfield_nearest_name: nearest?.name || null, brownfield_nearest_code: nearest?.code || null, brownfield_nearest_distance_m: nearest?.distanceM ?? null, brownfield_previous_use: nearest?.previousUse || null, brownfield_contamination_flag: nearest?.contaminatedFlagBoolean ? 'REGISTERED_AS_CONTAMINATED' : nearest ? 'NOT_FLAGGED_IN_BROWNFIELD_REGISTER' : null };
}
