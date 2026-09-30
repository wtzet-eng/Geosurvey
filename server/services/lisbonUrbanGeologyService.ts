import { EvidenceItem } from '../types';

type FetchLike = typeof fetch;

const REST = 'https://sigservices.cm-lisboa.pt/arcgis/rest/services/APP_Resist';
const RESIST = REST + '/App_Resist_Layers_Resist/MapServer';
const BDSIG = REST + '/App_Resist_Layers_BDSIG/FeatureServer';
const PORTAL = 'https://dados.cm-lisboa.pt/dataset/sondagens-geologicas-1';
const SEARCH_RADIUS_M = 5000;

const LAYERS = {
  geology: BDSIG + '/21',
  geotechnicalUnit: RESIST + '/16',
  ec8: BDSIG + '/5',
  massMovement: RESIST + '/3',
  boreholes: RESIST + '/13',
  alluviumDepth: RESIST + '/14',
  fillDepth: RESIST + '/15',
  groundwaterDepth: RESIST + '/10'
} as const;

const today = () => new Date().toISOString().slice(0, 10);

function inApproximateLisbon(lat: number, lng: number): boolean {
  return lat >= 38.63 && lat <= 38.84 && lng >= -9.30 && lng <= -9.00;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim().replace(/\s+/g, ' ');
  return cleaned || null;
}

function numberValue(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function featurePoint(feature: any): [number, number] | null {
  const geometry = feature?.geometry;
  if (!geometry) return null;
  if (Array.isArray(geometry.coordinates)) {
    const lng = Number(geometry.coordinates[0]);
    const lat = Number(geometry.coordinates[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }
  const lng = Number(geometry.x);
  const lat = Number(geometry.y);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}
function distanceM(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pointQueryUrl(layer: string, lat: number, lng: number, fields = '*'): string {
  const params = new URLSearchParams({
    where: '1=1',
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: fields,
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
    resultRecordCount: '20'
  });
  return layer + '/query?' + params.toString();
}

function nearbyPointQueryUrl(layer: string, lat: number, lng: number): string {
  const latRadius = SEARCH_RADIUS_M / 111320;
  const lngRadius = SEARCH_RADIUS_M / Math.max(111320 * Math.cos((lat * Math.PI) / 180), 1);
  const geometry = {
    xmin: lng - lngRadius, ymin: lat - latRadius,
    xmax: lng + lngRadius, ymax: lat + latRadius,
    spatialReference: { wkid: 4326 }
  };
  const params = new URLSearchParams({
    where: '1=1',
    geometry: JSON.stringify(geometry),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
    resultRecordCount: '2000'
  });
  return layer + '/query?' + params.toString();
}
async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 9000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'GroundSurf/1.0 Lisbon urban geology evidence' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json && typeof json === 'object' ? json : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function record(
  id: string, category: string, claim: string, sourceUrl: string,
  relationship: string, method: string, confidence: 'High' | 'Medium' | 'Low',
  value: Record<string, unknown>, limitation: string
): EvidenceItem {
  return {
    id, category, claim, status: 'VERIFIED',
    sourceName: 'Câmara Municipal de Lisboa — Urban geoscience / APP_Resist',
    sourceUrl, datasetDate: today(), spatialRelationship: relationship,
    calculationMethod: method, confidence, value, limitation
  };
}

function nearbyRecords(json: any, site: [number, number]): Array<{ feature: any; distanceM: number }> {
  const features = Array.isArray(json?.features) ? json.features : [];
  return features.map((feature: any) => {
    const point = featurePoint(feature);
    return point ? { feature, distanceM: distanceM(site, point) } : null;
  }).filter((item): item is { feature: any; distanceM: number } =>
    Boolean(item) && item.distanceM <= SEARCH_RADIUS_M
  ).sort((a, b) => a.distanceM - b.distanceM);
}

export interface LisbonUrbanEvidenceResult {
  applicable: boolean;
  evidence: EvidenceItem[];
}

export async function queryLisbonUrbanGeology(
  lat: number, lng: number, fetcher: FetchLike = fetch
): Promise<LisbonUrbanEvidenceResult> {
  if (!inApproximateLisbon(lat, lng)) return { applicable: false, evidence: [] };

  const geologyUrl = pointQueryUrl(LAYERS.geology, lat, lng, 'NOME,IDADE0,IDADE1,IDADE2,IDADE3,COD_SIG,IDTIPO');
  const geology = await fetchJson(fetcher, geologyUrl);
  const geologyFeature = Array.isArray(geology?.features) ? geology.features[0] : null;
  if (!geologyFeature?.attributes) {
    return { applicable: true, evidence: [{
      id: 'pt-lisbon-urban-coverage-unavailable',
      category: 'Urban geology',
      claim: 'Lisbon municipal urban-geology mapping could not be queried for the selected coordinate.',
      status: 'REQUIRES_VERIFICATION',
      sourceName: 'Câmara Municipal de Lisboa — Urban geoscience / APP_Resist',
      sourceUrl: LAYERS.geology,
      datasetDate: today(),
      spatialRelationship: 'Selected site coordinate',
      calculationMethod: 'CML ArcGIS point query against the municipal 1:10,000 geology layer',
      confidence: 'Low',
      limitation: 'Temporary source unavailability is not evidence that urban geological data are absent. Check the municipal GIS directly when site-specific assessment depends on it.',
      value: { reasonCode: 'SOURCE_UNAVAILABLE' }
    }]};
  }

  const [geotechnical, ec8, massMovement, boreholes, alluvium, fill, groundwater] = await Promise.all([
    fetchJson(fetcher, pointQueryUrl(LAYERS.geotechnicalUnit, lat, lng, 'UNID_GEOTECNICA,GEOLOGIA,COD_SIG,IDTIPO')),
    fetchJson(fetcher, pointQueryUrl(LAYERS.ec8, lat, lng, 'CLASSE_SOLO,SMAX,COD_SIG,IDTIPO')),
    fetchJson(fetcher, pointQueryUrl(LAYERS.massMovement, lat, lng, 'CLASSENOME,ART_RPDM,COD_SIG,IDTIPO')),
    fetchJson(fetcher, nearbyPointQueryUrl(LAYERS.boreholes, lat, lng)),
    fetchJson(fetcher, nearbyPointQueryUrl(LAYERS.alluviumDepth, lat, lng)),
    fetchJson(fetcher, nearbyPointQueryUrl(LAYERS.fillDepth, lat, lng)),
    fetchJson(fetcher, nearbyPointQueryUrl(LAYERS.groundwaterDepth, lat, lng))
  ]);
  const site: [number, number] = [lat, lng];
  const evidence: EvidenceItem[] = [];
  const geo = geologyFeature.attributes;
  const geologyName = text(geo.NOME);
  const geologicalAge = [geo.IDADE0, geo.IDADE1, geo.IDADE2, geo.IDADE3].map(text).filter(Boolean).join(' → ');

  if (geologyName) {
    evidence.push(record(
      'pt-lisbon-geology-10k',
      'Urban geology',
      'Lisbon municipal 1:10,000 geology maps ' + geologyName +
        (geologicalAge ? ' (' + geologicalAge + ')' : '') +
        ' at the selected coordinate.',
      geologyUrl,
      'Municipal geological polygon containing the selected coordinate',
      'CML ArcGIS point query against the municipal 1:10,000 geology layer',
      'High',
      { formation: geologyName, geologicalAge: geologicalAge || null, code: text(geo.COD_SIG) },
      'High-resolution municipal mapping does not establish parcel-scale layering, thickness, weathering, density, bearing capacity or settlement parameters.'
    ));
  }

  const geotechnicalFeature = Array.isArray(geotechnical?.features) ? geotechnical.features[0] : null;
  if (geotechnicalFeature?.attributes) {
    const g = geotechnicalFeature.attributes;
    evidence.push(record(
      'pt-lisbon-geotechnical-unit',
      'Urban geotechnics',
      'CML municipal geotechnical zoning places the selected coordinate in unit ' +
        (text(g.UNID_GEOTECNICA) || 'unclassified') +
        (text(g.GEOLOGIA) ? ', associated with: ' + text(g.GEOLOGIA) : '') + '.',
      pointQueryUrl(LAYERS.geotechnicalUnit, lat, lng),
      'Municipal geotechnical polygon containing the selected coordinate',
      'CML ArcGIS point query against the municipal geotechnical-unit layer',
      'High',
      { unit: text(g.UNID_GEOTECNICA), geologyDescription: text(g.GEOLOGIA), code: text(g.COD_SIG) },
      'The urban geotechnical unit is screening context. It does not replace a site investigation or provide design soil parameters.'
    ));
  }

  const ec8Feature = Array.isArray(ec8?.features) ? ec8.features[0] : null;
  if (ec8Feature?.attributes) {
    const e = ec8Feature.attributes;

    evidence.push(record(
      'pt-lisbon-ec8-soil',
      'Seismic soil classification',
      'CML urban seismic-soil mapping assigns class ' +
        (text(e.CLASSE_SOLO) || 'not classified') +
        (numberValue(e.SMAX) !== null ? ' with Smax ' + numberValue(e.SMAX) : '') +
        ' at the selected coordinate.',
      pointQueryUrl(LAYERS.ec8, lat, lng),
      'Municipal EC8 soil polygon containing the selected coordinate',
      'CML ArcGIS point query against the city-scale EC8 soil-class layer',
      'High',
      { soilClass: text(e.CLASSE_SOLO), smax: numberValue(e.SMAX), code: text(e.COD_SIG) },
      'The EC8 class is city-scale seismic-soil context and should not be treated as a parcel-specific geotechnical parameter set.'
    ));
  }

  const movementFeature = Array.isArray(massMovement?.features) ? massMovement.features[0] : null;
  if (movementFeature?.attributes) {
    const m = movementFeature.attributes;
    evidence.push(record(
      'pt-lisbon-slope-movement-susceptibility',
      'Urban geohazard screening',
      'CML slope-movement susceptibility mapping classifies the selected coordinate as ' +
        (text(m.CLASSENOME) || 'mapped susceptibility') + '.',
      pointQueryUrl(LAYERS.massMovement, lat, lng),
      'Municipal susceptibility polygon containing the selected coordinate',
      'CML ArcGIS point query against the municipal slope-movement susceptibility layer',
      'High',
      { susceptibility: text(m.CLASSENOME), planningReference: text(m.ART_RPDM), code: text(m.COD_SIG) },
      'This is mapped susceptibility, not a parcel-specific stability analysis or proof of active movement.'
    ));
  }

  const boreholeRecords = nearbyRecords(boreholes, site);
  if (boreholeRecords.length) {
    const nearest = boreholeRecords[0];
    evidence.push(record(
      'pt-lisbon-geotechnical-boreholes',
      'Nearby ground investigations',
      "CML's municipal geotechnical sounding layer returns " +
        boreholeRecords.length + ' record' + (boreholeRecords.length === 1 ? '' : 's') +
        ' within 5 km; the nearest returned sounding is about ' +
        Math.round(nearest.distanceM).toLocaleString('en-GB') + ' m away.',

      nearbyPointQueryUrl(LAYERS.boreholes, lat, lng),
      'Nearby municipal geotechnical soundings within 5 km',
      'CML ArcGIS envelope query with local geodesic distance sorting',
      'Medium',
      {
        count: boreholeRecords.length,
        nearestDistanceM: Math.round(nearest.distanceM),
        examples: boreholeRecords.slice(0, 5).map(item => ({
          reference: text(item.feature?.attributes?.REFERENCIA),
          report: item.feature?.attributes?.RELATORIO ?? null,
          company: text(item.feature?.attributes?.EMPRESA),
          distanceM: Math.round(item.distanceM)
        }))
      },
      'Nearby sounding records are contextual evidence. Their logs must be reviewed individually to establish subsurface conditions at the parcel.'
    ));
  }

  const appendDepthContext = (
    id: string,
    category: string,
    label: string,
    layer: string,
    json: any
  ) => {
    const matches = nearbyRecords(json, site);
    if (!matches.length) return;
    const nearest = matches[0];
    evidence.push(record(
      id,
      category,
      'CML maps ' + matches.length + ' nearby ' + label + ' observation' +
        (matches.length === 1 ? '' : 's') + ' within 5 km; the nearest is about ' +
        Math.round(nearest.distanceM).toLocaleString('en-GB') +
        ' m away and records depth class ' +
        (text(nearest.feature?.attributes?.PROFUNDIDADE) || 'not stated') + '.',
      nearbyPointQueryUrl(layer, lat, lng),
      'Nearby municipal ' + label + ' observations within 5 km',
      'CML ArcGIS envelope query with local geodesic distance sorting',
      'Medium',
      {

        count: matches.length,
        nearestDistanceM: Math.round(nearest.distanceM),
        nearestDepthClass: text(nearest.feature?.attributes?.PROFUNDIDADE),
        reference: text(nearest.feature?.attributes?.REL_SONDAGEM)
      },
      'These are nearby mapped observations, not a measured depth beneath the selected parcel. The selected-site condition should be verified by site-specific investigation where material to the project.'
    ));
  };

  appendDepthContext(
    'pt-lisbon-alluvium-depth',
    'Urban geotechnics',
    'alluvium-depth',
    LAYERS.alluviumDepth,
    alluvium
  );
  appendDepthContext(
    'pt-lisbon-fill-depth',
    'Urban geotechnics',
    'fill-depth',
    LAYERS.fillDepth,
    fill
  );
  appendDepthContext(
    'pt-lisbon-groundwater-depth',
    'Urban hydrogeology',
    'groundwater-depth',
    LAYERS.groundwaterDepth,
    groundwater
  );

  return { applicable: true, evidence };
}

export function enrichLisbonUrbanEvidence(report: any, evidence: EvidenceItem[]): void {
  if (!report || !evidence.length) return;
  const existing = report.geosurvey_context && typeof report.geosurvey_context === 'object'
    ? report.geosurvey_context
    : {};

  const geology = evidence.find(item => item.id === 'pt-lisbon-geology-10k' && item.status === 'VERIFIED');
  const geotech = evidence.find(item => item.id === 'pt-lisbon-geotechnical-unit' && item.status === 'VERIFIED');
  const ec8 = evidence.find(item => item.id === 'pt-lisbon-ec8-soil' && item.status === 'VERIFIED');
  const movement = evidence.find(item => item.id === 'pt-lisbon-slope-movement-susceptibility' && item.status === 'VERIFIED');
  const gv = geology?.value as Record<string, unknown> | undefined;
  const gg = geotech?.value as Record<string, unknown> | undefined;
  const ev = ec8?.value as Record<string, unknown> | undefined;
  const mv = movement?.value as Record<string, unknown> | undefined;

  report.geosurvey_context = {
    ...existing,
    urban_geology_unit_name: text(gv?.formation),
    urban_geological_age: text(gv?.geologicalAge),
    urban_geotechnical_unit: text(gg?.unit),
    ec8_soil_class: text(ev?.soilClass),
    ec8_smax: numberValue(ev?.smax),
    urban_mass_movement_susceptibility: text(mv?.susceptibility),
    urban_groundwater_depth_class: text(evidence.find(item => item.id === 'pt-lisbon-groundwater-depth')?.value && (evidence.find(item => item.id === 'pt-lisbon-groundwater-depth')!.value as any).nearestDepthClass),
    urban_alluvium_depth_class: text(evidence.find(item => item.id === 'pt-lisbon-alluvium-depth')?.value && (evidence.find(item => item.id === 'pt-lisbon-alluvium-depth')!.value as any).nearestDepthClass),
    urban_fill_depth_class: text(evidence.find(item => item.id === 'pt-lisbon-fill-depth')?.value && (evidence.find(item => item.id === 'pt-lisbon-fill-depth')!.value as any).nearestDepthClass)
  };

  if (geology) {
    report.geosurvey_context.geological_unit_name = text(gv?.formation) || existing.geological_unit_name;
    report.geosurvey_context.geological_period_era = text(gv?.geologicalAge) || existing.geological_period_era;
    report.geosurvey_context.urban_geology_source_name = geology.sourceName;
    report.geosurvey_context.urban_geology_source_url = geology.sourceUrl;
    report.geosurvey_context.urban_evidence_level = 'VERIFIED';
  }
}

export const LISBON_URBAN_GEOLOGY_SOURCES = {
  geology: LAYERS.geology,
  geotechnicalUnit: LAYERS.geotechnicalUnit,
  ec8: LAYERS.ec8,
  massMovement: LAYERS.massMovement,
  boreholes: LAYERS.boreholes,
  alluviumDepth: LAYERS.alluviumDepth,
  fillDepth: LAYERS.fillDepth,
  groundwaterDepth: LAYERS.groundwaterDepth,
  portal: PORTAL
};
