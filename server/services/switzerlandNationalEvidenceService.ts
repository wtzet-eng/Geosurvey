import type { EvidenceItem, VerifiedSiteReport } from '../types';

type FetchLike = typeof fetch;
type ReasonCode = 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
type SwissEvidence = EvidenceItem & { reasonCode?: ReasonCode };

const IDENTIFY = 'https://api3.geo.admin.ch/rest/services/ech/MapServer/identify';
const BEDROCK = 'ch.swisstopo.geologie-swissgeocover2d_bedrock';
const UNCONSOLIDATED = 'ch.swisstopo.geologie-swissgeocover2d_unconsolidated';
const HYDRO = 'ch.bafu.hydrogeologische-karte_100';
const GROUNDWATER = 'ch.bafu.grundwasserkoerper';
const SEISMIC_SUBSOIL = 'ch.bafu.gefahren-baugrundklassen';
const SEISMIC_ZONE = 'ch.bafu.gefahren-gefaehrdungszonen';
const BUILDING_ZONES = 'ch.are.bauzonen';
const RUNOFF = 'ch.bafu.gefaehrdungskarte-oberflaechenabfluss';
const KBS = 'https://www.geodienste.ch/db/kataster_belasteter_standorte_v1_5_0/deu/ogcapi';
const KBS_AREAS = 'belastete_standorte_flaechen';
const KBS_POINTS = 'belastete_standorte_punkte';
const today = () => new Date().toISOString().slice(0, 10);

const text = (v: unknown): string | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return null;
  const value = v.trim().replace(/\s+/g, ' ');
  return value && !/^(null|none|unknown|n\/a|-+)$/i.test(value) ? value : null;
};
const preferred = (attrs: Record<string, any>, names: string[]): string | null => {
  for (const wanted of names) {
    const key = Object.keys(attrs || {}).find(k => k.toLowerCase() === wanted.toLowerCase());
    if (key) {
      const value = text(attrs[key]);
      if (value) return value;
    }
  }
  return null;
};
function readableLabel(result: any, names: string[]): string | null {
  const attrs = result?.attributes || result?.properties || {};
  return preferred(attrs, names)
    || text(result?.label)
    || text(result?.featureId)
    || Object.entries(attrs).map(([, value]) => text(value)).find(value => value && !/^https?:/i.test(value)) || null;
}
function identifyUrl(layer: string, lat: number, lng: number): string {
  const d = 0.002;
  const p = new URLSearchParams({
    geometryType: 'esriGeometryPoint', geometry: `${lng},${lat}`, sr: '4326',
    layers: `all:${layer}`, returnGeometry: 'false',
    mapExtent: `${lng-d},${lat-d},${lng+d},${lat+d}`,
    imageDisplay: '101,101,96', tolerance: '0', lang: 'de'
  });
  return `${IDENTIFY}?${p}`;
}
async function json(fetcher: FetchLike, url: string, timeout = 9000): Promise<any | null> {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json,application/geo+json', 'User-Agent': 'LandSurf/1.0 Switzerland evidence' }, signal: ctrl.signal });
    if (!response.ok) return null;
    const body: any = await response.json();
    return body && !body.error ? body : null;
  } catch { return null; } finally { clearTimeout(timer); }
}
async function identify(fetcher: FetchLike, layer: string, lat: number, lng: number): Promise<any[] | null> {
  const body = await json(fetcher, identifyUrl(layer, lat, lng));
  if (body === null) return null;
  return Array.isArray(body.results) ? body.results : [];
}
function unavailable(id: string, category: string, sourceName: string, sourceUrl: string, claim: string, reasonCode: ReasonCode = 'NO_DATA'): SwissEvidence {
  return {
    id, category, claim, status: 'REQUIRES_VERIFICATION', sourceName, sourceUrl, datasetDate: today(),
    spatialRelationship: 'Selected site / official Swiss source',
    calculationMethod: 'Official Swiss spatial-service query with fail-closed validation', confidence: 'Low',
    limitation: 'An empty or failed automated response is not evidence that the relevant condition is absent. Verify the current official source before a site decision.',
    value: { reasonCode }, reasonCode
  };
}
async function mappedLayer(opts: {
  id: string; category: string; layer: string; sourceName: string; lat: number; lng: number; fetcher: FetchLike;
  names: string[]; claim: (label: string) => string; limitation: string;
}): Promise<SwissEvidence> {
  const results = await identify(opts.fetcher, opts.layer, opts.lat, opts.lng);
  const sourceUrl = `https://api3.geo.admin.ch/rest/services/api/MapServer/${opts.layer}/legend`;
  if (results === null) return unavailable(`${opts.id}-unavailable`, opts.category, opts.sourceName, sourceUrl, `${opts.sourceName} could not be queried.`, 'SOURCE_UNAVAILABLE');
  if (!results.length) return unavailable(`${opts.id}-no-data`, opts.category, opts.sourceName, sourceUrl, `The official Swiss layer returned no mapped feature at the selected coordinate.`);
  const label = readableLabel(results[0], opts.names);
  if (!label) return unavailable(`${opts.id}-malformed`, opts.category, opts.sourceName, sourceUrl, 'The official Swiss layer returned a feature without a readable classification.', 'MALFORMED_DATA');
  return {
    id: opts.id, category: opts.category, claim: opts.claim(label), status: 'VERIFIED',
    sourceName: opts.sourceName, sourceUrl, datasetDate: today(),
    spatialRelationship: 'Official mapped feature at the selected coordinate',
    calculationMethod: `geo.admin.ch Identify query of ${opts.layer} in EPSG:4326`, confidence: 'High',
    limitation: opts.limitation, value: { label, attributes: results[0]?.attributes || {} }
  };
}

function pointInRing(lng: number, lat: number, ring: any[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i]?.[0]), yi = Number(ring[i]?.[1]), xj = Number(ring[j]?.[0]), yj = Number(ring[j]?.[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}
function containsPoint(geometry: any, lng: number, lat: number): boolean {
  if (geometry?.type === 'Polygon') return Boolean(geometry.coordinates?.[0] && pointInRing(lng, lat, geometry.coordinates[0]));
  if (geometry?.type === 'MultiPolygon') return (geometry.coordinates || []).some((polygon: any[]) => polygon?.[0] && pointInRing(lng, lat, polygon[0]));
  return false;
}
function distanceM(lat1:number,lng1:number,lat2:number,lng2:number):number {
  const r=6371000,to=(x:number)=>x*Math.PI/180,dp=to(lat2-lat1),dl=to(lng2-lng1);
  const q=Math.sin(dp/2)**2+Math.cos(to(lat1))*Math.cos(to(lat2))*Math.sin(dl/2)**2;
  return 2*r*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
}
async function contaminatedSites(lat: number, lng: number, fetcher: FetchLike): Promise<SwissEvidence> {
  const radiusM = 500;
  const dy = radiusM / 111320, dx = radiusM / (111320 * Math.max(.2, Math.cos(lat * Math.PI / 180)));
  const bbox = `${lng-dx},${lat-dy},${lng+dx},${lat+dy}`;
  const makeUrl = (collection: string) => `${KBS}/collections/${collection}/items?${new URLSearchParams({f:'json',bbox,limit:'100',crs:'http://www.opengis.net/def/crs/OGC/1.3/CRS84'})}`;
  const [areaBody, pointBody] = await Promise.all([json(fetcher, makeUrl(KBS_AREAS), 12000), json(fetcher, makeUrl(KBS_POINTS), 12000)]);
  const sourceName = 'geodienste.ch / cantonal registers — Kataster der belasteten Standorte (KbS)';
  const sourceUrl = 'https://geodienste.ch/services/kataster_belasteter_standorte?locale=de';
  if (areaBody === null || pointBody === null) {
    return unavailable('ch-kbs-unavailable','Contaminated land',sourceName,sourceUrl,'The harmonised Swiss contaminated-site service did not return a complete response; no clear-site conclusion is made.','SOURCE_UNAVAILABLE');
  }
  const areas = Array.isArray(areaBody.features) ? areaBody.features : [];
  const points = Array.isArray(pointBody.features) ? pointBody.features : [];
  const overlaps = areas.filter((f:any) => containsPoint(f.geometry,lng,lat));
  const nearbyPoints = points.map((f:any) => {
    const c=f.geometry?.coordinates;
    const d=Array.isArray(c)&&Number.isFinite(Number(c[0]))&&Number.isFinite(Number(c[1]))?Math.round(distanceM(lat,lng,Number(c[1]),Number(c[0]))):null;
    return {feature:f,distanceM:d};
  }).filter((x:any)=>x.distanceM!==null&&x.distanceM<=radiusM).sort((a:any,b:any)=>a.distanceM-b.distanceM);
  const describe = (f:any) => {
    const a=f.properties||{};
    return {
      egrid: preferred(a,['egrid']),
      parcelNumbers: preferred(a,['parzellennummern','parzellennummer']),
      siteType: preferred(a,['standorttyp']),
      status: preferred(a,['statusaltlv']),
      authority: preferred(a,['zustaendige_behoerde']),
      extractUrl: preferred(a,['url_kbs_auszug','url_kbS_auszug'])
    };
  };
  const records = overlaps.map(describe);
  return {
    id:'ch-kbs-contaminated-sites', category:'Contaminated land',
    claim: overlaps.length
      ? `The harmonised cantonal contaminated-site register maps ${overlaps.length} recorded site${overlaps.length===1?'':'s'} directly at the selected coordinate.`
      : nearbyPoints.length
        ? `The contaminated-site service returned no direct polygon overlap at the selected coordinate; ${nearbyPoints.length} mapped point record${nearbyPoints.length===1?' is':'s are'} present within 500 m.`
        : 'The harmonised cantonal contaminated-site service responded successfully and returned no direct mapped site at the selected coordinate or point record within 500 m.',
    status:'VERIFIED', sourceName, sourceUrl, datasetDate:today(),
    spatialRelationship:'Direct point-in-polygon screen plus 500 m point-record context',
    calculationMethod:'geodienste.ch OGC API Features queries of KbS area and point collections in CRS84',
    confidence: overlaps.length ? 'High' : 'Medium',
    limitation:'This is a screening query of the published cantonal contaminated-site registers. It does not establish soil cleanliness, parcel-wide absence, remediation status beyond the source record, or liability. Confirm the current cantonal KbS extract before acquisition or development.',
    value:{intersects:overlaps.length>0,records,nearbyPointCount:nearbyPoints.length,nearestPointDistanceM:nearbyPoints[0]?.distanceM??null}
  };
}

export async function querySwitzerlandNationalEvidence(lat:number,lng:number,fetcher:FetchLike=fetch):Promise<SwissEvidence[]> {
  const [bedrock,unconsolidated,hydro,groundwater,seismicSubsoil,seismicZone,buildingZone,runoff,kbs] = await Promise.all([
    mappedLayer({id:'ch-geocover-bedrock',category:'Mapped bedrock geology',layer:BEDROCK,sourceName:'swisstopo — swissGEOCOVER2D bedrock',lat,lng,fetcher,names:['lithostratigraphy','lithostratigraphic_unit','unit_name','name','bezeichnung','description'],claim:l=>`swissGEOCOVER2D maps the bedrock unit at the selected coordinate as ${l}.`,limitation:'Geological mapping is screening context and does not establish rock-head depth, weathering, fractures or geotechnical design parameters beneath the parcel.'}),
    mappedLayer({id:'ch-geocover-unconsolidated',category:'Mapped superficial geology',layer:UNCONSOLIDATED,sourceName:'swisstopo — swissGEOCOVER2D unconsolidated deposits',lat,lng,fetcher,names:['lithology','unit_name','name','bezeichnung','description'],claim:l=>`swissGEOCOVER2D maps the unconsolidated/superficial unit at the selected coordinate as ${l}.`,limitation:'Mapped superficial deposits do not establish thickness, fill, density, consistency or parcel-specific stratigraphy.'}),
    mappedLayer({id:'ch-hydrogeology-100k',category:'Hydrogeological context',layer:HYDRO,sourceName:'BAFU — Hydrogeologische Karte der Schweiz 1:100 000',lat,lng,fetcher,names:['name','bezeichnung','description','hydrogeologie','klasse'],claim:l=>`The federal hydrogeological map classifies the selected coordinate as ${l}.`,limitation:'Regional hydrogeological mapping does not establish groundwater depth, seasonal levels, permeability or dewatering requirements at the parcel.'}),
    mappedLayer({id:'ch-groundwater-body',category:'Groundwater body',layer:GROUNDWATER,sourceName:'BAFU — Grundwasserkörper',lat,lng,fetcher,names:['name','bezeichnung','description','gwk_name'],claim:l=>`BAFU maps the selected coordinate within groundwater-body context ${l}.`,limitation:'Groundwater-body mapping is regional context, not a parcel water-table measurement or water-right determination.'}),
    mappedLayer({id:'ch-seismic-subsoil',category:'Seismic ground context',layer:SEISMIC_SUBSOIL,sourceName:'BAFU — Baugrundklassen nach SIA 261',lat,lng,fetcher,names:['klasse','class','name','bezeichnung','description'],claim:l=>`BAFU seismic ground-class mapping returns class ${l} at the selected coordinate.`,limitation:'Mapped SIA ground class is screening context and does not replace project-specific seismic/geotechnical ground classification.'}),
    mappedLayer({id:'ch-seismic-zone',category:'Seismic hazard zone',layer:SEISMIC_ZONE,sourceName:'BAFU — Erdbebengefährdungszonen SIA 261',lat,lng,fetcher,names:['zone','klasse','class','name','bezeichnung'],claim:l=>`The federal seismic-zone layer returns ${l} at the selected coordinate.`,limitation:'The mapped seismic zone is a code-level regional parameter and not a site-specific seismic design assessment.'}),
    mappedLayer({id:'ch-building-zone',category:'Planning context',layer:BUILDING_ZONES,sourceName:'Bundesamt für Raumentwicklung (ARE) — Bauzonen Schweiz harmonisiert',lat,lng,fetcher,names:['nutzungsart','typ','zone','name','bezeichnung','description'],claim:l=>`The harmonised Swiss building-zone layer returns ${l} at the selected coordinate.`,limitation:'The harmonised federal building-zone dataset is planning context only. It does not certify development rights, permitted use, density, setbacks or a current binding communal/cantonal decision; verify the ÖREB extract and competent planning authority.'}),
    mappedLayer({id:'ch-surface-runoff',category:'Surface runoff context',layer:RUNOFF,sourceName:'BAFU — Gefährdungskarte Oberflächenabfluss',lat,lng,fetcher,names:['klasse','class','intensitaet','intensity','name','bezeichnung'],claim:l=>`The federal surface-runoff map returns ${l} at the selected coordinate.`,limitation:'Surface-runoff mapping is a screening model and is not a statutory flood-hazard determination or hydraulic site assessment.'}),
    contaminatedSites(lat,lng,fetcher)
  ]);
  return [bedrock,unconsolidated,hydro,groundwater,seismicSubsoil,seismicZone,buildingZone,runoff,kbs];
}

export function enrichSwitzerlandNationalEvidence(report:VerifiedSiteReport&Record<string,any>,items:SwissEvidence[]):void {
  const bedrock=items.find(i=>i.id==='ch-geocover-bedrock'&&i.status==='VERIFIED');
  const superficial=items.find(i=>i.id==='ch-geocover-unconsolidated'&&i.status==='VERIFIED');
  if(bedrock){
    const label=(bedrock.value as any)?.label||null;
    report.geosurvey_context={...(report.geosurvey_context||{}),geological_unit_name:label,evidence_level:'VERIFIED',source_name:bedrock.sourceName,source_url:bedrock.sourceUrl,source_scale:'swissGEOCOVER2D / approximately 1:25,000 source mapping'};
    report.soil={...report.soil,geologicalUnit:label||report.soil.geologicalUnit,sourceName:bedrock.sourceName,sourceUrl:bedrock.sourceUrl};
  }
  if(superficial){
    const label=(superficial.value as any)?.label||null;
    report.switzerland_superficial_geology=label;
  }
  const seismic=items.find(i=>i.id==='ch-seismic-zone'&&i.status==='VERIFIED');
  if(seismic&&report.terrain?.geohazards?.seismicRisk){
    report.terrain.geohazards.seismicRisk={...report.terrain.geohazards.seismicRisk,status:'VERIFIED',zone:(seismic.value as any)?.label||'Mapped Swiss seismic zone',sourceName:seismic.sourceName};
  }
  const zone=items.find(i=>i.id==='ch-building-zone'&&i.status==='VERIFIED');
  if(zone&&report.planning){
    report.planning={...report.planning,planDesignation:(zone.value as any)?.label||report.planning.planDesignation,sourceName:zone.sourceName,limitation:'Federal harmonised building-zone context is available, but binding buildability and restrictions still require the current cantonal/communal plan and ÖREB extract.'};
  }
  report.switzerland_contaminated_site=items.find(i=>i.id==='ch-kbs-contaminated-sites')?.value||null;
}
