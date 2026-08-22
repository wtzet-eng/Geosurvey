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
const BGS_HEX_ARCGIS = 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hex_grids/MapServer';
const BGS_HAZARDS_ARCGIS = 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hazards/MapServer';
const COAL_MINE_ENTRIES_WMS = 'https://map.bgs.ac.uk/arcgis/services/CoalAuthority/coalauthority_mine_entries/MapServer/WMSServer';
const EA = 'Environment Agency';
const EA_FLOOD_WMS = 'https://environment.data.gov.uk/spatialdata/flood-map-for-planning-flood-zones-2-and-3/wms';
const EA_HISTORIC_LANDFILL_WMS = 'https://environment.data.gov.uk/spatialdata/historic-landfill/wms';
const HISTORIC_ENGLAND_NHLE = 'https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/National_Heritage_List_for_England_NHLE_v02_VIEW/FeatureServer';
const HISTORIC_ENGLAND = 'Historic England';

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

async function arcgisPointQuery(serviceUrl: string, layerId: number, lat: number, lng: number): Promise<any | null> {
  const geometry = JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } });
  const params = new URLSearchParams({
    f: 'json', geometry, geometryType: 'esriGeometryPoint', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'false'
  });
  return json(`${serviceUrl}/${layerId}/query?${params.toString()}`, 10000);
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

async function queryBgsGeoSureHex(lat: number, lng: number, layerId: number, hazardName: string): Promise<UkSiteEvidence> {
  const result = await arcgisPointQuery(BGS_HEX_ARCGIS, layerId, lat, lng);
  if (!result) return evidence(`uk-geosure-${hazardName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-unavailable`, 'Ground Stability & Geohazards', `BGS GeoSure ${hazardName} layer could not be queried.`, 'UNAVAILABLE', BGS, `${BGS_HEX_ARCGIS}/${layerId}`, 'ArcGIS REST point intersection query', null, 'Service failure is not evidence that the hazard is absent. The full GeoSure product provides more detailed hazard information than the 5 km generalised screening layer.', 'Low');
  const feature = result.features?.[0];
  if (!feature) return evidence(`uk-geosure-${hazardName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, 'Ground Stability & Geohazards', `BGS GeoSure ${hazardName}: no 5 km screening polygon was returned for the site coordinate.`, 'REQUIRES_VERIFICATION', BGS, `${BGS_HEX_ARCGIS}/${layerId}`, 'ArcGIS REST point intersection query against BGS GeoSure 5 km hexagonal screening layer', { count: result.count || 0 }, 'No returned feature is not proof of zero hazard. The 5 km hex layer is a generalised screening product and should be supplemented by the detailed GeoSure data or GeoReport for site-level decisions.', 'Medium');
  const p = feature.attributes || {};
  const rating = p.Legend || p.CLASS || p.Advisory || 'Unclassified';
  return evidence(`uk-geosure-${hazardName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, 'Ground Stability & Geohazards', `BGS GeoSure ${hazardName} screening rating at the site: ${rating}.`, 'VERIFIED', BGS, `${BGS_HEX_ARCGIS}/${layerId}`, 'ArcGIS REST point intersection query against BGS GeoSure 5 km hexagonal screening layer', { rating, class: p.CLASS, legend: p.Legend, advisory: p.Advisory, notice: p.Notice, version: p.Version }, 'This is a 5 km generalised GeoSure screening layer. A significant or moderate result should trigger review of detailed BGS GeoSure data, boreholes and a site-specific geotechnical investigation; it is not a foundation design parameter.', 'High');
}

async function queryBgsMiningHazard(lat: number, lng: number): Promise<UkSiteEvidence> {
  const result = await arcgisPointQuery(BGS_HEX_ARCGIS, 1, lat, lng);
  if (!result) return evidence('uk-bgs-noncoal-mining-unavailable', 'Underground Voids & Mining', 'BGS mining-hazard screening service could not be queried.', 'UNAVAILABLE', BGS, `${BGS_HEX_ARCGIS}/1`, 'ArcGIS REST point intersection query', null, 'Service failure is not evidence that underground workings are absent.', 'Low');
  const feature = result.features?.[0];
  if (!feature) return evidence('uk-bgs-noncoal-mining', 'Underground Voids & Mining', 'No BGS non-coal mining hazard screening polygon was returned at the site coordinate.', 'REQUIRES_VERIFICATION', BGS, `${BGS_HEX_ARCGIS}/1`, 'ArcGIS REST point intersection query', { count: result.count || 0 }, 'This screening layer does not prove the absence of shafts, adits, quarries or other underground voids. Original records and specialist ground investigation may still be required.', 'Medium');
  return evidence('uk-bgs-noncoal-mining', 'Underground Voids & Mining', `BGS non-coal mining hazard screening: ${(feature.attributes || {}).Legend || (feature.attributes || {}).CLASS || 'classified area'}.`, 'VERIFIED', BGS, `${BGS_HEX_ARCGIS}/1`, 'ArcGIS REST point intersection query', feature.attributes || {}, 'The screening layer identifies mining-related ground hazards but does not replace a site-specific mining or ground-stability report.', 'High');
}

async function queryCoalMineEntries(lat: number, lng: number): Promise<UkSiteEvidence> {
  const layers = await wmsCapabilities(COAL_MINE_ENTRIES_WMS);
  if (!layers.length) return evidence('uk-coal-mine-entries-unavailable', 'Underground Voids & Mining', 'Coal Authority Mine Entries WMS could not be queried.', 'UNAVAILABLE', 'Coal Authority', COAL_MINE_ENTRIES_WMS, 'OGC WMS GetCapabilities', null, 'Service failure is not evidence that mine entries are absent. A formal Coal Authority Mining Report may still be required.', 'Low');
  const layer = chooseLayer(layers, [/mine[._ ]entry/i, /mine/i, /entry/i]);
  const info = layer ? await wmsInfo(COAL_MINE_ENTRIES_WMS, layer, lat, lng) : null;
  const features = info?.features || info?.FeatureInfo || [];
  const hasInfo = Boolean(info && (features.length || Object.keys(info).length));
  return evidence('uk-coal-mine-entries', 'Underground Voids & Mining', hasInfo ? 'Coal Authority Mine Entries service returned information at the site coordinate.' : 'Coal Authority Mine Entries service is reachable but returned no feature information at the tested coordinate.', hasInfo ? 'VERIFIED' : 'REQUIRES_VERIFICATION', 'Coal Authority', COAL_MINE_ENTRIES_WMS, 'OGC WMS GetFeatureInfo at the mine-entry layer', { queriedLayer: layer, featureInfo: info }, 'No returned feature is not proof of no mine workings. Where development is proposed in a coal mining reporting area, obtain the appropriate Coal Authority Mining Report and specialist advice.', hasInfo ? 'High' : 'Medium');
}

async function queryHistoricLandfill(lat: number, lng: number): Promise<UkSiteEvidence> {
  const layers = await wmsCapabilities(EA_HISTORIC_LANDFILL_WMS);
  if (!layers.length) return evidence('uk-historic-landfill-unavailable', 'Previous Land Use & Contamination', 'Environment Agency Historic Landfill WMS could not be queried.', 'UNAVAILABLE', EA, EA_HISTORIC_LANDFILL_WMS, 'OGC WMS GetCapabilities', null, 'Historic landfill data is incomplete and service failure is not evidence that no former landfill exists.', 'Low');
  const layer = chooseLayer(layers, [/historic/i, /landfill/i]);
  const info = layer ? await wmsInfo(EA_HISTORIC_LANDFILL_WMS, layer, lat, lng) : null;
  const features = info?.features || info?.FeatureInfo || [];
  const hasInfo = Boolean(info && (features.length || Object.keys(info).length));
  return evidence('uk-historic-landfill', 'Previous Land Use & Contamination', hasInfo ? 'Environment Agency Historic Landfill service returned information at the site coordinate.' : 'Environment Agency Historic Landfill service is reachable but returned no feature information at the tested coordinate.', hasInfo ? 'VERIFIED' : 'REQUIRES_VERIFICATION', EA, EA_HISTORIC_LANDFILL_WMS, 'OGC WMS GetFeatureInfo at the historic-landfill layer', { queriedLayer: layer, featureInfo: info }, 'Historic landfill records are a screening indicator, not a contamination clearance. The dataset may be incomplete; where relevant, obtain a Phase 1/Phase 2 contaminated-land assessment.', hasInfo ? 'High' : 'Medium');
}

async function queryArchaeologyEngland(lat: number, lng: number): Promise<UkSiteEvidence> {
  const result = await arcgisPointQuery(HISTORIC_ENGLAND_NHLE, 0, lat, lng);
  if (!result) return evidence('uk-heritage-england-unavailable', 'Archaeology & Heritage', 'Historic England National Heritage List query could not be completed.', 'UNAVAILABLE', HISTORIC_ENGLAND, HISTORIC_ENGLAND_NHLE, 'ArcGIS REST point intersection query', null, 'The NHLE covers nationally protected heritage assets in England; service failure is not evidence that archaeological constraints are absent.', 'Low');
  const count = result.features?.length || result.count || 0;
  return evidence('uk-heritage-england', 'Archaeology & Heritage', count ? `Historic England NHLE returned ${count} protected heritage feature(s) intersecting the site coordinate.` : 'Historic England NHLE returned no nationally protected heritage feature at the site coordinate.', count ? 'VERIFIED' : 'REQUIRES_VERIFICATION', HISTORIC_ENGLAND, HISTORIC_ENGLAND_NHLE, 'ArcGIS REST point intersection query against the National Heritage List for England', { count, features: result.features?.slice(0, 10)?.map((f: any) => f.attributes) }, 'NHLE is not a complete archaeological record. Absence from NHLE does not rule out non-designated archaeology, local records or archaeological potential. Wales, Scotland and Northern Ireland use separate heritage datasets.', count ? 'High' : 'Medium');
}

export async function queryUKSiteEvidence(lat: number, lng: number): Promise<UkSiteEvidence[]> {
  const [geology, boreholes, flood, shrinkSwell, compressible, landslides, runningSand, solubleRocks, collapsible, miningHazard, coalEntries, historicLandfill, archaeology] = await Promise.all([
    queryBgsMap(lat, lng, 'BGS Geological Map (DiGMapGB)', BGS_WMS, [/digmap/i, /geolog/i, /bedrock/i, /superficial/i]),
    queryBgsBoreholes(lat, lng),
    queryEnvironmentAgencyFlood(lat, lng),
    queryBgsGeoSureHex(lat, lng, 6, 'Shrink–swell'),
    queryBgsGeoSureHex(lat, lng, 3, 'Compressible ground'),
    queryBgsGeoSureHex(lat, lng, 4, 'Landslides'),
    queryBgsGeoSureHex(lat, lng, 5, 'Running sand'),
    queryBgsGeoSureHex(lat, lng, 7, 'Soluble rocks'),
    queryBgsGeoSureHex(lat, lng, 2, 'Collapsible deposits'),
    queryBgsMiningHazard(lat, lng),
    queryCoalMineEntries(lat, lng),
    queryHistoricLandfill(lat, lng),
    queryArchaeologyEngland(lat, lng)
  ]);

  return [geology, boreholes, flood, shrinkSwell, compressible, landslides, runningSand, solubleRocks, collapsible, miningHazard, coalEntries, historicLandfill, archaeology];
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
