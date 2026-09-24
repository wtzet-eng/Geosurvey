import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyMvGroundEvidenceResult {
  state: 'Mecklenburg-Vorpommern';
  evidence: EvidenceItem[];
  geologyFound: boolean;
  boreholeCount: number;
}

const GEOLOGY_WFS = 'https://www.umweltkarten.mv-regierung.de/script/mv_a7_geol_karten_wfs.php';
const BOREHOLE_WFS = 'https://umweltkarten.lung-mv.de/dienste/gg_lbds';
const GEO_SOURCE = 'LUNG M-V — Geologische Karte (GK 50) 1:50.000';
const BOREHOLE_SOURCE = 'LUNG M-V — Landesbohrdatenspeicher (LBDS)';
const STATE = 'Mecklenburg-Vorpommern' as const;
const NATIVE_CRS = 'EPSG:5650';
const today = () => new Date().toISOString().slice(0, 10);

function clean(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}
function numberValue(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// EPSG:5650 is the M-V ETRS89 / UTM 33N variant with the EPSG:5650 false easting of 33.5 million m.
// WGS84 and ETRS89 are sufficiently coincident for this bounded screening query.
export function toGermanyMvNative(lat: number, lng: number): [number, number] {
  const a = 6378137;
  const eccSquared = 0.006694380023;
  const k0 = 0.9996;
  const eccPrimeSquared = eccSquared / (1 - eccSquared);
  const latRad = lat * Math.PI / 180;
  const lonRad = lng * Math.PI / 180;
  const lonOrigin = 15 * Math.PI / 180;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);
  const n = a / Math.sqrt(1 - eccSquared * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = eccPrimeSquared * cosLat * cosLat;
  const aa = cosLat * (lonRad - lonOrigin);
  const m = a * ((1 - eccSquared / 4 - 3 * eccSquared ** 2 / 64 - 5 * eccSquared ** 3 / 256) * latRad
    - (3 * eccSquared / 8 + 3 * eccSquared ** 2 / 32 + 45 * eccSquared ** 3 / 1024) * Math.sin(2 * latRad)
    + (15 * eccSquared ** 2 / 256 + 45 * eccSquared ** 3 / 1024) * Math.sin(4 * latRad)
    - (35 * eccSquared ** 3 / 3072) * Math.sin(6 * latRad));
  const easting = k0 * n * (aa + (1 - t + c) * aa ** 3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * eccPrimeSquared) * aa ** 5 / 120) + 33500000;
  const northing = k0 * (m + n * tanLat * (aa ** 2 / 2 + (5 - t + 9 * c + 4 * c * c) * aa ** 4 / 24 + (61 - 58 * t + t * t + 600 * c - 330 * eccPrimeSquared) * aa ** 6 / 720));
  return [easting, northing];
}

function pointInRing(x: number, y: number, ring: [number, number][]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

function extractPosLists(block: string): [number, number][][] {
  return [...block.matchAll(/<gml:posList[^>]*>([^<]+)<\/gml:posList>/g)].map(match => {
    const values = match[1].trim().split(/\s+/).map(Number);
    const ring: [number, number][] = [];
    for (let i = 0; i + 1 < values.length; i += 2) {
      if (Number.isFinite(values[i]) && Number.isFinite(values[i + 1])) ring.push([values[i], values[i + 1]]);
    }
    return ring;
  }).filter(ring => ring.length >= 3);
}

function featureBlocks(xml: string): string[] {
  return [...xml.matchAll(/<gml:featureMember>([\s\S]*?)<\/gml:featureMember>/g)].map(match => match[1]);
}

function field(block: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return clean(block.match(new RegExp(`<(?:qgs|ms):${escaped}>([^<]*)<\\/(?:qgs|ms):${escaped}>`, 'i'))?.[1]);
}

function noData(id: string, claim: string, sourceName: string, sourceUrl: string, reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA'): EvidenceItem {
  return {
    id,
    category: 'Regional geology & ground evidence',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName,
    sourceUrl,
    datasetDate: today(),
    spatialRelationship: 'Selected site coordinate within Mecklenburg-Vorpommern',
    calculationMethod: 'State-specific WFS acquisition in native EPSG:5650; failed acquisition does not support a negative finding',
    confidence: 'Low',
    limitation: 'No absence is inferred from an empty, unavailable or structurally invalid service response. Confirm the current official record with LUNG M-V where necessary.',
    value: { reasonCode }
  };
}

async function fetchXml(url: string, fetcher: typeof fetch): Promise<{ ok: boolean; xml?: string; status?: number }> {
  try {
    const response = await fetcher(url, { headers: { Accept: 'text/xml, application/gml+xml', 'User-Agent': 'LandSurf/1.0 M-V regional evidence' } });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, xml: await response.text() };
  } catch {
    return { ok: false };
  }
}

async function queryMvGeology(lat: number, lng: number, fetcher: typeof fetch): Promise<EvidenceItem> {
  const [x, y] = toGermanyMvNative(lat, lng);
  const radius = 400;
  let lastNoData: EvidenceItem | null = null;
  for (const layer of ['t7_gk50_so', 't7_gk50_su']) {
    const params = new URLSearchParams({ SERVICE: 'WFS', VERSION: '1.1.0', REQUEST: 'GetFeature', TYPENAME: layer, SRSNAME: NATIVE_CRS, BBOX: `${x - radius},${y - radius},${x + radius},${y + radius}`, MAXFEATURES: '8' });
    const url = `${GEOLOGY_WFS}?${params.toString()}`;
    const response = await fetchXml(url, fetcher);
    if (!response.ok) return noData('de-mv-geology-unavailable', `The official Mecklenburg-Vorpommern GK50 geology service could not be reached${response.status ? ` (HTTP ${response.status})` : ''}.`, GEO_SOURCE, url, 'SOURCE_UNAVAILABLE');
    if (!response.xml) return noData('de-mv-geology-malformed', 'The official Mecklenburg-Vorpommern GK50 geology service returned no readable response.', GEO_SOURCE, url, 'MALFORMED_DATA');
    if (/<(?:ows:)?Exception/i.test(response.xml)) return noData('de-mv-geology-malformed', 'The official Mecklenburg-Vorpommern GK50 geology service returned an error response; no geological value was inferred.', GEO_SOURCE, url, 'MALFORMED_DATA');
    const blocks = featureBlocks(response.xml);
    const selected = blocks.find(block => extractPosLists(block).some(ring => pointInRing(x, y, ring)));
    if (!selected) {
      lastNoData = noData('de-mv-geology-no-data', 'The official Mecklenburg-Vorpommern GK50 service returned no mapped polygon containing the selected coordinate in this query.', GEO_SOURCE, url, 'NO_DATA');
      continue;
    }
    const suffix = layer === 't7_gk50_so' ? 'surface' : 'underlying';
    const unit = field(selected, 'STRAT_1') || field(selected, 'Legende_AL') || field(selected, 'Geo1_allge');
    const lithology = field(selected, 'PETH_1') || field(selected, 'Geo2_allge');
    const period = field(selected, 'PETN_1') || field(selected, 'Zeit_1');
    const genesis = field(selected, 'GENESE_1');
    if (!unit && !lithology && !period && !genesis) return noData('de-mv-geology-malformed', 'The official Mecklenburg-Vorpommern GK50 service returned a polygon, but no usable geological attributes could be validated.', GEO_SOURCE, url, 'MALFORMED_DATA');
    const claim = `The official Mecklenburg-Vorpommern GK50 (1:50,000) ${suffix} map places the selected coordinate in ${unit || lithology || 'a mapped geological unit'}${lithology && lithology !== unit ? ` (${lithology})` : ''}${period ? `; mapped age context: ${period}` : ''}${genesis ? `; genesis: ${genesis}` : ''}.`;
    return {
      id: 'de-mv-geology-gk50', category: 'Regional geology & ground evidence', claim, status: 'VERIFIED', sourceName: GEO_SOURCE, sourceUrl: url, datasetDate: today(),
      spatialRelationship: 'Selected coordinate is contained by the returned GK50 polygon',
      calculationMethod: `LUNG M-V WFS 1.1.0 ${layer} query in EPSG:5650 followed by point-in-polygon selection; mapped scale 1:50,000`, confidence: 'High',
      limitation: 'Mapped geology is regional screening evidence. It does not establish parcel-scale stratigraphy, thickness, groundwater conditions or engineering parameters; ground investigation remains required.',
      value: { geologicalUnit: unit, lithology, geologicalAge: period, geneticOrigin: genesis, scale: '1:50,000', layer, crs: NATIVE_CRS }
    };
  }
  return lastNoData || noData('de-mv-geology-no-data', 'The official Mecklenburg-Vorpommern GK50 service returned no mapped polygon containing the selected coordinate.', GEO_SOURCE, GEOLOGY_WFS, 'NO_DATA');
}

function parseBoreholes(xml: string, x: number, y: number) {
  return featureBlocks(xml).flatMap(block => {
    const pos = block.match(/<(?:gml:)?pos[^>]*>([^<]+)<\/(?:gml:)?pos>/i)?.[1]?.trim().split(/\s+/).map(Number) || [];
    if (!Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) return [];
    const distance = Math.hypot(pos[0] - x, pos[1] - y);
    return [{
      distanceM: Math.round(distance), name: field(block, 'LONGNAME'), id: field(block, 'BO_IDENT'), endDepthM: numberValue(field(block, 'ZCOORDE')),
      startElevationM: numberValue(field(block, 'ZCOORDB')), purpose: field(block, 'BRGZWECK'), year: field(block, 'YRFROMNAME'),
      stratigraphy: field(block, 'STRAT_EH'), security: field(block, 'DATSICHERH'), logAvailable: field(block, 'SVB'), logUrl: field(block, 'SVZ_URL'),
      project: field(block, 'PROJEKT')
    }];
  }).sort((a, b) => a.distanceM - b.distanceM);
}

async function queryMvBoreholes(lat: number, lng: number, fetcher: typeof fetch): Promise<EvidenceItem> {
  const [x, y] = toGermanyMvNative(lat, lng);
  const radius = 1500;
  const params = new URLSearchParams({ SERVICE: 'WFS', VERSION: '1.1.0', REQUEST: 'GetFeature', TYPENAME: 'bohrdaten', SRSNAME: NATIVE_CRS, BBOX: `${x - radius},${y - radius},${x + radius},${y + radius}`, MAXFEATURES: '30' });
  const url = `${BOREHOLE_WFS}?${params.toString()}`;
  const response = await fetchXml(url, fetcher);
  if (!response.ok) return noData('de-mv-boreholes-unavailable', `The Mecklenburg-Vorpommern Landesbohrdatenspeicher could not be reached${response.status ? ` (HTTP ${response.status})` : ''}.`, BOREHOLE_SOURCE, url, 'SOURCE_UNAVAILABLE');
  if (!response.xml) return noData('de-mv-boreholes-malformed', 'The Mecklenburg-Vorpommern Landesbohrdatenspeicher returned no readable response.', BOREHOLE_SOURCE, url, 'MALFORMED_DATA');
  if (/<(?:ows:)?Exception/i.test(response.xml)) return noData('de-mv-boreholes-malformed', 'The Mecklenburg-Vorpommern Landesbohrdatenspeicher returned an error response; no borehole evidence was inferred.', BOREHOLE_SOURCE, url, 'MALFORMED_DATA');
  const boreholes = parseBoreholes(response.xml, x, y);
  if (!boreholes.length) return noData('de-mv-boreholes-no-data', 'The Mecklenburg-Vorpommern Landesbohrdatenspeicher returned no borehole within the 1.5 km screening radius.', BOREHOLE_SOURCE, url, 'NO_DATA');
  const nearest = boreholes.slice(0, 5);
  const descriptions = nearest.map(item => [item.name, `${item.distanceM} m`, item.endDepthM !== null ? `${item.endDepthM} m depth` : null, item.purpose, item.year].filter(Boolean).join(' — '));
  return {
    id: 'de-mv-boreholes-lbds', category: 'Regional geology & ground evidence',
    claim: `The official Mecklenburg-Vorpommern Landesbohrdatenspeicher contains ${boreholes.length} borehole record${boreholes.length === 1 ? '' : 's'} within 1.5 km of the selected coordinate; the nearest records include ${descriptions.join('; ')}.`,
    status: 'VERIFIED', sourceName: BOREHOLE_SOURCE, sourceUrl: url, datasetDate: today(),
    spatialRelationship: `${boreholes.length} registered borehole observations within 1.5 km; nearest ${nearest[0].distanceM} m`,
    calculationMethod: 'LUNG M-V WFS 1.1.0 bohrdaten query in EPSG:5650; straight-line distance from the selected coordinate; nearest records retained as contextual evidence', confidence: 'High',
    limitation: 'Nearby boreholes are contextual observations, not parcel-specific ground truth. Depth, logs and stratigraphy vary by borehole; absence of a nearby record does not establish absence of subsurface conditions. Engineering parameters must be established by site investigation.',
    value: { count: boreholes.length, radiusM: radius, nearest, sourceCrs: NATIVE_CRS }
  };
}

export async function queryGermanyMvGroundEvidence(lat: number, lng: number, state: string | null | undefined, fetcher: typeof fetch = fetch): Promise<GermanyMvGroundEvidenceResult> {
  const normalized = String(state || '').trim().toLowerCase();
  const stateOk = normalized === 'mecklenburg-vorpommern' || normalized === 'mecklenburg-western pomerania' || normalized === 'mecklenburg-vorpommern, deutschland' || !normalized;
  if (!stateOk) {
    return { state: STATE, geologyFound: false, boreholeCount: 0, evidence: [] };
  }
  const [geology, boreholes] = await Promise.all([queryMvGeology(lat, lng, fetcher), queryMvBoreholes(lat, lng, fetcher)]);
  const boreholeCount = boreholes.status === 'VERIFIED' && typeof (boreholes.value as any)?.count === 'number' ? Number((boreholes.value as any).count) : 0;
  return { state: STATE, geologyFound: geology.status === 'VERIFIED', boreholeCount, evidence: [geology, boreholes] };
}

export function enrichGermanyMvGroundEvidence(report: VerifiedSiteReport & Record<string, any>, result: GermanyMvGroundEvidenceResult): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...result.evidence);
  const geology = result.evidence.find(item => item.id === 'de-mv-geology-gk50' && item.status === 'VERIFIED');
  if (!geology) return;
  const value = (geology.value || {}) as Record<string, unknown>;
  report.geosurvey_context = {
    ...(report.geosurvey_context || {}),
    geological_unit_name: value.geologicalUnit || value.lithology || null,
    lithology_type: value.lithology || null,
    geological_period_era: value.geologicalAge || null,
    genetic_origin: value.geneticOrigin || null,
    survey_authority: GEO_SOURCE,
    source_name: GEO_SOURCE,
    source_url: geology.sourceUrl,
    evidence_level: 'VERIFIED'
  };
  if (report.evidenceScore?.breakdown?.geologyAndGroundwater) {
    report.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(18, Number(report.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
    report.evidenceScore.breakdown.geologyAndGroundwater.rationale = 'Verified Mecklenburg-Vorpommern GK50 regional geology is available at the selected coordinate; nearby LBDS boreholes are retained as contextual evidence without turning them into parcel-specific engineering parameters.';
  }
}

export const GERMANY_MV_SOURCES = {
  geologyWfs: GEOLOGY_WFS,
  boreholeWfs: BOREHOLE_WFS,
  nativeCrs: NATIVE_CRS
};
