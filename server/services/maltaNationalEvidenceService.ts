import type { EvidenceItem, VerifiedSiteReport } from '../types';
import { pointInGeometry, propertyValue, queryMaltaWfs } from './maltaWfsClient';

type FetchLike = typeof fetch;
type ReasonCode = 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
type MaltaEvidence = EvidenceItem & { reasonCode?: ReasonCode };

const PORTAL = 'https://portal.data.gov.mt/';
const GEOLOGY_PORTAL = 'https://continentalshelf.gov.mt/geological-survey/geological-map/';
const WFS = {
  bedrock: 'https://haleconnect.com/ows/services/org.1261.b67296ce-b2e4-4a5b-8ca5-be7b28ad7c0f_wfs',
  superficial: 'https://haleconnect.com/ows/services/org.1261.a04d7574-5686-4878-a892-401d42b622ee_wfs',
  artificial: 'https://haleconnect.com/ows/services/org.1261.b18733fe-15da-42f2-9566-98b1f7f4dfb8_wfs',
  faults: 'https://haleconnect.com/ows/services/org.1261.a3db76ca-df42-4d6d-a217-839327ec99cd_wfs',
  solutionSubsidence: 'https://haleconnect.com/ows/services/org.1261.7a5757ad-2fda-440a-838e-36b5fcabbeff_wfs',
  floodHazard: 'https://haleconnect.com/ows/services/org.1261.88b609e2-a072-46e7-9ab0-8372067ca184_wfs',
  floodRisk: 'https://haleconnect.com/ows/services/org.1261.ed6a6088-bca4-4305-8dcb-483489461bcb_wfs',
  groundwaterBody: 'https://haleconnect.com/ows/services/org.1261.1abf9466-8e54-4481-8cae-e32ca79a138f_wfs',
  groundwaterProtection: 'https://haleconnect.com/ows/services/org.1261.9c23146c-9633-45d9-a5db-d4ce8992f670_wfs',
  natura2000: 'https://haleconnect.com/ows/services/org.1261.47b1eb61-a89a-4ee0-a4e4-6e0123f8601b_wfs'
} as const;
const today = () => new Date().toISOString().slice(0, 10);

const reasonFor = (status: 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA'): ReasonCode =>
  status === 'MALFORMED_DATA' ? 'MALFORMED_DATA' : 'SOURCE_UNAVAILABLE';

function unavailable(
  id: string,
  category: string,
  sourceName: string,
  sourceUrl: string,
  claim: string,
  reasonCode: ReasonCode
): MaltaEvidence {
  return {
    id, category, claim, status: 'REQUIRES_VERIFICATION', sourceName, sourceUrl,
    datasetDate: today(), spatialRelationship: 'Selected site / official Maltese source',
    calculationMethod: 'Official Malta WFS query with dynamic feature-type discovery and fail-closed validation',
    confidence: 'Low',
    limitation: 'A failed or malformed automated response is not evidence that the mapped condition is absent. Verify the current official dataset before a site decision.',
    value: { reasonCode }, reasonCode
  };
}

const firstContaining = (features: any[], lat: number, lng: number): any | null =>
  features.find(feature => pointInGeometry(feature?.geometry, lng, lat)) || null;

const labelFrom = (properties: Record<string, any>): string | null =>
  propertyValue(properties, [
    /lithostrat/i, /formation/i, /member/i, /unit.*name/i, /geolog.*name/i,
    /description/i, /class/i, /category/i, /designation/i, /site.*name/i, /^name$/i, /label/i, /code/i
  ]);

async function bedrock(lat:number,lng:number,fetcher:FetchLike):Promise<MaltaEvidence> {
  const sourceName='Continental Shelf Department / Geological Survey of Malta — Bedrock geology 1:10,000';
  const result=await queryMaltaWfs(WFS.bedrock,lat,lng,15,fetcher);
  if(result.status!=='OK') return unavailable('mt-geology-bedrock-unavailable','Mapped bedrock geology',sourceName,GEOLOGY_PORTAL,'Malta 1:10,000 bedrock geology could not be queried reliably.',reasonFor(result.status));
  const feature=firstContaining(result.features,lat,lng);
  if(!feature) return unavailable('mt-geology-bedrock-no-data','Mapped bedrock geology',sourceName,GEOLOGY_PORTAL,'The Malta 1:10,000 bedrock service responded but returned no bedrock polygon at the selected coordinate.','NO_DATA');
  const p=feature.properties||{};
  const unit=propertyValue(p,[/lithostrat/i,/formation/i,/member/i,/unit.*name/i,/geolog.*name/i,/label/i,/name/i]);
  const lithology=propertyValue(p,[/litholog/i,/rock.*type/i,/description/i,/material/i]);
  const age=propertyValue(p,[/age/i,/epoch/i,/period/i]);
  if(!unit&&!lithology) return unavailable('mt-geology-bedrock-malformed','Mapped bedrock geology',sourceName,GEOLOGY_PORTAL,'The bedrock service returned a feature without a readable unit or rock description.','MALFORMED_DATA');
  return {
    id:'mt-geology-bedrock',category:'Mapped bedrock geology',
    claim:'The 2021–2022 Malta geological resurvey at 1:10,000 maps the selected coordinate as ' + (unit||'a bedrock unit') + (lithology?': '+lithology:'') + '.',
    status:'VERIFIED',sourceName,sourceUrl:GEOLOGY_PORTAL,datasetDate:'2022',
    spatialRelationship:'Official bedrock polygon containing the selected coordinate',
    calculationMethod:'Planning Authority / Hale Connect WFS point-in-polygon query of the 1:10,000 geological map',
    confidence:'High',
    limitation:'Mapped geology is screening context. It does not establish rock-head depth, weathering, fissures, voids, groundwater level or geotechnical design parameters beneath the parcel.',
    value:{unit,lithology,age,scale:'1:10,000'}
  };
}

async function optionalPolygonLayer(opts:{
  id:string; category:string; service:string; sourceName:string; sourceUrl:string;
  lat:number; lng:number; fetcher:FetchLike; hit:(label:string|null)=>string; miss:string; limitation:string;
}):Promise<MaltaEvidence>{
  const result=await queryMaltaWfs(opts.service,opts.lat,opts.lng,15,opts.fetcher);
  if(result.status!=='OK') return unavailable(opts.id+'-unavailable',opts.category,opts.sourceName,opts.sourceUrl,opts.sourceName+' could not be queried reliably.',reasonFor(result.status));
  const feature=firstContaining(result.features,opts.lat,opts.lng);
  const p=feature?.properties||{};
  const label=feature?labelFrom(p):null;
  return {
    id:opts.id,category:opts.category,claim:feature?opts.hit(label):opts.miss,status:'VERIFIED',
    sourceName:opts.sourceName,sourceUrl:opts.sourceUrl,datasetDate:today(),
    spatialRelationship:'Direct point-in-polygon screen at the selected coordinate',
    calculationMethod:'Official Malta WFS query in EPSG:4326 with point-in-polygon validation',
    confidence:feature?'High':'Medium',limitation:opts.limitation,
    value:{intersects:Boolean(feature),label,attributes:feature?.properties||{}}
  };
}

async function proximityLineLayer(opts:{
  id:string; category:string; service:string; sourceName:string; sourceUrl:string;
  lat:number; lng:number; fetcher:FetchLike; featureWord:string; limitation:string;
}):Promise<MaltaEvidence>{
  const radiusM=500;
  const result=await queryMaltaWfs(opts.service,opts.lat,opts.lng,radiusM,opts.fetcher);
  if(result.status!=='OK') return unavailable(opts.id+'-unavailable',opts.category,opts.sourceName,opts.sourceUrl,opts.sourceName+' could not be queried reliably.',reasonFor(result.status));
  const count=result.features.length;
  return {
    id:opts.id,category:opts.category,
    claim:count
      ? 'The Malta 1:10,000 geological service returned '+count+' mapped '+opts.featureWord+(count===1?'':'s')+' within the 500 m search window around the selected coordinate.'
      : 'The Malta 1:10,000 geological service responded and returned no mapped '+opts.featureWord+' within the 500 m search window around the selected coordinate.',
    status:'VERIFIED',sourceName:opts.sourceName,sourceUrl:opts.sourceUrl,datasetDate:'2022',
    spatialRelationship:'500 m bounding-box screening window around the selected coordinate',
    calculationMethod:'Official Malta WFS bounding-box query; count is contextual and is not an exact nearest-distance calculation',
    confidence:'Medium',limitation:opts.limitation,value:{searchRadiusM:radiusM,count}
  };
}

const riskLevel = (value: unknown): 'Low'|'Moderate'|'High'|null => {
  const s=String(value||'').toLowerCase();
  if(/high|għoli|3\b|severe/.test(s)) return 'High';
  if(/moderate|medium|medju|2\b/.test(s)) return 'Moderate';
  if(/low|baxx|1\b/.test(s)) return 'Low';
  return null;
};

export async function queryMaltaNationalEvidence(lat:number,lng:number,fetcher:FetchLike=fetch):Promise<MaltaEvidence[]> {
  const [bed,superficial,artificial,faults,solution,floodHazard,floodRisk,groundwater,groundwaterProtection,natura] = await Promise.all([
    bedrock(lat,lng,fetcher),
    optionalPolygonLayer({
      id:'mt-geology-superficial',category:'Mapped superficial geology',service:WFS.superficial,
      sourceName:'Continental Shelf Department / Geological Survey of Malta — Superficial geology 1:10,000',sourceUrl:GEOLOGY_PORTAL,lat,lng,fetcher,
      hit:label=>'The Malta 1:10,000 map shows a superficial deposit directly at the selected coordinate'+(label?': '+label:'')+'.',
      miss:'The Malta 1:10,000 superficial-geology service responded and returned no superficial-deposit polygon directly at the selected coordinate.',
      limitation:'This is a point screen of mapped superficial deposits. It does not establish deposit thickness, fill, local variability or parcel-wide stratigraphy.'
    }),
    optionalPolygonLayer({
      id:'mt-geology-artificial',category:'Artificial / made ground',service:WFS.artificial,
      sourceName:'Continental Shelf Department / Geological Survey of Malta — Artificial geology 1:10,000',sourceUrl:GEOLOGY_PORTAL,lat,lng,fetcher,
      hit:label=>'The Malta 1:10,000 artificial-geology layer maps anthropogenic or worked ground at the selected coordinate'+(label?': '+label:'')+'.',
      miss:'The Malta 1:10,000 artificial-geology service responded and returned no mapped artificial-ground polygon directly at the selected coordinate.',
      limitation:'The official map records mapped artificial/worked ground at 1:10,000. Absence of a point overlap does not rule out unmapped fill, excavation, made ground or parcel-wide variation; site investigation remains necessary.'
    }),
    proximityLineLayer({
      id:'mt-geology-faults',category:'Mapped faults',service:WFS.faults,
      sourceName:'Continental Shelf Department / Geological Survey of Malta — Faults 1:10,000',sourceUrl:GEOLOGY_PORTAL,lat,lng,fetcher,featureWord:'fault feature',
      limitation:'The 500 m search is contextual. A mapped fault nearby does not establish instability at the parcel, and no returned feature does not exclude unmapped fractures or local structural conditions.'
    }),
    proximityLineLayer({
      id:'mt-geology-solution-subsidence',category:'Solution subsidence / karst context',service:WFS.solutionSubsidence,
      sourceName:'Continental Shelf Department / Geological Survey of Malta — Solution subsidence 1:10,000',sourceUrl:GEOLOGY_PORTAL,lat,lng,fetcher,featureWord:'solution-subsidence boundary',
      limitation:'Mapped doline/sinkhole boundaries are regional screening evidence. They do not establish cavity presence, bearing conditions or collapse risk beneath the selected parcel.'
    }),
    optionalPolygonLayer({
      id:'mt-flood-hazard',category:'Flood hazard',service:WFS.floodHazard,
      sourceName:'Malta Floods Directive — Flood Hazard Areas',sourceUrl:'https://portal.data.gov.mt/dataset/flood-hazard-areas',lat,lng,fetcher,
      hit:label=>'The Flood Hazard Areas dataset directly overlaps the selected coordinate'+(label?': '+label:'')+'.',
      miss:'The Flood Hazard Areas service responded and returned no direct mapped overlap at the selected coordinate.',
      limitation:'This is a centre-point screen of the published Floods Directive layer, not a parcel-wide hydraulic assessment. Confirm current official flood mapping for the whole site and proposed access.'
    }),
    optionalPolygonLayer({
      id:'mt-flood-risk',category:'Flood risk',service:WFS.floodRisk,
      sourceName:'Malta Floods Directive — Flood Risk Areas',sourceUrl:'https://portal.data.gov.mt/dataset/flood-risk-areas',lat,lng,fetcher,
      hit:label=>'The Flood Risk Areas dataset directly overlaps the selected coordinate'+(label?': '+label:'')+'.',
      miss:'The Flood Risk Areas service responded and returned no direct mapped overlap at the selected coordinate.',
      limitation:'This is a centre-point screen of the published Floods Directive layer. A non-overlap is not a parcel-wide flood-clearance statement and does not assess local drainage or surface-water pathways.'
    }),
    optionalPolygonLayer({
      id:'mt-groundwater-body',category:'Groundwater body context',service:WFS.groundwaterBody,
      sourceName:'Energy & Water Agency / Planning Authority — Ground Water Body Malta',sourceUrl:'https://portal.data.gov.mt/dataset/ground-water-body-malta',lat,lng,fetcher,
      hit:label=>'The official groundwater-body layer maps the selected coordinate within '+(label||'a mean-sea-level or perched groundwater body')+'.',
      miss:'The groundwater-body WFS responded but returned no mapped groundwater-body polygon at the selected coordinate.',
      limitation:'Groundwater-body mapping is hydrogeological context only. It does not establish groundwater depth, seasonal level, perched-water occurrence, permeability or dewatering requirements at the parcel.'
    }),
    optionalPolygonLayer({
      id:'mt-groundwater-protection',category:'Groundwater protection',service:WFS.groundwaterProtection,
      sourceName:'Energy & Water Agency / Planning Authority — Groundwater Protection Zone',sourceUrl:'https://portal.data.gov.mt/dataset/groundwater-protection-zone',lat,lng,fetcher,
      hit:label=>'The official Groundwater Protection Zone layer directly overlaps the selected coordinate'+(label?': '+label:'')+'.',
      miss:'The Groundwater Protection Zone service responded and returned no direct mapped overlap at the selected coordinate.',
      limitation:'This is a centre-point overlap screen only. Confirm the current protection-zone extent and any applicable restrictions with the competent authority before development.'
    }),
    optionalPolygonLayer({
      id:'mt-natura2000',category:'Protected areas',service:WFS.natura2000,
      sourceName:'Planning Authority / ERA — Natura 2000 Sites',sourceUrl:'https://portal.data.gov.mt/dataset/natura-2000-sites',lat,lng,fetcher,
      hit:label=>'The Malta Natura 2000 dataset directly overlaps the selected coordinate'+(label?': '+label:'')+'.',
      miss:'The Natura 2000 service responded and returned no direct mapped Natura 2000 overlap at the selected coordinate.',
      limitation:'This is a centre-point overlap screen only. It does not measure distance to nearby protected sites, ecological connectivity, protected species or project-specific Appropriate Assessment obligations.'
    })
  ]);
  return [bed,superficial,artificial,faults,solution,floodHazard,floodRisk,groundwater,groundwaterProtection,natura];
}

export function enrichMaltaNationalEvidence(report:VerifiedSiteReport&Record<string,any>,items:MaltaEvidence[]):void {
  const bedrockItem=items.find(item=>item.id==='mt-geology-bedrock'&&item.status==='VERIFIED');
  if(bedrockItem){
    const value:any=bedrockItem.value||{};
    report.geosurvey_context={
      ...(report.geosurvey_context||{}),
      geological_unit_name:value.unit||null,
      lithology_type:value.lithology||null,
      geological_period_era:value.age||null,
      evidence_level:'VERIFIED',
      source_name:bedrockItem.sourceName,
      source_url:bedrockItem.sourceUrl,
      source_scale:'1:10,000'
    };
    report.soil={
      ...report.soil,
      geologicalUnit:value.unit||report.soil.geologicalUnit,
      lithologyType:value.lithology||report.soil.lithologyType,
      stratigraphicPeriod:value.age||report.soil.stratigraphicPeriod,
      sourceName:bedrockItem.sourceName,
      sourceUrl:bedrockItem.sourceUrl
    };
  }

  const superficial=items.find(item=>item.id==='mt-geology-superficial'&&item.status==='VERIFIED');
  const artificial=items.find(item=>item.id==='mt-geology-artificial'&&item.status==='VERIFIED');
  const faults=items.find(item=>item.id==='mt-geology-faults'&&item.status==='VERIFIED');
  const solution=items.find(item=>item.id==='mt-geology-solution-subsidence'&&item.status==='VERIFIED');
  report.malta_ground_context={
    superficial:superficial?.value||null,
    artificialGround:artificial?.value||null,
    faults:faults?.value||null,
    solutionSubsidence:solution?.value||null
  };

  const groundwater=items.find(item=>item.id==='mt-groundwater-body'&&item.status==='VERIFIED');
  if((groundwater?.value as any)?.intersects){
    const label=(groundwater?.value as any)?.label;
    report.soil={...report.soil,groundwaterRegime:label?'Mapped groundwater-body context: '+label:'Within a mapped Malta groundwater body; groundwater depth not established'};
  }
  const protection=items.find(item=>item.id==='mt-groundwater-protection'&&item.status==='VERIFIED');
  if((protection?.value as any)?.intersects) report.environment={...report.environment,waterProtectionZone:true};

  const floodHazard=items.find(item=>item.id==='mt-flood-hazard'&&item.status==='VERIFIED');
  const floodRisk=items.find(item=>item.id==='mt-flood-risk'&&item.status==='VERIFIED');
  if(floodHazard&&floodRisk){
    const hazardHit=Boolean((floodHazard.value as any)?.intersects);
    const riskHit=Boolean((floodRisk.value as any)?.intersects);
    const label=(floodRisk.value as any)?.label||(floodHazard.value as any)?.label||'';
    const level=riskLevel(label);
    report.terrain.floodInundationRisk={
      ...report.terrain.floodInundationRisk,
      status:'VERIFIED',
      level:level||'Not available',
      statutoryZoneStatus:hazardHit||riskHit?'Official Malta Floods Directive layer overlaps selected coordinate':'No direct centre-point overlap returned by the official Flood Hazard and Flood Risk WFS layers',
      description:hazardHit||riskHit?'Official flood-hazard/risk screening returned a direct overlap at the selected coordinate.':'Both official Malta Floods Directive WFS layers responded without a direct centre-point overlap; this is not parcel-wide flood clearance.',
      sourceName:'Malta Floods Directive — Flood Hazard / Flood Risk Areas',
      limitation:'Centre-point official screening only. Confirm the whole parcel, access route, drainage context and current authoritative flood information before a site decision.'
    };
  }

  const natura=items.find(item=>item.id==='mt-natura2000'&&item.status==='VERIFIED');
  if((natura?.value as any)?.intersects){
    report.environment={
      ...report.environment,
      natura2000Intersect:true,
      nearestProtectedAreaName:(natura?.value as any)?.label||report.environment.nearestProtectedAreaName,
      protectedAreaType:'Natura 2000'
    };
  }
}
