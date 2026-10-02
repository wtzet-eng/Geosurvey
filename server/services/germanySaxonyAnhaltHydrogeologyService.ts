import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanySaxonyAnhaltHydrogeologyResult {
  state: 'Sachsen-Anhalt';
  evidence: EvidenceItem[];
  hydrogeologyMapped: boolean;
}

const HUEK_WMS = 'https://services.bgr.de/arcgis/rest/services/grundwasser/huek250/MapServer';
const LAGB_SOURCE = 'LAGB Sachsen-Anhalt — Hydrogeologisches Kartenwerk HK50';
const LHW_SOURCE = 'LHW Sachsen-Anhalt — Grundwasserkataster / Monitoring';
const STATE = 'Sachsen-Anhalt' as const;
const today = () => new Date().toISOString().slice(0,10);

async function fetchText(url:string, fetcher:typeof fetch):Promise<string|null>{
  try { const r=await fetcher(url,{headers:{Accept:'application/json, text/plain'}}); return r.ok?await r.text():null; }
  catch { return null; }
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

  evidence.push({
    id:'de-sa-lhw-groundwater-monitoring',
    category:'Hydrogeology',
    claim:'Sachsen-Anhalt has a state Gewässerkundlicher Landesdienst groundwater monitoring/data system. The LHW states that its data portal provides groundwater monitoring results from 2007 onward and includes the Grundwasserkataster and groundwater recharge information.',
    status:'VERIFIED',
    sourceName:LHW_SOURCE,
    sourceUrl:'https://lhw.sachsen-anhalt.de/gewaesserkundlicher-landesdienst/monitoring-daten',
    datasetDate:today(),
    spatialRelationship:'Statewide groundwater monitoring resource relevant to the selected Sachsen-Anhalt site.',
    calculationMethod:'Official LHW monitoring-data catalogue reviewed for statewide groundwater data availability.',
    confidence:'Medium',
    limitation:'This evidence establishes the official monitoring resource, not a current measured groundwater level at the property. A future adapter can query the monitoring/raster service directly once its stable machine endpoint is established.',
    value:{resource:'Grundwasserkataster / Monitoring-Daten'}
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
