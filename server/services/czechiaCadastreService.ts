import { EvidenceItem } from '../types';

export interface CzechiaBuildingRecord {
  id: string;
  houseNumbers: string | null;
  buildingType: string | null;
  use: string | null;
  completionDate: string | null;
  constructionType: string | null;
  enclosedVolumeM3: number | null;
  dwellingCount: number | null;
  floorCount: number | null;
  floorAreaM2: number | null;
  builtUpAreaM2: number | null;
  sewerConnection: string | null;
  gasConnection: string | null;
  waterConnection: string | null;
  heating: string | null;
}

export interface CzechiaCadastreParcel {
  id: string;
  parcelNumber: string | null;
  areaM2: number | null;
  numberingType: string | null;
  landType: string | null;
  landUse: string | null;
  cadastralAreaId: string | null;
  cadastralAreaName: string | null;
  municipality: string | null;
  district: string | null;
  region: string | null;
  geometryPoints?: [number, number][];
}

export interface CzechiaCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  parcel?: CzechiaCadastreParcel;
  buildings: CzechiaBuildingRecord[];
  evidence: EvidenceItem[];
  limitation: string;
}

type FetchLike = typeof fetch;
type Attributes = Record<string, unknown>;

const SOURCE_NAME = 'Český úřad zeměměřický a katastrální (ČÚZK) — RÚIAN';
const SERVICE = 'https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer';
const PORTAL = 'https://vdp.cuzk.gov.cz/';
const today = () => new Date().toISOString().slice(0, 10);

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 7000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'GeoSurvey/1.0 Czechia cadastre evidence' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json && typeof json === 'object' && !json.error ? json : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pointQueryUrl(layerId: number, lat: number, lng: number, returnGeometry = true): string {
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: returnGeometry ? 'true' : 'false',
    resultRecordCount: '5'
  });
  return `${SERVICE}/${layerId}/query?${params}`;
}

function polygonQueryUrl(layerId: number, geometry: any): string {
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    geometry: JSON.stringify({ rings: geometry?.rings || [], spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPolygon',
    inSR: '4326',
    outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
    resultRecordCount: '100'
  });
  return `${SERVICE}/${layerId}/query?${params}`;
}

function attributes(feature: any): Attributes {
  return feature?.attributes && typeof feature.attributes === 'object' ? feature.attributes : {};
}

function text(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned && !/^(null|none|unknown|n\/a|nezjištěno|nezjisteno)$/i.test(cleaned) ? cleaned : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(value: unknown): string | null {
  const n = numberValue(value);
  if (n !== null && n > 0) {
    const date = new Date(n);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString().slice(0, 10);
}

function domainLabel(layerMeta: any, fieldName: string, rawValue: unknown): string | null {
  if (rawValue === null || rawValue === undefined) return null;
  const field = Array.isArray(layerMeta?.fields)
    ? layerMeta.fields.find((candidate: any) => String(candidate?.name || '').toLowerCase() === fieldName.toLowerCase())
    : null;
  const values = field?.domain?.codedValues;
  if (!Array.isArray(values)) return null;
  const match = values.find((item: any) => String(item?.code) === String(rawValue));
  return text(match?.name);
}

function firstRingPoints(geometry: any): [number, number][] | undefined {
  const rings = Array.isArray(geometry?.rings) ? geometry.rings : [];
  const ring = rings.find((candidate: any) => Array.isArray(candidate) && candidate.length >= 3);
  if (!Array.isArray(ring)) return undefined;
  const points = ring.map((pair: any) => {
    const lng = numberValue(pair?.[0]);
    const lat = numberValue(pair?.[1]);
    return lat !== null && lng !== null ? [lat, lng] as [number, number] : null;
  }).filter((point: [number, number] | null): point is [number, number] => Boolean(point));
  return points.length >= 3 ? points : undefined;
}

function adminName(feature: any): string | null {
  const attrs = attributes(feature);
  return text(attrs.nazev) || text(attrs.nazevobce) || text(attrs.nazevokresu) || text(attrs.nazevvusc);
}

function unavailable(reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA', claim: string): CzechiaCadastreResult {
  const evidence: EvidenceItem = {
    id: 'cz-cuzk-ruian-parcel-unavailable',
    category: 'Cadastre & identification',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE_NAME,
    sourceUrl: SERVICE,
    datasetDate: today(),
    spatialRelationship: 'Selected site coordinate',
    calculationMethod: 'ČÚZK RÚIAN ArcGIS REST point-in-polygon query of parcel layer 5',
    confidence: 'Low',
    limitation: 'Failure or an empty response is not evidence that a cadastral parcel is absent. Verify the parcel and legal title in the official ČÚZK cadastral services.',
    value: { reasonCode }
  };
  return {
    success: false,
    reasonCode,
    sourceName: SOURCE_NAME,
    sourceUrl: SERVICE,
    datasetDate: today(),
    buildings: [],
    evidence: [evidence],
    limitation: evidence.limitation
  };
}

export async function queryCzechiaCadastre(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<CzechiaCadastreResult> {
  const [parcelData, parcelMeta, buildingMeta, cadastralAreaData, municipalityData, districtData, regionData] = await Promise.all([
    fetchJson(fetcher, pointQueryUrl(5, lat, lng, true)),
    fetchJson(fetcher, `${SERVICE}/5?f=json`, 5000),
    fetchJson(fetcher, `${SERVICE}/3?f=json`, 5000),
    fetchJson(fetcher, pointQueryUrl(7, lat, lng, false)),
    fetchJson(fetcher, pointQueryUrl(12, lat, lng, false)),
    fetchJson(fetcher, pointQueryUrl(15, lat, lng, false)),
    fetchJson(fetcher, pointQueryUrl(17, lat, lng, false))
  ]);

  if (!parcelData) return unavailable('SOURCE_UNAVAILABLE', 'The ČÚZK RÚIAN parcel service could not be reached or did not return valid JSON.');
  if (!Array.isArray(parcelData.features)) return unavailable('MALFORMED_DATA', 'The ČÚZK RÚIAN parcel response did not contain the expected feature collection.');
  const parcelFeature = parcelData.features[0];
  if (!parcelFeature) return unavailable('NO_DATA', 'The ČÚZK RÚIAN parcel service returned no parcel polygon at the selected coordinate.');

  const p = attributes(parcelFeature);
  const parcelId = text(p.id);
  const parcelNumber = text(p.cisloparcely) || [text(p.kmenovecislo), text(p.poddelenicisla)].filter(Boolean).join('/') || null;
  if (!parcelId && !parcelNumber) return unavailable('MALFORMED_DATA', 'The ČÚZK parcel feature was returned without a usable parcel identifier.');

  const geometryPoints = firstRingPoints(parcelFeature.geometry);
  const cadastralArea = Array.isArray(cadastralAreaData?.features) ? cadastralAreaData.features[0] : null;
  const municipality = Array.isArray(municipalityData?.features) ? municipalityData.features[0] : null;
  const district = Array.isArray(districtData?.features) ? districtData.features[0] : null;
  const region = Array.isArray(regionData?.features) ? regionData.features[0] : null;

  const parcel: CzechiaCadastreParcel = {
    id: parcelId || parcelNumber!,
    parcelNumber,
    areaM2: numberValue(p.vymeraparcely),
    numberingType: domainLabel(parcelMeta, 'druhcislovanikod', p.druhcislovanikod),
    landType: domainLabel(parcelMeta, 'druhpozemkukod', p.druhpozemkukod),
    landUse: domainLabel(parcelMeta, 'zpusobyvyuzitipozemku', p.zpusobyvyuzitipozemku),
    cadastralAreaId: text(p.katastralniuzemi),
    cadastralAreaName: adminName(cadastralArea),
    municipality: adminName(municipality),
    district: adminName(district),
    region: adminName(region),
    geometryPoints
  };

  let buildings: CzechiaBuildingRecord[] = [];
  let buildingQueryFailed = false;
  if (parcelFeature.geometry?.rings?.length) {
    const buildingData = await fetchJson(fetcher, polygonQueryUrl(3, parcelFeature.geometry));
    if (!buildingData || !Array.isArray(buildingData.features)) {
      buildingQueryFailed = true;
    } else {
      buildings = buildingData.features.map((feature: any) => {
        const b = attributes(feature);
        return {
          id: text(b.kod) || text(b.objectid) || 'registered building object',
          houseNumbers: text(b.cisladomovni),
          buildingType: domainLabel(buildingMeta, 'typstavebnihoobjektukod', b.typstavebnihoobjektukod),
          use: domainLabel(buildingMeta, 'zpusobvyuzitikod', b.zpusobvyuzitikod),
          completionDate: dateValue(b.dokonceni),
          constructionType: domainLabel(buildingMeta, 'druhkonstrukcekod', b.druhkonstrukcekod),
          enclosedVolumeM3: numberValue(b.obestavenyprostor),
          dwellingCount: numberValue(b.pocetbytu),
          floorCount: numberValue(b.pocetpodlazi),
          floorAreaM2: numberValue(b.podlahovaplocha),
          builtUpAreaM2: numberValue(b.zastavenaplocha),
          sewerConnection: domainLabel(buildingMeta, 'pripojenikanalizacekod', b.pripojenikanalizacekod),
          gasConnection: domainLabel(buildingMeta, 'pripojeniplynkod', b.pripojeniplynkod),
          waterConnection: domainLabel(buildingMeta, 'pripojenivodovodkod', b.pripojenivodovodkod),
          heating: domainLabel(buildingMeta, 'zpusobvytapenikod', b.zpusobvytapenikod)
        };
      }).slice(0, 30);
    }
  } else {
    buildingQueryFailed = true;
  }

  const parcelEvidence: EvidenceItem = {
    id: 'cz-cuzk-ruian-parcel',
    category: 'Cadastre & identification',
    claim: `ČÚZK RÚIAN identifies parcel ${parcel.parcelNumber || parcel.id}${parcel.areaM2 !== null ? ` with registered area ${parcel.areaM2.toLocaleString('cs-CZ')} m²` : ''}${parcel.cadastralAreaName ? ` in cadastral area ${parcel.cadastralAreaName}` : ''}.`,
    status: 'VERIFIED',
    sourceName: SOURCE_NAME,
    sourceUrl: SERVICE,
    datasetDate: today(),
    spatialRelationship: geometryPoints ? 'Official RÚIAN parcel polygon containing the selected coordinate' : 'RÚIAN parcel feature containing the selected coordinate; geometry was not usable for the report boundary',
    calculationMethod: 'Point-in-polygon query of RÚIAN parcel layer 5 with WGS84 output; coded land attributes decoded from live ArcGIS field domains',
    confidence: 'High',
    limitation: 'RÚIAN supports territorial identification and registered parcel geometry/attributes. It does not establish ownership, title, easements, encumbrances or the legal conclusiveness of a boundary; verify those in the Czech Cadastre of Real Estate (KN/ISKN).',
    value: parcel
  };

  const buildingEvidence: EvidenceItem = buildingQueryFailed ? {
    id: 'cz-cuzk-ruian-buildings-unavailable',
    category: 'Registered building context',
    claim: 'Building-object acquisition for the identified parcel could not be completed safely.',
    status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE_NAME,
    sourceUrl: `${SERVICE}/3`,
    datasetDate: today(),
    spatialRelationship: 'Identified cadastral parcel polygon',
    calculationMethod: 'Polygon-intersection query of RÚIAN building-object layer 3',
    confidence: 'Low',
    limitation: 'The parcel remains identified, but building presence and attributes require verification in RÚIAN/KN because the building query or usable parcel geometry was unavailable.',
    value: { reasonCode: 'SOURCE_UNAVAILABLE' }
  } : buildings.length ? {
    id: 'cz-cuzk-ruian-buildings',
    category: 'Registered building context',
    claim: `ČÚZK RÚIAN returned ${buildings.length} registered building object${buildings.length === 1 ? '' : 's'} intersecting the identified parcel.`,
    status: 'VERIFIED',
    sourceName: SOURCE_NAME,
    sourceUrl: `${SERVICE}/3`,
    datasetDate: today(),
    spatialRelationship: 'Building polygons intersecting the identified RÚIAN parcel polygon',
    calculationMethod: 'ArcGIS polygon-intersection query of RÚIAN building-object layer 3; coded attributes decoded from the live layer domains',
    confidence: 'High',
    limitation: 'RÚIAN building attributes are registry evidence, not a structural survey, building-condition assessment, valuation or confirmation that every physical structure is represented. Legal status and title remain subject to KN/ISKN verification.',
    value: { buildingCount: buildings.length, buildings }
  } : {
    id: 'cz-cuzk-ruian-buildings-no-data',
    category: 'Registered building context',
    claim: 'No RÚIAN building polygon was returned as intersecting the identified parcel.',
    status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE_NAME,
    sourceUrl: `${SERVICE}/3`,
    datasetDate: today(),
    spatialRelationship: 'Identified RÚIAN parcel polygon',
    calculationMethod: 'ArcGIS polygon-intersection query of RÚIAN building-object layer 3',
    confidence: 'Medium',
    limitation: 'A zero-feature building query is not treated as proof of an undeveloped parcel because some registered buildings may lack usable geometry or require separate cadastral verification.',
    value: { reasonCode: 'NO_DATA', buildingCount: 0 }
  };

  return {
    success: true,
    sourceName: SOURCE_NAME,
    sourceUrl: SERVICE,
    datasetDate: today(),
    parcel,
    buildings,
    evidence: [parcelEvidence, buildingEvidence],
    limitation: `${parcelEvidence.limitation} ${buildingEvidence.limitation}`
  };
}

export function applyCzechiaCadastreToReport(report: any, result: CzechiaCadastreResult, requestedAreaM2: number): void {
  if (!report || !result.success || !result.parcel) return;
  const parcel = result.parcel;
  report.evidenceRegistry = Array.isArray(report.evidenceRegistry)
    ? report.evidenceRegistry.filter((record: any) => record?.id !== 'cadastre-spatial-index' && record?.id !== 'cadastre-parcel-id')
    : [];
  report.evidenceRegistry.push(...result.evidence);
  report.parcel = {
    ...(report.parcel || {}),
    status: 'VERIFIED',
    parcelId: parcel.parcelNumber || parcel.id,
    commune: parcel.municipality || report.parcel?.commune,
    county: parcel.district || report.parcel?.county,
    voivodeship: parcel.region || report.parcel?.voivodeship,
    region: parcel.cadastralAreaName || report.parcel?.region,
    countryCode: 'CZ',
    geometryPoints: parcel.geometryPoints,
    isOfficialGeometry: Boolean(parcel.geometryPoints?.length && parcel.geometryPoints.length >= 3),
    areaCalculatedM2: requestedAreaM2,
    officialAreaM2: parcel.areaM2 ?? undefined,
    cadastralSource: SOURCE_NAME,
    datasetDate: result.datasetDate,
    limitation: result.limitation
  };
  report.czechia_cadastre = {
    sourceName: result.sourceName,
    sourceUrl: result.sourceUrl,
    parcel: result.parcel,
    buildings: result.buildings,
    limitation: result.limitation
  };
}

export const CZECHIA_CADASTRE_SOURCE = { sourceName: SOURCE_NAME, serviceUrl: SERVICE, portalUrl: PORTAL };
