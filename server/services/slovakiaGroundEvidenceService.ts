import { EvidenceLevel } from '../types';

export interface SlovakiaGroundEvidence {
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

const SGUDS = 'Štátny geologický ústav Dionýza Štúra (ŠGÚDŠ)';
const GM50 = 'https://ags.geology.sk/arcgis/rest/services/WebServices/GM50/MapServer';
const GM200 = 'https://ags.geology.sk/arcgis/rest/services/wgs_geologickeMapy/geologickaMapaSR_200_wgs/MapServer';
const IGR50 = 'https://ags.geology.sk/arcgis/rest/services/WebServices/IGR50/MapServer';
const HG50 = 'https://ags.geology.sk/arcgis/rest/services/WebServices/HG50/MapServer';
const VRTY = 'https://ags.geology.sk/arcgis/rest/services/WebServices/VRTY/MapServer';
const LANDSLIDES = 'https://ags.geology.sk/arcgis/rest/services/SvahoveDeformacie_MIL1/MapServer';
const PORTAL = 'https://www.geology.sk/maps-and-data/';
const today = () => new Date().toISOString().slice(0, 10);

const text = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned && !/^(null|none|unknown|n\/a|bez udaja|bez údaja)$/i.test(cleaned) ? cleaned : null;
};

const numeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const n = Number(value.replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
};

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 7000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json', 'User-Agent': 'GeoSurvey/1.0 Slovakia ground evidence' }, signal: controller.signal });
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
    where: '1=1', geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: options.returnGeometry ? 'true' : 'false', f: 'json'
  });
  if (options.returnGeometry) params.set('outSR', '4326');
  if (options.distanceM) { params.set('distance', String(options.distanceM)); params.set('units', 'esriSRUnit_Meter'); }
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
  for (const key of keys) {
    const actual = Object.keys(attrs).find(candidate => candidate.toLowerCase() === key.toLowerCase());
    if (actual) { const value = text(attrs[actual]); if (value) return value; }
  }
  return null;
}

function firstMatching(attrs: Attributes, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const key = Object.keys(attrs).find(candidate => pattern.test(candidate));
    if (key) { const value = text(attrs[key]); if (value) return value; }
  }
  return null;
}

function unavailable(id: string, category: string, sourceUrl: string, claim: string): SlovakiaGroundEvidence {
  return {
    id, category, claim, status: 'REQUIRES_VERIFICATION', sourceName: SGUDS, sourceUrl, datasetDate: today(),
    spatialRelationship: 'Selected site coordinate', calculationMethod: 'Official ŠGÚDŠ ArcGIS REST query', confidence: 'Low',
    value: { reasonCode: 'SOURCE_UNAVAILABLE' }, limitation: 'Source failure or an empty automated response is not evidence that the mapped condition is absent; verify in the ŠGÚDŠ portal.', reasonCode: 'SOURCE_UNAVAILABLE'
  };
}

export function mapSlovakLandslideClass(code: unknown): 'Low' | 'Moderate' | 'High' | 'Not available' {
  const value = String(code ?? '').trim().toUpperCase();
  if (value === 'I.' || value === 'I') return 'Low';
  if (value.startsWith('III')) return 'High';
  if (value.startsWith('II')) return 'Moderate';
  return 'Not available';
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function boreholeRows(features: any[], lat: number, lng: number, purposeFilter?: RegExp) {
  return features.map(feature => {
    const attrs = cleanAttributes(feature);
    const purpose = first(attrs, ['ucelvrtuskupina', 'typvrtupopis', 'ucelvrtu']);
    const x = numeric(feature?.geometry?.x); const y = numeric(feature?.geometry?.y);
    return {
      identifier: first(attrs, ['oznacenievrtuvsprave', 'povodneevidencnecislo']) || firstMatching(attrs, [/evidenc/i, /oznacen/i]) || 'registered borehole',
      purpose,
      depthM: numeric(attrs.hlbkadiela) ?? numeric(attrs.hlbka) ?? numeric(attrs.hlbkadielaminimalna),
      archiveNumber: first(attrs, ['archivnecislo']),
      distanceM: x !== null && y !== null ? Math.round(haversineM(lat, lng, y, x)) : null,
      attributes: attrs
    };
  }).filter(row => !purposeFilter || purposeFilter.test(row.purpose || '')).sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity)).slice(0, 8);
}

async function queryEngineeringZone(lat: number, lng: number, fetcher: FetchLike): Promise<SlovakiaGroundEvidence> {
  const meta = await fetchJson(fetcher, `${IGR50}?f=json`, 5000);
  const layers = Array.isArray(meta?.layers) ? meta.layers : [];
  const leaf = layers.find((layer: any) => (!Array.isArray(layer.subLayerIds) || layer.subLayerIds.length === 0) && /inžiniers|inziniers|rajon/i.test(String(layer.name || '')))
    || layers.find((layer: any) => !Array.isArray(layer.subLayerIds) || layer.subLayerIds.length === 0);
  if (!leaf || !Number.isInteger(leaf.id)) return unavailable('sk-sguds-engineering-geology-unavailable', 'Engineering-geological zoning', IGR50, 'The 1:50,000 engineering-geological zoning service could not be resolved automatically.');
  const features = await queryFeatures(fetcher, IGR50, leaf.id, lat, lng, { resultRecordCount: 3 });
  if (!features) return unavailable('sk-sguds-engineering-geology-unavailable', 'Engineering-geological zoning', IGR50, 'The 1:50,000 engineering-geological zoning service did not return a valid response.');
  if (!features.length) return {
    ...unavailable('sk-sguds-engineering-geology-no-data', 'Engineering-geological zoning', IGR50, 'No engineering-geological zone was returned at the selected coordinate.'),
    value: { reasonCode: 'NO_DATA' }, reasonCode: 'NO_DATA'
  };
  const attrs = cleanAttributes(features[0]);
  const zone = firstMatching(attrs, [/nazov.*rajon/i, /^rajon/i, /podrajon/i, /symbol/i, /kod/i, /code/i]) || String(leaf.name);
  const formation = firstMatching(attrs, [/litolog/i, /formac/i, /genet/i, /nazov/i]);
  return {
    id: 'sk-sguds-engineering-geology-50k', category: 'Engineering-geological zoning',
    claim: `The selected site intersects ŠGÚDŠ 1:50,000 engineering-geological zone ${zone}${formation && formation !== zone ? ` (${formation})` : ''}.`,
    status: 'VERIFIED', sourceName: SGUDS, sourceUrl: IGR50, datasetDate: today(), spatialRelationship: 'Polygon containing the selected site coordinate',
    calculationMethod: 'Point-in-polygon query against the ŠGÚDŠ Engineering-Geological Zones of Slovakia 1:50,000 service', confidence: 'High',
    value: { zone, formation, attributes: attrs, scale: '1:50,000' },
    limitation: 'Regional engineering-geological zoning is screening evidence. It does not provide parcel-specific stratigraphy, density/consistency, groundwater level, strength, bearing capacity or foundation recommendations.'
  };
}

export async function querySlovakiaGroundEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<SlovakiaGroundEvidence[]> {
  const [gm50, gm200, engineering, hydroUpper, hydroLower, landslide, otherBoreholes, hydroBoreholes] = await Promise.all([
    queryFeatures(fetcher, GM50, 2, lat, lng, { resultRecordCount: 2 }),
    queryFeatures(fetcher, GM200, 1, lat, lng, { resultRecordCount: 2 }),
    queryEngineeringZone(lat, lng, fetcher),
    queryFeatures(fetcher, HG50, 3, lat, lng, { resultRecordCount: 2 }),
    queryFeatures(fetcher, HG50, 4, lat, lng, { resultRecordCount: 2 }),
    queryFeatures(fetcher, LANDSLIDES, 6, lat, lng, { resultRecordCount: 2 }),
    queryFeatures(fetcher, VRTY, 1, lat, lng, { distanceM: 5000, returnGeometry: true, resultRecordCount: 100 }),
    queryFeatures(fetcher, VRTY, 0, lat, lng, { distanceM: 5000, returnGeometry: true, resultRecordCount: 100 })
  ]);

  const items: SlovakiaGroundEvidence[] = [];

  if (gm50?.length) {
    const attrs = cleanAttributes(gm50[0]);
    const unitCode = first(attrs, ['it', 'it1']) || 'mapped unit';
    const unit = first(attrs, ['ksuvrstvie', 'skupina', 'utv']);
    const description = first(attrs, ['popis']);
    const age = [first(attrs, ['vek1']), first(attrs, ['vek2']), first(attrs, ['vek3'])].filter(Boolean).join(' / ') || null;
    items.push({
      id: 'sk-sguds-geology-50k', category: 'Mapped geology',
      claim: `ŠGÚDŠ 1:50,000 geology maps the selected coordinate as ${unit || description || unitCode}${description && description !== unit ? ` — ${description}` : ''}.`,
      status: 'VERIFIED', sourceName: SGUDS, sourceUrl: GM50, datasetDate: today(), spatialRelationship: '1:50,000 geological polygon containing the selected site coordinate',
      calculationMethod: 'ArcGIS point-in-polygon query of the public ŠGÚDŠ WebServices/GM50 polygon layer 2', confidence: 'High',
      value: { unitCode, unit, description, age, attributes: attrs, scale: '1:50,000' },
      limitation: 'Mapped 1:50,000 geology is regional geological evidence, not a borehole log or parcel-specific subsurface profile. Descriptive attributes are reported directly from the official feature layer rather than inferred from the map code.'
    });
  } else items.push(unavailable('sk-sguds-geology-50k-unavailable', 'Mapped geology', GM50, 'The public national 1:50,000 geological polygon service did not return a usable site feature.'));

  if (gm200?.length) {
    const attrs = cleanAttributes(gm200[0]);
    const unit = first(attrs, ['jednotky_s', 'skupiny_sk', 'utvar_sk']) || first(attrs, ['nazov_sk']) || 'mapped geological unit';
    const description = first(attrs, ['nazov_sk']);
    const age = [first(attrs, ['utvar_sk']), first(attrs, ['odd_sk'])].filter(Boolean).join(' / ') || null;
    items.push({
      id: 'sk-sguds-geology-descriptive-200k', category: 'Mapped geology', claim: `ŠGÚDŠ 1:200,000 descriptive geology maps the site as ${unit}${description && description !== unit ? ` — ${description}` : ''}.`, status: 'VERIFIED', sourceName: SGUDS, sourceUrl: GM200,
      datasetDate: today(), spatialRelationship: '1:200,000 geological polygon containing the selected site coordinate', calculationMethod: 'ArcGIS point-in-polygon query of the official GM200 descriptive polygon layer', confidence: 'Medium',
      value: { unit, description, age, unitCode: first(attrs, ['idvmp']), attributes: attrs, scale: '1:200,000' }, limitation: 'This broader-scale map is retained as descriptive context and fallback. The 1:50,000 mapped feature takes precedence when its descriptive fields are available.'
    });
  } else items.push(unavailable('sk-sguds-geology-descriptive-unavailable', 'Mapped geology', GM200, 'The official descriptive geological layer did not return a usable site feature.'));

  items.push(engineering);

  const hydroFeature = hydroUpper?.[0] || hydroLower?.[0];
  if (hydroFeature) {
    const attrs = cleanAttributes(hydroFeature);
    const lithology = first(attrs, ['nazov']); const permeability = first(attrs, ['typ_priepustnosti']); const functionName = first(attrs, ['hg_funkcia']);
    items.push({
      id: 'sk-sguds-hydrogeology', category: 'Hydrogeological context',
      claim: `The official hydrogeological map identifies ${lithology || 'a mapped groundwater collector'}${permeability ? ` with ${permeability} permeability` : ''}${functionName ? ` (${functionName})` : ''} at the selected coordinate.`,
      status: 'VERIFIED', sourceName: SGUDS, sourceUrl: HG50, datasetDate: today(), spatialRelationship: 'Mapped upper/lower hydrogeological collector intersecting the selected site coordinate',
      calculationMethod: 'Point-in-polygon query of ŠGÚDŠ HG50 upper collector followed by lower collector fallback', confidence: 'Medium',
      value: { lithology, age: first(attrs, ['vek']), permeability, hydrogeologicalFunction: functionName, transmissivityCategory: first(attrs, ['t_kat']), transmissivityVariability: first(attrs, ['t_var_id']), attributes: attrs },
      limitation: 'Mapped collector properties describe hydrogeological context only. They do not establish the parcel water-table depth, seasonal groundwater level, inflow rate or dewatering requirement.'
    });
  } else items.push(unavailable('sk-sguds-hydrogeology-unavailable', 'Hydrogeological context', HG50, 'No usable hydrogeological collector response was returned for the selected coordinate.'));

  if (landslide?.length) {
    const attrs = cleanAttributes(landslide[0]);
    const code = first(attrs, ['podrajon']); const degree = first(attrs, ['stupen']); const character = first(attrs, ['charakteri']);
    const level = mapSlovakLandslideClass(code);
    items.push({
      id: 'sk-sguds-landslide-susceptibility', category: 'Ground hazards',
      claim: `ŠGÚDŠ landslide susceptibility places the selected coordinate in ${code || 'a mapped susceptibility zone'}${degree ? ` (${degree})` : ''}, screened as ${level.toLowerCase()} susceptibility.`,
      status: 'VERIFIED', sourceName: SGUDS, sourceUrl: LANDSLIDES, datasetDate: today(), spatialRelationship: 'Susceptibility polygon containing the selected site coordinate',
      calculationMethod: 'Point-in-polygon query of official slope-deformation susceptibility layer 6; I=stable, II=potentially unstable, III=unstable', confidence: 'High',
      value: { code, degree, character, level, attributes: attrs }, limitation: 'Susceptibility mapping is regional hazard screening. It does not replace site reconnaissance, geomorphological mapping or a geotechnical stability assessment.'
    });
  } else items.push(unavailable('sk-sguds-landslide-susceptibility-unavailable', 'Ground hazards', LANDSLIDES, 'The official slope-deformation susceptibility layer did not return a usable site feature.'));

  const engineeringBoreholes = otherBoreholes ? boreholeRows(otherBoreholes, lat, lng, /inžiniers|inziniers|viacúčel|viacucel/i) : [];
  const hgBoreholes = hydroBoreholes ? boreholeRows(hydroBoreholes, lat, lng) : [];
  if (engineeringBoreholes.length || hgBoreholes.length) {
    const nearest = [...engineeringBoreholes, ...hgBoreholes].filter(row => row.distanceM !== null).sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))[0];
    items.push({
      id: 'sk-sguds-borehole-context', category: 'Borehole / investigation context',
      claim: `ŠGÚDŠ registers ${engineeringBoreholes.length} engineering/multipurpose and ${hgBoreholes.length} hydrogeological borehole(s) within 5 km${nearest ? `; nearest returned record is approximately ${nearest.distanceM} m from the site` : ''}.`,
      status: 'VERIFIED', sourceName: SGUDS, sourceUrl: VRTY, datasetDate: today(), spatialRelationship: 'Registered boreholes within 5 km of the selected site coordinate',
      calculationMethod: 'ArcGIS spatial-radius query of the ŠGÚDŠ drilling-exploration registers; returned coordinates converted to geodesic distance and sorted', confidence: 'Medium',
      value: { searchRadiusM: 5000, engineeringBoreholes, hydrogeologicalBoreholes: hgBoreholes },
      limitation: 'Registry points are nearby observations, not parcel stratigraphy. Their purpose/depth metadata does not establish soil layers, SPT/CPT results, strength, groundwater level or design parameters at the selected site; underlying reports/logs must be reviewed separately.'
    });
  } else items.push(unavailable('sk-sguds-borehole-context-unavailable', 'Borehole / investigation context', VRTY, 'No usable engineering or hydrogeological borehole registry records were returned within the automated 5 km search.'));

  return items;
}

export function enrichSlovakiaGroundEvidence(report: any, items: SlovakiaGroundEvidence[]): void {
  const geology50 = items.find(item => item.id === 'sk-sguds-geology-50k' && item.status === 'VERIFIED');
  const geology200 = items.find(item => item.id === 'sk-sguds-geology-descriptive-200k' && item.status === 'VERIFIED');
  const hydro = items.find(item => item.id === 'sk-sguds-hydrogeology' && item.status === 'VERIFIED');
  const landslide = items.find(item => item.id === 'sk-sguds-landslide-susceptibility' && item.status === 'VERIFIED');

  if (geology50 || geology200) {
    const detailed = (geology50?.value || {}) as any;
    const regional = (geology200?.value || {}) as any;
    const existing = report.geosurvey_context || {};
    report.geosurvey_context = {
      ...existing,
      geological_unit_name: detailed.unit || regional.unit || detailed.unitCode || existing.geological_unit_name || null,
      lithology_type: detailed.description || regional.description || existing.lithology_type || null,
      geological_period_era: detailed.age || regional.age || existing.geological_period_era || null,
      survey_authority: SGUDS,
      official_portal_url: PORTAL,
      evidence_level: 'VERIFIED',
      mapped_scale: geology50 ? '1:50,000' : '1:200,000'
    };
  }

  if (hydro) {
    const value = hydro.value as any;
    const groundwaterRegime = [value.lithology, value.permeability, value.hydrogeologicalFunction].filter(Boolean).join('; ') || null;
    const context = report.geosurvey_context || {};
    report.geosurvey_context = { ...context, groundwater_regime: groundwaterRegime || context.groundwater_regime || null };
    if (report.soil && groundwaterRegime) report.soil.groundwaterRegime = groundwaterRegime;
  }

  if (landslide && report.terrain?.geohazards?.landslideSusceptibility) {
    const value = landslide.value as any;
    report.terrain.geohazards.landslideSusceptibility = {
      ...report.terrain.geohazards.landslideSusceptibility,
      status: 'VERIFIED',
      level: value.level,
      description: `Official ŠGÚDŠ slope-deformation susceptibility: ${value.code || 'mapped zone'}${value.degree ? `; ${value.degree}` : ''}${value.character ? `; ${value.character}` : ''}.`,
      sourceName: SGUDS,
      limitation: landslide.limitation
    };
  }

  const ground = items.find(item => item.id === 'sk-sguds-engineering-geology-50k' && item.status === 'VERIFIED');
  if (ground) {
    report.ground_context = {
      ...(report.ground_context || {}),
      slovakia_engineering_geology: ground.value,
      sourceName: SGUDS,
      evidenceLevel: 'VERIFIED',
      limitation: ground.limitation
    };
  }
}
