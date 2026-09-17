import { EvidenceItem } from '../types';

export interface DenmarkCadastreParcel {
  parcelId: string;
  cadastralNumber: string;
  districtCode: string | null;
  districtName: string | null;
  bfeNumber: number | null;
  municipalityCode: string | null;
  municipalityName: string | null;
  registeredAreaM2: number | null;
  areaMethod: string | null;
  featureId: string | null;
  commonLot: boolean | null;
  changedAt: string | null;
  geometryChangedAt: string | null;
  registryGeometryPoints?: [number, number][];
}

export interface DenmarkCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  parcel?: DenmarkCadastreParcel;
  evidence: EvidenceItem[];
  limitation: string;
}

type FetchLike = typeof fetch;

const SOURCE_NAME = 'Datafordeleren — Matriklen2 Gældende og Foreløbig WFS';
const BASE = 'https://wfs.datafordeler.dk/MATRIKLEN2/MatGaeldendeOgForeloebigWFS/1.0.0/WFS';
const PORTAL = 'https://datafordeler.dk/dataoversigt/matriklen-mat/matriklen2-gaeldende-og-foreloebig-wfs/';
const FEATURE_TYPE = 'mat:Jordstykke_Gaeldende';
const CRS = 'urn:ogc:def:crs:EPSG::25832';
const today = () => new Date().toISOString().slice(0, 10);

function text(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned || null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string' && /^(true|false)$/i.test(value.trim())) return value.trim().toLowerCase() === 'true';
  return null;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function xmlTag(block: string, localName: string): string | null {
  const escaped = localName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`<[^>]*:?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/[^>]*:?${escaped}>`, 'i'));
  return match ? text(decodeXml(match[1].replace(/<[^>]+>/g, ' '))) : null;
}

function wgs84ToUtm32(latDeg: number, lngDeg: number): [number, number] {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const k0 = 0.9996;
  const lon0 = 9 * Math.PI / 180;
  const lat = latDeg * Math.PI / 180;
  const lon = lngDeg * Math.PI / 180;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const tanLat = Math.tan(lat);
  const n = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = ep2 * cosLat * cosLat;
  const A = cosLat * (lon - lon0);
  const m = a * (
    (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * lat
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * lat)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * lat)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * lat)
  );
  const easting = 500000 + k0 * n * (A + (1 - t + c) * A ** 3 / 6 + (5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * A ** 5 / 120);
  const northing = k0 * (m + n * tanLat * (A ** 2 / 2 + (5 - t + 9 * c + 4 * c ** 2) * A ** 4 / 24 + (61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * A ** 6 / 720));
  return [easting, northing];
}

function utm32ToWgs84(easting: number, northing: number): [number, number] {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const k0 = 0.9996;
  const lon0 = 9 * Math.PI / 180;
  const x = easting - 500000;
  const m = northing / k0;
  const mu = m / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);
  const c1 = ep2 * cos1 * cos1;
  const t1 = tan1 * tan1;
  const n1 = a / Math.sqrt(1 - e2 * sin1 * sin1);
  const r1 = a * (1 - e2) / Math.pow(1 - e2 * sin1 * sin1, 1.5);
  const d = x / (n1 * k0);
  const lat = phi1 - (n1 * tan1 / r1) * (d ** 2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24 + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6 / 720);
  const lon = lon0 + (d - (1 + 2 * t1 + c1) * d ** 3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5 / 120) / cos1;
  return [lat * 180 / Math.PI, lon * 180 / Math.PI];
}

function parsePosList(value: string | null): [number, number][] | undefined {
  if (!value) return undefined;
  const numbers = value.trim().split(/\s+/).map(Number).filter(Number.isFinite);
  if (numbers.length < 6 || numbers.length % 2 !== 0) return undefined;
  const points: [number, number][] = [];
  for (let i = 0; i < numbers.length; i += 2) points.push(utm32ToWgs84(numbers[i], numbers[i + 1]));
  return points.length >= 3 ? points : undefined;
}

function pointInRing(lat: number, lng: number, ring?: [number, number][]): boolean {
  if (!ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0], xi = ring[i][1];
    const yj = ring[j][0], xj = ring[j][1];
    const intersects = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

interface ParsedFeature {
  properties: Record<string, string | null>;
  geometryPoints?: [number, number][];
}

function parseGmlFeatures(xml: string): ParsedFeature[] | null {
  if (!/<(?:\w+:)?FeatureCollection\b/i.test(xml)) return null;
  const blocks = [...xml.matchAll(/<(?:\w+:)?Jordstykke_Gaeldende\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Jordstykke_Gaeldende>/gi)].map(match => match[0]);
  return blocks.map(block => ({
    properties: {
      matrikelnummer: xmlTag(block, 'matrikelnummer'),
      ejerlavskode: xmlTag(block, 'ejerlavskode'),
      kommunekode: xmlTag(block, 'kommunekode'),
      registreretAreal: xmlTag(block, 'registreretAreal'),
      arealberegningsmetode: xmlTag(block, 'arealberegningsmetode'),
      id_lokalId: xmlTag(block, 'id.lokalId'),
      faelleslod: xmlTag(block, 'faelleslod'),
      registreringFra: xmlTag(block, 'registreringFra'),
      samletFastEjendomLokalId: xmlTag(block, 'samletFastEjendomLokalId')
    },
    geometryPoints: parsePosList(xmlTag(block, 'posList'))
  }));
}

async function fetchFeatures(fetcher: FetchLike, requestUrl: string, timeoutMs = 8000): Promise<ParsedFeature[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response: any = await fetcher(requestUrl, { headers: { Accept: 'application/gml+xml, application/xml, text/xml, */*', 'User-Agent': 'LandSurf/1.0 Denmark cadastral evidence' }, signal: controller.signal });
    if (!response.ok) return null;
    if (typeof response.text === 'function') return parseGmlFeatures(await response.text());
    if (typeof response.json === 'function') {
      const json: any = await response.json();
      if (!Array.isArray(json?.features)) return null;
      return json.features.map((feature: any) => ({ properties: feature?.properties || {}, geometryPoints: undefined }));
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function wfsUrl(apiKey: string, bbox: string): string {
  const params = new URLSearchParams({
    apikey: apiKey,
    service: 'WFS',
    request: 'GetFeature',
    version: '2.0.0',
    typeNames: FEATURE_TYPE,
    startIndex: '0',
    count: '20',
    srsName: CRS,
    bbox: `${bbox},${CRS}`
  });
  return `${BASE}?${params}`;
}

function publicSourceUrl(): string {
  const params = new URLSearchParams({ service: 'WFS', request: 'GetCapabilities', version: '2.0.0' });
  return `${BASE}?${params}`;
}

function unavailable(reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA', claim: string): DenmarkCadastreResult {
  const sourceUrl = publicSourceUrl();
  const evidence: EvidenceItem = {
    id: 'dk-datafordeler-cadastre-unavailable',
    category: 'Matrikel og identifikation',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE_NAME,
    sourceUrl,
    datasetDate: today(),
    spatialRelationship: 'Valgt stedkoordinat',
    calculationMethod: 'Datafordeler Matriklen2 Gældende og Foreløbig WFS; Jordstykke_Gaeldende med EPSG:25832-bounding box',
    confidence: 'Low',
    limitation: 'Et tomt eller mislykket opslag er ikke dokumentation for, at der ikke findes et registreret jordstykke. Kontrollér Matriklen/Datafordeleren og matriklen.dk. Datafordelerens WFS kræver en API-nøgle, som skal være konfigureret server-side.',
    value: { reasonCode }
  };
  return { success: false, reasonCode, sourceName: SOURCE_NAME, sourceUrl, datasetDate: today(), evidence: [evidence], limitation: evidence.limitation };
}

export async function queryDenmarkCadastre(lat: number, lng: number, fetcher: FetchLike = fetch, apiKey = process.env.DATAFORDELER_API_KEY || ''): Promise<DenmarkCadastreResult> {
  if (!apiKey.trim()) return unavailable('SOURCE_UNAVAILABLE', 'Datafordelerens geometri-bærende Matriklen2-WFS er integreret, men DATAFORDELER_API_KEY er ikke konfigureret på serveren.');

  const [easting, northing] = wgs84ToUtm32(lat, lng);
  const bbox = `${(easting - 3).toFixed(3)},${(northing - 3).toFixed(3)},${(easting + 3).toFixed(3)},${(northing + 3).toFixed(3)}`;
  const requestUrl = wfsUrl(apiKey, bbox);
  const features = await fetchFeatures(fetcher, requestUrl);
  if (features === null) return unavailable('SOURCE_UNAVAILABLE', 'Datafordelerens Matriklen2-WFS kunne ikke nås eller returnerede ikke et gyldigt WFS/GML-svar.');
  if (!features.length) return unavailable('NO_DATA', 'Matriklen2-WFS returnerede ikke et gældende jordstykke ved det valgte punkt.');

  const selected = features.find(feature => pointInRing(lat, lng, feature.geometryPoints)) || features[0];
  const p = selected.properties;
  const cadastralNumber = text(p.matrikelnummer);
  const districtCode = text(p.ejerlavskode);
  if (!cadastralNumber || !districtCode || !selected.geometryPoints?.length) return unavailable('MALFORMED_DATA', 'Matriklen2-WFS returnerede et jordstykke uden brugbart matrikelnummer, ejerlavskode eller polygongeometri.');

  const parcel: DenmarkCadastreParcel = {
    parcelId: `${districtCode} ${cadastralNumber}`,
    cadastralNumber,
    districtCode,
    districtName: null,
    bfeNumber: numberValue(p.samletFastEjendomLokalId),
    municipalityCode: text(p.kommunekode),
    municipalityName: null,
    registeredAreaM2: numberValue(p.registreretAreal),
    areaMethod: text(p.arealberegningsmetode),
    featureId: text(p.id_lokalId),
    commonLot: booleanValue(p.faelleslod),
    changedAt: text(p.registreringFra),
    geometryChangedAt: text(p.registreringFra),
    registryGeometryPoints: selected.geometryPoints
  };

  const sourceUrl = publicSourceUrl();
  const evidence: EvidenceItem = {
    id: 'dk-datafordeler-cadastre',
    category: 'Matrikel og identifikation',
    claim: `Datafordelerens Matriklen2-WFS identificerer jordstykket ${parcel.parcelId}${parcel.registeredAreaM2 !== null ? ` med registreret areal ${parcel.registeredAreaM2} m²` : ''}.`,
    status: 'VERIFIED',
    sourceName: SOURCE_NAME,
    sourceUrl,
    datasetDate: parcel.changedAt || today(),
    spatialRelationship: 'Gældende jordstykke fra Jordstykke_Gaeldende i en lille EPSG:25832-bounding box omkring det valgte koordinat',
    calculationMethod: 'WGS84-koordinat omregnet til ETRS89/UTM32; Datafordeler WFS 2.0 GetFeature; GML-polygon valgt ved punkt-i-polygon-kontrol',
    confidence: 'High',
    limitation: 'Matriklen er det officielle ejendomsregister, men matrikelkortets viste grænse er ikke i sig selv en ny landinspektørfastlagt grænseafsætning. Registreret areal kan afvige fra geometrisk beregnet areal. Ejerskab, servitutter, hæftelser og grænsetvivl kræver kontrol i de relevante originale registre og eventuelt landinspektør.',
    value: parcel
  };

  return { success: true, sourceName: SOURCE_NAME, sourceUrl, datasetDate: evidence.datasetDate, parcel, evidence: [evidence], limitation: evidence.limitation };
}

export function applyDenmarkCadastreToReport(report: any, result: DenmarkCadastreResult, requestedAreaM2: number): void {
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
    commune: parcel.municipalityName || report.parcel?.commune,
    region: parcel.municipalityCode || report.parcel?.region,
    countryCode: 'DK',
    geometryPoints: parcel.registryGeometryPoints,
    isOfficialGeometry: Boolean(parcel.registryGeometryPoints?.length),
    areaCalculatedM2: requestedAreaM2,
    officialAreaM2: parcel.registeredAreaM2 ?? undefined,
    cadastralSource: SOURCE_NAME,
    datasetDate: result.datasetDate,
    limitation: result.limitation
  };
  report.denmark_cadastre = { sourceName: result.sourceName, sourceUrl: result.sourceUrl, parcel, limitation: result.limitation };
}

export const DENMARK_CADASTRE_SOURCE = { sourceName: SOURCE_NAME, serviceUrl: BASE, portalUrl: PORTAL };
