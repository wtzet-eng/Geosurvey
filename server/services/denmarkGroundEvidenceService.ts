import { EvidenceItem } from '../types';

export type DenmarkGroundEvidence = EvidenceItem;
type FetchLike = typeof fetch;

const GEUS = 'De Nationale Geologiske Undersøgelser for Danmark og Grønland (GEUS)';
const GEUS_WFS = 'https://data.geus.dk/geusmap/ows/4258.jsp';
const GEUS_PORTAL = 'https://data.geus.dk/geusmap/';
const PLANDATA_WFS = 'https://geoserver.plandata.dk/geoserver/wfs';
const PLANDATA_PORTAL = 'https://www.plandata.dk/webservices/introduktion-til-webservices/wfs';
const today = () => new Date().toISOString().slice(0, 10);

function bbox(lat: number, lng: number, radiusM: number): string {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  return `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
}

function geusUrl(layer: string, lat: number, lng: number, radiusM: number, maxFeatures: number): string {
  const params = new URLSearchParams({ SERVICE: 'WFS', VERSION: '1.0.0', REQUEST: 'GetFeature', TYPENAME: layer, SRSNAME: 'EPSG:4258', BBOX: bbox(lat, lng, radiusM), MAXFEATURES: String(maxFeatures), OUTPUTFORMAT: 'geojson' });
  return `${GEUS_WFS}?${params}`;
}

function plandataUrl(typeName: string, lat: number, lng: number): string {
  const params = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: typeName, bbox: `${bbox(lat, lng, 12)},EPSG:4326`, srsName: 'EPSG:4326', count: '10', outputFormat: 'application/json' });
  return `${PLANDATA_WFS}?${params}`;
}

async function fetchFeatures(fetcher: FetchLike, url: string, timeoutMs = 9000): Promise<any[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/geo+json, application/json, */*', 'User-Agent': 'LandSurf/1.0 Denmark national evidence' }, signal: controller.signal });
    if (!response.ok) return null;
    const json: any = await response.json();
    return Array.isArray(json?.features) ? json.features : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function props(feature: any): Record<string, unknown> { return feature?.properties && typeof feature.properties === 'object' ? feature.properties : {}; }
function text(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return !cleaned || /^null[:\s]/i.test(cleaned) ? null : cleaned;
}
function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') { const n = Number(value.replace(',', '.')); return Number.isFinite(n) ? n : null; }
  return null;
}
function pick(p: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (p[key] !== undefined && p[key] !== null && String(p[key]).trim() !== '') return p[key];
    const actual = Object.keys(p).find(k => k.toLowerCase() === key.toLowerCase());
    if (actual && p[actual] !== undefined && p[actual] !== null && String(p[actual]).trim() !== '') return p[actual];
  }
  return null;
}
function pointCoordinates(feature: any): [number, number] | null {
  if (String(feature?.geometry?.type) !== 'Point' || !Array.isArray(feature?.geometry?.coordinates)) return null;
  const lng = numberValue(feature.geometry.coordinates[0]); const lat = numberValue(feature.geometry.coordinates[1]);
  return lat !== null && lng !== null ? [lat, lng] : null;
}
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000; const p1 = lat1 * Math.PI / 180; const p2 = lat2 * Math.PI / 180; const dp = (lat2 - lat1) * Math.PI / 180; const dl = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SURFACE_LABELS: Record<string, string> = {
  FG: 'ferskvandsgrus', FS: 'ferskvandssand', FI: 'ferskvandssilt', FL: 'ferskvandsler', FT: 'ferskvandstørv', HG: 'saltvandsgrus', HS: 'saltvandssand', HI: 'saltvandssilt', HL: 'saltvandsler', HT: 'saltvandstørv', EK: 'klitsand', ES: 'flyvesand', TG: 'smeltevandsgrus', TS: 'smeltevandssand', TI: 'smeltevandssilt', TL: 'smeltevandsler', MG: 'morænegrus', MS: 'morænesand', MI: 'morænesilt', ML: 'moræneler', O: 'fyld', LSL: 'jordskred', K: 'kalk, kridt og kalksten', LL: 'eocæn ler / plastisk ler'
};

function unavailable(id: string, category: string, sourceName: string, sourceUrl: string, claim: string, reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA' = 'NO_DATA'): DenmarkGroundEvidence {
  return { id, category, claim, status: 'REQUIRES_VERIFICATION', sourceName, sourceUrl, datasetDate: today(), spatialRelationship: 'Valgt sted / søgeområde', calculationMethod: 'National rumlig forespørgsel mod den angivne officielle webservice', confidence: 'Low', limitation: 'Et tomt eller mislykket opslag er ikke dokumentation for fravær af forholdet. Kontrollér den officielle korttjeneste og originale registreringer, og udfør stedsspecifik undersøgelse når resultatet har betydning for køb eller projektering.', value: { reasonCode } };
}

async function querySurfaceGeology(lat: number, lng: number, fetcher: FetchLike): Promise<DenmarkGroundEvidence> {
  const url = geusUrl('jordartskort_25000', lat, lng, 15, 5);
  const features = await fetchFeatures(fetcher, url);
  if (features === null) return unavailable('dk-geus-surface-geology-unavailable', 'Kortlagt overfladegeologi', `${GEUS} — Danmarks Digitale Jordartskort 1:25.000`, url, 'GEUS Jordartskort kunne ikke forespørges.', 'SOURCE_UNAVAILABLE');
  if (!features.length) return unavailable('dk-geus-surface-geology-no-data', 'Kortlagt overfladegeologi', `${GEUS} — Danmarks Digitale Jordartskort 1:25.000`, url, 'GEUS returnerede ingen klassificeret jordart ved det valgte punkt.');
  const p = props(features[0]); const code = text(pick(p, 'TSYM', 'JSYM', 'JSYM1', 'KODE')); const explicit = text(pick(p, 'JORDART', 'JORDARTSTEKST', 'BESKRIVELSE', 'TEKST')); const deposit = explicit || (code ? SURFACE_LABELS[code.toUpperCase()] : null);
  if (!deposit && !code) return unavailable('dk-geus-surface-geology-malformed', 'Kortlagt overfladegeologi', `${GEUS} — Danmarks Digitale Jordartskort 1:25.000`, url, 'GEUS returnerede en polygon uden en læsbar jordartsklasse.', 'MALFORMED_DATA');
  return { id: 'dk-geus-surface-geology', category: 'Kortlagt overfladegeologi', claim: `GEUS Jordartskort 1:25.000 klassificerer materialet omkring kortlægningsdybden som ${deposit || code}.`, status: 'VERIFIED', sourceName: `${GEUS} — Danmarks Digitale Jordartskort 1:25.000 v7.1`, sourceUrl: url, datasetDate: '2026-02-09', spatialRelationship: 'Kortpolygon som rammer det valgte koordinat', calculationMethod: 'GEUS WFS-forespørgsel af jordartskort_25000 i ETRS89 geografiske koordinater (EPSG:4258)', confidence: 'High', limitation: 'Jordartskortet beskriver overfladegeologien omkring ca. 1 m dybde og er baseret på systematisk feltkortlægning med prøvepunkter typisk 100–200 m fra hinanden. Det er ikke en boreprofil for grunden og fastlægger ikke lagtykkelser, fyld, grundvand eller geotekniske designparametre.', value: { code, deposit, scale: '1:25.000', mappingDepthM: 1, version: '7.1' } };
}

async function queryBoreholes(lat: number, lng: number, fetcher: FetchLike): Promise<DenmarkGroundEvidence> {
  const radiusM = 1000; const url = geusUrl('jupiter_boringer_ws', lat, lng, radiusM, 40); const features = await fetchFeatures(fetcher, url);
  if (features === null) return unavailable('dk-jupiter-boreholes-unavailable', 'Nærliggende boringer', `${GEUS} — Jupiter`, url, 'Jupiter-boringer kunne ikke forespørges.', 'SOURCE_UNAVAILABLE');
  if (!features.length) return unavailable('dk-jupiter-boreholes-no-data', 'Nærliggende boringer', `${GEUS} — Jupiter`, url, `Jupiter returnerede ingen boringer i det ca. ${radiusM} m søgeområde.`);
  const records = features.map(feature => { const p = props(feature); const point = pointCoordinates(feature); return { dguNumber: text(pick(p, 'dgunr', 'dgunr_trimmed', 'DGU_NR')), purpose: text(pick(p, 'formanv', 'anvendelse', 'formaal')), category: text(pick(p, 'kode', 'hovedtype')), depthM: numberValue(pick(p, 'dybde', 'boringsdybde', 'totaldybde', 'depth')), year: text(pick(p, 'aar', 'boreaar', 'year')), municipality: text(pick(p, 'kommunenavn', 'kommune')), coordinateUncertainty: numberValue(pick(p, 'koord_usikkerhed', 'koordinatusikkerhed', 'usikkerhed')), distanceM: point ? Math.round(haversineM(lat, lng, point[0], point[1])) : null }; }).sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  const nearest = records[0];
  return { id: 'dk-jupiter-boreholes', category: 'Nærliggende boringer', claim: `Jupiter returnerede ${records.length} boring${records.length === 1 ? '' : 'er'} i søgeområdet${nearest?.distanceM !== null && nearest?.distanceM !== undefined ? `; nærmeste returnerede boring ligger ca. ${nearest.distanceM} m fra stedet` : ''}.`, status: 'VERIFIED', sourceName: `${GEUS} — Jupiter`, sourceUrl: url, datasetDate: today(), spatialRelationship: `Borepunkter i et ca. ${radiusM} m søgeområde omkring det valgte koordinat`, calculationMethod: 'GEUS Jupiter WFS jupiter_boringer_ws; returnerede punkter sorteret efter geodætisk afstand', confidence: 'High', limitation: 'Nærliggende boringer er kontekst. Lagfølge, dybder og observationer i en naboboring dokumenterer ikke forholdene under hele den valgte grund og må ikke bruges som projekteringsparametre uden stedsspecifik geoteknisk undersøgelse.', value: { count: records.length, nearestDistanceM: nearest?.distanceM ?? null, records: records.slice(0, 15) } };
}

async function queryGroundwater(lat: number, lng: number, fetcher: FetchLike): Promise<DenmarkGroundEvidence> {
  const radiusM = 5000; const url = geusUrl('jupiter_boringer_seneste_pejling', lat, lng, radiusM, 40); const features = await fetchFeatures(fetcher, url);
  if (features === null) return unavailable('dk-jupiter-groundwater-unavailable', 'Grundvandsobservationer', `${GEUS} — Jupiter`, url, 'Jupiters lag med seneste pejling kunne ikke forespørges.', 'SOURCE_UNAVAILABLE');
  if (!features.length) return unavailable('dk-jupiter-groundwater-no-data', 'Grundvandsobservationer', `${GEUS} — Jupiter`, url, `Jupiter returnerede ingen boring med seneste pejling i det ca. ${radiusM} m søgeområde.`);
  const records = features.map(feature => { const p = props(feature); const point = pointCoordinates(feature); return { dguNumber: text(pick(p, 'dgunr', 'dgunr_trimmed', 'DGU_NR')), latestLevel: numberValue(pick(p, 'vandstand', 'seneste_pejling', 'pejling', 'vandspejl')), levelDate: text(pick(p, 'pejledato', 'dato', 'seneste_dato')), distanceM: point ? Math.round(haversineM(lat, lng, point[0], point[1])) : null }; }).sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  const nearest = records[0];
  return { id: 'dk-jupiter-groundwater', category: 'Grundvandsobservationer', claim: `Jupiter returnerede ${records.length} registrering${records.length === 1 ? '' : 'er'} med seneste pejling i søgeområdet${nearest?.distanceM !== null && nearest?.distanceM !== undefined ? `; nærmeste returnerede registrering ligger ca. ${nearest.distanceM} m fra stedet` : ''}.`, status: 'VERIFIED', sourceName: `${GEUS} — Jupiter, seneste pejling`, sourceUrl: url, datasetDate: nearest?.levelDate || today(), spatialRelationship: `Registrerede boringer med pejling i et ca. ${radiusM} m søgeområde`, calculationMethod: 'GEUS Jupiter WFS jupiter_boringer_seneste_pejling; observationer rangordnet efter afstand', confidence: 'High', limitation: 'Pejlinger fra andre boringer er observationskontekst og må ikke omsættes til en grundvandstand på den valgte grund. Niveauer varierer med magasin, terræn, sæson og målemetode; stedsspecifik verifikation er nødvendig.', value: { count: records.length, nearestDistanceM: nearest?.distanceM ?? null, records: records.slice(0, 15) } };
}

async function queryPlanning(lat: number, lng: number, fetcher: FetchLike): Promise<DenmarkGroundEvidence> {
  const names = ['theme_pdk_lokalplan_vedtaget', 'theme_pdk:theme_pdk_lokalplan_vedtaget', 'theme_pdk_lokalplan_vedtaget_v', 'theme_pdk:theme_pdk_lokalplan_vedtaget_v'];
  let sourceUrl = plandataUrl(names[0], lat, lng); let features: any[] | null = null;
  for (const name of names) {
    sourceUrl = plandataUrl(name, lat, lng);
    features = await fetchFeatures(fetcher, sourceUrl);
    if (features !== null) break;
  }
  const sourceName = 'Plandata.dk — vedtagne lokalplaner';
  if (features === null) return unavailable('dk-plandata-localplan-unavailable', 'Planlægning', sourceName, sourceUrl, 'Plandata.dk WFS kunne ikke forespørges.', 'SOURCE_UNAVAILABLE');
  if (!features.length) return unavailable('dk-plandata-localplan-no-data', 'Planlægning', sourceName, sourceUrl, 'Plandata.dk returnerede ingen vedtaget lokalplan, der rammer det valgte koordinat. Dette er ikke dokumentation for fri byggeret.');
  const plans = features.map(feature => { const p = props(feature); return { planId: text(pick(p, 'planid', 'plan_id')), planNumber: text(pick(p, 'plannr', 'plannummer')), name: text(pick(p, 'plannavn', 'navn')), municipality: text(pick(p, 'komnavn', 'kommunenavn')), effectiveDate: text(pick(p, 'datoikraft', 'ikrafttraedelsesdato', 'datopub')), documentUrl: text(pick(p, 'doklink', 'dokumenturl', 'dokumentUrl')), webUrl: text(pick(p, 'weblink', 'webadresse')) }; });
  const primary = plans[0];
  return { id: 'dk-plandata-localplan', category: 'Planlægning', claim: `Plandata.dk returnerede ${plans.length} vedtaget lokalplan${plans.length === 1 ? '' : 'er'} ved stedet${primary?.name ? `; første registrerede plan: ${primary.name}` : primary?.planNumber ? `; plan ${primary.planNumber}` : ''}.`, status: 'VERIFIED', sourceName, sourceUrl, datasetDate: primary?.effectiveDate || today(), spatialRelationship: 'Vedtaget lokalplangeometri som rammer det valgte koordinat', calculationMethod: 'Plandata.dk WFS-forespørgsel af det aktuelle theme_pdk_lokalplan_vedtaget-lag omkring valgt koordinat', confidence: 'High', limitation: 'Et WFS-hit dokumenterer planens registrerede geografiske overlap, men ikke automatisk alle bindende bestemmelser, byggefelter, servitutter, dispensationer eller projektets konkrete byggeret. Læs det originale plandokument og verificér hos kommunen.', value: { count: plans.length, plans } };
}

export async function queryDenmarkGroundEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<DenmarkGroundEvidence[]> {
  return Promise.all([querySurfaceGeology(lat, lng, fetcher), queryBoreholes(lat, lng, fetcher), queryGroundwater(lat, lng, fetcher), queryPlanning(lat, lng, fetcher)]);
}

export function enrichDenmarkGroundEvidence(report: any, evidence: DenmarkGroundEvidence[]): void {
  if (!report) return;
  const surface = evidence.find(item => item.id === 'dk-geus-surface-geology' && item.status === 'VERIFIED');
  const planning = evidence.find(item => item.id === 'dk-plandata-localplan' && item.status === 'VERIFIED');
  report.denmark_ground_evidence = evidence.map(item => ({ id: item.id, status: item.status, sourceName: item.sourceName }));
  if (surface) report.geosurvey_context = { ...(report.geosurvey_context || {}), surface_geology: surface.value, national_surface_geology_source: surface.sourceName, national_surface_geology_url: surface.sourceUrl };
  if (planning) {
    const value: any = planning.value || {}; const first = Array.isArray(value.plans) ? value.plans[0] : null;
    report.planning = { ...(report.planning || {}), status: 'VERIFIED', hasLocalPlan: true, planDesignation: first?.name || first?.planNumber || 'Vedtaget lokalplan', permittedUseCategory: 'Se den registrerede lokalplan og originale bestemmelser', maxFar: 'Kræver plandokument / kommunal verifikation', maxCoveragePct: 'Kræver plandokument / kommunal verifikation', minBiologicallyActivePct: 'Kræver plandokument / kommunal verifikation', maxBuildingHeightM: 'Kræver plandokument / kommunal verifikation', setbackRules: 'Kræver plandokument / kommunal verifikation', authorityName: first?.municipality || report.planning?.authorityName || 'Kommune', documentRequired: 'Gældende lokalplan, kommuneplanramme og eventuelle tilladelser/dispensationer', sourceName: 'Plandata.dk', limitation: planning.limitation };
  }
}

export const DENMARK_GROUND_SOURCES = { geusWfs: GEUS_WFS, geusPortal: GEUS_PORTAL, plandataWfs: PLANDATA_WFS, plandataPortal: PLANDATA_PORTAL };
