import type { CadastralParcelInfo, EvidenceItem } from '../types';

const WMS_URL = 'https://api.uredjenazemlja.hr/services/inspire/cp_wms/wms';
const PARCEL_INFO_URL = 'https://oss.uredjenazemlja.hr/oss/public/cad/parcel-info';

export interface CroatiaCadastreResult {
  success: boolean;
  reasonCode?: string;
  message?: string;
  sourceName: string;
  sourceUrl: string;
  parcel?: {
    parcelId: string;
    parcelNumber: string;
    cadMunicipalityId?: number;
    cadMunicipalityRegNum?: string;
    cadMunicipalityName?: string;
    address?: string;
    officialAreaM2?: number;
    hasBuildingRight?: boolean;
    graphic?: boolean;
  };
  evidence?: EvidenceItem[];
}

async function fetchText(url: string, timeoutMs = 30000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/html,application/xhtml+xml' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function queryUrl(lat: number, lng: number): string {
  // WMS 1.3.0 uses latitude,longitude axis order for EPSG:4326.
  const delta = 0.0002;
  const params = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo',
    LAYERS: 'CP.CadastralParcel', STYLES: 'CP.CadastralParcel.Default',
    QUERY_LAYERS: 'CP.CadastralParcel', CRS: 'EPSG:4326',
    BBOX: `${lat - delta},${lng - delta},${lat + delta},${lng + delta}`,
    WIDTH: '400', HEIGHT: '400', I: '200', J: '200',
    INFO_FORMAT: 'text/html', FEATURE_COUNT: '1'
  });
  return `${WMS_URL}?${params.toString()}`;
}

export function parseCroatiaCadastreFeatureInfo(html: string): { parcelId: string; parcelNumber: string; cadMunicipalityRegNum: string } | null {
  const row = html.match(/<tr>\s*<td>[^<]*<\/td>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>/i);
  if (!row) return null;
  const parcelId = row[1].trim();
  const parcelNumber = row[2].trim();
  const cadMunicipalityRegNum = row[3].trim();
  return parcelId && parcelNumber && cadMunicipalityRegNum ? { parcelId, parcelNumber, cadMunicipalityRegNum } : null;
}

export async function queryCroatiaCadastre(lat: number, lng: number): Promise<CroatiaCadastreResult> {
  const sourceName = 'Državna geodetska uprava (DGU) — Uređena zemlja INSPIRE cadastral parcels';
  try {
    const html = await fetchText(queryUrl(lat, lng));
    const match = parseCroatiaCadastreFeatureInfo(html);
    if (!match) {
      return { success: false, reasonCode: 'PARCEL_NOT_IDENTIFIED', message: 'DGU cadastral map did not identify a parcel at the selected coordinate.', sourceName, sourceUrl: WMS_URL };
    }

    const infoUrl = `${PARCEL_INFO_URL}?parcelId=${encodeURIComponent(match.parcelId)}`;
    const infoResponse = await fetch(infoUrl, { headers: { Accept: 'application/json', 'User-Agent': 'LandSurf/1.0' } });
    if (!infoResponse.ok) throw new Error(`parcel-info HTTP ${infoResponse.status}`);
    const info = await infoResponse.json() as any;
    const officialAreaM2 = Number(info?.area);
    return {
      success: true,
      sourceName,
      sourceUrl: WMS_URL,
      parcel: {
        parcelId: String(info?.parcelId ?? match.parcelId),
        parcelNumber: String(info?.parcelNumber ?? match.parcelNumber),
        cadMunicipalityId: Number.isFinite(Number(info?.cadMunicipalityId)) ? Number(info.cadMunicipalityId) : undefined,
        cadMunicipalityRegNum: String(info?.cadMunicipalityRegNum ?? match.cadMunicipalityRegNum),
        cadMunicipalityName: info?.cadMunicipalityName,
        address: info?.address,
        officialAreaM2: Number.isFinite(officialAreaM2) ? officialAreaM2 : undefined,
        hasBuildingRight: typeof info?.hasBuildingRight === 'boolean' ? info.hasBuildingRight : undefined,
        graphic: typeof info?.graphic === 'boolean' ? info.graphic : undefined
      }
    };
  } catch (error) {
    return { success: false, reasonCode: 'SOURCE_UNAVAILABLE', message: error instanceof Error ? error.message : 'DGU cadastral service unavailable.', sourceName, sourceUrl: WMS_URL };
  }
}

export function applyCroatiaCadastreToReport(report: any, result: CroatiaCadastreResult, areaSizeM2: number, lat?: number, lng?: number): void {
  if (!result.success || !result.parcel) return;
  const p = result.parcel;
  const today = new Date().toISOString().slice(0, 10);
  report.parcel = {
    ...report.parcel,
    status: 'VERIFIED', parcelId: p.parcelNumber, countryCode: 'HR',
    commune: p.cadMunicipalityName || report.parcel?.commune,
    geometryPoints: undefined, geometryWkt: undefined, isOfficialGeometry: false,
    areaCalculatedM2: areaSizeM2, officialAreaM2: p.officialAreaM2,
    cadastralSource: result.sourceName, datasetDate: today,
    limitation: 'Parcel identity and registered area were retrieved from DGU. The official boundary is displayed from the DGU cadastral WMS; vector boundary coordinates were not treated as a surveyed legal boundary.'
  } satisfies CadastralParcelInfo;
  report.croatia_cadastre = { ...p, boundaryMapService: WMS_URL };
  report.evidenceRegistry = Array.isArray(report.evidenceRegistry) ? report.evidenceRegistry.filter((e: any) => e.id !== 'cadastre-spatial-index') : [];
  report.evidenceRegistry.push({
    id: 'hr-cadastre-parcel', category: 'Cadastre & Identification',
    claim: `DGU cadastral parcel ${p.parcelNumber} in cadastral municipality ${p.cadMunicipalityName || p.cadMunicipalityRegNum || 'unknown'}; registered area ${p.officialAreaM2 ?? 'not returned'} m².`,
    status: 'VERIFIED', sourceName: result.sourceName, sourceUrl: result.sourceUrl, datasetDate: today,
    spatialRelationship: `DGU WMS parcel identified at ${Number(lat).toFixed(6)}°N, ${Number(lng).toFixed(6)}°E`,
    calculationMethod: 'DGU INSPIRE WMS GetFeatureInfo (EPSG:4326) followed by Uređena zemlja parcel-info lookup',
    confidence: 'High', limitation: 'Official cadastral screening evidence; ownership, encumbrances and legal boundary conclusiveness require the competent cadastral/land-register records.',
    value: { parcelId: p.parcelNumber, registeredParcelId: p.parcelId, officialAreaM2: p.officialAreaM2, cadMunicipalityRegNum: p.cadMunicipalityRegNum }
  });
}
