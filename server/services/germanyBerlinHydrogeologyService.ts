import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyBerlinHydrogeologyResult {
  state: 'Berlin';
  evidence: EvidenceItem[];
  groundwaterContoursMapped: boolean;
  expectedHighestGroundwaterMapped: boolean;
  expectedMeanHighestGroundwaterMapped: boolean;
  groundwaterMonitoringMapped: boolean;
}

const GEO_WMS = 'https://gdi.berlin.de/services/wms/umweltatlas/02_19_Grundwasserstand_zeHGW?';
const ZEMHGW_WMS = 'https://gdi.berlin.de/services/wms/umweltatlas/02_20_Grundwasserstand_zeMHGW?';
const MONITORING_WFS = 'https://gdi.berlin.de/services/wfs/grundwassermessnetz?';
const SOURCE = 'Senatsverwaltung Berlin / Landesgeologie — Grundwasser';
const STATE = 'Berlin' as const;
const today = () => new Date().toISOString().slice(0, 10);

async function fetchText(url:string, fetcher:typeof fetch):Promise<string|null>{
  try{const r=await fetcher(url,{headers:{Accept:'application/xml, text/xml, text/plain, application/geo+json, application/json'}});return r.ok?await r.text():null;}catch{return null;}
}
function findLayer(caps:string,terms:string[]):string|null{
  const re=/<Layer[^>]*>[\s\S]*?<Name>([^<]+)<\/Name>[\s\S]*?(?:<Title>([^<]+)<\/Title>)?[\s\S]*?<\/Layer>/gi;
  for(const m of caps.matchAll(re)){const n=m[1].trim(),t=(m[2]||'').toLowerCase();if(terms.some(x=>n.toLowerCase().includes(x)||t.includes(x)))return n;}return null;
}
async function queryWms(base:string,terms:string[],lat:number,lng:number,fetcher:typeof fetch){
  const cap=base+'SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0';const caps=await fetchText(cap,fetcher);
  if(!caps)return{text:null,url:cap};const layer=findLayer(caps,terms);if(!layer)return{text:null,url:cap};
  const d=.02;const url=base+new URLSearchParams({SERVICE:'WMS',VERSION:'1.3.0',REQUEST:'GetFeatureInfo',LAYERS:layer,QUERY_LAYERS:layer,INFO_FORMAT:'text/plain',CRS:'EPSG:4326',BBOX:[(lat-d).toFixed(6),(lng-d).toFixed(6),(lat+d).toFixed(6),(lng+d).toFixed(6)].join(','),WIDTH:'101',HEIGHT:'101',I:'50',J:'50',FEATURE_COUNT:'5'}).toString();
  return{text:await fetchText(url,fetcher),url};
}
function addEvidence(e:EvidenceItem[],id:string,q:{text:string|null;url:string},claim:string,limitation:string,confidence:'High'|'Medium'|'Low'='High'){
  if(!q.text||/serviceexception|exceptionreport|error/i.test(q.text))return;
  e.push({id,category:'Hydrogeology',claim:claim+' Official Berlin response: '+q.text.replace(/\s+/g,' ').trim().slice(0,1800),status:'VERIFIED',sourceName:SOURCE,sourceUrl:q.url,datasetDate:today(),spatialRelationship:'Official Berlin Landesgeologie map response at the selected coordinate',calculationMethod:'Berlin WMS GetCapabilities layer discovery followed by point GetFeatureInfo query',confidence,limitation,value:{attributeResponse:q.text}});
}
async function queryMonitoring(lat:number,lng:number,fetcher:typeof fetch){
  const url=MONITORING_WFS+new URLSearchParams({SERVICE:'WFS',VERSION:'2.0.0',REQUEST:'GetFeature',OUTPUTFORMAT:'application/json',SRSNAME:'EPSG:4326',BBOX:[lng-.08,lat-.08,lng+.08,lat+.08,'EPSG:4326'].join(','),COUNT:'20'}).toString();
  const text=await fetchText(url,fetcher);return{text,url};
}
export async function queryGermanyBerlinHydrogeology(lat:number,lng:number,state:string|null|undefined,fetcher:typeof fetch=fetch):Promise<GermanyBerlinHydrogeologyResult>{
  const normalized=String(state||'').trim().toLowerCase();if(normalized&&!['berlin','land berlin'].includes(normalized))return{state:STATE,evidence:[],groundwaterContoursMapped:false,expectedHighestGroundwaterMapped:false,expectedMeanHighestGroundwaterMapped:false,groundwaterMonitoringMapped:false};
  const evidence:EvidenceItem[]=[];
  const zehg=await queryWms(GEO_WMS,['zehgw','höchster grundwasserstand','grundwasserstand'],lat,lng,fetcher);
  addEvidence(evidence,'de-be-expected-highest-groundwater',zehg,'Berlin provides a mapped expected highest groundwater level (zeHGW), a planning value derived from long-term groundwater observations and intended for construction design, including waterproofing against pressurised water and foundation design.','The zeHGW is a planning value rather than a current measurement. Coverage is not universal across every geological setting in Berlin; where no map information exists, the absence must not be treated as low groundwater risk.','High');
  const zemh=await queryWms(ZEMHGW_WMS,['zemhgw','mittlerer höchster grundwasserstand','grundwasserstand'],lat,lng,fetcher);
  addEvidence(evidence,'de-be-expected-mean-highest-groundwater',zemh,'Berlin also maps the expected mean highest groundwater level (zeMHGW), including a groundwater-depth/Flurabstand representation that expresses the expected mean highest groundwater level below ground surface.','This is a regional planning map and not a current property-level groundwater measurement. It is intended as a planning aid and must be supplemented by project-specific investigation.','High');
  const contours=await queryWms(GEO_WMS,['grundwassergleichen','grundwasserhöhen','grundwasserstand'],lat,lng,fetcher);
  addEvidence(evidence,'de-be-groundwater-contours',contours,'Berlin publishes groundwater-elevation contour maps for the main groundwater body; contour gradients indicate regional groundwater flow direction.','Contours are regional interpolations and should not be interpreted as a current groundwater level directly beneath the property.','High');
  const monitoring=await queryMonitoring(lat,lng,fetcher);
  if(monitoring.text&&!/exception|error/i.test(monitoring.text)){
    evidence.push({id:'de-be-groundwater-monitoring',category:'Hydrogeology',claim:'Berlin operates a statewide groundwater monitoring network of about 3,400 monitoring points, with around 1,000 stations recording groundwater levels daily. These measurements provide the data basis for current and expected-high groundwater assessments.','status':'VERIFIED',sourceName:SOURCE,sourceUrl:MONITORING_WFS,datasetDate:today(),spatialRelationship:'Official Berlin groundwater monitoring service for the selected area',calculationMethod:'Berlin official WFS monitoring-network query',confidence:'High',limitation:'The monitoring network establishes regional evidence; a monitoring point is not a property-level measurement and aquifer, elevation and date must be considered.',value:{serviceResponse:monitoring.text.slice(0,1800)}});
  }
  if(!evidence.length)evidence.push({id:'de-be-hydrogeology-no-data',category:'Hydrogeology',claim:'The official Berlin groundwater services did not return a usable map response for the selected coordinate.',status:'REQUIRES_VERIFICATION',sourceName:SOURCE,sourceUrl:GEO_WMS,datasetDate:today(),spatialRelationship:'Selected site coordinate in Berlin',calculationMethod:'Official Berlin groundwater map query; missing responses are not interpreted as negative findings',confidence:'Low',limitation:'No current groundwater condition is inferred from missing regional-map information.',value:{reasonCode:'INSUFFICIENT_EVIDENCE'}});
  return{state:STATE,evidence,groundwaterContoursMapped:evidence.some(i=>i.id==='de-be-groundwater-contours'&&i.status==='VERIFIED'),expectedHighestGroundwaterMapped:evidence.some(i=>i.id==='de-be-expected-highest-groundwater'&&i.status==='VERIFIED'),expectedMeanHighestGroundwaterMapped:evidence.some(i=>i.id==='de-be-expected-mean-highest-groundwater'&&i.status==='VERIFIED'),groundwaterMonitoringMapped:evidence.some(i=>i.id==='de-be-groundwater-monitoring'&&i.status==='VERIFIED')};
}
export function enrichGermanyBerlinHydrogeology(report:VerifiedSiteReport&Record<string,any>,result:GermanyBerlinHydrogeologyResult):void{
  if(!Array.isArray(report.evidenceRegistry))report.evidenceRegistry=[];report.evidenceRegistry.push(...result.evidence);
  const high=result.evidence.find(i=>i.id==='de-be-expected-highest-groundwater'&&i.status==='VERIFIED'),mean=result.evidence.find(i=>i.id==='de-be-expected-mean-highest-groundwater'&&i.status==='VERIFIED'),contours=result.evidence.find(i=>i.id==='de-be-groundwater-contours'&&i.status==='VERIFIED'),monitor=result.evidence.find(i=>i.id==='de-be-groundwater-monitoring'&&i.status==='VERIFIED');
  report.geosurvey_context={...(report.geosurvey_context||{}),be_expected_highest_groundwater_mapped:Boolean(high),be_expected_mean_highest_groundwater_mapped:Boolean(mean),be_groundwater_contours_mapped:Boolean(contours),be_groundwater_monitoring_mapped:Boolean(monitor),be_hydrogeology_evidence_level:high||mean||contours||monitor?'VERIFIED':'REQUIRES_VERIFICATION',be_hydrogeology_source:SOURCE};
  if(report.soil&&(high||mean||contours))report.soil.groundwaterNotice=[high?.claim,mean?.claim,contours?.claim,'For construction screening, the expected highest groundwater level is particularly relevant because Berlin uses it as a planning basis for waterproofing and foundation design. A site outside a mapped flood area can still encounter groundwater during excavation.','Project-specific groundwater and soil investigation remain necessary before final excavation or dewatering design.'].filter(Boolean).join(' ');
}
export const GERMANY_BERLIN_HYDROGEOLOGY_SOURCES={expectedHighestGroundwater:GEO_WMS,expectedMeanHighestGroundwater:ZEMHGW_WMS,groundwaterMonitoring:MONITORING_WFS,informationPortal:'https://wasserportal.berlin.de/auskunftsportal/',officialInformation:'https://www.berlin.de/sen/uvk/umwelt/wasser-und-geologie/grundwasser/informationen-zum-grundwasser/'};
