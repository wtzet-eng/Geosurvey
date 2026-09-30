import { inflateRawSync } from 'node:zlib';
import type { EvidenceItem } from '../types';

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

const DOWNLOAD_PAGE_URL = 'https://use-land-property-data.service.gov.uk/datasets/inspire/download';
const GML_FILE_NAME = 'Land_Registry_Cadastral_Parcels.gml';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ZIP_CACHE_ENTRIES = 3;

type AuthorityDownload = { name: string; url: string; cookies: string[] };
const authorityCache = new Map<string, { expiresAt: number; download: AuthorityDownload }>();
const zipCache = new Map<string, { expiresAt: number; data: Buffer }>();
const zipInFlight = new Map<string, Promise<Buffer>>();

function normalizeAuthorityName(value: string): string {
  return value.replace(/&amp;/gi, '&').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(city|metropolitan|district|borough|county|unitary|royal|council)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function extractSetCookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const raw = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie') as string] : []);
  return raw.map(function(cookie) { return cookie.split(';', 1)[0].trim(); }).filter(Boolean);
}

function cookieHeader(cookies: string[]): string { return cookies.join('; '); }

async function fetchDownloadPage(): Promise<{ html: string; cookies: string[] }> {
  const first = await fetch(DOWNLOAD_PAGE_URL, { redirect: 'manual', headers: { 'User-Agent': 'GroundSurf/1.0 UK cadastral evidence' } });
  let cookies = extractSetCookies(first);
  const location = first.headers.get('location');
  if (first.status >= 300 && first.status < 400 && location) {
    const second = await fetch(new URL(location, DOWNLOAD_PAGE_URL), {
      headers: { 'User-Agent': 'GroundSurf/1.0 UK cadastral evidence', Cookie: cookieHeader(cookies) }
    });
    cookies = [...new Set(cookies.concat(extractSetCookies(second)))];
    if (!second.ok) throw new Error('HMLR download page HTTP ' + second.status);
    return { html: await second.text(), cookies: cookies };
  }
  if (first.ok) return { html: await first.text(), cookies: cookies };
  throw new Error('HMLR download page HTTP ' + first.status);
}

function parseAuthorityDownloads(html: string): AuthorityDownload[] {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  return rows.map(function(row) {
    const content = row[1];
    const nameMatch = content.match(/<th\b[^>]*>([\s\S]*?)<\/th>/i);
    const hrefMatch = content.match(/<a\b[^>]*href=["']([^"']+\.zip)["']/i);
    if (!nameMatch || !hrefMatch) return null;
    const name = nameMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return name ? { name: name, url: new URL(hrefMatch[1], DOWNLOAD_PAGE_URL).toString(), cookies: [] } : null;
  }).filter(function(item): item is AuthorityDownload { return Boolean(item); });
}

function chooseAuthority(downloads: AuthorityDownload[], municipality?: string): AuthorityDownload | null {
  const needle = normalizeAuthorityName(municipality || '');
  if (!needle) return null;
  const scored = downloads.map(function(item) {
    const hay = normalizeAuthorityName(item.name);
    let score = 0;
    if (hay === needle) score = 100;
    else if (hay.indexOf(needle + ' ') === 0 || needle.indexOf(hay + ' ') === 0) score = 80;
    else if (hay.indexOf(needle) >= 0 || needle.indexOf(hay) >= 0) score = 60;
    return { item: item, score: score };
  }).filter(function(item) { return item.score > 0; }).sort(function(a, b) { return b.score - a.score; });
  return scored[0] ? scored[0].item : null;
}

async function resolveAuthorityDownload(municipality?: string): Promise<AuthorityDownload | null> {
  const key = normalizeAuthorityName(municipality || '');
  if (!key) return null;
  const cached = authorityCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.download;
  const page = await fetchDownloadPage();
  const selected = chooseAuthority(parseAuthorityDownloads(page.html), municipality);
  if (!selected) return null;
  const download = { name: selected.name, url: selected.url, cookies: page.cookies };
  authorityCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, download: download });
  return download;
}

function findEndOfCentralDirectory(zip: Buffer): number {
  const min = Math.max(0, zip.length - 0x10000 - 22);
  for (let i = zip.length - 22; i >= min; i--) if (zip.readUInt32LE(i) === 0x06054b50) return i;
  throw new Error('HMLR ZIP central directory not found');
}

function extractGmlFromZip(zip: Buffer): Buffer {
  const eocd = findEndOfCentralDirectory(zip);
  const count = zip.readUInt16LE(eocd + 10);
  const centralOffset = zip.readUInt32LE(eocd + 16);
  let cursor = centralOffset;
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) break;
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const fileName = zip.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!fileName.endsWith(GML_FILE_NAME)) continue;
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = zip.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) return Buffer.from(compressed);
    if (method === 8) return inflateRawSync(compressed);
    throw new Error('Unsupported HMLR ZIP compression method ' + method);
  }
  throw new Error('HMLR ZIP does not contain ' + GML_FILE_NAME);
}

async function downloadAuthorityZip(authority: AuthorityDownload): Promise<Buffer> {
  const cached = zipCache.get(authority.url);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const active = zipInFlight.get(authority.url);
  if (active) return active;
  const promise = fetch(authority.url, {
    headers: { 'User-Agent': 'GroundSurf/1.0 UK cadastral evidence', Accept: 'application/zip, application/octet-stream', Cookie: cookieHeader(authority.cookies) }
  }).then(async function(response) {
    if (!response.ok) throw new Error('HMLR ' + authority.name + ' download HTTP ' + response.status);
    const data = Buffer.from(await response.arrayBuffer());
    zipCache.set(authority.url, { expiresAt: Date.now() + CACHE_TTL_MS, data: data });
    while (zipCache.size > MAX_ZIP_CACHE_ENTRIES) {
      const oldest = zipCache.keys().next().value;
      if (!oldest) break;
      zipCache.delete(oldest);
    }
    return data;
  }).finally(function() { zipInFlight.delete(authority.url); });
  zipInFlight.set(authority.url, promise);
  return promise;
}

function parseFeatureRing(featureXml: string): Point[] {
  const exterior = featureXml.match(/<[^>]*exterior[^>]*>[\s\S]*?<[^>]*posList[^>]*>([\s\S]*?)<\/[^>]*posList>/i);
  const source = exterior ? exterior[1] : (featureXml.match(/<[^>]*posList[^>]*>([\s\S]*?)<\/[^>]*posList>/i) || [])[1];
  if (!source) return [];
  const nums = parseNumbers(source);
  return nums.length >= 6 ? pairCoordinates(nums) : [];
}

function extractInspireId(featureXml: string): string | null {
  const match = featureXml.match(/<[^>]*INSPIREID[^>]*>([^<]+)<\//i);
  return match ? match[1].trim() : null;
}

function extractDatasetDate(gml: Buffer): string {
  const header = gml.toString('utf8', 0, Math.min(gml.length, 4096));
  const match = header.match(/timeStamp=["'](\d{4}-\d{2}-\d{2})/i);
  return match ? match[1] : today();
}

function pointOnSegment(point: Point, a: Point, b: Point): boolean {
  const cross = (point[1] - a[1]) * (b[0] - a[0]) - (point[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(cross) > 0.05) return false;
  return point[0] >= Math.min(a[0], b[0]) - 0.05 && point[0] <= Math.max(a[0], b[0]) + 0.05 && point[1] >= Math.min(a[1], b[1]) - 0.05 && point[1] <= Math.max(a[1], b[1]) + 0.05;
}

function inside(point: Point, ring: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    if (pointOnSegment(point, ring[j], ring[i])) return true;
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function extractMappedFeature(gml: Buffer, point: Point): { parcelId: string; ring: Point[]; area: number } | null {
  const open = Buffer.from('<LR:PREDEFINED');
  const close = Buffer.from('</LR:PREDEFINED>');
  let cursor = 0;
  while (cursor < gml.length) {
    const start = gml.indexOf(open, cursor);
    if (start < 0) break;
    const closeStart = gml.indexOf(close, start);
    if (closeStart < 0) break;
    const end = closeStart + close.length;
    const feature = gml.toString('utf8', start, end);
    const ring = parseFeatureRing(feature);
    cursor = end;
    if (ring.length < 3) continue;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of ring) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    if (point[0] < minX || point[0] > maxX || point[1] < minY || point[1] > maxY) continue;
    if (!inside(point, ring)) continue;
    const parcelId = extractInspireId(feature);
    if (!parcelId) continue;
    return { parcelId: parcelId, ring: ring, area: projectedArea(ring) };
  }
  return null;
}

export interface UkCadastreResult {
  success: boolean;
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  parcel?: { parcelId: string; geometryPoints: Point[]; mappedAreaM2: number };
  authorityName?: string;
  authorityDownloadUrl?: string;
  evidence: EvidenceItem[];
  reasonCode?: string;
}

export async function queryUKCadastre(lat: number, lng: number, municipality?: string): Promise<UkCadastreResult> {
  const point = wgs84ToBng(lat, lng);
  const authority = await resolveAuthorityDownload(municipality);
  if (!authority) {
    return { success: false, sourceName: SOURCE, sourceUrl: DOWNLOAD_PAGE_URL, datasetDate: today(), reasonCode: 'AUTHORITY_NOT_RESOLVED', evidence: [{
      id: 'uk-hmlr-inspire-authority-unresolved', category: 'Cadastre & identification',
      claim: 'HM Land Registry INSPIRE data could not be matched to the resolved UK local authority.',
      status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: DOWNLOAD_PAGE_URL, datasetDate: today(),
      spatialRelationship: 'Selected site coordinate',
      calculationMethod: 'HMLR local-authority download selection followed by EPSG:27700 point-in-polygon search',
      confidence: 'Medium', value: { municipality: municipality || null, reasonCode: 'AUTHORITY_NOT_RESOLVED' },
      limitation: 'No authority file was selected; this is not evidence that the property is unregistered.'
    }] };
  }
  try {
    const gml = extractGmlFromZip(await downloadAuthorityZip(authority));
    const datasetDate = extractDatasetDate(gml);
    const match = extractMappedFeature(gml, point);
    if (!match) return { success: false, sourceName: SOURCE, sourceUrl: authority.url, datasetDate: datasetDate, reasonCode: 'NO_DATA', authorityName: authority.name, authorityDownloadUrl: authority.url, evidence: [{
      id: 'uk-hmlr-inspire-cadastre-site', category: 'Cadastre & identification',
      claim: 'HM Land Registry INSPIRE returned no polygon containing the selected coordinate in the ' + authority.name + ' dataset.',
      status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: authority.url, datasetDate: datasetDate,
      spatialRelationship: 'Selected coordinate', calculationMethod: 'HMLR local-authority GML download; EPSG:27700 point-in-polygon search',
      confidence: 'Medium', value: { authority: authority.name, reasonCode: 'NO_DATA' },
      limitation: 'The INSPIRE dataset covers registered freehold properties in England and Wales. No matching polygon does not by itself establish that the land is unregistered.'
    }] };
    const geometryPoints = match.ring.map(function(p) { return bngToWgs84(p[0], p[1]); });
    return { success: true, sourceName: SOURCE, sourceUrl: authority.url, datasetDate: datasetDate, authorityName: authority.name, authorityDownloadUrl: authority.url, parcel: { parcelId: match.parcelId, geometryPoints: geometryPoints, mappedAreaM2: match.area }, evidence: [{
      id: 'uk-hmlr-inspire-cadastre', category: 'Cadastre & identification',
      claim: 'HM Land Registry INSPIRE identified registered-property polygon ' + match.parcelId + ' containing the selected coordinate; the indicative mapped polygon area is ' + Math.round(match.area).toLocaleString() + ' m².',
      status: 'VERIFIED', sourceName: SOURCE, sourceUrl: authority.url, datasetDate: datasetDate,
      spatialRelationship: 'Selected coordinate inside HMLR INSPIRE polygon ' + match.parcelId,
      calculationMethod: 'HMLR local-authority GML download in EPSG:27700; polygon area calculated from supplied coordinates',
      confidence: 'High', value: { inspireId: match.parcelId, mappedAreaM2: match.area, authority: authority.name },
      limitation: LIMITATION
    }] };
  } catch (error) {
    return { success: false, sourceName: SOURCE, sourceUrl: authority.url, datasetDate: today(), reasonCode: 'SOURCE_UNAVAILABLE', authorityName: authority.name, authorityDownloadUrl: authority.url, evidence: [{
      id: 'uk-hmlr-inspire-cadastre-unavailable', category: 'Cadastre & identification',
      claim: 'HM Land Registry INSPIRE data for ' + authority.name + ' could not be downloaded or read for this query.',
      status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: authority.url, datasetDate: today(),
      spatialRelationship: 'Selected site coordinate', calculationMethod: 'HMLR local-authority GML download and EPSG:27700 spatial search',
      confidence: 'Low', value: { authority: authority.name, reasonCode: 'SOURCE_UNAVAILABLE', error: error instanceof Error ? error.message : String(error) },
      limitation: 'A download or parsing failure is not evidence that the property is unregistered.'
    }] };
  }
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
