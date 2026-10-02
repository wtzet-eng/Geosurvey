import type { EvidenceItem } from '../types';

const SERVICE_URL = 'https://eservices.dls.moi.gov.cy/inspire/rest/services/INSPIRE/CP_CadastralParcels/MapServer';
const QUERY_URL = `${SERVICE_URL}/1/query`;
const WMS_URL = `${SERVICE_URL}/exts/InspireView/service`;
const SOURCE_NAME = 'Cyprus Department of Lands and Surveys (DLS) — INSPIRE cadastral parcels';
const PORTAL_URL = 'https://www.data.gov.cy/en/dataset/537';

export interface CyprusCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
  sourceName: string;
  sourceUrl: string;
  viewServiceUrl: string;
  viewLayer: string;
  viewAttribution: string;
  parcel?: {
    parcelId: string;
    officialAreaM2?: number;
    geometryPoints?: [number, number][];
  };
  geometryPoints?: [number, number][];
  evidence: EvidenceItem[];
  limitation: string;
}

function pointInRing(point: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  const [px, py] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = ((yi > py) !== (yj > py)) && px < (xj - xi) * (py - yi) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function polygonRing(geometry: any, lat: number, lng: number): [number, number][] | undefined {
  const polygons = geometry?.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon'
      ? geometry.coordinates
      : [];

  for (const polygon of polygons) {
    const outer = polygon?.[0];
    if (!Array.isArray(outer) || outer.length < 3) continue;
    const ring = outer.map((p: any) => [Number(p?.[0]), Number(p?.[1])] as [number, number]);
    if (ring.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) && pointInRing([lng, lat], ring)) {
      return ring.map(([x, y]) => [y, x]);
    }
  }
  return undefined;
}

function unavailable(reasonCode: CyprusCadastreResult['reasonCode'], claim: string): CyprusCadastreResult {
  const limitation = 'Official cadastral screening evidence from Cyprus DLS. The mapped parcel is not proof of ownership, encumbrances or the legal conclusiveness of a boundary survey.';
  return {
    success: false,
    reasonCode,
    sourceName: SOURCE_NAME,
    sourceUrl: SERVICE_URL,
    viewServiceUrl: WMS_URL,
    viewLayer: 'Cadastral Parcel',
    viewAttribution: '© Cyprus Department of Lands and Surveys — INSPIRE Cadastral Parcels',
    evidence: [{
      id: 'cy-dls-cadastre-unavailable',
      category: 'Cadastre & Identification',
      claim,
      status: 'REQUIRES_VERIFICATION',
      sourceName: SOURCE_NAME,
      sourceUrl: SERVICE_URL,
      datasetDate: new Date().toISOString().slice(0, 10),
      spatialRelationship: 'Selected site coordinate',
      calculationMethod: 'Cyprus DLS INSPIRE ArcGIS REST spatial query',
      confidence: 'Low',
      limitation,
      value: { reasonCode, portalUrl: PORTAL_URL }
    }],
    limitation
  };
}

export async function queryCyprusCadastre(lat: number, lng: number, fetcher: typeof fetch = fetch): Promise<CyprusCadastreResult> {
  const limitation = 'Official cadastral screening evidence from Cyprus DLS. The mapped parcel is not proof of ownership, encumbrances or the legal conclusiveness of a boundary survey.';
  try {
    const params = new URLSearchParams({
      f: 'geojson',
      where: '1=1',
      geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      resultRecordCount: '5'
    });
    const response = await fetcher(`${QUERY_URL}?${params.toString()}`, {
      headers: { Accept: 'application/geo+json, application/json' }
    });
    if (!response.ok) return unavailable('SOURCE_UNAVAILABLE', 'The official Cyprus DLS cadastral service could not be queried reliably.');

    const data = await response.json();
    if (!Array.isArray(data?.features)) return unavailable('MALFORMED_DATA', 'The official Cyprus DLS cadastral response did not contain a feature collection.');

    const feature = data.features.find((item: any) => polygonRing(item?.geometry, lat, lng));
    if (!feature) return unavailable('NO_DATA', 'The official Cyprus DLS cadastral service was queried at the selected coordinate but returned no identifiable parcel.');

    const properties = feature.properties || {};
    const parcelId = String(
      properties.id_localId ??
      properties.id_localid ??
      properties.nationalCadastralReference ??
      properties.label ??
      properties.IFCID ??
      properties.OBJECTID ??
      ''
    ).trim();
    if (!parcelId) return unavailable('MALFORMED_DATA', 'The official Cyprus cadastral feature did not contain an identifiable parcel reference.');

    const area = Number(properties.areaValue ?? properties.areavalue);
    const geometryPoints = polygonRing(feature.geometry, lat, lng);
    const parcel = {
      parcelId,
      officialAreaM2: Number.isFinite(area) ? area : undefined,
      geometryPoints
    };

    const evidence: EvidenceItem = {
      id: 'cy-dls-cadastre-parcel',
      category: 'Cadastre & Identification',
      claim: `Cyprus DLS cadastral parcel ${parcelId} was identified at the selected location${parcel.officialAreaM2 !== undefined ? ` with mapped area ${parcel.officialAreaM2.toLocaleString('en-GB')} m²` : ''}.`,
      status: 'VERIFIED',
      sourceName: SOURCE_NAME,
      sourceUrl: SERVICE_URL,
      datasetDate: new Date().toISOString().slice(0, 10),
      spatialRelationship: 'Official cadastral parcel polygon contains the selected coordinate',
      calculationMethod: 'Cyprus DLS INSPIRE CP.CadastralParcel ArcGIS REST point-intersection query in EPSG:4326',
      confidence: 'High',
      limitation,
      value: parcel
    };

    return {
      success: true,
      sourceName: SOURCE_NAME,
      sourceUrl: SERVICE_URL,
      viewServiceUrl: WMS_URL,
      viewLayer: 'Cadastral Parcel',
      viewAttribution: '© Cyprus Department of Lands and Surveys — INSPIRE Cadastral Parcels',
      parcel,
      geometryPoints,
      evidence: [evidence],
      limitation
    };
  } catch {
    return unavailable('SOURCE_UNAVAILABLE', 'The official Cyprus DLS cadastral service returned an error or unreadable response.');
  }
}
