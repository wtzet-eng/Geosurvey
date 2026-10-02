import type { EvidenceItem } from '../types';

const WFS_URL = 'https://inspire.lechnerkozpont.hu/geoserver/CP/ows';
const PORTAL_URL = 'https://www.lechnerkozpont.hu/';

export interface HungaryCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
  sourceName: string;
  sourceUrl: string;
  coverageScope: string;
  parcel?: {
    parcelId: string;
    officialAreaM2?: number;
    geometryPoints?: [number, number][];
    cadastralMunicipality?: string;
  };
  evidence: EvidenceItem[];
  limitation: string;
}

function pointInRing(point: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  const [px, py] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = ((yi > py) !== (yj > py)) && px < (xj - xi) * (py - yi) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function featureContainsPoint(feature: any, lng: number, lat: number): [number, number][] | undefined {
  const geometry = feature?.geometry;
  const polygons = geometry?.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon'
      ? geometry.coordinates
      : [];
  for (const polygon of polygons) {
    const outer = polygon?.[0];
    if (!Array.isArray(outer) || outer.length < 3) continue;
    const ring = outer.map((p: any) => [Number(p?.[0]), Number(p?.[1])] as [number, number]);
    if (ring.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) && pointInRing([lng, lat], ring)) return ring;
  }
  return undefined;
}

function parseParcel(data: any, lng: number, lat: number) {
  const features = Array.isArray(data?.features) ? data.features : [];
  for (const feature of features) {
    const p = feature?.properties || {};
    const geometryPoints = featureContainsPoint(feature, lng, lat);
    if (!geometryPoints) continue;
    const parcelId = String(
      p.nationalcadastralreference ??
      p.label ??
      p.id_localid ??
      p.localid ??
      p.inspireid ??
      ''
    ).trim();
    if (!parcelId) continue;
    const area = Number(p.areavalue ?? p.areaValue ?? p.area ?? p.area_m2);
    return {
      parcelId,
      officialAreaM2: Number.isFinite(area) ? area : undefined,
      geometryPoints,
      cadastralMunicipality: String(p.administrativeunit ?? p.zoning ?? '').trim() || undefined
    };
  }
  return null;
}

export async function queryHungaryCadastre(lat: number, lng: number, fetcher: typeof fetch = fetch): Promise<HungaryCadastreResult> {
  const sourceName = 'Lechner Tudásközpont — INSPIRE cadastral parcels';
  const coverageScope = 'The currently exposed public INSPIRE feature service contains a cadastral-parcel dataset for Mesterszállás, not a nationwide parcel query service.';
  const limitation = 'Official cadastral screening evidence. The public feature service currently exposes Mesterszállás only; nationwide cadastral map data and legally conclusive ownership, title, easements and boundaries require the appropriate official Lechner / land-registry service and verification.';
  try {
    const delta = 0.0005;
    const params = new URLSearchParams({
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeNames: 'CP:CP.CadastralParcels',
      outputFormat: 'application/json',
      srsName: 'EPSG:4326',
      bbox: [lng - delta, lat - delta, lng + delta, lat + delta, 'EPSG:4326'].join(','),
      count: '50'
    });
    const response = await fetcher(`${WFS_URL}?${params.toString()}`, {
      headers: { Accept: 'application/geo+json, application/json' }
    });
    if (!response.ok) {
      return {
        success: false,
        reasonCode: 'SOURCE_UNAVAILABLE',
        sourceName,
        sourceUrl: WFS_URL,
        coverageScope,
        evidence: [{
          id: 'hu-lechner-cadastre-unavailable',
          category: 'Cadastre & Identification',
          claim: 'The public Hungarian INSPIRE cadastral feature service could not be queried reliably for the selected location.',
          status: 'REQUIRES_VERIFICATION',
          sourceName,
          sourceUrl: WFS_URL,
          datasetDate: new Date().toISOString().slice(0, 10),
          spatialRelationship: 'Selected site coordinate',
          calculationMethod: 'Lechner INSPIRE WFS coordinate query',
          confidence: 'Low',
          limitation,
          value: { coverageScope, portalUrl: PORTAL_URL }
        }],
        limitation
      };
    }
    const data = await response.json();
    const parcel = parseParcel(data, lng, lat);
    if (!parcel) {
      return {
        success: false,
        reasonCode: 'NO_DATA',
        sourceName,
        sourceUrl: WFS_URL,
        coverageScope,
        evidence: [{
          id: 'hu-lechner-cadastre-no-data',
          category: 'Cadastre & Identification',
          claim: 'The public Hungarian INSPIRE cadastral service was queried at the selected coordinate but did not return an identifiable parcel. The service currently exposes a Mesterszállás dataset rather than nationwide parcel coverage.',
          status: 'REQUIRES_VERIFICATION',
          sourceName,
          sourceUrl: WFS_URL,
          datasetDate: new Date().toISOString().slice(0, 10),
          spatialRelationship: 'Selected site coordinate',
          calculationMethod: 'Lechner INSPIRE WFS spatial query',
          confidence: 'Medium',
          limitation,
          value: { coverageScope, portalUrl: PORTAL_URL }
        }],
        limitation
      };
    }

    return {
      success: true,
      sourceName,
      sourceUrl: WFS_URL,
      coverageScope,
      parcel,
      evidence: [{
        id: 'hu-lechner-cadastre-parcel',
        category: 'Cadastre & Identification',
        claim: `Lechner INSPIRE cadastral parcel ${parcel.parcelId} was identified at the selected location.`,
        status: 'VERIFIED',
        sourceName,
        sourceUrl: WFS_URL,
        datasetDate: new Date().toISOString().slice(0, 10),
        spatialRelationship: 'Public cadastral parcel polygon contains the selected coordinate',
        calculationMethod: 'Lechner INSPIRE WFS GetFeature on CP:CP.CadastralParcels in EPSG:4326',
        confidence: 'High',
        limitation,
        value: parcel
      }],
      limitation
    };
  } catch {
    return {
      success: false,
      reasonCode: 'SOURCE_UNAVAILABLE',
      sourceName,
      sourceUrl: WFS_URL,
      coverageScope,
      evidence: [{
        id: 'hu-lechner-cadastre-error',
        category: 'Cadastre & Identification',
        claim: 'The public Hungarian INSPIRE cadastral service returned an error or an unreadable response.',
        status: 'REQUIRES_VERIFICATION',
        sourceName,
        sourceUrl: WFS_URL,
        datasetDate: new Date().toISOString().slice(0, 10),
        spatialRelationship: 'Selected site coordinate',
        calculationMethod: 'Lechner INSPIRE WFS coordinate query',
        confidence: 'Low',
        limitation,
        value: { coverageScope, portalUrl: PORTAL_URL }
      }],
      limitation
    };
  }
}
