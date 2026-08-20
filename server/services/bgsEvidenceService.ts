import { EvidenceLevel } from '../types';

export type EvidenceTier = 1 | 2 | 3 | 4;
export interface BgsGeologyEvidence {
  available: boolean;
  tier: EvidenceTier;
  status: EvidenceLevel;
  unitName: string | null;
  lithology: string | null;
  geologicalAge: string | null;
  superficialDeposit: string | null;
  sourceName: string;
  sourceUrl: string;
  scale: string | null;
  limitation: string;
}
export interface BgsGroundwaterEvidence {
  available: boolean;
  tier: EvidenceTier;
  status: EvidenceLevel;
  modelledDepth: string | null;
  sourceName: string;
  sourceUrl: string;
  limitation: string;
}
export interface BgsBoreholeContext {
  available: boolean;
  tier: EvidenceTier;
  count: number;
  nearestDistanceKm: number | null;
  nearestRecordId: string | null;
  sourceName: string;
  sourceUrl: string;
  limitation: string;
}
export interface BgsSiteEvidence { geology: BgsGeologyEvidence; groundwater: BgsGroundwaterEvidence; boreholes: BgsBoreholeContext; }

export const ukGeotechnicalDesignFallback = () => ({
  bearingCapacity: 'Not available — no verified site-specific engineering data',
  frictionAngle: NaN,
  cohesion: NaN,
  hydraulicConductivity: 'Not available — no engineering source queried',
  drainageClass: 'Not available — no engineering source queried'
});

type FetchLike = typeof fetch;
type ArcLayer = { id: number; name?: string; maxScale?: number; minScale?: number };
type Endpoint = { url: string; tier: 1 | 2; scale: string; label: string };

export const BGS_ENDPOINTS = {
  detailed: 'https://map.bgs.ac.uk/arcgis/rest/services/BGS_Detailed_Geology/MapServer',
  regional: 'https://map.bgs.ac.uk/arcgis/rest/services/BGS_Geology_625k/MapServer',
  geoIndex: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/MapServer'
} as const;
type BgsEndpoints = { detailed: string; regional: string; geoIndex: string };

const unavailableGeology = (): BgsGeologyEvidence => ({ available: false, tier: 4, status: 'REQUIRES_VERIFICATION', unitName: null, lithology: null, geologicalAge: null, superficialDeposit: null, sourceName: 'British Geological Survey', sourceUrl: 'https://mapapps2.bgs.ac.uk/geoindex/home.html', scale: null, limitation: 'BGS geology services were unavailable or returned no mapped geology at the site coordinate. No geological unit was inferred.' });
const unavailableGroundwater = (): BgsGroundwaterEvidence => ({ available: false, tier: 4, status: 'REQUIRES_VERIFICATION', modelledDepth: null, sourceName: 'British Geological Survey', sourceUrl: 'https://www.bgs.ac.uk/geological-hazards/groundwater/', limitation: 'No validated BGS groundwater model value was returned. A design groundwater level requires site observation.' });
const unavailableBoreholes = (): BgsBoreholeContext => ({ available: false, tier: 4, count: 0, nearestDistanceKm: null, nearestRecordId: null, sourceName: 'British Geological Survey GeoIndex', sourceUrl: 'https://mapapps2.bgs.ac.uk/geoindex/home.html', limitation: 'No queryable nearby BGS borehole record was returned. This is not evidence that boreholes do not exist.' });

const clean = (value: unknown): string | null => typeof value === 'string' && value.trim() && !/^(null|unknown|not available)$/i.test(value.trim()) ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
const property = (attributes: Record<string, unknown>, patterns: RegExp[]): string | null => {
  for (const [key, value] of Object.entries(attributes)) if (patterns.some(pattern => pattern.test(key))) { const result = clean(value); if (result) return result; }
  return null;
};
const firstAttributes = (payload: any): Record<string, unknown> | null => payload?.features?.find((feature: any) => feature?.attributes && Object.keys(feature.attributes).length)?.attributes || null;
const fetchJson = async (fetcher: FetchLike, url: string): Promise<any | null> => {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 4500);
  try { const response = await fetcher(url, { headers: { Accept: 'application/json', 'User-Agent': 'GeoSurvey/1.0 (BGS evidence query)' }, signal: controller.signal }); return response.ok ? await response.json() : null; }
  catch { return null; } finally { clearTimeout(timeout); }
};
const queryLayer = (fetcher: FetchLike, endpoint: string, layerId: number, lat: number, lng: number, distance = 0) => {
  const params = new URLSearchParams({ f: 'json', geometry: distance ? `${lng - distance},${lat - distance},${lng + distance},${lat + distance}` : `${lng},${lat}`, geometryType: distance ? 'esriGeometryEnvelope' : 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: distance ? 'true' : 'false', outSR: '4326' });
  return fetchJson(fetcher, `${endpoint}/${layerId}/query?${params}`);
};
const layersFor = async (fetcher: FetchLike, endpoint: string): Promise<ArcLayer[]> => (await fetchJson(fetcher, `${endpoint}?f=pjson`))?.layers || [];

function geologyFrom(attributes: Record<string, unknown>, endpoint: Endpoint, superficial: string | null): BgsGeologyEvidence | null {
  const unitName = property(attributes, [/lex(_|ical)?_?d|lexicon|unit.?name|formation|member|rock.?unit|name/i]);
  const lithology = property(attributes, [/lith|rock.?type|composition|description/i]);
  const geologicalAge = property(attributes, [/age|period|epoch|strat/i]);
  if (!unitName && !lithology && !geologicalAge) return null;
  return { available: true, tier: endpoint.tier, status: 'VERIFIED', unitName, lithology, geologicalAge, superficialDeposit: superficial, sourceName: `British Geological Survey — ${endpoint.label}`, sourceUrl: endpoint.url, scale: endpoint.scale, limitation: `${endpoint.scale} mapped geology at the site centre; boundaries are cartographic evidence and do not replace site investigation.` };
}

async function queryGeologyEndpoint(fetcher: FetchLike, endpoint: Endpoint, lat: number, lng: number): Promise<BgsGeologyEvidence | null> {
  const layers = await layersFor(fetcher, endpoint.url);
  const geologyLayers = layers.filter(layer => /bedrock|geology|lithostrat/i.test(layer.name || ''));
  const superficialLayers = layers.filter(layer => /superficial|deposit|drift/i.test(layer.name || ''));
  let superficial: string | null = null;
  for (const layer of superficialLayers.slice(0, 3)) { const attrs = firstAttributes(await queryLayer(fetcher, endpoint.url, layer.id, lat, lng)); if (attrs) { superficial = property(attrs, [/lex|unit|formation|deposit|name|lith/i]); if (superficial) break; } }
  for (const layer of geologyLayers.slice(0, 5)) { const attrs = firstAttributes(await queryLayer(fetcher, endpoint.url, layer.id, lat, lng)); if (attrs) { const result = geologyFrom(attrs, endpoint, superficial); if (result) return result; } }
  return null;
}

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => { const r = 6371; const p = Math.PI / 180; const a = Math.sin((lat2-lat1)*p/2)**2 + Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2; return 2*r*Math.asin(Math.sqrt(a)); };

async function queryContext(fetcher: FetchLike, endpoint: string, lat: number, lng: number): Promise<{ groundwater: BgsGroundwaterEvidence; boreholes: BgsBoreholeContext }> {
  const layers = await layersFor(fetcher, endpoint);
  let groundwater = unavailableGroundwater(); let boreholes = unavailableBoreholes();
  const groundwaterLayer = layers.find(layer => /groundwater.*(depth|level)|depth.*groundwater/i.test(layer.name || ''));
  if (groundwaterLayer) { const attrs = firstAttributes(await queryLayer(fetcher, endpoint, groundwaterLayer.id, lat, lng)); const depth = attrs && property(attrs, [/depth.*groundwater|groundwater.*depth|depth.?range|model.*depth/i]); if (depth) groundwater = { available: true, tier: 2, status: 'MODELLED', modelledDepth: depth, sourceName: `British Geological Survey — ${groundwaterLayer.name}`, sourceUrl: `${endpoint}/${groundwaterLayer.id}`, limitation: 'Regional/modelled groundwater evidence, not a measured parcel-specific water level. Site investigation is required for design.' }; }
  const boreholeLayer = layers.find(layer => /borehole|bore.?hole|sobi/i.test(layer.name || ''));
  if (boreholeLayer) {
    const payload = await queryLayer(fetcher, endpoint, boreholeLayer.id, lat, lng, 0.05); const features = Array.isArray(payload?.features) ? payload.features : [];
    const records = features.map((feature: any) => { const x = feature.geometry?.x; const y = feature.geometry?.y; return { id: property(feature.attributes || {}, [/reference|borehole.?id|record.?id|registration|^id$/i]), distance: Number.isFinite(x) && Number.isFinite(y) ? haversineKm(lat, lng, y, x) : null }; }).sort((a: any,b: any)=>(a.distance ?? Infinity)-(b.distance ?? Infinity));
    if (records.length) boreholes = { available: true, tier: 1, count: records.length, nearestDistanceKm: records[0].distance, nearestRecordId: records[0].id, sourceName: 'British Geological Survey GeoIndex borehole records', sourceUrl: `${endpoint}/${boreholeLayer.id}`, limitation: 'Nearby boreholes are contextual records only and do not establish conditions beneath the selected parcel.' };
  }
  return { groundwater, boreholes };
}

/** BGS-first UK acquisition: detailed mapping, regional fallback, then explicit unavailability. */
export async function fetchBgsSiteEvidence(lat: number, lng: number, fetcher: FetchLike = fetch, endpoints: BgsEndpoints = BGS_ENDPOINTS): Promise<BgsSiteEvidence> {
  const detailed: Endpoint = { url: endpoints.detailed, tier: 1, scale: '1:50,000', label: 'Detailed Geology' };
  const regional: Endpoint = { url: endpoints.regional, tier: 2, scale: '1:625,000', label: 'Regional Geology' };
  const geology = await queryGeologyEndpoint(fetcher, detailed, lat, lng) || await queryGeologyEndpoint(fetcher, regional, lat, lng) || unavailableGeology();
  const context = await queryContext(fetcher, endpoints.geoIndex, lat, lng);
  return { geology, ...context };
}
