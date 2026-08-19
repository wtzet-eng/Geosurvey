export interface UkSiteEvidence {
  id: string;
  category: string;
  claim: string;
  status: 'VERIFIED' | 'REQUIRES_VERIFICATION' | 'UNAVAILABLE';
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  spatialRelationship: string;
  calculationMethod: string;
  confidence: 'High' | 'Medium' | 'Low';
  value: unknown;
  limitation: string;
}

const BGS = 'British Geological Survey (BGS)';
const BGS_WMS = 'https://map.bgs.ac.uk/arcgis/services/GeoIndex/DiGMapGB/MapServer/WMSServer';
const BGS_BOREHOLES_WMS = 'https://map.bgs.ac.uk/arcgis/services/GeoIndex/Boreholes/MapServer/WMSServer';
const EA = 'Environment Agency';
const EA_FLOOD_WMS = 'https://environment.data.gov.uk/spatialdata/flood-map-for-planning-flood-zones-2-and-3/wms';

const today = () => new Date().toISOString().slice(0, 10);

async function text(url: string, timeoutMs = 8000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'GeoSurvey/1.0 evidence extraction', Accept: 'application/xml,text/xml,text/plain' }, signal: controller.signal });
    return r.ok ? await r.text() : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

async function json(url: string, timeoutMs = 8000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'GeoSurvey/1.0 evidence extraction', Accept: 'application/json' }, signal: controller.signal });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

async function wmsCapabilities(url: string): Promise<string[]> {
  const xml = await text(`${url}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`);
  if (!xml) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  const re = /<(?:Layer|wms:Layer)[^>]*>[\s\S]*?<Name>([^<]+)<\/Name>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const name = match[1].trim();
    if (name && !seen.has(name)) { seen.add(name); names.push(name); }
  }
  return names;
}

async function wmsInfo(url: string, layer: string, lat: number, lng: number): Promise<any | null> {
  const delta = 0.001;
  const params = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo',
    LAYERS: layer, QUERY_LAYERS: layer, CRS: 'CRS:84',
    BBOX: `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`,
    WIDTH: '101', HEIGHT: '101', I: '50', J: '50',
    INFO_FORMAT: 'application/json', FEATURE_COUNT: '10'
  });
  return json(`${url}?${params.toString()}`, 8000);
}

function chooseLayer(layers: string[], patterns: RegExp[]): string | null {
  return layers.find(layer => patterns.some(pattern => pattern.test(layer))) || layers.find(layer => !/legend|index|overview|boundary|frame/i.test(layer)) || layers[0] || null;
}

function evidence(id: string, category: string, claim: string, status: UkSiteEvidence['status'], sourceName: string, sourceUrl: string, method: string, value: any, limitation: string, confidence: UkSiteEvidence['confidence'] = 'Medium'): UkSiteEvidence {
  return { id, category, claim, status, sourceName, sourceUrl, datasetDate: today(), spatialRelationship: 'Exact site-centre desktop query', calculationMethod: method, confidence, value, limitation };
}

async function queryBgsMap(lat: number, lng: number, title: string, url: string, patterns: RegExp[]): Promise<UkSiteEvidence> {
  const layers = await wmsCapabilities(url);
  if (!layers.length) return evidence(`uk-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-unavailable`, title, `${title}: BGS WMS service could not be queried at analysis time.`, 'UNAVAILABLE', BGS, url, 'OGC WMS GetCapabilities', null, 'Service failure or endpoint change is not evidence that geological information is absent.', 'Low');
  const layer = chooseLayer(layers, patterns);
  const info = layer ? await wmsInfo(url, layer, lat, lng) : null;
  const features = info?.features || info?.FeatureInfo || [];
  const hasInfo = Boolean(info && (features.length || Object.keys(info).length));
  return evidence(`uk-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-site`, title, hasInfo ? `${title}: the BGS map service returned information at the site coordinate.` : `${title}: the BGS map service is reachable, but no feature information was returned at the tested coordinate.`, hasInfo ? 'VERIFIED' : 'REQUIRES_VERIFICATION', BGS, url, 'OGC WMS GetFeatureInfo at the selected BGS layer', { queriedLayer: layer, availableLayers: layers.slice(0, 100), featureInfo: info }, 'Map-service evidence supports regional geological interpretation but does not replace site-specific investigation, borehole records or the original map sheet/explanatory notes.', hasInfo ? 'Medium' : 'Low');
}

async function queryBgsBoreholes(lat: number, lng: number): Promise<UkSiteEvidence> {
  const layers = await wmsCapabilities(BGS_BOREHOLES_WMS);
  if (!layers.length) return evidence('uk-bgs-boreholes-unavailable', 'Boreholes', 'BGS borehole WMS service could not be queried at analysis time.', 'UNAVAILABLE', BGS, BGS_BOREHOLES_WMS, 'OGC WMS GetCapabilities', null, 'A service failure is not evidence that boreholes are absent.', 'Low');
  const layer = chooseLayer(layers, [/borehole/i, /bore/i, /site/i]);
  const info = layer ? await wmsInfo(BGS_BOREHOLES_WMS, layer, lat, lng) : null;
  const features = info?.features || info?.FeatureInfo || [];
  const hasInfo = Boolean(info && (features.length || Object.keys(info).length));
  return evidence('uk-bgs-boreholes-site', 'Boreholes', hasInfo ? `BGS borehole service returned feature information at the site coordinate.` : `BGS borehole service is reachable, but no borehole feature information was returned at the tested coordinate.`, hasInfo ? 'VERIFIED' : 'REQUIRES_VERIFICATION', BGS, BGS_BOREHOLES_WMS, 'OGC WMS GetFeatureInfo at the selected borehole layer', { queriedLayer: layer, featureInfo: info }, 'Absence of a returned feature is not proof that no borehole exists. Nearby borehole records should be reviewed in BGS GeoIndex and original records before treating geology or groundwater as site-specific.', hasInfo ? 'Medium' : 'Low');
}

async function queryEnvironmentAgencyFlood(lat: number, lng: number): Promise<UkSiteEvidence> {
  const layers = await wmsCapabilities(EA_FLOOD_WMS);
  if (!layers.length) return evidence('uk-ea-flood-unavailable', 'Flood Risk', 'Environment Agency Flood Map for Planning WMS could not be queried at analysis time.', 'UNAVAILABLE', EA, EA_FLOOD_WMS, 'OGC WMS GetCapabilities', null, 'Service failure or endpoint change is not evidence that flood risk is absent.', 'Low');
  const layer = chooseLayer(layers, [/flood.*zone/i, /zone.*2/i, /zone.*3/i, /planning/i]);
  const info = layer ? await wmsInfo(EA_FLOOD_WMS, layer, lat, lng) : null;
  const features = info?.features || info?.FeatureInfo || [];
  const hasInfo = Boolean(info && (features.length || Object.keys(info).length));
  return evidence('uk-ea-flood-site', 'Flood Risk', hasInfo ? `Environment Agency Flood Map for Planning returned information at the site coordinate.` : `Environment Agency Flood Map for Planning is reachable, but no feature information was returned at the tested coordinate.`, hasInfo ? 'VERIFIED' : 'REQUIRES_VERIFICATION', EA, EA_FLOOD_WMS, 'OGC WMS GetFeatureInfo at the site coordinate', { queriedLayer: layer, featureInfo: info }, 'Planning flood-zone evidence is a desktop screening result. It does not replace site-specific flood risk assessment, drainage assessment or the applicable national planning guidance.', hasInfo ? 'High' : 'Low');
}

export async function queryUKSiteEvidence(lat: number, lng: number): Promise<UkSiteEvidence[]> {
  const [geology, boreholes, flood] = await Promise.all([
    queryBgsMap(lat, lng, 'BGS Geological Map (DiGMapGB)', BGS_WMS, [/digmap/i, /geolog/i, /bedrock/i, /superficial/i]),
    queryBgsBoreholes(lat, lng),
    queryEnvironmentAgencyFlood(lat, lng)
  ]);
  return [geology, boreholes, flood];
}

export function enrichGeologyFromBgs(report: any, evidenceItems: UkSiteEvidence[]) {
  const geological = evidenceItems.find(item => item.category === 'BGS Geological Map (DiGMapGB)' && item.status === 'VERIFIED');
  const boreholes = evidenceItems.filter(item => item.category === 'Boreholes' && item.status === 'VERIFIED');
  if (!geological && !boreholes.length) return;
  const info = (geological?.value as any)?.featureInfo;
  const feature = info?.features?.[0] || info?.FeatureInfo?.[0];
  const props = feature?.properties || {};
  const find = (patterns: RegExp[]) => {
    const key = Object.keys(props).find(k => patterns.some(pattern => pattern.test(k)));
    return key ? props[key] : undefined;
  };
  const unit = find([/unit/i, /formation/i, /geolog/i, /strat/i, /lith/i]) || report.geosurvey_context.geological_unit_name;
  const lithology = find([/lith/i, /rock/i, /material/i, /deposit/i]) || report.geosurvey_context.lithology_type;
  const period = find([/age/i, /period/i, /epoch/i, /strat/i]) || report.geosurvey_context.geological_period_era;
  report.geosurvey_context = {
    ...report.geosurvey_context,
    geological_unit_name: unit,
    lithology_type: lithology,
    geological_period_era: period,
    bgs_evidence_status: geological?.status || (boreholes.length ? 'VERIFIED' : 'REQUIRES_VERIFICATION'),
    bgs_map_evidence_count: geological ? 1 : 0,
    bgs_borehole_count: boreholes.length,
    bgs_boreholes: boreholes.map(item => ({ properties: (item.value as any)?.featureInfo, source: item.sourceUrl })),
    bgs_sources: evidenceItems.filter(item => item.sourceName === BGS).map(item => ({ category: item.category, source: item.sourceName, url: item.sourceUrl, status: item.status, limitation: item.limitation }))
  };
  report.geosurvey_context.evidence_level = 'VERIFIED';
}
