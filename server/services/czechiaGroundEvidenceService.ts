import { EvidenceLevel } from '../types';

export interface CzechiaGroundEvidence {
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
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
}

type FetchLike = typeof fetch;
type Attributes = Record<string, unknown>;

const CGS = 'Czech Geological Survey (ČGS)';
const GEO50 = 'https://mapy.geology.cz/arcgis/rest/services/Geologie/geologicka_mapa50/MapServer';
const IG50 = 'https://mapy.geology.cz/arcgis/rest/services/Geohazardy/IG_rajony50/MapServer';
const HG50 = 'https://mapy.geology.cz/arcgis/rest/services/HydroGeologie/HG50_mapa/MapServer';
const HG_ZONES = 'https://mapy.geology.cz/arcgis/rest/services/HydroGeologie/HG_rajony/MapServer';
const BOREHOLES = 'https://mapy.geology.cz/arcgis/rest/services/Prozkoumanost/Vrtna_prozkoumanost/MapServer';
const LANDSLIDE_SUSCEPTIBILITY = 'https://mapy.geology.cz/arcgis/rest/services/Geohazardy/sesuvna_nachylnost/MapServer';
const SLOPE_DEFORMATIONS = 'https://mapy.geology.cz/arcgis/rest/services/Geohazardy/svahove_deformace/MapServer';
const RADON = 'https://mapy.geology.cz/arcgis/rest/services/Geohazardy/radon_komplexni_informace/MapServer';
const UNDERMINED = 'https://mapy.geology.cz/arcgis/rest/services/Dulni_Dila/poddolovana_uzemi/MapServer';
const PORTAL = 'https://cgs.gov.cz/en/maps-and-data/web-services';
const today = () => new Date().toISOString().slice(0, 10);

const text = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned && !/^(null|none|unknown|n\/a|neuvedeno|bez udaje|bez údaje)$/i.test(cleaned) ? cleaned : null;
};

const numeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const n = Number(value.replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
};

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 7500): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json', 'User-Agent': 'GeoSurvey/1.0 Czechia ground evidence' }, signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    return data && typeof data === 'object' && !data.error ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pointQueryUrl(service: string, layerId: number, lat: number, lng: number, options: { distanceM?: number; returnGeometry?: boolean; resultRecordCount?: number } = {}): string {
  const params = new URLSearchParams({
    f: 'json', where: '1=1', geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: options.returnGeometry ? 'true' : 'false'
  });
  if (options.returnGeometry) params.set('outSR', '4326');
  if (options.distanceM) {
    params.set('distance', String(options.distanceM));
    params.set('units', 'esriSRUnit_Meter');
  }
  if (options.resultRecordCount) params.set('resultRecordCount', String(options.resultRecordCount));
  return `${service}/${layerId}/query?${params}`;
}

async function queryFeatures(fetcher: FetchLike, service: string, layerId: number, lat: number, lng: number, options: { distanceM?: number; returnGeometry?: boolean; resultRecordCount?: number } = {}): Promise<any[] | null> {
  const data = await fetchJson(fetcher, pointQueryUrl(service, layerId, lat, lng, options));
  return data && Array.isArray(data.features) ? data.features : null;
}

function cleanAttributes(feature: any): Attributes {
  const input = feature?.attributes && typeof feature.attributes === 'object' ? feature.attributes : {};
  const output: Attributes = {};
  for (const [key, value] of Object.entries(input)) if (text(value) !== null || numeric(value) !== null) output[key] = value;
  return output;
}

function first(attrs: Attributes, keys: string[]): string | null {
  const index = new Map(Object.keys(attrs).map(key => [key.toLowerCase(), key]));
  for (const requested of keys) {
    const key = index.get(requested.toLowerCase());
    if (key) {
      const value = text(attrs[key]);
      if (value) return value;
    }
  }
  return null;
}

function unavailable(id: string, category: string, sourceUrl: string, claim: string, reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' = 'SOURCE_UNAVAILABLE'): CzechiaGroundEvidence {
  return {
    id, category, claim, status: 'REQUIRES_VERIFICATION', sourceName: CGS, sourceUrl, datasetDate: today(),
    spatialRelationship: 'Selected site coordinate', calculationMethod: 'Official ČGS ArcGIS REST query', confidence: 'Low',
    value: { reasonCode }, limitation: 'Source failure or an empty automated response is not evidence that the mapped condition is absent. Verify the current ČGS map/database and, where relevant, original documentation.', reasonCode
  };
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function boreholeRows(features: any[], lat: number, lng: number) {
  return features.map(feature => {
    const attrs = cleanAttributes(feature);
    const x = numeric(feature?.geometry?.x); const y = numeric(feature?.geometry?.y);
    return {
      identifier: first(attrs, ['klic', 'puv_nazev']) || 'registered geological object',
      name: first(attrs, ['puv_nazev']),
      objectType: first(attrs, ['druh_obj']),
      purpose: first(attrs, ['ucel_obj', 'zamereni']),
      depthM: numeric(attrs.hloubka),
      madeGroundDepthM: numeric(attrs.max_nvz),
      quaternaryThicknessM: numeric(attrs.max_q),
      firstRockBelowQuaternary: first(attrs, ['hornina']),
      stratigraphy: first(attrs, ['strat']),
      year: numeric(attrs.rok_obj),
      distanceM: x !== null && y !== null ? Math.round(haversineM(lat, lng, y, x)) : null
    };
  }).sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity)).slice(0, 12);
}

export function mapCzechLandslideSusceptibility(value: unknown): 'Low' | 'Moderate' | 'High' | 'Not available' {
  const normalized = String(value || '').toLowerCase();
  if (/vysok|high/.test(normalized)) return 'High';
  if (/střed|stred|medium|moderate/.test(normalized)) return 'Moderate';
  if (/nízk|nizk|low/.test(normalized)) return 'Low';
  return 'Not available';
}

export function mapCzechRadonIndex(value: unknown): 'Low' | 'Moderate' | 'High' | 'Not available' {
  const n = numeric(value);
  if (n === 1) return 'Low';
  if (n === 2) return 'Moderate';
  if (n === 3) return 'High';
  return 'Not available';
}

async function queryEngineeringGeology(lat: number, lng: number, fetcher: FetchLike): Promise<CzechiaGroundEvidence> {
  const [detailed, regional] = await Promise.all([
    queryFeatures(fetcher, IG50, 1, lat, lng, { resultRecordCount: 2 }),
    queryFeatures(fetcher, IG50, 0, lat, lng, { resultRecordCount: 2 })
  ]);
  const feature = detailed?.[0] || regional?.[0];
  if (!feature) {
    const reason = detailed === null && regional === null ? 'SOURCE_UNAVAILABLE' : 'NO_DATA';
    return unavailable('cz-cgs-engineering-geology-unavailable', 'Engineering-geological zoning', IG50, 'ČGS engineering-geological zoning returned no usable zone at the selected coordinate.', reason);
  }
  const attrs = cleanAttributes(feature);
  const isDetailed = Boolean(detailed?.[0]);
  const code = first(attrs, isDetailed ? ['rajon_kod'] : ['symbol']);
  const name = first(attrs, isDetailed ? ['nazev'] : ['legenda']);
  const group = isDetailed ? first(attrs, ['rajon_celek']) : null;
  const characterization = isDetailed ? first(attrs, ['ig_charakter']) : null;
  const typicalRocks = isDetailed ? first(attrs, ['hornina']) : null;
  const scale = isDetailed ? '1:50,000' : '1:500,000';
  return {
    id: 'cz-cgs-engineering-geology', category: 'Engineering-geological zoning',
    claim: `ČGS ${scale} engineering-geological zoning maps the selected coordinate as ${name || code || 'a mapped engineering-geological zone'}${code ? ` (${code})` : ''}.`,
    status: 'VERIFIED', sourceName: CGS, sourceUrl: `${IG50}/${isDetailed ? 1 : 0}`, datasetDate: today(),
    spatialRelationship: `${scale} engineering-geological polygon containing the selected site coordinate`,
    calculationMethod: `ArcGIS point-in-polygon query; 1:50,000 engineering-geological zone preferred, 1:500,000 regional fallback only if detailed coverage returns no feature`,
    confidence: isDetailed ? 'High' : 'Medium',
    value: { code, name, group, characterization, typicalRocks, scale, tier: isDetailed ? 1 : 2, attributes: attrs },
    limitation: 'Engineering-geological zoning is screening evidence. It does not establish parcel stratigraphy, density/consistency, groundwater level, bearing capacity, cohesion, friction angle or foundation design.'
  };
}

async function queryHydrogeology(lat: number, lng: number, fetcher: FetchLike): Promise<CzechiaGroundEvidence> {
  const [detailed, upper, deep, base] = await Promise.all([
    queryFeatures(fetcher, HG50, 3, lat, lng, { resultRecordCount: 2 }),
    queryFeatures(fetcher, HG_ZONES, 1, lat, lng, { resultRecordCount: 2 }),
    queryFeatures(fetcher, HG_ZONES, 3, lat, lng, { resultRecordCount: 2 }),
    queryFeatures(fetcher, HG_ZONES, 5, lat, lng, { resultRecordCount: 2 })
  ]);
  if (detailed?.[0]) {
    const attrs = cleanAttributes(detailed[0]);
    const unit = first(attrs, ['geologick_jednotka']);
    const rock = first(attrs, ['hornina']);
    const stratigraphy = first(attrs, ['stratigraficke_zarazeni']);
    const transmissivity = first(attrs, ['transmisivita_hornin']);
    const description = first(attrs, ['popis']);
    return {
      id: 'cz-cgs-hydrogeology', category: 'Hydrogeological context',
      claim: `ČGS 1:50,000 hydrogeology maps the site${unit ? ` in ${unit}` : ''}${rock ? ` (${rock})` : ''}${transmissivity ? `; rock transmissivity: ${transmissivity}` : ''}.`,
      status: 'VERIFIED', sourceName: CGS, sourceUrl: `${HG50}/3`, datasetDate: today(),
      spatialRelationship: '1:50,000 hydrogeological polygon containing the selected site coordinate',
      calculationMethod: 'ArcGIS point-in-polygon query of HydroGEOČR50 hydrogeological units/transmissivity layer', confidence: 'High',
      value: { unit, rock, stratigraphy, transmissivity, description, scale: '1:50,000', tier: 1, attributes: attrs },
      limitation: 'Hydrogeological mapping describes regional groundwater-bearing characteristics and rock transmissivity. It does not establish parcel groundwater depth, seasonal water level, inflow rate or dewatering requirement.'
    };
  }

  const fallbacks: Array<{ features: any[] | null; layerId: number; layer: string }> = [
    { features: upper, layerId: 1, layer: 'upper' },
    { features: deep, layerId: 3, layer: 'deep' },
    { features: base, layerId: 5, layer: 'base' }
  ];
  const fallback = fallbacks.find(item => item.features?.[0]);
  if (fallback?.features?.[0]) {
    const attrs = cleanAttributes(fallback.features[0]);
    const zoneId = first(attrs, ['rajon_id']);
    const name = first(attrs, ['nazev']);
    return {
      id: 'cz-cgs-hydrogeology', category: 'Hydrogeological context',
      claim: `ČGS national hydrogeological zoning identifies ${name || `zone ${zoneId || 'mapped zone'}`} at the selected coordinate.`,
      status: 'VERIFIED', sourceName: CGS, sourceUrl: `${HG_ZONES}/${fallback.layerId}`, datasetDate: today(),
      spatialRelationship: `Hydrogeological ${fallback.layer} zone containing the selected site coordinate`,
      calculationMethod: 'ArcGIS point-in-polygon query of the 2005 national hydrogeological-zone layers after no detailed HydroGEOČR50 feature was returned', confidence: 'Medium',
      value: { zoneId, name, layer: fallback.layer, scale: 'national hydrogeological zoning (2005)', tier: 2, attributes: attrs },
      limitation: 'Hydrogeological zoning is broad screening context and does not provide parcel groundwater depth, seasonal variation, permeability testing or design groundwater conditions.'
    };
  }

  const allFailed = detailed === null && upper === null && deep === null && base === null;
  return unavailable('cz-cgs-hydrogeology-unavailable', 'Hydrogeological context', HG50, 'ČGS hydrogeological services returned no usable mapped context at the selected coordinate.', allFailed ? 'SOURCE_UNAVAILABLE' : 'NO_DATA');
}

async function queryBoreholes(lat: number, lng: number, fetcher: FetchLike): Promise<CzechiaGroundEvidence> {
  const [all, hydro] = await Promise.all([
    queryFeatures(fetcher, BOREHOLES, 1, lat, lng, { distanceM: 5000, returnGeometry: true, resultRecordCount: 100 }),
    queryFeatures(fetcher, BOREHOLES, 5, lat, lng, { distanceM: 5000, returnGeometry: true, resultRecordCount: 100 })
  ]);
  if (all === null && hydro === null) return unavailable('cz-cgs-boreholes-unavailable', 'Boreholes and geological investigations', BOREHOLES, 'The ČGS borehole registry could not be queried reliably.');
  const allRows = boreholeRows(all || [], lat, lng);
  const hydroRows = boreholeRows(hydro || [], lat, lng);
  const hydroIds = new Set(hydroRows.map(row => row.identifier));
  const generalRows = allRows.filter(row => !hydroIds.has(row.identifier));
  const combined = [...generalRows, ...hydroRows].sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  if (!combined.length) return unavailable('cz-cgs-boreholes-no-data', 'Boreholes and geological investigations', BOREHOLES, 'ČGS returned no borehole record within the automated 5 km search radius.', 'NO_DATA');
  return {
    id: 'cz-cgs-borehole-context', category: 'Boreholes and geological investigations',
    claim: `ČGS returned ${combined.length} nearby borehole/geological-object record${combined.length === 1 ? '' : 's'} within 5 km, including ${hydroRows.length} record${hydroRows.length === 1 ? '' : 's'} flagged with hydrogeological data.`,
    status: 'VERIFIED', sourceName: CGS, sourceUrl: BOREHOLES, datasetDate: today(),
    spatialRelationship: `Registered investigation objects within 5 km; nearest returned record approximately ${combined[0].distanceM ?? 'unknown'} m from the selected coordinate`,
    calculationMethod: 'ArcGIS REST 5 km radius queries of general boreholes and hydrogeological-data subset, with WGS84 distance calculation and duplicate suppression', confidence: 'Medium',
    value: { searchRadiusM: 5000, boreholes: combined.slice(0, 12), hydrogeologicalBoreholes: hydroRows.slice(0, 12), nearestDistanceM: combined[0].distanceM ?? null },
    limitation: 'Nearby registered boreholes are contextual observations only. They do not establish the strata, groundwater level or geotechnical properties beneath the selected parcel; original logs/reports and site-specific investigation must be reviewed.'
  };
}

async function queryLandslideSusceptibility(lat: number, lng: number, fetcher: FetchLike): Promise<CzechiaGroundEvidence> {
  const features = await queryFeatures(fetcher, LANDSLIDE_SUSCEPTIBILITY, 0, lat, lng, { resultRecordCount: 2 });
  if (!features) return unavailable('cz-cgs-landslide-susceptibility-unavailable', 'Landslide susceptibility', LANDSLIDE_SUSCEPTIBILITY, 'The ČGS national landslide-susceptibility service could not be queried.');
  if (!features.length) return unavailable('cz-cgs-landslide-susceptibility-no-data', 'Landslide susceptibility', LANDSLIDE_SUSCEPTIBILITY, 'No susceptibility polygon was returned at the selected coordinate.', 'NO_DATA');
  const attrs = cleanAttributes(features[0]);
  const descriptor = first(attrs, ['struktura']);
  const level = mapCzechLandslideSusceptibility(descriptor);
  if (level === 'Not available') return unavailable('cz-cgs-landslide-susceptibility-malformed', 'Landslide susceptibility', LANDSLIDE_SUSCEPTIBILITY, 'ČGS returned a susceptibility feature, but its class could not be mapped safely.', 'NO_DATA');
  return {
    id: 'cz-cgs-landslide-susceptibility', category: 'Landslide susceptibility',
    claim: `ČGS landslide-susceptibility mapping classifies the selected coordinate as ${level}${descriptor ? ` (${descriptor})` : ''}.`, status: 'VERIFIED', sourceName: CGS,
    sourceUrl: `${LANDSLIDE_SUSCEPTIBILITY}/0`, datasetDate: today(), spatialRelationship: 'Susceptibility polygon containing the selected site coordinate',
    calculationMethod: 'ArcGIS point-in-polygon query; official low / medium / high susceptibility class mapped conservatively to GeoSurvey Low / Moderate / High', confidence: 'High',
    value: { level, descriptor, attributes: attrs }, limitation: 'Susceptibility mapping is screening evidence based on regional conditions. It does not predict a specific future landslide or replace engineering-geological investigation of the site.'
  };
}

async function querySlopeDeformations(lat: number, lng: number, fetcher: FetchLike): Promise<CzechiaGroundEvidence> {
  const features = await queryFeatures(fetcher, SLOPE_DEFORMATIONS, 1, lat, lng, { resultRecordCount: 10 });
  if (!features) return unavailable('cz-cgs-slope-deformation-unavailable', 'Mapped slope deformations', SLOPE_DEFORMATIONS, 'The ČGS field-verified slope-deformation register could not be queried.');
  if (!features.length) return unavailable('cz-cgs-slope-deformation-no-data', 'Mapped slope deformations', SLOPE_DEFORMATIONS, 'No mapped slope-deformation polygon intersects the selected coordinate.', 'NO_DATA');
  const records = features.slice(0, 10).map(feature => {
    const attrs = cleanAttributes(feature);
    return {
      id: first(attrs, ['id_teren', 'cislo_bodu']),
      featureType: first(attrs, ['nazev']),
      activityCode: numeric(attrs.aktivita),
      groupCode: numeric(attrs.skupina),
      subgroupCode: numeric(attrs.podskupina),
      municipality: first(attrs, ['nazku_obec']),
      cadastralArea: first(attrs, ['nazku_katastr'])
    };
  });
  return {
    id: 'cz-cgs-slope-deformation-site', category: 'Mapped slope deformations',
    claim: `The ČGS field-verified slope-deformation register contains ${records.length} mapped deformation polygon${records.length === 1 ? '' : 's'} intersecting the selected coordinate.`,
    status: 'VERIFIED', sourceName: CGS, sourceUrl: `${SLOPE_DEFORMATIONS}/1`, datasetDate: today(), spatialRelationship: 'Mapped 1:10,000-scale slope-deformation polygon(s) intersecting the selected site coordinate',
    calculationMethod: 'ArcGIS point-in-polygon query of the maintained ČGS slope-deformation register', confidence: 'High', value: { count: records.length, records },
    limitation: 'The register documents mapped/field-verified slope deformations but does not quantify current parcel-scale stability, movement rate or foundation implications. Specialist review is required where a mapped feature intersects the site.'
  };
}

async function queryRadon(lat: number, lng: number, fetcher: FetchLike): Promise<CzechiaGroundEvidence> {
  const features = await queryFeatures(fetcher, RADON, 0, lat, lng, { resultRecordCount: 2 });
  if (!features) return unavailable('cz-cgs-radon-unavailable', 'Radon potential', RADON, 'The ČGS complex radon-information service could not be queried.');
  if (!features.length) return unavailable('cz-cgs-radon-no-data', 'Radon potential', RADON, 'No radon-information administrative unit was returned at the selected coordinate.', 'NO_DATA');
  const attrs = cleanAttributes(features[0]);
  const index = numeric(attrs.radon);
  const classification = mapCzechRadonIndex(index);
  if (classification === 'Not available') return unavailable('cz-cgs-radon-malformed', 'Radon potential', RADON, 'The radon source responded but no valid geological radon index (1–3) could be read.', 'NO_DATA');
  return {
    id: 'cz-cgs-radon', category: 'Radon potential',
    claim: `ČGS / State Office for Nuclear Safety radon information classifies the geological radon index as ${classification} (index ${index}) for the mapped administrative unit.`,
    status: 'VERIFIED', sourceName: `${CGS} / State Office for Nuclear Safety`, sourceUrl: `${RADON}/0`, datasetDate: today(),
    spatialRelationship: 'Administrative-unit radon information containing the selected coordinate', calculationMethod: 'ArcGIS point query of the national complex radon-information layer; official index 1/2/3 mapped to Low/Moderate/High', confidence: 'High',
    value: { classification, index, municipality: first(attrs, ['naz_obec']), districtPart: first(attrs, ['naz_cast']), geologicalRock50: first(attrs, ['hornina50']), measuredBuildings: numeric(attrs.iprum), meanIndoorRadonBqM3: numeric(attrs.avg_prum_k), attributes: attrs },
    limitation: 'This is area-level radon screening combining geological and building-measurement information. It is not a radon measurement for the selected building or parcel and does not replace statutory radon assessment where required.'
  };
}

async function queryMining(lat: number, lng: number, fetcher: FetchLike): Promise<CzechiaGroundEvidence> {
  const features = await queryFeatures(fetcher, UNDERMINED, 1, lat, lng, { resultRecordCount: 10 });
  if (!features) return unavailable('cz-cgs-mining-unavailable', 'Undermined areas', UNDERMINED, 'The ČGS undermined-area service could not be queried.');
  if (!features.length) return unavailable('cz-cgs-mining-no-data', 'Undermined areas', UNDERMINED, 'No registered undermined-area polygon intersects the selected coordinate.', 'NO_DATA');
  const records = features.slice(0, 10).map(feature => {
    const attrs = cleanAttributes(feature);
    return {
      id: numeric(attrs.id_sur_pod), name: first(attrs, ['nazev']), commodity: first(attrs, ['surovina']), age: first(attrs, ['stari']),
      manifestations: first(attrs, ['projevy']), accuracy: first(attrs, ['presnost']), documentation: first(attrs, ['dokument']), credibility: first(attrs, ['verohodno']), year: numeric(attrs.rok)
    };
  });
  return {
    id: 'cz-cgs-mining-undermined-site', category: 'Undermined areas',
    claim: `The selected coordinate intersects ${records.length} registered ČGS undermined-area polygon${records.length === 1 ? '' : 's'}.`, status: 'VERIFIED', sourceName: CGS,
    sourceUrl: `${UNDERMINED}/1`, datasetDate: today(), spatialRelationship: 'Registered undermined-area polygon(s) containing the selected site coordinate',
    calculationMethod: 'ArcGIS point-in-polygon query of the continuously maintained ČGS undermined-areas database', confidence: 'High', value: { count: records.length, records },
    limitation: 'An undermined-area intersection is a material screening constraint, not a prediction of subsidence magnitude or structural effect. Original mining records and specialist ground-risk assessment are required.'
  };
}

export async function queryCzechiaGroundEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<CzechiaGroundEvidence[]> {
  const [geology, engineering, hydro, boreholes, susceptibility, deformation, radon, mining] = await Promise.all([
    queryFeatures(fetcher, GEO50, 2, lat, lng, { resultRecordCount: 2 }),
    queryEngineeringGeology(lat, lng, fetcher),
    queryHydrogeology(lat, lng, fetcher),
    queryBoreholes(lat, lng, fetcher),
    queryLandslideSusceptibility(lat, lng, fetcher),
    querySlopeDeformations(lat, lng, fetcher),
    queryRadon(lat, lng, fetcher),
    queryMining(lat, lng, fetcher)
  ]);

  const items: CzechiaGroundEvidence[] = [];
  if (geology?.[0]) {
    const attrs = cleanAttributes(geology[0]);
    const lithology = first(attrs, ['hor_karto', 'hor_typ']);
    const unit = first(attrs, ['souvrstvi', 'reg_jed', 'reg_subjed', 'trad_nazev']) || lithology;
    const genesis = first(attrs, ['geneze']);
    const age = [first(attrs, ['era']), first(attrs, ['utvar']), first(attrs, ['oddeleni']), first(attrs, ['stupen']), first(attrs, ['podstupen'])].filter(Boolean).join(' / ') || null;
    items.push({
      id: 'cz-cgs-geology-50k', category: 'Mapped geology',
      claim: `ČGS GEOČR50 maps the selected coordinate as ${unit || lithology || 'a mapped geological unit'}${lithology && lithology !== unit ? ` — ${lithology}` : ''}${genesis ? `; genesis: ${genesis}` : ''}.`,
      status: 'VERIFIED', sourceName: CGS, sourceUrl: `${GEO50}/2`, datasetDate: today(), spatialRelationship: '1:50,000 geological polygon containing the selected site coordinate',
      calculationMethod: 'ArcGIS point-in-polygon query of GEOČR50 rock-unit layer 2 using explicit published fields', confidence: 'High',
      value: { unit, lithology, rockType: first(attrs, ['hor_typ']), genesis, age, regionalUnit: first(attrs, ['reg_jed']), formation: first(attrs, ['souvrstvi']), mapSheet: first(attrs, ['mapid']), attributes: attrs, scale: '1:50,000' },
      limitation: 'GEOČR50 is authoritative mapped geology, not a site investigation. It does not establish parcel stratigraphy, weathering depth, engineering state or layer thickness.'
    });
  } else items.push(unavailable('cz-cgs-geology-50k-unavailable', 'Mapped geology', GEO50, 'The national GEOČR50 geological layer returned no usable site feature.', geology === null ? 'SOURCE_UNAVAILABLE' : 'NO_DATA'));

  items.push(engineering, hydro, boreholes, susceptibility, deformation, radon, mining);
  return items;
}

export function enrichCzechiaGroundEvidence(report: any, items: CzechiaGroundEvidence[]): void {
  const geology = items.find(item => item.id === 'cz-cgs-geology-50k' && item.status === 'VERIFIED');
  const engineering = items.find(item => item.id === 'cz-cgs-engineering-geology' && item.status === 'VERIFIED');
  const hydro = items.find(item => item.id === 'cz-cgs-hydrogeology' && item.status === 'VERIFIED');
  const boreholes = items.find(item => item.id === 'cz-cgs-borehole-context' && item.status === 'VERIFIED');
  const susceptibility = items.find(item => item.id === 'cz-cgs-landslide-susceptibility' && item.status === 'VERIFIED');
  const deformation = items.find(item => item.id === 'cz-cgs-slope-deformation-site' && item.status === 'VERIFIED');
  const radon = items.find(item => item.id === 'cz-cgs-radon' && item.status === 'VERIFIED');
  const mining = items.find(item => item.id === 'cz-cgs-mining-undermined-site' && item.status === 'VERIFIED');

  const g = (geology?.value || {}) as Record<string, unknown>;
  const h = (hydro?.value || {}) as Record<string, unknown>;
  const b = (boreholes?.value || {}) as Record<string, unknown>;
  const e = (engineering?.value || {}) as Record<string, unknown>;

  if (geology || engineering || hydro || boreholes) {
    report.geosurvey_context = {
      ...(report.geosurvey_context || {}),
      geological_unit_name: text(g.unit) || report.geosurvey_context?.geological_unit_name || null,
      lithology_type: text(g.lithology) || report.geosurvey_context?.lithology_type || null,
      geological_period_era: text(g.age) || report.geosurvey_context?.geological_period_era || null,
      genetic_origin: text(g.genesis) || report.geosurvey_context?.genetic_origin || null,
      groundwater_regime: text(h.transmissivity) || text(h.description) || text(h.name) || report.geosurvey_context?.groundwater_regime || null,
      evidence_level: geology ? 'VERIFIED' : report.geosurvey_context?.evidence_level || 'REQUIRES_VERIFICATION',
      cgs_engineering_zone: text(e.name) || text(e.code) || null,
      cgs_engineering_characterization: text(e.characterization) || null,
      cgs_borehole_count: Array.isArray(b.boreholes) ? b.boreholes.length : 0,
      cgs_nearest_borehole_distance_m: numeric(b.nearestDistanceM),
      official_portal_url: PORTAL
    };
    if (hydro && report.soil) report.soil.groundwaterRegime = text(h.transmissivity) || text(h.description) || text(h.name) || report.soil.groundwaterRegime;
  }

  if (susceptibility && report.terrain?.geohazards?.landslideSusceptibility) {
    const level = text((susceptibility.value as any)?.level) as 'Low' | 'Moderate' | 'High' | null;
    if (level) report.terrain.geohazards.landslideSusceptibility = { ...report.terrain.geohazards.landslideSusceptibility, status: 'VERIFIED', level, sourceName: CGS, description: susceptibility.claim };
  }

  if (deformation && report.terrain?.geohazards?.landslideSusceptibility) {
    report.terrain.geohazards.landslideSusceptibility = { ...report.terrain.geohazards.landslideSusceptibility, status: 'VERIFIED', level: 'High', sourceName: CGS, description: `${deformation.claim} ${report.terrain.geohazards.landslideSusceptibility.description || ''}`.trim() };
  }

  if (radon && report.terrain?.geohazards?.radonPotential) {
    const classification = text((radon.value as any)?.classification);
    if (classification) report.terrain.geohazards.radonPotential = { ...report.terrain.geohazards.radonPotential, status: 'VERIFIED', classification, sourceName: radon.sourceName };
  }

  if (mining && report.terrain?.geohazards?.miningSubsidence) {
    const firstRecord = Array.isArray((mining.value as any)?.records) ? (mining.value as any).records[0] : null;
    const name = text(firstRecord?.name);
    report.terrain.geohazards.miningSubsidence = { ...report.terrain.geohazards.miningSubsidence, status: 'VERIFIED', classification: name ? `Registered undermined area: ${name}` : 'Registered undermined area intersects site', sourceName: CGS };
  }

  // Deliberately do not populate estimatedBearingCapacityKpa, effectiveFrictionAngleDeg,
  // cohesionKpa, estimatedWaterTableDepthM or foundation recommendations from mapped/context data.
}
