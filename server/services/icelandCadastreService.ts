import type { EvidenceItem } from '../types';

const WMS_URL = 'https://gatt.lmi.is/geoserver/ows';
const WMS_LAYER = 'ELF:Cadastral_Parcels';
const SOURCE_NAME = 'Icelandic cadastral data — ELF / National Land Survey metadata';
const SOURCE_URL = 'https://gatt.lmi.is/geonetwork/srv/search?keyword=Cadastral%20parcels';

export interface IcelandCadastreResult {
  success: boolean;
  sourceName: string;
  sourceUrl: string;
  viewServiceUrl: string;
  viewLayer: string;
  viewAttribution: string;
  parcel?: { parcelId: string; geometryPoints?: [number, number][]; officialAreaM2?: number };
  evidence: EvidenceItem[];
  limitation: string;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
}

function pointInRing(point:[number,number], ring:[number,number][]) {
  let inside=false; const [px,py]=point;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [xi,yi]=ring[i], [xj,yj]=ring[j];
    if(((yi>py)!==(yj>py)) && px < (xj-xi)*(py-yi)/((yj-yi)||Number.EPSILON)+xi) inside=!inside;
  }
  return inside;
}
function ringFromGeometry(g:any, lat:number,lng:number):[number,number][]|undefined {
  const polygons=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];
  for(const p of polygons) {
    const outer=p?.[0]; if(!Array.isArray(outer)||outer.length<3) continue;
    const ring=outer.map((x:any)=>[Number(x?.[0]),Number(x?.[1])] as [number,number]);
    if(ring.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)) && pointInRing([lng,lat],ring)) return ring.map(([x,y])=>[y,x]);
  }
}
function unavailable(reasonCode:IcelandCadastreResult['reasonCode'],claim:string):IcelandCadastreResult {
  const limitation='Icelandic cadastral screening evidence. Parcel geometry is not proof of ownership, encumbrances or legal boundary conclusiveness.';
  return {success:false,reasonCode,sourceName:SOURCE_NAME,sourceUrl:SOURCE_URL,viewServiceUrl:WMS_URL,viewLayer:WMS_LAYER,viewAttribution:'© Icelandic authorities — ELF cadastral parcels',evidence:[{id:'is-cadastre-unavailable',category:'Cadastre & Identification',claim,status:'REQUIRES_VERIFICATION',sourceName:SOURCE_NAME,sourceUrl:SOURCE_URL,datasetDate:new Date().toISOString().slice(0,10),spatialRelationship:'Selected site coordinate',calculationMethod:'Iceland cadastral spatial query',confidence:'Low',limitation,value:{reasonCode}}],limitation};
}
export async function queryIcelandCadastre(lat:number,lng:number,fetcher:typeof fetch=fetch):Promise<IcelandCadastreResult>{
  try {
    const q=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:WMS_LAYER,outputFormat:'application/json',srsName:'EPSG:4326',count:'10',cql_filter:`INTERSECTS(geom,POINT(${lng} ${lat}))`});
    const r=await fetcher(`${WMS_URL}?${q}`,{headers:{Accept:'application/geo+json,application/json'}});
    if(!r.ok) return unavailable('SOURCE_UNAVAILABLE','The Icelandic cadastral service could not be queried reliably.');
    const d=await r.json(); if(!Array.isArray(d?.features)) return unavailable('MALFORMED_DATA','The Icelandic cadastral response did not contain parcel features.');
    const f=d.features.find((x:any)=>ringFromGeometry(x.geometry,lat,lng)); if(!f) return unavailable('NO_DATA','No identifiable Icelandic cadastral parcel was returned at the selected coordinate.');
    const p=f.properties||{}; const id=String(p.landeignanumer??p.landeign_nr??p.skikanumer??p.SKIKI_ID??p.objectid??'').trim();
    if(!id) return unavailable('MALFORMED_DATA','The Icelandic cadastral feature did not contain an identifiable parcel reference.');
    const area=Number(p.area??p.aream2??p.area_m2); const geometryPoints=ringFromGeometry(f.geometry,lat,lng);
    const parcel={parcelId:id,officialAreaM2:Number.isFinite(area)?area:undefined,geometryPoints};
    const limitation='Icelandic cadastral screening evidence. Parcel geometry is not proof of ownership, encumbrances or legal boundary conclusiveness.';
    return {success:true,sourceName:SOURCE_NAME,sourceUrl:SOURCE_URL,viewServiceUrl:WMS_URL,viewLayer:WMS_LAYER,viewAttribution:'© Icelandic authorities — ELF cadastral parcels',parcel,evidence:[{id:'is-cadastre-parcel',category:'Cadastre & Identification',claim:`Icelandic cadastral parcel ${id} was identified at the selected location.`,status:'VERIFIED',sourceName:SOURCE_NAME,sourceUrl:SOURCE_URL,datasetDate:new Date().toISOString().slice(0,10),spatialRelationship:'Cadastral parcel polygon contains selected coordinate',calculationMethod:'Iceland ELF cadastral WFS point-intersection query',confidence:'High',limitation,value:parcel}],limitation};
  } catch { return unavailable('SOURCE_UNAVAILABLE','The Icelandic cadastral service returned an error or unreadable response.'); }
}
