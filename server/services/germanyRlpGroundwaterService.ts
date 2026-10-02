import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyRlpGroundwaterResult {
  state: 'Rheinland-Pfalz';
  evidence: EvidenceItem[];
  modelledGroundwaterFound: boolean;
}

const GWO_WFS = 'https://mapserver.lgb-rlp.de/cgi-bin/mc_gwo';
const SOURCE = 'Landesamt für Geologie und Bergbau Rheinland-Pfalz (LGB) — GWO-RLP 2025';
const STATE = 'Rheinland-Pfalz' as const;
const today = () => new Date().toISOString().slice(0, 10);

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function numberValue(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function noData(id: string, claim: string, url: string, reasonCode: string): EvidenceItem {
  return {
    id, category: 'Hydrogeology', claim, status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE, sourceUrl: url, datasetDate: today(),
    spatialRelationship: 'Selected site coordinate in Rheinland-Pfalz',
    calculationMethod: 'Official LGB WFS acquisition; failed or empty responses are not interpreted as negative findings',
    confidence: 'Low',
    limitation: 'A failed, empty or structurally invalid service response does not establish absence. Confirm the current official LGB record where necessary.',
    value: { reasonCode }
  };
}async function fetchXml(url: string, fetcher: typeof fetch): Promise<{ ok: boolean; xml?: string; status?: number }> {
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'text/xml, application/gml+xml', 'User-Agent': 'GroundSurf/1.0 Rheinland-Pfalz groundwater evidence' }
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, xml: await response.text() };
  } catch {
    return { ok: false };
  }
}

function toRlpNative(lat: number, lng: number): [number, number] {
  const a = 6378137, e2 = 0.006694380023, k0 = 0.9996;
  const ep = e2 / (1 - e2), latRad = lat * Math.PI / 180, lonRad = lng * Math.PI / 180;
  const origin = 9 * Math.PI / 180, sinLat = Math.sin(latRad), cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad), n = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const t = tanLat * tanLat, c = ep * cosLat * cosLat, aa = cosLat * (lonRad - origin);
  const m = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * latRad
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * latRad)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * latRad)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * latRad));
  const easting = k0 * n * (aa + (1 - t + c) * aa ** 3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ep) * aa ** 5 / 120) + 500000;
  const northing = k0 * (m + n * tanLat * (aa ** 2 / 2 + (5 - t + 9 * c + 4 * c * c) * aa ** 4 / 24 + (61 - 58 * t + t * t + 600 * c - 330 * ep) * aa ** 6 / 720));
  return [easting, northing];
}

function linePoints(block: string): [number, number][][] {
  return [...block.matchAll(/<gml:posList[^>]*>([^<]+)<\/gml:posList>/g)].map(match => {
    const values = match[1].trim().split(/\s+/).map(Number);
    const points: [number, number][] = [];
    for (let i = 0; i + 1 < values.length; i += 2) if (Number.isFinite(values[i]) && Number.isFinite(values[i + 1])) points.push([values[i], values[i + 1]]);
    return points;
  }).filter(points => points.length >= 2);
}function field(block: string, name: string): string | null {
  const pattern = '<ms:' + name + '>([^<]*)</ms:' + name + '>';
  return text(block.match(new RegExp(pattern, 'i'))?.[1]);
}

function pointToSegmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function parseContours(xml: string, x: number, y: number) {
  const blocks = [...xml.matchAll(/<gml:featureMember>([\s\S]*?)<\/gml:featureMember>/g)].map(match => match[1]);
  const result = new Map<string, { elevationM: number; distanceM: number; intervalM: number }>();
  for (const block of blocks) {
    const elevationM = numberValue(field(block, 'ISOLINIE'));
    const intervalM = numberValue(field(block, 'ISO_TYP'));
    if (elevationM === null || intervalM === null || ![2, 10, 50, 100].includes(intervalM)) continue;
    let nearest = Number.POSITIVE_INFINITY;
    for (const points of linePoints(block)) for (let i = 1; i < points.length; i += 1) {
      nearest = Math.min(nearest, pointToSegmentDistance(x, y, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]));
    }
    if (Number.isFinite(nearest)) result.set(intervalM + ':' + elevationM, { elevationM, distanceM: nearest, intervalM });
  }
  return [...result.values()].sort((a, b) => a.distanceM - b.distanceM);
}

function chooseEstimate(contours: ReturnType<typeof parseContours>) {
  for (const interval of [2, 10, 50, 100]) {
    const same = contours.filter(item => item.intervalM === interval && item.distanceM <= 12000);
    const levels = [...new Set(same.map(item => item.elevationM))].sort((a, b) => a - b);
    let best: { low: number; high: number; lowDistanceM: number; highDistanceM: number } | null = null;
    for (let i = 0; i < levels.length - 1; i += 1) {
      if (Math.abs(levels[i + 1] - levels[i]) !== interval) continue;
      const low = same.find(item => item.elevationM === levels[i])!;
      const high = same.find(item => item.elevationM === levels[i + 1])!;
      if (!best || low.distanceM + high.distanceM < best.lowDistanceM + best.highDistanceM) {
        best = { low: low.elevationM, high: high.elevationM, lowDistanceM: low.distanceM, highDistanceM: high.distanceM };
      }
    }
    if (best) return { ...best, interval };
  }
  return null;
}async function queryGroundwaterSurface(
  lat: number, lng: number, siteElevationM: number | null, fetcher: typeof fetch
): Promise<EvidenceItem> {
  const [x, y] = toRlpNative(lat, lng);
  const radiusM = 8000;
  const params = new URLSearchParams({
    SERVICE: 'WFS', VERSION: '1.1.0', REQUEST: 'GetFeature', TYPENAME: 'GwGleichen',
    SRSNAME: 'EPSG:25832',
    BBOX: (x - radiusM) + ',' + (y - radiusM) + ',' + (x + radiusM) + ',' + (y + radiusM),
    MAXFEATURES: '2000'
  });
  const url = GWO_WFS + '?' + params.toString();
  const response = await fetchXml(url, fetcher);
  if (!response.ok) return noData('de-rlp-groundwater-unavailable', 'The official Rheinland-Pfalz GWO-RLP groundwater-contour service could not be reached.', url, 'SOURCE_UNAVAILABLE');
  if (!response.xml) return noData('de-rlp-groundwater-malformed', 'The official Rheinland-Pfalz GWO-RLP groundwater-contour service returned no readable response.', url, 'MALFORMED_DATA');
  const estimate = chooseEstimate(parseContours(response.xml, x, y));
  if (!estimate) return noData('de-rlp-groundwater-no-data', 'The official Rheinland-Pfalz GWO-RLP service returned no sufficient nearby contour pair for a regional groundwater-surface estimate.', url, 'INSUFFICIENT_EVIDENCE');  if (siteElevationM === null) {
    return {
      id: 'de-rlp-groundwater-regional-surface', category: 'Hydrogeology',
      claim: 'The official GWO-RLP 2025 model provides nearby groundwater contours at ' + estimate.interval + ' m intervals, supporting a regional groundwater-surface interpretation.',
      status: 'MODELLED', sourceName: SOURCE, sourceUrl: url, datasetDate: '2025',
      spatialRelationship: 'Nearest adjacent ' + estimate.interval + ' m groundwater contours within 15 km',
      calculationMethod: 'LGB WFS 1.1.0 GwGleichen query in EPSG:25832; nearest-distance analysis of official GWO-RLP contours',
      confidence: 'Medium',
      limitation: 'GWO-RLP is a regional prognostic groundwater surface for the upper connected aquifer, not a site measurement or current wet-weather water level. Site-specific observations remain necessary for concrete planning.',
      value: { layer: 'GwGleichen', intervalM: estimate.interval, contourElevationsM: [estimate.low, estimate.high] }
    };
  }
  const fraction = estimate.lowDistanceM / (estimate.lowDistanceM + estimate.highDistanceM);
  const groundwaterElevationM = estimate.low + fraction * (estimate.high - estimate.low);
  const depthM = siteElevationM - groundwaterElevationM;
  const riskLevel = depthM <= 1 ? 'High' : depthM <= 2 ? 'Moderate' : 'Lower';
  const claim = 'The official GWO-RLP 2025 model supports an indicative mean groundwater elevation of approximately ' + groundwaterElevationM.toFixed(1)
    + ' m NN at the selected site, interpolated between the ' + estimate.low + ' m and ' + estimate.high + ' m NN contours. Compared with the modelled site elevation of '
    + siteElevationM.toFixed(1) + ' m, this is approximately ' + (depthM < 0 ? Math.abs(depthM).toFixed(1) + ' m above' : depthM.toFixed(1) + ' m below')
    + ' ground level, giving a ' + riskLevel.toLowerCase() + ' screening level for excavation water under the modelled mean condition.';
  return {
    id: 'de-rlp-groundwater-regional-surface', category: 'Hydrogeology', claim, status: 'MODELLED',
    sourceName: SOURCE, sourceUrl: url, datasetDate: '2025',
    spatialRelationship: 'Nearest adjacent ' + estimate.interval + ' m GWO-RLP contours within 15 km; site elevation ' + siteElevationM.toFixed(1) + ' m',
    calculationMethod: 'LGB WFS 1.1.0 GwGleichen query in EPSG:25832; nearest-distance analysis and linear interpolation between adjacent contours; comparison with site terrain elevation',
    confidence: 'Medium',
    limitation: 'GWO-RLP 2025 is a regional prognostic model of mean groundwater conditions. LGB states that the results are not a substitute for site investigations and that seasonal groundwater fluctuations can reach several metres. This estimate must not be presented as a current or post-heavy-rain groundwater level.',
    value: { layer: 'GwGleichen', intervalM: estimate.interval, estimatedGroundwaterElevationM: groundwaterElevationM, siteGroundElevationM: siteElevationM, estimatedDepthBelowGroundM: depthM, riskLevel, contourElevationsM: [estimate.low, estimate.high], contourDistancesM: [estimate.lowDistanceM, estimate.highDistanceM] }
  };
}export async function queryGermanyRlpGroundwater(
  lat: number, lng: number, state: string | null | undefined,
  fetcher: typeof fetch = fetch, siteElevationM: number | null = null
): Promise<GermanyRlpGroundwaterResult> {
  const normalized = String(state || '').trim().toLowerCase();
  const stateOk = !normalized || normalized === 'rheinland-pfalz' || normalized === 'rhineland-palatinate' || normalized.includes('rheinland-pfalz');
  if (!stateOk) return { state: STATE, evidence: [], modelledGroundwaterFound: false };
  const groundwater = await queryGroundwaterSurface(lat, lng, siteElevationM, fetcher);
  return { state: STATE, evidence: [groundwater], modelledGroundwaterFound: groundwater.status === 'MODELLED' };
}

export function enrichGermanyRlpGroundwater(
  report: VerifiedSiteReport & Record<string, any>, result: GermanyRlpGroundwaterResult
): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...result.evidence);
  const groundwater = result.evidence.find(item => item.id === 'de-rlp-groundwater-regional-surface' && item.status === 'MODELLED');
  if (!groundwater) return;
  const value = (groundwater.value || {}) as Record<string, unknown>;
  report.geosurvey_context = {
    ...(report.geosurvey_context || {}),
    rlp_groundwater_surface_elevation_m: value.estimatedGroundwaterElevationM ?? null,
    rlp_groundwater_site_elevation_m: value.siteGroundElevationM ?? null,
    rlp_groundwater_depth_below_ground_m: value.estimatedDepthBelowGroundM ?? null,
    rlp_groundwater_excavation_risk_level: value.riskLevel ?? null,
    rlp_groundwater_evidence_level: 'MODELLED',
    rlp_groundwater_source: SOURCE
  };
  if (report.soil) {
    const depth = Number(value.estimatedDepthBelowGroundM);
    if (Number.isFinite(depth)) report.soil.estimatedWaterTableDepthM = depth < 0
      ? 'Indicative groundwater head ' + Math.abs(depth).toFixed(1) + ' m above modelled ground level'
      : 'Indicative groundwater depth ' + depth.toFixed(1) + ' m below modelled ground level';
    report.soil.groundwaterNotice = groundwater.claim;
  }
}

export const GERMANY_RLP_GROUNDWATER_SOURCES = {
  wfs: GWO_WFS, contourLayer: 'GwGleichen', groundwaterSurfaceLayer: 'GwStand',
  groundwaterDepthLayer: 'GwFlurabstand', dataset: 'GWO-RLP 2025', nativeCrs: 'EPSG:25832'
};
