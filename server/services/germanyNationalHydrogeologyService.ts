import type { EvidenceItem, VerifiedSiteReport } from '../types';

const HUEK_BASE = 'https://services.bgr.de/arcgis/rest/services/grundwasser/huek250/MapServer';
const PERMEABILITY_LAYER = 1;
const LITHOLOGY_LAYER = 6;
const SOURCE = 'Bundesanstalt für Geowissenschaften und Rohstoffe (BGR) / Staatliche Geologische Dienste (SGD)';
const SOURCE_URL = HUEK_BASE;
const today = () => new Date().toISOString().slice(0, 10);

type FetchLike = typeof fetch;

function noData(id: string, claim: string, url: string, reasonCode: string): EvidenceItem {
  return {
    id,
    category: 'Hydrogeology',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE,
    sourceUrl: url,
    datasetDate: today(),
    spatialRelationship: 'Selected German site coordinate tested against the nationwide HÜK250 hydrogeological map',
    calculationMethod: 'BGR ArcGIS REST point query; no negative finding inferred from an empty or failed response',
    confidence: 'Low',
    limitation: 'The national map is regional screening evidence at 1:250,000. Missing or empty service results do not establish absence of groundwater or excavation-water conditions.',
    value: { reasonCode }
  };
}

async function queryLayer(layer: number, lat: number, lng: number, fetcher: FetchLike): Promise<any | null> {
  const params = new URLSearchParams({
    where: '1=1',
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
    f: 'json'
  });
  try {
    const response = await fetcher(HUEK_BASE + '/' + layer + '/query?' + params.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': 'GroundSurf/1.0 Germany hydrogeology' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.error || !Array.isArray(data?.features)) return null;
    return data.features[0] || null;
  } catch {
    return null;
  }
}

function normalizePermeability(value: unknown): { code: number | null; label: string | null } {
  const code = Number(value);
  if (!Number.isFinite(code)) return { code: null, label: null };
  const labels: Record<number, string> = {
    8: 'very high to high (>1E-3 m/s)',
    2: 'high (>1E-3 to 1E-2 m/s)',
    3: 'medium (>1E-4 to 1E-3 m/s)',
    9: 'medium to moderate (>1E-5 to 1E-3 m/s)',
    4: 'moderate (>1E-5 to 1E-4 m/s)',
    12: 'moderate to low (>1E-6 to 1E-4 m/s)',
    5: 'low (>1E-7 to 1E-5 m/s)',
    6: 'very low (>1E-9 to 1E-7 m/s)',
    10: 'low to extremely low (<1E-5 m/s)',
    7: 'extremely low (<1E-9 m/s)',
    11: 'strongly variable',
    0: 'no data',
    99: 'water body'
  };
  return { code, label: labels[code] || null };
}

function excavationScreen(permeabilityCode: number | null, permeabilityLabel: string | null, lithology: string | null, aquiferCharacter: string | null): { level: string; claim: string } {
  const low = permeabilityCode !== null && [6, 7, 10, 5, 12].includes(permeabilityCode);
  const high = permeabilityCode !== null && [8, 2, 3, 9, 4].includes(permeabilityCode);
  const unconsolidated = /sand|gravel|silt|clay|peat|unconsolid/i.test((lithology || '').toLowerCase());
  const text = [permeabilityLabel, lithology, aquiferCharacter].filter(Boolean).join('; ');
  if (high) {
    return {
      level: 'Water can move readily through the mapped formation',
      claim: 'The nationwide HÜK250 places the site in a relatively permeable hydrogeological setting (' + text + '). If groundwater is present within the excavation depth, the formation can allow water to enter or move through an excavation comparatively readily. The map does not establish groundwater depth at the property.'
    };
  }
  if (low && unconsolidated) {
    return {
      level: 'Temporary or perched water may need consideration',
      claim: 'The nationwide HÜK250 places the site in a relatively low-permeability setting (' + text + '). Low-permeability near-surface materials can slow drainage and may contribute to temporarily perched water after wet weather, even where the site is not mapped as flooded. The map does not establish groundwater depth at the property.'
    };
  }
  return {
    level: 'Groundwater behaviour requires site-specific confirmation',
    claim: 'The nationwide HÜK250 provides hydrogeological context for the site (' + text + '). This supports consideration of groundwater and excavation-water conditions, but the national map alone is not sufficient to determine whether groundwater will enter a particular excavation.'
  };
}

export async function queryGermanyNationalHydrogeology(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<EvidenceItem[]> {
  const [permeability, lithology] = await Promise.all([
    queryLayer(PERMEABILITY_LAYER, lat, lng, fetcher),
    queryLayer(LITHOLOGY_LAYER, lat, lng, fetcher)
  ]);

  const evidence: EvidenceItem[] = [];

  if (!permeability) {
    evidence.push(noData('de-huek250-permeability-unavailable', 'The BGR HÜK250 permeability layer could not be read at the selected coordinate.', HUEK_BASE + '/' + PERMEABILITY_LAYER, 'SOURCE_UNAVAILABLE'));
  } else {
    const a = permeability.attributes || {};
    const p = normalizePermeability(a.kf);
    const claim = p.label
      ? 'The BGR HÜK250 maps the selected location as having ' + p.label + ' hydrogeological permeability.'
      : 'The BGR HÜK250 returned a hydrogeological permeability unit at the selected location, but its classification could not be interpreted.';
    evidence.push({
      id: 'de-huek250-permeability',
      category: 'Hydrogeology',
      claim,
      status: p.label ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
      sourceName: SOURCE,
      sourceUrl: HUEK_BASE + '/' + PERMEABILITY_LAYER,
      datasetDate: today(),
      spatialRelationship: 'Point intersects the nationwide HÜK250 permeability polygon',
      calculationMethod: 'BGR HÜK250 ArcGIS REST point query; official kf classification retained without converting it into a site hydraulic test',
      confidence: p.label ? 'Medium' : 'Low',
      limitation: 'HÜK250 is a regional 1:250,000 map of the upper continuous groundwater systems. It does not measure groundwater depth or site-specific hydraulic conductivity.',
      value: { permeabilityCode: p.code, permeabilityLabel: p.label, hydrogeologicalUnit: a.HE || null, hydrogeologicalUnitName: a.HE_Bez || null, aquiferCharacter: a.LChar_bez || null, lithology: a.Litho || null }
    });
  }

  if (!lithology) {
    evidence.push(noData('de-huek250-lithology-unavailable', 'The BGR HÜK250 lithology layer could not be read at the selected coordinate.', HUEK_BASE + '/' + LITHOLOGY_LAYER, 'SOURCE_UNAVAILABLE'));
  } else {
    const a = lithology.attributes || {};
    const lithologyText = typeof a.Litho === 'string' && a.Litho.trim() ? a.Litho.trim() : (typeof a.I_CompMat1 === 'string' ? a.I_CompMat1.trim() : null);
    evidence.push({
      id: 'de-huek250-hydrogeological-unit',
      category: 'Hydrogeology',
      claim: 'The BGR HÜK250 identifies the selected location within the hydrogeological unit "' + (a.HE_Bez || a.HE || 'not named in the returned record') + '"' + (lithologyText ? ', with mapped lithology "' + lithologyText + '".' : '.'),
      status: 'VERIFIED',
      sourceName: SOURCE,
      sourceUrl: HUEK_BASE + '/' + LITHOLOGY_LAYER,
      datasetDate: today(),
      spatialRelationship: 'Point intersects the nationwide HÜK250 lithology/hydrogeological polygon',
      calculationMethod: 'BGR HÜK250 ArcGIS REST point query',
      confidence: 'Medium',
      limitation: 'The HÜK250 unit is regional context and should not be read as a site investigation log or a precise shallow-soil description.',
      value: { hydrogeologicalUnit: a.HE || null, hydrogeologicalUnitName: a.HE_Bez || null, lithology: lithologyText, aquiferCharacter: a.LChar_bez || null, rockType: a.GA_bez || null }
    });
  }

  const p = evidence.find(item => item.id === 'de-huek250-permeability' && item.status === 'VERIFIED');
  const l = evidence.find(item => item.id === 'de-huek250-hydrogeological-unit' && item.status === 'VERIFIED');
  const pv = (p?.value || {}) as Record<string, unknown>;
  const lv = (l?.value || {}) as Record<string, unknown>;
  const screen = excavationScreen(
    Number.isFinite(Number(pv.permeabilityCode)) ? Number(pv.permeabilityCode) : null,
    typeof pv.permeabilityLabel === 'string' ? pv.permeabilityLabel : null,
    typeof lv.lithology === 'string' ? lv.lithology : (typeof pv.lithology === 'string' ? pv.lithology : null),
    typeof pv.aquiferCharacter === 'string' ? pv.aquiferCharacter : (typeof lv.aquiferCharacter === 'string' ? lv.aquiferCharacter : null)
  );
  evidence.push({
    id: 'de-huek250-excavation-water-screening',
    category: 'Construction water screening',
    claim: screen.claim,
    status: (p || l) ? 'MODELLED' : 'REQUIRES_VERIFICATION',
    sourceName: SOURCE,
    sourceUrl: SOURCE_URL,
    datasetDate: today(),
    spatialRelationship: 'Interpretation derived from the HÜK250 hydrogeological unit and permeability evidence at the selected coordinate',
    calculationMethod: 'Rule-based GroundSurf screening of official HÜK250 permeability, lithology and aquifer-character attributes; no groundwater depth inferred',
    confidence: (p || l) ? 'Medium' : 'Low',
    limitation: 'This screening does not establish groundwater depth, seasonal high-water level or a legally defined flood zone. It is intended to flag why excavation water may deserve attention. Site-specific groundwater observations and geotechnical investigation remain necessary for design.',
    value: { screeningLevel: screen.level, permeabilityCode: pv.permeabilityCode ?? null, permeabilityLabel: pv.permeabilityLabel ?? null, lithology: lv.lithology ?? pv.lithology ?? null, aquiferCharacter: pv.aquiferCharacter ?? lv.aquiferCharacter ?? null }
  });

  return evidence;
}

export function enrichGermanyNationalHydrogeology(report: VerifiedSiteReport & Record<string, any>, evidence: EvidenceItem[]): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...evidence);
  const p = evidence.find(item => item.id === 'de-huek250-permeability' && item.status === 'VERIFIED');
  const l = evidence.find(item => item.id === 'de-huek250-hydrogeological-unit' && item.status === 'VERIFIED');
  const screen = evidence.find(item => item.id === 'de-huek250-excavation-water-screening');
  if (!p && !l) return;
  const pv = (p?.value || {}) as Record<string, unknown>;
  const lv = (l?.value || {}) as Record<string, unknown>;
  report.geosurvey_context = {
    ...(report.geosurvey_context || {}),
    germany_huek250_permeability: pv.permeabilityLabel ?? null,
    germany_huek250_hydrogeological_unit: lv.hydrogeologicalUnitName ?? pv.hydrogeologicalUnitName ?? null,
    germany_huek250_lithology: lv.lithology ?? pv.lithology ?? null,
    germany_huek250_aquifer_character: pv.aquiferCharacter ?? lv.aquiferCharacter ?? null,
    germany_huek250_excavation_water_screening: (screen?.value as any)?.screeningLevel ?? null,
    germany_huek250_evidence_level: screen?.status || p?.status || l?.status || null,
    germany_huek250_source: SOURCE
  };
  if (report.evidenceScore?.breakdown?.geologyAndGroundwater && (p || l)) {
    report.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(14, Number(report.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
    report.evidenceScore.breakdown.geologyAndGroundwater.rationale = 'Nationwide BGR HÜK250 hydrogeological evidence returned a mapped permeability and/or hydrogeological unit at the selected location. This is regional screening evidence and does not replace site-specific groundwater measurement.';
  }
  if (report.soil && screen) {
    report.soil.groundwaterNotice = screen.claim;
  }
}

export const GERMANY_NATIONAL_HYDRO_SOURCES = {
  huek250: HUEK_BASE,
  permeabilityLayer: HUEK_BASE + '/' + PERMEABILITY_LAYER,
  lithologyLayer: HUEK_BASE + '/' + LITHOLOGY_LAYER
};
