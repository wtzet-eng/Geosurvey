import { EvidenceItem } from '../types';

type FetchLike = typeof fetch;

export interface ItalyCadastreParcel {
  localId: string | null;
  parcelId: string;
  nationalCadastralReference: string | null;
  municipalityCode: string | null;
  sheet: string | null;
  areaM2: number | null;
}

export interface ItalyCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  parcel?: ItalyCadastreParcel;
  evidence: EvidenceItem[];
  limitation: string;
}

const SOURCE_NAME = 'Agenzia delle Entrate — Cartografia catastale';
const WMS_URL = 'https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php';
const PORTAL = 'https://geoportale.cartografia.agenziaentrate.gov.it/age-inspire/srv/ita/catalog.search#/home';
const today = () => new Date().toISOString().slice(0, 10);

async function fetchText(fetcher: FetchLike, url: string, timeoutMs = 9000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'text/html, text/plain, application/xml', 'User-Agent': 'GroundSurf/1.0 Italy cadastral evidence' },
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

function clean(value: unknown): string | null {
  const text = String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
  return text || null;
}

function field(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^(){}|[\]\\]/g, '\\$&');
  const pattern = new RegExp('<(?:th|td)[^>]*>\\s*' + escaped + '\\s*</(?:th|td)>\\s*<td[^>]*>([\\s\\S]*?)</td>', 'i');
  const match = html.match(pattern);
  return clean(match?.[1]);
}

function anyField(html: string, labels: string[]): string | null {
  for (const label of labels) {
    const value = field(html, label);
    if (value) return value;
  }
  return null;
}

function queryUrl(lat: number, lng: number): string {
  // Agenzia delle Entrate publishes the cadastral WMS with EPSG:4326-compatible
  // WMS 1.1.1 requests. A very small geographic envelope is sufficient for
  // GetFeatureInfo and avoids inventing parcel geometry from a raster response.
  const delta = 0.00005;
  const params = new URLSearchParams({
    REQUEST: 'GetFeatureInfo',
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    SRS: 'EPSG:4326',
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
    INFO_FORMAT: 'text/html',
    LAYERS: 'CP.CadastralParcel',
    QUERY_LAYERS: 'CP.CadastralParcel',
    STYLES: '',
    BBOX: [lng - delta, lat - delta, lng + delta, lat + delta].map(v => v.toFixed(8)).join(','),
    WIDTH: '101',
    HEIGHT: '101',
    X: '50',
    Y: '50'
  });
  return WMS_URL + '?' + params.toString();
}

function unavailable(reasonCode: ItalyCadastreResult['reasonCode'], claim: string): ItalyCadastreResult {
  const evidence: EvidenceItem = {
    id: 'it-ade-cadastre-unavailable',
    category: 'Cadastre & identification',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE_NAME,
    sourceUrl: WMS_URL,
    datasetDate: today(),
    spatialRelationship: 'Selected site coordinate',
    calculationMethod: 'Agenzia delle Entrate cadastral WMS GetFeatureInfo query against CP.CadastralParcel',
    confidence: 'Low',
    limitation: 'The Agenzia delle Entrate cadastral map is an official cartographic source. A failed or empty GetFeatureInfo response is not evidence that no parcel exists; the official cadastral Geoportale and cadastral records remain the verification route. The cartographic service covers Italian territory except the autonomous provinces of Trento and Bolzano.',
    value: { reasonCode }
  };
  return { success: false, reasonCode, sourceName: SOURCE_NAME, sourceUrl: WMS_URL, datasetDate: today(), evidence: [evidence], limitation: evidence.limitation };
}

export async function queryItalyCadastre(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<ItalyCadastreResult> {
  const url = queryUrl(lat, lng);
  const html = await fetchText(fetcher, url);
  if (!html) return unavailable('SOURCE_UNAVAILABLE', 'The Agenzia delle Entrate cadastral map service could not be reached or returned no readable feature information.');
  if (/ServiceException|exception|error/i.test(html) && !/InspireId|Cadastral/i.test(html)) {
    return unavailable('MALFORMED_DATA', 'The Agenzia delle Entrate cadastral service responded, but the feature-information response could not be safely interpreted.');
  }

  const localId = anyField(html, ['InspireId localId', 'inspireId localId', 'localId']);
  const sheet = anyField(html, ['foglio', 'Foglio']);
  const parcelNumber = anyField(html, ['particella', 'Particella', 'numero particella', 'Numero Particella']);
  const municipalityCode = anyField(html, ['codice comune', 'Codice Comune', 'Belfiore']);
  const section = anyField(html, ['sezione', 'Sezione']);
  const label = parcelNumber || localId;
  if (!label) return unavailable('NO_DATA', 'The official cadastral map was queried at the selected coordinate but returned no identifiable cadastral parcel feature.');

  const parcelId = section ? section + ' / ' + label : label;
  const nationalCadastralReference = municipalityCode && sheet && parcelNumber
    ? [municipalityCode, sheet, parcelNumber].join(' / ')
    : null;

  const parcel: ItalyCadastreParcel = {
    localId,
    parcelId,
    nationalCadastralReference,
    municipalityCode,
    sheet,
    areaM2: null
  };

  const evidence: EvidenceItem = {
    id: 'it-ade-cadastre',
    category: 'Cadastre & identification',
    claim: `Agenzia delle Entrate cadastral cartography identifies cadastral parcel ${parcelId}${sheet ? ` (sheet ${sheet})` : ''} at the selected location.`,
    status: 'VERIFIED',
    sourceName: SOURCE_NAME,
    sourceUrl: url,
    datasetDate: today(),
    spatialRelationship: 'Official cadastral map feature returned at the selected coordinate',
    calculationMethod: 'Agenzia delle Entrate WMS 1.1.1 GetFeatureInfo query on CP.CadastralParcel',
    confidence: 'High',
    limitation: 'This is official cadastral cartographic evidence, not proof of ownership, title, easements or encumbrances. The WMS does not provide a reliable parcel polygon to GroundSurf; boundary/legal questions require the official cadastral records and survey documentation.',
    value: parcel
  };

  return { success: true, sourceName: SOURCE_NAME, sourceUrl: url, datasetDate: today(), parcel, evidence: [evidence], limitation: evidence.limitation };
}

export function applyItalyCadastreToReport(report: any, result: ItalyCadastreResult, requestedAreaM2: number): void {
  if (!report) return;
  report.evidenceRegistry = Array.isArray(report.evidenceRegistry) ? report.evidenceRegistry : [];
  report.evidenceRegistry.push(...result.evidence);
  if (!result.success || !result.parcel) return;
  const p = result.parcel;
  report.parcel = {
    ...(report.parcel || {}),
    status: 'VERIFIED',
    parcelId: p.parcelId,
    countryCode: 'IT',
    officialAreaM2: report.parcel?.officialAreaM2 ?? null,
    areaCalculatedM2: requestedAreaM2,
    cadastralSource: SOURCE_NAME,
    isOfficialGeometry: false,
    limitation: result.limitation
  };
}

export const ITALY_CADASTRE_SOURCE = {
  sourceName: SOURCE_NAME,
  serviceUrl: WMS_URL,
  viewServiceUrl: WMS_URL,
  viewLayer: 'CP.CadastralParcel',
  portalUrl: PORTAL
};
