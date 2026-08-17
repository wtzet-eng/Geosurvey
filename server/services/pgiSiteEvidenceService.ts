export interface PgiSiteEvidence {
  id: string;
  category: string;
  claim: string;
  status: 'VERIFIED' | 'REQUIRES_VERIFICATION' | 'UNAVAILABLE';
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  spatialRelationship: string;
  calculationMethod: string;
  confidence: 'High' | 'Medium' | 'Low';
  value: unknown;
  limitation: string;
}

const OGC_API = 'https://ogcapi.pgi.gov.pl';
const SOURCE = 'Państwowy Instytut Geologiczny – PIB';

async function fetchJson(url: string, timeoutMs = 7000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'GeoSurvey/1.0 evidence extraction', Accept: 'application/json' }, signal: controller.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
  finally { clearTimeout(timer); }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findCollection(pattern: RegExp): Promise<any | null> {
  const data = await fetchJson(`${OGC_API}/collections`);
  const collections = data?.collections || [];
  return collections.find((c: any) => pattern.test(`${c.id || ''} ${c.title || ''}`)) || null;
}

export async function queryPolandBoreholes(lat: number, lng: number, radiusKm = 2): Promise<PgiSiteEvidence[]> {
  const collection = await findCollection(/odwiert|borehole/i);
  if (!collection) return [{ id: 'pgi-boreholes-unavailable', category: 'Boreholes', claim: 'PIG-PIB OGC API borehole collection could not be discovered.', status: 'UNAVAILABLE', sourceName: SOURCE, sourceUrl: `${OGC_API}/collections`, datasetDate: new Date().toISOString().slice(0, 10), spatialRelationship: 'Within requested search radius', calculationMethod: 'OGC API Features collection discovery', confidence: 'Low', value: null, limitation: 'No conclusion about absence of boreholes can be drawn.' }];

  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));
  const bbox = `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
  const url = `${OGC_API}/collections/${encodeURIComponent(collection.id)}/items?bbox=${bbox}&limit=100`;
  const data = await fetchJson(url, 10000);
  const features = data?.features || [];
  const results = features.map((f: any, i: number) => {
    const coords = f?.geometry?.coordinates;
    const flng = Array.isArray(coords) ? Number(coords[0]) : NaN;
    const flat = Array.isArray(coords) ? Number(coords[1]) : NaN;
    const distanceKm = Number.isFinite(flng) && Number.isFinite(flat) ? haversineKm(lat, lng, flat, flng) : null;
    return { feature: f, distanceKm, index: i };
  }).filter((x: any) => x.distanceKm === null || x.distanceKm <= radiusKm).sort((a: any, b: any) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999)).slice(0, 20);

  return results.map((x: any) => ({
    id: `pgi-borehole-${x.feature.id ?? x.index}`,
    category: 'Boreholes',
    claim: `PIG-PIB borehole record identified${x.distanceKm !== null ? ` ${x.distanceKm.toFixed(2)} km from the site centre` : ''}.`,
    status: 'VERIFIED' as const,
    sourceName: SOURCE,
    sourceUrl: url,
    datasetDate: new Date().toISOString().slice(0, 10),
    spatialRelationship: x.distanceKm !== null ? `${x.distanceKm.toFixed(2)} km from site centre` : `Within ${radiusKm} km search window`,
    calculationMethod: 'PIG-PIB OGC API Features spatial query',
    confidence: x.distanceKm !== null && x.distanceKm < 0.5 ? 'High' as const : 'Medium' as const,
    value: { featureId: x.feature.id, properties: x.feature.properties, coordinates: x.feature.geometry?.coordinates, distanceKm: x.distanceKm, collection: collection.id },
    limitation: 'A nearby borehole is supporting regional evidence; its lithological and groundwater observations must be interpreted from the original record before being treated as site-specific conditions.'
  }));
}

async function wmsGetInfo(serviceUrl: string, layer: string, lat: number, lng: number): Promise<any | null> {
  const delta = 0.0008;
  const params = new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo', LAYERS: layer, QUERY_LAYERS: layer, CRS: 'CRS:84', BBOX: `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`, WIDTH: '101', HEIGHT: '101', I: '50', J: '50', INFO_FORMAT: 'application/json', FEATURE_COUNT: '5' });
  return fetchJson(`${serviceUrl}?${params.toString()}`, 6000);
}

async function wmsLayers(serviceUrl: string): Promise<string[]> {
  const xml = await (async () => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 7000);
    try { const r = await fetch(`${serviceUrl}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`, { headers: { 'User-Agent': 'GeoSurvey/1.0 evidence extraction' }, signal: controller.signal }); return r.ok ? await r.text() : ''; } catch { return ''; } finally { clearTimeout(timer); }
  })();
  const out: string[] = []; const seen = new Set<string>();
  const re = /<(?:Layer|wms:Layer)[^>]*>[\s\S]*?<Name>([^<]+)<\/Name>/gi; let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) { const n = m[1].trim(); if (n && !seen.has(n)) { seen.add(n); out.push(n); } }
  return out;
}

export async function queryPolandGeologicalMaps(lat: number, lng: number): Promise<PgiSiteEvidence[]> {
  const maps = [
    { id: 'smgp-50k', title: 'Detailed Geological Map of Poland (SMGP)', scale: '1:50,000', url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/smgp50k/MapServer/WMSServer' },
    { id: 'mlp-50k', title: 'Lithogenetic Map of Poland (MLP)', scale: '1:50,000', url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/mlp50k/MapServer/WMSServer' },
    { id: 'mgp-200k', title: 'Geological Map of Poland (MGP)', scale: '1:200,000', url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/mgp200k_a/MapServer/WMSServer' },
    { id: 'engineering-50k', title: 'Detailed Engineering-Geological Map of Poland', scale: '1:50,000', url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/geoinz/smgip50k/MapServer/WMSServer' }
  ];
  const evidence: PgiSiteEvidence[] = [];
  for (const map of maps) {
    const layers = await wmsLayers(map.url);
    if (!layers.length) { evidence.push({ id: `pgi-${map.id}-unavailable`, category: map.title, claim: `${map.title}: WMS service could not be queried.`, status: 'UNAVAILABLE', sourceName: SOURCE, sourceUrl: map.url, datasetDate: new Date().toISOString().slice(0, 10), spatialRelationship: 'Site coordinate', calculationMethod: 'WMS GetCapabilities', confidence: 'Low', value: null, limitation: 'Service failure is not evidence of absence.' }); continue; }
    let info: any = null; let selectedLayer = '';
    for (const layer of layers.slice(0, 12)) { const candidate = await wmsGetInfo(map.url, layer, lat, lng); if (candidate && (candidate.features?.length || candidate.FeatureInfo?.length || Object.keys(candidate).length)) { info = candidate; selectedLayer = layer; break; } }
    evidence.push({ id: `pgi-${map.id}-site`, category: map.title, claim: info ? `${map.title}: site coordinate returned map feature information.` : `${map.title}: map service is available, but no feature information was returned at the tested coordinate.`, status: info ? 'VERIFIED' : 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: map.url, datasetDate: new Date().toISOString().slice(0, 10), spatialRelationship: 'Exact site centre queried', calculationMethod: 'OGC WMS GetFeatureInfo at site coordinate', confidence: info ? 'Medium' : 'Low', value: { scale: map.scale, queriedLayer: selectedLayer || null, featureInfo: info }, limitation: info ? 'Raster/map-service interpretation is desktop evidence and should be verified against the map sheet, explanatory text and site investigation.' : 'A reachable map service without returned feature information does not establish the geological unit.' });
  }
  return evidence;
}

export async function queryPolandSiteEvidence(lat: number, lng: number): Promise<PgiSiteEvidence[]> {
  const [maps, boreholes] = await Promise.all([queryPolandGeologicalMaps(lat, lng), queryPolandBoreholes(lat, lng, 2)]);
  return [...maps, ...boreholes];
}
