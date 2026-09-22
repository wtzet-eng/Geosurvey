import type { EvidenceItem, VerifiedSiteReport } from '../types';
import type { AvailabilityReason } from '../reporting/canonicalReport';

type FetchLike = typeof fetch;
type CroatiaReason = Extract<AvailabilityReason, 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA'>;

export const CROATIA_HGI_GEOLOGY_WFS = 'https://transformiraj.nipp.hr/ows/services/org.2.abf7ddc6-7578-4070-a9db-c291a42e55c6_wfs';
const HGI = 'Croatian Geological Survey (Hrvatski geološki institut)';
const SOURCE_NAME = `${HGI} — INSPIRE Geological Map 1:300,000`;
const SCALE = '1:300,000';

type Ring = Array<{ lng: number; lat: number }>;
type MappedFeature = { id: string | null; specificationUrl: string | null; outer: Ring; holes: Ring[] };
type UnitRecord = { id: string | null; name: string | null; materials: string[]; eventUrl: string | null };
type GeologyResult = { evidence: EvidenceItem; unit: string | null; lithology: string | null; age: string | null };

const today = () => new Date().toISOString().slice(0, 10);

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  return text && !/^(null|none|unknown|n\/a)$/i.test(text) ? text : null;
}

function decodeXml(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function hrefFromTag(xml: string, tag: string): string | null {
  const re = new RegExp('<[^>]*' + tag + '[^>]*xlink:href="([^"]+)"[^>]*>', 'i');
  const match = xml.match(re);
  return match ? decodeXml(match[1]) : null;
}

function humanizeToken(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
}

function humanizeLithology(href: string): string | null {
  const decoded = decodeXml(href);
  const match = decoded.match(/\/lithology\/([^&#/]+)/i);
  const token = match?.[1] || decoded.split('/').pop() || null;
  return token ? humanizeToken(token).toLowerCase() : null;
}

function humanizeAge(href: string): string | null {
  const decoded = decodeXml(href);
  const match = decoded.match(/\/GeochronologicEraValue\/([^&#/]+)/i);
  const token = match?.[1] || null;
  return token ? humanizeToken(token).replace(/\b\w/g, c => c.toUpperCase()) : null;
}
function parseRing(text: string): Ring {
  const numbers = text.trim().split(/\s+/).map(Number).filter(Number.isFinite);
  const ring: Ring = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) ring.push({ lng: numbers[i], lat: numbers[i + 1] });
  return ring;
}

function pointInRing(point: { lng: number; lat: number }, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    const crosses = ((b.lat > point.lat) !== (a.lat > point.lat))
      && point.lng < ((a.lng - b.lng) * (point.lat - b.lat)) / (a.lat - b.lat) + b.lng;
    if (crosses) inside = !inside;
  }
  return inside;
}

function containsPoint(feature: MappedFeature, point: { lng: number; lat: number }): boolean {
  return feature.outer.length >= 3 && pointInRing(point, feature.outer)
    && !feature.holes.some(hole => pointInRing(point, hole));
}

function parseMappedFeatures(xml: string): MappedFeature[] {
  const results: MappedFeature[] = [];
  const memberRe = /<wfs:member\b[^>]*>([\s\S]*?)<\/wfs:member>/gi;
  let match: RegExpExecArray | null;
  while ((match = memberRe.exec(xml))) {
    const block = match[1];
    const id = block.match(/<ge:MappedFeature\b[^>]*gml:id="([^"]+)"/i)?.[1] || null;
    const specificationUrl = hrefFromTag(block, 'ge:specification');
    const surface = block.match(/<gml:Surface\b[\s\S]*?<\/gml:Surface>/i)?.[0] || '';
    const exterior = surface.match(/<gml:exterior\b[^>]*>[\s\S]*?<gml:LinearRing\b[^>]*>[\s\S]*?<gml:posList\b[^>]*>([\s\S]*?)<\/gml:posList>/i)?.[1];
    const outer = exterior ? parseRing(exterior) : [];
    const holes: Ring[] = [];
    const interiorRe = /<gml:interior\b[^>]*>[\s\S]*?<gml:LinearRing\b[^>]*>[\s\S]*?<gml:posList\b[^>]*>([\s\S]*?)<\/gml:posList>/gi;
    let interior: RegExpExecArray | null;
    while ((interior = interiorRe.exec(surface))) holes.push(parseRing(interior[1]));
    if (specificationUrl && outer.length >= 3) results.push({ id, specificationUrl, outer, holes });
  }
  return results;
}

async function fetchText(fetcher: FetchLike, url: string, timeoutMs = 9000): Promise<{ status: number; text: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/gml+xml, application/xml, text/xml', 'User-Agent': 'LandSurf/1.0 Croatia geology evidence' }, signal: controller.signal });
    if (!response.ok) return { status: response.status, text: '' };
    return { status: response.status, text: await response.text() };
  } catch { return null; }
  finally { clearTimeout(timer); }
}
async function queryMappedFeatures(lat: number, lng: number, fetcher: FetchLike): Promise<{ status: number; text: string } | null> {
  const d = 0.0015;
  const params = new URLSearchParams({
    SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature', TYPENAMES: 'ge:MappedFeature',
    SRSNAME: 'EPSG:4326', BBOX: `${lng - d},${lat - d},${lng + d},${lat + d},EPSG:4326`, COUNT: '25'
  });
  return fetchText(fetcher, `${CROATIA_HGI_GEOLOGY_WFS}?${params}`);
}

function parseUnit(xml: string): UnitRecord {
  const nameMatch = xml.match(/<ge:name\b[^>]*>([^<]+)<\/ge:name>/i);
  const id = xml.match(/<ge:GeologicUnit\b[^>]*gml:id="([^"]+)"/i)?.[1] || null;
  const materialRe = /<ge:material\b[^>]*xlink:href="([^"]+)"[^>]*>/gi;
  const materials: string[] = [];
  let material: RegExpExecArray | null;
  while ((material = materialRe.exec(xml))) {
    const value = humanizeLithology(material[1]);
    if (value && !materials.includes(value)) materials.push(value);
  }
  return { id, name: clean(nameMatch?.[1] || ''), materials, eventUrl: hrefFromTag(xml, 'ge:geologicHistory') };
}

function parseEventAges(xml: string): string[] {
  const ages: string[] = [];
  const ageRe = /<ge:(?:olderNamedAge|youngerNamedAge)\b[^>]*xlink:href="([^"]+)"[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = ageRe.exec(xml))) {
    const age = humanizeAge(match[1]);
    if (age && !ages.includes(age)) ages.push(age);
  }
  return ages;
}

async function fetchUnitContext(mapped: MappedFeature, fetcher: FetchLike): Promise<{ unit: UnitRecord | null; ages: string[] }> {
  if (!mapped.specificationUrl) return { unit: null, ages: [] };
  const unitResponse = await fetchText(fetcher, mapped.specificationUrl, 7000);
  if (!unitResponse?.text) return { unit: null, ages: [] };
  const unit = parseUnit(unitResponse.text);
  if (!unit.eventUrl) return { unit, ages: [] };
  const eventResponse = await fetchText(fetcher, unit.eventUrl, 7000);
  return { unit, ages: eventResponse?.text ? parseEventAges(eventResponse.text) : [] };
}
function unavailable(reasonCode: CroatiaReason, claim: string): EvidenceItem & { reasonCode: CroatiaReason } {
  return {
    id: `hr-hgi-geology-${reasonCode.toLowerCase()}`,
    category: 'Mapped national geology', claim, status: 'REQUIRES_VERIFICATION', sourceName: SOURCE_NAME,
    sourceUrl: CROATIA_HGI_GEOLOGY_WFS, datasetDate: today(), spatialRelationship: 'Selected site coordinate',
    calculationMethod: 'HGI INSPIRE WFS query with exact point-in-polygon validation', confidence: 'Low',
    limitation: 'A failed or empty automated response is not evidence that geological information is absent. The current HGI geological map should be checked directly before a site decision.',
    value: { reasonCode }, reasonCode
  };
}

function buildEvidence(lat: number, lng: number, mapped: MappedFeature, unit: UnitRecord, ages: string[], extraUnits: UnitRecord[]): GeologyResult {
  const age = ages.length ? ages.join(' – ') : null;
  const lithology = unit.materials.length ? unit.materials.join(', ') : null;
  const unitLabel = unit.name || [age, lithology].filter(Boolean).join(' — ') || 'Mapped regional geological unit';
  const evidence: EvidenceItem = {
    id: 'hr-hgi-geology-site', category: 'Mapped national geology',
    claim: `HGI INSPIRE mapping identifies the selected coordinate within ${unitLabel}${lithology && unit.name ? ` (${lithology})` : ''}.`,
    status: 'VERIFIED', sourceName: SOURCE_NAME, sourceUrl: CROATIA_HGI_GEOLOGY_WFS, datasetDate: today(),
    spatialRelationship: 'Official MappedFeature polygon containing the exact selected coordinate',
    calculationMethod: 'HGI INSPIRE WFS ge:MappedFeature query, GML polygon parsing, exact point-in-polygon check, and linked GeologicUnit/GeologicEvent resolution',
    confidence: 'Medium',
    limitation: `This is regional ${SCALE} screening evidence. It does not establish parcel-specific layer thickness, fill, weathering, rockhead depth, groundwater level or engineering design parameters. HGI also provides more detailed geological map series that still require direct source review where material.`,
    value: {
      mappedFeatureId: mapped.id, geologicUnitId: unit.id, geologicalUnit: unitLabel,
      lithology, geologicalAge: age, scale: SCALE, queriedLayer: 'ge:MappedFeature',
      mappedMaterials: unit.materials, mappedAges: ages, additionalMappedUnits: extraUnits.map(item => item.name).filter(Boolean)
    }
  };
  return { evidence, unit: unitLabel, lithology, age };
}
export type CroatiaNationalEvidence = EvidenceItem & { reasonCode?: CroatiaReason };

export async function queryCroatiaNationalEvidence(
  lat: number, lng: number, fetcher: FetchLike = fetch
): Promise<CroatiaNationalEvidence[]> {
  try {
    const response = await queryMappedFeatures(lat, lng, fetcher);
    if (!response) return [unavailable('SOURCE_UNAVAILABLE', 'HGI geological WFS could not be reached.')];
    if (!response.text || !/<wfs:FeatureCollection\b/i.test(response.text)) {
      return [unavailable('MALFORMED_DATA', 'HGI geological WFS returned a response that was not a usable FeatureCollection.')];
    }
    const point = { lat, lng };
    const contained = parseMappedFeatures(response.text).filter(feature => containsPoint(feature, point));
    if (!contained.length) return [unavailable('NO_DATA', 'HGI returned no mapped geological polygon containing the selected coordinate.')];
    const contexts = await Promise.all(contained.slice(0, 5).map(feature => fetchUnitContext(feature, fetcher)));
    const valid = contexts.filter((context): context is { unit: UnitRecord; ages: string[] } => Boolean(context.unit));
    if (!valid.length) return [unavailable('MALFORMED_DATA', 'HGI returned a mapped polygon but its linked geological-unit record could not be resolved.')];
    const primary = valid[0];
    const extras = valid.slice(1).map(context => context.unit);
    return [buildEvidence(lat, lng, contained[0], primary.unit, primary.ages, extras).evidence as CroatiaNationalEvidence];
  } catch (error) {
    console.warn('[Croatia geology acquisition]', { error: error instanceof Error ? error.name : 'request_failed' });
    return [unavailable('SOURCE_UNAVAILABLE', 'HGI geological evidence could not be acquired reliably at analysis time.')];
  }
}

export function enrichCroatiaNationalEvidence(
  report: VerifiedSiteReport & Record<string, any>, items: CroatiaNationalEvidence[]
): void {
  const geology = items.find(item => item.id === 'hr-hgi-geology-site' && item.status === 'VERIFIED');
  if (!geology) return;
  const value = (geology.value || {}) as Record<string, unknown>;
  const unit = clean(value.geologicalUnit) || null;
  const lithology = clean(value.lithology) || null;
  const age = clean(value.geologicalAge) || null;
  report.geosurvey_context = {
    ...(report.geosurvey_context || {}), geological_unit_name: unit, lithology_type: lithology,
    geological_period_era: age, evidence_level: 'VERIFIED', source_name: geology.sourceName,
    source_url: geology.sourceUrl, source_scale: SCALE, evidence_tier: 3
  };
  report.soil = {
    ...report.soil, geologicalUnit: unit || report.soil.geologicalUnit,
    lithologyType: lithology || report.soil.lithologyType,
    stratigraphicPeriod: age || report.soil.stratigraphicPeriod
  };
}
