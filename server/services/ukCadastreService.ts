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
  // WGS84 -> OSGB36 Helmert transform, then British National Grid.
  const phi = lat * Math.PI / 180, lambda = lon * Math.PI / 180;
  const aW = 6378137, bW = 6356752.3141, aO = 6377563.396, bO = 6356256.909;
  const e2W = 1 - (bW*bW)/(aW*aW);
  const nuW = aW / Math.sqrt(1 - e2W*Math.sin(phi)**2);
  const x = nuW*Math.cos(phi)*Math.cos(lambda);
  const y = nuW*Math.cos(phi)*Math.sin(lambda);
  const z = (1-e2W)*nuW*Math.sin(phi);
  const tx=446.448, ty=-125.157, tz=542.060;
  const rx=0.1502*Math.PI/(180*3600), ry=0.2470*Math.PI/(180*3600), rz=0.8421*Math.PI/(180*3600);
  const scale=1+20.4894e-6;
  const xO=tx+scale*x-rz*y+ry*z, yO=ty+rz*x+scale*y-rx*z, zO=tz-ry*x+rx*y+scale*z;
  const e2O=1-(bO*bO)/(aO*aO), p=Math.sqrt(xO*xO+yO*yO);
  let phiO=Math.atan2(zO,p*(1-e2O));
  for(let i=0;i<10;i++){ const nu=aO/Math.sqrt(1-e2O*Math.sin(phiO)**2); const next=Math.atan2(zO+e2O*nu*Math.sin(phiO),p); if(Math.abs(next-phiO)<1e-12){phiO=next;break;} phiO=next; }
  return osgb36ToBng(phiO, Math.atan2(yO,xO), aO, bO);
}

function osgb36ToBng(phi:number, lambda:number, a:number, b:number):[number,number] {
  const F0=0.9996012717, lat0=49*Math.PI/180, lon0=-2*Math.PI/180, N0=-100000, E0=400000;
  const e2=1-(b*b)/(a*a), n=(a-b)/(a+b), sin=Math.sin(phi), cos=Math.cos(phi), tan=Math.tan(phi);
  const nu=a*F0/Math.sqrt(1-e2*sin*sin), rho=a*F0*(1-e2)/Math.pow(1-e2*sin*sin,1.5), eta2=nu/rho-1;
  const ma=(1+n+5*n*n/4+5*n*n*n/4)*(phi-lat0);
  const mb=(3*n+3*n*n+21*n*n*n/8)*Math.sin(phi-lat0)*Math.cos(phi+lat0);
  const mc=(15*n*n/8+15*n*n*n/8)*Math.sin(2*(phi-lat0))*Math.cos(2*(phi+lat0));
  const md=35*n*n*n/24*Math.sin(3*(phi-lat0))*Math.cos(3*(phi+lat0));
  const M=b*F0*(ma-mb+mc-md), dL=lambda-lon0;
  return [
    E0+nu*cos*dL+nu*cos**3/6*(nu/rho-tan*tan)*dL**3+nu*cos**5/120*(5-18*tan*tan+tan**4+14*eta2-58*tan*tan*eta2)*dL**5,
    M+N0+nu*sin*cos/2*dL**2+nu*sin*cos**3/24*(5-tan*tan+9*eta2)*dL**4+nu*sin*cos**5/720*(61-58*tan*tan+tan**4)*dL**6
  ];
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
function bngToWgs84(easting:number,northing:number):[number,number] {
  const a=6377563.396,b=6356256.909,F0=0.9996012717,lat0=49*Math.PI/180,lon0=-2*Math.PI/180,N0=-100000,E0=400000;
  const e2=1-(b*b)/(a*a),n=(a-b)/(a+b); let phi=lat0;
  for(let i=0;i<10;i++){
    const ma=(1+n+5*n*n/4+5*n*n*n/4)*(phi-lat0);
    const mb=(3*n+3*n*n+21*n*n*n/8)*Math.sin(phi-lat0)*Math.cos(phi+lat0);
    const mc=(15*n*n/8+15*n*n*n/8)*Math.sin(2*(phi-lat0))*Math.cos(2*(phi+lat0));
    const md=35*n*n*n/24*Math.sin(3*(phi-lat0))*Math.cos(3*(phi+lat0));
    const M=b*F0*(ma-mb+mc-md), next=phi+(northing-N0-M)/(a*F0);
    if(Math.abs(next-phi)<1e-12){phi=next;break;} phi=next;
  }
  const sin=Math.sin(phi),cos=Math.cos(phi),tan=Math.tan(phi),nu=a*F0/Math.sqrt(1-e2*sin*sin),rho=a*F0*(1-e2)/Math.pow(1-e2*sin*sin,1.5),eta2=nu/rho-1,dE=easting-E0;
  const phiO=phi-tan/(2*rho*nu)*dE*dE+tan/(24*rho*nu**3)*(5+3*tan*tan+eta2-9*tan*tan*eta2)*dE**4-tan/(720*rho*nu**5)*(61+90*tan*tan+45*tan**4)*dE**6;
  const lambdaO=lon0+dE/(cos*nu)-dE**3/(cos*6*nu**3)*(nu/rho+2*tan*tan)+dE**5/(cos*120*nu**5)*(5+28*tan*tan+24*tan**4);
  const nuO=a/Math.sqrt(1-e2*Math.sin(phiO)**2), x=(nuO)*Math.cos(phiO)*Math.cos(lambdaO), y=nuO*Math.cos(phiO)*Math.sin(lambdaO), z=(1-e2)*nuO*Math.sin(phiO);
  const tx=-446.448,ty=125.157,tz=-542.060,rx=-0.1502*Math.PI/(180*3600),ry=-0.2470*Math.PI/(180*3600),rz=-0.8421*Math.PI/(180*3600),scale=1-20.4894e-6;
  const xW=tx+scale*x-rz*y+ry*z,yW=ty+rz*x+scale*y-rx*z,zW=tz-ry*x+rx*y+scale*z;
  const aW=6378137,bW=6356752.3141,e2W=1-(bW*bW)/(aW*aW),p=Math.sqrt(xW*xW+yW*yW); let phiW=Math.atan2(zW,p*(1-e2W));
  for(let i=0;i<10;i++){const nuW=aW/Math.sqrt(1-e2W*Math.sin(phiW)**2),next=Math.atan2(zW+e2W*nuW*Math.sin(phiW),p);if(Math.abs(next-phiW)<1e-12){phiW=next;break;}phiW=next;}
  return [phiW*180/Math.PI,Math.atan2(yW,xW)*180/Math.PI];
}
