import type { EvidenceItem, VerifiedSiteReport } from '../types';

type FetchLike = typeof fetch;
type ReasonCode = 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
export type BelgiumRegion = 'FLANDERS' | 'WALLONIA' | 'BRUSSELS' | 'UNKNOWN';
type BelgiumEvidence = EvidenceItem & { reasonCode?: ReasonCode };

const DOV_WMS = 'https://www.dov.vlaanderen.be/geoserver/wms';
const DOV_WFS = 'https://www.dov.vlaanderen.be/geoserver/wfs';
const FL_GEO_LAYER = 'neo_paleo:tertiair_50k';
const FL_BOREHOLES = 'dov-pub:Boringen';
const WA_GEO = 'https://geoservices.wallonie.be/arcgis/rest/services/SOL_SOUS_SOL/CARTE_GEOLOGIQUE_SIMPLE/MapServer/13';
const BRUSSELS_PORTAL = 'https://geobru.irisnet.be/';
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
  const r=6371000,to=(x:number)=>x*Math.PI/180,dp=to(c-a),dl=to(d-b);
  const q=Math.sin(dp/2)**2+Math.cos(to(a))*Math.cos(to(c))*Math.sin(dl/2)**2;
  return 2*r*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
}
function radiusBox(lat:number,lng:number,radiusM:number):string {
  const dy=radiusM/111320, dx=radiusM/(111320*Math.max(.2,Math.cos(lat*Math.PI/180)));
  return `${lng-dx},${lat-dy},${lng+dx},${lat+dy},EPSG:4326`;
}
function unavailable(id:string,category:string,sourceName:string,sourceUrl:string,claim:string,reasonCode:ReasonCode='NO_DATA'):BelgiumEvidence {
  return { id,category,claim,status:'REQUIRES_VERIFICATION',sourceName,sourceUrl,datasetDate:today(),spatialRelationship:'Selected site / regional official source',
    calculationMethod:'Belgian regional official-source query with fail-closed validation',confidence:'Low',
    limitation:'An empty or failed automated response is not evidence that the relevant condition is absent. Verify the current regional official map and original source records before a site decision.',value:{reasonCode},reasonCode };
}

export function resolveBelgiumRegion(regionCode?: string, state?: string, county?: string): BelgiumRegion {
  const code=String(regionCode||'').toUpperCase();
  if(code==='BE-VLG') return 'FLANDERS';
  if(code==='BE-WAL') return 'WALLONIA';
  if(code==='BE-BRU') return 'BRUSSELS';
  const value=`${state||''} ${county||''}`.toLowerCase();
  if(/bruxelles|brussel/.test(value)) return 'BRUSSELS';
  if(/wallon|liège|liege|hainaut|namur|luxembourg|brabant wallon/.test(value)) return 'WALLONIA';
  if(/vlaanderen|antwerpen|limburg|oost-vlaanderen|west-vlaanderen|vlaams-brabant/.test(value)) return 'FLANDERS';
  return 'UNKNOWN';
}

async function fetchJson(fetcher:FetchLike,url:string,timeout=9000):Promise<any|null>{
  const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
  try{const r=await fetcher(url,{headers:{Accept:'application/json,application/geo+json','User-Agent':'LandSurf/1.0 Belgium regional evidence'},signal:c.signal});if(!r.ok)return null;const j:any=await r.json();return j&&!j.error?j:null;}catch{return null;}finally{clearTimeout(t)}
}
function flandersFeatureInfoUrl(layer:string,lat:number,lng:number):string{
  const d=.001,p=new URLSearchParams({service:'WMS',version:'1.1.1',request:'GetFeatureInfo',layers:layer,query_layers:layer,srs:'EPSG:4326',bbox:`${lng-d},${lat-d},${lng+d},${lat+d}`,width:'101',height:'101',x:'50',y:'50',info_format:'application/json',feature_count:'5'});
  return `${DOV_WMS}?${p}`;
}
async function flandersGeology(lat:number,lng:number,fetcher:FetchLike):Promise<BelgiumEvidence>{
  const j=await fetchJson(fetcher,flandersFeatureInfoUrl(FL_GEO_LAYER,lat,lng));
  if(!j)return unavailable('be-fl-geology-unavailable','Mapped geology','Databank Ondergrond Vlaanderen (DOV)',DOV_WMS,'Flemish DOV geology could not be queried.','SOURCE_UNAVAILABLE');
  const f=Array.isArray(j.features)?j.features[0]:null;
  if(!f)return unavailable('be-fl-geology-no-data','Mapped geology','Databank Ondergrond Vlaanderen (DOV)',DOV_WMS,'DOV returned no Tertiary 1:50,000 geological unit at the selected coordinate.');
  const a=f.properties||{},unit=text(a.formatie),code=text(a.code),desc=text(a.beschrijving);
  if(!unit&&!desc)return unavailable('be-fl-geology-malformed','Mapped geology','Databank Ondergrond Vlaanderen (DOV)',DOV_WMS,'DOV returned a geological feature without a readable formation or description.','MALFORMED_DATA');
  return {id:'be-fl-geology',category:'Mapped geology',claim:`DOV 1:50,000 Tertiary geological mapping identifies ${unit||'a mapped formation'}${desc?`: ${desc}`:''}.`,status:'VERIFIED',
    sourceName:'Databank Ondergrond Vlaanderen (DOV) — Tertiair geologische kaart 1:50.000',sourceUrl:'https://www.dov.vlaanderen.be/',datasetDate:today(),
    spatialRelationship:'Official Flemish geological map feature at selected coordinate',calculationMethod:'DOV GeoServer WMS GetFeatureInfo on Tertiary geology 1:50,000',confidence:'High',
    limitation:'Mapped geology is screening context. It does not establish fill, weathering, local stratigraphy, groundwater level or geotechnical design parameters beneath the parcel.',value:{unit,code,description:desc,scale:'1:50,000'}};
}
async function flandersBoreholes(lat:number,lng:number,fetcher:FetchLike):Promise<BelgiumEvidence>{
  const radiusM=5000,p=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:FL_BOREHOLES,outputFormat:'application/json',srsName:'EPSG:4326',bbox:radiusBox(lat,lng,radiusM),count:'50'});
  const j=await fetchJson(fetcher,`${DOV_WFS}?${p}`,12000);
  if(!j)return unavailable('be-fl-boreholes-unavailable','Nearby boreholes','Databank Ondergrond Vlaanderen (DOV)',DOV_WFS,'Flemish DOV boreholes could not be queried.','SOURCE_UNAVAILABLE');
  const fs=Array.isArray(j.features)?j.features:[];
  const records=fs.map((f:any)=>{const a=f.properties||{},c=f.geometry?.coordinates,x=Array.isArray(c)?num(c[0]):null,y=Array.isArray(c)?num(c[1]):null;return{
    id:text(a.id),number:text(a.boornummer),depthM:num(a.diepte_tot_m),municipality:text(a.gemeente),purpose:text(a.doel),method:text(a.methode),reportUrl:text(a.rapport),recordUrl:text(a.fiche),
    distanceM:x!==null&&y!==null?Math.round(distM(lat,lng,y,x)):null
  }}).filter((r:any)=>r.distanceM!==null&&r.distanceM<=radiusM).sort((a:any,b:any)=>a.distanceM-b.distanceM);
  return {id:'be-fl-boreholes',category:'Nearby boreholes',claim:records.length?`DOV returned ${records.length} borehole record${records.length===1?'':'s'} within 5 km; nearest approximately ${records[0].distanceM} m away.`:'DOV responded but returned no borehole within the 5 km automated search radius.',status:'VERIFIED',
    sourceName:'Databank Ondergrond Vlaanderen (DOV) — Boringen',sourceUrl:'https://www.dov.vlaanderen.be/data/boring',datasetDate:today(),spatialRelationship:'Official borehole search within 5 km of selected coordinate',
    calculationMethod:'DOV WFS bounding-box query followed by geodesic distance filtering',confidence:'High',limitation:'Nearby boreholes are contextual observations only. Their logs and depths do not establish corresponding conditions beneath the selected parcel.',value:{searchRadiusM:radiusM,records:records.slice(0,20),nearestDistanceM:records[0]?.distanceM??null}};
}

function walloniaQueryUrl(lat:number,lng:number):string{
  const p=new URLSearchParams({f:'json',where:'1=1',geometry:`${lng},${lat}`,geometryType:'esriGeometryPoint',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'*',returnGeometry:'false',resultRecordCount:'5'});
  return `${WA_GEO}/query?${p}`;
}
async function walloniaGeology(lat:number,lng:number,fetcher:FetchLike):Promise<BelgiumEvidence>{
  const j=await fetchJson(fetcher,walloniaQueryUrl(lat,lng));
  if(!j)return unavailable('be-wa-geology-unavailable','Mapped geology','Service géologique de Wallonie',WA_GEO,'Walloon geological mapping could not be queried.','SOURCE_UNAVAILABLE');
  const f=Array.isArray(j.features)?j.features[0]:null;
  if(!f)return unavailable('be-wa-geology-no-data','Mapped geology','Service géologique de Wallonie',WA_GEO,'The detailed Walloon geological vector layer returned no formation at the selected coordinate; consult the current geological map directly.');
  const a=f.attributes||{},unit=text(a.NOM),code=text(a.SIGLE),desc=text(a.DESCRIPTION),system=text(a.FORM_SYSTEME),series=text(a.FORM_SERIE),stage=text(a.FORM_ETAGE),sheet=text(a.CARTE_NOM),edition=text(a.CARTE_EDITION),link=text(a.LIEN);
  if(!unit&&!desc)return unavailable('be-wa-geology-malformed','Mapped geology','Service géologique de Wallonie',WA_GEO,'The Walloon geological service returned a feature without a readable formation or description.','MALFORMED_DATA');
  return {id:'be-wa-geology',category:'Mapped geology',claim:`The Walloon geological map identifies ${unit||'a mapped formation'}${desc?`: ${desc}`:''}.`,status:'VERIFIED',sourceName:'Service géologique de Wallonie — Carte géologique de Wallonie',sourceUrl:link||WA_GEO,datasetDate:edition||today(),
    spatialRelationship:'Official Walloon lithostratigraphic polygon containing the selected coordinate',calculationMethod:'SPW ArcGIS REST point-in-polygon query of lithostratigraphic units',confidence:'High',
    limitation:'Regional geological mapping does not establish parcel-specific stratigraphy, weathering, fill, groundwater levels or engineering design parameters.',value:{unit,code,description:desc,system,series,stage,sheet,edition}};
}

function brusselsUnavailable():BelgiumEvidence[]{
  return [unavailable('be-bru-geology-manual','Mapped geology','Brussels GeoBru / BruGIS',BRUSSELS_PORTAL,'Brussels regional geological evidence is not yet queried automatically; verify the current GeoBru/BruGIS layers directly.'),
    unavailable('be-bru-boreholes-manual','Nearby boreholes','Brussels GeoBru / BruGIS',BRUSSELS_PORTAL,'Brussels borehole/subsurface records are not yet queried automatically; verify the current regional source directly.')];
}

export async function queryBelgiumNationalEvidence(lat:number,lng:number,context:{regionCode?:string;state?:string;county?:string}={},fetcher:FetchLike=fetch):Promise<BelgiumEvidence[]>{
  const region=resolveBelgiumRegion(context.regionCode,context.state,context.county);
  if(region==='FLANDERS'){const [g,b]=await Promise.all([flandersGeology(lat,lng,fetcher),flandersBoreholes(lat,lng,fetcher)]);return[g,b,{id:'be-region',category:'Belgian regional routing',claim:'The selected coordinate was routed to Flemish official geodata services.',status:'VERIFIED',sourceName:'Belgian regional jurisdiction routing',sourceUrl:'https://www.belgium.be/',datasetDate:today(),spatialRelationship:'Selected coordinate in Flanders (BE-VLG)',calculationMethod:'ISO 3166-2 regional code from site reverse-geocoding context',confidence:'High',limitation:'Belgian geodata responsibilities are regional; other national categories may require separate regional verification.',value:{region}}];}
  if(region==='WALLONIA'){const g=await walloniaGeology(lat,lng,fetcher);return[g,{id:'be-region',category:'Belgian regional routing',claim:'The selected coordinate was routed to Walloon official geodata services.',status:'VERIFIED',sourceName:'Belgian regional jurisdiction routing',sourceUrl:'https://www.wallonie.be/',datasetDate:today(),spatialRelationship:'Selected coordinate in Wallonia (BE-WAL)',calculationMethod:'ISO 3166-2 regional code from site reverse-geocoding context',confidence:'High',limitation:'Belgian geodata responsibilities are regional; borehole and other categories not automated here still require official verification.',value:{region}}];}
  if(region==='BRUSSELS') return [...brusselsUnavailable(),{id:'be-region',category:'Belgian regional routing',claim:'The selected coordinate was identified as Brussels-Capital Region.',status:'VERIFIED',sourceName:'Belgian regional jurisdiction routing',sourceUrl:BRUSSELS_PORTAL,datasetDate:today(),spatialRelationship:'Selected coordinate in Brussels-Capital Region (BE-BRU)',calculationMethod:'ISO 3166-2 regional code from site reverse-geocoding context',confidence:'High',limitation:'Brussels regional geology/subsurface automation is intentionally withheld until the relevant services pass endpoint validation.',value:{region}}];
  return [unavailable('be-region-unresolved','Belgian regional routing','Belgian regional authorities','https://www.belgium.be/','The Belgian region could not be resolved reliably from the selected coordinate; regional geology/subsurface integrations were not queried.','MALFORMED_DATA')];
}

export function enrichBelgiumNationalEvidence(report:VerifiedSiteReport&Record<string,any>,items:BelgiumEvidence[]):void{
  const geology=items.find(i=>(i.id==='be-fl-geology'||i.id==='be-wa-geology')&&i.status==='VERIFIED');
  if(geology){const v:any=geology.value||{},unit=v.unit||null,desc=v.description||null,period=[v.system,v.series,v.stage].filter(Boolean).join(' · ')||null;
    report.geosurvey_context={...(report.geosurvey_context||{}),geological_unit_name:unit,lithology_type:desc,geological_period_era:period,evidence_level:'VERIFIED',source_name:geology.sourceName,source_url:geology.sourceUrl,source_scale:v.scale||'regional official mapping'};
    report.soil={...report.soil,geologicalUnit:unit||report.soil.geologicalUnit,lithologyType:desc||report.soil.lithologyType,stratigraphicPeriod:period||report.soil.stratigraphicPeriod};
  }
  const region=items.find(i=>i.id==='be-region'&&i.status==='VERIFIED');
  if(region) report.belgium_region=(region.value as any)?.region||null;
}
