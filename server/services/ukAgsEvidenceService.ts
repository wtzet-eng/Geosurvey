import { EvidenceItem } from '../types';

export interface UkAgsBorehole { id: string; projectName: string | null; projectContact: string | null; engineer: string | null; latitude: number; longitude: number; finalDepthM: number | null; logUrl: string | null; dataUrl: string | null; distanceM: number; }
export interface UkAgsEvidence { success: boolean; count: number; boreholes: UkAgsBorehole[]; nearestDistanceM: number | null; sourceUrl: string; limitation: string; evidence: EvidenceItem | null; }

const AGS_API_URL = 'https://ogcapi.bgs.ac.uk/v2/collections/agsboreholeindex/items';
type FetchLike = typeof fetch;
const clean = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const num = (value: unknown): number | null => { const n = typeof value === 'number' ? value : Number(value); return Number.isFinite(n) ? n : null; };
const haversineM = (lat1:number, lon1:number, lat2:number, lon2:number) => { const r=6371000, p=Math.PI/180; const a=Math.sin((lat2-lat1)*p/2)**2 + Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2; return 2*r*Math.asin(Math.sqrt(a)); };
const unavailable = (reason='The BGS AGS spatial service did not return queryable nearby records. This is not evidence that no site investigations exist.') : UkAgsEvidence => ({ success:false,count:0,boreholes:[],nearestDistanceM:null,sourceUrl:AGS_API_URL,limitation:reason,evidence:null });

export async function queryUkAgsBoreholes(lat:number,lng:number,radiusM=2000,fetcher:FetchLike=fetch):Promise<UkAgsEvidence> {
  const latDelta=radiusM/111320; const lngDelta=radiusM/Math.max(111320*Math.cos(lat*Math.PI/180),1);
  const params=new URLSearchParams({f:'json',bbox:[lng-lngDelta,lat-latDelta,lng+lngDelta,lat+latDelta].join(','),limit:'50'});
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),5000);
  try {
    const response=await fetcher(AGS_API_URL+'?'+params,{headers:{Accept:'application/geo+json, application/json','User-Agent':'GroundSurf/1.0 (BGS AGS evidence query)'},signal:controller.signal});
    if(!response.ok) return unavailable('The BGS AGS spatial service returned HTTP '+response.status+'. No AGS evidence was inferred.');
    const payload:any=await response.json(); const features=Array.isArray(payload?.features)?payload.features:[];
    const boreholes=features.map((feature:any)=>{ const p=feature?.properties||{}, c=feature?.geometry?.coordinates, longitude=num(c?.[0]), latitude=num(c?.[1]); if(latitude===null||longitude===null)return null; return {id:clean(p.bgs_loca_id||p.loca_id||p.id)||'BGS AGS borehole',projectName:clean(p.proj_name),projectContact:clean(p.proj_cont),engineer:clean(p.proj_eng),latitude,longitude,finalDepthM:num(p.loca_fdep),logUrl:clean(p.ags_log_url),dataUrl:clean(p.dad_item_url),distanceM:haversineM(lat,lng,latitude,longitude)} as UkAgsBorehole; }).filter((x:UkAgsBorehole|null):x is UkAgsBorehole=>Boolean(x)).sort((a,b)=>a.distanceM-b.distanceM);
    if(!boreholes.length)return unavailable('No open BGS AGS boreholes were returned within the queried area. This is not evidence that no investigations exist.');
    const nearest=boreholes[0];
    const evidence:EvidenceItem={id:'gb-bgs-ags-boreholes',category:'Ground investigations',claim:'BGS returned '+boreholes.length+' open AGS site-investigation borehole'+(boreholes.length===1?'':'s')+' within approximately '+radiusM.toLocaleString()+' m of the selected location; the nearest is about '+Math.round(nearest.distanceM).toLocaleString()+' m away.',status:'VERIFIED',sourceName:'British Geological Survey — AGS borehole index',sourceUrl:AGS_API_URL,datasetDate:new Date().toISOString().slice(0,10),spatialRelationship:'Nearest open AGS borehole: '+Math.round(nearest.distanceM)+' m from the selected coordinate',calculationMethod:'BGS OGC API Features spatial bounding-box query followed by WGS84 great-circle distance calculation',confidence:'High',limitation:'AGS records are nearby site-investigation evidence, not proof of ground conditions beneath the selected parcel. BGS states that the data are delivered as received and does not add interpretative values or observations.',value:{count:boreholes.length,radiusM,nearestDistanceM:Math.round(nearest.distanceM),nearestRecordId:nearest.id}};
    return {success:true,count:boreholes.length,boreholes,nearestDistanceM:nearest.distanceM,sourceUrl:AGS_API_URL,limitation:evidence.limitation,evidence};
  } catch { return unavailable('The BGS AGS spatial query failed or timed out. No AGS evidence was inferred.'); } finally { clearTimeout(timeout); }
}
export const BGS_AGS_API_URL=AGS_API_URL;