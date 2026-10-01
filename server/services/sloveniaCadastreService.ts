import type { CadastralParcelInfo, EvidenceItem } from '../types';

const WFS_URL = 'https://ipi.eprostor.gov.si/wfs-si-gurs-ins/cp/wfs';
const WMS_URL = 'https://ipi.eprostor.gov.si/wms-si-gurs-ins/cp/wms';
const PORTAL_URL = 'https://www.e-prostor.gov.si/';

export interface SloveniaCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
  sourceName: string;
  sourceUrl: string;
  parcel?: {
    parcelId: string;
    officialAreaM2?: number;
    geometryPoints?: [number, number][];
    cadastralMunicipality?: string;
  };
  evidence: EvidenceItem[];
  limitation: string;
}

function wgs84ToD96TM(lat: number, lon: number): [number, number] {
  // EPSG:3794 / D96-TM: Transverse Mercator on GRS80, central meridian 15°E,
  // scale 0.9999, false easting 500000 m. For screening, the small datum
  // transformation between WGS84 and D96 is below the parcel-query tolerance.
  const a = 6378137;
  const f = 1 / 298.257222101;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const k0 = 0.9999;
  const lon0 = 15 * Math.PI / 180;
  const phi = lat * Math.PI / 180;
  const lam = lon * Math.PI / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2;
  const C = ep2 * Math.cos(phi) ** 2;
  const A = Math.cos(phi) * (lam - lon0);
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
  const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
  const y = k0 * (M + N * Math.tan(phi) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720));
  return [x, y];
}

function d96ToWgs84(x: number, y: number): [number, number] {
  const a = 6378137, f = 1 / 298.257222101, e2 = f * (2 - f), k0 = 0.9999;
  const ep2 = e2 / (1 - e2), M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const C1 = ep2 * Math.cos(phi1) ** 2, T1 = Math.tan(phi1) ** 2;
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) ** 2);
  const R1 = a * (1 - e2) / (1 - e2 * Math.sin(phi1) ** 2) ** 1.5;
  const D = (x - 500000) / (N1 * k0);
  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4 / 24);
  const lon = 15 * Math.PI / 180 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6) / Math.cos(phi1);
  return [lat * 180 / Math.PI, lon * 180 / Math.PI];
}

function pointInRing(point: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  const [px, py] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const intersects = ((yi > py) !== (yj > py)) && px < (xj - xi) * (py - yi) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function geometryToLatLngRing(geometry: any, lat: number, lng: number): [number, number][] | undefined {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  for (const polygon of polygons) {
    const ring = polygon?.[0];
    if (!Array.isArray(ring) || ring.length < 3) continue;
    const converted = ring.map(([x, y]: [number, number]) => d96ToWgs84(Number(x), Number(y)));
    const point = d96ToWgs84(...wgs84ToD96(lat, lng));
    if (pointInRing([point[1], point[0]], converted.map(([la, lo]) => [lo, la] as [number, number]))) return converted;
  }
  return undefined;
}

function parseFeatures(data: any, lat: number, lng: number) {
  const features = Array.isArray(data?.features) ? data.features : [];
  for (const feature of features) {
    const p = feature?.properties || {};
    const geometryPoints = geometryToLatLngRing(feature?.geometry, lat, lng);
    if (!geometryPoints) continue;
    const parcelId = String(p.inspireId?.localId ?? p.nationalCadastralReference ?? p.label ?? p.parcelNumber ?? p.id ?? '').trim();
    const area = Number(p.areaValue ?? p.area ?? p.area_m2 ?? p.areaM2);
    if (!parcelId) continue;
    return { parcelId, officialAreaM2: Number.isFinite(area) ? area : undefined, geometryPoints, cadastralMunicipality: p.cadastralZoning?.label ?? p.cadastralMunicipality ?? p.cadastreUnit };
  }
  return null;
}

export async function querySloveniaCadastre(lat: number, lng: number, fetcher: typeof fetch = fetch): Promise<SloveniaCadastreResult> {
  const sourceName = 'Geodetska uprava Republike Slovenije (GURS) — INSPIRE cadastral parcels';
  const limitation = 'Official cadastral screening evidence. Parcel geometry and registered attributes do not prove ownership, title, easements or the legal conclusiveness of a boundary survey.';
  try {
    const [x, y] = wgs84ToD96TM(lat, lng);
    const delta = 3;
    const params = new URLSearchParams({
      service: 'WFS', version: '2.0.0', request: 'GetFeature',
      typeNames: 'CP:CadastralParcel', srsName: 'EPSG:3794',
      bbox: `${x - delta},${y - delta},${x + delta},${y + delta},urn:ogc:def:crs:EPSG::3794`,
      outputFormat: 'application/json', count: '20'
    });
    const response = await fetcher(`${WFS_URL}?${params.toString()}`, { headers: { Accept: 'application/geo+json, application/json' } });
    if (!response.ok) return { success: false, reasonCode: 'SOURCE_UNAVAILABLE', sourceName, sourceUrl: WFS_URL, evidence: [{ id: 'si-gurs-cadastre-unavailable', category: 'Cadastre & Identification', claim: 'The official Slovenian cadastral WFS could not be queried reliably.', status: 'REQUIRES_VERIFICATION', sourceName, sourceUrl: WFS_URL, datasetDate: new Date().toISOString().slice(0,10), spatialRelationship: 'Selected site coordinate', calculationMethod: 'GURS INSPIRE WFS coordinate query', confidence: 'Low', limitation }], limitation };
    const data = await response.json();
    const parsed = parseFeatures(data, lat, lng);
    if (!parsed) return { success: false, reasonCode: 'NO_DATA', sourceName, sourceUrl: WFS_URL, evidence: [{ id: 'si-gurs-cadastre-no-data', category: 'Cadastre & Identification', claim: 'The official Slovenian cadastral WFS was queried at the selected coordinate but returned no identifiable parcel containing that point.', status: 'REQUIRES_VERIFICATION', sourceName, sourceUrl: WFS_URL, datasetDate: new Date().toISOString().slice(0,10), spatialRelationship: 'Selected site coordinate', calculationMethod: 'GURS INSPIRE WFS spatial intersection query', confidence: 'Medium', limitation }], limitation };
    const evidence: EvidenceItem = { id: 'si-gurs-cadastre-parcel', category: 'Cadastre & Identification', claim: `GURS cadastral parcel ${parsed.parcelId} was identified at the selected location.`, status: 'VERIFIED', sourceName, sourceUrl: WFS_URL, datasetDate: new Date().toISOString().slice(0,10), spatialRelationship: 'Official cadastral parcel polygon contains the selected coordinate', calculationMethod: 'GURS INSPIRE WFS GetFeature on CP:CadastralParcel in EPSG:3794', confidence: 'High', limitation, value: parsed };
    return { success: true, sourceName, sourceUrl: WFS_URL, parcel: parsed, evidence: [evidence], limitation };
  } catch (error) {
    return { success: false, reasonCode: 'SOURCE_UNAVAILABLE', sourceName, sourceUrl: WFS_URL, evidence: [{ id: 'si-gurs-cadastre-error', category: 'Cadastre & Identification', claim: 'The official Slovenian cadastral service returned an error or an unreadable response.', status: 'REQUIRES_VERIFICATION', sourceName, sourceUrl: WFS_URL, datasetDate: new Date().toISOString().slice(0,10), spatialRelationship: 'Selected site coordinate', calculationMethod: 'GURS INSPIRE WFS coordinate query', confidence: 'Low', limitation }], limitation };
  }
}

export function applySloveniaCadastreToReport(report: any, result: SloveniaCadastreResult, areaSizeM2: number): void {
  if (!report || !result.success || !result.parcel) return;
  const p = result.parcel;
  report.parcel = {
    ...(report.parcel || {}),
    status: 'VERIFIED',
    parcelId: p.parcelId,
    countryCode: 'SI',
    geometryPoints: p.geometryPoints,
    isOfficialGeometry: Boolean(p.geometryPoints?.length),
    areaCalculatedM2: areaSizeM2,
    officialAreaM2: p.officialAreaM2 ?? null,
    cadastralSource: result.sourceName,
    datasetDate: new Date().toISOString().slice(0,10),
    limitation: result.limitation
  } satisfies CadastralParcelInfo;
}
