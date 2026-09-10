import { EvidenceItem } from '../types';

export type NorwayGroundEvidence = EvidenceItem;
type FetchLike = typeof fetch;

const NGU = 'Norges geologiske undersøkelse (NGU)';
const LOOSE_MASS = 'https://geo.ngu.no/api/features/losmassedetaljert/collections/losmasseflate/items';
const NADAG = 'https://geo.ngu.no/api/features/grunnundersokelser_utvidet/collections/geotekniskborehull/items';
const MARINE_CLAY = 'https://geo.ngu.no/api/features/muligmarinleire/collections/muligmarinleireflate/items';
const RADON = 'https://geo.ngu.no/api/features/radonaktsomhet/collections/radonaktsomhet/items';
const PORTAL = 'https://www.ngu.no/geologiske-kart/karttjenester';
const today = () => new Date().toISOString().slice(0, 10);

function bbox(lat: number, lng: number, radiusM: number): string {
  const dLat = radiusM / 111_320;
  const cosLat = Math.max(0.2, Math.cos(lat * Math.PI / 180));
  const dLng = radiusM / (111_320 * cosLat);
  return `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
}

function queryUrl(base: string, lat: number, lng: number, radiusM: number, limit: number): string {
  const params = new URLSearchParams({ bbox: bbox(lat, lng, radiusM), limit: String(limit), f: 'json' });
  return `${base}?${params}`;
}

async function fetchFeatures(fetcher: FetchLike, url: string, timeoutMs = 8000): Promise<any[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/geo+json, application/json', 'User-Agent': 'GeoSurvey/1.0 Norway NGU evidence' },
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
  return cleaned || null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && Number.isFinite(Number(value.replace(',', '.')))) return Number(value.replace(',', '.'));
  return null;
}

function dateFrom(properties: Record<string, unknown>): string {
  return text(properties.oppdateringsdato) || text(properties.datauttaksdato) || text(properties.opprettetDato) || today();
}

function unavailable(id: string, category: string, sourceUrl: string, claim: string, reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA' = 'NO_DATA'): NorwayGroundEvidence {
  return {
    id,
    category,
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName: NGU,
    sourceUrl,
    datasetDate: today(),
    spatialRelationship: 'Selected site / search vicinity',
    calculationMethod: 'NGU OGC API Features spatial query',
    confidence: 'Low',
    limitation: 'An empty or failed map/API query is not evidence that the relevant ground condition or hazard is absent. Check the official NGU map and commission site-specific investigation where material to a decision.',
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

async function queryLooseMass(lat: number, lng: number, fetcher: FetchLike): Promise<NorwayGroundEvidence> {
  const url = queryUrl(LOOSE_MASS, lat, lng, 15, 5);
  const features = await fetchFeatures(fetcher, url);
  if (!features) return unavailable('no-ngu-loose-mass-unavailable', 'Mapped near-surface deposits', url, 'NGU detailed superficial-deposit data could not be queried.', 'SOURCE_UNAVAILABLE');
  if (!features.length) return unavailable('no-ngu-loose-mass-no-data', 'Mapped near-surface deposits', url, 'NGU detailed superficial-deposit mapping returned no polygon at the selected location.');
  const p = props(features[0]);
  const deposit = text(p['løsmassetypeNavn']) || text(p.losmassetypeNavn) || text(p['løsmassetype']) || 'mapped superficial deposit';
  const description = text(p['løsmassetypeBesk']) || text(p.losmassetypeBesk);
  const infiltration = text(p.infiltrasjonPotensialNavn);
  const groundwater = text(p.grunnvannPotensialNavn);
  const origin = text(p.opphav);
  return {
    id: 'no-ngu-loose-mass-detailed',
    category: 'Mapped near-surface deposits',
    claim: `NGU detailed superficial-deposit mapping classifies the selected location as ${deposit}${infiltration ? `; infiltration potential: ${infiltration}` : ''}${groundwater ? `; groundwater potential in superficial deposits: ${groundwater}` : ''}.`,
    status: 'VERIFIED',
    sourceName: `${NGU} — Løsmasse detaljert`,
    sourceUrl: url,
    datasetDate: dateFrom(p),
    spatialRelationship: 'Detailed superficial-deposit polygon intersecting a small search box around the selected coordinate',
    calculationMethod: 'NGU OGC API Features bbox query of LøsmasseFlate; explicit published deposit, infiltration and groundwater-potential attributes',
    confidence: 'High',
    limitation: 'The mapped deposit describes the dominant material in the upper metres and may not represent deeper layers. Mapping detail and quality vary by area. It is not a geotechnical site investigation and no bearing capacity, settlement or foundation design value is inferred.',
    value: { deposit, description, infiltration, groundwater, origin, dataExtractionDate: text(p.datauttaksdato), updatedAt: text(p.oppdateringsdato) }
  };
}

async function queryNadag(lat: number, lng: number, fetcher: FetchLike): Promise<NorwayGroundEvidence> {
  const radiusM = 750;
  const url = queryUrl(NADAG, lat, lng, radiusM, 30);
  const features = await fetchFeatures(fetcher, url);
  if (!features) return unavailable('no-ngu-nadag-unavailable', 'Nearby geotechnical investigations', url, 'NGU NADAG geotechnical borehole data could not be queried.', 'SOURCE_UNAVAILABLE');
  if (!features.length) return unavailable('no-ngu-nadag-no-data', 'Nearby geotechnical investigations', url, `NADAG returned no geotechnical borehole within the ${radiusM} m search vicinity.`);

  const records = features.map(feature => {
    const p = props(feature);
    const point = pointCoordinates(feature);
    return {
      id: text(p.lokalid) || text((p.identifikasjon as any)?.lokalId),
      boreNumber: text(p.boreNr),
      drilledToRockM: numberValue(p.borlengdeTilBerg) ?? numberValue(p['boretLengdeTilBerg']),
      maxDrilledLengthM: numberValue(p.maksBoretLengde),
      quickClayFinding: text(p['kvikkleirePåvisning']),
      origin: text(p.opphav),
      description: text(p.beskrivelse),
      distanceM: point ? Math.round(haversineM(lat, lng, point[0], point[1])) : null,
      dataDate: dateFrom(p)
    };
  }).sort((a, b) => (a.distanceM ?? Number.POSITIVE_INFINITY) - (b.distanceM ?? Number.POSITIVE_INFINITY));
  const nearest = records[0];
  return {
    id: 'no-ngu-nadag-borehole-context',
    category: 'Nearby geotechnical investigations',
    claim: `NGU NADAG returned ${records.length} geotechnical borehole record${records.length === 1 ? '' : 's'} within the search vicinity${nearest?.distanceM !== null && nearest?.distanceM !== undefined ? `; the nearest returned record is approximately ${nearest.distanceM} m from the selected location` : ''}.`,
    status: 'VERIFIED',
    sourceName: `${NGU} — NADAG`,
    sourceUrl: url,
    datasetDate: nearest?.dataDate || today(),
    spatialRelationship: `Geotechnical borehole points within an approximately ${radiusM} m search box around the selected coordinate`,
    calculationMethod: 'NGU NADAG OGC API Features query; returned borehole points ranked by geodesic distance to the selected coordinate',
    confidence: 'High',
    limitation: 'Nearby boreholes are context only. They do not prove the stratigraphy, rock depth, groundwater level, quick-clay condition or engineering parameters beneath the selected parcel. Original borehole documents and site-specific investigation must be reviewed before design decisions.',
    value: { count: records.length, nearestDistanceM: nearest?.distanceM ?? null, records: records.slice(0, 15) }
  };
}

async function queryMarineClay(lat: number, lng: number, fetcher: FetchLike): Promise<NorwayGroundEvidence> {
  const url = queryUrl(MARINE_CLAY, lat, lng, 15, 5);
  const features = await fetchFeatures(fetcher, url);
  if (!features) return unavailable('no-ngu-marine-clay-unavailable', 'Marine clay possibility', url, 'NGU’s marine-clay possibility dataset could not be queried.', 'SOURCE_UNAVAILABLE');
  if (!features.length) return unavailable('no-ngu-marine-clay-no-data', 'Marine clay possibility', url, 'NGU’s marine-clay possibility dataset returned no polygon at the selected location.');
  const p = props(features[0]);
  const classification = text(p.muligMarinLeireNavn) || text(p.muligMarinLeire);
  if (!classification) return unavailable('no-ngu-marine-clay-malformed', 'Marine clay possibility', url, 'NGU returned a marine-clay polygon without a readable classification.', 'MALFORMED_DATA');
  return {
    id: 'no-ngu-marine-clay',
    category: 'Marine clay possibility',
    claim: `NGU’s mapped marine-clay screening class for the selected location is: ${classification}.`,
    status: 'VERIFIED',
    sourceName: `${NGU} — Mulighet for marin leire`,
    sourceUrl: url,
    datasetDate: dateFrom(p),
    spatialRelationship: 'Mapped marine-clay possibility polygon intersecting the selected coordinate vicinity',
    calculationMethod: 'NGU OGC API Features query of MuligMarinLeireFlate, based on superficial-deposit mapping and the marine limit',
    confidence: 'High',
    limitation: 'This dataset expresses possibility, not confirmation of marine or quick clay at the parcel. It must not be read as a geotechnical diagnosis or stability assessment. Detailed ground investigation and applicable NVE guidance are required where the screening is material.',
    value: { classification, code: text(p.muligMarinLeire), deposit: text(p.losmassetypeNavn) || text(p.losmassetype) }
  };
}

async function queryRadon(lat: number, lng: number, fetcher: FetchLike): Promise<NorwayGroundEvidence> {
  const url = queryUrl(RADON, lat, lng, 15, 5);
  const features = await fetchFeatures(fetcher, url);
  if (!features) return unavailable('no-ngu-radon-unavailable', 'Radon awareness', url, 'NGU’s national radon-awareness dataset could not be queried.', 'SOURCE_UNAVAILABLE');
  if (!features.length) return unavailable('no-ngu-radon-no-data', 'Radon awareness', url, 'NGU’s radon-awareness dataset returned no polygon at the selected location.');
  const p = props(features[0]);
  const classification = text(p.aktsomhetGradNavn) || text(p.aktsomhetGrad);
  if (!classification) return unavailable('no-ngu-radon-malformed', 'Radon awareness', url, 'NGU returned a radon-awareness polygon without a readable classification.', 'MALFORMED_DATA');
  return {
    id: 'no-ngu-radon-awareness',
    category: 'Radon awareness',
    claim: `NGU’s national radon-awareness map classifies the selected location as ${classification}.`,
    status: 'VERIFIED',
    sourceName: `${NGU} — Radon aktsomhet`,
    sourceUrl: url,
    datasetDate: dateFrom(p),
    spatialRelationship: 'National radon-awareness polygon intersecting the selected coordinate vicinity',
    calculationMethod: 'NGU OGC API Features query of RadonAktsomhet; official area screening based on indoor radon measurements and geological knowledge',
    confidence: 'High',
    limitation: 'The radon-awareness map supports preliminary area screening; it is not a radon measurement for the selected parcel or building and should not be treated as parcel-scale proof of radon conditions.',
    value: { classification }
  };
}

export async function queryNorwayGroundEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<NorwayGroundEvidence[]> {
  const [looseMass, nadag, marineClay, radon] = await Promise.all([
    queryLooseMass(lat, lng, fetcher),
    queryNadag(lat, lng, fetcher),
    queryMarineClay(lat, lng, fetcher),
    queryRadon(lat, lng, fetcher)
  ]);
  return [looseMass, nadag, marineClay, radon];
}

export function enrichNorwayGroundEvidence(report: any, items: NorwayGroundEvidence[]): void {
  const looseMass = items.find(item => item.id === 'no-ngu-loose-mass-detailed' && item.status === 'VERIFIED');
  const radon = items.find(item => item.id === 'no-ngu-radon-awareness' && item.status === 'VERIFIED');
  const loose = (looseMass?.value || {}) as Record<string, unknown>;

  if (looseMass) {
    report.geosurvey_context = {
      ...(report.geosurvey_context || {}),
      geological_unit_name: text(loose.deposit) || report.geosurvey_context?.geological_unit_name || null,
      lithology_type: text(loose.description) || text(loose.deposit) || report.geosurvey_context?.lithology_type || null,
      groundwater_regime: text(loose.groundwater) || report.geosurvey_context?.groundwater_regime || null,
      evidence_level: 'VERIFIED',
      official_portal_url: PORTAL
    };
    if (report.soil) report.soil.groundwaterRegime = text(loose.groundwater) || report.soil.groundwaterRegime;
  }

  if (radon && report.terrain?.geohazards?.radonPotential) {
    const classification = text((radon.value as any)?.classification);
    if (classification) {
      report.terrain.geohazards.radonPotential = {
        ...report.terrain.geohazards.radonPotential,
        status: 'VERIFIED',
        classification,
        sourceName: radon.sourceName
      };
    }
  }

  // Intentionally do not infer bearing capacity, friction angle, cohesion,
  // settlement, groundwater depth or foundation type from mapping or nearby boreholes.
}

export const NORWAY_GROUND_SOURCES = { looseMass: LOOSE_MASS, nadag: NADAG, marineClay: MARINE_CLAY, radon: RADON, portal: PORTAL };
