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

function unavailable(id: string, category: string, sourceName: string, sourceUrl: string, claim: string, reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA' = 'NO_DATA'): DenmarkGroundEvidence {
  return { id, category, claim, status: 'REQUIRES_VERIFICATION', sourceName, sourceUrl, datasetDate: today(), spatialRelationship: 'Valgt sted / søgeområde', calculationMethod: 'National rumlig forespørgsel mod den angivne officielle webservice', confidence: 'Low', limitation: 'Et tomt eller mislykket opslag er ikke dokumentation for fravær af forholdet. Kontrollér den officielle korttjeneste og originale registreringer, og udfør stedsspecifik undersøgelse når resultatet har betydning for køb eller projektering.', value: { reasonCode } };
}

async function queryBoreholes(lat: number, lng: number, fetcher: FetchLike): Promise<DenmarkGroundEvidence> {
  const radiiM = [250, 500, 750, 1000]; const maxFeatures = 40;
  let radiusM = radiiM[radiiM.length - 1]; let url = geusUrl('jupiter_boringer_ws', lat, lng, radiusM, maxFeatures); let features: any[] | null = [];
  for (const candidateRadius of radiiM) {
    const candidateUrl = geusUrl('jupiter_boringer_ws', lat, lng, candidateRadius, maxFeatures); const candidate = await fetchFeatures(fetcher, candidateUrl);
    url = candidateUrl; radiusM = candidateRadius;
    if (candidate === null) { features = null; break; }
    features = candidate;
    if (candidate.length) break;
  }
  if (features === null) return unavailable('dk-jupiter-boreholes-unavailable', 'Nærliggende boringer', `${GEUS} — Jupiter`, url, 'Jupiter-boringer kunne ikke forespørges.', 'SOURCE_UNAVAILABLE');
  if (!features.length) return unavailable('dk-jupiter-boreholes-no-data', 'Nærliggende boringer', `${GEUS} — Jupiter`, url, `Jupiter returnerede ingen boringer i søgeområder op til ca. ${radiusM} m.`);
  const records = features.map(feature => { const p = props(feature); const point = pointCoordinates(feature); return { dguNumber: text(pick(p, 'dgunr', 'dgunr_trimmed', 'DGU_NR')), purpose: text(pick(p, 'formanv_tekst', 'formaal_tekst', 'anvendelse_tekst', 'formanv', 'formaal', 'anvendelse')), category: text(pick(p, 'kode_tekst', 'hovedtype', 'kode')), depthM: numberValue(pick(p, 'dybde_num', 'dybde', 'boringsdybde', 'totaldybde', 'depth')), year: text(pick(p, 'aar', 'boreaar', 'year')), municipality: text(pick(p, 'kommunenavn', 'kommune')), coordinateUncertainty: numberValue(pick(p, 'koord_usikkerhed', 'koordinatusikkerhed', 'usikkerhed')), distanceM: point ? Math.round(haversineM(lat, lng, point[0], point[1])) : null }; }).sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  const nearest = records[0];
  const capped = records.length >= maxFeatures;
  return { id: 'dk-jupiter-boreholes', category: 'Nærliggende boringer', claim: `Jupiter returnerede ${records.length} boring${records.length === 1 ? '' : 'er'} i det første søgeområde med træffer (ca. ${radiusM} m)${capped ? `; forespørgslen nåede loftet på ${maxFeatures} poster` : ''}${nearest?.distanceM !== null && nearest?.distanceM !== undefined ? `; nærmeste returnerede boring ligger ca. ${nearest.distanceM} m fra stedet` : ''}.`, status: 'VERIFIED', sourceName: `${GEUS} — Jupiter`, sourceUrl: url, datasetDate: today(), spatialRelationship: `Borepunkter i det første ikke-tomme søgeområde, ca. ${radiusM} m omkring det valgte koordinat`, calculationMethod: 'GEUS Jupiter WFS jupiter_boringer_ws; progressivt 250/500/750/1000 m søgevindue og returnerede punkter sorteret efter geodætisk afstand', confidence: 'High', limitation: 'Nærliggende boringer er kontekst. Lagfølge, dybder og observationer i en naboboring dokumenterer ikke forholdene under hele den valgte grund og må ikke bruges som projekteringsparametre uden stedsspecifik geoteknisk undersøgelse.', value: { count: records.length, queryRadiusM: radiusM, queryLimit: maxFeatures, queryMayBeTruncated: capped, nearestDistanceM: nearest?.distanceM ?? null, records: records.slice(0, 15) } };
}

async function queryGroundwater(lat: number, lng: number, fetcher: FetchLike): Promise<DenmarkGroundEvidence> {
  const radiiM = [500, 1000, 2000, 5000]; const maxFeatures = 40;
  let radiusM = radiiM[radiiM.length - 1]; let url = geusUrl('jupiter_boringer_seneste_pejling', lat, lng, radiusM, maxFeatures); let features: any[] | null = [];
  for (const candidateRadius of radiiM) {
    const candidateUrl = geusUrl('jupiter_boringer_seneste_pejling', lat, lng, candidateRadius, maxFeatures); const candidate = await fetchFeatures(fetcher, candidateUrl);
    url = candidateUrl; radiusM = candidateRadius;
    if (candidate === null) { features = null; break; }
    features = candidate;
    if (candidate.length) break;
  }
  if (features === null) return unavailable('dk-jupiter-groundwater-unavailable', 'Grundvandsobservationer', `${GEUS} — Jupiter`, url, 'Jupiters lag med seneste pejling kunne ikke forespørges.', 'SOURCE_UNAVAILABLE');
  if (!features.length) return unavailable('dk-jupiter-groundwater-no-data', 'Grundvandsobservationer', `${GEUS} — Jupiter`, url, `Jupiter returnerede ingen boring med seneste pejling i søgeområder op til ca. ${radiusM} m.`);
  const records = features.map(feature => { const p = props(feature); const point = pointCoordinates(feature); return { dguNumber: text(pick(p, 'dgunr', 'dgunr_trimmed', 'DGU_NR')), depthBelowTerrainM: numberValue(pick(p, 'vandstandterraen_num', 'vandstandterraen', 'vandstand', 'seneste_pejling', 'pejling', 'vandspejl')), levelDate: text(pick(p, 'pejletidspunkt', 'pejledato', 'dato', 'seneste_dato')), distanceM: point ? Math.round(haversineM(lat, lng, point[0], point[1])) : null }; }).sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  const nearest = records[0];
  const capped = records.length >= maxFeatures;
  return { id: 'dk-jupiter-groundwater', category: 'Grundvandsobservationer', claim: `Jupiter returnerede ${records.length} registrering${records.length === 1 ? '' : 'er'} med seneste pejling i det første søgeområde med træffer (ca. ${radiusM} m)${capped ? `; forespørgslen nåede loftet på ${maxFeatures} poster` : ''}${nearest?.distanceM !== null && nearest?.distanceM !== undefined ? `; nærmeste returnerede registrering ligger ca. ${nearest.distanceM} m fra stedet` : ''}.`, status: 'VERIFIED', sourceName: `${GEUS} — Jupiter, seneste pejling`, sourceUrl: url, datasetDate: today(), spatialRelationship: `Registrerede boringer med pejling i det første ikke-tomme søgeområde, ca. ${radiusM} m`, calculationMethod: 'GEUS Jupiter WFS jupiter_boringer_seneste_pejling; progressivt 500/1000/2000/5000 m søgevindue og observationer rangordnet efter afstand', confidence: 'High', limitation: 'Pejlinger fra andre boringer er observationskontekst og kan være historiske. De må ikke omsættes til en grundvandstand på den valgte grund. Niveauer varierer med magasin, terræn, sæson og målemetode; stedsspecifik verifikation er nødvendig.', value: { count: records.length, queryRadiusM: radiusM, queryLimit: maxFeatures, queryMayBeTruncated: capped, nearestDistanceM: nearest?.distanceM ?? null, records: records.slice(0, 15) } };
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
  return Promise.all([queryBoreholes(lat, lng, fetcher), queryGroundwater(lat, lng, fetcher), queryPlanning(lat, lng, fetcher)]);
}

export function enrichDenmarkGroundEvidence(report: any, evidence: DenmarkGroundEvidence[]): void {
  if (!report) return;
  const planning = evidence.find(item => item.id === 'dk-plandata-localplan' && item.status === 'VERIFIED');
  report.denmark_ground_evidence = evidence.map(item => ({ id: item.id, status: item.status, sourceName: item.sourceName }));
  if (planning) {
    const value: any = planning.value || {}; const first = Array.isArray(value.plans) ? value.plans[0] : null;
    report.planning = { ...(report.planning || {}), status: 'VERIFIED', hasLocalPlan: true, planDesignation: first?.name || first?.planNumber || 'Vedtaget lokalplan', permittedUseCategory: 'Se den registrerede lokalplan og originale bestemmelser', maxFar: 'Kræver plandokument / kommunal verifikation', maxCoveragePct: 'Kræver plandokument / kommunal verifikation', minBiologicallyActivePct: 'Kræver plandokument / kommunal verifikation', maxBuildingHeightM: 'Kræver plandokument / kommunal verifikation', setbackRules: 'Kræver plandokument / kommunal verifikation', authorityName: first?.municipality || report.planning?.authorityName || 'Kommune', documentRequired: 'Gældende lokalplan, kommuneplanramme og eventuelle tilladelser/dispensationer', sourceName: 'Plandata.dk', limitation: planning.limitation };
  }
}

export const DENMARK_GROUND_SOURCES = { geusWfs: GEUS_WFS, geusPortal: GEUS_PORTAL, plandataWfs: PLANDATA_WFS, plandataPortal: PLANDATA_PORTAL };