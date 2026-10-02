import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanySaxonyAnhaltHydrogeologyResult {
  state: 'Sachsen-Anhalt';
  evidence: EvidenceItem[];
  hydrogeologyMapped: boolean;
}

const HUEK_WMS = 'https://services.bgr.de/arcgis/rest/services/grundwasser/huek250/MapServer';
const KIWIS_BASE = 'https://gld.lhw-sachsen-anhalt.de/KiWIS/KiWIS?';
const LAGB_SOURCE = 'LAGB Sachsen-Anhalt — Hydrogeologisches Kartenwerk HK50';
const LHW_SOURCE = 'LHW Sachsen-Anhalt — Grundwasserkataster / Monitoring';
const STATE = 'Sachsen-Anhalt' as const;
const today = () => new Date().toISOString().slice(0,10);

async function fetchText(url:string, fetcher:typeof fetch):Promise<string|null>{
  try { const r=await fetcher(url,{headers:{Accept:'application/json, text/plain'}}); return r.ok?await r.text():null; }
  catch { return null; }
}
function haversine(a:number,b:number,c:number,d:number){
  const r=6371000, p=Math.PI/180, x=(c-a)*p, y=(d-b)*p;
  const h=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;
  return 2*r*Math.asin(Math.sqrt(h));
}
function rows(raw:string):any[]{
  try {
    const j=JSON.parse(raw);
    if(Array.isArray(j)) {
      if(j.length && Array.isArray(j[0])) {
        const headers=j[0].map(String);
        return j.slice(1).map((row:any[])=>Object.fromEntries(headers.map((h,i)=>[h,row[i]])));
      }
      if(j.length && typeof j[0]==='object') return j;
    }
    if(j && Array.isArray(j.data)) return j.data;
  } catch {}
  return [];
}
async function queryKiwis(lat:number,lng:number,fetcher:typeof fetch){
  const q=new URLSearchParams({
    service:'kisters',type:'queryServices',request:'getStationList',datasource:'0',
    format:'json',returnfields:'station_no,station_name,station_latitude,station_longitude,stationparameter_name,stationparameter_no'
  });
  const raw=await fetchText(KIWIS_BASE+q.toString(),fetcher);
  if(!raw) return null;
  const stations=rows(raw).map(x=>({
    id:String(x.station_no??x.station_id??''),
    name:String(x.station_name??''),
    lat:Number(x.station_latitude),lng:Number(x.station_longitude),
    parameter:String(x.stationparameter_name??'')
  })).filter(x=>x.id&&Number.isFinite(x.lat)&&Number.isFinite(x.lng)&&Math.abs(x.lat)<=90&&Math.abs(x.lng)<=180)
    .filter(x=>/grundwasser|wasserstand|groundwater/i.test(x.parameter+' '+x.name));
  if(!stations.length) return null;
  const nearest=stations.map(x=>({...x,distanceM:haversine(lat,lng,x.lat,x.lng)})).sort((a,b)=>a.distanceM-b.distanceM)[0];
  const tq=new URLSearchParams({
    service:'kisters',type:'queryServices',request:'getTimeseriesList',datasource:'0',
    format:'json',station_no:nearest.id,returnfields:'station_no,station_name,stationparameter_name,ts_name,ts_id,coverage,ts_unitname,ts_unitsymbol'
  });
  const traw=await fetchText(KIWIS_BASE+tq.toString(),fetcher);
  if(!traw) return {nearest,series:null};
  const series=rows(traw).filter(x=>x.ts_id).sort((a,b)=>String(a.stationparameter_name??'').localeCompare(String(b.stationparameter_name??'')));
  const chosen=series.find(x=>/grundwasser|wasserstand|groundwater|water level/i.test(String(x.stationparameter_name??'')+' '+String(x.ts_name??'')))||series[0];
  if(!chosen) return {nearest,series:null};
  const vq=new URLSearchParams({
    service:'kisters',type:'queryServices',request:'getTimeseriesValues',datasource:'0',
    format:'json',ts_id:String(chosen.ts_id),period:'P30D',metadata:'true',
    returnfields:'Timestamp,Value,Quality Code',dateformat:'yyyy-MM-dd HH:mm:ss'
  });
  const vraw=await fetchText(KIWIS_BASE+vq.toString(),fetcher);
  const values= vraw ? rows(vraw) : [];
  const numeric=values.map(x=>({timestamp:String(x.Timestamp??x.timestamp??''),value:Number(x.Value??x.value)})).filter(x=>Number.isFinite(x.value));
  const latest=numeric.sort((a,b)=>a.timestamp.localeCompare(b.timestamp)).at(-1)??null;
  return {nearest,series:chosen,latest};
}
async function queryBgr(lat:number,lng:number,fetcher:typeof fetch){
  const url=HUEK_WMS+'/identify?f=json&geometry='+encodeURIComponent(JSON.stringify({x:lng,y:lat,spatialReference:{wkid:4326}}))+'&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=2&mapExtent='+encodeURIComponent([lng-.05,lat-.05,lng+.05,lat+.05].join(','))+'&imageDisplay=101,101,96&returnGeometry=false';
  return {url,text:await fetchText(url,fetcher)};
}

export async function queryGermanySaxonyAnhaltHydrogeology(
  lat:number,lng:number,state:string|null|undefined,fetcher:typeof fetch=fetch
):Promise<GermanySaxonyAnhaltHydrogeologyResult>{
  const normalized=String(state||'').trim().toLowerCase();
  if(normalized && !normalized.includes('sachsen-anhalt') && !normalized.includes('saxony-anhalt'))
    return {state:STATE,evidence:[],hydrogeologyMapped:false};

  const evidence:EvidenceItem[]=[];
  const bgr=await queryBgr(lat,lng,fetcher);

  if(bgr.text && !/error|invalid/i.test(bgr.text)){
    evidence.push({
      id:'de-sa-huek250-hydrogeology',
      category:'Hydrogeology',
      claim:'The BGR HÜK250 provides regional hydrogeological information at the selected location in Sachsen-Anhalt. Sachsen-Anhalt also maintains the more detailed LAGB HK50 hydrogeological map series for groundwater-bearing units, hydrogeological parameters and hydroisohypses.',
      status:'VERIFIED',
      sourceName:LAGB_SOURCE,
      sourceUrl:'https://lagb.sachsen-anhalt.de/geologie/hydrogeologie/daten-und-karten/kartenwerk-150000/hk50-digital',
      datasetDate:today(),
      spatialRelationship:'Site coordinate checked against the national HÜK250 service; state-specific interpretation references the official LAGB HK50.',
      calculationMethod:'BGR HÜK250 point identification with Sachsen-Anhalt-specific LAGB HK50 context.',
      confidence:'Medium',
      limitation:'The publicly documented LAGB HK50 provides detailed hydrogeological units, parameters and hydroisohypses, but the current public LAGB documentation does not expose a stable machine-readable point-query endpoint that can be safely used here. Therefore this adapter does not invent an exact groundwater depth. Site groundwater conditions still require current observations.',
      value:{bgrResponse:bgr.text.slice(0,1800),stateDataset:'LAGB HK50'}
    });
  }

  const kiwis=await queryKiwis(lat,lng,fetcher);
  if(kiwis?.nearest){
    const latest=kiwis.latest;
    evidence.push({
      id:'de-sa-lhw-groundwater-nearest-monitor',
      category:'Hydrogeology',
      claim:latest
        ? `The LHW groundwater monitoring network has a nearby observation point "${kiwis.nearest.name}" about ${Math.round(kiwis.nearest.distanceM)} m from the site. Its latest returned groundwater value in the queried series is ${latest.value} ${String(kiwis.series?.ts_unitsymbol??kiwis.series?.ts_unitname??'units')} (${latest.timestamp}).`
        : `The LHW groundwater monitoring network has a nearby observation point "${kiwis.nearest.name}" about ${Math.round(kiwis.nearest.distanceM)} m from the site, but no recent numeric value was returned by the public time-series query.`,
      status:'VERIFIED',sourceName:LHW_SOURCE,sourceUrl:'https://gld.lhw-sachsen-anhalt.de/',
      datasetDate:latest?.timestamp?.slice(0,10)||today(),
      spatialRelationship:`Nearest LHW groundwater monitoring station at approximately ${Math.round(kiwis.nearest.distanceM)} m from the selected coordinate`,
      calculationMethod:'Public KISTERS KiWIS station-list and time-series query; nearest station selected by haversine distance.',
      confidence:latest?'Medium':'Low',
      limitation:'A nearby monitoring-station value is not the groundwater level beneath the property. Differences in elevation, screened depth, hydrogeological unit and local conditions can be substantial; the value is a screening observation rather than a site measurement.',
      value:{stationId:kiwis.nearest.id,stationName:kiwis.nearest.name,distanceM:Math.round(kiwis.nearest.distanceM),latitude:kiwis.nearest.lat,longitude:kiwis.nearest.lng,latestValue:latest?.value??null,latestTimestamp:latest?.timestamp??null,series:kiwis.series?.ts_name??null,unit:kiwis.series?.ts_unitsymbol??kiwis.series?.ts_unitname??null}
    });
  }
  evidence.push({
    id:'de-sa-lhw-groundwater-monitoring',
    category:'Hydrogeology',
    claim:'The LHW groundwater monitoring/data portal provides groundwater observations and access to the Grundwasserkataster; the official portal states that investigation results from 2007 onward are available and that groundwater-height data and other groundwater information can be queried.',
    status:'VERIFIED',sourceName:LHW_SOURCE,sourceUrl:'https://gld.lhw-sachsen-anhalt.de/',
    datasetDate:today(),spatialRelationship:'Statewide groundwater monitoring resource relevant to the selected Sachsen-Anhalt site',
    calculationMethod:'Official LHW monitoring portal and public KISTERS service availability.',
    confidence:'Medium',
    limitation:'Monitoring data are point observations. They do not directly establish groundwater depth at the property without accounting for ground elevation, station elevation, screened interval and spatial hydrogeological differences.',
    value:{resource:'Grundwasserkataster / Monitoring-Daten',nearestStationQueried:Boolean(kiwis?.nearest)}
  });
  if(!evidence.length) evidence.push({
    id:'de-sa-hydrogeology-no-data',category:'Hydrogeology',
    claim:'No usable hydrogeological response was obtained for the selected Sachsen-Anhalt coordinate.',
    status:'REQUIRES_VERIFICATION',sourceName:LAGB_SOURCE,
    sourceUrl:'https://lagb.sachsen-anhalt.de/geologie/hydrogeologie',
    datasetDate:today(),spatialRelationship:'Selected site coordinate in Sachsen-Anhalt',
    calculationMethod:'Official state/national hydrogeological service check; missing responses are not interpreted as negative findings',
    confidence:'Low',limitation:'No current groundwater condition is inferred from missing data.',
    value:{reasonCode:'INSUFFICIENT_EVIDENCE'}
  });

  return {state:STATE,evidence,hydrogeologyMapped:evidence.some(x=>x.status==='VERIFIED')};
}

export function enrichGermanySaxonyAnhaltHydrogeology(
  report:VerifiedSiteReport&Record<string,any>,result:GermanySaxonyAnhaltHydrogeologyResult
):void{
  if(!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry=[];
  report.evidenceRegistry.push(...result.evidence);
  const verified=result.evidence.some(x=>x.status==='VERIFIED');
  report.geosurvey_context={
    ...(report.geosurvey_context||{}),
    sa_hydrogeology_mapped:result.hydrogeologyMapped,
    sa_hydrogeology_evidence_level:verified?'VERIFIED':'REQUIRES_VERIFICATION',
    sa_hydrogeology_source:LAGB_SOURCE,
    sa_groundwater_monitoring_source:LHW_SOURCE
  };
  if(report.soil&&verified) report.soil.groundwaterNotice=[
    'Sachsen-Anhalt has detailed official hydrogeological mapping through the LAGB HK50 and statewide groundwater monitoring through the LHW.',
    'These regional resources help identify the hydrogeological setting, but they do not by themselves establish the current groundwater level beneath a construction site. Excavation depth, seasonal variation and local groundwater observations should be checked before dewatering assumptions are made.'
  ].join(' ');
}

export const GERMANY_SAXONY_ANHALT_HYDROGEOLOGY_SOURCES={
  lagb:'https://lagb.sachsen-anhalt.de/geologie/hydrogeologie',
  hk50:'https://lagb.sachsen-anhalt.de/geologie/hydrogeologie/daten-und-karten/kartenwerk-150000/hk50-digital',
  lhw:'https://lhw.sachsen-anhalt.de/gewaesserkundlicher-landesdienst/monitoring-daten',
  bgr:HUEK_WMS
};
