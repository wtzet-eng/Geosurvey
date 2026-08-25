/**
 * ISRIC SoilGrids 2.0 integration.
 *
 * GeoSurvey treats SoilGrids as modelled pedological context only. Partial
 * scientific evidence is preserved: a missing pH, SOC, bulk-density, CEC or
 * deeper-depth value must not erase an otherwise usable sand/silt/clay texture.
 */

export interface SoilLayerDepth {
  depthRange: string;
  topDepthCm: number;
  bottomDepthCm: number;
  sandPct: number;
  siltPct: number;
  clayPct: number;
  bulkDensityGcm3: number;
  soilOrganicCarbonPct: number;
  phH2O: number;
  cec: number;
  textureClass: string;
  estimatedBearingCapacityKpa: number;
  mechanicalDescription: string;
}

export interface SoilGridsResult {
  success: boolean;
  sourceName: string;
  sourceUrl: string;
  datasetVersion: string;
  usdaTextureClass: string;
  topsoilClayPct: number;
  topsoilSandPct: number;
  topsoilSiltPct: number;
  subsoilClayPct: number;
  subsoilSandPct: number;
  subsoilSiltPct: number;
  meanBulkDensityGcm3: number;
  meanPhH2O: number;
  meanOrganicCarbonPct: number;
  estimatedBearingCapacityKpa: string;
  effectiveFrictionAngleDeg: number;
  cohesionKpa: number;
  hydraulicConductivityMs: string;
  drainageClass: string;
  frostSusceptibilityClass: 'F1 (Non-frost-susceptible)' | 'F2 (Low-to-medium frost susceptibility)' | 'F3 (High frost susceptibility)' | 'Not available';
  topsoilStrippingDepthCm: number;
  stratigraphyProfile: SoilLayerDepth[];
  limitation: string;
}

const SOILGRIDS_WMS = 'https://maps.isric.org/mapserv';
const SOILGRIDS_REST = 'https://rest.isric.org/soilgrids/v2.0/properties/query';
const WMS_PROPERTIES = ['sand', 'silt', 'clay', 'soc', 'bdod', 'phh2o'] as const;
const WMS_DEPTHS = ['0-5cm', '30-60cm'] as const;
const REST_DEPTHS = ['0-5cm', '5-15cm', '15-30cm', '30-60cm', '60-100cm', '100-200cm'] as const;
const REST_PROPERTIES = ['clay', 'sand', 'silt', 'soc', 'bdod', 'phh2o', 'cec'] as const;

function fallbackResult(): SoilGridsResult {
  return {
    success: false,
    sourceName: 'ISRIC - World Soil Information (SoilGrids 2.0 Global Dataset)',
    sourceUrl: 'https://www.isric.org/explore/soilgrids',
    datasetVersion: 'SoilGrids v2.0 (250m Resolution)',
    usdaTextureClass: 'Not available',
    topsoilClayPct: NaN,
    topsoilSandPct: NaN,
    topsoilSiltPct: NaN,
    subsoilClayPct: NaN,
    subsoilSandPct: NaN,
    subsoilSiltPct: NaN,
    meanBulkDensityGcm3: NaN,
    meanPhH2O: NaN,
    meanOrganicCarbonPct: NaN,
    estimatedBearingCapacityKpa: 'Not available',
    effectiveFrictionAngleDeg: NaN,
    cohesionKpa: NaN,
    hydraulicConductivityMs: 'Not available',
    drainageClass: 'Not available',
    frostSusceptibilityClass: 'Not available',
    topsoilStrippingDepthCm: NaN,
    stratigraphyProfile: [],
    limitation: 'SoilGrids texture evidence was unavailable or invalid. No site soil classification or engineering parameter has been inferred; site investigation is required for design.'
  };
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const rounded = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const meanFinite = (values: number[]): number => {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : NaN;
};
const scaleSoilGrids = (property: string, raw: number): number => property === 'soc' || property === 'bdod' ? raw / 100 : property === 'phh2o' ? raw / 10 : property === 'cec' ? raw : raw / 10;

function textureIsUsable(sand: number, silt: number, clay: number): boolean {
  return [sand, silt, clay].every(Number.isFinite) && sand >= 0 && silt >= 0 && clay >= 0 && sand + silt + clay > 0;
}

function layerFromValues(depthRange: string, topDepthCm: number, bottomDepthCm: number, values: Record<string, number | null | undefined>): SoilLayerDepth | null {
  const rawSand = values.sand;
  const rawSilt = values.silt;
  const rawClay = values.clay;
  if (!finite(rawSand) || !finite(rawSilt) || !finite(rawClay)) return null;
  const sandPct = rounded(scaleSoilGrids('sand', rawSand));
  const siltPct = rounded(scaleSoilGrids('silt', rawSilt));
  const clayPct = rounded(scaleSoilGrids('clay', rawClay));
  if (!textureIsUsable(sandPct, siltPct, clayPct)) return null;

  const optional = (property: string) => finite(values[property]) ? scaleSoilGrids(property, values[property] as number) : NaN;
  const textureClass = getUsdaTextureClass(sandPct, siltPct, clayPct);
  return {
    depthRange,
    topDepthCm,
    bottomDepthCm,
    sandPct,
    siltPct,
    clayPct,
    bulkDensityGcm3: rounded(optional('bdod'), 2),
    soilOrganicCarbonPct: rounded(optional('soc'), 2),
    phH2O: rounded(optional('phh2o')),
    cec: rounded(optional('cec')),
    textureClass,
    estimatedBearingCapacityKpa: NaN,
    mechanicalDescription: `${textureClass}; modelled pedological profile only (not site-specific geotechnical testing)`
  };
}

function summarizeLayers(layers: SoilLayerDepth[], sourceName: string, sourceUrl: string, datasetVersion: string, limitation: string): SoilGridsResult | null {
  const topsoil = layers.filter(layer => layer.bottomDepthCm <= 30);
  if (!topsoil.length) return null;
  const subsoil = layers.filter(layer => layer.topDepthCm >= 30);
  const avg = (items: SoilLayerDepth[], key: keyof SoilLayerDepth) => items.length ? meanFinite(items.map(item => item[key] as number)) : NaN;
  const topSand = avg(topsoil, 'sandPct');
  const topSilt = avg(topsoil, 'siltPct');
  const topClay = avg(topsoil, 'clayPct');
  if (!textureIsUsable(topSand, topSilt, topClay)) return null;
  const subSand = avg(subsoil, 'sandPct');
  const subSilt = avg(subsoil, 'siltPct');
  const subClay = avg(subsoil, 'clayPct');

  return {
    ...fallbackResult(),
    success: true,
    sourceName,
    sourceUrl,
    datasetVersion,
    usdaTextureClass: getUsdaTextureClass(topSand, topSilt, topClay),
    topsoilClayPct: rounded(topClay),
    topsoilSandPct: rounded(topSand),
    topsoilSiltPct: rounded(topSilt),
    subsoilClayPct: Number.isFinite(subClay) ? rounded(subClay) : NaN,
    subsoilSandPct: Number.isFinite(subSand) ? rounded(subSand) : NaN,
    subsoilSiltPct: Number.isFinite(subSilt) ? rounded(subSilt) : NaN,
    meanBulkDensityGcm3: rounded(meanFinite(layers.map(layer => layer.bulkDensityGcm3)), 2),
    meanPhH2O: rounded(meanFinite(layers.map(layer => layer.phH2O))),
    meanOrganicCarbonPct: rounded(meanFinite(layers.map(layer => layer.soilOrganicCarbonPct)), 2),
    stratigraphyProfile: layers,
    limitation
  };
}

async function fetchWithTimeout(url: string, accept: string, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: { Accept: accept, 'User-Agent': 'GeoSurvey/1.0 scientific soil screening' }, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function numericValue(input: any): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (!input || typeof input !== 'object') return null;
  for (const [key, value] of Object.entries(input)) {
    if (/value|mean|GRAY_INDEX/i.test(key) && Number.isFinite(Number(value))) return Number(value);
    const nested = numericValue(value);
    if (nested !== null) return nested;
  }
  return null;
}

function responseValue(body: string, contentType: string): number | null {
  if (/json/i.test(contentType) || /^\s*[\[{]/.test(body)) {
    try {
      const parsed = numericValue(JSON.parse(body));
      if (parsed !== null) return parsed;
    } catch { /* continue with text/XML */ }
  }
  const keyed = body.match(/(?:GRAY_INDEX|value|mean)\s*(?:=|:)\s*["']?(-?\d+(?:\.\d+)?)/i)
    || body.match(/(?:GRAY_INDEX|value|mean)=["'](-?\d+(?:\.\d+)?)["']/i);
  if (keyed) return Number(keyed[1]);
  const element = body.match(/<(?:[^:>]+:)?(?:GRAY_INDEX|value|mean)[^>]*>\s*(-?\d+(?:\.\d+)?)\s*</i);
  return element ? Number(element[1]) : null;
}

async function fetchSoilGridsWmsData(lat: number, lng: number): Promise<SoilGridsResult | null> {
  const point = async (property: typeof WMS_PROPERTIES[number], depth: typeof WMS_DEPTHS[number]) => {
    const delta = 0.001;
    const layer = `${property}_${depth}_mean`;
    const params = new URLSearchParams({ map: `/map/${property}.map`, SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetFeatureInfo', SRS: 'EPSG:4326', BBOX: `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`, WIDTH: '3', HEIGHT: '3', X: '1', Y: '1', LAYERS: layer, QUERY_LAYERS: layer, INFO_FORMAT: 'text/plain', FEATURE_COUNT: '1' });
    const response = await fetchWithTimeout(`${SOILGRIDS_WMS}?${params}`, 'text/plain, application/json, application/xml, text/xml', 4500);
    if (!response?.ok) return null;
    const body = await response.text();
    return responseValue(body, response.headers.get('content-type') || '');
  };

  const entries = await Promise.all(WMS_DEPTHS.flatMap(depth => WMS_PROPERTIES.map(async property => [`${property}:${depth}`, await point(property, depth)] as const)));
  const values = Object.fromEntries(entries) as Record<string, number | null>;
  const parsedLayerCount = Object.values(values).filter(value => value !== null).length;
  console.info('[SoilGrids WMS]', { endpoint: SOILGRIDS_WMS, requestedLayerCount: entries.length, parsedLayerCount });

  const layerFor = (depth: typeof WMS_DEPTHS[number], top: number, bottom: number) => layerFromValues(`${top} – ${bottom} cm`, top, bottom, Object.fromEntries(WMS_PROPERTIES.map(property => [property, values[`${property}:${depth}`]])));
  const layers = [layerFor('0-5cm', 0, 5), layerFor('30-60cm', 30, 60)].filter((layer): layer is SoilLayerDepth => Boolean(layer));
  const missingAncillary = WMS_PROPERTIES.filter(property => !['sand', 'silt', 'clay'].includes(property) && WMS_DEPTHS.some(depth => values[`${property}:${depth}`] === null));
  const limitation = `SoilGrids 250 m modelled raster context. Usable sand/silt/clay evidence is retained even when optional properties are unavailable${missingAncillary.length ? ` (${[...new Set(missingAncillary)].join(', ')})` : ''}. No bearing capacity, friction angle, cohesion, settlement, hydraulic design value or foundation recommendation is inferred.`;
  return summarizeLayers(layers, 'ISRIC SoilGrids 2.0 (WMS raster point access)', SOILGRIDS_WMS, 'SoilGrids 2.0 — 250 m raster; available mean depth values', limitation);
}

async function fetchSoilGridsRestData(lat: number, lng: number): Promise<SoilGridsResult | null> {
  const propsQuery = REST_PROPERTIES.map(property => `property=${property}`).join('&');
  const depthsQuery = REST_DEPTHS.map(depth => `depth=${depth}`).join('&');
  const url = `${SOILGRIDS_REST}?lon=${lng}&lat=${lat}&${propsQuery}&${depthsQuery}`;
  const response = await fetchWithTimeout(url, 'application/json', 6500);
  if (!response?.ok) return null;

  let json: any;
  try { json = await response.json(); } catch { return null; }
  if (!Array.isArray(json?.properties?.layers)) return null;
  const sourceLayers = json.properties.layers;
  const findProperty = (name: string) => sourceLayers.find((layer: any) => layer.name === name);
  const valueAt = (property: string, depth: string): number | undefined => {
    const layer = findProperty(property);
    if (!layer || !Array.isArray(layer.depths)) return undefined;
    const depthObject = layer.depths.find((item: any) => item.label === depth);
    const value = depthObject?.values?.mean ?? depthObject?.values?.median;
    return finite(value) ? value : undefined;
  };
  const depthDefs = [
    { label: '0-5cm', top: 0, bottom: 5 },
    { label: '5-15cm', top: 5, bottom: 15 },
    { label: '15-30cm', top: 15, bottom: 30 },
    { label: '30-60cm', top: 30, bottom: 60 },
    { label: '60-100cm', top: 60, bottom: 100 },
    { label: '100-200cm', top: 100, bottom: 200 }
  ];
  const layers = depthDefs.map(def => layerFromValues(`${def.top} – ${def.bottom} cm`, def.top, def.bottom, Object.fromEntries(REST_PROPERTIES.map(property => [property, valueAt(property, def.label)])))).filter((layer): layer is SoilLayerDepth => Boolean(layer));
  const missingOptional = REST_PROPERTIES.filter(property => !['sand', 'silt', 'clay'].includes(property) && REST_DEPTHS.some(depth => valueAt(property, depth) === undefined));
  const limitation = `SoilGrids 250 m modelled pedological estimates. Partial valid texture depths are retained instead of being discarded when optional properties are missing${missingOptional.length ? ` (${[...new Set(missingOptional)].join(', ')})` : ''}. No bearing capacity, friction angle, cohesion, settlement, hydraulic design value or foundation recommendation is inferred.`;
  return summarizeLayers(layers, 'ISRIC - World Soil Information (SoilGrids 2.0 REST API)', url, 'SoilGrids v2.0 (250m Resolution)', limitation);
}

/**
 * Determine USDA Soil Texture Triangle Classification.
 */
export function getUsdaTextureClass(sand: number, silt: number, clay: number): string {
  if (sand + 1.5 * clay < 15) return 'Silt';
  if (sand + 2 * clay < 30) return 'Silt Loam';
  if (clay >= 40) {
    if (sand >= 45) return 'Sandy Clay';
    if (silt >= 40) return 'Silty Clay';
    return 'Clay';
  }
  if (clay >= 27 && clay < 40) {
    if (sand >= 45) return 'Sandy Clay Loam';
    if (sand <= 20) return 'Silty Clay Loam';
    return 'Clay Loam';
  }
  if (clay >= 7 && clay < 27) {
    if (silt >= 50) return 'Silt Loam';
    if (sand >= 52) return 'Sandy Loam';
    return 'Loam';
  }
  if (silt + 1.5 * clay < 15) return 'Sand';
  if (silt + 2 * clay < 30) return 'Loamy Sand';
  return 'Sandy Loam';
}

export async function fetchGenuineSoilGridsData(lat: number, lng: number): Promise<SoilGridsResult> {
  // WMS is intentionally attempted first: it is the stable raster access path and
  // lets us retain independent properties when another endpoint or field is down.
  const wms = await fetchSoilGridsWmsData(lat, lng);
  if (wms?.success) return wms;

  const rest = await fetchSoilGridsRestData(lat, lng);
  if (rest?.success) return rest;

  return fallbackResult();
}
