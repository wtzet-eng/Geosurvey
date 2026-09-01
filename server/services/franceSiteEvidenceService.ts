import { AvailabilityReason } from '../reporting/canonicalReport';
import { resolveSource } from '../sources/resolver';
import { LogicalSourceId, ResolutionResult, SourceEndpoint, SourceProvenance } from '../sources/sourceTypes';
import { EvidenceLevel } from '../types';
import { SpatialEvidenceScope } from './groundContextService';

export interface FranceSiteEvidence {
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
  reasonCode?: AvailabilityReason;
  resolverProvenance?: SourceProvenance;
  spatialScope?: SpatialEvidenceScope;
}

type FetchLike = typeof fetch;
const BRGM = 'Bureau de Recherches Géologiques et Minières (BRGM)';
const today = () => new Date().toISOString().slice(0, 10);

const clean = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text || /^(null|none|unknown|not available|no data|n\/a|indisponible|sans objet)$/i.test(text)) return null;
  return text;
};

const reasonForResolution = (resolution: ResolutionResult): AvailabilityReason =>
  resolution.status === 'SCHEMA_CHANGED' ? 'MALFORMED_DATA' : 'SOURCE_UNAVAILABLE';

async function fetchResponse(fetcher: FetchLike, url: string, accept: string, timeoutMs = 7000): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { headers: { 'User-Agent': 'GeoSurvey/1.0 evidence extraction', Accept: accept }, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseWmsLayers(xml: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /<(?:Layer|wms:Layer)[^>]*>[\s\S]*?<Name>([^<]+)<\/Name>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const name = match[1].trim();
    if (name && !seen.has(name)) { seen.add(name); out.push(name); }
  }
  return out;
}

function parseWfsFeatureTypes(xml: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /<(?:\w+:)?FeatureType\b[^>]*>[\s\S]*?<(?:\w+:)?Name>([^<]+)<\/(?:\w+:)?Name>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const name = match[1].trim();
    if (name && !seen.has(name)) { seen.add(name); out.push(name); }
  }
  return out;
}

async function probeWms(fetcher: FetchLike, endpoint: SourceEndpoint) {
  let response: Response | null = null;
  let xml = '';
  for (const version of ['1.3.0', '1.1.1']) {
    response = await fetchResponse(fetcher, `${endpoint.url}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=${version}`, 'application/xml,text/xml');
    xml = response?.ok ? await response.text() : '';
    if (parseWmsLayers(xml).length) break;
  }
  const layers = parseWmsLayers(xml);
  return {
    connectivity: Boolean(response),
    httpStatus: response?.status,
    serviceAvailable: Boolean(response?.ok && layers.length),
    observedLayers: layers,
    observedFields: [],
    capabilities: ['GetCapabilities', ...(/<(?:GetMap|wms:GetMap)\b/i.test(xml) ? ['GetMap'] : []), ...(/<(?:GetFeatureInfo|wms:GetFeatureInfo)\b/i.test(xml) ? ['GetFeatureInfo'] : [])],
    payload: { layers }
  };
}

const resolveWms = (fetcher: FetchLike, id: LogicalSourceId) => resolveSource(id, endpoint => probeWms(fetcher, endpoint));

function decodeXml(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
}

function attributeObject(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /([\w:.-]+)=["']([^"']*)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) result[match[1].replace(/^.*:/, '')] = decodeXml(match[2]);
  return result;
}

function parseFeatureInfoBody(body: string, contentType: string): Array<Record<string, unknown>> {
  const trimmed = body.trim();
  if (!trimmed || /ServiceException|ExceptionReport/i.test(trimmed)) return [];
  if (/json/i.test(contentType) || /^[\[{]/.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed?.features)) return parsed.features.map((feature: any) => feature?.properties || feature?.attributes || {}).filter((props: any) => props && typeof props === 'object');
      if (Array.isArray(parsed?.FeatureInfo)) return parsed.FeatureInfo.map((feature: any) => feature?.properties || feature || {}).filter((props: any) => props && typeof props === 'object');
    } catch { /* continue with XML/HTML/text */ }
  }

  const fieldFeatures: Array<Record<string, unknown>> = [];
  const fieldsRe = /<FIELDS\b([^>]*)\/?\s*>/gi;
  let fieldsMatch: RegExpExecArray | null;
  while ((fieldsMatch = fieldsRe.exec(trimmed))) {
    const props = attributeObject(fieldsMatch[1]);
    if (Object.keys(props).length) fieldFeatures.push(props);
  }
  if (fieldFeatures.length) return fieldFeatures;

  if (/<html|<table|<tr/i.test(trimmed)) {
    const props: Record<string, string> = {};
    const rowRe = /<tr[^>]*>\s*<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
    let row: RegExpExecArray | null;
    while ((row = rowRe.exec(trimmed))) {
      const key = decodeXml(row[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
      const value = decodeXml(row[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
      if (key && value) props[key] = value;
    }
    if (Object.keys(props).length) return [props];
  }

  if (/<[^>]+>/.test(trimmed)) {
    const props: Record<string, string> = {};
    const elementRe = /<([\w:.-]+)(?:\s[^>]*)?>\s*([^<>]+?)\s*<\/\1>/g;
    let element: RegExpExecArray | null;
    while ((element = elementRe.exec(trimmed))) {
      const key = element[1].replace(/^.*:/, '');
      const value = decodeXml(element[2]);
      if (!/^(featureMember|boundedBy|coordinates|pos|name)$/i.test(key) && value) props[key] = value;
    }
    if (Object.keys(props).length) return [props];
  }

  const props: Record<string, string> = {};
  for (const line of trimmed.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w .:/()À-ž-]{2,100})\s*(?:=|:)\s*["']?(.+?)["']?\s*$/);
    if (match && match[1] && match[2] && !/^Layer$/i.test(match[1].trim())) props[match[1].trim()] = match[2].trim();
  }
  return Object.keys(props).length ? [props] : [];
}

async function wmsInfo(fetcher: FetchLike, url: string, layer: string, lat: number, lng: number): Promise<{ properties: Array<Record<string, unknown>>; infoFormat: string; version: string } | null> {
  const delta = 0.0008;
  const formats = ['application/json', 'application/vnd.ogc.gml', 'text/xml', 'text/plain', 'text/html'];
  for (const version of ['1.3.0', '1.1.1']) {
    for (const infoFormat of formats) {
      const params = new URLSearchParams({ SERVICE: 'WMS', VERSION: version, REQUEST: 'GetFeatureInfo', LAYERS: layer, QUERY_LAYERS: layer, BBOX: `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`, WIDTH: '101', HEIGHT: '101', INFO_FORMAT: infoFormat, FEATURE_COUNT: '10' });
      if (version === '1.3.0') { params.set('CRS', 'CRS:84'); params.set('I', '50'); params.set('J', '50'); }
      else { params.set('SRS', 'EPSG:4326'); params.set('X', '50'); params.set('Y', '50'); }
      const response = await fetchResponse(fetcher, `${url}?${params}`, infoFormat, 6500);
      if (!response?.ok) continue;
      const properties = parseFeatureInfoBody(await response.text(), response.headers.get('content-type') || infoFormat);
      if (properties.length) return { properties, infoFormat, version };
    }
  }
  return null;
}

function mergedProperties(features: Array<Record<string, unknown>>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const props of features) for (const [key, value] of Object.entries(props)) if (!(key in merged) && clean(value)) merged[key] = value;
  return merged;
}

function pick(props: Record<string, unknown>, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const key = Object.keys(props).find(candidate => pattern.test(candidate));
    if (key) { const value = clean(props[key]); if (value) return value; }
  }
  return null;
}

const UNIT_PATTERNS = [/^formation$/i, /^unite/i, /^unité/i, /nom.*formation/i, /libell.*(?:unit|geol)/i, /geologic.*unit/i, /geol.*unit/i, /^code.*geol/i];
const LITHOLOGY_PATTERNS = [/^litho/i, /litholog/i, /nature.*(?:roche|terrain)/i, /facies/i, /faciès/i, /rock.*type/i, /materiau/i, /matériau/i, /libell.*litho/i];
const AGE_PATTERNS = [/^age/i, /strat/i, /periode/i, /période/i, /epoch/i, /époque/i, /\bere\b/i, /\bère\b/i];
const GENESIS_PATTERNS = [/origine/i, /genese/i, /genèse/i, /mode.*depot/i, /mode.*dépôt/i];

function firstDescriptiveValue(props: Record<string, unknown>): string | null {
  const excluded = /^(id|fid|gid|objectid|shape|geom|geometry|x|y|bbox|layer|scale|echelle|échelle|url|code|symbol|symbole|sheet|feuille|numero|numéro)$/i;
  for (const [key, raw] of Object.entries(props)) {
    if (excluded.test(key)) continue;
    const value = clean(raw);
    if (value && value.length >= 3 && !/^https?:/i.test(value)) return value;
  }
  return null;
}

function geologyFrom(layer: string, info: { properties: Array<Record<string, unknown>> } | null) {
  if (!info) return null;
  const props = mergedProperties(info.properties);
  let lithology = pick(props, LITHOLOGY_PATTERNS);
  if (!lithology && /LITHO_?1M/i.test(layer)) lithology = firstDescriptiveValue(props);
  const unit = pick(props, UNIT_PATTERNS);
  const age = pick(props, AGE_PATTERNS);
  const genesis = pick(props, GENESIS_PATTERNS);
  return unit || lithology || age || genesis ? { unit, lithology, age, genesis, properties: props } : null;
}

const baseLayerName = (layer: string): string => layer.replace(/^.*:/, '').trim();

/**
 * Only rank actual BRGM geology products that may describe the selected point.
 * Catalogue, perimeter, scan-index and overseas layers are intentionally excluded:
 * their presence in a live GetCapabilities document must not crowd out national
 * lithological fallback evidence.
 */
function geologyLayerRank(layer: string): number {
  const name = baseLayerName(layer);
  if (/^SCAN_H_RELIEF_GEOL50$/i.test(name)) return 1;
  if (/^SCAN_H_GEOL50$/i.test(name)) return 2;
  if (/^SCAN_D_GEOL50$/i.test(name)) return 3;
  if (/^SCAN_F_GEOL250$/i.test(name)) return 4;
  if (/^LITHO_1M_SIMPLIFIEE$/i.test(name)) return 5;
  return 99;
}

function scaleForLayer(layer: string): string | null {
  const name = baseLayerName(layer);
  if (/GEOL50|50K|050K/i.test(name)) return '1:50,000';
  if (/GEOL250|250K/i.test(name)) return '1:250,000';
  if (/LITHO_?1M|GEOL1M|1000/i.test(name)) return '1:1,000,000';
  return null;
}

function tierForLayer(layer: string): 1 | 2 | 3 {
  const scale = scaleForLayer(layer);
  return scale === '1:50,000' ? 1 : scale === '1:250,000' ? 2 : 3;
}

async function wfsCapabilities(fetcher: FetchLike, url: string): Promise<{ response: Response | null; types: string[] }> {
  for (const version of ['1.0.0', '1.1.0']) {
    const response = await fetchResponse(fetcher, `${url}?SERVICE=WFS&REQUEST=GetCapabilities&VERSION=${version}`, 'application/xml,text/xml', 7000);
    if (!response?.ok) continue;
    const types = parseWfsFeatureTypes(await response.text());
    if (types.length) return { response, types };
  }
  return { response: null, types: [] };
}

type Coordinate = { lng: number; lat: number };
type PolygonGeometry = { outer: Coordinate[]; holes: Coordinate[][] };
type WfsFeature = { properties: Record<string, string>; point: Coordinate | null; polygons: PolygonGeometry[] };

function parsePointFromBlock(block: string, siteLat: number, siteLng: number): Coordinate | null {
  const coordinateText = block.match(/<(?:gml:)?coordinates[^>]*>\s*([^<]+)\s*<\/(?:gml:)?coordinates>/i)?.[1]
    || block.match(/<(?:gml:)?pos[^>]*>\s*([^<]+)\s*<\/(?:gml:)?pos>/i)?.[1];
  if (!coordinateText) return null;
  const numbers = coordinateText.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  if (numbers.length < 2) return null;
  const candidates = [{ lng: numbers[0], lat: numbers[1] }, { lng: numbers[1], lat: numbers[0] }]
    .filter(point => Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => (a.lat - siteLat) ** 2 + (a.lng - siteLng) ** 2 - ((b.lat - siteLat) ** 2 + (b.lng - siteLng) ** 2))[0];
}

function parseCoordinateSequence(text: string): Coordinate[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.includes(',')) {
    return trimmed.split(/\s+/).map(pair => pair.split(',').map(Number)).filter(pair => pair.length >= 2 && pair.every(Number.isFinite)).map(pair => ({ lng: pair[0], lat: pair[1] }));
  }
  const numbers = trimmed.split(/\s+/).map(Number).filter(Number.isFinite);
  const coordinates: Coordinate[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) coordinates.push({ lng: numbers[i], lat: numbers[i + 1] });
  return coordinates;
}

function ringFromBlock(block: string): Coordinate[] {
  const coordinateText = block.match(/<(?:gml:)?coordinates[^>]*>\s*([^<]+)\s*<\/(?:gml:)?coordinates>/i)?.[1]
    || block.match(/<(?:gml:)?posList[^>]*>\s*([^<]+)\s*<\/(?:gml:)?posList>/i)?.[1];
  return coordinateText ? parseCoordinateSequence(coordinateText) : [];
}

function parsePolygonsFromBlock(block: string): PolygonGeometry[] {
  const polygons: PolygonGeometry[] = [];
  const polygonRe = /<(?:gml:)?Polygon\b[^>]*>([\s\S]*?)<\/(?:gml:)?Polygon>/gi;
  let polygonMatch: RegExpExecArray | null;
  while ((polygonMatch = polygonRe.exec(block))) {
    const polygonBlock = polygonMatch[1];
    const exterior = polygonBlock.match(/<(?:gml:)?(?:outerBoundaryIs|exterior)\b[^>]*>([\s\S]*?)<\/(?:gml:)?(?:outerBoundaryIs|exterior)>/i)?.[1] || polygonBlock;
    const outer = ringFromBlock(exterior);
    if (outer.length < 3) continue;
    const holes: Coordinate[][] = [];
    const innerRe = /<(?:gml:)?(?:innerBoundaryIs|interior)\b[^>]*>([\s\S]*?)<\/(?:gml:)?(?:innerBoundaryIs|interior)>/gi;
    let innerMatch: RegExpExecArray | null;
    while ((innerMatch = innerRe.exec(polygonBlock))) {
      const ring = ringFromBlock(innerMatch[1]);
      if (ring.length >= 3) holes.push(ring);
    }
    polygons.push({ outer, holes });
  }
  return polygons;
}

function pointOnSegment(point: Coordinate, a: Coordinate, b: Coordinate): boolean {
  const cross = (point.lat - a.lat) * (b.lng - a.lng) - (point.lng - a.lng) * (b.lat - a.lat);
  if (Math.abs(cross) > 1e-10) return false;
  return point.lng >= Math.min(a.lng, b.lng) - 1e-10 && point.lng <= Math.max(a.lng, b.lng) + 1e-10
    && point.lat >= Math.min(a.lat, b.lat) - 1e-10 && point.lat <= Math.max(a.lat, b.lat) + 1e-10;
}

function pointInRing(point: Coordinate, ring: Coordinate[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j];
    const b = ring[i];
    if (pointOnSegment(point, a, b)) return true;
    const intersects = ((b.lat > point.lat) !== (a.lat > point.lat))
      && point.lng < ((a.lng - b.lng) * (point.lat - b.lat)) / (a.lat - b.lat) + b.lng;
    if (intersects) inside = !inside;
  }
  return inside;
}

function polygonContainsPoint(polygon: PolygonGeometry, point: Coordinate): boolean {
  return pointInRing(point, polygon.outer) && !polygon.holes.some(hole => pointInRing(point, hole));
}

function parseWfsFeatures(xml: string, siteLat: number, siteLng: number): WfsFeature[] {
  const records: WfsFeature[] = [];
  const memberRe = /<(?:gml:)?featureMember\b[^>]*>([\s\S]*?)<\/(?:gml:)?featureMember>/gi;
  let member: RegExpExecArray | null;
  while ((member = memberRe.exec(xml))) {
    const block = member[1];
    const props: Record<string, string> = {};
    const elementRe = /<([\w:.-]+)(?:\s[^>]*)?>\s*([^<>]+?)\s*<\/\1>/g;
    let element: RegExpExecArray | null;
    while ((element = elementRe.exec(block))) {
      const key = element[1].replace(/^.*:/, '');
      const value = decodeXml(element[2]);
      if (!/^(boundedBy|coordinates|pos|posList|point|polygon|geometry|geom|shape)$/i.test(key) && value) props[key] = value;
    }
    if (Object.keys(props).length) records.push({ properties: props, point: parsePointFromBlock(block, siteLat, siteLng), polygons: parsePolygonsFromBlock(block) });
  }
  return records;
}

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = 6371; const p = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * p / 2) ** 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin((lon2 - lon1) * p / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
};

async function wfsBbox(fetcher: FetchLike, url: string, typeName: string, lat: number, lng: number, radiusDeg: number, maxFeatures = 20) {
  const params = new URLSearchParams({ SERVICE: 'WFS', VERSION: '1.0.0', REQUEST: 'GetFeature', TYPENAME: typeName, SRSNAME: 'EPSG:4326', BBOX: `${lng - radiusDeg},${lat - radiusDeg},${lng + radiusDeg},${lat + radiusDeg},EPSG:4326`, MAXFEATURES: String(maxFeatures) });
  const response = await fetchResponse(fetcher, `${url}?${params}`, 'application/gml+xml,text/xml,application/xml', 8500);
  if (!response?.ok) return [];
  return parseWfsFeatures(await response.text(), lat, lng);
}

async function queryWfsLithologyFallback(lat: number, lng: number, fetcher: FetchLike, endpointUrl: string, resolution: ResolutionResult): Promise<FranceSiteEvidence | null> {
  const { types } = await wfsCapabilities(fetcher, endpointUrl);
  const typeName = types.find(name => /(?:^|:)LITHO_1M_SIMPLIFIEE$/i.test(name)) || null;
  if (!typeName) return null;
  const records = await wfsBbox(fetcher, endpointUrl, typeName, lat, lng, 0.0005, 10);
  const sitePoint = { lng, lat };
  const containing = records.filter(record => record.polygons.some(polygon => polygonContainsPoint(polygon, sitePoint)));
  const mapped = geologyFrom('LITHO_1M_SIMPLIFIEE', { properties: containing.map(record => record.properties) });
  if (!mapped) return null;
  const scale = '1:1,000,000';
  return {
    id: 'fr-brgm-geology-site',
    category: 'BRGM Geological Map',
    claim: `BRGM WFS returned national-scale mapped lithological information from a polygon containing the site coordinate in ${typeName} (${scale}).`,
    status: 'VERIFIED',
    sourceName: BRGM,
    sourceUrl: endpointUrl,
    datasetDate: today(),
    spatialRelationship: 'Exact site coordinate contained by the returned official BRGM lithological polygon',
    calculationMethod: 'BRGM InfoTerre WFS 1.0 feature-type discovery, tightly bounded GetFeature query, and explicit point-in-polygon filtering after detailed WMS products returned no usable attributes',
    confidence: 'Medium',
    value: { ...mapped, queriedLayer: baseLayerName(typeName), queriedFeatureType: typeName, scale, evidenceTier: 3, acquisitionMode: 'WFS', resolverProvenance: resolution.provenance },
    limitation: 'This is official national-scale lithological mapping at 1:1,000,000. It is a regional screening fallback, not a 1:50,000 geological formation map, and it does not establish layer thickness, density/state, groundwater level or engineering design parameters beneath the parcel.',
    resolverProvenance: resolution.provenance || undefined,
    spatialScope: 'SITE'
  };
}

async function queryGeology(lat: number, lng: number, fetcher: FetchLike): Promise<FranceSiteEvidence> {
  const resolution = await resolveWms(fetcher, 'FR_BRGM_GEOLOGY');
  if (!resolution.endpoint) {
    const reasonCode = reasonForResolution(resolution);
    return { id: 'fr-brgm-geology-unavailable', category: 'BRGM Geological Map', claim: 'BRGM geological-map service could not be validated at analysis time.', status: 'REQUIRES_VERIFICATION', sourceName: BRGM, sourceUrl: 'https://infoterre.brgm.fr/', datasetDate: today(), spatialRelationship: 'Site coordinate', calculationMethod: 'Approved-source resolver with OGC WMS capability validation', confidence: 'Low', value: { reasonCode, attempts: resolution.attempts }, limitation: 'Source failure is not evidence that geological information is absent.', reasonCode };
  }

  const advertisedLayers = (resolution.probe?.payload as { layers?: string[] } | undefined)?.layers || [];
  const layers = advertisedLayers.filter(layer => geologyLayerRank(layer) < 99).sort((a, b) => geologyLayerRank(a) - geologyLayerRank(b));
  const detailedAndRegional = layers.filter(layer => geologyLayerRank(layer) <= 4);

  for (const layer of detailedAndRegional) {
    const info = await wmsInfo(fetcher, resolution.endpoint.url, layer, lat, lng);
    const mapped = geologyFrom(layer, info);
    if (!mapped) continue;
    const scale = scaleForLayer(layer);
    const tier = tierForLayer(layer);
    return {
      id: 'fr-brgm-geology-site', category: 'BRGM Geological Map',
      claim: `BRGM returned mapped geological information at the site coordinate from layer ${baseLayerName(layer)}${scale ? ` (${scale})` : ''}.`,
      status: 'VERIFIED', sourceName: BRGM, sourceUrl: resolution.endpoint.url, datasetDate: today(), spatialRelationship: 'Exact site-centre map intersection',
      calculationMethod: 'BRGM InfoTerre OGC WMS layer discovery and multi-format GetFeatureInfo; exact detailed/harmonised products are attempted before regional and vector lithological fallback',
      confidence: tier === 1 ? 'High' : 'Medium',
      value: { ...mapped, queriedLayer: baseLayerName(layer), scale, evidenceTier: tier, acquisitionMode: 'WMS', availableLayers: advertisedLayers.slice(0, 100), resolverProvenance: resolution.provenance },
      limitation: `${scale || 'Published-scale'} mapped geological evidence is screening context. It does not establish layer thickness, density/state, groundwater level or engineering design parameters beneath the parcel.`,
      resolverProvenance: resolution.provenance || undefined, spatialScope: 'SITE'
    };
  }

  // BRGM documents WFS as the download/feature route. The simplified 1:1M
  // lithology layer returns attributed vector features and is a more reliable
  // fallback than repeatedly interrogating raster/catalogue WMS layers.
  const wfsFallback = await queryWfsLithologyFallback(lat, lng, fetcher, resolution.endpoint.url, resolution);
  if (wfsFallback) return wfsFallback;

  // Keep WMS LITHO_1M_SIMPLIFIEE as a final official route in case the WFS is
  // temporarily unavailable but GetFeatureInfo is functioning.
  const lithologyWms = layers.find(layer => geologyLayerRank(layer) === 5);
  if (lithologyWms) {
    const info = await wmsInfo(fetcher, resolution.endpoint.url, lithologyWms, lat, lng);
    const mapped = geologyFrom(lithologyWms, info);
    if (mapped) {
      return {
        id: 'fr-brgm-geology-site', category: 'BRGM Geological Map',
        claim: 'BRGM returned national-scale mapped lithological information from LITHO_1M_SIMPLIFIEE (1:1,000,000).',
        status: 'VERIFIED', sourceName: BRGM, sourceUrl: resolution.endpoint.url, datasetDate: today(), spatialRelationship: 'Exact site-centre map intersection',
        calculationMethod: 'BRGM InfoTerre WMS GetFeatureInfo used as final fallback after detailed/regional WMS and WFS lithology routes',
        confidence: 'Medium',
        value: { ...mapped, queriedLayer: baseLayerName(lithologyWms), scale: '1:1,000,000', evidenceTier: 3, acquisitionMode: 'WMS', availableLayers: advertisedLayers.slice(0, 100), resolverProvenance: resolution.provenance },
        limitation: 'This is official national-scale lithological mapping at 1:1,000,000. It is regional screening context and does not establish a detailed geological formation, layer thickness, density/state, groundwater level or engineering design parameters beneath the parcel.',
        resolverProvenance: resolution.provenance || undefined, spatialScope: 'SITE'
      };
    }
  }

  const reasonCode: AvailabilityReason = 'NO_DATA';
  return { id: 'fr-brgm-geology-no-data', category: 'BRGM Geological Map', claim: 'BRGM geology services were reachable, but no usable geological attributes were returned from the detailed/regional WMS routes or the official 1:1,000,000 lithology fallback.', status: 'REQUIRES_VERIFICATION', sourceName: BRGM, sourceUrl: resolution.endpoint.url, datasetDate: today(), spatialRelationship: 'Exact site-centre map and tightly bounded vector queries', calculationMethod: 'BRGM OGC WMS layer discovery/GetFeatureInfo plus WFS LITHO_1M_SIMPLIFIEE fallback', confidence: 'Low', value: { reasonCode, availableLayers: advertisedLayers.slice(0, 100), resolverProvenance: resolution.provenance }, limitation: 'No returned geological attributes are not evidence of geological absence. SoilGrids may still provide separately labelled near-surface soil context.', reasonCode, resolverProvenance: resolution.provenance || undefined, spatialScope: 'SITE' };
}

function bssIdentifier(props: Record<string, string>): string | null {
  return pick(props, [/code.*bss/i, /indice.*bss/i, /^bss/i, /ident/i, /numero/i, /numéro/i, /reference/i, /référence/i]);
}

function bssDescriptor(props: Record<string, string>): string | null {
  const values = Object.entries(props)
    .filter(([key]) => /nature|ouvrage|forage|sondage|profondeur|profond|litho|strat|description|type/i.test(key))
    .map(([, value]) => clean(value)).filter((value): value is string => Boolean(value));
  return [...new Set(values)].slice(0, 3).join(' · ') || null;
}

async function queryBss(lat: number, lng: number, fetcher: FetchLike): Promise<FranceSiteEvidence> {
  const resolution = await resolveWms(fetcher, 'FR_BRGM_BSS');
  if (!resolution.endpoint) {
    const reasonCode = reasonForResolution(resolution);
    return { id: 'fr-brgm-bss-unavailable', category: 'BRGM Banque du Sous-Sol (BSS)', claim: 'BRGM BSS source route could not be validated.', status: 'REQUIRES_VERIFICATION', sourceName: BRGM, sourceUrl: 'https://infoterre.brgm.fr/', datasetDate: today(), spatialRelationship: 'Vicinity of site coordinate', calculationMethod: 'Approved-source resolver with OGC service validation', confidence: 'Low', value: { reasonCode, attempts: resolution.attempts }, limitation: 'Source failure is not evidence that boreholes or underground works are absent.', reasonCode, spatialScope: 'VICINITY' };
  }
  const { types } = await wfsCapabilities(fetcher, resolution.endpoint.url);
  const typeName = types.find(name => /BSS.*TOTAL.*LABEL/i.test(name)) || types.find(name => /BSS/i.test(name)) || null;
  if (!typeName) {
    const reasonCode: AvailabilityReason = 'SOURCE_UNAVAILABLE';
    return { id: 'fr-brgm-bss-unavailable', category: 'BRGM Banque du Sous-Sol (BSS)', claim: 'BRGM geology service was reachable, but a queryable BSS WFS feature type was not validated.', status: 'REQUIRES_VERIFICATION', sourceName: BRGM, sourceUrl: resolution.endpoint.url, datasetDate: today(), spatialRelationship: 'Vicinity of site coordinate', calculationMethod: 'WFS capability discovery', confidence: 'Low', value: { reasonCode, availableFeatureTypes: types.slice(0, 100) }, limitation: 'This does not establish that no BSS record exists near the site.', reasonCode, resolverProvenance: resolution.provenance || undefined, spatialScope: 'VICINITY' };
  }
  const records = await wfsBbox(fetcher, resolution.endpoint.url, typeName, lat, lng, 0.05, 20);
  const normalized = records.map(record => ({ identifier: bssIdentifier(record.properties), descriptor: bssDescriptor(record.properties), distanceKm: record.point ? haversineKm(lat, lng, record.point.lat, record.point.lng) : null, properties: record.properties }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  if (!normalized.length) {
    const reasonCode: AvailabilityReason = 'NO_DATA';
    return { id: 'fr-brgm-bss-no-data', category: 'BRGM Banque du Sous-Sol (BSS)', claim: 'BRGM BSS was queried in the site vicinity but returned no usable record in the tested search envelope.', status: 'REQUIRES_VERIFICATION', sourceName: BRGM, sourceUrl: resolution.endpoint.url, datasetDate: today(), spatialRelationship: 'Approximately 5 km search envelope around site centre', calculationMethod: 'BRGM WFS feature-type discovery and bounded spatial GetFeature query', confidence: 'Low', value: { reasonCode, queriedFeatureType: typeName }, limitation: 'No returned record is not proof that no borehole or underground work exists. InfoTerre and original BSS dossiers should be checked where material to a decision.', reasonCode, resolverProvenance: resolution.provenance || undefined, spatialScope: 'VICINITY' };
  }
  const nearest = normalized[0];
  return { id: 'fr-brgm-bss-context', category: 'BRGM Banque du Sous-Sol (BSS)', claim: `${normalized.length} nearby BSS record(s) were returned${nearest.distanceKm !== null ? `; nearest approximately ${nearest.distanceKm.toFixed(2)} km away` : ''}.`, status: 'VERIFIED', sourceName: BRGM, sourceUrl: resolution.endpoint.url, datasetDate: today(), spatialRelationship: 'Approximately 5 km search envelope around site centre; records are vicinity context only', calculationMethod: 'BRGM WFS feature-type discovery and bounded spatial GetFeature query', confidence: 'Medium', value: { observationCount: normalized.length, nearestDistanceKm: nearest.distanceKm, nearestRecordId: nearest.identifier, observations: normalized.slice(0, 10), queriedFeatureType: typeName }, limitation: 'BSS records are nearby/contextual observations. They do not prove the strata, groundwater conditions or engineering properties beneath the selected parcel.', resolverProvenance: resolution.provenance || undefined, spatialScope: 'VICINITY' };
}

function riskDescriptor(props: Record<string, unknown>): string | null {
  return pick(props, [/alea/i, /aléa/i, /niveau/i, /classe/i, /class/i, /exposition/i, /libell/i, /description/i]);
}

async function queryShrinkSwell(lat: number, lng: number, fetcher: FetchLike): Promise<FranceSiteEvidence> {
  const resolution = await resolveWms(fetcher, 'FR_BRGM_RISKS');
  if (!resolution.endpoint) {
    const reasonCode = reasonForResolution(resolution);
    return { id: 'fr-brgm-shrink-swell-unavailable', category: 'Shrink-swell clay screening', claim: 'BRGM natural-risk source route could not be validated.', status: 'REQUIRES_VERIFICATION', sourceName: `${BRGM} / Géorisques`, sourceUrl: 'https://www.georisques.gouv.fr/', datasetDate: today(), spatialRelationship: 'Site coordinate', calculationMethod: 'Approved-source resolver with OGC service validation', confidence: 'Low', value: { reasonCode, attempts: resolution.attempts }, limitation: 'Source failure is not evidence of low clay shrink-swell exposure.', reasonCode, spatialScope: 'SITE' };
  }
  const layers = (resolution.probe?.payload as { layers?: string[] } | undefined)?.layers || [];
  const layer = layers.find(name => /^ALEARG$/i.test(baseLayerName(name))) || layers.find(name => /RGA|RETRAIT.*GONFL|ARGIL/i.test(name));
  if (!layer) {
    const reasonCode: AvailabilityReason = 'SOURCE_UNAVAILABLE';
    return { id: 'fr-brgm-shrink-swell-unavailable', category: 'Shrink-swell clay screening', claim: 'BRGM risk service was reachable, but a shrink-swell clay layer was not validated.', status: 'REQUIRES_VERIFICATION', sourceName: `${BRGM} / Géorisques`, sourceUrl: resolution.endpoint.url, datasetDate: today(), spatialRelationship: 'Site coordinate', calculationMethod: 'OGC WMS capability discovery', confidence: 'Low', value: { reasonCode, availableLayers: layers.slice(0, 100) }, limitation: 'The absence of a validated automated layer is not a low-risk classification. Check the current Géorisques RGA map.', reasonCode, resolverProvenance: resolution.provenance || undefined, spatialScope: 'SITE' };
  }
  const info = await wmsInfo(fetcher, resolution.endpoint.url, layer, lat, lng);
  const props = mergedProperties(info?.properties || []);
  const descriptor = riskDescriptor(props);
  if (!descriptor) {
    const reasonCode: AvailabilityReason = 'NO_DATA';
    return { id: 'fr-brgm-shrink-swell-no-data', category: 'Shrink-swell clay screening', claim: 'BRGM shrink-swell layer was queried but returned no usable exposure classification at the tested coordinate.', status: 'REQUIRES_VERIFICATION', sourceName: `${BRGM} / Géorisques`, sourceUrl: resolution.endpoint.url, datasetDate: today(), spatialRelationship: 'Exact site-centre map query', calculationMethod: 'OGC WMS GetFeatureInfo', confidence: 'Low', value: { reasonCode, queriedLayer: baseLayerName(layer) }, limitation: 'No returned classification is not evidence of no clay shrink-swell hazard. Check the current statutory/current Géorisques mapping.', reasonCode, resolverProvenance: resolution.provenance || undefined, spatialScope: 'SITE' };
  }
  return { id: 'fr-brgm-shrink-swell-site', category: 'Shrink-swell clay screening', claim: `BRGM/Géorisques shrink-swell clay screening returned: ${descriptor}.`, status: 'VERIFIED', sourceName: `${BRGM} / Géorisques`, sourceUrl: resolution.endpoint.url, datasetDate: today(), spatialRelationship: 'Exact site-centre mapped exposure class', calculationMethod: 'BRGM risk OGC WMS GetFeatureInfo', confidence: 'High', value: { descriptor, queriedLayer: baseLayerName(layer), properties: props }, limitation: 'Mapped shrink-swell exposure is development-screening evidence, not proof of the parcel soil profile or a substitute for the geotechnical study required where applicable.', resolverProvenance: resolution.provenance || undefined, spatialScope: 'SITE' };
}

export async function queryFranceSiteEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<FranceSiteEvidence[]> {
  const [geology, bss, shrinkSwell] = await Promise.all([queryGeology(lat, lng, fetcher), queryBss(lat, lng, fetcher), queryShrinkSwell(lat, lng, fetcher)]);
  return [geology, bss, shrinkSwell];
}

export function enrichGeologyFromBrgm(report: any, evidenceItems: FranceSiteEvidence[]): void {
  const geology = evidenceItems.find(item => item.id === 'fr-brgm-geology-site' && item.status === 'VERIFIED');
  const bss = evidenceItems.find(item => item.id === 'fr-brgm-bss-context' && item.status === 'VERIFIED');
  const shrinkSwell = evidenceItems.find(item => item.id === 'fr-brgm-shrink-swell-site' && item.status === 'VERIFIED');
  if (!geology && !bss && !shrinkSwell) return;
  const mapped = (geology?.value || {}) as { unit?: string | null; lithology?: string | null; age?: string | null; genesis?: string | null; scale?: string | null; evidenceTier?: number };
  const existing = report.geosurvey_context || {};
  report.geosurvey_context = {
    ...existing,
    geological_unit_name: mapped.unit || null,
    lithology_type: mapped.lithology || null,
    geological_period_era: mapped.age || null,
    genetic_origin: mapped.genesis || null,
    evidence_level: geology ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
    evidence_tier: mapped.evidenceTier || null,
    source_name: geology?.sourceName || BRGM,
    source_url: geology?.sourceUrl || 'https://infoterre.brgm.fr/',
    source_scale: mapped.scale || null,
    fr_bss_context: bss?.value || null,
    fr_shrink_swell_context: shrinkSwell?.value || null
  };
}
