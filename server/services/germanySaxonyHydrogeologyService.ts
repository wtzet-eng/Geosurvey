import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanySaxonyHydrogeologyResult {
  state: 'Sachsen';
  evidence: EvidenceItem[];
  hydrogeologyMapped: boolean;
  groundwaterDynamicsMapped: boolean;
}

const HUEK_WMS = 'https://geoportal.umwelt.sachsen.de/arcgis/services/geologie/huek/MapServer/WMSServer?';
const GW_WMS = 'https://luis.sachsen.de/arcgis/services/wasser/grundwasserdynamik_2022/MapServer/WMSServer?';
const SOURCE_HUEK = 'LfULG Sachsen — Hydrogeologische Übersichtskarte (HÜK)';
const SOURCE_GW = 'LfULG Sachsen — Grundwasserdynamik 2022';
const STATE = 'Sachsen' as const;
const today = () => new Date().toISOString().slice(0, 10);

async function fetchText(url: string, fetcher: typeof fetch): Promise<string | null> {
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/xml, text/xml, text/plain' } });
    return response.ok ? await response.text() : null;
  } catch { return null; }
}

function findLayer(capabilities: string, terms: string[]): string | null {
  const re = /<Layer[^>]*>[\s\S]*?<Name>([^<]+)<\/Name>[\s\S]*?<Title>([^<]+)<\/Title>[\s\S]*?<\/Layer>/gi;
  for (const m of capabilities.matchAll(re)) {
    const name = m[1].trim();
    const title = m[2].trim().toLowerCase();
    if (terms.some(t => title.includes(t) || name.toLowerCase().includes(t))) return name;
  }
  return null;
}

function infoUrl(base: string, layer: string, lat: number, lng: number): string {
  const d = 0.015;
  const p = new URLSearchParams({
    SERVICE:'WMS', VERSION:'1.3.0', REQUEST:'GetFeatureInfo',
    LAYERS:layer, QUERY_LAYERS:layer, INFO_FORMAT:'text/plain',
    CRS:'EPSG:4326',
    BBOX:[(lat-d).toFixed(6),(lng-d).toFixed(6),(lat+d).toFixed(6),(lng+d).toFixed(6)].join(','),
    WIDTH:'101', HEIGHT:'101', I:'50', J:'50', FEATURE_COUNT:'5'
  });
  return base + p.toString();
}

async function query(base:string, terms:string[], lat:number, lng:number, fetcher:typeof fetch) {
  const capUrl=base+'REQUEST=GetCapabilities&SERVICE=WMS&VERSION=1.3.0';
  const cap=await fetchText(capUrl,fetcher);
  if(!cap) return {text:null as string|null,url:capUrl};
  const layer=findLayer(cap,terms);
  if(!layer) return {text:null as string|null,url:capUrl};
  const url=infoUrl(base,layer,lat,lng);
  return {text:await fetchText(url,fetcher),url};
}

function ev(id:string,response:string,url:string,source:string,claim:string,limitation:string):EvidenceItem {
  return {
    id, category:'Hydrogeology',
    claim:claim+' Official LfULG response: '+response.replace(/\s+/g,' ').trim().slice(0,1800),
    status:'VERIFIED', sourceName:source, sourceUrl:url, datasetDate:today(),
    spatialRelationship:'Official LfULG WMS GetFeatureInfo response at the selected coordinate',
    calculationMethod:'LfULG WMS GetCapabilities layer discovery followed by point GetFeatureInfo query',
    confidence:'Medium', limitation, value:{attributeResponse:response}
  };
}

export async function queryGermanySaxonyHydrogeology(
  lat:number,lng:number,state:string|null|undefined,fetcher:typeof fetch=fetch
):Promise<GermanySaxonyHydrogeologyResult>{
  const normalized=String(state||'').trim().toLowerCase();
  if(normalized && !normalized.includes('sachsen') && !normalized.includes('saxony'))
    return {state:STATE,evidence:[],hydrogeologyMapped:false,groundwaterDynamicsMapped:false};

  const evidence:EvidenceItem[]=[];
  const hydro=await query(HUEK_WMS,['hydrogeologische übersichtskarte','huek','hydrogeologie'],lat,lng,fetcher);
  if(hydro.text) evidence.push(ev(
    'de-sn-huek-hydrogeology',hydro.text,hydro.url,SOURCE_HUEK,
    'The official Saxon HÜK provides regional hydrogeological information on the subsurface and groundwater-bearing conditions at the selected location.',
    'The HÜK is regional hydrogeological mapping. It does not establish a current groundwater level, seasonal high-water level or excavation inflow rate.'
  ));

  const gw=await query(GW_WMS,['grundwasserflurabstand','hydroisohypsen','grundwasserdynamik'],lat,lng,fetcher);
  if(gw.text) evidence.push(ev(
    'de-sn-groundwater-dynamics-2022',gw.text,SOURCE_GW?gw.url:gw.url,SOURCE_GW,
    'The LfULG Grundwasserdynamik 2022 mapping provides regional groundwater-surface / groundwater-depth evidence derived from the statewide spring 2022 groundwater campaign. This is directly relevant to screening for groundwater that may be encountered during excavation.',
    'The 2022 groundwater-dynamics dataset represents the upper main groundwater body in unconsolidated and loess areas and the Vorerzgebirgssenke. It is a dated regional snapshot, not a current site measurement; seasonal variation, perched water and local construction conditions require site-specific investigation.'
  ));

  if(!evidence.length) evidence.push({
    id:'de-sn-hydrogeology-no-data',category:'Hydrogeology',
    claim:'The official LfULG hydrogeological services did not return a usable attribute response for the selected coordinate.',
    status:'REQUIRES_VERIFICATION',sourceName:SOURCE_HUEK,sourceUrl:HUEK_WMS,datasetDate:today(),
    spatialRelationship:'Selected site coordinate in Sachsen',
    calculationMethod:'Official LfULG WMS query; missing responses are not interpreted as negative findings',
    confidence:'Low',limitation:'No current groundwater condition is inferred from a missing regional-map response. Local investigation remains necessary where excavation may interact with groundwater.',
    value:{reasonCode:'INSUFFICIENT_EVIDENCE'}
  });

  return {state:STATE,evidence,hydrogeologyMapped:evidence.some(x=>x.id==='de-sn-huek-hydrogeology'),groundwaterDynamicsMapped:evidence.some(x=>x.id==='de-sn-groundwater-dynamics-2022')};
}

export function enrichGermanySaxonyHydrogeology(report:VerifiedSiteReport&Record<string,any>,result:GermanySaxonyHydrogeologyResult):void{
  if(!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry=[];
  report.evidenceRegistry.push(...result.evidence);
  const hydro=result.evidence.find(x=>x.id==='de-sn-huek-hydrogeology'&&x.status==='VERIFIED');
  const gw=result.evidence.find(x=>x.id==='de-sn-groundwater-dynamics-2022'&&x.status==='VERIFIED');
  report.geosurvey_context={
    ...(report.geosurvey_context||{}),
    sn_huek_hydrogeology_mapped:Boolean(hydro),
    sn_groundwater_dynamics_mapped:Boolean(gw),
    sn_hydrogeology_evidence_level:hydro||gw?'VERIFIED':'REQUIRES_VERIFICATION',
    sn_hydrogeology_source:SOURCE_HUEK
  };
  if(report.soil&&(hydro||gw)) report.soil.groundwaterNotice=[
    gw?.claim,hydro?.claim,
    'For construction screening, regional groundwater mapping should be interpreted together with the planned excavation depth and local observations. A property outside a flood zone can still encounter groundwater during excavation.'
  ].filter(Boolean).join(' ');
}

export const GERMANY_SAXONY_HYDROGEOLOGY_SOURCES={
  hydrogeologyWms:HUEK_WMS,
  groundwaterDynamicsWms:GW_WMS,
  dataset:'LfULG Sachsen — Hydrogeologische Übersichtskarte (HÜK) / Grundwasserdynamik 2022'
};
