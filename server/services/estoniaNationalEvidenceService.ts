import { EvidenceItem } from '../types';

type FetchLike = typeof fetch;

export interface EstoniaNationalEvidenceResult { evidence: EvidenceItem[]; sourceCount: number; }

const EGT_BASE = 'https://maps.egt.ee/geoserver';
const K50_WFS = `${EGT_BASE}/k50/ows`;
const FAKTIKA_WFS = `${EGT_BASE}/faktika/ows`;
const EGT_PORTAL = 'https://www.egt.ee/en/geoportal';
const today = () => new Date().toISOString().slice(0, 10);

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 10000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/geo+json, application/json', 'User-Agent': 'GroundSurf/1.0 Estonia geology evidence', Referer: 'https://gis.egt.ee/' }, signal: controller.signal });
    if (!response.ok) return null;
    const json = await response.json();
    return json && typeof json === 'object' ? json : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

function text(value: unknown): string | null { const cleaned = value === null || value === undefined ? '' : String(value).trim().replace(/\s+/g, ' '); return cleaned || null; }
function bboxUrl(base: string, typeNames: string, lat: number, lng: number, deltaLat: number, deltaLng = deltaLat, count = 50): string {
  const params = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames, srsName: 'EPSG:4326', outputFormat: 'application/json', count: String(count), BBOX: `${(lng - deltaLng).toFixed(6)},${(lat - deltaLat).toFixed(6)},${(lng + deltaLng).toFixed(6)},${(lat + deltaLat).toFixed(6)},EPSG:4326` });
  return `${base}?${params.toString()}`;
}
function outerRings(geometry: any): [number, number][][] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return (geometry.coordinates || []).filter(Array.isArray).map((ring: any[]) => ring.map((p: any) => [Number(p[1]), Number(p[0])] as [number, number])).filter((ring: [number, number][]) => ring.length >= 3);
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flatMap((poly: any[]) => outerRings({ type: 'Polygon', coordinates: poly }));
  return [];
}
function pointInRing(point: [number, number], ring: [number, number][]): boolean {
  const [lat, lng] = point; let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [latI, lngI] = ring[i]; const [latJ, lngJ] = ring[j]; const crosses = ((lngI > lng) !== (lngJ > lng)) && (lat < (latJ - latI) * (lng - lngI) / ((lngJ - lngI) || Number.EPSILON) + latI); if (crosses) inside = !inside; }
  return inside;
}
function containingFeature(features: any[], point: [number, number]): any | null {
  return features.find((feature: any) => outerRings(feature.geometry).some(ring => pointInRing(point, ring))) || null;
}
function distanceKm(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180; const dLat = (b[0] - a[0]) * rad; const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function featurePoint(feature: any): [number, number] | null { const c = feature?.geometry?.coordinates; if (feature?.geometry?.type !== 'Point' || !Array.isArray(c)) return null; const lng = Number(c[0]); const lat = Number(c[1]); return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null; }
function evidence(id: string, category: string, claim: string, url: string, relationship: string, method: string, confidence: 'High' | 'Medium' | 'Low', value: any, limitation: string, status: 'VERIFIED' | 'REQUIRES_VERIFICATION' = 'VERIFIED'): EvidenceItem {
  return { id, category, claim, status, sourceName: 'Estonian Geological Survey (EGT)', sourceUrl: url, datasetDate: today(), spatialRelationship: relationship, calculationMethod: method, confidence, value, limitation };
}

export async function queryEstoniaNationalEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<EstoniaNationalEvidenceResult> {
  const site: [number, number] = [lat, lng];
  const urls = {
    superficial: bboxUrl(K50_WFS, 'k50:q_avamus_a_50t', lat, lng, 0.003, 0.004, 50),
    bedrock: bboxUrl(K50_WFS, 'k50:ap_avamus_a_50t', lat, lng, 0.003, 0.004, 50),
    hydro: bboxUrl(K50_WFS, 'k50:hg_veekompleks_a_50t', lat, lng, 0.003, 0.004, 30),
    vulnerability: bboxUrl(K50_WFS, 'k50:hg_pvk_kaitstus_a_50t', lat, lng, 0.003, 0.004, 30),
    boreholes: bboxUrl(FAKTIKA_WFS, 'faktika:puurauk', lat, lng, 0.08, 0.14, 100)
  };
  const [superficial, bedrock, hydro, vulnerability, boreholes] = await Promise.all(Object.values(urls).map(url => fetchJson(fetcher, url)));
  const records: EvidenceItem[] = [];

  const sf = Array.isArray(superficial?.features) ? superficial.features : [];
  const selectedSurface = containingFeature(sf, site);
  if (selectedSurface) {
    const p = selectedSurface.properties || {};
    records.push(evidence('ee-egt-superficial-geology', 'Soil & near-surface geology', `The Estonian Geological Survey 1:50,000 geological map places the selected coordinate in ${text(p.litoloogia) || 'a mapped superficial-sediment unit'}${text(p.stratigr) ? ` (${text(p.stratigr)})` : ''}.`, urls.superficial, 'Mapped 1:50,000 superficial-geology polygon containing the selected coordinate', 'EGT GeoServer WFS query with local point-in-polygon selection', 'High', { lithology: text(p.litoloogia), stratigraphy: text(p.stratigr), code: p.kood ?? null }, 'This is regional geological mapping. It does not establish layer thickness, density, bearing capacity, settlement parameters or groundwater conditions at the parcel scale.'));
  } else {
    records.push(evidence('ee-egt-superficial-geology-unavailable', 'Soil & near-surface geology', 'The EGT 1:50,000 superficial-geology query did not return a mapped polygon containing the selected coordinate.', urls.superficial, 'Selected site coordinate', 'EGT GeoServer WFS bbox query with local point-in-polygon selection', 'Low', { reasonCode: 'NO_DATA' }, 'No returned polygon is not evidence that mapped superficial geology is absent. Review the EGT geological map and local investigations.', 'REQUIRES_VERIFICATION'));
  }

  const bf = Array.isArray(bedrock?.features) ? bedrock.features : [];
  const selectedBedrock = containingFeature(bf, site);
  if (selectedBedrock) {
    const p = selectedBedrock.properties || {};
    records.push(evidence('ee-egt-bedrock-exposure', 'Geology', `EGT 1:50,000 mapping identifies a bedrock exposure unit at the selected coordinate${text(p.indeks) ? ` (${text(p.indeks)})` : ''}.`, urls.bedrock, 'Mapped bedrock-exposure polygon containing the selected coordinate', 'EGT GeoServer WFS query with local point-in-polygon selection', 'High', { index: text(p.indeks), code: p.kood ?? null }, 'Bedrock exposure mapping does not establish rockhead depth, overburden thickness, weathering, fractures or foundation parameters.'));
  } else {
    records.push(evidence('ee-egt-bedrock-exposure-open', 'Geology', 'EGT bedrock-exposure mapping was queried but no bedrock-exposure polygon containing the selected coordinate was returned.', urls.bedrock, 'Selected site coordinate', 'EGT GeoServer WFS bbox query with local point-in-polygon selection', 'Low', { reasonCode: 'NO_DATA' }, 'No mapped exposure is not evidence that bedrock is absent or deep. Review the broader EGT geology coverage and ground investigations.', 'REQUIRES_VERIFICATION'));
  }

  const hf = Array.isArray(hydro?.features) ? hydro.features : [];
  const selectedHydro = containingFeature(hf, site);
  if (selectedHydro) {
    const p = selectedHydro.properties || {};
    records.push(evidence('ee-egt-hydrogeology', 'Hydrogeology', `EGT hydrogeological mapping identifies ${text(p.liik) || 'a mapped groundwater-bearing or confining unit'}${text(p.veekiht) && text(p.veekiht) !== 'Ei kohaldu' ? `; aquifer ${text(p.veekiht)}` : ''}.`, urls.hydro, 'Mapped hydrogeological polygon containing the selected coordinate', 'EGT GeoServer WFS query with local point-in-polygon selection', 'High', { type: text(p.liik), index: text(p.indeks), aquifer: text(p.veekiht) }, 'Mapped hydrogeology is regional screening evidence. It does not establish groundwater level, seasonal variation, transmissivity at the site or construction dewatering requirements.'));
  } else {
    records.push(evidence('ee-egt-hydrogeology-unavailable', 'Hydrogeology', 'The EGT hydrogeological map query did not return a mapped unit containing the selected coordinate.', urls.hydro, 'Selected site coordinate', 'EGT GeoServer WFS bbox query with local point-in-polygon selection', 'Low', { reasonCode: 'NO_DATA' }, 'No returned polygon is not evidence that groundwater conditions are absent or unimportant.', 'REQUIRES_VERIFICATION'));
  }

  const vf = Array.isArray(vulnerability?.features) ? vulnerability.features : [];
  const selectedVulnerability = containingFeature(vf, site);
  if (selectedVulnerability) {
    const p = selectedVulnerability.properties || {};
    records.push(evidence('ee-egt-groundwater-vulnerability', 'Groundwater protection', `EGT groundwater-vulnerability mapping classifies the selected coordinate as ${text(p.liik) || 'a mapped groundwater protection class'}${text(p.iseloom) ? ` (${text(p.iseloom)})` : ''}.`, urls.vulnerability, 'Mapped groundwater-vulnerability polygon containing the selected coordinate', 'EGT GeoServer WFS query with local point-in-polygon selection', 'High', { classification: text(p.liik), character: text(p.iseloom) }, 'This is mapped regional groundwater-protection context. It is not a parcel-specific contamination result or a substitute for local hydrogeological investigation.'));
  } else {
    records.push(evidence('ee-egt-groundwater-vulnerability-open', 'Groundwater protection', 'EGT groundwater-vulnerability mapping was queried but no class polygon containing the selected coordinate was returned.', urls.vulnerability, 'Selected site coordinate', 'EGT GeoServer WFS bbox query with local point-in-polygon selection', 'Low', { reasonCode: 'NO_DATA' }, 'No returned class is not evidence that groundwater is unprotected or unaffected.'));
  }

  const bhs = Array.isArray(boreholes?.features) ? boreholes.features : [];
  const nearby = bhs.map((feature: any) => ({ feature, point: featurePoint(feature) })).filter((item: any) => item.point).map((item: any) => ({ ...item, distanceKm: distanceKm(site, item.point) })).sort((a: any, b: any) => a.distanceKm - b.distanceKm);
  if (nearby.length) {
    const nearest = nearby[0];
    records.push(evidence('ee-egt-borehole-context', 'Ground investigations', `EGT's public borehole register contains ${nearby.length} borehole record${nearby.length === 1 ? '' : 's'} within approximately 10–15 km of the selected coordinate; the nearest returned record is about ${Math.round(nearest.distanceKm * 1000).toLocaleString('en-GB')} m away.`, urls.boreholes, 'Nearby drilling records returned from the EGT borehole register', 'EGT GeoServer WFS bbox query plus local geodesic distance calculation', 'Medium', { count: nearby.length, nearestDistanceM: Math.round(nearest.distanceKm * 1000), examples: nearby.slice(0, 5).map((item: any) => ({ id: item.feature?.properties?.gea_id ?? null, name: text(item.feature?.properties?.nimi), depthM: Number.isFinite(Number(item.feature?.properties?.pikkus)) ? Number(item.feature.properties.pikkus) : null, verticalExtentM: Number.isFinite(Number(item.feature?.properties?.vertikaalne_ulatus)) ? Number(item.feature.properties.vertikaalne_ulatus) : null })) }, 'Nearby boreholes are contextual records, not evidence of the ground profile beneath the selected parcel. Individual logs should be reviewed where foundation, excavation or groundwater questions are material.'));
  } else {
    records.push(evidence('ee-egt-borehole-context-open', 'Ground investigations', 'No EGT borehole record was returned in the tested vicinity search around the selected coordinate.', urls.boreholes, 'Nearby EGT borehole register search', 'EGT GeoServer WFS bbox query plus local distance filtering', 'Low', { reasonCode: 'NO_DATA', searchWindow: 'approx. 10–15 km' }, 'No returned borehole is not evidence that no investigation exists nearby. EGT archive and local studies may contain additional records.', 'REQUIRES_VERIFICATION'));
  }

  return { evidence: records, sourceCount: records.length };
}


export function applyEstoniaNationalEvidenceToReport(report: any, evidence: EvidenceItem[]): void {
  if (!report) return;
  const existing = report.geosurvey_context && typeof report.geosurvey_context === 'object' ? report.geosurvey_context : {};
  const surface = evidence.find(item => item.id === 'ee-egt-superficial-geology' && item.status === 'VERIFIED');
  const bedrock = evidence.find(item => item.id === 'ee-egt-bedrock-exposure' && item.status === 'VERIFIED');
  const hydro = evidence.find(item => item.id === 'ee-egt-hydrogeology' && item.status === 'VERIFIED');
  const vulnerability = evidence.find(item => item.id === 'ee-egt-groundwater-vulnerability' && item.status === 'VERIFIED');
  const surfaceValue = surface?.value && typeof surface.value === 'object' ? surface.value as Record<string, unknown> : {};
  const bedrockValue = bedrock?.value && typeof bedrock.value === 'object' ? bedrock.value as Record<string, unknown> : {};
  const hydroValue = hydro?.value && typeof hydro.value === 'object' ? hydro.value as Record<string, unknown> : {};
  const vulnerabilityValue = vulnerability?.value && typeof vulnerability.value === 'object' ? vulnerability.value as Record<string, unknown> : {};
  const surfaceLithology = text(surfaceValue.lithology);
  const surfaceStratigraphy = text(surfaceValue.stratigraphy);
  const bedrockIndex = text(bedrockValue.index);
  const hydroType = text(hydroValue.type);
  const hydroAquifer = text(hydroValue.aquifer);
  const vulnerabilityClass = text(vulnerabilityValue.classification);
  const vulnerabilityCharacter = text(vulnerabilityValue.character);
  const geologicalUnitName = surfaceLithology
    ? `${surfaceLithology}${surfaceStratigraphy ? ` (${surfaceStratigraphy})` : ''}`
    : bedrockIndex ? `Bedrock exposure ${bedrockIndex}` : existing.geological_unit_name;
  const groundwaterRegime = hydroType
    ? `${hydroType}${hydroAquifer ? `; aquifer: ${hydroAquifer}` : ''}`
    : existing.groundwater_regime;
  report.geosurvey_context = {
    ...existing,
    survey_authority: 'Estonian Geological Survey (EGT)',
    source_name: 'Estonian Geological Survey (EGT) — 1:50,000 geology and hydrogeology',
    source_url: EGT_PORTAL,
    geological_unit_name: geologicalUnitName,
    lithology_type: surfaceLithology || existing.lithology_type,
    geological_period_era: surfaceStratigraphy || existing.geological_period_era,
    groundwater_regime: groundwaterRegime,
    groundwater_protection_class: vulnerabilityClass ? `${vulnerabilityClass}${vulnerabilityCharacter ? ` (${vulnerabilityCharacter})` : ''}` : existing.groundwater_protection_class,
    evidence_level: (surface || bedrock || hydro || vulnerability) ? 'VERIFIED' : existing.evidence_level
  };
}

export const ESTONIA_GEOLOGY_SOURCES = { geologyWfs: K50_WFS, boreholeWfs: FAKTIKA_WFS, portal: EGT_PORTAL };
