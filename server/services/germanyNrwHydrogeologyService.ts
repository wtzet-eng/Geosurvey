import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyNrwHydrogeologyResult {
  state: 'Nordrhein-Westfalen';
  evidence: EvidenceItem[];
  aquiferFound: boolean;
  aquitardFound: boolean;
}

const HK100_API = 'https://ogc-api.nrw.de/inspire-ge-hk100/v1';
const SOURCE = 'Geologischer Dienst NRW — Hydrogeologische Karte NRW 1:100.000 (HK100)';
const STATE = 'Nordrhein-Westfalen' as const;
const today = () => new Date().toISOString().slice(0, 10);

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function noData(id: string, claim: string, url: string, reasonCode: string): EvidenceItem {
  return {
    id,
    category: 'Hydrogeology',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE,
    sourceUrl: url,
    datasetDate: today(),
    spatialRelationship: 'Selected site coordinate in Nordrhein-Westfalen',
    calculationMethod: 'Official GD NRW OGC API Features acquisition; empty or failed responses are not interpreted as negative findings',
    confidence: 'Low',
    limitation: 'An empty, failed or structurally invalid service response does not establish absence. Confirm the current official GD NRW record where necessary.',
    value: { reasonCode }
  };
}

async function fetchJson(url: string, fetcher: typeof fetch): Promise<{ ok: boolean; data?: any; status?: number }> {
  try {
    const response = await fetcher(url, {
      headers: {
        Accept: 'application/json, application/geo+json',
        'User-Agent': 'GroundSurf/1.0 NRW hydrogeology evidence'
      }
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false };
  }
}

function collectionText(collection: any): string {
  return [
    collection?.id,
    collection?.title,
    collection?.description,
    collection?.keywords?.join?.(' ')
  ].filter(Boolean).join(' ').toLowerCase();
}

function findCollection(collections: any[], terms: string[]): any | null {
  return collections.find(collection => {
    const value = collectionText(collection);
    return terms.some(term => value.includes(term));
  }) || null;
}

function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i]?.[0]), yi = Number(ring[i]?.[1]);
    const xj = Number(ring[j]?.[0]), yj = Number(ring[j]?.[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGeometry(x: number, y: number, geometry: any): boolean {
  if (!geometry || typeof geometry !== 'object') return false;
  if (geometry.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    return Array.isArray(rings[0]) && pointInRing(x, y, rings[0]);
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    return polygons.some((polygon: any) => Array.isArray(polygon?.[0]) && pointInRing(x, y, polygon[0]));
  }
  return false;
}

function summarizeProperties(properties: Record<string, unknown> | undefined): string {
  if (!properties) return '';
  return Object.entries(properties)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim())
    .slice(0, 10)
    .map(([key, value]) => key + '=' + String(value))
    .join('; ');
}

async function queryCollection(
  collection: any,
  lat: number,
  lng: number,
  fetcher: typeof fetch
): Promise<{ feature: any | null; url: string }> {
  const id = text(collection?.id);
  const fallbackUrl = HK100_API + '/collections/' + encodeURIComponent(id || 'unknown') + '/items';
  if (!id) return { feature: null, url: fallbackUrl };

  const delta = 0.001;
  const params = new URLSearchParams({
    f: 'json',
    limit: '5',
    bbox: [
      (lng - delta).toFixed(6),
      (lat - delta).toFixed(6),
      (lng + delta).toFixed(6),
      (lat + delta).toFixed(6)
    ].join(',')
  });
  const url = fallbackUrl + '?' + params.toString();
  const response = await fetchJson(url, fetcher);
  if (!response.ok || !response.data) return { feature: null, url };

  const features = Array.isArray(response.data.features) ? response.data.features : [];
  const containing = features.find((feature: any) => pointInGeometry(lng, lat, feature?.geometry));
  return { feature: containing || null, url };
}

function buildEvidence(
  id: string,
  type: 'aquifer' | 'aquitard',
  collection: any,
  feature: any,
  url: string
): EvidenceItem {
  const title = text(collection?.title) || text(collection?.id) || (type === 'aquifer' ? 'Aquifer' : 'Aquitard');
  const properties = feature?.properties && typeof feature.properties === 'object' ? feature.properties : {};
  const propertySummary = summarizeProperties(properties);
  const kind = type === 'aquifer' ? 'Grundwasserleiter (Aquifer)' : 'Grundwassergeringleiter (Aquitard)';
  const claim = 'The official GD NRW HK100 identifies the selected location within the mapped hydrogeological theme ' + kind + '. The mapped unit is ' + title + (propertySummary ? ' (' + propertySummary + ')' : '') + '.';

  return {
    id,
    category: 'Hydrogeology',
    claim,
    status: 'VERIFIED',
    sourceName: SOURCE,
    sourceUrl: url,
    datasetDate: today(),
    spatialRelationship: 'Official HK100 polygon contains the selected coordinate',
    calculationMethod: 'GD NRW OGC API Features spatial query against the official INSPIRE HK100 dataset using a small WGS84 bounding box followed by local point-in-polygon verification',
    confidence: 'Medium',
    limitation: 'HK100 is regional hydrogeological mapping. It describes the hydrogeological character of the upper groundwater system; it does not provide a site-specific groundwater depth, seasonal water level or excavation dewatering requirement.',
    value: {
      collectionId: collection.id,
      collectionTitle: collection.title || null,
      properties
    }
  };
}

async function queryHydrogeology(
  lat: number,
  lng: number,
  fetcher: typeof fetch
): Promise<GermanyNrwHydrogeologyResult> {
  const collectionsUrl = HK100_API + '/collections?f=json';
  const root = await fetchJson(collectionsUrl, fetcher);
  if (!root.ok || !root.data) {
    const unavailable = noData(
      'de-nrw-hk100-unavailable',
      'The official GD NRW Hydrogeologische Karte 1:100.000 service could not be reached.',
      collectionsUrl,
      'SOURCE_UNAVAILABLE'
    );
    return { state: STATE, evidence: [unavailable], aquiferFound: false, aquitardFound: false };
  }

  const collections = Array.isArray(root.data.collections) ? root.data.collections : [];
  const aquiferCollection = findCollection(collections, ['grundwasserleiter', 'aquifer']);
  const aquitardCollection = findCollection(collections, ['grundwassergeringleiter', 'aquitard']);

  const evidence: EvidenceItem[] = [];
  let aquiferFound = false;
  let aquitardFound = false;

  if (aquiferCollection) {
    const result = await queryCollection(aquiferCollection, lat, lng, fetcher);
    if (result.feature) {
      evidence.push(buildEvidence('de-nrw-hk100-aquifer', 'aquifer', aquiferCollection, result.feature, result.url));
      aquiferFound = true;
    }
  }

  if (aquitardCollection) {
    const result = await queryCollection(aquitardCollection, lat, lng, fetcher);
    if (result.feature) {
      evidence.push(buildEvidence('de-nrw-hk100-aquitard', 'aquitard', aquitardCollection, result.feature, result.url));
      aquitardFound = true;
    }
  }

  if (!evidence.length) {
    evidence.push(noData(
      'de-nrw-hk100-no-data',
      'The official GD NRW HK100 service did not return a usable hydrogeological feature for the selected coordinate.',
      collectionsUrl,
      'INSUFFICIENT_EVIDENCE'
    ));
  }

  return { state: STATE, evidence, aquiferFound, aquitardFound };
}

export async function queryGermanyNrwHydrogeology(
  lat: number,
  lng: number,
  state: string | null | undefined,
  fetcher: typeof fetch = fetch
): Promise<GermanyNrwHydrogeologyResult> {
  const normalized = String(state || '').trim().toLowerCase();
  const stateOk = !normalized
    || normalized === 'nordrhein-westfalen'
    || normalized === 'north rhine-westphalia'
    || normalized.includes('nordrhein-westfalen');
  if (!stateOk) return { state: STATE, evidence: [], aquiferFound: false, aquitardFound: false };
  return queryHydrogeology(lat, lng, fetcher);
}

export function enrichGermanyNrwHydrogeology(
  report: VerifiedSiteReport & Record<string, any>,
  result: GermanyNrwHydrogeologyResult
): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...result.evidence);

  const aquifer = result.evidence.find(item => item.id === 'de-nrw-hk100-aquifer' && item.status === 'VERIFIED');
  const aquitard = result.evidence.find(item => item.id === 'de-nrw-hk100-aquitard' && item.status === 'VERIFIED');

  report.geosurvey_context = {
    ...(report.geosurvey_context || {}),
    nrw_hk100_aquifer_mapped: Boolean(aquifer),
    nrw_hk100_aquitard_mapped: Boolean(aquitard),
    nrw_hk100_evidence_level: aquifer || aquitard ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
    nrw_hk100_source: SOURCE
  };

  if (report.soil && (aquifer || aquitard)) {
    report.soil.groundwaterNotice = [
      aquifer?.claim,
      aquitard?.claim,
      'This NRW hydrogeological mapping is useful for screening groundwater conditions, but it does not establish the current groundwater depth or whether excavation will require dewatering.'
    ].filter(Boolean).join(' ');
  }
}

export const GERMANY_NRW_HYDROGEOLOGY_SOURCES = {
  ogcApi: HK100_API,
  dataset: 'Informationssystem Hydrogeologische Karte NRW 1:100.000 (HK100)',
  themes: ['Grundwasserleiter (Aquifer)', 'Grundwassergeringleiter (Aquitard)', 'Geologisches Ereignis']
};
