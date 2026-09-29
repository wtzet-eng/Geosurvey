import type { CadastralParcelInfo, EvidenceItem } from '../types';

const SOURCE = 'HM Land Registry INSPIRE Index Polygons';
const SOURCE_URL = 'https://inspire.landregistry.gov.uk/inspire/ows';
const LIMITATION = 'HM Land Registry INSPIRE polygons show the indicative position and extent of registered property. They do not establish the legal extent of a registered title; that requires the individual title plan.';

type Point = [number, number];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Convert WGS84 latitude/longitude to British National Grid (EPSG:27700). */
function wgs84ToBng(lat: number, lon: number): [number, number] {
  const a = 6377563.396;
  const b = 6356256.909;
  const F0 = 0.9996012717;
  const lat0 = 49 * Math.PI / 180;
  const lon0 = -2 * Math.PI / 180;
  const N0 = -100000;
  const E0 = 400000;
  const e2 = 1 - (b * b) / (a * a);
  const ePrime2 = e2 / (1 - e2);
  const phi = lat * Math.PI / 180;
  const lambda = lon * Math.PI / 180;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const nu = a * F0 / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * sinPhi * sinPhi, 1.5);
  const eta2 = nu / rho - 1;

  const M = b * F0 * (
    (1 + n + (5 / 4) * n2(e2) + (5 / 4) * n3(e2)) * (phi - lat0)
  );
  // Use the standard OSGB36 meridional arc formula directly.
  const n = (a - b) / (a + b);
  const Ma = (1 + n + (5 / 4) * n * n + (5 / 4) * n * n * n) * (phi - lat0);
  const Mb = (3 * n + 3 * n * n + (21 / 8) * n * n * n) * Math.sin(phi - lat0) * Math.cos(phi + lat0);
  const Mc = ((15 / 8) * n * n + (15 / 8) * n * n * n) * Math.sin(2 * (phi - lat0)) * Math.cos(2 * (phi + lat0));
  const Md = (35 / 24) * n * n * n * Math.sin(3 * (phi - lat0)) * Math.cos(3 * (phi + lat0));
  const meridionalArc = b * F0 * (Ma - Mb + Mc - Md);

  const dLambda = lambda - lon0;
  const I = meridionalArc + N0;
  const II = (nu / 2) * sinPhi * cosPhi;
  const III = (nu / 24) * sinPhi * Math.pow(cosPhi, 3) * (5 - tanPhi * tanPhi + 9 * eta2);
  const IIIA = (nu / 720) * sinPhi * Math.pow(cosPhi, 5) * (61 - 58 * tanPhi * tanPhi + Math.pow(tanPhi, 4));
  const IV = nu * cosPhi;
  const V = (nu / 6) * Math.pow(cosPhi, 3) * (nu / rho - tanPhi * tanPhi);
  const VI = (nu / 120) * Math.pow(cosPhi, 5) * (5 - 18 * tanPhi * tanPhi + Math.pow(tanPhi, 4) + 14 * eta2 - 58 * tanPhi * tanPhi * eta2);

  const northing = I + II * dLambda * dLambda + III * Math.pow(dLambda, 4) + IIIA * Math.pow(dLambda, 6);
  const easting = E0 + IV * dLambda + V * Math.pow(dLambda, 3) + VI * Math.pow(dLambda, 5);
  void M; // retained only to make the ellipsoid constants explicit.
  return [easting, northing];

  function n2(_e2: number): number { return 0; }
  function n3(_e2: number): number { return 0; }
}

function parseNumbers(text: string): number[] {
  return (text.match(/[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g) || []).map(Number).filter(Number.isFinite);
}

function parseGmlPolygon(xml: string): Point[] {
  const candidates: Point[][] = [];
  const posLists = [...xml.matchAll(/<[^>]*posList[^>]*>([\s\S]*?)<\/[^>]*posList>/gi)];
  for (const match of posLists) {
    const nums = parseNumbers(match[1]);
    if (nums.length >= 6) candidates.push(pairCoordinates(nums));
  }
  const coordinates = [...xml.matchAll(/<[^>]*coordinates[^>]*>([\s\S]*?)<\/[^>]*coordinates>/gi)];
  for (const match of coordinates) {
    const pairs = match[1].trim().split(/\s+/).map(pair => pair.split(',').map(Number)).filter(p => p.length >= 2 && p.every(Number.isFinite));
    if (pairs.length >= 3) candidates.push(pairs.map(p => [p[0], p[1]] as Point));
  }
  return candidates.sort((a, b) => b.length - a.length)[0] || [];
}

function pairCoordinates(nums: number[]): Point[] {
  const pairs: Point[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pairs.push([nums[i], nums[i + 1]]);
  return pairs;
}

function projectedArea(ring: Point[]): number {
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function inside(point: [number, number], ring: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = (yi > point[1]) !== (yj > point[1]);
    if (crosses && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function extractId(xml: string): string | null {
  const match = xml.match(/(?:gml:id|fid|id)\s*=\s*["']([^"']+)["']/i);
  return match?.[1] || null;
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'GroundSurf/1.0 UK cadastral evidence', Accept: 'application/vnd.ogc.gml, application/xml, text/xml' },
      signal: controller.signal
    });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function getFeatureInfoUrl(lat: number, lng: number): string {
  const [easting, northing] = wgs84ToBng(lat, lng);
  const half = 50;
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    LAYERS: 'inspire:CP.CadastralParcel',
    QUERY_LAYERS: 'inspire:CP.CadastralParcel',
    STYLES: '',
    SRS: 'EPSG:27700',
    BBOX: `${easting - half},${northing - half},${easting + half},${northing + half}`,
    WIDTH: '101',
    HEIGHT: '101',
    X: '50',
    Y: '50',
    INFO_FORMAT: 'application/vnd.ogc.gml',
    FEATURE_COUNT: '10'
  });
  return `${SOURCE_URL}?${params}`;
}

export interface UkCadastreResult {
  success: boolean;
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  parcel?: {
    parcelId: string;
    geometryPoints: Point[];
    officialAreaM2: number;
  };
  evidence: EvidenceItem[];
  reasonCode?: string;
}

export async function queryUKCadastre(lat: number, lng: number): Promise<UkCadastreResult> {
  const url = getFeatureInfoUrl(lat, lng);
  const xml = await fetchText(url);
  if (!xml) {
    return {
      success: false, sourceName: SOURCE, sourceUrl: SOURCE_URL, datasetDate: today(), reasonCode: 'SOURCE_UNAVAILABLE',
      evidence: [{
        id: 'uk-hmlr-inspire-cadastre-unavailable',
        category: 'Cadastre & identification',
        claim: 'HM Land Registry INSPIRE parcel service could not be queried at the selected coordinate.',
        status: 'REQUIRES_VERIFICATION',
        sourceName: SOURCE, sourceUrl: SOURCE_URL, datasetDate: today(),
        spatialRelationship: 'Selected site coordinate',
        calculationMethod: 'HM Land Registry WMS GetFeatureInfo using British National Grid (EPSG:27700)',
        confidence: 'Low',
        value: { reasonCode: 'SOURCE_UNAVAILABLE' },
        limitation: 'Service failure is not evidence that the property is unregistered.'
      }]
    };
  }

  const ringProjected = parseGmlPolygon(xml);
  if (ringProjected.length < 3) {
    return {
      success: false, sourceName: SOURCE, sourceUrl: SOURCE_URL, datasetDate: today(), reasonCode: 'NO_DATA',
      evidence: [{
        id: 'uk-hmlr-inspire-cadastre-site',
        category: 'Cadastre & identification',
        claim: 'HM Land Registry INSPIRE returned no usable parcel polygon at the selected coordinate.',
        status: 'REQUIRES_VERIFICATION',
        sourceName: SOURCE, sourceUrl: SOURCE_URL, datasetDate: today(),
        spatialRelationship: 'Selected site coordinate',
        calculationMethod: 'HM Land Registry WMS GetFeatureInfo using British National Grid (EPSG:27700)',
        confidence: 'Medium',
        value: { reasonCode: 'NO_DATA' },
        limitation: 'The INSPIRE dataset covers registered freehold properties in England and Wales; no returned polygon does not by itself establish that the land is unregistered.'
      }]
    };
  }

  const point = wgs84ToBng(lat, lng);
  const containsPoint = inside(point, ringProjected);
  const area = projectedArea(ringProjected);
  if (!containsPoint) {
    return {
      success: false, sourceName: SOURCE, sourceUrl: SOURCE_URL, datasetDate: today(), reasonCode: 'POINT_NOT_IN_POLYGON',
      evidence: [{
        id: 'uk-hmlr-inspire-cadastre-nearby',
        category: 'Cadastre & identification',
        claim: 'HM Land Registry returned parcel geometry near the selected coordinate, but the returned geometry did not contain the selected point.',
        status: 'REQUIRES_VERIFICATION',
        sourceName: SOURCE, sourceUrl: SOURCE_URL, datasetDate: today(),
        spatialRelationship: 'Returned WMS feature around selected coordinate',
        calculationMethod: 'WMS GetFeatureInfo geometry parsing and point-in-polygon check in EPSG:27700',
        confidence: 'Medium',
        value: { areaM2: area },
        limitation: LIMITATION
      }]
    };
  }

  const parcelId = extractId(xml) || 'HMLR INSPIRE parcel';
  const geometryPoints = ringProjected.map(([easting, northing]) => bngToWgs84(easting, northing));
  return {
    success: true, sourceName: SOURCE, sourceUrl: SOURCE_URL, datasetDate: today(),
    parcel: { parcelId, geometryPoints, officialAreaM2: area },
    evidence: [{
      id: 'uk-hmlr-inspire-cadastre',
      category: 'Cadastre & identification',
      claim: `HM Land Registry INSPIRE returned a registered-property polygon at the selected coordinate with an indicative mapped area of ${Math.round(area).toLocaleString()} m².`,
      status: 'VERIFIED',
      sourceName: SOURCE, sourceUrl: SOURCE_URL, datasetDate: today(),
      spatialRelationship: 'Selected coordinate intersects the returned HMLR INSPIRE polygon',
      calculationMethod: 'HM Land Registry WMS GetFeatureInfo geometry parsed in EPSG:27700; area calculated from returned polygon coordinates',
      confidence: 'High',
      value: { inspireId: parcelId, areaM2: area },
      limitation: LIMITATION
    }]
  };
}

// Inverse OSGB36/British National Grid transform. Accuracy is appropriate for map screening;
// HMLR notes that reprojection can introduce small positional differences.
function bngToWgs84(easting: number, northing: number): [number, number] {
  const a = 6377563.396, b = 6356256.909, F0 = 0.9996012717;
  const lat0 = 49 * Math.PI / 180, lon0 = -2 * Math.PI / 180, N0 = -100000, E0 = 400000;
  const e2 = 1 - (b * b) / (a * a), n = (a - b) / (a + b);
  let lat = lat0 + (northing - N0) / (a * F0);
  let M = 0;
  do {
    lat = (northing - N0 - M) / (a * F0) + lat;
    const Ma = (1 + n + 5*n*n/4 + 5*n*n*n/4) * (lat - lat0);
    const Mb = (3*n + 3*n*n + 21*n*n*n/8) * Math.sin(lat-lat0) * Math.cos(lat+lat0);
    const Mc = (15*n*n/8 + 15*n*n*n/8) * Math.sin(2*(lat-lat0)) * Math.cos(2*(lat+lat0));
    const Md = 35*n*n*n/24 * Math.sin(3*(lat-lat0)) * Math.cos(3*(lat+lat0));
    M = b * F0 * (Ma - Mb + Mc - Md);
  } while (Math.abs(northing - N0 - M) >= 0.00001);

  const sinLat = Math.sin(lat), cosLat = Math.cos(lat), tanLat = Math.tan(lat);
  const nu = a * F0 / Math.sqrt(1 - e2*sinLat*sinLat);
  const rho = a * F0 * (1-e2) / Math.pow(1-e2*sinLat*sinLat, 1.5);
  const eta2 = nu/rho - 1;
  const VII = tanLat/(2*rho*nu);
  const VIII = tanLat/(24*rho*nu**3) * (5 + 3*tanLat*tanLat + eta2 - 9*tanLat*tanLat*eta2);
  const IX = tanLat/(720*rho*nu**5) * (61 + 90*tanLat*tanLat + 45*Math.pow(tanLat,4));
  const X = 1/(cosLat*nu);
  const XI = 1/(cosLat*6*nu**3) * (nu/rho + 2*tanLat*tanLat);
  const XII = 1/(cosLat*120*nu**5) * (5 + 28*tanLat*tanLat + 24*Math.pow(tanLat,4));
  const dE = easting - E0;
  const phi = lat - VII*dE*dE + VIII*Math.pow(dE,4) - IX*Math.pow(dE,6);
  const lambda = lon0 + X*dE - XI*Math.pow(dE,3) + XII*Math.pow(dE,5);
  return [phi*180/Math.PI, lambda*180/Math.PI];
}
