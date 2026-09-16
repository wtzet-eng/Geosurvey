import type { EvidenceItem, VerifiedSiteReport } from '../types';

type FetchLike = typeof fetch;
const FREEHOLD = 'https://services-eu1.arcgis.com/FH5XCsx8rYXqnjF5/arcgis/rest/services/Cadastral_Parcels_Freehold/FeatureServer/12';
const LEASEHOLD = 'https://services-eu1.arcgis.com/FH5XCsx8rYXqnjF5/arcgis/rest/services/Cadastral_Parcels_Leasehold/FeatureServer/13';
const PORTAL = 'https://data-osi.opendata.arcgis.com/';
const SOURCE = 'Tailte Éireann — High Value Dataset Cadastral Parcels';
const LIMITATION = 'Tailte Éireann states that open-data boundary/topographic data are generalised, may not accord with the Boundary Survey (Ireland) Acts, and are for reference only. This screening does not establish ownership, title quality, encumbrances, legal boundary position or a new surveyed boundary.';
const today = () => new Date().toISOString().slice(0, 10);

export interface IrelandCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'AMBIGUOUS';
  sourceName: string;
  sourceUrl: string;
  evidence: EvidenceItem[];
  parcel?: {
    parcelId: string;
    tenure: 'Freehold' | 'Leasehold';
    county: string | null;
    mappedAreaM2: number | null;
    registryGeometryPoints: [number, number][];
    overlappingTenures: Array<{ tenure: 'Freehold' | 'Leasehold'; parcelId: string; mappedAreaM2: number | null }>;
  };
}

function pointQuery(url: string, lat: number, lng: number): string {
  const p = new URLSearchParams({
    f: 'json', where: '1=1', geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: 'SP_ID,COUNTY_NAM,Shape__Area', returnGeometry: 'true'
  });
  return `${url}/query?${p}`;
}

async function queryLayer(url: string, lat: number, lng: number, fetcher: FetchLike): Promise<any[] | null> {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetcher(pointQuery(url, lat, lng), { headers: { Accept: 'application/json', 'User-Agent': 'SurveyLand/1.0 Ireland cadastre' }, signal: ctrl.signal });
    if (!r.ok) return null;
    const j: any = await r.json();
    return Array.isArray(j?.features) ? j.features : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

function num(v: unknown): number | null { return typeof v === 'number' && Number.isFinite(v) ? v : null; }
function ring(feature: any): [number, number][] {
  const r = feature?.geometry?.rings?.[0];
  return Array.isArray(r) ? r.filter((p: any) => Array.isArray(p) && p.length >= 2).map((p: any) => [Number(p[1]), Number(p[0])]) : [];
}

function unavailable(reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'AMBIGUOUS', claim: string): IrelandCadastreResult {
  return {
    success: false, reasonCode, sourceName: SOURCE, sourceUrl: PORTAL,
    evidence: [{ id: 'ie-tailte-cadastre-unavailable', category: 'Cadastre & identification', claim, status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: PORTAL,
      datasetDate: today(), spatialRelationship: 'Selected site coordinate', calculationMethod: 'Tailte Éireann freehold and leasehold ArcGIS point-intersection queries', confidence: 'Low', limitation: LIMITATION,
      value: { reasonCode } }]
  };
}

export async function queryIrelandCadastre(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<IrelandCadastreResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 51.2 || lat > 55.7 || lng < -11 || lng > -5) return unavailable('NO_DATA', 'The coordinate is outside expected Republic of Ireland cadastral coverage.');
  const [freehold, leasehold] = await Promise.all([queryLayer(FREEHOLD, lat, lng, fetcher), queryLayer(LEASEHOLD, lat, lng, fetcher)]);
  if (freehold === null && leasehold === null) return unavailable('SOURCE_UNAVAILABLE', 'Tailte Éireann cadastral services could not be queried reliably.');
  const rows = [
    ...(freehold || []).map(feature => ({ tenure: 'Freehold' as const, feature })),
    ...(leasehold || []).map(feature => ({ tenure: 'Leasehold' as const, feature }))
  ];
  if (!rows.length) return unavailable('NO_DATA', 'No Tailte Éireann freehold or leasehold cadastral polygon was returned at the selected coordinate.');
  if (rows.some(row => !row.feature?.attributes?.SP_ID)) return unavailable('AMBIGUOUS', 'A cadastral polygon was returned without a usable spatial parcel identifier; verify directly with Tailte Éireann.');
  const primary = rows.find(row => row.tenure === 'Leasehold') || rows[0];
  const a = primary.feature.attributes;
  const parcel = {
    parcelId: String(a.SP_ID), tenure: primary.tenure, county: typeof a.COUNTY_NAM === 'string' ? a.COUNTY_NAM : null,
    mappedAreaM2: num(a.Shape__Area), registryGeometryPoints: ring(primary.feature),
    overlappingTenures: rows.map(row => ({ tenure: row.tenure, parcelId: String(row.feature.attributes.SP_ID), mappedAreaM2: num(row.feature.attributes.Shape__Area) }))
  };
  const claim = `Tailte Éireann open cadastral data maps ${parcel.tenure.toLowerCase()} parcel ${parcel.parcelId} at the selected coordinate${parcel.county ? ` in County ${parcel.county}` : ''}${parcel.mappedAreaM2 ? `; the generalised map polygon is approximately ${Math.round(parcel.mappedAreaM2).toLocaleString('en-IE')} m²` : ''}.`;
  return { success: true, sourceName: SOURCE, sourceUrl: PORTAL, parcel, evidence: [{
    id: 'ie-tailte-cadastre', category: 'Cadastre & identification', claim, status: 'VERIFIED', sourceName: SOURCE, sourceUrl: primary.tenure === 'Leasehold' ? LEASEHOLD : FREEHOLD,
    datasetDate: '2026-06-30', spatialRelationship: 'Tailte Éireann generalised cadastral polygon containing the selected coordinate', calculationMethod: 'ArcGIS REST point-in-polygon query of public freehold and leasehold title-boundary layers', confidence: 'High', limitation: LIMITATION, value: parcel
  }] };
}

export function applyIrelandCadastreToReport(report: VerifiedSiteReport & Record<string, any>, result: IrelandCadastreResult, requestedAreaM2: number): void {
  report.evidenceRegistry = Array.isArray(report.evidenceRegistry) ? report.evidenceRegistry.filter(item => !/cadastre-spatial-index|cadastre-parcel-id/.test(item.id)) : [];
  report.evidenceRegistry.push(...result.evidence);
  if (!result.parcel) return;
  report.parcel = { ...report.parcel, status: 'VERIFIED', parcelId: result.parcel.parcelId, county: result.parcel.county || report.parcel.county, countryCode: 'IE',
    areaCalculatedM2: requestedAreaM2, isOfficialGeometry: false, cadastralSource: SOURCE, datasetDate: '2026-06-30', limitation: LIMITATION };
  report.ireland_cadastre = result.parcel;
}
