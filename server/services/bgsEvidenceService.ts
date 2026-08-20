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
  superficialLithology: string | null;
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
type Endpoint = { url: string; tier: 1 | 2; scale: string; label: string; bedrockLayerId: number; superficialLayerId: number };

export const BGS_ENDPOINTS = {
  detailed: 'https://map.bgs.ac.uk/arcgis/rest/services/BGS_Detailed_Geology/MapServer',
  regional: 'https://map.bgs.ac.uk/arcgis/rest/services/SDDS/Geology_625k/MapServer',
  hydrogeology: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hydrogeology/MapServer',
  boreholes: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/boreholes/MapServer'
} as const;
type BgsEndpoints = { detailed: string; regional: string; hydrogeology: string; boreholes: string };

const unavailableGeology = (): BgsGeologyEvidence => ({ available: false, tier: 4, status: 'REQUIRES_VERIFICATION', unitName: null, lithology: null, geologicalAge: null, superficialDeposit: null, superficialLithology: null, sourceName: 'British Geological Survey', sourceUrl: BGS_ENDPOINTS.detailed, scale: null, limitation: 'BGS geology services were unavailable or returned no mapped geology at the site coordinate. No geological unit was inferred.' });
const unavailableGroundwater = (): BgsGroundwaterEvidence => ({ available: false, tier: 4, status: 'REQUIRES_VERIFICATION', modelledDepth: null, sourceName: 'British Geological Survey', sourceUrl: BGS_ENDPOINTS.hydrogeology, limitation: 'No validated BGS groundwater depth or level value was returned. A design groundwater level requires site observation.' });
const unavailableBoreholes = (): BgsBoreholeContext => ({ available: false, tier: 4, count: 0, nearestDistanceKm: null, nearestRecordId: null, sourceName: 'British Geological Survey GeoIndex', sourceUrl: BGS_ENDPOINTS.boreholes, limitation: 'No queryable nearby BGS borehole record was returned. This is not evidence that boreholes do not exist.' });

const clean = (value: unknown): string | null => typeof value === 'string' && value.trim() && !/^(null|unknown|not available)$/i.test(value.trim()) ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
const exact = (attributes: Record<string, unknown>, ...keys: string[]): { value: string | null; key: string | null } => {
  const index = new Map(Object.keys(attributes).map(key => [key.toUpperCase(), key]));
  for (const requested of keys) { const key = index.get(requested.toUpperCase()); if (key) { const value = clean(attributes[key]); if (value) return { value, key }; } }
  return { value: null, key: null };
};
const property = (attributes: Record<string, unknown>, patterns: RegExp[]): string | null => {
  for (const [key, value] of Object.entries(attributes)) if (patterns.some(pattern => pattern.test(key))) { const result = clean(value); if (result) return result; }
  return null;
};
const firstAttributes = (payload: any): Record<string, unknown> | null => payload?.features?.find((feature: any) => feature?.attributes && Object.keys(feature.attributes).length)?.attributes || null;
const fetchJson = async (fetcher: FetchLike, url: string, diagnostic: { endpoint: string; layerId?: number; layerName?: string }): Promise<any | null> => {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json', 'User-Agent': 'GeoSurvey/1.0 (BGS evidence query)' }, signal: controller.signal });
    const payload = response.ok ? await response.json() : null;
    const features = Array.isArray(payload?.features) ? payload.features : [];
    const attributeKeys = features[0]?.attributes && typeof features[0].attributes === 'object' ? Object.keys(features[0].attributes).slice(0, 60) : [];
    console.info('[BGS acquisition]', { ...diagnostic, httpStatus: response.status, featureCount: features.length, attributeKeys });
    return payload;
  } catch (error) {
    console.warn('[BGS acquisition]', { ...diagnostic, error: error instanceof Error ? error.name : 'request_failed' });
    return null;
  } finally { clearTimeout(timeout); }
};
const queryLayer = (fetcher: FetchLike, endpoint: string, layerId: number, layerName: string, lat: number, lng: number, distance = 0) => {
  const params = new URLSearchParams({ f: 'json', geometry: distance ? `${lng - distance},${lat - distance},${lng + distance},${lat + distance}` : `${lng},${lat}`, geometryType: distance ? 'esriGeometryEnvelope' : 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: distance ? 'true' : 'false', outSR: '4326' });
  return fetchJson(fetcher, `${endpoint}/${layerId}/query?${params}`, { endpoint, layerId, layerName });
};
const layersFor = async (fetcher: FetchLike, endpoint: string): Promise<ArcLayer[]> => (await fetchJson(fetcher, `${endpoint}?f=pjson`, { endpoint, layerName: 'service metadata' }))?.layers || [];

const combineDistinct = (...parts: Array<string | null>) => [...new Set(parts.filter((part): part is string => Boolean(part)))].join(' – ') || null;
function mappedAge(attributes: Record<string, unknown>): { value: string | null; keys: string[] } {
  const minTime = exact(attributes, 'MIN_TIME_D'), maxTime = exact(attributes, 'MAX_TIME_D');
  const minPeriod = exact(attributes, 'MIN_PERIOD'), maxPeriod = exact(attributes, 'MAX_PERIOD');
  const epoch = exact(attributes, 'MAX_EPOCH'), era = exact(attributes, 'MAX_ERA');
  const primary = combineDistinct(minTime.value, maxTime.value) || combineDistinct(minPeriod.value, maxPeriod.value);
  return { value: combineDistinct(primary, epoch.value, era.value), keys: [minTime.key, maxTime.key, minPeriod.key, maxPeriod.key, epoch.key, era.key].filter((key): key is string => Boolean(key)) };
}
function mappedLithology(attributes: Record<string, unknown>): { value: string | null; key: string | null } {
  const direct = exact(attributes, 'RCS_D', 'RCS_X'); if (direct.value) return direct;
  const combined = exact(attributes, 'LEX_RCS_D');
  if (!combined.value) return combined;
  const parts = combined.value.split(/\s+(?:-|–|:)\s+/).filter(Boolean);
  return { value: parts.length > 1 ? parts.at(-1)! : combined.value, key: combined.key };
}
function mappedSuperficial(attributes: Record<string, unknown>) {
  const unit = exact(attributes, 'LEX_D', 'LEX_RCS_D', 'LEX');
  return { unit: unit.value, unitKey: unit.key, lithology: mappedLithology(attributes) };
}
function geologyFrom(bedrock: Record<string, unknown>, superficial: Record<string, unknown> | null, endpoint: Endpoint): BgsGeologyEvidence | null {
  const unit = exact(bedrock, 'LEX_D', 'LEX_RCS_D', 'LEX');
  const lithology = mappedLithology(bedrock); const age = mappedAge(bedrock);
  const surface = superficial ? mappedSuperficial(superficial) : { unit: null, unitKey: null, lithology: { value: null, key: null } };
  if (!unit.value && !lithology.value && !age.value && !surface.unit && !surface.lithology.value) return null;
  const nominalScale = exact(bedrock, 'NOM_SCALE').value || endpoint.scale;
  console.info('[BGS mapping]', { endpoint: endpoint.url, tier: endpoint.tier, mappedFields: { geologicalUnit: unit.key, lithology: lithology.key, stratigraphicContext: age.keys, superficialDeposit: surface.unitKey, superficialLithology: surface.lithology.key, scale: exact(bedrock, 'NOM_SCALE').key } });
  return { available: true, tier: endpoint.tier, status: 'VERIFIED', unitName: unit.value, lithology: lithology.value, geologicalAge: age.value, superficialDeposit: surface.unit, superficialLithology: surface.lithology.value, sourceName: `British Geological Survey — ${endpoint.label}`, sourceUrl: `${endpoint.url}/${endpoint.bedrockLayerId}`, scale: nominalScale, limitation: `${nominalScale} mapped geology at the site centre; boundaries are cartographic evidence and do not replace site investigation.` };
}

async function queryGeologyEndpoint(fetcher: FetchLike, endpoint: Endpoint, lat: number, lng: number): Promise<BgsGeologyEvidence | null> {
  const [bedrockPayload, superficialPayload] = await Promise.all([
    queryLayer(fetcher, endpoint.url, endpoint.bedrockLayerId, `${endpoint.label} bedrock`, lat, lng),
    queryLayer(fetcher, endpoint.url, endpoint.superficialLayerId, `${endpoint.label} superficial`, lat, lng)
  ]);
  const bedrock = firstAttributes(bedrockPayload); const superficial = firstAttributes(superficialPayload);
  if (!bedrock && !superficial) return null;
  return geologyFrom(bedrock || {}, superficial, endpoint);
}

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => { const r = 6371; const p = Math.PI / 180; const a = Math.sin((lat2-lat1)*p/2)**2 + Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2; return 2*r*Math.asin(Math.sqrt(a)); };

async function queryGroundwater(fetcher:FetchLike, endpoint:string,lat:number,lng:number){
  const layers=await layersFor(fetcher,endpoint);
  const layer=layers.find(l=>/groundwater.*(depth|level)|depth.*groundwater|water.*table/i.test(l.name||''));
  if(!layer)return unavailableGroundwater();
  const a=firstAttributes(await queryLayer(fetcher,endpoint,layer.id,layer.name||'groundwater',lat,lng));
  const value=a&&property(a,[/depth.*groundwater|groundwater.*depth|water.*table.*depth|depth.?range|groundwater.*level|water.*level/i]);
  return value?{available:true,tier:2 as EvidenceTier,status:'MODELLED' as EvidenceLevel,modelledDepth:value,sourceName:`British Geological Survey — ${layer.name}`,sourceUrl:`${endpoint}/${layer.id}`,limitation:'Regional/modelled groundwater depth or level evidence, not a measured parcel-specific water level. Site investigation is required for design.'}:unavailableGroundwater();
}
async function queryBoreholes(fetcher:FetchLike, endpoint:string,lat:number,lng:number){ const layers=await layersFor(fetcher,endpoint); const layer=layers.find(l=>/borehole\.records|borehole|water\.wells/i.test(l.name||'')); if(!layer)return unavailableBoreholes(); const payload=await queryLayer(fetcher,endpoint,layer.id,layer.name||'boreholes',lat,lng,0.05); const features=Array.isArray(payload?.features)?payload.features:[]; const records=features.map((f:any)=>{const x=f.geometry?.x,y=f.geometry?.y;return{id:property(f.attributes||{},[/reference|borehole.?id|record.?id|registration|^id$/i]),distance:Number.isFinite(x)&&Number.isFinite(y)?haversineKm(lat,lng,y,x):null};}).sort((a:any,b:any)=>(a.distance??Infinity)-(b.distance??Infinity)); return records.length?{available:true,tier:1 as EvidenceTier,count:records.length,nearestDistanceKm:records[0].distance,nearestRecordId:records[0].id,sourceName:'British Geological Survey GeoIndex borehole records',sourceUrl:`${endpoint}/${layer.id}`,limitation:'Nearby boreholes are contextual records only and do not establish conditions beneath the selected parcel.'}:unavailableBoreholes(); }

/** BGS-first UK acquisition: detailed mapping, regional fallback, then explicit unavailability. */
export async function fetchBgsSiteEvidence(lat: number, lng: number, fetcher: FetchLike = fetch, endpoints: BgsEndpoints = BGS_ENDPOINTS): Promise<BgsSiteEvidence> {
  const detailed: Endpoint = { url: endpoints.detailed, tier: 1, scale: '1:50,000', label: 'Detailed Geology', bedrockLayerId: 4, superficialLayerId: 3 };
  const regional: Endpoint = { url: endpoints.regional, tier: 2, scale: '1:625,000', label: 'Regional Geology', bedrockLayerId: 3, superficialLayerId: 2 };
  const detailedResult = await queryGeologyEndpoint(fetcher, detailed, lat, lng);
  const detailedHasBedrock = Boolean(detailedResult?.unitName || detailedResult?.lithology || detailedResult?.geologicalAge);
  let geology = detailedHasBedrock ? detailedResult! : await queryGeologyEndpoint(fetcher, regional, lat, lng) || detailedResult || unavailableGeology();
  if (geology.tier === 2 && detailedResult?.superficialDeposit) geology = { ...geology, superficialDeposit: detailedResult.superficialDeposit, superficialLithology: detailedResult.superficialLithology };
  console.info('[BGS acquisition]', { selectedTier: geology.tier, sourceUrl: geology.sourceUrl, available: geology.available });
  const [groundwater,boreholes]=await Promise.all([queryGroundwater(fetcher,endpoints.hydrogeology,lat,lng),queryBoreholes(fetcher,endpoints.boreholes,lat,lng)]);
  return { geology, groundwater, boreholes };
}
