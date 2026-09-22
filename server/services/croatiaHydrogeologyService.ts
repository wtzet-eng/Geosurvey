import type { EvidenceItem, VerifiedSiteReport } from '../types';
import type { AvailabilityReason } from '../reporting/canonicalReport';

type FetchLike = typeof fetch;
type CroatiaHydroReason = Extract<AvailabilityReason, 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA'>;

export const CROATIA_HV_WMS = 'https://servisi.voda.hr/wms';
export const CROATIA_GROUNDWATER_LAYER = 'WFD_Reporting:hr.wfd-podzemna-vodna-tijela';
const SOURCE_NAME = 'Hrvatske vode — WFD groundwater bodies';

type Position = [number, number];
type Polygon = Position[][];
type MultiPolygon = Polygon[];
type Feature = { id?: string; geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> };

type GroundwaterResult = {
  evidence: EvidenceItem;
  bodyName: string | null;
  bodyCode: string | null;
  quantitativeStatus: string | null;
  chemicalStatus: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text && !/^notapplicable|null|none|unknown|n\/a$/i.test(text) ? text : null;
}

function status(value: unknown): string | null {
  const code = clean(value);
  if (code === '2') return 'Good';
  if (code === '3') return 'Poor';
  if (/^u$/i.test(code || '')) return 'Unknown';
  return code;
}

function pointInRing(point: Position, ring: Polygon[0]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    const crosses = ((b[1] > point[1]) !== (a[1] > point[1]))
      && point[0] < ((a[0] - b[0]) * (point[1] - b[1])) / (a[1] - b[1]) + b[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: Position, polygon: Polygon): boolean {
  if (!polygon.length || !pointInRing(point, polygon[0])) return false;
  return !polygon.slice(1).some(ring => pointInRing(point, ring));
}

function containsGeometry(point: Position, geometry: Feature['geometry']): boolean {
  if (!geometry?.coordinates) return false;
  if (geometry.type === 'Polygon') return pointInPolygon(point, geometry.coordinates as Polygon);
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates as MultiPolygon).some(polygon => pointInPolygon(point, polygon));
  return false;
}

function unavailable(reasonCode: CroatiaHydroReason, claim: string): EvidenceItem & { reasonCode: CroatiaHydroReason } {
  return {
    id: `hr-groundwater-${reasonCode.toLowerCase()}`,
    category: 'Groundwater body', claim, status: 'REQUIRES_VERIFICATION', sourceName: SOURCE_NAME,
    sourceUrl: CROATIA_HV_WMS, datasetDate: today(), spatialRelationship: 'Selected site coordinate',
    calculationMethod: 'Hrvatske vode WMS GetFeatureInfo with exact coordinate validation against returned GeoJSON geometry', confidence: 'Low',
    limitation: 'Groundwater-body mapping is regional water-management evidence. It does not provide a measured groundwater level, seasonal water-table depth, pore pressure, or parcel-specific hydrogeological design value.',
    value: { reasonCode }, reasonCode
  };
}

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 9000): Promise<{ status: number; text: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json, text/plain, */*', 'User-Agent': 'LandSurf/1.0 Croatia groundwater evidence' }, signal: controller.signal });
    return { status: response.status, text: response.ok ? await response.text() : '' };
  } catch { return null; }
  finally { clearTimeout(timer); }
}

async function queryGroundwater(lat: number, lng: number, fetcher: FetchLike): Promise<Feature[]> {
  const d = 0.002;
  const params = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo',
    LAYERS: CROATIA_GROUNDWATER_LAYER, STYLES: '', QUERY_LAYERS: CROATIA_GROUNDWATER_LAYER,
    CRS: 'EPSG:4326', BBOX: `${lat - d},${lng - d},${lat + d},${lng + d}`,
    WIDTH: '101', HEIGHT: '101', I: '50', J: '50', INFO_FORMAT: 'application/json', FEATURE_COUNT: '10'
  });
  const response = await fetchJson(fetcher, `${CROATIA_HV_WMS}?${params}`, 10000);
  if (!response) throw new Error('source_unavailable');
  if (response.status < 200 || response.status >= 300 || !response.text) throw new Error('source_unavailable');
  try {
    const parsed = JSON.parse(response.text) as { type?: string; features?: Feature[] };
    if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) throw new Error('malformed');
    return parsed.features;
  } catch {
    throw new Error('malformed');
  }
}

function buildEvidence(lat: number, lng: number, feature: Feature): GroundwaterResult {
  const p = feature.properties || {};
  const bodyName = clean(p.nameText) || clean(p.nameTxtInt);
  const bodyCode = clean(p.localId) || clean(p.thematicId);
  const quantitativeStatus = status(p.QuantitativeStatusValue);
  const chemicalStatus = status(p.ChemicalStatusValue);
  const area = clean(p.sizeValue) && clean(p.sizeUoM) ? `${p.sizeValue} ${p.sizeUoM}` : null;
  const claim = `The selected coordinate falls within the Hrvatske vode groundwater body${bodyName ? ` ${bodyName}` : ''}${bodyCode ? ` (${bodyCode})` : ''}${quantitativeStatus || chemicalStatus ? `; quantitative status: ${quantitativeStatus || 'not returned'}, chemical status: ${chemicalStatus || 'not returned'}` : ''}.`;
  const evidence: EvidenceItem = {
    id: 'hr-groundwater-body-site', category: 'Groundwater body', claim, status: 'VERIFIED', sourceName: SOURCE_NAME,
    sourceUrl: CROATIA_HV_WMS, datasetDate: today(), spatialRelationship: 'Official groundwater-body feature containing the exact selected coordinate',
    calculationMethod: 'Hrvatske vode WMS GetFeatureInfo, GeoJSON parsing, and point-in-polygon validation', confidence: 'Medium',
    limitation: 'This identifies the regional groundwater-management body and its reported WFD status. It does not establish the groundwater level beneath the parcel, seasonal variation, hydraulic head, infiltration rate or construction dewatering requirement.',
    value: {
      groundwaterBodyName: bodyName, groundwaterBodyCode: bodyCode, quantitativeStatus, chemicalStatus,
      areaKm2: area && p.sizeUoM === 'km2' ? Number(p.sizeValue) : null,
      horizon: clean(p.horizons), reportingVersion: clean(p.versionId), regionCode: clean(p.rZoneId),
      sourceFeatureId: feature.id || null, coordinate: { lat, lng }
    }
  };
  return { evidence, bodyName, bodyCode, quantitativeStatus, chemicalStatus };
}

export type CroatiaHydrogeologyEvidence = EvidenceItem & { reasonCode?: CroatiaHydroReason };

export async function fetchCroatiaGroundwaterEvidence(
  lat: number, lng: number, fetcher: FetchLike = fetch
): Promise<CroatiaHydrogeologyEvidence> {
  try {
    const features = await queryGroundwater(lat, lng, fetcher);
    const point: Position = [lng, lat];
    const containing = features.find(feature => containsGeometry(point, feature.geometry));
    if (!containing) return unavailable('NO_DATA', 'Hrvatske vode returned no groundwater-body polygon containing the selected coordinate.');
    return buildEvidence(lat, lng, containing).evidence as CroatiaHydrogeologyEvidence;
  } catch (error) {
    const reasonCode = error instanceof Error && error.message === 'malformed' ? 'MALFORMED_DATA' : 'SOURCE_UNAVAILABLE';
    console.warn('[Croatia groundwater acquisition]', { error: error instanceof Error ? error.name : 'request_failed' });
    return unavailable(reasonCode, reasonCode === 'MALFORMED_DATA' ? 'Hrvatske vode returned a groundwater response that was not safely usable.' : 'Hrvatske vode groundwater service could not be reached reliably at analysis time.');
  }
}

export function enrichCroatiaGroundwaterEvidence(
  report: VerifiedSiteReport & Record<string, any>, evidence: CroatiaHydrogeologyEvidence
): void {
  if (evidence.status !== 'VERIFIED' || evidence.id !== 'hr-groundwater-body-site') return;
  const value = (evidence.value || {}) as Record<string, unknown>;
  const bodyName = clean(value.groundwaterBodyName);
  const bodyCode = clean(value.groundwaterBodyCode);
  const quantitativeStatus = clean(value.quantitativeStatus);
  const chemicalStatus = clean(value.chemicalStatus);
  report.soil = {
    ...report.soil,
    groundwaterRegime: [bodyName && `Groundwater body: ${bodyName}${bodyCode ? ` (${bodyCode})` : ''}`, quantitativeStatus && `quantitative status: ${quantitativeStatus}`, chemicalStatus && `chemical status: ${chemicalStatus}`].filter(Boolean).join('; ') || report.soil.groundwaterRegime,
    groundwaterNotice: 'Regional groundwater-body evidence only; groundwater level and seasonal variation are not measured at the selected parcel.'
  };
  report.geosurvey_context = {
    ...(report.geosurvey_context || {}),
    groundwater_body_name: bodyName, groundwater_body_code: bodyCode,
    groundwater_quantitative_status: quantitativeStatus, groundwater_chemical_status: chemicalStatus,
    groundwater_evidence_level: 'VERIFIED', groundwater_source_name: evidence.sourceName, groundwater_source_url: evidence.sourceUrl
  };
}
