import { EvidenceItem } from '../types';

export type SwedenGroundEvidence = EvidenceItem;
type FetchLike = typeof fetch;

const SGU = 'Sveriges geologiska undersökning (SGU)';
const SURFACE_DETAIL = 'https://api.sgu.se/oppnadata/jordarter25k-100k/ogc/features/v1/collections/grundlager/items';
const SURFACE_NORTH = 'https://api.sgu.se/oppnadata/jordarter250k/ogc/features/v1/collections/grundlager/items';
const BEDROCK = 'https://api.sgu.se/oppnadata/berggrund50k-250k/ogc/features/v1/collections/geologisk-enhet-yta/items';
const WELLS = 'https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items';
const GROUNDWATER_STATIONS = 'https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/stationer/items';
const PORTAL = 'https://www.sgu.se/produkter-och-tjanster/geologiska-data/';
const CRS84 = 'http://www.opengis.net/def/crs/OGC/1.3/CRS84';
const today = () => new Date().toISOString().slice(0, 10);

function bbox(lat: number, lng: number, radiusM: number): string {
  const dLat = radiusM / 111_320;
  const cosLat = Math.max(0.2, Math.cos(lat * Math.PI / 180));
  const dLng = radiusM / (111_320 * cosLat);
  return `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
}

function queryUrl(base: string, lat: number, lng: number, radiusM: number, limit: number): string {
  const params = new URLSearchParams({
    bbox: bbox(lat, lng, radiusM),
    'bbox-crs': CRS84,
    crs: CRS84,
    limit: String(limit),
    f: 'json'
  });
  return `${base}?${params}`;
}

async function fetchFeatures(fetcher: FetchLike, url: string, timeoutMs = 8000): Promise<any[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/geo+json, application/json', 'User-Agent': 'GeoSurvey/1.0 Sweden SGU evidence' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const json: any = await response.json();
    return Array.isArray(json?.features) ? json.features : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function props(feature: any): Record<string, unknown> {
  return feature?.properties && typeof feature.properties === 'object' ? feature.properties : {};
}

function text(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned || /^null[:\s]/i.test(cleaned)) return null;
  return cleaned;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function dateFrom(properties: Record<string, unknown>): string {
  return text(properties.rev_dat) || text(properties.lastupdate) || text(properties.borrdatum) || text(properties.nivadatum) || text(properties.tdat) || today();
}

function unavailable(id: string, category: string, sourceUrl: string, claim: string, reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA' = 'NO_DATA'): SwedenGroundEvidence {
  return {
    id,
    category,
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName: SGU,
    sourceUrl,
    datasetDate: today(),
    spatialRelationship: 'Selected site / search vicinity',
    calculationMethod: 'SGU OGC API Features spatial query in OGC CRS84',
    confidence: 'Low',
    limitation: 'An empty or failed API query is not evidence that the relevant geological or groundwater condition is absent. Check SGU Map Viewer and original records, and commission site-specific investigation where material to a decision.',
    value: { reasonCode }
  };
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointCoordinates(feature: any): [number, number] | null {
  if (String(feature?.geometry?.type) !== 'Point' || !Array.isArray(feature?.geometry?.coordinates)) return null;
  const lng = numberValue(feature.geometry.coordinates[0]);
  const lat = numberValue(feature.geometry.coordinates[1]);
  return lat !== null && lng !== null ? [lat, lng] : null;
}

async function querySurfaceGeology(lat: number, lng: number, fetcher: FetchLike): Promise<SwedenGroundEvidence> {
  const detailedUrl = queryUrl(SURFACE_DETAIL, lat, lng, 12, 5);
  let features = await fetchFeatures(fetcher, detailedUrl);
  let sourceUrl = detailedUrl;
  let scale = '1:25 000–1:100 000';
  let sourceDataset = 'Jordarter 1:25 000–1:100 000';

  if (features !== null && features.length === 0 && lat >= 65) {
    const northernUrl = queryUrl(SURFACE_NORTH, lat, lng, 12, 5);
    const northern = await fetchFeatures(fetcher, northernUrl);
    if (northern === null) return unavailable('se-sgu-surface-geology-unavailable', 'Mapped superficial geology', northernUrl, 'SGU superficial-deposit mapping could not be queried.', 'SOURCE_UNAVAILABLE');
    if (northern.length) {
      features = northern;
      sourceUrl = northernUrl;
      scale = '1:250 000';
      sourceDataset = 'Jordarter 1:250 000, nordligaste Sverige';
    }
  }

  if (features === null) return unavailable('se-sgu-surface-geology-unavailable', 'Mapped superficial geology', sourceUrl, 'SGU superficial-deposit mapping could not be queried.', 'SOURCE_UNAVAILABLE');
  if (!features.length) return unavailable('se-sgu-surface-geology-no-data', 'Mapped superficial geology', sourceUrl, 'SGU returned no mapped superficial-deposit polygon at the selected location.');
  const p = props(features[0]);
  const deposit = text(p.jg2_tx) || text(p.jordart_tx);
  if (!deposit) return unavailable('se-sgu-surface-geology-malformed', 'Mapped superficial geology', sourceUrl, 'SGU returned a superficial-deposit polygon without a readable material class.', 'MALFORMED_DATA');

  return {
    id: 'se-sgu-surface-geology',
    category: 'Mapped superficial geology',
    claim: `SGU ${sourceDataset} maps the near-surface material at the selected location as ${deposit}.`,
    status: 'VERIFIED',
    sourceName: `${SGU} — ${sourceDataset}`,
    sourceUrl,
    datasetDate: dateFrom(p),
    spatialRelationship: 'Published superficial-deposit polygon intersecting the selected coordinate vicinity',
    calculationMethod: `SGU OGC API Features query of grundlager in CRS84; published mapping scale ${scale}`,
    confidence: 'High',
    limitation: 'The map describes the soil type normally expected near mapping depth, not a measured parcel stratigraphy. Thin or underlying layers, fill, local variation, groundwater and engineering parameters require site-specific investigation.',
    value: { deposit, scale, mapping: text(p.kartering), mapType: text(p.karttyp_tx) || text(p.karttyp) }
  };
}

async function queryBedrock(lat: number, lng: number, fetcher: FetchLike): Promise<SwedenGroundEvidence> {
  const url = queryUrl(BEDROCK, lat, lng, 12, 5);
  const features = await fetchFeatures(fetcher, url);
  if (features === null) return unavailable('se-sgu-bedrock-unavailable', 'Mapped bedrock geology', url, 'SGU bedrock mapping could not be queried.', 'SOURCE_UNAVAILABLE');
  if (!features.length) return unavailable('se-sgu-bedrock-no-data', 'Mapped bedrock geology', url, 'SGU returned no bedrock polygon at the selected location.');
  const p = props(features[0]);
  const unit = text(p.geo_enh_tx);
  const rock = text(p.bergart_tx);
  if (!unit && !rock) return unavailable('se-sgu-bedrock-malformed', 'Mapped bedrock geology', url, 'SGU returned a bedrock polygon without a readable geological unit or rock type.', 'MALFORMED_DATA');
  const scale = text(p.rek_skala);

  return {
    id: 'se-sgu-bedrock',
    category: 'Mapped bedrock geology',
    claim: `SGU bedrock mapping identifies ${unit || 'a mapped geological unit'}${rock ? `; principal rock type: ${rock}` : ''}${scale ? `; recommended presentation scale: ${scale}` : ''}.`,
    status: 'VERIFIED',
    sourceName: `${SGU} — Berggrund 1:50 000–1:250 000`,
    sourceUrl: url,
    datasetDate: dateFrom(p),
    spatialRelationship: 'Published bedrock polygon intersecting the selected coordinate vicinity',
    calculationMethod: 'SGU OGC API Features query of geologisk-enhet-yta in CRS84',
    confidence: 'High',
    limitation: 'Bedrock mapping is regional geological evidence. It does not establish rock-head depth, weathering, fracture condition, excavation class or foundation parameters at the selected parcel.',
    value: { unit, rock, lithotectonicUnit: text(p.tekt_n_tx), lithology: text(p.lito_n_tx), scale, mappingType: text(p.karttyp_tx), revisionDate: text(p.rev_dat) }
  };
}

async function queryWells(lat: number, lng: number, fetcher: FetchLike): Promise<SwedenGroundEvidence> {
  const radiusM = 1000;
  const url = queryUrl(WELLS, lat, lng, radiusM, 40);
  const features = await fetchFeatures(fetcher, url);
  if (features === null) return unavailable('se-sgu-wells-unavailable', 'Nearby wells and borehole context', url, 'SGU Brunnsarkivet could not be queried.', 'SOURCE_UNAVAILABLE');
  if (!features.length) return unavailable('se-sgu-wells-no-data', 'Nearby wells and borehole context', url, `SGU Brunnsarkivet returned no well record within the ${radiusM} m search vicinity.`);

  const records = features.map(feature => {
    const p = props(feature);
    const point = pointCoordinates(feature);
    return {
      id: text(p.obsplatsid) || text(p.brunnsid),
      property: text(p.fastighet),
      municipality: text(p.kommunnamn),
      drilledDate: text(p.borrdatum),
      totalDepthM: numberValue(p.totaldjup),
      soilDepthM: numberValue(p.jorddjup),
      groundwaterLevelM: numberValue(p.grundvattenniva),
      groundwaterLevelDate: text(p.nivadatum),
      capacity: numberValue(p.kapacitet),
      use: text(p.anvandning),
      positionalQuality: text(p.posvardering),
      distanceM: point ? Math.round(haversineM(lat, lng, point[0], point[1])) : null
    };
  }).sort((a, b) => (a.distanceM ?? Number.POSITIVE_INFINITY) - (b.distanceM ?? Number.POSITIVE_INFINITY));
  const nearest = records[0];

  return {
    id: 'se-sgu-well-context',
    category: 'Nearby wells and borehole context',
    claim: `SGU Brunnsarkivet returned ${records.length} well record${records.length === 1 ? '' : 's'} in the search vicinity${nearest?.distanceM !== null && nearest?.distanceM !== undefined ? `; the nearest returned record is approximately ${nearest.distanceM} m from the selected location` : ''}.`,
    status: 'VERIFIED',
    sourceName: `${SGU} — Brunnsarkivet`,
    sourceUrl: url,
    datasetDate: nearest?.drilledDate || today(),
    spatialRelationship: `Well/borehole points within an approximately ${radiusM} m search box around the selected coordinate`,
    calculationMethod: 'SGU Brunnar OGC API Features query in CRS84; returned points ranked by geodesic distance',
    confidence: 'High',
    limitation: 'Nearby wells are context only. Their soil depth, total depth, water level and geological observations do not prove corresponding conditions beneath the selected parcel. Original records and site-specific investigation are required before design decisions.',
    value: { count: records.length, nearestDistanceM: nearest?.distanceM ?? null, records: records.slice(0, 15) }
  };
}

async function queryGroundwaterStations(lat: number, lng: number, fetcher: FetchLike): Promise<SwedenGroundEvidence> {
  const radiusM = 5000;
  const url = queryUrl(GROUNDWATER_STATIONS, lat, lng, radiusM, 30);
  const features = await fetchFeatures(fetcher, url);
  if (features === null) return unavailable('se-sgu-groundwater-stations-unavailable', 'Observed groundwater network', url, 'SGU observed-groundwater station data could not be queried.', 'SOURCE_UNAVAILABLE');
  if (!features.length) return unavailable('se-sgu-groundwater-stations-no-data', 'Observed groundwater network', url, `SGU returned no observed-groundwater station within the ${radiusM} m search vicinity.`);

  const records = features.map(feature => {
    const p = props(feature);
    const point = pointCoordinates(feature);
    return {
      id: text(p.provplatsid) || text(p.platsbeteckning),
      name: text(p.obsplatsnamn) || text(p.platsbeteckning),
      aquifer: text(p.akvifer_tx),
      soil: text(p.jordart_tx),
      soilDepthM: numberValue(p.jorddjup),
      municipality: text(p.kommun),
      county: text(p.lan),
      firstDate: text(p.fdat),
      lastDate: text(p.tdat),
      distanceM: point ? Math.round(haversineM(lat, lng, point[0], point[1])) : null
    };
  }).sort((a, b) => (a.distanceM ?? Number.POSITIVE_INFINITY) - (b.distanceM ?? Number.POSITIVE_INFINITY));
  const nearest = records[0];

  return {
    id: 'se-sgu-groundwater-stations',
    category: 'Observed groundwater network',
    claim: `SGU returned ${records.length} groundwater observation station${records.length === 1 ? '' : 's'} in the search vicinity${nearest?.distanceM !== null && nearest?.distanceM !== undefined ? `; the nearest returned station is approximately ${nearest.distanceM} m away` : ''}.`,
    status: 'VERIFIED',
    sourceName: `${SGU} — Grundvattennivåer, observerade`,
    sourceUrl: url,
    datasetDate: nearest?.lastDate || today(),
    spatialRelationship: `Observation stations within an approximately ${radiusM} m search box around the selected coordinate`,
    calculationMethod: 'SGU observed-groundwater station OGC API Features query in CRS84; stations ranked by geodesic distance',
    confidence: 'High',
    limitation: 'A nearby monitoring station describes its own aquifer and observation point. It does not establish groundwater depth or seasonal high groundwater beneath the selected parcel. Station time-series and site-specific investigation must be interpreted in local hydrogeological context.',
    value: { count: records.length, nearestDistanceM: nearest?.distanceM ?? null, records: records.slice(0, 12) }
  };
}

export async function querySwedenGroundEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<SwedenGroundEvidence[]> {
  const [surface, bedrock, wells, groundwater] = await Promise.all([
    querySurfaceGeology(lat, lng, fetcher),
    queryBedrock(lat, lng, fetcher),
    queryWells(lat, lng, fetcher),
    queryGroundwaterStations(lat, lng, fetcher)
  ]);
  return [surface, bedrock, wells, groundwater];
}

export function enrichSwedenGroundEvidence(report: any, items: SwedenGroundEvidence[]): void {
  const surface = items.find(item => item.id === 'se-sgu-surface-geology' && item.status === 'VERIFIED');
  const bedrock = items.find(item => item.id === 'se-sgu-bedrock' && item.status === 'VERIFIED');
  const surfaceValue = (surface?.value || {}) as Record<string, unknown>;
  const bedrockValue = (bedrock?.value || {}) as Record<string, unknown>;

  if (surface || bedrock) {
    report.geosurvey_context = {
      ...(report.geosurvey_context || {}),
      geological_unit_name: text(bedrockValue.unit) || report.geosurvey_context?.geological_unit_name || null,
      lithology_type: text(bedrockValue.rock) || text(bedrockValue.lithology) || report.geosurvey_context?.lithology_type || null,
      superficial_deposit: text(surfaceValue.deposit) || report.geosurvey_context?.superficial_deposit || null,
      geological_period_era: report.geosurvey_context?.geological_period_era || null,
      evidence_level: 'VERIFIED',
      official_portal_url: PORTAL
    };
  }

  // Intentionally do not infer parcel groundwater depth, bearing capacity,
  // friction angle, cohesion, settlement, rock-head depth or foundation type
  // from regional mapping, nearby wells or nearby groundwater stations.
}

export const SWEDEN_GROUND_SOURCES = {
  surfaceDetailed: SURFACE_DETAIL,
  surfaceNorthern: SURFACE_NORTH,
  bedrock: BEDROCK,
  wells: WELLS,
  groundwaterStations: GROUNDWATER_STATIONS,
  portal: PORTAL
};
