import { enrichUKValuationFromEvidence, queryUKLandValuationEvidence } from './ukValuationService';

export interface UkSiteEvidence {
  id: string;
  category: string;
  claim: string;
  status: 'VERIFIED' | 'MODELLED' | 'REQUIRES_VERIFICATION' | 'UNAVAILABLE';
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  spatialRelationship: string;
  calculationMethod: string;
  confidence: 'High' | 'Medium' | 'Low';
  value: unknown;
  limitation: string;
}

type FetchLike = typeof fetch;
const BGS = 'British Geological Survey (BGS)';
const BGS_DETAILED = 'https://map.bgs.ac.uk/arcgis/rest/services/BGS_Detailed_Geology/MapServer';
const BGS_REGIONAL = 'https://map.bgs.ac.uk/arcgis/rest/services/SDDS/Geology_625k/MapServer';
const BGS_BOREHOLES = 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/boreholes/MapServer';
const BGS_HYDRO = 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hydrogeology/MapServer';
const BGS_HEX = 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hex_grids/MapServer';
const COAL_MINE_ENTRIES_WMS = 'https://map.bgs.ac.uk/arcgis/services/CoalAuthority/coalauthority_mine_entries/MapServer/WMSServer';
const EA = 'Environment Agency';
const EA_FLOOD = 'https://environment.data.gov.uk/KB6uNVj5ZcJr7jUP/ArcGIS/rest/services/Flood_Map_for_Planning/FeatureServer';
const EA_HISTORIC_LANDFILL_WMS = 'https://environment.data.gov.uk/spatialdata/historic-landfill/wms';
const HISTORIC_ENGLAND_NHLE = 'https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/National_Heritage_List_for_England_NHLE_v02_VIEW/FeatureServer';
const HISTORIC_ENGLAND = 'Historic England';
const today = () => new Date().toISOString().slice(0, 10);

function evidence(id: string, category: string, claim: string, status: UkSiteEvidence['status'], sourceName: string, sourceUrl: string, method: string, value: any, limitation: string, confidence: UkSiteEvidence['confidence'] = 'Medium'): UkSiteEvidence {
  return { id, category, claim, status, sourceName, sourceUrl, datasetDate: today(), spatialRelationship: 'Selected site coordinate / stated search radius', calculationMethod: method, confidence, value, limitation };
}

async function fetchJson(url: string, timeoutMs = 8500, fetcher: FetchLike = fetch): Promise<any | null> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { headers: { 'User-Agent': 'GeoSurvey/1.0 UK evidence', Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload && !payload.error ? payload : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'GeoSurvey/1.0 UK evidence', Accept: 'application/xml,text/xml,text/plain' }, signal: controller.signal });
    return response.ok ? await response.text() : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

function pointQueryUrl(service: string, layerId: number, lat: number, lng: number, returnGeometry = false): string {
  const params = new URLSearchParams({ f: 'json', geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: returnGeometry ? 'true' : 'false' });
  if (returnGeometry) params.set('outSR', '4326');
  return `${service}/${layerId}/query?${params}`;
}

async function pointQuery(service: string, layerId: number, lat: number, lng: number, fetcher: FetchLike = fetch, returnGeometry = false): Promise<any | null> {
  return fetchJson(pointQueryUrl(service, layerId, lat, lng, returnGeometry), 9000, fetcher);
}

async function radiusQuery(service: string, layerId: number, lat: number, lng: number, radiusM: number, fetcher: FetchLike = fetch): Promise<any | null> {
  const params = new URLSearchParams({ f: 'json', geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', distance: String(radiusM), units: 'esriSRUnit_Meter', outFields: '*', returnGeometry: 'true', outSR: '4326', resultRecordCount: '100' });
  return fetchJson(`${service}/${layerId}/query?${params}`, 10000, fetcher);
}

const clean = (value: unknown): string | null => typeof value === 'string' && value.trim() && !/^(null|unknown|not available|n\/a)$/i.test(value.trim()) ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
function exact(attrs: Record<string, unknown>, ...keys: string[]): string | null {
  const index = new Map(Object.keys(attrs).map(key => [key.toUpperCase(), key]));
  for (const requested of keys) { const actual = index.get(requested.toUpperCase()); const value = actual ? clean(attrs[actual]) : null; if (value) return value; }
  return null;
}
function firstAttrs(payload: any): Record<string, unknown> | null { return payload?.features?.find((feature: any) => feature?.attributes && Object.keys(feature.attributes).length)?.attributes || null; }
const combine = (...parts: Array<string | null>) => [...new Set(parts.filter((part): part is string => Boolean(part)))].join(' – ') || null;

function geologyFields(attrs: Record<string, unknown>) {
  const unit = exact(attrs, 'LEX_D', 'LEX_RCS_D', 'LEX');
  let lithology = exact(attrs, 'RCS_D', 'RCS_X');
  if (!lithology) {
    const combined = exact(attrs, 'LEX_RCS_D');
    const parts = combined?.split(/\s+(?:-|–|:)\s+/).filter(Boolean) || [];
    lithology = parts.length > 1 ? parts.at(-1)! : combined;
  }
  const age = combine(combine(exact(attrs, 'MIN_TIME_D'), exact(attrs, 'MAX_TIME_D')) || combine(exact(attrs, 'MIN_PERIOD'), exact(attrs, 'MAX_PERIOD')), exact(attrs, 'MAX_EPOCH'), exact(attrs, 'MAX_ERA'));
  return { unit, lithology, age, scale: exact(attrs, 'NOM_SCALE') };
}

async function queryBgsGeology(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<UkSiteEvidence> {
  const [dBed, dSup] = await Promise.all([pointQuery(BGS_DETAILED, 4, lat, lng, fetcher), pointQuery(BGS_DETAILED, 3, lat, lng, fetcher)]);
  let bed = firstAttrs(dBed); let superficial = firstAttrs(dSup); let source = BGS_DETAILED; let tier = 1; let nominalScale = '1:50,000';
  if (!bed) {
    const [rBed, rSup] = await Promise.all([pointQuery(BGS_REGIONAL, 3, lat, lng, fetcher), pointQuery(BGS_REGIONAL, 2, lat, lng, fetcher)]);
    bed = firstAttrs(rBed); if (!superficial) superficial = firstAttrs(rSup); source = BGS_REGIONAL; tier = 2; nominalScale = '1:625,000';
  }
  if (!bed && !superficial) return evidence('uk-bgs-geology-unavailable', 'BGS Geological Map (DiGMapGB)', 'BGS detailed and regional REST geology services returned no usable mapped geology at the selected coordinate.', 'REQUIRES_VERIFICATION', BGS, BGS_DETAILED, 'ArcGIS REST point query: detailed geology followed by regional fallback', { reasonCode: 'SOURCE_UNAVAILABLE' }, 'No geological unit is inferred when BGS services fail or return no mapped feature.', 'Low');
  const b = geologyFields(bed || {}); const s = geologyFields(superficial || {});
  const scale = b.scale || s.scale || nominalScale;
  return evidence('uk-bgs-geology-site', 'BGS Geological Map (DiGMapGB)', `BGS ${tier === 1 ? 'detailed' : 'regional fallback'} geology maps the site as ${b.unit || b.lithology || s.unit || 'a mapped geological unit'}${b.lithology ? ` (${b.lithology})` : ''}.`, 'VERIFIED', BGS, source, 'ArcGIS REST point intersection: BGS 1:50,000 bedrock/superficial layers with 1:625,000 fallback', { tier, unitName: b.unit, lithology: b.lithology, geologicalAge: b.age, superficialDeposit: s.unit, superficialLithology: s.lithology, scale }, 'Mapped geology is cartographic evidence, not parcel stratigraphy or a site investigation. Regional fallback is broader screening evidence.', tier === 1 ? 'High' : 'Medium');
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number { const r = 6371; const p = Math.PI / 180; const a = Math.sin((lat2-lat1)*p/2)**2 + Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2; return 2*r*Math.asin(Math.sqrt(a)); }

async function queryBgsBoreholes(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<UkSiteEvidence> {
  const result = await radiusQuery(BGS_BOREHOLES, 0, lat, lng, 5000, fetcher);
  if (!result) return evidence('uk-bgs-boreholes-unavailable', 'Boreholes', 'BGS GeoIndex borehole REST service could not be queried.', 'REQUIRES_VERIFICATION', BGS, `${BGS_BOREHOLES}/0`, 'ArcGIS REST 5 km radius query', { reasonCode: 'SOURCE_UNAVAILABLE' }, 'Service failure is not evidence that boreholes are absent.', 'Low');
  const rows = (result.features || []).map((feature: any) => {
    const attrs = feature.attributes || {}; const x = Number(feature.geometry?.x); const y = Number(feature.geometry?.y);
    return { id: exact(attrs, 'REFERENCE', 'NAME', 'BOREHOLE_ID', 'REGNO', 'ID'), depthM: Number.isFinite(Number(attrs.LENGTH)) ? Number(attrs.LENGTH) : null, distanceKm: Number.isFinite(x) && Number.isFinite(y) ? haversineKm(lat, lng, y, x) : null };
  }).sort((a: any, b: any) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)).slice(0, 20);
  if (!rows.length) return evidence('uk-bgs-boreholes-site', 'Boreholes', 'BGS GeoIndex returned no borehole record within the automated 5 km search radius.', 'REQUIRES_VERIFICATION', BGS, `${BGS_BOREHOLES}/0`, 'ArcGIS REST 5 km radius query', { searchRadiusKm: 5, count: 0 }, 'No returned record is not proof that no borehole or investigation exists; review GeoIndex and local investigation records.', 'Medium');
  return evidence('uk-bgs-boreholes-site', 'Boreholes', `BGS GeoIndex returned ${rows.length} borehole record(s) within 5 km; nearest returned record is approximately ${rows[0].distanceKm?.toFixed(2) ?? 'unknown'} km away.`, 'VERIFIED', BGS, `${BGS_BOREHOLES}/0`, 'ArcGIS REST 5 km radius query with WGS84 distance calculation', { searchRadiusKm: 5, count: rows.length, nearestDistanceKm: rows[0].distanceKm, nearestRecordId: rows[0].id, records: rows }, 'Nearby boreholes are contextual observations only and do not establish conditions beneath the selected parcel. Original logs/reports must be reviewed.', 'Medium');
}

async function queryBgsHydrogeology(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<UkSiteEvidence> {
  const result = await pointQuery(BGS_HYDRO, 0, lat, lng, fetcher);
  if (!result) return evidence('uk-bgs-hydrogeology-unavailable', 'Hydrogeology', 'BGS regional hydrogeology REST service could not be queried.', 'REQUIRES_VERIFICATION', BGS, `${BGS_HYDRO}/0`, 'ArcGIS REST point query', { reasonCode: 'SOURCE_UNAVAILABLE' }, 'Source failure is not evidence about groundwater conditions.', 'Low');
  const attrs = firstAttrs(result);
  if (!attrs) return evidence('uk-bgs-hydrogeology-site', 'Hydrogeology', 'BGS hydrogeology service returned no mapped aquifer feature at the selected coordinate.', 'REQUIRES_VERIFICATION', BGS, `${BGS_HYDRO}/0`, 'ArcGIS REST point query', { reasonCode: 'NO_DATA' }, 'No mapped feature does not establish absence of groundwater.', 'Low');
  const rockUnit = exact(attrs, 'ROCK_UNIT'); const classCode = exact(attrs, 'CLASS'); const character = exact(attrs, 'CHARACTER'); const flow = exact(attrs, 'FLOW_MECHA'); const summary = exact(attrs, 'SUMMARY');
  const descriptor = [rockUnit, character, flow, summary].filter(Boolean).join('; ');
  return evidence('uk-bgs-hydrogeology-site', 'Hydrogeology', `BGS 1:625,000 hydrogeology maps the site${rockUnit ? ` in ${rockUnit}` : ''}${character ? `: ${character}` : ''}.`, 'VERIFIED', BGS, `${BGS_HYDRO}/0`, 'ArcGIS REST point query of BGS regional aquifer-potential mapping', { rockUnit, classCode, character, flowMechanism: flow, summary, descriptor, scale: '1:625,000' }, 'Regional aquifer-potential mapping does not establish parcel groundwater depth, seasonal water level, inflow rate or dewatering requirement.', 'Medium');
}

async function wmsCapabilities(url: string): Promise<string[]> {
  const xml = await fetchText(`${url}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`); if (!xml) return [];
  return [...new Set([...xml.matchAll(/<Name>([^<]+)<\/Name>/gi)].map(match => match[1].trim()).filter(Boolean))];
}
async function wmsInfo(url: string, layer: string, lat: number, lng: number): Promise<any | null> {
  const d = 0.001; const params = new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo', LAYERS: layer, QUERY_LAYERS: layer, CRS: 'CRS:84', BBOX: `${lng-d},${lat-d},${lng+d},${lat+d}`, WIDTH: '101', HEIGHT: '101', I: '50', J: '50', INFO_FORMAT: 'application/json', FEATURE_COUNT: '10' });
  return fetchJson(`${url}?${params}`, 8000);
}
const chooseLayer = (layers: string[], patterns: RegExp[]) => layers.find(layer => patterns.some(pattern => pattern.test(layer))) || layers[0] || null;

async function queryEnglandFlood(lat: number, lng: number, england: boolean): Promise<UkSiteEvidence> {
  if (!england) return evidence('uk-ea-flood-coverage-excluded', 'Flood Risk', 'Environment Agency Flood Map for Planning is England-only; no English flood classification is substituted outside England.', 'REQUIRES_VERIFICATION', EA, EA_FLOOD, 'England coverage gate', { reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' }, 'Scotland, Wales and Northern Ireland require their own statutory flood datasets.', 'High');
  const [zone3, zone2] = await Promise.all([pointQuery(EA_FLOOD, 1, lat, lng), pointQuery(EA_FLOOD, 2, lat, lng)]);
  if (!zone3 || !zone2) return evidence('uk-ea-flood-unavailable', 'Flood Risk', 'Environment Agency Flood Map for Planning feature service could not be queried reliably.', 'REQUIRES_VERIFICATION', EA, EA_FLOOD, 'ArcGIS REST point queries to Flood Zones 3 and 2', { reasonCode: 'SOURCE_UNAVAILABLE' }, 'Source failure is not evidence that flood risk is absent.', 'Low');
  const in3 = Boolean(zone3.features?.length); const in2 = Boolean(zone2.features?.length); const level = in3 ? 'High' : in2 ? 'Moderate' : 'Low'; const zone = in3 ? 'Flood Zone 3' : in2 ? 'Flood Zone 2' : 'Flood Zone 1 screening';
  return evidence('uk-ea-flood-site', 'Flood Risk', `Environment Agency Flood Map for Planning classifies the selected coordinate as ${zone}.`, 'VERIFIED', EA, EA_FLOOD, 'ArcGIS REST point intersection against current Flood Zone 3 and Flood Zone 2 layers', { level, zone, inFloodZone3: in3, inFloodZone2: in2 }, 'Flood Map for Planning covers rivers and sea and ignores the benefits of defences; it does not cover all flood sources or replace a site-specific flood risk assessment.', 'High');
}

async function queryGeoSure(lat: number, lng: number, layerId: number, hazard: string): Promise<UkSiteEvidence> {
  const result = await pointQuery(BGS_HEX, layerId, lat, lng);
  if (!result) return evidence(`uk-geosure-${hazard.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-unavailable`, 'Ground Stability & Geohazards', `BGS GeoSure ${hazard} screening service could not be queried.`, 'REQUIRES_VERIFICATION', BGS, `${BGS_HEX}/${layerId}`, 'ArcGIS REST point query', { reasonCode: 'SOURCE_UNAVAILABLE' }, 'Source failure is not evidence that the hazard is absent.', 'Low');
  const attrs = result.features?.[0]?.attributes;
  if (!attrs) return evidence(`uk-geosure-${hazard.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, 'Ground Stability & Geohazards', `No BGS GeoSure ${hazard} screening polygon was returned at the selected coordinate.`, 'REQUIRES_VERIFICATION', BGS, `${BGS_HEX}/${layerId}`, 'ArcGIS REST point query', { reasonCode: 'NO_DATA' }, 'No returned feature is not proof of zero hazard.', 'Medium');
  const rating = attrs.Legend || attrs.CLASS || attrs.Advisory || 'Unclassified';
  return evidence(`uk-geosure-${hazard.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, 'Ground Stability & Geohazards', `BGS GeoSure ${hazard} screening rating: ${rating}.`, 'VERIFIED', BGS, `${BGS_HEX}/${layerId}`, 'ArcGIS REST point query against BGS 5 km screening layer', { rating, ...attrs }, 'This is generalised ground-hazard screening, not a parcel geotechnical assessment or design parameter.', 'High');
}

async function queryCoalMineEntries(lat: number, lng: number): Promise<UkSiteEvidence> {
  const layers = await wmsCapabilities(COAL_MINE_ENTRIES_WMS); if (!layers.length) return evidence('uk-coal-mine-entries-unavailable', 'Underground Voids & Mining', 'Coal Authority mine-entry WMS could not be queried.', 'REQUIRES_VERIFICATION', 'Coal Authority', COAL_MINE_ENTRIES_WMS, 'WMS GetCapabilities', { reasonCode: 'SOURCE_UNAVAILABLE' }, 'Service failure is not evidence that mine entries are absent.', 'Low');
  const layer = chooseLayer(layers, [/mine[._ ]entry/i, /mine/i]); const info = layer ? await wmsInfo(COAL_MINE_ENTRIES_WMS, layer, lat, lng) : null; const has = Boolean(info && ((info.features?.length || info.FeatureInfo?.length) || Object.keys(info).length));
  return evidence('uk-coal-mine-entries', 'Underground Voids & Mining', has ? 'Coal Authority mine-entry service returned information at the selected coordinate.' : 'Coal Authority service returned no mine-entry feature information at the selected coordinate.', has ? 'VERIFIED' : 'REQUIRES_VERIFICATION', 'Coal Authority', COAL_MINE_ENTRIES_WMS, 'WMS GetFeatureInfo', { layer, featureInfo: info }, 'No returned feature is not proof of no coal workings; obtain an appropriate Coal Authority Mining Report where relevant.', has ? 'High' : 'Medium');
}

async function queryHistoricLandfill(lat: number, lng: number, england: boolean): Promise<UkSiteEvidence> {
  if (!england) return evidence('uk-historic-landfill-coverage-excluded', 'Previous Land Use & Contamination', 'Environment Agency historic-landfill data is England-specific and was not used outside England.', 'REQUIRES_VERIFICATION', EA, EA_HISTORIC_LANDFILL_WMS, 'England coverage gate', { reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' }, 'Use the competent national environmental authority outside England.', 'High');
  const layers = await wmsCapabilities(EA_HISTORIC_LANDFILL_WMS); if (!layers.length) return evidence('uk-historic-landfill-unavailable', 'Previous Land Use & Contamination', 'Environment Agency Historic Landfill WMS could not be queried.', 'REQUIRES_VERIFICATION', EA, EA_HISTORIC_LANDFILL_WMS, 'WMS GetCapabilities', { reasonCode: 'SOURCE_UNAVAILABLE' }, 'Source failure is not evidence that historic landfill is absent.', 'Low');
  const layer = chooseLayer(layers, [/historic/i, /landfill/i]); const info = layer ? await wmsInfo(EA_HISTORIC_LANDFILL_WMS, layer, lat, lng) : null; const has = Boolean(info && ((info.features?.length || info.FeatureInfo?.length) || Object.keys(info).length));
  return evidence('uk-historic-landfill', 'Previous Land Use & Contamination', has ? 'Environment Agency Historic Landfill returned information at the selected coordinate.' : 'No historic-landfill feature information was returned at the selected coordinate.', has ? 'VERIFIED' : 'REQUIRES_VERIFICATION', EA, EA_HISTORIC_LANDFILL_WMS, 'WMS GetFeatureInfo', { layer, featureInfo: info }, 'Historic landfill is a screening indicator and does not replace Phase 1/Phase 2 contaminated-land assessment.', has ? 'High' : 'Medium');
}

async function queryArchaeology(lat: number, lng: number, england: boolean): Promise<UkSiteEvidence> {
  if (!england) return evidence('uk-heritage-england-coverage-excluded', 'Archaeology & Heritage', 'Historic England NHLE is England-only and was not used outside England.', 'REQUIRES_VERIFICATION', HISTORIC_ENGLAND, HISTORIC_ENGLAND_NHLE, 'England coverage gate', { reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' }, 'Use the competent national heritage dataset outside England.', 'High');
  const result = await pointQuery(HISTORIC_ENGLAND_NHLE, 0, lat, lng); if (!result) return evidence('uk-heritage-england-unavailable', 'Archaeology & Heritage', 'Historic England NHLE service could not be queried.', 'REQUIRES_VERIFICATION', HISTORIC_ENGLAND, HISTORIC_ENGLAND_NHLE, 'ArcGIS REST point query', { reasonCode: 'SOURCE_UNAVAILABLE' }, 'Service failure is not evidence that heritage constraints are absent.', 'Low');
  const count = result.features?.length || 0;
  return evidence('uk-heritage-england', 'Archaeology & Heritage', count ? `Historic England NHLE returned ${count} protected heritage feature(s) intersecting the selected coordinate.` : 'No nationally protected NHLE feature intersects the selected coordinate.', count ? 'VERIFIED' : 'REQUIRES_VERIFICATION', HISTORIC_ENGLAND, HISTORIC_ENGLAND_NHLE, 'ArcGIS REST point query', { count, features: result.features?.slice(0, 10)?.map((f: any) => f.attributes) }, 'NHLE is not a complete archaeological record; absence does not rule out non-designated archaeology or local HER constraints.', count ? 'High' : 'Medium');
}

function authorityCodeFromValuation(item: any): string | null { const value = item?.value || {}; return clean(value.localAuthorityCode) || clean(value.authority?.code); }

export async function queryUKSiteEvidence(lat: number, lng: number): Promise<UkSiteEvidence[]> {
  const valuation = await queryUKLandValuationEvidence(lat, lng) as UkSiteEvidence;
  const authorityCode = authorityCodeFromValuation(valuation); const england = Boolean(authorityCode?.startsWith('E'));
  const [geology, boreholes, hydro, flood, shrinkSwell, compressible, landslides, runningSand, solubleRocks, collapsible, miningHazard, coalEntries, historicLandfill, archaeology] = await Promise.all([
    queryBgsGeology(lat, lng), queryBgsBoreholes(lat, lng), queryBgsHydrogeology(lat, lng), queryEnglandFlood(lat, lng, england),
    queryGeoSure(lat, lng, 6, 'Shrink–swell'), queryGeoSure(lat, lng, 3, 'Compressible ground'), queryGeoSure(lat, lng, 4, 'Landslides'), queryGeoSure(lat, lng, 5, 'Running sand'), queryGeoSure(lat, lng, 7, 'Soluble rocks'), queryGeoSure(lat, lng, 2, 'Collapsible deposits'), queryGeoSure(lat, lng, 1, 'Non-coal mining'), queryCoalMineEntries(lat, lng), queryHistoricLandfill(lat, lng, england), queryArchaeology(lat, lng, england)
  ]);
  return [geology, boreholes, hydro, flood, shrinkSwell, compressible, landslides, runningSand, solubleRocks, collapsible, miningHazard, coalEntries, historicLandfill, archaeology, valuation];
}

function riskLevel(value: unknown): 'Low' | 'Moderate' | 'High' | null {
  const text = String(value || '').toLowerCase(); if (/very high|high|significant|severe/.test(text)) return 'High'; if (/moderate|medium/.test(text)) return 'Moderate'; if (/very low|low|negligible|minimal/.test(text)) return 'Low'; return null;
}

export function enrichGeologyFromBgs(report: any, items: UkSiteEvidence[]) {
  const valuation = items.find(item => item.id.startsWith('uk-mhclg-land-valuation')); if (valuation) enrichUKValuationFromEvidence(report, valuation as any);
  const geology = items.find(item => item.id === 'uk-bgs-geology-site' && item.status === 'VERIFIED');
  const boreholes = items.find(item => item.id === 'uk-bgs-boreholes-site' && item.status === 'VERIFIED');
  const hydro = items.find(item => item.id === 'uk-bgs-hydrogeology-site' && item.status === 'VERIFIED');
  const g = (geology?.value || {}) as any; const h = (hydro?.value || {}) as any; const b = (boreholes?.value || {}) as any;
  if (geology || boreholes || hydro) {
    report.geosurvey_context = { ...(report.geosurvey_context || {}), geological_unit_name: g.unitName || report.geosurvey_context?.geological_unit_name || null, lithology_type: g.lithology || g.superficialLithology || report.geosurvey_context?.lithology_type || null, geological_period_era: g.geologicalAge || report.geosurvey_context?.geological_period_era || null, groundwater_regime: h.descriptor || report.geosurvey_context?.groundwater_regime || null, bgs_evidence_status: geology ? 'VERIFIED' : 'REQUIRES_VERIFICATION', bgs_map_evidence_count: geology ? 1 : 0, bgs_borehole_count: b.count || 0, bgs_nearest_borehole_distance_km: b.nearestDistanceKm ?? null, bgs_nearest_borehole_id: b.nearestRecordId ?? null, bgs_sources: items.filter(item => item.sourceName === BGS).map(item => ({ category: item.category, url: item.sourceUrl, status: item.status, limitation: item.limitation })) };
    if (geology) report.geosurvey_context.evidence_level = 'VERIFIED';
    if (hydro && report.soil) report.soil.groundwaterRegime = h.descriptor || null;
  }
  const flood = items.find(item => item.id === 'uk-ea-flood-site' && item.status === 'VERIFIED');
  if (flood && report.terrain?.floodInundationRisk) { const f = flood.value as any; report.terrain.floodInundationRisk = { ...report.terrain.floodInundationRisk, status: 'VERIFIED', level: f.level, sourceName: EA, description: `Environment Agency Flood Map for Planning: ${f.zone}.`, limitation: flood.limitation }; }
  const landslide = items.find(item => item.id.includes('landslides') && item.status === 'VERIFIED'); const landslideLevel = riskLevel((landslide?.value as any)?.rating);
  if (landslide && landslideLevel && report.terrain?.geohazards?.landslideSusceptibility) report.terrain.geohazards.landslideSusceptibility = { ...report.terrain.geohazards.landslideSusceptibility, status: 'VERIFIED', level: landslideLevel, sourceName: BGS, description: landslide.claim, limitation: landslide.limitation };
  const mining = items.find(item => item.id.includes('non-coal-mining') && item.status === 'VERIFIED');
  if (mining && report.terrain?.geohazards?.miningSubsidence) { const rating = clean((mining.value as any)?.rating); report.terrain.geohazards.miningSubsidence = { ...report.terrain.geohazards.miningSubsidence, status: 'VERIFIED', classification: rating || 'Mapped BGS mining-hazard context', sourceName: BGS, limitation: mining.limitation }; }
}
