import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA' | 'STATE_NOT_AUTOMATED';
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  parcel?: { parcelId: string; nationalCadastralReference: string | null; officialAreaM2: number | null; geometryPoints: [number, number][]; state: string };
  evidence: EvidenceItem[];
  limitation: string;
}

const MV_WFS = 'https://www.geodaten-mv.de/dienste/inspire_cp_alkis_download';
const MV_PORTAL = 'https://www.geoportal-mv.de/portal/Geowebdienste/INSPIRE-Themen/Flurstuecke_Grundstuecke';
const SOURCE = 'GeoBasis-DE/M-V — INSPIRE-WFS Flurstücke/Grundstücke ALKIS';
const STATE = 'Mecklenburg-Vorpommern';
const today = () => new Date().toISOString().slice(0, 10);

function text(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  return s || null;
}
function numberValue(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function pointInRing(lat: number, lng: number, ring: [number, number][]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0], xi = ring[i][1], yj = ring[j][0], xj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi) inside = !inside;
  }
  return inside;
}
function extractMembers(xml: string) {
  return [...xml.matchAll(/<CadastralParcel\b[\s\S]*?<\/CadastralParcel>/g)].map(match => {
    const member = match[0];
    const label = text(member.match(/<label>([^<]+)<\/label>/)?.[1]);
    const ref = text(member.match(/<nationalCadastralReference>([^<]+)<\/nationalCadastralReference>/)?.[1]);
    const area = numberValue(member.match(/<areaValue[^>]*>([^<]+)<\/areaValue>/)?.[1]);
    const pos = member.match(/<gml:posList>([^<]+)<\/gml:posList>/)?.[1];
    const values = pos ? pos.trim().split(/\s+/).map(Number) : [];
    const ring: [number, number][] = [];
    for (let i = 0; i + 1 < values.length; i += 2) {
      if (Number.isFinite(values[i]) && Number.isFinite(values[i + 1])) ring.push([values[i], values[i + 1]]);
    }
    return { label, ref, area, ring };
  }).filter(item => item.ring.length >= 3);
}
function unavailable(reasonCode: GermanyCadastreResult['reasonCode'], claim: string, sourceUrl = MV_PORTAL): GermanyCadastreResult {
  const evidence: EvidenceItem = {
    id: 'de-cadastre-unavailable', category: 'Cadastre & identification', claim, status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE, sourceUrl, datasetDate: today(), spatialRelationship: 'Selected site coordinate',
    calculationMethod: 'State-specific official cadastral source routing; no negative inference from failed acquisition',
    confidence: 'Low',
    limitation: 'A failed or unimplemented lookup is not evidence that a parcel does not exist. Official cadastral verification remains required.',
    value: { reasonCode }
  };
  return { success: false, reasonCode, sourceName: SOURCE, sourceUrl, datasetDate: today(), evidence: [evidence], limitation: evidence.limitation };
}

export async function queryGermanyCadastre(lat: number, lng: number, state: string | null | undefined, fetcher: typeof fetch = fetch): Promise<GermanyCadastreResult> {
  const normalizedState = String(state || '').trim().toLowerCase();
  const stateMatches = normalizedState === STATE.toLowerCase();
  const stateUnknown = !normalizedState;
  if (!stateMatches && !stateUnknown) {
    return unavailable('STATE_NOT_AUTOMATED', "Germany's cadastral data are administered by the federal states. LandSurf currently has an automated official parcel lookup for Mecklenburg-Vorpommern; this German state is not yet automated.", 'https://www.bkg.bund.de');
  }
  const e = 0.00012;
  const bbox = [lat - e, lng - e, lat + e, lng + e, 'urn:ogc:def:crs:EPSG::4326'].join(',');
  const params = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'cp:CadastralParcel', srsName: 'EPSG:4326', bbox, count: '100' });
  const url = MV_WFS + '?' + params.toString();
  let xml = '';
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/gml+xml, text/xml', 'User-Agent': 'LandSurf/1.0 Germany cadastral evidence' } });
    if (!response.ok) return unavailable('SOURCE_UNAVAILABLE', 'The official Mecklenburg-Vorpommern ALKIS parcel service returned HTTP ' + response.status + '.', url);
    xml = await response.text();
  } catch {
    return unavailable('SOURCE_UNAVAILABLE', 'The official Mecklenburg-Vorpommern ALKIS parcel service could not be reached.', url);
  }
  const candidates = extractMembers(xml);
  if (!candidates.length) return unavailable('NO_DATA', 'The official Mecklenburg-Vorpommern ALKIS parcel service returned no parcel geometry for the selected coordinate.', url);
  const selected = candidates.find(candidate => pointInRing(lat, lng, candidate.ring));
  if (!selected || !selected.label) return unavailable('MALFORMED_DATA', 'The official Mecklenburg-Vorpommern ALKIS service returned parcel data, but no single containing parcel could be resolved.', url);
  const parcel = { parcelId: 'Flurstück ' + selected.label, nationalCadastralReference: selected.ref, officialAreaM2: selected.area, geometryPoints: selected.ring, state: STATE };
  const claim = 'The official Mecklenburg-Vorpommern ALKIS service identifies ' + parcel.parcelId + (parcel.officialAreaM2 !== null ? ' with a registered area of ' + parcel.officialAreaM2 + ' m²' : '') + ' at the selected coordinate.';
  const evidence: EvidenceItem = {
    id: 'de-mv-alkis-cadastre', category: 'Cadastre & identification', claim, status: 'VERIFIED',
    sourceName: SOURCE, sourceUrl: url, datasetDate: today(),
    spatialRelationship: 'Official INSPIRE cadastral parcel polygon containing the selected coordinate',
    calculationMethod: 'Mecklenburg-Vorpommern INSPIRE-WFS cp:CadastralParcel bbox query in EPSG:4326; containing polygon resolved by point-in-polygon test',
    confidence: 'High',
    limitation: 'The returned parcel polygon is official cadastral evidence, but this report does not establish ownership, title, easements or a legally re-surveyed boundary. Those matters require the competent cadastral and land-register authorities.',
    value: parcel
  };
  return { success: true, sourceName: SOURCE, sourceUrl: url, datasetDate: today(), parcel, evidence: [evidence], limitation: evidence.limitation };
}

export function applyGermanyCadastreToReport(report: VerifiedSiteReport & Record<string, any>, result: GermanyCadastreResult, requestedAreaM2: number): void {
  report.evidenceRegistry = Array.isArray(report.evidenceRegistry) ? report.evidenceRegistry.filter(item => !/^cadastre-(spatial-index|parcel-id)$/.test(item.id)) : [];
  report.evidenceRegistry.push(...result.evidence);
  if (!result.success || !result.parcel) return;
  report.parcel = { ...report.parcel, status: 'VERIFIED', parcelId: result.parcel.parcelId, countryCode: 'DE', geometryPoints: result.parcel.geometryPoints, isOfficialGeometry: true, areaCalculatedM2: requestedAreaM2, officialAreaM2: result.parcel.officialAreaM2 ?? undefined, cadastralSource: SOURCE, datasetDate: result.datasetDate, limitation: result.limitation };
  report.germany_cadastre = result.parcel;
}
export const GERMANY_CADASTRE_SOURCE = { sourceName: SOURCE, serviceUrl: MV_WFS, portalUrl: MV_PORTAL };
