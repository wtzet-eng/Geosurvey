import { EvidenceItem } from '../types';

const BASE = 'https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1/collections/perceel/items';
const SOURCE = 'Kadaster / PDOK — BRK Kadastrale Kaart (perceel)';
const LIMITATION = 'The cadastral map shows approximate parcel positions and cannot establish surveyed boundaries, ownership, easements or contamination. Check the current BRK extract and survey before purchase.';
type Point = [number, number];
type Reason = 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA' | 'AMBIGUOUS';
export interface NetherlandsCadastreResult {
  success: boolean; reasonCode?: Reason; sourceName: string; sourceUrl: string;
  datasetDate: string; evidence: EvidenceItem[]; limitation: string;
  parcel?: { parcelId: string; registeredAreaM2: number | null; registryGeometryPoints: Point[]; registrationDate: string | null };
}
const today = () => new Date().toISOString().slice(0, 10);
function inRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (!a || !b || !Number.isFinite(a[0]) || !Number.isFinite(a[1]) || !Number.isFinite(b[0]) || !Number.isFinite(b[1])) return false;
    const crosses = (a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }
  return inside;
}
function matchingOuter(geometry: any, lat: number, lng: number): number[][] | null {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  if (!Array.isArray(polygons)) return null;
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !Array.isArray(polygon[0]) || polygon[0].length < 4) continue;
    if (inRing(lng, lat, polygon[0]) && !polygon.slice(1).some((hole: any) => Array.isArray(hole) && inRing(lng, lat, hole))) return polygon[0];
  }
  return null;
}
function unavailable(reasonCode: Reason, claim: string, url = BASE): NetherlandsCadastreResult {
  const evidence: EvidenceItem = {
    id: 'nl-pdok-cadastre-unavailable', category: 'Cadastre & identification', claim,
    status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: url,
    datasetDate: today(), spatialRelationship: 'Selected site coordinate',
    calculationMethod: 'PDOK BRK OGC Features bbox search followed by point-in-polygon selection',
    confidence: 'Low', limitation: 'No conclusive parcel match was returned; this does not establish that no registered parcel exists. Check Kadaster directly.',
    value: { reasonCode }
  };
  return { success: false, reasonCode, sourceName: SOURCE, sourceUrl: url, datasetDate: today(), evidence: [evidence], limitation: evidence.limitation };
}
export async function queryNetherlandsCadastre(lat: number, lng: number, fetcher: typeof fetch = fetch): Promise<NetherlandsCadastreResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 50 || lat > 54 || lng < 3 || lng > 8) return unavailable('NO_DATA', 'Selected coordinate is outside the Dutch European parcel map.');
  const dx = 0.00004 / Math.max(0.5, Math.cos(lat * Math.PI / 180)), dy = 0.00004;
  const params = new URLSearchParams({ bbox: [lng - dx, lat - dy, lng + dx, lat + dy].join(','), limit: '100' });
  const url = BASE + '?' + params;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 9000);
  let body: any;
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/geo+json' }, signal: controller.signal });
    if (!response.ok) return unavailable('SOURCE_UNAVAILABLE', 'PDOK parcel service did not return a successful response.', url);
    body = await response.json();
  } catch { return unavailable('SOURCE_UNAVAILABLE', 'PDOK parcel service was unavailable or timed out.', url); }
  finally { clearTimeout(timer); }
  if (!Array.isArray(body?.features) || body.features.length >= 100 || typeof body?.numberMatched !== 'undefined' && body.numberMatched > 100)
    return unavailable('MALFORMED_DATA', 'PDOK returned an unexpected or truncated parcel result.', url);
  const matches = body.features.map((feature: any) => ({ feature, ring: matchingOuter(feature?.geometry, lat, lng) })).filter((entry: any) => entry.ring);
  if (!matches.length) return unavailable('NO_DATA', 'No mapped parcel polygon contains the selected coordinate.', url);
  if (matches.length !== 1) return unavailable('AMBIGUOUS', 'Multiple mapped parcels contain the selected coordinate; resolve with Kadaster.', url);
  const { feature, ring } = matches[0], p = feature.properties || {};
  const gemeente = String(p.kadastrale_gemeente_waarde || '').trim(), sectie = String(p.sectie || '').trim(), nummer = String(p.perceelnummer || '').trim();
  if (!gemeente || !sectie || !nummer) return unavailable('MALFORMED_DATA', 'PDOK parcel lacks required cadastral identifier fields.', url);
  const area = Number(p.kadastrale_grootte_waarde);
  const parcel = {
    parcelId: `${gemeente} ${sectie} ${nummer}`,
    registeredAreaM2: Number.isFinite(area) && area > 0 ? area : null,
    registryGeometryPoints: ring.map((pair: number[]) => [pair[1], pair[0]] as Point),
    registrationDate: typeof p.tijdstip_registratie === 'string' ? p.tijdstip_registratie : null
  };
  const evidence: EvidenceItem = {
    id: 'nl-pdok-cadastre', category: 'Cadastre & identification',
    claim: `PDOK BRK map identifies parcel ${parcel.parcelId} at the selected coordinate${parcel.registeredAreaM2 ? `, with registered area ${parcel.registeredAreaM2} m²` : ''}.`,
    status: 'VERIFIED', sourceName: SOURCE, sourceUrl: url,
    datasetDate: parcel.registrationDate || today(), spatialRelationship: 'Mapped parcel containing selected coordinate',
    calculationMethod: 'PDOK BRK OGC Features spatial bbox query and polygon containment (including interior holes)',
    confidence: 'Medium', limitation: LIMITATION, value: parcel
  };
  return { success: true, sourceName: SOURCE, sourceUrl: url, datasetDate: evidence.datasetDate, evidence: [evidence], parcel, limitation: LIMITATION };
}
export function applyNetherlandsCadastreToReport(report: any, result: NetherlandsCadastreResult, requestedAreaM2: number): void {
  report.evidenceRegistry = Array.isArray(report.evidenceRegistry) ? report.evidenceRegistry.filter((item: any) => !['cadastre-spatial-index', 'cadastre-parcel-id'].includes(item?.id)) : [];
  report.evidenceRegistry.push(...result.evidence);
  if (!result.parcel) return;
  report.parcel = { ...report.parcel, status: 'VERIFIED', parcelId: result.parcel.parcelId,
    countryCode: 'NL', isOfficialGeometry: false, areaCalculatedM2: requestedAreaM2,
    officialAreaM2: result.parcel.registeredAreaM2 ?? undefined, cadastralSource: SOURCE,
    datasetDate: result.datasetDate, limitation: LIMITATION };
  report.netherlands_cadastre = { sourceName: SOURCE, sourceUrl: result.sourceUrl, parcel: result.parcel, limitation: LIMITATION };
}
