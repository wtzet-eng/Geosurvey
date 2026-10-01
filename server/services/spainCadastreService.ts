import { EvidenceItem } from '../types';

type FetchLike = typeof fetch;

export interface SpainCadastreParcel {
  localId: string | null;
  parcelId: string;
  nationalCadastralReference: string | null;
  areaM2: number | null;
  geometryPoints?: [number, number][];
  referencePoint?: [number, number];
}

export interface SpainCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  parcel?: SpainCadastreParcel;
  geometryPoints?: [number, number][];
  evidence: EvidenceItem[];
  limitation: string;
  viewServiceUrl?: string;
  viewLayer?: string;
  viewStyle?: string;
  viewAttribution?: string;
}

const SOURCE_NAME = 'Dirección General del Catastro — INSPIRE Cadastral Parcel';
const WFS_URL = 'https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx';
const WMS_URL = 'https://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx';
const today = () => new Date().toISOString().slice(0, 10);

async function fetchText(fetcher: FetchLike, url: string, timeoutMs = 9000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/gml+xml, application/xml, text/xml', 'User-Agent': 'GroundSurf/1.0 Spain cadastral evidence' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function xmlText(block: string, names: string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^{}()|[\]\\]/g, '\\$&');
    const match = block.match(new RegExp('<(?:[\\w.-]+:)?' + escaped + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?' + escaped + '>', 'i'));
    if (match) {
      const value = match[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\s+/g, ' ').trim();
      if (value) return value;
    }
  }
  return null;
}

function xmlNumber(block: string, names: string[]): number | null {
  const value = xmlText(block, names);
  if (!value) return null;
  const normalized = value.replace(/\\./g, '').replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function firstOuterRing(block: string): [number, number][] | undefined {
  const posList = block.match(/<(?:[\\w.-]+:)?posList(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?posList>/i);
  if (!posList) return undefined;
  const values = posList[1].trim().split(/\\s+/).map(Number).filter(Number.isFinite);
  if (values.length < 6) return undefined;

  // Catastro examples use EPSG:4326 when requested with srsName=EPSG::4326.
  // GML 3.2 uses lat/lon axis order for EPSG:4326, so detect the two plausible
  // ranges and convert to the application's [lat,lng] representation.
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < values.length; i += 2) {
    const a = values[i], b = values[i + 1];
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) pairs.push([a, b]);
    else if (Math.abs(b) <= 90 && Math.abs(a) <= 180) pairs.push([b, a]);
  }
  return pairs.length >= 3 ? pairs : undefined;
}

function pointInRing(point: [number, number], ring: [number, number][]): boolean {
  const [lat, lng] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lngI] = ring[i];
    const [latJ, lngJ] = ring[j];
    const crosses = ((lngI > lng) !== (lngJ > lng)) &&
      (lat < (latJ - latI) * (lng - lngI) / ((lngJ - lngI) || Number.EPSILON) + latI);
    if (crosses) inside = !inside;
  }
  return inside;
}

function centroid(points: [number, number][]): [number, number] {
  return points.reduce((sum, p) => [sum[0] + p[0], sum[1] + p[1]], [0, 0]).map(v => v / points.length) as [number, number];
}

function queryUrl(lat: number, lng: number): string {
  const delta = 0.002;
  const params = new URLSearchParams({
    service: 'WFS',
    version: '1.1.1',
    request: 'GetFeature',
    typeName: 'cp:CadastralParcel',
    srsName: 'EPSG::4326',
    outputFormat: 'GML3',
    BBOX: `${(lng - delta).toFixed(6)},${(lat - delta).toFixed(6)},${(lng + delta).toFixed(6)},${(lat + delta).toFixed(6)}`
  });
  return `${WFS_URL}?${params.toString()}`;
}

function unavailable(reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA', claim: string): SpainCadastreResult {
  const evidence: EvidenceItem = {
    id: 'es-catastro-cadastre-unavailable',
    category: 'Cadastre & identification',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE_NAME,
    sourceUrl: WFS_URL,
    datasetDate: today(),
    spatialRelationship: 'Selected site coordinate',
    calculationMethod: 'Spanish Catastro INSPIRE CadastralParcel WFS BBOX query',
    confidence: 'Low',
    limitation: 'The national DG Catastro INSPIRE service covers the areas under the Directorate General for Cadastre. Navarra and the Basque Country use their own cadastral authorities, so an empty national query there is not evidence that no parcel exists.',
    value: { reasonCode }
  };
  return { success: false, reasonCode, sourceName: SOURCE_NAME, sourceUrl: WFS_URL, datasetDate: today(), evidence: [evidence], limitation: evidence.limitation };
}

export async function querySpainCadastre(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<SpainCadastreResult> {
  const url = queryUrl(lat, lng);
  const xml = await fetchText(fetcher, url);
  if (!xml) return unavailable('SOURCE_UNAVAILABLE', 'The Spanish Catastro INSPIRE cadastral service could not be reached.');

  const memberMatches = [...xml.matchAll(/<(?:[\\w.-]+:)?featureMember(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?featureMember>/gi)];
  if (!memberMatches.length) return unavailable('NO_DATA', 'The Spanish Catastro INSPIRE service returned no cadastral parcel in the immediate search envelope.');

  const site: [number, number] = [lat, lng];
  const candidates = memberMatches.map(match => {
    const block = match[1];
    const ring = firstOuterRing(block);
    return { block, ring, contains: Boolean(ring && pointInRing(site, ring)) };
  });
  const selected = candidates.find(candidate => candidate.contains) || candidates.find(candidate => candidate.ring) || candidates[0];

  const parcelId = xmlText(selected.block, ['nationalCadastralReference', 'label', 'inspireId']) || 'Unknown cadastral parcel';
  const nationalRef = xmlText(selected.block, ['nationalCadastralReference']);
  const areaM2 = xmlNumber(selected.block, ['areaValue', 'area']);
  const localId = xmlText(selected.block, ['localId', 'inspireId']);
  const points = selected.ring;
  if (!points || points.length < 3 || parcelId === 'Unknown cadastral parcel') {
    return unavailable('MALFORMED_DATA', 'The Spanish Catastro feature was returned without a usable parcel identifier or geometry.');
  }

  const referencePoint = centroid(points);
  const parcel: SpainCadastreParcel = { localId, parcelId, nationalCadastralReference: nationalRef || parcelId, areaM2, geometryPoints: points, referencePoint };
  const evidence: EvidenceItem = {
    id: 'es-catastro-cadastre',
    category: 'Cadastre & identification',
    claim: `Dirección General del Catastro identifies parcel ${parcel.parcelId}${areaM2 !== null ? ` with mapped area ${areaM2.toLocaleString('es-ES')} m²` : ''} at the selected location.`,
    status: 'VERIFIED',
    sourceName: SOURCE_NAME,
    sourceUrl: url,
    datasetDate: today(),
    spatialRelationship: selected.contains ? 'Official cadastral parcel polygon containing the selected coordinate' : 'Official cadastral parcel returned in the immediate search envelope',
    calculationMethod: 'Catastro INSPIRE CadastralParcel WFS BBOX query with local point-in-polygon selection',
    confidence: selected.contains ? 'High' : 'Medium',
    value: { parcelId: parcel.parcelId, nationalCadastralReference: parcel.nationalCadastralReference, areaM2, geometryPointCount: points.length },
    limitation: 'This is official cadastral map evidence. It does not establish ownership, title rights, easements or other land-register rights, and it is not a substitute for a surveyed boundary.'
  };

  return {
    success: true,
    sourceName: SOURCE_NAME,
    sourceUrl: url,
    datasetDate: today(),
    parcel,
    geometryPoints: points,
    evidence: [evidence],
    limitation: evidence.limitation,
    viewServiceUrl: WMS_URL,
    viewLayer: 'CP.CadastralParcel',
    viewStyle: 'BoundariesOnly',
    viewAttribution: '© Dirección General del Catastro — INSPIRE'
  };
}

export function applySpainCadastreToReport(report: any, result: SpainCadastreResult, fallbackAreaM2?: number): void {
  if (!report || !result?.success || !result.parcel) {
    if (result?.evidence?.length) report?.evidenceRegistry?.push(...result.evidence);
    return;
  }
  const parcel = result.parcel;
  report.parcel = {
    ...(report.parcel || {}),
    status: 'VERIFIED',
    isOfficialGeometry: Boolean(parcel.geometryPoints?.length),
    parcelId: parcel.parcelId,
    nationalCadastralReference: parcel.nationalCadastralReference,
    officialAreaM2: parcel.areaM2 ?? report.parcel?.officialAreaM2 ?? fallbackAreaM2 ?? null,
    areaCalculatedM2: report.parcel?.areaCalculatedM2 ?? fallbackAreaM2 ?? null,
    geometryPoints: parcel.geometryPoints,
    cadastralSource: 'Dirección General del Catastro / INSPIRE'
  };
  report.evidenceRegistry.push(...result.evidence);
}

export const SPAIN_CADASTRAL_CONTEXT = {
  viewServiceUrl: WMS_URL,
  viewLayer: 'CP.CadastralParcel',
  viewStyle: 'BoundariesOnly',
  attribution: '© Dirección General del Catastro — INSPIRE'
};
