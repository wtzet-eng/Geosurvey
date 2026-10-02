import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyBavariaGroundwaterResult {
  state: 'Bayern';
  evidence: EvidenceItem[];
  highGroundwaterArea: boolean | null;
  modelledGroundwaterFound: boolean;
}

const WATER_ARCGIS = 'https://umweltatlas.bayern.de/arcgis/rest/services/wasser/naturgefahren_ftz/MapServer';
const GEO_ARCGIS = 'https://umweltatlas.bayern.de/arcgis/rest/services/geologie/geologie_ftz/MapServer';
const HIGH_GROUNDWATER_LAYER = 28;
const HYDRO_UNIT_LAYER = 28;
const CONTOUR_LAYER = 39;
const SUPPORT_LAYER = 38;
const SOURCE = 'Bayerisches Landesamt für Umwelt (LfU)';
const today = () => new Date().toISOString().slice(0, 10);

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function numberValue(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toBavariaNative(lat: number, lng: number): [number, number] {
  const a = 6378137;
  const e2 = 0.006694380023;
  const k0 = 0.9996;
  const ep = e2 / (1 - e2);
  const latRad = lat * Math.PI / 180;
  const lonRad = lng * Math.PI / 180;
  const origin = 9 * Math.PI / 180;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);
  const n = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = ep * cosLat * cosLat;
  const aa = cosLat * (lonRad - origin);
  const m = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * latRad
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * latRad)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * latRad)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * latRad));
  const easting = k0 * n * (aa + (1 - t + c) * aa ** 3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ep) * aa ** 5 / 120) + 500000;
  const northing = k0 * (m + n * tanLat * (aa ** 2 / 2 + (5 - t + 9 * c + 4 * c * c) * aa ** 4 / 24 + (61 - 58 * t + t * t + 600 * c - 330 * ep) * aa ** 6 / 720));
  return [easting, northing];
}

function noData(id: string, claim: string, url: string, reasonCode: string): EvidenceItem {
  return {
    id, category: 'Hydrogeology', claim, status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: url,
    datasetDate: today(), spatialRelationship: 'Selected site coordinate in Bavaria',
    calculationMethod: 'Official LfU ArcGIS service query; no negative finding inferred from failed or empty acquisition', confidence: 'Low',
    limitation: 'A failed, empty or structurally invalid service response does not establish absence. Confirm the current official record with LfU where necessary.', value: { reasonCode }
  };
}async function fetchJson(url: string, fetcher: typeof fetch): Promise<any | null> {
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json', 'User-Agent': 'GroundSurf/1.0 Bavaria groundwater evidence' } });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

function arcgisUrl(base: string, path: string, params: Record<string, string>): string {
  return base + '/' + path + '?' + new URLSearchParams(params).toString();
}

function envelope(x: number, y: number, radiusM: number): string {
  return JSON.stringify({
    xmin: x - radiusM, ymin: y - radiusM, xmax: x + radiusM, ymax: y + radiusM,
    spatialReference: { wkid: 25832 }
  });
}

function pointToSegmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function normalizeAquifer(value: string | null): string {
  return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function aquiferCode(label: string | null): string | null {
  const v = normalizeAquifer(label);
  if (v.includes('quart')) return 'q';
  if (v.includes('vorlandmolasse')) return 'vlmol';
  if (v.includes('malm')) return 'malm';
  if (v.includes('sandsteinkeuper')) return 'sstk';
  if (v.includes('benker')) return 'kmbe';
  if (v.includes('muschelkalk')) return 'mkalk';
  if (v.includes('buntsandstein')) return 'bst';
  return null;
}

async function queryHighGroundwater(lat: number, lng: number, fetcher: typeof fetch): Promise<EvidenceItem> {
  const [x, y] = toBavariaNative(lat, lng);
  const url = arcgisUrl(WATER_ARCGIS, 'identify', {
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint', sr: '4326',
    layers: 'visible:' + HIGH_GROUNDWATER_LAYER,
    tolerance: '1',
    mapExtent: (lng - 0.1) + ',' + (lat - 0.1) + ',' + (lng + 0.1) + ',' + (lat + 0.1),
    imageDisplay: '301,301,96', returnGeometry: 'false', returnFieldName: 'false',
    returnUnformattedValues: 'false', f: 'json'
  });
  const data = await fetchJson(url, fetcher);
  if (!data || !Array.isArray(data.results)) return noData('de-by-high-groundwater-unavailable', 'The official Bavaria high-groundwater indicator could not be read.', url, 'SOURCE_UNAVAILABLE');
  const result = data.results.find((item: any) => item.layerId === HIGH_GROUNDWATER_LAYER);
  const value = result?.attributes?.['Raster.Value'] ?? result?.attributes?.['UniqueValue.Pixel Value'];
  if (value === undefined) return noData('de-by-high-groundwater-no-data', 'The official Bavaria high-groundwater indicator returned no classified value at the selected coordinate.', url, 'NO_DATA');
  const flagged = Number(value) === 1;
  return {
    id: 'de-by-high-groundwater-area', category: 'Hydrogeology',
    claim: flagged
      ? 'The official Bavaria LfU indicator marks the selected location within a potential high-groundwater area. These areas are associated with groundwater levels below 3 m under terrain or conditions indicating that such shallow groundwater may occur.'
      : 'The official Bavaria LfU high-groundwater indicator does not mark the selected point as a potential high-groundwater area.',
    status: 'VERIFIED', sourceName: SOURCE, sourceUrl: url, datasetDate: today(),
    spatialRelationship: 'Point identified against the statewide high-groundwater raster',
    calculationMethod: 'LfU ArcGIS identify query on the official hwk_hgw raster layer', confidence: 'Medium',
    limitation: 'The 1:500,000 indicator is a regional potential-area screening map. It is not suitable for an absolute groundwater depth at an individual parcel, and high groundwater can occur outside mapped areas. It must not be treated as a wet-weather groundwater measurement.',
    value: { flagged, layer: 'hwk_hgw', rasterValue: Number(value) }
  };
}async function queryHydroUnit(lat: number, lng: number, fetcher: typeof fetch): Promise<EvidenceItem> {
  const [x, y] = toBavariaNative(lat, lng);
  const url = arcgisUrl(GEO_ARCGIS, HYDRO_UNIT_LAYER + '/query', {
    where: '1=1', geometry: envelope(x, y, 100), geometryType: 'esriGeometryEnvelope',
    inSR: '25832', spatialRel: 'esriSpatialRelIntersects',
    outFields: 'kurztext,symbologie', returnGeometry: 'false', resultRecordCount: '5', f: 'json'
  });
  const data = await fetchJson(url, fetcher);
  const attrs = data?.features?.[0]?.attributes;
  if (!attrs) return noData('de-by-hydro-unit-no-data', 'The official Bavaria hydrogeological groundwater-bearing-unit map returned no usable unit at the selected coordinate.', url, 'NO_DATA');
  const label = text(attrs.kurztext) || text(attrs.symbologie);
  if (!label) return noData('de-by-hydro-unit-malformed', 'The official Bavaria hydrogeological unit service returned a feature without a usable unit label.', url, 'MALFORMED_DATA');
  const code = aquiferCode(label) || aquiferCode(text(attrs.symbologie));
  return {
    id: 'de-by-hydrogeological-unit', category: 'Hydrogeology',
    claim: 'The official Bavaria hydrogeological map places the selected coordinate in the groundwater-bearing/low-permeability unit "' + label + '".',
    status: 'VERIFIED', sourceName: SOURCE, sourceUrl: url, datasetDate: today(),
    spatialRelationship: 'Coordinate intersects the official HK500 groundwater-unit polygon',
    calculationMethod: 'LfU ArcGIS point-area query against hk500_gwleiter in EPSG:25832', confidence: 'High',
    limitation: 'The hydrogeological unit is regional context. It does not by itself establish site-specific groundwater depth, hydraulic head or foundation design parameters.',
    value: { label, symbologie: text(attrs.symbologie), aquiferCode: code, layer: 'hk500_gwleiter' }
  };
}

type Contour = {
  elevationM: number; distanceM: number; aquiferCode: string | null;
  source: string | null; method: string | null;
};
type SupportPoint = {
  elevationM: number; distanceM: number; aquiferCode: string | null;
  aquiferName: string | null; source: string | null;
};

function nearestContourDistances(features: any[], x: number, y: number, code: string | null): Contour[] {
  const byKey = new Map<string, Contour>();
  for (const feature of features || []) {
    const a = feature.attributes || {};
    const elevationM = numberValue(a.hoehe);
    if (elevationM === null || (code && text(a.gwl) && text(a.gwl) !== code)) continue;
    const paths = feature.geometry?.paths || [];
    let distanceM = Number.POSITIVE_INFINITY;
    for (const path of paths) {
      for (let i = 1; i < path.length; i += 1) {
        const ax = Number(path[i - 1][0]); const ay = Number(path[i - 1][1]);
        const bx = Number(path[i][0]); const by = Number(path[i][1]);
        if ([ax, ay, bx, by].every(Number.isFinite)) distanceM = Math.min(distanceM, pointToSegmentDistance(x, y, ax, ay, bx, by));
      }
    }
    if (!Number.isFinite(distanceM)) continue;
    const key = String(elevationM) + ':' + (text(a.gwl) || '');
    const existing = byKey.get(key);
    if (!existing || distanceM < existing.distanceM) {
      byKey.set(key, { elevationM, distanceM, aquiferCode: text(a.gwl), source: text(a.quelle), method: text(a.mth_text) });
    }
  }
  return [...byKey.values()].sort((a, b) => a.distanceM - b.distanceM);
}function nearestSupportPoints(features: any[], x: number, y: number, code: string | null): SupportPoint[] {
  return (features || []).flatMap(feature => {
    const a = feature.attributes || {};
    const e = numberValue(a.hoehe);
    const gx = Number(feature.geometry?.x);
    const gy = Number(feature.geometry?.y);
    if (e === null || !Number.isFinite(gx) || !Number.isFinite(gy)) return [];
    const pointCode = text(a.gwl);
    if (code && pointCode && pointCode !== code) return [];
    return [{
      elevationM: e, distanceM: Math.hypot(gx - x, gy - y),
      aquiferCode: pointCode, aquiferName: text(a.gwl_text), source: text(a.quelle)
    }];
  }).sort((a, b) => a.distanceM - b.distanceM);
}

function modelDepth(siteElevationM: number, groundwaterElevationM: number): { depthM: number; risk: string } {
  const depthM = siteElevationM - groundwaterElevationM;
  const risk = depthM <= 1 ? 'High' : depthM <= 2 ? 'Moderate' : 'Lower';
  return { depthM, risk };
}

async function queryGroundwaterModel(
  lat: number, lng: number, siteElevationM: number | null, hydroUnit: EvidenceItem, fetcher: typeof fetch
): Promise<EvidenceItem> {
  const contourBase = GEO_ARCGIS + '/' + CONTOUR_LAYER;
  if (siteElevationM === null) {
    return noData('de-by-groundwater-no-site-elevation', 'Regional Bavaria groundwater evidence was found, but there is no site ground elevation available for a depth comparison.', contourBase, 'PARAMETER_NOT_PROVIDED');
  }
  const [x, y] = toBavariaNative(lat, lng);
  const radiusM = 12000;
  const common = {
    where: '1=1', geometry: envelope(x, y, radiusM), geometryType: 'esriGeometryEnvelope',
    inSR: '25832', spatialRel: 'esriSpatialRelIntersects', resultRecordCount: '500', returnGeometry: 'true', outSR: '25832', f: 'json'
  };
  const code = text((hydroUnit.value as any)?.aquiferCode);
  const contourUrl = arcgisUrl(GEO_ARCGIS, CONTOUR_LAYER + '/query', {
    ...common, outFields: 'gwl,gwl_text,hoehe,symbol,mth_text,quelle'
  });
  const supportUrl = arcgisUrl(GEO_ARCGIS, SUPPORT_LAYER + '/query', {
    ...common, outFields: 'gwl_text,hoehe,gwl,quelle'
  });
  const [contourData, supportData] = await Promise.all([
    fetchJson(contourUrl, fetcher), fetchJson(supportUrl, fetcher)
  ]);
  const contours = nearestContourDistances(contourData?.features || [], x, y, code);
  let estimate: { elevationM: number; method: string; basis: string } | null = null;
  const maxContourDistanceM = 8000;
  for (let i = 0; i < contours.length; i += 1) {
    if (contours[i].distanceM > maxContourDistanceM) break;
    for (let j = i + 1; j < contours.length; j += 1) {
      if (contours[j].distanceM > maxContourDistanceM) continue;
      if (Math.abs(contours[i].elevationM - contours[j].elevationM) < 0.5) continue;
      const a = contours[i]; const b = contours[j];
      const low = a.elevationM < b.elevationM ? a : b;
      const high = a.elevationM < b.elevationM ? b : a;
      const fraction = low.distanceM / (low.distanceM + high.distanceM);
      const value = low.elevationM + fraction * (high.elevationM - low.elevationM);
      estimate = { elevationM: value, method: 'regional dHK100 groundwater-contour interpolation', basis: String(low.elevationM) + ' m and ' + String(high.elevationM) + ' m groundwater contours' };
      break;
    }
    if (estimate) break;
  }  if (!estimate) {
    const points = nearestSupportPoints(supportData?.features || [], x, y, code)
      .filter(p => p.distanceM <= radiusM).slice(0, 8);
    if (points.length >= 2) {
      const weights = points.map(p => 1 / Math.max(p.distanceM, 100));
      const weighted = points.reduce((sum, p, i) => sum + p.elevationM * weights[i], 0)
        / weights.reduce((a, b) => a + b, 0);
      estimate = {
        elevationM: weighted,
        method: 'regional dHK100 groundwater support-point interpolation',
        basis: String(points.length) + ' nearby mapped groundwater-level support points'
      };
    }
  }
  if (!estimate) {
    return noData('de-by-groundwater-no-nearby-model', 'The official Bavaria hydrogeological services returned no sufficient same-unit groundwater contours or support points near the selected coordinate for a regional groundwater-surface estimate.', contourUrl, 'INSUFFICIENT_EVIDENCE');
  }
  const { depthM, risk } = modelDepth(siteElevationM, estimate.elevationM);
  const claim = 'Official LfU dHK100 groundwater evidence supports an indicative regional groundwater elevation of approximately '
    + estimate.elevationM.toFixed(1) + ' m NN at the selected site, based on ' + estimate.basis + '. Compared with the modelled site elevation of '
    + siteElevationM.toFixed(1) + ' m, this is approximately ' + (depthM < 0 ? Math.abs(depthM).toFixed(1) + ' m above' : depthM.toFixed(1) + ' m below')
    + ' ground level and gives a ' + risk.toLowerCase() + ' excavation-water screening level.';
  return {
    id: 'de-by-groundwater-regional-model', category: 'Hydrogeology', claim, status: 'MODELLED',
    sourceName: SOURCE, sourceUrl: contourUrl, datasetDate: today(),
    spatialRelationship: 'Regional dHK100 groundwater contours/support points within ' + (radiusM / 1000) + ' km; mapped hydrogeological unit context',
    calculationMethod: estimate.method + '; native EPSG:25832 geometry-distance calculations; comparison with site terrain elevation',
    confidence: 'Medium',
    limitation: 'This is regional screening evidence, not a groundwater measurement at the property. dHK100 contours are generalized and can represent mapped campaign conditions rather than current wet-weather conditions. The high-groundwater indicator is a separate potential-area screen. Seasonal and post-rainfall groundwater can be higher; site-specific measurements are required for final excavation, waterproofing and foundation design.',
    value: {
      estimatedGroundwaterElevationM: estimate.elevationM, siteGroundElevationM: siteElevationM,
      estimatedDepthBelowGroundM: depthM, riskLevel: risk, layer: 'hk100_gwgl_ges'
    }
  };
}

export async function queryGermanyBavariaGroundwater(
  lat: number, lng: number, state: string | null | undefined,
  fetcher: typeof fetch = fetch, siteElevationM: number | null = null
): Promise<GermanyBavariaGroundwaterResult> {
  const normalized = String(state || '').trim().toLowerCase();
  const stateOk = !normalized || normalized === 'bayern' || normalized === 'bavaria' || normalized.includes('bayern');
  if (!stateOk) return { state: 'Bayern', evidence: [], highGroundwaterArea: null, modelledGroundwaterFound: false };
  const high = await queryHighGroundwater(lat, lng, fetcher);
  const hydro = await queryHydroUnit(lat, lng, fetcher);
  const groundwater = hydro.status === 'VERIFIED'
    ? await queryGroundwaterModel(lat, lng, siteElevationM, hydro, fetcher)
    : noData('de-by-groundwater-no-hydro-unit', 'A Bavaria groundwater-surface estimate was not attempted because the local hydrogeological unit could not be established from the official service.', GEO_ARCGIS + '/' + CONTOUR_LAYER, 'INSUFFICIENT_EVIDENCE');
  const highGroundwaterArea = high.status === 'VERIFIED' ? Boolean((high.value as any)?.flagged) : null;
  return {
    state: 'Bayern', evidence: [high, hydro, groundwater],
    highGroundwaterArea, modelledGroundwaterFound: groundwater.status === 'MODELLED'
  };
}export function enrichGermanyBavariaGroundwater(report: VerifiedSiteReport & Record<string, any>, result: GermanyBavariaGroundwaterResult): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...result.evidence);
  const high = result.evidence.find(item => item.id === 'de-by-high-groundwater-area' && item.status === 'VERIFIED');
  const hydro = result.evidence.find(item => item.id === 'de-by-hydrogeological-unit' && item.status === 'VERIFIED');
  const groundwater = result.evidence.find(item => item.id === 'de-by-groundwater-regional-model' && item.status === 'MODELLED');
  const gv = (groundwater?.value || {}) as Record<string, unknown>;
  const hv = (high?.value || {}) as Record<string, unknown>;
  const uv = (hydro?.value || {}) as Record<string, unknown>;
  report.geosurvey_context = {
    ...(report.geosurvey_context || {}),
    bavaria_high_groundwater_area: hv.flagged ?? null,
    bavaria_hydrogeological_unit: uv.label ?? null,
    bavaria_groundwater_surface_elevation_m: gv.estimatedGroundwaterElevationM ?? null,
    bavaria_groundwater_site_elevation_m: gv.siteGroundElevationM ?? null,
    bavaria_groundwater_depth_below_ground_m: gv.estimatedDepthBelowGroundM ?? null,
    bavaria_groundwater_excavation_risk_level: gv.riskLevel ?? null,
    bavaria_groundwater_evidence_level: groundwater ? 'MODELLED' : (high || hydro ? 'VERIFIED' : null),
    bavaria_groundwater_source: SOURCE
  };
  if (groundwater && report.soil) {
    const depth = Number(gv.estimatedDepthBelowGroundM);
    report.soil.estimatedWaterTableDepthM = depth < 0
      ? 'Indicative groundwater head ' + Math.abs(depth).toFixed(1) + ' m above modelled ground level'
      : 'Indicative groundwater depth ' + depth.toFixed(1) + ' m below modelled ground level';
    report.soil.groundwaterNotice = groundwater.claim;
  }
}

export const GERMANY_BAVARIA_GROUNDWATER_SOURCES = {
  waterArcgis: WATER_ARCGIS,
  geologyArcgis: GEO_ARCGIS,
  highGroundwaterLayer: 'hwk_hgw',
  hydrogeologicalUnitLayer: 'hk500_gwleiter',
  groundwaterContourLayer: 'hk100_gwgl_ges',
  groundwaterSupportPointLayer: 'hk100_szgwgl_ges',
  nativeCrs: 'EPSG:25832'
};
