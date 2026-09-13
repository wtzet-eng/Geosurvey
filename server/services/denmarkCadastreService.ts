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

const SOURCE_NAME = 'Dataforsyningen (DAWA) — Matrikelkortet';
const BASE = 'https://api.dataforsyningen.dk/jordstykker';
const PORTAL = 'https://dawadocs.dataforsyningen.dk/dok/matrikelkortet';
const today = () => new Date().toISOString().slice(0, 10);

function text(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned || null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && Number.isFinite(Number(value.replace(',', '.')))) return Number(value.replace(',', '.'));
  return null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function firstOuterRing(geometry: any): [number, number][] | undefined {
  const type = String(geometry?.type || '');
  let ring: any[] | undefined;
  if (type === 'Polygon' && Array.isArray(geometry?.coordinates?.[0])) ring = geometry.coordinates[0];
  if (type === 'MultiPolygon' && Array.isArray(geometry?.coordinates?.[0]?.[0])) ring = geometry.coordinates[0][0];
  if (!ring) return undefined;
  const points = ring.map((pair: any) => {
    const lng = numberValue(pair?.[0]);
    const lat = numberValue(pair?.[1]);
    return lat !== null && lng !== null ? [lat, lng] as [number, number] : null;
  }).filter((point: [number, number] | null): point is [number, number] => Boolean(point));
  return points.length >= 3 ? points : undefined;
}

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 7000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/geo+json, application/json', 'User-Agent': 'GeoSurvey/1.0 Denmark cadastral evidence' },
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

function nested(obj: any, key: string, nestedKey: string): unknown {
  return obj?.[key]?.[nestedKey] ?? obj?.[`${key}_${nestedKey}`] ?? obj?.[`${key}${nestedKey}`];
}

function unavailable(reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA', claim: string, sourceUrl = BASE): DenmarkCadastreResult {
  const evidence: EvidenceItem = {
    id: 'dk-dawa-cadastre-unavailable',
    category: 'Matrikel og identifikation',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE_NAME,
    sourceUrl,
    datasetDate: today(),
    spatialRelationship: 'Valgt stedkoordinat',
    calculationMethod: 'DAWA jordstykkeopslag ved WGS84-punkt',
    confidence: 'Low',
    limitation: 'Et tomt eller mislykket opslag er ikke dokumentation for, at der ikke findes et registreret jordstykke. Kontrollér matriklen og de originale ejendomsoplysninger hos de kompetente danske myndigheder.',
    value: { reasonCode }
  };
  return { success: false, reasonCode, sourceName: SOURCE_NAME, sourceUrl, datasetDate: today(), evidence: [evidence], limitation: evidence.limitation };
}

export async function queryDenmarkCadastre(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<DenmarkCadastreResult> {
  const params = new URLSearchParams({
    x: String(lng), y: String(lat), srid: '4326', format: 'geojson', struktur: 'nestet', per_side: '10'
  });
  const url = `${BASE}?${params}`;
  const response = await fetchJson(fetcher, url);
  if (!response) return unavailable('SOURCE_UNAVAILABLE', 'DAWA kunne ikke nås eller returnerede ikke gyldige GeoJSON-data.', url);
  if (!Array.isArray(response.features)) return unavailable('MALFORMED_DATA', 'DAWA returnerede en uventet datastruktur for jordstykker.', url);
  if (!response.features.length) return unavailable('NO_DATA', 'DAWA returnerede ikke et jordstykke for det valgte punkt.', url);

  const feature = response.features[0];
  const p: any = feature?.properties && typeof feature.properties === 'object' ? feature.properties : {};
  const cadastralNumber = text(p.matrikelnr);
  const districtCode = text(nested(p, 'ejerlav', 'kode') ?? p.ejerlavkode);
  const districtName = text(nested(p, 'ejerlav', 'navn') ?? p.ejerlavnavn);
  if (!cadastralNumber || (!districtCode && !districtName)) return unavailable('MALFORMED_DATA', 'DAWA returnerede et jordstykke uden et brugbart matrikelnummer/ejerlav.', url);

  const parcelId = `${districtName || districtCode} ${cadastralNumber}`;
  const parcel: DenmarkCadastreParcel = {
    parcelId,
    cadastralNumber,
    districtCode,
    districtName,
    bfeNumber: numberValue(p.bfenummer),
    municipalityCode: text(nested(p, 'kommune', 'kode') ?? p.kommunekode),
    municipalityName: text(nested(p, 'kommune', 'navn') ?? p.kommunenavn),
    registeredAreaM2: numberValue(p.registreretareal),
    areaMethod: text(p.arealberegningsmetode),
    featureId: text(p.featureid),
    commonLot: booleanValue(p['fælleslod'] ?? p.faelleslod),
    changedAt: text(p['ændret'] ?? p.aendret),
    geometryChangedAt: text(p['geo_ændret'] ?? p.geo_aendret),
    registryGeometryPoints: firstOuterRing(feature?.geometry)
  };

  const evidence: EvidenceItem = {
    id: 'dk-dawa-cadastre',
    category: 'Matrikel og identifikation',
    claim: `DAWA identificerer jordstykket ${parcel.parcelId}${parcel.registeredAreaM2 !== null ? ` med registreret areal ${parcel.registeredAreaM2} m²` : ''}.`,
    status: 'VERIFIED',
    sourceName: SOURCE_NAME,
    sourceUrl: url,
    datasetDate: parcel.geometryChangedAt || parcel.changedAt || today(),
    spatialRelationship: 'Jordstykke returneret for det valgte WGS84-punkt',
    calculationMethod: 'DAWA /jordstykker punktforespørgsel i EPSG:4326 med GeoJSON-geometri',
    confidence: 'High',
    limitation: 'Matrikelkortet er et officielt registerkort, men kortgrænser er ikke i sig selv en landinspektørfastlagt juridisk grænse. Registreret areal kan afvige fra geometrisk beregnet areal. Ejerskab, servitutter, hæftelser og grænsens retlige status skal verificeres i de relevante originale registre.',
    value: parcel
  };

  return { success: true, sourceName: SOURCE_NAME, sourceUrl: url, datasetDate: evidence.datasetDate, parcel, evidence: [evidence], limitation: evidence.limitation };
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
