import type { EvidenceItem, VerifiedSiteReport } from '../types';

type FetchLike = typeof fetch;
const BASE = 'https://features.geoportail.lu';
const COLLECTION = '359';
const SOURCE = 'Administration du cadastre et de la topographie (ACT) — Parcelles cadastrales';
const PORTAL = 'https://map.geoportail.lu/';
const COLLECTION_URL = `${BASE}/collections/${COLLECTION}?f=html`;
const LIMITATION = 'The national cadastral map identifies the mapped parcel at the selected coordinate. It does not establish ownership, title rights, easements, encumbrances or a legally re-surveyed boundary; those require the competent Luxembourg authorities and source records.';
const today = () => new Date().toISOString().slice(0, 10);

export interface LuxembourgCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'AMBIGUOUS';
  sourceName: string;
  sourceUrl: string;
  evidence: EvidenceItem[];
  parcel?: {
    parcelId: string;
    cadastralCommuneCode: number | null;
    section: string | null;
    mainNumber: number | null;
    secondaryNumber: number | null;
    natureCode: number | null;
    mappedAreaM2: number | null;
    registryGeometryPoints: [number, number][];
  };
}

function finite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}
function bbox(lat: number, lng: number): string {
  const e = 0.00001;
  return `${lng - e},${lat - e},${lng + e},${lat + e}`;
}
function itemsUrl(lat: number, lng: number): string {
  const id = encodeURIComponent(COLLECTION);
  return `${BASE}/collections/${id}/items?f=json&limit=10&bbox=${bbox(lat, lng)}`;
}

async function queryItems(lat: number, lng: number, fetcher: FetchLike): Promise<any[] | null> {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const response = await fetcher(itemsUrl(lat, lng), { headers: { Accept: 'application/geo+json,application/json', 'User-Agent': 'LandSurf/1.0 Luxembourg cadastre' }, signal: ctrl.signal });
    if (!response.ok) return null;
    const body: any = await response.json();
    return Array.isArray(body?.features) ? body.features : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

function outerRing(feature: any): [number, number][] {
  const g = feature?.geometry;
  const raw = g?.type === 'Polygon' ? g.coordinates?.[0] : g?.type === 'MultiPolygon' ? g.coordinates?.[0]?.[0] : null;
  return Array.isArray(raw)
    ? raw.filter((p: any) => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))).map((p: any) => [Number(p[1]), Number(p[0])] as [number, number])
    : [];
}

function pointInRing(lat: number, lng: number, ring: [number, number][]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0], xi = ring[i][1], yj = ring[j][0], xj = ring[j][1];
    const crosses = ((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi);
    if (crosses) inside = !inside;
  }
  return inside;
}

function areaM2(ring: [number, number][]): number | null {
  if (ring.length < 3) return null;
  const R = 6371008.8;
  const refLat = ring.reduce((sum, p) => sum + p[0], 0) / ring.length * Math.PI / 180;
  const xy = ring.map(([lat, lng]) => [R * lng * Math.PI / 180 * Math.cos(refLat), R * lat * Math.PI / 180] as const);
  let twice = 0;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) twice += xy[j][0] * xy[i][1] - xy[i][0] * xy[j][1];
  const value = Math.abs(twice) / 2;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function unavailable(reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'AMBIGUOUS', claim: string): LuxembourgCadastreResult {
  return {
    success: false, reasonCode, sourceName: SOURCE, sourceUrl: PORTAL,
    evidence: [{
      id: 'lu-act-cadastre-unavailable', category: 'Cadastre & identification', claim, status: 'REQUIRES_VERIFICATION',
      sourceName: SOURCE, sourceUrl: COLLECTION_URL, datasetDate: today(), spatialRelationship: 'Selected site coordinate',
      calculationMethod: 'Luxembourg Geoportail OGC API Features cadastral point-vicinity query with fail-closed validation', confidence: 'Low',
      limitation: LIMITATION, value: { reasonCode }
    }]
  };
}

export async function queryLuxembourgCadastre(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<LuxembourgCadastreResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 49.43 || lat > 50.20 || lng < 5.72 || lng > 6.54) {
    return unavailable('NO_DATA', 'The coordinate is outside expected Grand Duchy of Luxembourg cadastral coverage.');
  }
  const features = await queryItems(lat, lng, fetcher);
  if (features === null) return unavailable('SOURCE_UNAVAILABLE', 'Luxembourg ACT cadastral parcels could not be queried reliably.');
  if (!features.length) return unavailable('NO_DATA', 'No ACT cadastral parcel polygon was returned at the selected coordinate.');
  const candidates = features.map(feature => ({ feature, ring: outerRing(feature) }));
  const selected = candidates.find(item => pointInRing(lat, lng, item.ring)) || (candidates.length === 1 ? candidates[0] : null);
  if (!selected) return unavailable('AMBIGUOUS', 'Several cadastral polygons intersected the point-vicinity query and no single containing parcel could be resolved automatically.');
  const a = selected.feature?.properties || {};
  const parcelId = text(a.nummer);
  if (!parcelId) return unavailable('AMBIGUOUS', 'A cadastral polygon was returned without a usable Luxembourg parcel number.');
  const parcel = {
    parcelId,
    cadastralCommuneCode: finite(a.k_katastergemeinde),
    section: text(a.k_sektion),
    mainNumber: finite(a.k_hauptnummer),
    secondaryNumber: finite(a.k_zweitnummer),
    natureCode: finite(a.k_code_nature),
    mappedAreaM2: areaM2(selected.ring),
    registryGeometryPoints: selected.ring
  };
  const area = parcel.mappedAreaM2 ? `; mapped polygon approximately ${Math.round(parcel.mappedAreaM2).toLocaleString('en')} m²` : '';
  return {
    success: true, sourceName: SOURCE, sourceUrl: PORTAL, parcel,
    evidence: [{
      id: 'lu-act-cadastre', category: 'Cadastre & identification',
      claim: `Luxembourg ACT cadastral mapping identifies parcel ${parcel.parcelId} at the selected coordinate${parcel.section ? `, section ${parcel.section}` : ''}${area}.`,
      status: 'VERIFIED', sourceName: SOURCE, sourceUrl: COLLECTION_URL, datasetDate: today(),
      spatialRelationship: 'Official cadastral polygon containing the selected coordinate',
      calculationMethod: 'Geoportail Luxembourg OGC API Features query of cadastral parcel collection 359; containing polygon resolved geometrically',
      confidence: 'High', limitation: LIMITATION, value: parcel
    }]
  };
}

export function applyLuxembourgCadastreToReport(report: VerifiedSiteReport & Record<string, any>, result: LuxembourgCadastreResult, requestedAreaM2: number): void {
  report.evidenceRegistry = Array.isArray(report.evidenceRegistry) ? report.evidenceRegistry.filter(item => !/cadastre-spatial-index|cadastre-parcel-id/.test(item.id)) : [];
  report.evidenceRegistry.push(...result.evidence);
  if (!result.parcel) return;
  report.parcel = {
    ...report.parcel, status: 'VERIFIED', parcelId: result.parcel.parcelId, countryCode: 'LU', areaCalculatedM2: requestedAreaM2,
    isOfficialGeometry: false, cadastralSource: SOURCE, datasetDate: today(), limitation: LIMITATION
  };
  report.luxembourg_cadastre = result.parcel;
}
