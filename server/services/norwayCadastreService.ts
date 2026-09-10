import { EvidenceItem } from '../types';

export interface NorwayCadastreParcel {
  localId: string | null;
  parcelId: string;
  municipalityCode: string | null;
  farmNumber: number | null;
  useNumber: number | null;
  leaseNumber: number | null;
  sectionNumber: number | null;
  distanceM: number | null;
  accuracyClass: string | null;
  mainArea: boolean | null;
  multipleUnitsInArea: boolean | null;
  unregisteredCommonLand: boolean | null;
  objectType: string | null;
  updatedAt: string | null;
  registryGeometryPoints?: [number, number][];
}

export interface NorwayCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  parcel?: NorwayCadastreParcel;
  evidence: EvidenceItem[];
  limitation: string;
}

type FetchLike = typeof fetch;

const SOURCE_NAME = 'Kartverket — Åpent eiendoms-API (Matrikkelen)';
const BASE = 'https://api.kartverket.no/eiendom/v1';
const PORTAL = 'https://kartverket.no/api-og-data/eiendomsdata/tilgang-til-apne-eiendomsdata';
const today = () => new Date().toISOString().slice(0, 10);

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 7000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/geo+json, application/json', 'User-Agent': 'GeoSurvey/1.0 Norway property evidence' },
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
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned || null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : null;
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

function composeParcelId(properties: Record<string, unknown>): string | null {
  const explicit = text(properties.matrikkelnummertekst);
  if (explicit) return explicit;
  const kommune = text(properties.kommunenummer);
  const gard = numberValue(properties.gardsnummer);
  const bruk = numberValue(properties.bruksnummer);
  if (!kommune || gard === null || bruk === null) return null;
  const feste = numberValue(properties.festenummer);
  const seksjon = numberValue(properties.seksjonsnummer);
  let id = `${kommune}-${gard}/${bruk}`;
  if (feste !== null && feste > 0) id += `/${feste}`;
  if (seksjon !== null && seksjon > 0) id += `/${feste && feste > 0 ? feste : 0}/${seksjon}`;
  return id;
}

function unavailable(reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA', claim: string): NorwayCadastreResult {
  const evidence: EvidenceItem = {
    id: 'no-kartverket-property-unavailable',
    category: 'Cadastre & identification',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE_NAME,
    sourceUrl: BASE,
    datasetDate: today(),
    spatialRelationship: 'Selected site coordinate',
    calculationMethod: 'Kartverket open property API geographic search near the selected coordinate',
    confidence: 'Low',
    limitation: 'An empty or failed query is not evidence that no registered property exists. Verify the property in Kartverket/Matrikkelen and legal title in Grunnboken.',
    value: { reasonCode }
  };
  return { success: false, reasonCode, sourceName: SOURCE_NAME, sourceUrl: BASE, datasetDate: today(), evidence: [evidence], limitation: evidence.limitation };
}

export async function queryNorwayCadastre(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<NorwayCadastreResult> {
  const params = new URLSearchParams({
    ost: String(lng),
    nord: String(lat),
    koordsys: '4258',
    utkoordsys: '4258',
    radius: '25',
    maksTreff: '20'
  });
  const url = `${BASE}/punkt/omrader?${params}`;
  const response = await fetchJson(fetcher, url);
  if (!response) return unavailable('SOURCE_UNAVAILABLE', 'Kartverket’s open property-location API could not be reached or did not return valid JSON.');
  if (!Array.isArray(response.features)) return unavailable('MALFORMED_DATA', 'Kartverket returned an unexpected property-response structure.');
  if (!response.features.length) return unavailable('NO_DATA', 'Kartverket returned no mapped Matrikkelen property area within 25 m of the selected coordinate.');

  const candidates = response.features
    .map((feature: any) => ({ feature, properties: feature?.properties && typeof feature.properties === 'object' ? feature.properties as Record<string, unknown> : {} }))
    .map(candidate => ({ ...candidate, distance: numberValue(candidate.properties.meterFraPunkt) ?? Number.POSITIVE_INFINITY, main: booleanValue(candidate.properties.hovedområde) === true }))
    .sort((a, b) => a.distance - b.distance || Number(b.main) - Number(a.main));

  const selected = candidates.find(candidate => candidate.distance === 0 && candidate.main) || candidates.find(candidate => candidate.distance === 0) || candidates[0];
  const p = selected.properties;
  const parcelId = composeParcelId(p);
  if (!parcelId) return unavailable('MALFORMED_DATA', 'Kartverket returned a mapped property area without a usable Matrikkelen identifier.');

  const parcel: NorwayCadastreParcel = {
    localId: text(p.lokalid),
    parcelId,
    municipalityCode: text(p.kommunenummer),
    farmNumber: numberValue(p.gardsnummer),
    useNumber: numberValue(p.bruksnummer),
    leaseNumber: numberValue(p.festenummer),
    sectionNumber: numberValue(p.seksjonsnummer),
    distanceM: Number.isFinite(selected.distance) ? selected.distance : null,
    accuracyClass: text(p['nøyaktighetsklasseteig']),
    mainArea: booleanValue(p.hovedområde),
    multipleUnitsInArea: booleanValue(p.teigmedflerematrikkelenheter),
    unregisteredCommonLand: booleanValue(p.uregistrertjordsameie),
    objectType: text(p.objekttype),
    updatedAt: text(p.oppdateringsdato),
    registryGeometryPoints: firstOuterRing(selected.feature?.geometry)
  };

  const evidence: EvidenceItem = {
    id: 'no-kartverket-property',
    category: 'Cadastre & identification',
    claim: `Kartverket’s open property API identifies Matrikkelen unit ${parcel.parcelId}${parcel.distanceM !== null ? ` at approximately ${parcel.distanceM} m from the selected coordinate` : ''}.`,
    status: 'VERIFIED',
    sourceName: SOURCE_NAME,
    sourceUrl: url,
    datasetDate: parcel.updatedAt || today(),
    spatialRelationship: parcel.distanceM === 0 ? 'Mapped Matrikkelen property area containing the selected coordinate' : 'Nearest mapped Matrikkelen property area returned by the geographic search',
    calculationMethod: 'Kartverket /punkt/omrader query in ETRS89 geographic coordinates (EPSG:4258), ranked by returned distance and main-area flag',
    confidence: parcel.distanceM === 0 ? 'High' : 'Medium',
    limitation: 'Kartverket states that the Matrikkelen property map can be incomplete or imprecise and this open API does not provide boundary type or detailed boundary-quality information. The returned geometry is therefore registry context, not a certified legal boundary. The API also does not establish ownership, title, easements or encumbrances; verify legal matters in Matrikkelen/Grunnboken.',
    value: parcel
  };

  return { success: true, sourceName: SOURCE_NAME, sourceUrl: url, datasetDate: evidence.datasetDate, parcel, evidence: [evidence], limitation: evidence.limitation };
}

export function applyNorwayCadastreToReport(report: any, result: NorwayCadastreResult, requestedAreaM2: number): void {
  if (!report) return;
  report.evidenceRegistry = Array.isArray(report.evidenceRegistry) ? report.evidenceRegistry.filter((record: any) => record?.id !== 'cadastre-spatial-index' && record?.id !== 'cadastre-parcel-id') : [];
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
    region: parcel.municipalityCode || report.parcel?.region,
    countryCode: 'NO',
    // Deliberately do not replace the user-selected boundary with the open API geometry.
    // Kartverket explicitly warns that the map may be incomplete/imprecise and does not
    // expose boundary type/quality details through this endpoint.
    isOfficialGeometry: false,
    areaCalculatedM2: requestedAreaM2,
    officialAreaM2: undefined,
    cadastralSource: SOURCE_NAME,
    datasetDate: result.datasetDate,
    limitation: result.limitation
  };
  report.norway_cadastre = { sourceName: result.sourceName, sourceUrl: result.sourceUrl, parcel, limitation: result.limitation };
}

export const NORWAY_CADASTRE_SOURCE = { sourceName: SOURCE_NAME, serviceUrl: BASE, portalUrl: PORTAL };
