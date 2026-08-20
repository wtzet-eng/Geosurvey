/**
 * ISRIC SoilGrids 2.0 REST API Integration Service
 * Fetches genuine global scientific soil data (0-200 cm depth profiles):
 * - Sand, Silt, Clay fractions (g/kg -> %)
 * - Bulk density (cg/cm³ -> g/cm³)
 * - Soil Organic Carbon (dg/kg -> %)
 * - Soil pH in H2O (pH*10 -> pH)
 * - Cation Exchange Capacity (CEC)
 * 
 * Source: ISRIC - World Soil Information (SoilGrids 2.0, 250m spatial resolution)
 * Reference: Poggio et al. (2021) SoilGrids 2.0: producing soil property maps with global coverage
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

async function fetchSoilGridsWmsData(lat: number, lng: number, fallback: SoilGridsResult): Promise<SoilGridsResult> {
  const properties = ['sand', 'silt', 'clay', 'soc', 'bdod', 'phh2o'] as const;
  const depths = ['0-5cm', '30-60cm'] as const;
  const numericValue = (input: any): number | null => {
    if (typeof input === 'number' && Number.isFinite(input)) return input;
    if (!input || typeof input !== 'object') return null;
    for (const [key, value] of Object.entries(input)) {
      if (/value|mean|GRAY_INDEX/i.test(key) && Number.isFinite(Number(value))) return Number(value);
      const nested = numericValue(value); if (nested !== null) return nested;
    }
    return null;
  };
  const responseValue = (body: string, contentType: string): number | null => {
    if (/json/i.test(contentType) || /^\s*[\[{]/.test(body)) {
      try { const parsed = numericValue(JSON.parse(body)); if (parsed !== null) return parsed; } catch { /* try text/XML below */ }
    }
    const keyed = body.match(/(?:GRAY_INDEX|value|mean)\s*(?:=|:)\s*["']?(-?\d+(?:\.\d+)?)/i)
      || body.match(/(?:GRAY_INDEX|value|mean)=["'](-?\d+(?:\.\d+)?)["']/i);
    if (keyed) return Number(keyed[1]);
    const element = body.match(/<(?:[^:>]+:)?(?:GRAY_INDEX|value|mean)[^>]*>\s*(-?\d+(?:\.\d+)?)\s*</i);
    return element ? Number(element[1]) : null;
  };
  const point = async (property: typeof properties[number], depth: typeof depths[number]) => {
    const delta = 0.001; const layer = `${property}_${depth}_mean`;
    const params = new URLSearchParams({ map: `/map/${property}.map`, SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetFeatureInfo', SRS: 'EPSG:4326', BBOX: `${lng-delta},${lat-delta},${lng+delta},${lat+delta}`, WIDTH: '3', HEIGHT: '3', X: '1', Y: '1', LAYERS: layer, QUERY_LAYERS: layer, INFO_FORMAT: 'text/plain', FEATURE_COUNT: '1' });
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(`${SOILGRIDS_WMS}?${params}`, { headers: { Accept: 'text/plain, application/json, application/xml, text/xml', 'User-Agent': 'GeoSurvey/1.0 (SoilGrids WMS point query)' }, signal: controller.signal });
      const contentType = response.headers.get('content-type') || '';
      const body = response.ok ? await response.text() : '';
      return response.ok ? responseValue(body, contentType) : null;
    } catch { return null; } finally { clearTimeout(timeout); }
  };
  const entries = await Promise.all(depths.flatMap(depth => properties.map(async property => [`${property}:${depth}`, await point(property, depth)] as const)));
  const values = Object.fromEntries(entries) as Record<string, number | null>;
  const parsedLayerCount = Object.values(values).filter(value => value !== null).length;
  console.info('[SoilGrids WMS]', { endpoint: SOILGRIDS_WMS, requestedLayerCount: entries.length, parsedLayerCount });
  if (parsedLayerCount !== entries.length) return fallback;
  const scaled = (property: string, depth: string) => { const raw = values[`${property}:${depth}`]!; return property === 'soc' || property === 'bdod' ? raw / 100 : property === 'phh2o' ? raw / 10 : raw / 10; };
  const layer = (depth: typeof depths[number], top: number, bottom: number): SoilLayerDepth => {
    const sand = scaled('sand', depth), silt = scaled('silt', depth), clay = scaled('clay', depth), soc = scaled('soc', depth), density = scaled('bdod', depth), ph = scaled('phh2o', depth);
    return { depthRange: `${top} – ${bottom} cm`, topDepthCm: top, bottomDepthCm: bottom, sandPct: sand, siltPct: silt, clayPct: clay, bulkDensityGcm3: density, soilOrganicCarbonPct: soc, phH2O: ph, cec: NaN, textureClass: getUsdaTextureClass(sand, silt, clay), estimatedBearingCapacityKpa: NaN, mechanicalDescription: 'Modelled pedological properties only; no engineering design parameters inferred.' };
  };
  const top = layer('0-5cm', 0, 5), sub = layer('30-60cm', 30, 60);
  return { ...fallback, success: true, sourceName: 'ISRIC SoilGrids 2.0 (WMS raster point access)', sourceUrl: SOILGRIDS_WMS, datasetVersion: 'SoilGrids 2.0 — 250 m raster, mean values at 0–5 cm and 30–60 cm', usdaTextureClass: top.textureClass, topsoilSandPct: top.sandPct, topsoilSiltPct: top.siltPct, topsoilClayPct: top.clayPct, subsoilSandPct: sub.sandPct, subsoilSiltPct: sub.siltPct, subsoilClayPct: sub.clayPct, meanBulkDensityGcm3: (top.bulkDensityGcm3 + sub.bulkDensityGcm3) / 2, meanPhH2O: (top.phH2O + sub.phH2O) / 2, meanOrganicCarbonPct: (top.soilOrganicCarbonPct + sub.soilOrganicCarbonPct) / 2, stratigraphyProfile: [top, sub], limitation: 'SoilGrids 250 m modelled raster values. Depth intervals and resolution are preserved. No bearing capacity, friction angle, cohesion, settlement or foundation recommendation is inferred.' };
}

/**
 * Determine USDA Soil Texture Triangle Classification
 */
export function getUsdaTextureClass(sand: number, silt: number, clay: number): string {
  // sand + silt + clay = 100%
  if (sand + 1.5 * clay < 15) {
    return 'Silt';
  } else if (sand + 2 * clay < 30) {
    return 'Silt Loam';
  } else if (clay >= 40) {
    if (sand >= 45) return 'Sandy Clay';
    if (silt >= 40) return 'Silty Clay';
    return 'Clay';
  } else if (clay >= 27 && clay < 40) {
    if (sand >= 45) return 'Sandy Clay Loam';
    if (sand <= 20) return 'Silty Clay Loam';
    return 'Clay Loam';
  } else if (clay >= 7 && clay < 27) {
    if (silt >= 50) return 'Silt Loam';
    if (sand >= 52) return 'Sandy Loam';
    return 'Loam';
  } else {
    // clay < 7
    if (silt + 1.5 * clay < 15) return 'Sand';
    if (silt + 2 * clay < 30) return 'Loamy Sand';
    return 'Sandy Loam';
  }
}

/**
 * Estimate Eurocode 7 preliminary allowable bearing capacity (kPa) and shear strength parameters
 */
function estimateBearingParameters(sand: number, silt: number, clay: number, bulkDensity: number): {
  bearingCapacityKpa: number;
  bearingCapacityStr: string;
  frictionAngleDeg: number;
  cohesionKpa: number;
  hydraulicConductivityMs: string;
  drainageClass: string;
  frostSusceptibility: 'F1 (Non-frost-susceptible)' | 'F2 (Low-to-medium frost susceptibility)' | 'F3 (High frost susceptibility)';
} {
  let frictionAngle = 30;
  let cohesion = 5;
  let baseBearing = 200;
  let kSat = '1.0 × 10⁻⁵ m/s';
  let drainage = 'Moderate permeability';
  let frost: 'F1 (Non-frost-susceptible)' | 'F2 (Low-to-medium frost susceptibility)' | 'F3 (High frost susceptibility)' = 'F2 (Low-to-medium frost susceptibility)';

  if (sand >= 65) {
    // Sandy / Coarse soil
    frictionAngle = Math.round(31 + (bulkDensity - 1.3) * 12);
    cohesion = 2;
    baseBearing = Math.round(180 + (bulkDensity - 1.3) * 120);
    kSat = '5.0 × 10⁻⁴ m/s (Fast draining)';
    drainage = 'High permeability / Good natural drainage';
    frost = silt < 10 ? 'F1 (Non-frost-susceptible)' : 'F2 (Low-to-medium frost susceptibility)';
  } else if (clay >= 35) {
    // Clayey / Cohesive soil
    frictionAngle = 18;
    cohesion = Math.round(20 + (bulkDensity - 1.2) * 25);
    baseBearing = Math.round(140 + (bulkDensity - 1.2) * 100);
    kSat = '1.0 × 10⁻⁸ m/s (Low permeability)';
    drainage = 'Poor natural permeability / Water retention potential';
    frost = 'F3 (High frost susceptibility)';
  } else if (silt >= 45) {
    // Silty soil (Highly frost-susceptible)
    frictionAngle = 24;
    cohesion = 10;
    baseBearing = Math.round(150 + (bulkDensity - 1.3) * 90);
    kSat = '2.0 × 10⁻⁶ m/s';
    drainage = 'Moderate to slow permeability';
    frost = 'F3 (High frost susceptibility)';
  } else {
    // Loamy / Mixed soil
    frictionAngle = 27;
    cohesion = 12;
    baseBearing = Math.round(190 + (bulkDensity - 1.3) * 110);
    kSat = '5.0 × 10⁻⁶ m/s';
    drainage = 'Moderate permeability';
    frost = silt > 25 ? 'F3 (High frost susceptibility)' : 'F2 (Low-to-medium frost susceptibility)';
  }

  const minB = Math.max(120, Math.round(baseBearing * 0.85));
  const maxB = Math.round(baseBearing * 1.25);

  return {
    bearingCapacityKpa: baseBearing,
    bearingCapacityStr: `${minB} – ${maxB} kPa`,
    frictionAngleDeg: frictionAngle,
    cohesionKpa: cohesion,
    hydraulicConductivityMs: kSat,
    drainageClass: drainage,
    frostSusceptibility: frost
  };
}

export async function fetchGenuineSoilGridsData(lat: number, lng: number): Promise<SoilGridsResult> {
  const depthIntervals = ['0-5cm', '5-15cm', '15-30cm', '30-60cm', '60-100cm', '100-200cm'];
  const properties = ['clay', 'sand', 'silt', 'soc', 'bdod', 'phh2o', 'cec'];

  const fallback: SoilGridsResult = {
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
    limitation: 'SoilGrids query unavailable or invalid. No site soil classification or engineering parameter has been inferred; a Eurocode 7 site investigation is required.'
  };

  try {
    const propsQuery = properties.map(p => `property=${p}`).join('&');
    const depthsQuery = depthIntervals.map(d => `depth=${d}`).join('&');
    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng}&lat=${lat}&${propsQuery}&${depthsQuery}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'EuropeanLandValuationEngine/5.0 (Research & Geospatial Verification)'
      },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      return await fetchSoilGridsWmsData(lat, lng, fallback);
    }

    const json: any = await res.json();
    if (!json || !Array.isArray(json.properties?.layers)) {
      return await fetchSoilGridsWmsData(lat, lng, fallback);
    }

    const layers = json.properties.layers;
    const findProp = (name: string) => layers.find((l: any) => l.name === name);

    const sandLayer = findProp('sand');
    const siltLayer = findProp('silt');
    const clayLayer = findProp('clay');
    const socLayer = findProp('soc');
    const bdodLayer = findProp('bdod');
    const phLayer = findProp('phh2o');
    const cecLayer = findProp('cec');

    const getVal = (layer: any, depthLabel: string): number | undefined => {
      if (!layer || !Array.isArray(layer.depths)) return undefined;
      const dObj = layer.depths.find((d: any) => d.label === depthLabel);
      const value = dObj?.values?.mean ?? dObj?.values?.median;
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    };

    const stratigraphyProfile: SoilLayerDepth[] = [];

    const depthDefs = [
      { label: '0-5cm', top: 0, bottom: 5 },
      { label: '5-15cm', top: 5, bottom: 15 },
      { label: '15-30cm', top: 15, bottom: 30 },
      { label: '30-60cm', top: 30, bottom: 60 },
      { label: '60-100cm', top: 60, bottom: 100 },
      { label: '100-200cm', top: 100, bottom: 200 }
    ];

    for (const def of depthDefs) {
      const rawSand = getVal(sandLayer, def.label);
      const rawSilt = getVal(siltLayer, def.label);
      const rawClay = getVal(clayLayer, def.label);
      const rawSoc = getVal(socLayer, def.label);
      const rawBdod = getVal(bdodLayer, def.label);
      const rawPh = getVal(phLayer, def.label);
      const rawCec = getVal(cecLayer, def.label);

      if ([rawSand, rawSilt, rawClay, rawSoc, rawBdod, rawPh, rawCec].some(value => value === undefined) || (rawSand! + rawSilt! + rawClay!) <= 0) {
        return await fetchSoilGridsWmsData(lat, lng, fallback);
      }

      const sandPct = Math.round((rawSand! / 10) * 10) / 10;
      const siltPct = Math.round((rawSilt! / 10) * 10) / 10;
      const clayPct = Math.round((rawClay! / 10) * 10) / 10;
      const socPct = Math.round((rawSoc! / 100) * 100) / 100;
      const bulkDensity = Math.round((rawBdod! / 100) * 100) / 100;
      const ph = Math.round((rawPh! / 10) * 10) / 10;
      const cec = Math.round(rawCec! * 10) / 10;

      const textureClass = getUsdaTextureClass(sandPct, siltPct, clayPct);
      const params = estimateBearingParameters(sandPct, siltPct, clayPct, bulkDensity);

      stratigraphyProfile.push({
        depthRange: `${def.top} – ${def.bottom} cm`,
        topDepthCm: def.top,
        bottomDepthCm: def.bottom,
        sandPct,
        siltPct,
        clayPct,
        bulkDensityGcm3: bulkDensity,
        soilOrganicCarbonPct: socPct,
        phH2O: ph,
        cec,
        textureClass,
        estimatedBearingCapacityKpa: params.bearingCapacityKpa,
        mechanicalDescription: `${textureClass}; modelled pedological profile (not site-specific geotechnical testing)`
      });
    }

    const topsoilLayers = stratigraphyProfile.filter(l => l.bottomDepthCm <= 30);
    const subsoilLayers = stratigraphyProfile.filter(l => l.topDepthCm >= 30);
    const avg = (arr: SoilLayerDepth[], key: keyof SoilLayerDepth) => arr.reduce((sum, l) => sum + (l[key] as number), 0) / arr.length;

    const topSand = avg(topsoilLayers, 'sandPct');
    const topSilt = avg(topsoilLayers, 'siltPct');
    const topClay = avg(topsoilLayers, 'clayPct');
    const subSand = avg(subsoilLayers, 'sandPct');
    const subSilt = avg(subsoilLayers, 'siltPct');
    const subClay = avg(subsoilLayers, 'clayPct');
    const meanDensity = avg(stratigraphyProfile, 'bulkDensityGcm3');
    const meanPh = avg(stratigraphyProfile, 'phH2O');
    const meanSoc = avg(stratigraphyProfile, 'soilOrganicCarbonPct');
    const topTexture = getUsdaTextureClass(topSand, topSilt, topClay);
    const mech = estimateBearingParameters(topSand, topSilt, topClay, meanDensity);

    return {
      success: true,
      sourceName: 'ISRIC - World Soil Information (SoilGrids 2.0 REST API)',
      sourceUrl: url,
      datasetVersion: 'SoilGrids v2.0 (250m Resolution)',
      usdaTextureClass: topTexture,
      topsoilClayPct: Math.round(topClay * 10) / 10,
      topsoilSandPct: Math.round(topSand * 10) / 10,
      topsoilSiltPct: Math.round(topSilt * 10) / 10,
      subsoilClayPct: Math.round(subClay * 10) / 10,
      subsoilSandPct: Math.round(subSand * 10) / 10,
      subsoilSiltPct: Math.round(subSilt * 10) / 10,
      meanBulkDensityGcm3: Math.round(meanDensity * 100) / 100,
      meanPhH2O: Math.round(meanPh * 10) / 10,
      meanOrganicCarbonPct: Math.round(meanSoc * 100) / 100,
      estimatedBearingCapacityKpa: mech.bearingCapacityStr,
      effectiveFrictionAngleDeg: mech.frictionAngleDeg,
      cohesionKpa: mech.cohesionKpa,
      hydraulicConductivityMs: mech.hydraulicConductivityMs,
      drainageClass: mech.drainageClass,
      frostSusceptibilityClass: mech.frostSusceptibility,
      topsoilStrippingDepthCm: 30,
      stratigraphyProfile,
      limitation: 'SoilGrids values are modelled 250 m pedological estimates. Engineering parameters derived from texture are preliminary only and require site-specific Eurocode 7 verification.'
    };
  } catch (err) {
    console.warn('SoilGrids API fetch notice:', err);
    return await fetchSoilGridsWmsData(lat, lng, fallback);
  }
}
