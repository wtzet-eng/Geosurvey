import { resolveSource } from '../sources/resolver';
import { LogicalSourceId, ResolutionResult, SourceEndpoint, SourceProvenance } from '../sources/sourceTypes';
import { EvidenceLevel } from '../types';
import { AvailabilityReason } from '../reporting/canonicalReport';

export interface PgiSiteEvidence {
  id: string;
  category: string;
  claim: string;
  status: EvidenceLevel;
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  spatialRelationship: string;
  calculationMethod: string;
  confidence: 'High' | 'Medium' | 'Low';
  value: unknown;
  limitation: string;
  reasonCode?: AvailabilityReason;
  resolverProvenance?: SourceProvenance;
}

type FetchLike = typeof fetch;
const SOURCE = 'Państwowy Instytut Geologiczny – PIB';
const today = () => new Date().toISOString().slice(0, 10);

const reasonForResolution = (resolution: ResolutionResult): AvailabilityReason =>
  resolution.status === 'SCHEMA_CHANGED' ? 'MALFORMED_DATA' : 'SOURCE_UNAVAILABLE';

async function fetchResponse(fetcher: FetchLike, url: string, accept: string, timeoutMs = 7000): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { headers: { 'User-Agent': 'GeoSurvey/1.0 evidence extraction', Accept: accept }, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 7000): Promise<any | null> {
  const response = await fetchResponse(fetcher, url, 'application/json', timeoutMs);
  if (!response?.ok) return null;
  try { return await response.json(); } catch { return null; }
}

function parseWmsLayers(xml: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /<(?:Layer|wms:Layer)[^>]*>[\s\S]*?<Name>([^<]+)<\/Name>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const name = match[1].trim();
    if (name && !seen.has(name)) { seen.add(name); out.push(name); }
  }
  return out;
}

function wmsCapabilities(xml: string): string[] {
  const capabilities = ['GetCapabilities'];
  if (/<(?:GetMap|wms:GetMap)\b/i.test(xml)) capabilities.push('GetMap');
  if (/<(?:GetFeatureInfo|wms:GetFeatureInfo)\b/i.test(xml)) capabilities.push('GetFeatureInfo');
  return capabilities;
}

async function probeWms(fetcher: FetchLike, endpoint: SourceEndpoint) {
  const response = await fetchResponse(fetcher, `${endpoint.url}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`, 'application/xml,text/xml');
  const xml = response?.ok ? await response.text() : '';
  const layers = parseWmsLayers(xml);
  return {
    connectivity: Boolean(response),
    httpStatus: response?.status,
    serviceAvailable: Boolean(response?.ok && layers.length),
    observedLayers: layers,
    observedFields: [],
    capabilities: wmsCapabilities(xml),
    payload: { layers }
  };
}

async function resolveWms(fetcher: FetchLike, id: LogicalSourceId) {
  return resolveSource(id, endpoint => probeWms(fetcher, endpoint));
}

function selectMapLayer(layers: string[], mapId: string): string | null {
  const keywords: Record<string, RegExp> = {
    'smgp-50k': /smgp|geolog|litolog|utw|czwart/i,
    'mlp-50k': /mlp|litogen|geneza|utw/i,
    'mgp-regional': /mgp|geolog/i,
    'engineering-geology': /inz|inż|engineering|geolog/i,
    boreholes: /otwor|odwiert|borehole/i
  };
  return layers.find(layer => keywords[mapId]?.test(layer))
    || layers.find(layer => !/legend|index|overview|ramka|arkusz/i.test(layer))
    || layers[0]
    || null;
}

async function wmsGetInfo(fetcher: FetchLike, serviceUrl: string, layer: string, lat: number, lng: number): Promise<any | null> {
  const delta = 0.0008;
  const params = new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo', LAYERS: layer, QUERY_LAYERS: layer, CRS: 'CRS:84', BBOX: `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`, WIDTH: '101', HEIGHT: '101', I: '50', J: '50', INFO_FORMAT: 'application/json', FEATURE_COUNT: '5' });
  return fetchJson(fetcher, `${serviceUrl}?${params.toString()}`, 6000);
}

function unavailableMapEvidence(map: MapDefinition, resolution: ResolutionResult): PgiSiteEvidence {
  const reasonCode = reasonForResolution(resolution);
  return {
    id: `pgi-${map.id}-unavailable`, category: map.title, claim: `${map.title}: approved source route could not be validated.`,
    status: 'REQUIRES_VERIFICATION', sourceName: SOURCE,
    sourceUrl: resolution.attempts.length ? map.portalUrl : map.portalUrl, datasetDate: today(), spatialRelationship: 'Site coordinate',
    calculationMethod: 'Source resolver with WMS connectivity, capability and service validation', confidence: 'Low',
    value: { reasonCode, resolverStatus: resolution.status, attempts: resolution.attempts }, reasonCode,
    limitation: 'Source failure is not evidence that mapped geological information or a geological feature is absent.'
  };
}

interface MapDefinition { id: string; logicalSourceId: LogicalSourceId; title: string; scale: string; portalUrl: string; }
const MAPS: MapDefinition[] = [
  { id: 'smgp-50k', logicalSourceId: 'PL_SMGP_DETAILED_GEOLOGY', title: 'Detailed Geological Map of Poland (SMGP)', scale: '1:50,000', portalUrl: 'https://geolog.pgi.gov.pl' },
  { id: 'mlp-50k', logicalSourceId: 'PL_MLP_LITHOGENETIC', title: 'Lithogenetic Map of Poland (MLP)', scale: '1:50,000', portalUrl: 'https://geolog.pgi.gov.pl' },
  { id: 'mgp-regional', logicalSourceId: 'PL_MGP_REGIONAL_GEOLOGY', title: 'Geological Map of Poland (MGP)', scale: 'regional', portalUrl: 'https://geolog.pgi.gov.pl' },
  { id: 'engineering-geology', logicalSourceId: 'PL_ENGINEERING_GEOLOGY', title: 'Engineering-Geological Map of Poland', scale: 'source scale', portalUrl: 'https://geolog.pgi.gov.pl' }
];

export async function queryPolandGeologicalMaps(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<PgiSiteEvidence[]> {
  const evidence: PgiSiteEvidence[] = [];
  for (const map of MAPS) {
    const resolution = await resolveWms(fetcher, map.logicalSourceId);
    if (!resolution.endpoint) { evidence.push(unavailableMapEvidence(map, resolution)); continue; }
    const layers = (resolution.probe?.payload as { layers?: string[] } | undefined)?.layers || [];
    const selectedLayer = selectMapLayer(layers, map.id);
    const info = selectedLayer ? await wmsGetInfo(fetcher, resolution.endpoint.url, selectedLayer, lat, lng) : null;
    const features = info?.features || info?.FeatureInfo || [];
    const hasFeature = Array.isArray(features) ? features.length > 0 : Boolean(features && Object.keys(features).length);
    const reasonCode: AvailabilityReason | undefined = hasFeature ? undefined : 'NO_DATA';
    evidence.push({
      id: `pgi-${map.id}-site`, category: map.title,
      claim: hasFeature ? `${map.title}: site coordinate returned map feature information.` : `${map.title}: source was queried successfully, but no feature information was returned at the tested coordinate.`,
      status: hasFeature ? 'VERIFIED' : 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: resolution.endpoint.url,
      datasetDate: today(), spatialRelationship: 'Exact site centre queried', calculationMethod: 'Resolved OGC WMS GetFeatureInfo at selected geological layer',
      confidence: hasFeature ? 'Medium' : 'Low', reasonCode, resolverProvenance: resolution.provenance || undefined,
      value: { scale: map.scale, availableLayers: layers.slice(0, 100), queriedLayer: selectedLayer, featureInfo: info, reasonCode, resolverProvenance: resolution.provenance },
      limitation: hasFeature ? 'Map-service evidence should be checked against the original map sheet, explanatory text and site investigation before design use.' : 'A successful query without a returned feature does not establish geological absence or a geological unit.'
    });
  }
  return evidence;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function profileFromProperties(properties: any): Record<string, unknown> | null {
  if (!properties || typeof properties !== 'object') return null;
  const patterns = [/litolog/i, /strat/i, /warstw/i, /profil/i, /otwor/i, /głęb/i, /gleb/i, /depth/i, /groundwater/i, /woda/i, /utwor/i, /osad/i, /wiek/i, /age/i, /opis/i, /description/i, /rock/i, /soil/i];
  const selected = Object.fromEntries(Object.entries(properties).filter(([key]) => patterns.some(pattern => pattern.test(key))));
  return Object.keys(selected).length ? selected : null;
}

async function resolveBoreholeSource(fetcher: FetchLike) {
  return resolveSource<any>('PL_ENGINEERING_BOREHOLES', async endpoint => {
    if (endpoint.type === 'WMS') return probeWms(fetcher, endpoint);
    const response = await fetchResponse(fetcher, `${endpoint.url}/collections`, 'application/json');
    const data = response?.ok ? await response.json().catch(() => null) : null;
    const collections = Array.isArray(data?.collections) ? data.collections : [];
    const collection = collections.find((item: any) => /odwiert|borehole|otwor/i.test(`${item.id || ''} ${item.title || ''}`));
    return { connectivity: Boolean(response), httpStatus: response?.status, serviceAvailable: Boolean(response?.ok && collection), observedLayers: collection ? [collection.id] : [], observedFields: [], capabilities: collection ? ['collections', 'items'] : ['collections'], payload: { collection } };
  });
}

export async function queryPolandBoreholes(lat: number, lng: number, radiusKm = 2, fetcher: FetchLike = fetch): Promise<PgiSiteEvidence[]> {
  const resolution = await resolveBoreholeSource(fetcher);
  if (!resolution.endpoint) {
    const reasonCode = reasonForResolution(resolution);
    return [{ id: 'pgi-boreholes-unavailable', category: 'Boreholes', claim: 'No approved PGI-PIB borehole route could be validated.', status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: 'https://geolog.pgi.gov.pl', datasetDate: today(), spatialRelationship: `Within ${radiusKm} km search window`, calculationMethod: 'Source resolver and provider capability validation', confidence: 'Low', value: { reasonCode, attempts: resolution.attempts }, reasonCode, limitation: 'Source unavailability is not evidence that boreholes are absent.' }];
  }

  if (resolution.endpoint.type === 'WMS') {
    const layers = (resolution.probe?.payload as { layers?: string[] } | undefined)?.layers || [];
    const layer = selectMapLayer(layers, 'boreholes');
    const info = layer ? await wmsGetInfo(fetcher, resolution.endpoint.url, layer, lat, lng) : null;
    const hasFeature = Boolean(info && Object.keys(info).length);
    const reasonCode: AvailabilityReason | undefined = hasFeature ? undefined : 'NO_DATA';
    return [{ id: 'pgi-boreholes-wms-context', category: 'Boreholes', claim: hasFeature ? 'PGI-PIB borehole WMS returned contextual feature information.' : 'PGI-PIB borehole WMS was queried successfully but returned no feature at the site coordinate.', status: hasFeature ? 'VERIFIED' : 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: resolution.endpoint.url, datasetDate: today(), spatialRelationship: 'Site-centre contextual query', calculationMethod: 'Resolved WMS GetFeatureInfo', confidence: hasFeature ? 'Medium' : 'Low', value: { featureInfo: info, reasonCode, resolverProvenance: resolution.provenance }, reasonCode, resolverProvenance: resolution.provenance || undefined, limitation: 'WMS borehole context does not establish conditions beneath the parcel. Original borehole records must be reviewed.' }];
  }

  const collection = (resolution.probe?.payload as { collection?: any } | undefined)?.collection;
  const dLat = radiusKm / 111.32; const dLng = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));
  const bbox = `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
  const url = `${resolution.endpoint.url}/collections/${encodeURIComponent(collection.id)}/items?bbox=${bbox}&limit=100`;
  const data = await fetchJson(fetcher, url, 10000);
  if (!data) return [{ id: 'pgi-boreholes-query-unavailable', category: 'Boreholes', claim: 'The PGI-PIB borehole collection was discovered, but its spatial query failed.', status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: url, datasetDate: today(), spatialRelationship: `Within ${radiusKm} km search window`, calculationMethod: 'Resolved PGI-PIB OGC API Features spatial query', confidence: 'Low', value: { reasonCode: 'SOURCE_UNAVAILABLE', resolverProvenance: resolution.provenance }, reasonCode: 'SOURCE_UNAVAILABLE', resolverProvenance: resolution.provenance || undefined, limitation: 'Query failure is not evidence that boreholes are absent.' }];

  const results = (data.features || []).map((feature: any, index: number) => {
    const coordinates = feature?.geometry?.coordinates; const flng = Number(coordinates?.[0]); const flat = Number(coordinates?.[1]);
    const distanceKm = Number.isFinite(flng) && Number.isFinite(flat) ? haversineKm(lat, lng, flat, flng) : null;
    return { feature, distanceKm, index };
  }).filter((item: any) => item.distanceKm === null || item.distanceKm <= radiusKm).sort((a: any, b: any) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)).slice(0, 20);

  if (!results.length) return [{ id: 'pgi-boreholes-none-found', category: 'Boreholes', claim: `The PGI-PIB borehole source was queried successfully, but no feature was returned within ${radiusKm} km.`, status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: url, datasetDate: today(), spatialRelationship: `No returned feature within ${radiusKm} km`, calculationMethod: 'Resolved PGI-PIB OGC API Features spatial query', confidence: 'Low', value: { collection: collection.id, featureCount: 0, reasonCode: 'NO_DATA', resolverProvenance: resolution.provenance }, reasonCode: 'NO_DATA', resolverProvenance: resolution.provenance || undefined, limitation: 'No mapped borehole in this dataset is not proof that no borehole exists. Local archives may contain additional records.' }];

  return results.map((item: any) => {
    const profile = profileFromProperties(item.feature.properties);
    return { id: `pgi-borehole-${item.feature.id ?? item.index}`, category: 'Boreholes', claim: `PGI-PIB borehole record identified${item.distanceKm !== null ? ` ${item.distanceKm.toFixed(2)} km from the site centre` : ''}.`, status: 'VERIFIED' as const, sourceName: SOURCE, sourceUrl: url, datasetDate: today(), spatialRelationship: item.distanceKm !== null ? `${item.distanceKm.toFixed(2)} km from site centre` : `Within ${radiusKm} km search window`, calculationMethod: 'Resolved PGI-PIB OGC API Features spatial query', confidence: item.distanceKm !== null && item.distanceKm < 0.5 ? 'High' as const : 'Medium' as const, value: { featureId: item.feature.id, coordinates: item.feature.geometry?.coordinates, distanceKm: item.distanceKm, collection: collection.id, properties: item.feature.properties, geologicalProfileProperties: profile, resolverProvenance: resolution.provenance }, resolverProvenance: resolution.provenance || undefined, limitation: 'A nearby record is contextual evidence, not a continuous parcel-specific ground model. Original borehole documentation must be reviewed before design use.' };
  });
}

export async function queryPolandSiteEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<PgiSiteEvidence[]> {
  const [maps, boreholes] = await Promise.all([queryPolandGeologicalMaps(lat, lng, fetcher), queryPolandBoreholes(lat, lng, 2, fetcher)]);
  return [...maps, ...boreholes];
}
