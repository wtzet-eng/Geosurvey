import type { EvidenceItem, VerifiedSiteReport } from '../types';

type FetchLike = typeof fetch;
type LuxembourgEvidence = EvidenceItem & { reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA' };
const BASE = 'https://features.geoportail.lu';
const GEOLOGY = '2167/6';
const GEOLOGY_FALLBACK = '2169/2';
const AQUIFER = '631';
const GROUNDWATER_BODY = '2269';
const HYDRO_BOREHOLES = '2265';
const REFERENCE_BOREHOLES = '2176';
const PAG_ZONING = '698/28';
const FLOOD_100 = '3262/7';
const FLOOD_EXTREME = '3263/11';
const GEO_SOURCE = 'Geoportail national du Grand-Duché de Luxembourg — geological and hydrogeological datasets';
const GEO_PORTAL = 'https://map.geoportail.lu/';
const today = () => new Date().toISOString().slice(0, 10);

function text(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  return s && !/^(null|none|unknown|n\/a)$/i.test(s) ? s : null;
}
function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') { const n = Number(v.replace(',', '.')); return Number.isFinite(n) ? n : null; }
  return null;
}
function distM(a: number, b: number, c: number, d: number): number {
  const r = 6371000, to = (x: number) => x * Math.PI / 180, dp = to(c - a), dl = to(d - b);
  const q = Math.sin(dp / 2) ** 2 + Math.cos(to(a)) * Math.cos(to(c)) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}
function sourceUrl(id: string): string { return `${BASE}/collections/${encodeURIComponent(id)}?f=html`; }
function pointBox(lat: number, lng: number, eps = 0.00005): string { return `${lng - eps},${lat - eps},${lng + eps},${lat + eps}`; }
function radiusBox(lat: number, lng: number, radiusM: number): string {
  const dy = radiusM / 111320;
  const dx = radiusM / (111320 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  return `${lng - dx},${lat - dy},${lng + dx},${lat + dy}`;
}
function itemsUrl(id: string, bbox: string, limit = 100): string {
  return `${BASE}/collections/${encodeURIComponent(id)}/items?f=json&limit=${limit}&bbox=${bbox}`;
}
async function features(fetcher: FetchLike, id: string, bbox: string, limit = 100): Promise<any[] | null> {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const response = await fetcher(itemsUrl(id, bbox, limit), { headers: { Accept: 'application/geo+json,application/json', 'User-Agent': 'LandSurf/1.0 Luxembourg national evidence' }, signal: ctrl.signal });
    if (!response.ok) return null;
    const body: any = await response.json();
    return Array.isArray(body?.features) ? body.features : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

function pointInRing(lat: number, lng: number, ring: any[]): boolean {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (!Array.isArray(a) || !Array.isArray(b)) continue;
    const xi = Number(a[0]), yi = Number(a[1]), xj = Number(b[0]), yj = Number(b[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const crosses = ((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi);
    if (crosses) inside = !inside;
  }
  return inside;
}
function containsPoint(feature: any, lat: number, lng: number): boolean {
  const g = feature?.geometry;
  if (!g) return false;
  if (g.type === 'Polygon') return pointInRing(lat, lng, g.coordinates?.[0]);
  if (g.type === 'MultiPolygon') return Array.isArray(g.coordinates) && g.coordinates.some((poly: any) => pointInRing(lat, lng, poly?.[0]));
  return false;
}
function containing(fs: any[], lat: number, lng: number): any[] {
  const polygonal = fs.filter(f => f?.geometry?.type === 'Polygon' || f?.geometry?.type === 'MultiPolygon');
  const exact = polygonal.filter(f => containsPoint(f, lat, lng));
  return exact.length ? exact : fs.length === 1 ? fs : [];
}

function unavailable(id: string, category: string, sourceName: string, url: string, claim: string, reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA' = 'NO_DATA'): LuxembourgEvidence {
  return {
    id, category, claim, status: 'REQUIRES_VERIFICATION', sourceName, sourceUrl: url, datasetDate: today(),
    spatialRelationship: 'Selected site / official national source', calculationMethod: 'Luxembourg Geoportail OGC API Features query with fail-closed validation', confidence: 'Low',
    limitation: 'An empty or failed automated response is not evidence that the relevant condition is absent. Verify the current official national map and source records before a site decision.',
    value: { reasonCode }, reasonCode
  };
}

async function geology(lat: number, lng: number, fetcher: FetchLike): Promise<LuxembourgEvidence> {
  let fs = await features(fetcher, GEOLOGY, pointBox(lat, lng)); let id = GEOLOGY;
  if (fs !== null && !containing(fs, lat, lng).length) { fs = await features(fetcher, GEOLOGY_FALLBACK, pointBox(lat, lng)); id = GEOLOGY_FALLBACK; }
  if (fs === null) return unavailable('lu-geo-geology-unavailable', 'Mapped bedrock geology', GEO_SOURCE, sourceUrl(GEOLOGY), 'Luxembourg geological mapping could not be queried.', 'SOURCE_UNAVAILABLE');
  const hit = containing(fs, lat, lng)[0];
  if (!hit) return unavailable('lu-geo-geology-no-data', 'Mapped bedrock geology', GEO_SOURCE, sourceUrl(id), 'The official geological collections returned no containing geological polygon at the selected coordinate.');
  const a = hit.properties || {};
  const unitFr = text(a.NOMUNIT_FR), unitDe = text(a.NOMUNIT_DE), descriptionFr = text(a.DESCUNIT_FR), descriptionDe = text(a.DESCUNIT_DE);
  if (!unitFr && !unitDe) return unavailable('lu-geo-geology-malformed', 'Mapped bedrock geology', GEO_SOURCE, sourceUrl(id), 'The geological service returned a feature without a readable unit name.', 'MALFORMED_DATA');
  return {
    id: 'lu-geo-geology', category: 'Mapped bedrock geology',
    claim: `Luxembourg national geological mapping identifies the site as ${unitFr || unitDe}${text(a.ABREVSTRAT) ? ` (${text(a.ABREVSTRAT)})` : ''}.`,
    status: 'VERIFIED', sourceName: 'Geoportail Luxembourg — Carte géologique harmonisée', sourceUrl: sourceUrl(id), datasetDate: today(),
    spatialRelationship: 'Official geological polygon containing the selected coordinate', calculationMethod: `OGC API Features point-in-polygon query of collection ${id}`,
    confidence: 'High', limitation: 'National geological mapping is screening evidence. It does not establish local weathering, fill, rock-head depth, fractures, groundwater level or engineering design parameters beneath the parcel.',
    value: { unitFr, unitDe, descriptionFr, descriptionDe, code: text(a.CODESTRATUNIT) || text(a.CODE_SROCH), stratigraphicCode: text(a.ABREVSTRAT), periodFr: text(a.PERIOD_FR), epochFr: text(a.EPOCH_FR), ageFr: text(a.AGE_FR), ageMinMa: num(a.AGE_MIN), ageMaxMa: num(a.AGE_MAX) }
  };
}

async function hydrogeology(lat: number, lng: number, fetcher: FetchLike): Promise<LuxembourgEvidence[]> {
  const [aquifers, bodies] = await Promise.all([features(fetcher, AQUIFER, pointBox(lat, lng)), features(fetcher, GROUNDWATER_BODY, pointBox(lat, lng))]);
  const out: LuxembourgEvidence[] = [];
  if (aquifers === null) out.push(unavailable('lu-geo-aquifer-unavailable', 'Hydrogeological context', GEO_SOURCE, sourceUrl(AQUIFER), 'Luxembourg aquifer mapping could not be queried.', 'SOURCE_UNAVAILABLE'));
  else {
    const hit = containing(aquifers, lat, lng)[0];
    if (!hit) out.push(unavailable('lu-geo-aquifer-no-data', 'Hydrogeological context', GEO_SOURCE, sourceUrl(AQUIFER), 'No official aquifer polygon was returned at the selected coordinate.'));
    else out.push({
      id: 'lu-geo-aquifer', category: 'Hydrogeological context', claim: `The national aquifer layer maps aquifer code ${text(hit.properties?.CODE_DC) || 'unclassified'} at the selected coordinate.`,
      status: 'VERIFIED', sourceName: 'Geoportail Luxembourg — Aquifères', sourceUrl: sourceUrl(AQUIFER), datasetDate: today(), spatialRelationship: 'Aquifer polygon containing selected coordinate',
      calculationMethod: 'OGC API Features point-in-polygon query', confidence: 'High', limitation: 'Aquifer mapping is regional hydrogeological context and does not establish groundwater depth, seasonal level, permeability or dewatering requirements at the parcel.',
      value: { code: text(hit.properties?.CODE_DC) }
    });
  }
  if (bodies === null) out.push(unavailable('lu-geo-groundwater-body-unavailable', 'Groundwater body', GEO_SOURCE, sourceUrl(GROUNDWATER_BODY), 'Luxembourg groundwater-body mapping could not be queried.', 'SOURCE_UNAVAILABLE'));
  else {
    const hit = containing(bodies, lat, lng)[0];
    if (!hit) out.push(unavailable('lu-geo-groundwater-body-no-data', 'Groundwater body', GEO_SOURCE, sourceUrl(GROUNDWATER_BODY), 'No official groundwater-body polygon was returned at the selected coordinate.'));
    else {
      const name = text(hit.properties?.NAME), code = text(hit.properties?.MS_CD_GB);
      out.push({
        id: 'lu-geo-groundwater-body', category: 'Groundwater body', claim: `The official 2021 groundwater-body layer identifies ${name || code || 'a mapped groundwater body'} at the selected coordinate.`,
        status: 'VERIFIED', sourceName: 'Geoportail Luxembourg — Masses d’eau souterraine 2021', sourceUrl: sourceUrl(GROUNDWATER_BODY), datasetDate: today(), spatialRelationship: 'Groundwater-body polygon containing selected coordinate',
        calculationMethod: 'OGC API Features point-in-polygon query', confidence: 'High', limitation: 'Groundwater-body identity is regional context and is not a parcel water-level measurement or groundwater investigation.', value: { name, code }
      });
    }
  }
  return out;
}

async function boreholes(lat: number, lng: number, fetcher: FetchLike): Promise<LuxembourgEvidence> {
  const radiusM = 5000, bbox = radiusBox(lat, lng, radiusM);
  const [hydro, reference] = await Promise.all([features(fetcher, HYDRO_BOREHOLES, bbox, 100), features(fetcher, REFERENCE_BOREHOLES, bbox, 100)]);
  if (hydro === null && reference === null) return unavailable('lu-geo-boreholes-unavailable', 'Nearby boreholes', GEO_SOURCE, sourceUrl(HYDRO_BOREHOLES), 'Luxembourg hydrogeological and reference borehole collections could not be queried.', 'SOURCE_UNAVAILABLE');
  const records = [
    ...(hydro || []).map((f: any) => ({ kind: 'Hydrogeological borehole', f })),
    ...(reference || []).map((f: any) => ({ kind: 'Reference borehole', f }))
  ].map(({ kind, f }) => {
    const c = f?.geometry?.coordinates, lon = Array.isArray(c) ? num(c[0]) : null, lat2 = Array.isArray(c) ? num(c[1]) : null, a = f?.properties || {};
    return {
      kind, station: text(a.Station) || text(a.NRFORAGE), name: text(a.Name) || text(a.DESIGNAT), project: text(a.TITREPROJET), depthM: num(a.PROF_FORAGE),
      stratigraphy: text(a.STRATIGR) || text(a.STRATI), logUrl: text(a.LIEN), distanceM: lon !== null && lat2 !== null ? Math.round(distM(lat, lng, lat2, lon)) : null
    };
  }).filter((r: any) => r.distanceM !== null && r.distanceM <= radiusM).sort((a: any, b: any) => a.distanceM - b.distanceM);
  return {
    id: 'lu-geo-boreholes', category: 'Nearby boreholes',
    claim: records.length ? `Luxembourg official borehole collections returned ${records.length} record${records.length === 1 ? '' : 's'} within 5 km; nearest approximately ${records[0].distanceM} m away.` : 'The official hydrogeological and reference-borehole collections responded but returned no borehole within the 5 km search radius.',
    status: 'VERIFIED', sourceName: 'Geoportail Luxembourg — Forages hydrogéologiques / Forages de référence', sourceUrl: sourceUrl(REFERENCE_BOREHOLES), datasetDate: today(),
    spatialRelationship: 'Official borehole point search within 5 km of selected coordinate', calculationMethod: 'OGC API Features bounding-box query followed by geodesic distance filtering and ordering',
    confidence: 'High', limitation: 'Nearby boreholes are contextual observations only. Their stratigraphy, depths and groundwater observations do not establish corresponding conditions beneath the selected parcel.',
    value: { searchRadiusM: radiusM, records: records.slice(0, 20), nearestDistanceM: records[0]?.distanceM ?? null }
  };
}

async function planning(lat: number, lng: number, fetcher: FetchLike): Promise<LuxembourgEvidence> {
  const fs = await features(fetcher, PAG_ZONING, pointBox(lat, lng));
  if (fs === null) return unavailable('lu-pag-zoning-unavailable', 'Planning context', 'Geoportail Luxembourg — Plan d’aménagement général (PAG)', sourceUrl(PAG_ZONING), 'National PAG zoning could not be queried.', 'SOURCE_UNAVAILABLE');
  const hits = containing(fs, lat, lng);
  if (!hits.length) return unavailable('lu-pag-zoning-no-data', 'Planning context', 'Geoportail Luxembourg — Plan d’aménagement général (PAG)', sourceUrl(PAG_ZONING), 'No PAG zoning polygon was returned at the selected coordinate.');
  const zones = hits.map((f: any) => ({ category: text(f.properties?.categorie), communeCode: text(f.properties?.code_com), file: text(f.properties?.nom_fichier) })).filter((z: any) => z.category);
  if (!zones.length) return unavailable('lu-pag-zoning-malformed', 'Planning context', 'Geoportail Luxembourg — Plan d’aménagement général (PAG)', sourceUrl(PAG_ZONING), 'A PAG polygon was returned without a readable zoning category.', 'MALFORMED_DATA');
  const categories = [...new Set(zones.map((z: any) => z.category))];
  return {
    id: 'lu-pag-zoning', category: 'Planning context', claim: `The national PAG layer maps the selected coordinate with zoning code ${categories.join(' / ')}.`, status: 'VERIFIED',
    sourceName: 'Geoportail Luxembourg — Plan d’aménagement général (PAG)', sourceUrl: sourceUrl(PAG_ZONING), datasetDate: today(),
    spatialRelationship: 'Official PAG zoning polygon containing selected coordinate', calculationMethod: 'OGC API Features point-in-polygon query of national PAG zoning collection 698/28',
    confidence: 'High', limitation: 'The code is reported as official planning context only. It does not by itself establish buildability, permitted project type, density, setbacks, PAP requirements or a planning permission; verify the current PAG/PAP and commune rules.',
    value: { zones, categories, residentialOrMixedCode: categories.some((value: string) => /^(HAB|MIX)/i.test(value)) }
  };
}

async function flood(lat: number, lng: number, fetcher: FetchLike): Promise<LuxembourgEvidence> {
  const [hq100Raw, extremeRaw] = await Promise.all([features(fetcher, FLOOD_100, pointBox(lat, lng, 0.00002), 20), features(fetcher, FLOOD_EXTREME, pointBox(lat, lng, 0.00002), 20)]);
  if (hq100Raw === null || extremeRaw === null) return unavailable('lu-flood-unavailable', 'Flood hazard', 'Geoportail Luxembourg — official flood-hazard maps', sourceUrl(FLOOD_100), 'One or more official Luxembourg flood-hazard layers could not be queried; no automated absence conclusion is made.', 'SOURCE_UNAVAILABLE');
  const hq100 = containing(hq100Raw, lat, lng).map((f: any) => ({ depthClass: text(f.properties?.txt), watercourse: text(f.properties?.gewaesser), class: num(f.properties?.Klasse) }));
  const extreme = containing(extremeRaw, lat, lng).map((f: any) => ({ depthClass: text(f.properties?.txt), watercourse: text(f.properties?.gewaesser), class: num(f.properties?.Klasse) }));
  const claim = hq100.length
    ? `The selected coordinate directly intersects the official HQ100 flood-zone mapping${hq100[0].watercourse ? ` for ${hq100[0].watercourse}` : ''}${hq100[0].depthClass ? `; mapped depth class ${hq100[0].depthClass}` : ''}.`
    : extreme.length
      ? `The selected coordinate does not intersect the HQ100 layer but directly intersects the official extreme-flood mapping${extreme[0].watercourse ? ` for ${extreme[0].watercourse}` : ''}${extreme[0].depthClass ? `; mapped depth class ${extreme[0].depthClass}` : ''}.`
      : 'Both official HQ100 and extreme-flood layers responded and no flood polygon directly overlaps the selected coordinate.';
  return {
    id: 'lu-flood-screen', category: 'Flood hazard', claim, status: 'VERIFIED', sourceName: 'Geoportail Luxembourg — Cartes des zones inondables', sourceUrl: sourceUrl(FLOOD_100), datasetDate: today(),
    spatialRelationship: 'Direct point-in-polygon check at selected coordinate against HQ100 and extreme-flood layers', calculationMethod: 'Parallel OGC API Features queries of official flood-zone collections 3262/7 and 3263/11',
    confidence: hq100.length || extreme.length ? 'High' : 'Medium', limitation: 'This is a direct-overlap screen at the selected coordinate, not a hydraulic study or full parcel-intersection calculation. Nearby flood polygons, local drainage, surface-water flow and future climate conditions require separate review.',
    value: { intersectsHq100: hq100.length > 0, intersectsExtreme: extreme.length > 0, hq100, extreme }
  };
}

export async function queryLuxembourgNationalEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<LuxembourgEvidence[]> {
  const [g, h, b, p, f] = await Promise.all([geology(lat, lng, fetcher), hydrogeology(lat, lng, fetcher), boreholes(lat, lng, fetcher), planning(lat, lng, fetcher), flood(lat, lng, fetcher)]);
  return [g, ...h, b, p, f];
}

export function enrichLuxembourgNationalEvidence(report: VerifiedSiteReport & Record<string, any>, items: LuxembourgEvidence[]): void {
  const geologyItem = items.find(i => i.id === 'lu-geo-geology' && i.status === 'VERIFIED');
  const aquifer = items.find(i => i.id === 'lu-geo-aquifer' && i.status === 'VERIFIED');
  const body = items.find(i => i.id === 'lu-geo-groundwater-body' && i.status === 'VERIFIED');
  const pag = items.find(i => i.id === 'lu-pag-zoning' && i.status === 'VERIFIED');
  const floodItem = items.find(i => i.id === 'lu-flood-screen' && i.status === 'VERIFIED');
  if (geologyItem) {
    const v: any = geologyItem.value || {};
    const unit = v.unitFr || v.unitDe || null, desc = v.descriptionFr || v.descriptionDe || null, period = v.ageFr || v.epochFr || v.periodFr || null;
    report.geosurvey_context = { ...(report.geosurvey_context || {}), geological_unit_name: unit, lithology_type: desc, geological_period_era: period, evidence_level: 'VERIFIED', source_name: geologyItem.sourceName, source_url: geologyItem.sourceUrl, source_scale: 'national geological mapping' };
    report.soil = { ...report.soil, geologicalUnit: unit || report.soil.geologicalUnit, lithologyType: desc || report.soil.lithologyType, stratigraphicPeriod: period || report.soil.stratigraphicPeriod };
  }
  if (aquifer || body) {
    const av: any = aquifer?.value || {}, bv: any = body?.value || {};
    const description = [bv.name ? `Groundwater body: ${bv.name}${bv.code ? ` (${bv.code})` : ''}` : null, av.code ? `Aquifer code: ${av.code}` : null].filter(Boolean).join(' · ');
    if (description) {
      report.soil = { ...report.soil, groundwaterRegime: description };
      report.geosurvey_context = { ...(report.geosurvey_context || {}), groundwater_regime: description };
    }
  }
  if (pag) {
    const v: any = pag.value || {}, category = Array.isArray(v.categories) ? v.categories.join(' / ') : 'mapped';
    report.planning = {
      ...report.planning, status: 'VERIFIED', hasLocalPlan: true, planDesignation: `PAG zoning code ${category}`,
      permittedUseCategory: `Official PAG code ${category}; permitted use requires current commune/PAP verification`,
      maxFar: 'Requires municipal verification', maxCoveragePct: 'Requires municipal verification', minBiologicallyActivePct: 'Requires municipal verification',
      maxBuildingHeightM: 'Requires municipal verification', setbackRules: 'Requires municipal verification', authorityName: 'Competent Luxembourg commune / national planning authorities',
      documentRequired: 'Current commune PAG, applicable PAP and project-specific planning confirmation', sourceName: pag.sourceName, limitation: pag.limitation
    };
    report.luxembourg_pag = v;
  } else if (items.some(i => i.id.startsWith('lu-pag-zoning-'))) {
    report.planning = { ...report.planning, status: 'REQUIRES_VERIFICATION', hasLocalPlan: 'Unknown / Requires Municipal Confirmation', sourceName: 'Geoportail Luxembourg — PAG', limitation: 'Automated PAG zoning was unavailable or inconclusive; verify directly with the competent commune.' };
  }
  if (floodItem) {
    const v: any = floodItem.value || {};
    const level = v.intersectsHq100 ? 'High' : v.intersectsExtreme ? 'Moderate' : 'Not available';
    report.terrain.floodInundationRisk = {
      ...report.terrain.floodInundationRisk, status: 'VERIFIED', level,
      statutoryZoneStatus: v.intersectsHq100 ? 'Direct HQ100 flood-zone overlap at selected coordinate' : v.intersectsExtreme ? 'Direct extreme-flood-zone overlap at selected coordinate; no HQ100 overlap detected' : 'No direct HQ100/extreme flood-zone overlap detected at selected coordinate',
      description: floodItem.claim, sourceName: floodItem.sourceName, limitation: floodItem.limitation
    };
  } else if (items.some(i => i.id === 'lu-flood-unavailable')) {
    report.terrain.floodInundationRisk = { ...report.terrain.floodInundationRisk, status: 'REQUIRES_VERIFICATION', level: 'Not available', statutoryZoneStatus: 'Official flood service unavailable/inconclusive', description: 'Automated official flood-zone verification was unavailable.', sourceName: 'Geoportail Luxembourg — official flood-hazard maps', limitation: 'Verify the current official flood maps before a site decision.' };
  }
}
