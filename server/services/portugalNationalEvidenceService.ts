import { EvidenceItem } from '../types';

type FetchLike = typeof fetch;

const LNEG_BASE = 'https://sig.lneg.pt/server/rest/services';
const GEO_1M = `${LNEG_BASE}/CGP1M/MapServer/2/query`;
const GEO_200K = `${LNEG_BASE}/GeologiaUnica200k/MapServer/1/query`;
const SONDA = `${LNEG_BASE}/Sondabase/MapServer/0/query`;
const HYDRO_POINTS = `${LNEG_BASE}/RecursosHidro/MapServer/0/query`;
const HYDRO_AQUIFER = `${LNEG_BASE}/RecursosHidro/MapServer/2/query`;
const PORTAL = 'https://geoportal.lneg.pt/';
const today = () => new Date().toISOString().slice(0, 10);

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 10000): Promise<any | null> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json, application/geo+json', 'User-Agent': 'GroundSurf/1.0 Portugal LNEG evidence' }, signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json(); return data && typeof data === 'object' ? data : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

function text(value: unknown): string | null { const cleaned = value === null || value === undefined ? '' : String(value).trim().replace(/\s+/g, ' '); return cleaned || null; }
function pointQueryUrl(base: string, lat: number, lng: number, count = 50): string {
  const params = new URLSearchParams({ where: '1=1', geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'true', outSR: '4326', f: 'json', resultRecordCount: String(count) });
  return `${base}?${params.toString()}`;
}
function geometryQueryUrl(base: string, lat: number, lng: number): string {
  return pointQueryUrl(base, lat, lng, 20);
}
function nearbyPointQueryUrl(base: string, lat: number, lng: number, radiusM = 15000, count = 100): string {
  const latRadius = radiusM / 111320;
  const lngRadius = radiusM / Math.max(111320 * Math.cos(lat * Math.PI / 180), 1);
  const geometry = { xmin: lng - lngRadius, ymin: lat - latRadius, xmax: lng + lngRadius, ymax: lat + latRadius, spatialReference: { wkid: 4326 } };
  const params = new URLSearchParams({ where: '1=1', geometry: JSON.stringify(geometry), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'true', outSR: '4326', f: 'json', resultRecordCount: String(count) });
  return `${base}?${params.toString()}`;
}
function distanceM(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180; const dLat = (b[0] - a[0]) * rad; const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function featurePoint(feature: any): [number, number] | null {
  const geometry = feature?.geometry;
  if (!geometry) return null;
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const lng = Number(geometry.coordinates[0]); const lat = Number(geometry.coordinates[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }
  const lng = Number(geometry.x); const lat = Number(geometry.y);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}
function evidence(id: string, category: string, claim: string, url: string, relationship: string, method: string, confidence: 'High' | 'Medium' | 'Low', value: any, limitation: string, status: 'VERIFIED' | 'REQUIRES_VERIFICATION' = 'VERIFIED'): EvidenceItem {
  return { id, category, claim, status, sourceName: 'Laboratório Nacional de Energia e Geologia (LNEG)', sourceUrl: url, datasetDate: today(), spatialRelationship: relationship, calculationMethod: method, confidence, value, limitation };
}

export async function queryPortugalNationalEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<EvidenceItem[]> {
  const geo200k = await fetchJson(fetcher, geometryQueryUrl(GEO_200K, lat, lng));
  const geo1m = await fetchJson(fetcher, geometryQueryUrl(GEO_1M, lat, lng));
  const [boreholes, waterPoints, aquifer] = await Promise.all([
    fetchJson(fetcher, nearbyPointQueryUrl(SONDA, lat, lng, 15000, 100)),
    fetchJson(fetcher, nearbyPointQueryUrl(HYDRO_POINTS, lat, lng, 15000, 100)),
    fetchJson(fetcher, geometryQueryUrl(HYDRO_AQUIFER, lat, lng))
  ]);
  const records: EvidenceItem[] = [];

  const detailed = Array.isArray(geo200k?.features) ? geo200k.features[0] : null;
  const broad = Array.isArray(geo1m?.features) ? geo1m.features[0] : null;
  if (detailed?.attributes) {
    const p = detailed.attributes;
    records.push(evidence('pt-lneg-geology-200k', 'Geology', `LNEG 1:200,000 continuous geological mapping identifies ${text(p.descricao1) || 'a mapped geological unit'}${text(p.descricao2) ? `; lithology: ${text(p.descricao2)}` : ''}${text(p.codigo) ? ` (${text(p.codigo)})` : ''}.`, GEO_200K, 'Mapped national geological polygon returned for the selected coordinate', 'LNEG ArcGIS REST point query against the continuous 1:200,000 geological map', 'High', { code: text(p.codigo), unit: text(p.descricao1), lithology: text(p.descricao2) }, 'This is regional geological mapping and does not establish parcel-scale thickness, weathering, density, bearing capacity, settlement parameters or groundwater level.'));
  } else if (broad?.attributes) {
    const p = broad.attributes;
    records.push(evidence('pt-lneg-geology-1m', 'Geology', `LNEG 1:1,000,000 INSPIRE geological mapping identifies ${text(p.UC_desc) || 'a mapped geological unit'}${text(p.LitologiasPredominantes) ? `; predominant lithologies: ${text(p.LitologiasPredominantes)}` : ''}${text(p.Codigo) ? ` (${text(p.Codigo)})` : ''}.`, GEO_1M, 'Mapped national geological polygon returned for the selected coordinate', 'LNEG ArcGIS REST point query against the INSPIRE 1:1,000,000 geological map', 'High', { code: text(p.Codigo), unit: text(p.UC_desc), lithology: text(p.LitologiasPredominantes), age: text(p.Serie) }, 'This is broad national geological context and does not establish parcel-scale stratigraphy or engineering parameters.'));
  } else {
    records.push(evidence('pt-lneg-geology-unavailable', 'Geology', 'The LNEG national geological query returned no mapped unit at the selected coordinate.', GEO_1M, 'Selected site coordinate', 'LNEG ArcGIS REST point query', 'Low', { reasonCode: 'NO_DATA' }, 'No returned unit is not evidence that geology is absent. Review LNEG geological sheets and any local geological or engineering investigations.', 'REQUIRES_VERIFICATION'));
  }

  const bh = Array.isArray(boreholes?.features) ? boreholes.features : [];
  const nearbyBoreholes = bh.map((feature: any) => ({ feature, point: featurePoint(feature) })).filter((x: any) => x.point).map((x: any) => ({ ...x, distanceM: distanceM([lat, lng], x.point) })).sort((a: any, b: any) => a.distanceM - b.distanceM);
  if (nearbyBoreholes.length) {
    const nearest = nearbyBoreholes[0]; const examples = nearbyBoreholes.slice(0, 5).map((item: any) => ({ id: item.feature?.attributes?.IDSondagem ?? null, name: text(item.feature?.attributes?.denominacao), locality: text(item.feature?.attributes?.localidade), depthM: Number.isFinite(Number(item.feature?.attributes?.comprimento)) ? Number(item.feature.attributes.comprimento) : null, year: Number.isFinite(Number(item.feature?.attributes?.anoFim)) ? Number(item.feature.attributes.anoFim) : null, distanceM: Math.round(item.distanceM) }));
    records.push(evidence('pt-lneg-borehole-context', 'Ground investigations', `LNEG's Sondabase contains ${nearbyBoreholes.length} geological drilling record${nearbyBoreholes.length === 1 ? '' : 's'} in the tested 15 km search area; the nearest returned record is about ${Math.round(nearest.distanceM).toLocaleString('pt-PT')} m away.`, nearbyPointQueryUrl(SONDA, lat, lng, 15000, 100), 'Nearby records in the national LNEG Sondabase drilling register', 'LNEG ArcGIS REST distance query plus local geodesic distance calculation', 'Medium', { count: nearbyBoreholes.length, nearestDistanceM: Math.round(nearest.distanceM), examples }, 'Nearby drilling records are contextual evidence, not evidence of the ground profile beneath the selected parcel. Individual logs should be reviewed where foundation, excavation or groundwater questions are material.'));
  } else {
    records.push(evidence('pt-lneg-borehole-context-open', 'Ground investigations', 'No LNEG Sondabase drilling record was returned in the tested 15 km search area.', nearbyPointQueryUrl(SONDA, lat, lng, 15000, 100), 'Nearby national drilling-register search', 'LNEG ArcGIS REST distance query', 'Low', { reasonCode: 'NO_DATA', searchRadiusM: 15000 }, 'No returned borehole is not evidence that no investigation exists nearby; local studies and archived reports may contain additional information.', 'REQUIRES_VERIFICATION'));
  }

  const wp = Array.isArray(waterPoints?.features) ? waterPoints.features : [];
  const nearbyWater = wp.map((feature: any) => ({ feature, point: featurePoint(feature) })).filter((x: any) => x.point).map((x: any) => ({ ...x, distanceM: distanceM([lat, lng], x.point) })).sort((a: any, b: any) => a.distanceM - b.distanceM);
  if (nearbyWater.length) {
    const nearest = nearbyWater[0];
    records.push(evidence('pt-lneg-hydro-point-context', 'Hydrogeology', `LNEG's Portuguese hydrogeological-resource database returns ${nearbyWater.length} nearby water-resource record${nearbyWater.length === 1 ? '' : 's'} (wells, boreholes, springs or research soundings); the nearest returned record is about ${Math.round(nearest.distanceM).toLocaleString('pt-PT')} m away.`, nearbyPointQueryUrl(HYDRO_POINTS, lat, lng, 15000, 100), 'Nearby points from the national hydrogeological resources database', 'LNEG ArcGIS REST distance query plus local geodesic distance calculation', 'Medium', { count: nearbyWater.length, nearestDistanceM: Math.round(nearest.distanceM), examples: nearbyWater.slice(0, 5).map((item: any) => ({ reference: text(item.feature?.attributes?.RefDH), type: item.feature?.attributes?.IDTipoPA ?? null, purpose: item.feature?.attributes?.IDObjectivo ?? null, use: item.feature?.attributes?.IDUso ?? null, municipality: text(item.feature?.attributes?.Municipio), distanceM: Math.round(item.distanceM) })) }, 'Nearby hydrogeological-resource points are contextual records and do not establish groundwater depth, seasonal variation or dewatering requirements for the selected parcel.'));
  }

  const aq = Array.isArray(aquifer?.features) ? aquifer.features[0] : null;
  if (aq?.attributes) {
    const p = aq.attributes;
    records.push(evidence('pt-lneg-aquifer-system', 'Hydrogeology', `LNEG maps the selected coordinate within aquifer system ${text(p.NomeCompleto) || text(p.CodigoInag) || 'a mapped aquifer system'}${text(p.SistemaAquifero) ? ` (${text(p.SistemaAquifero)})` : ''}.`, HYDRO_AQUIFER, 'Mapped aquifer-system polygon containing the selected coordinate', 'LNEG ArcGIS REST point query against national hydrogeological resource mapping', 'High', { code: text(p.CodigoInag), name: text(p.NomeCompleto), system: text(p.SistemaAquifero), age: text(p.Idade) }, 'Mapped aquifer systems provide regional hydrogeological context, not a parcel-specific groundwater-level or yield measurement.'));
  } else {
    records.push(evidence('pt-lneg-aquifer-system-open', 'Hydrogeology', 'The LNEG aquifer-system query returned no mapped aquifer polygon containing the selected coordinate.', HYDRO_AQUIFER, 'Selected site coordinate', 'LNEG ArcGIS REST point query', 'Low', { reasonCode: 'NO_DATA' }, 'No returned polygon is not evidence that groundwater resources are absent or unimportant.', 'REQUIRES_VERIFICATION'));
  }

  return records;
}

export function enrichPortugalNationalEvidence(report: any, evidence: EvidenceItem[]): void {
  if (!report) return;
  const existing = report.geosurvey_context && typeof report.geosurvey_context === 'object' ? report.geosurvey_context : {};
  const geology = evidence.find(item => ['pt-lneg-geology-200k', 'pt-lneg-geology-1m'].includes(item.id) && item.status === 'VERIFIED');
  const aquifer = evidence.find(item => item.id === 'pt-lneg-aquifer-system' && item.status === 'VERIFIED');
  const gv = geology?.value && typeof geology.value === 'object' ? geology.value as Record<string, unknown> : {};
  const av = aquifer?.value && typeof aquifer.value === 'object' ? aquifer.value as Record<string, unknown> : {};
  const unit = text(gv.unit); const lithology = text(gv.lithology); const age = text(gv.age);
  const aq = text(av.name) || text(av.system);
  report.geosurvey_context = {
    ...existing,
    survey_authority: 'LNEG — Laboratório Nacional de Energia e Geologia',
    source_name: geology?.sourceName || 'LNEG GeoPortal', source_url: PORTAL,
    geological_unit_name: unit || existing.geological_unit_name, lithology_type: lithology || existing.lithology_type,
    geological_period_era: age || existing.geological_period_era,
    groundwater_regime: aq || existing.groundwater_regime,
    evidence_level: geology || aquifer ? 'VERIFIED' : existing.evidence_level
  };
}

export const PORTUGAL_GEOLOGY_SOURCES = { geology200k: GEO_200K, geology1m: GEO_1M, boreholes: SONDA, hydroPoints: HYDRO_POINTS, aquifers: HYDRO_AQUIFER, portal: PORTAL };
