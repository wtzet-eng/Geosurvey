import { BoundaryShape } from '../../src/types';
import { fetchGenuineSoilGridsData, SoilGridsResult } from './soilGridsService';

export type SpatialEvidenceScope = 'SITE' | 'PARCEL' | 'VICINITY' | 'REGIONAL';
export type GroundVariabilityClass = 'LOW' | 'MODERATE' | 'HIGH' | 'INSUFFICIENT_EVIDENCE';
export type MappedMaterialIndicator = 'ALLUVIAL' | 'ORGANIC_OR_PEAT' | 'MADE_GROUND' | 'GLACIOFLUVIAL' | 'TILL' | 'COHESIVE' | 'GRANULAR' | 'OTHER';

export interface SpatialSamplePoint {
  id: string;
  lat: number;
  lng: number;
  scope: SpatialEvidenceScope;
  label: string;
}

export interface MappedGroundSample {
  pointId: string;
  scope: SpatialEvidenceScope;
  unit: string | null;
  lithology: string | null;
  geologicalAge?: string | null;
  sourceName: string;
  sourceScale?: string | null;
}

export interface GroundContextSummary {
  variabilityClass: GroundVariabilityClass;
  dominantMappedUnit: string | null;
  secondaryMappedUnits: string[];
  distinctMappedUnits: string[];
  transitionIndicated: boolean;
  materialIndicators: MappedMaterialIndicator[];
  sampleCount: number;
  siteSampleCount: number;
  parcelSampleCount: number;
  vicinitySampleCount: number;
  sourceName: string | null;
  sourceScale: string | null;
  evidenceType: 'MAPPED_SPATIAL_CONTEXT';
  limitation: string;
}

export interface PedologicalVariabilitySummary {
  evidenceType: 'PEDOLOGICAL_MODEL';
  sampleCount: number;
  validSampleCount: number;
  textureClasses: string[];
  topsoilSandPctRange: [number, number] | null;
  topsoilSiltPctRange: [number, number] | null;
  topsoilClayPctRange: [number, number] | null;
  variationObserved: boolean;
  sourceName: string;
  sourceResolution: string;
  limitation: string;
}

type BoundaryLike = BoundaryShape & { coordinates?: [number, number][] };
type SoilFetcher = (lat: number, lng: number) => Promise<SoilGridsResult>;
type ExistingSiteSoil = Partial<Pick<SoilGridsResult, 'success' | 'sourceName' | 'datasetVersion' | 'usdaTextureClass' | 'topsoilSandPct' | 'topsoilSiltPct' | 'topsoilClayPct'>>;

const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const cleanText = (value: unknown): string | null => typeof value === 'string' && value.trim() && !/^(not available|no data|unknown|unavailable|requires verification|brak danych|niedostępne)$/i.test(value.trim()) ? value.trim() : null;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function offsetPoint(lat: number, lng: number, northM: number, eastM: number): [number, number] {
  const latOffset = northM / 111320;
  const longitudeScale = Math.max(0.05, Math.cos(lat * Math.PI / 180));
  const lngOffset = eastM / (111320 * longitudeScale);
  return [lat + latOffset, lng + lngOffset];
}

function uniquePoints(points: SpatialSamplePoint[], limit: number): SpatialSamplePoint[] {
  const seen = new Set<string>();
  const result: SpatialSamplePoint[] = [];
  for (const point of points) {
    const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(point);
    if (result.length >= limit) break;
  }
  return result;
}

function representativeBoundaryPoints(boundary: BoundaryLike | undefined, lat: number, lng: number): [number, number][] {
  if (!boundary) return [];
  if (boundary.type === 'circle' && typeof boundary.radius === 'number' && boundary.radius > 0) {
    return [offsetPoint(lat, lng, boundary.radius, 0), offsetPoint(lat, lng, 0, boundary.radius), offsetPoint(lat, lng, -boundary.radius, 0), offsetPoint(lat, lng, 0, -boundary.radius)];
  }
  let points = boundary.points || boundary.coordinates || boundary.corners || [];
  if (boundary.type === 'rectangle' && points.length === 2) {
    const [a, b] = points;
    points = [a, [a[0], b[1]], b, [b[0], a[1]]];
  }
  const valid = points.filter(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (valid.length <= 4) return valid;
  const indexes = [0, 0.25, 0.5, 0.75].map(fraction => Math.min(valid.length - 1, Math.floor(fraction * valid.length)));
  return [...new Set(indexes)].map(index => valid[index]);
}

export function buildGroundSamplingLayout(lat: number, lng: number, areaSizeM2: number, boundary?: BoundaryLike): SpatialSamplePoint[] {
  const equivalentRadius = Math.sqrt(Math.max(1, areaSizeM2) / Math.PI);
  const vicinityRadiusM = clamp(equivalentRadius * 2, 75, 500);
  const points: SpatialSamplePoint[] = [{ id: 'site-centroid', lat, lng, scope: 'SITE', label: 'Site centroid' }];
  representativeBoundaryPoints(boundary, lat, lng).slice(0, 4).forEach(([plat, plng], index) => {
    points.push({ id: `parcel-${index + 1}`, lat: plat, lng: plng, scope: 'PARCEL', label: `Representative parcel position ${index + 1}` });
  });
  const vicinity: Array<[string, number, number]> = [['north', vicinityRadiusM, 0], ['east', 0, vicinityRadiusM], ['south', -vicinityRadiusM, 0], ['west', 0, -vicinityRadiusM]];
  vicinity.forEach(([direction, northM, eastM]) => {
    const [vlat, vlng] = offsetPoint(lat, lng, northM, eastM);
    points.push({ id: `vicinity-${direction}`, lat: vlat, lng: vlng, scope: 'VICINITY', label: `${direction} vicinity sample` });
  });
  return uniquePoints(points, 9);
}

export function buildSoilSamplingLayout(layout: SpatialSamplePoint[]): SpatialSamplePoint[] {
  const site = layout.find(point => point.scope === 'SITE');
  const parcel = layout.filter(point => point.scope === 'PARCEL').slice(0, 2);
  const vicinity = layout.filter(point => point.scope === 'VICINITY').slice(0, 2);
  return uniquePoints([...(site ? [site] : []), ...parcel, ...vicinity], 5);
}

function materialIndicators(text: string): MappedMaterialIndicator[] {
  const indicators: MappedMaterialIndicator[] = [];
  if (/alluv|aluw|rzeczn|\bmady?\b|namu[łl]/i.test(text)) indicators.push('ALLUVIAL');
  if (/peat|torf|organic|organicz/i.test(text)) indicators.push('ORGANIC_OR_PEAT');
  if (/made ground|nasyp|anthrop|antrop/i.test(text)) indicators.push('MADE_GROUND');
  if (/glaciofluvial|fluvioglacial|wodnolodowc/i.test(text)) indicators.push('GLACIOFLUVIAL');
  if (/\btill\b|glacial till|glina zwa[łl]|morain|moren/i.test(text)) indicators.push('TILL');
  if (/clay|ił|\bil\b|glina|silt|mu[łl]/i.test(text)) indicators.push('COHESIVE');
  if (/sand|piasek|gravel|żwir|zwir|posp[oó][łl]/i.test(text)) indicators.push('GRANULAR');
  if (!indicators.length && text.trim()) indicators.push('OTHER');
  return indicators;
}

export function summarizeGroundContext(samples: MappedGroundSample[]): GroundContextSummary {
  const usable = samples.map(sample => ({ ...sample, unit: cleanText(sample.unit), lithology: cleanText(sample.lithology), geologicalAge: cleanText(sample.geologicalAge) })).filter(sample => sample.unit || sample.lithology);
  const labels = usable.map(sample => sample.unit || sample.lithology!).filter(Boolean);
  const byKey = new Map<string, { label: string; count: number; first: number }>();
  labels.forEach((label, index) => {
    const key = label.trim().toLocaleLowerCase();
    const current = byKey.get(key);
    if (current) current.count += 1;
    else byKey.set(key, { label, count: 1, first: index });
  });
  const ranked = [...byKey.values()].sort((a, b) => b.count - a.count || a.first - b.first);
  const distinctMappedUnits = ranked.map(item => item.label);
  const combinedText = usable.map(sample => `${sample.unit || ''} ${sample.lithology || ''} ${sample.geologicalAge || ''}`).join(' | ');
  const indicators = [...new Set(materialIndicators(combinedText))];
  const transitionIndicated = distinctMappedUnits.length > 1;
  let variabilityClass: GroundVariabilityClass = 'INSUFFICIENT_EVIDENCE';
  if (usable.length >= 2 && distinctMappedUnits.length === 1) variabilityClass = 'LOW';
  if (distinctMappedUnits.length === 2) variabilityClass = 'MODERATE';
  if (distinctMappedUnits.length >= 3 || (transitionIndicated && indicators.includes('ORGANIC_OR_PEAT')) || (transitionIndicated && indicators.includes('MADE_GROUND'))) variabilityClass = 'HIGH';
  return {
    variabilityClass,
    dominantMappedUnit: ranked[0]?.label || null,
    secondaryMappedUnits: ranked.slice(1).map(item => item.label),
    distinctMappedUnits,
    transitionIndicated,
    materialIndicators: indicators,
    sampleCount: usable.length,
    siteSampleCount: usable.filter(sample => sample.scope === 'SITE').length,
    parcelSampleCount: usable.filter(sample => sample.scope === 'PARCEL').length,
    vicinitySampleCount: usable.filter(sample => sample.scope === 'VICINITY').length,
    sourceName: usable[0]?.sourceName || null,
    sourceScale: usable.find(sample => sample.sourceScale)?.sourceScale || null,
    evidenceType: 'MAPPED_SPATIAL_CONTEXT',
    limitation: 'Mapped and sampled context is screening evidence only. Nearby responses do not establish site strata, deposit thickness, groundwater conditions, density/state, engineering properties or an exact geological boundary position.'
  };
}

function range(values: Array<number | null>): [number, number] | null {
  const valid = values.filter((value): value is number => value !== null);
  return valid.length ? [Math.min(...valid), Math.max(...valid)] : null;
}

export async function sampleSoilGridsVariability(layout: SpatialSamplePoint[], existingSiteSoil?: ExistingSiteSoil, fetcher: SoilFetcher = fetchGenuineSoilGridsData): Promise<PedologicalVariabilitySummary> {
  const points = buildSoilSamplingLayout(layout);
  const results = await Promise.all(points.map(async point => {
    if (point.scope === 'SITE' && existingSiteSoil && cleanText(existingSiteSoil.usdaTextureClass) && finite(existingSiteSoil.topsoilSandPct) !== null && finite(existingSiteSoil.topsoilSiltPct) !== null && finite(existingSiteSoil.topsoilClayPct) !== null) return existingSiteSoil;
    return fetcher(point.lat, point.lng);
  }));
  const valid = results.filter(result => Boolean(result.success !== false && cleanText(result.usdaTextureClass) && finite(result.topsoilSandPct) !== null && finite(result.topsoilSiltPct) !== null && finite(result.topsoilClayPct) !== null));
  const textures = [...new Map(valid.map(result => [String(result.usdaTextureClass).toLocaleLowerCase(), String(result.usdaTextureClass)])).values()];
  const sandRange = range(valid.map(result => finite(result.topsoilSandPct)));
  const siltRange = range(valid.map(result => finite(result.topsoilSiltPct)));
  const clayRange = range(valid.map(result => finite(result.topsoilClayPct)));
  const rangeVaries = [sandRange, siltRange, clayRange].some(value => value !== null && value[0] !== value[1]);
  const first = valid[0];
  return {
    evidenceType: 'PEDOLOGICAL_MODEL',
    sampleCount: points.length,
    validSampleCount: valid.length,
    textureClasses: textures,
    topsoilSandPctRange: sandRange,
    topsoilSiltPctRange: siltRange,
    topsoilClayPctRange: clayRange,
    variationObserved: textures.length > 1 || rangeVaries,
    sourceName: first?.sourceName || 'ISRIC - World Soil Information (SoilGrids 2.0 Global Dataset)',
    sourceResolution: first?.datasetVersion || 'SoilGrids v2.0 (250m Resolution)',
    limitation: 'Multi-point SoilGrids sampling is modelled pedological context only. It does not provide bearing capacity, friction angle, cohesion, settlement, foundation recommendations, design groundwater, engineering hydraulic conductivity, density/state or deposit thickness.'
  };
}
