import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichMaltaNationalEvidence, queryMaltaNationalEvidence } from './maltaNationalEvidenceService';

const caps='<WFS_Capabilities><FeatureTypeList><FeatureType><Name xmlns:mt="urn:mt">mt:test_layer</Name></FeatureType></FeatureTypeList></WFS_Capabilities>';
const schema='<schema><element name="shape" type="gml:GeometryPropertyType"/><element name="geometry" type="gml:GeometryPropertyType"/></schema>';
const response=(body:any,status=200,type='application/json')=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'content-type':type}});
const polygon=(properties:any={})=>({type:'Feature',geometry:{type:'Polygon',coordinates:[[[14.50,35.89],[14.52,35.89],[14.52,35.91],[14.50,35.91],[14.50,35.89]]]},properties});
const line=(properties:any={})=>({type:'Feature',geometry:{type:'LineString',coordinates:[[14.50,35.89],[14.52,35.91]]},properties});

test('Malta national service combines 1:10k geology, ground hazards, water, flood and Natura screens',async()=>{
  const fetcher:typeof fetch=async(input:any)=>{
    const url=new URL(String(input));
    if(url.searchParams.get('REQUEST')==='GetCapabilities') return response(caps,200,'text/xml');
    if(url.searchParams.get('REQUEST')==='DescribeFeatureType') return response(schema,200,'text/xml');
    const raw=String(input);
    if(raw.includes('b67296ce')) return response({type:'FeatureCollection',features:[polygon({formation:'Globigerina Limestone',lithology:'limestone',age:'Miocene'})]});
    if(raw.includes('a04d7574')) return response({type:'FeatureCollection',features:[]});
    if(raw.includes('b18733fe')) return response({type:'FeatureCollection',features:[polygon({description:'Worked / Made ground'})]});
    if(raw.includes('a3db76ca')) return response({type:'FeatureCollection',features:[line({name:'mapped fault'})]});
    if(raw.includes('7a5757ad')) return response({type:'FeatureCollection',features:[line({name:'solution subsidence boundary'})]});
    if(raw.includes('88b609e2')) return response({type:'FeatureCollection',features:[polygon({class:'High'})]});
    if(raw.includes('ed6a6088')) return response({type:'FeatureCollection',features:[polygon({class:'High'})]});
    if(raw.includes('1abf9466')) return response({type:'FeatureCollection',features:[polygon({name:'Mean Sea Level Groundwater Body'})]});
    if(raw.includes('9c23146c')) return response({type:'FeatureCollection',features:[]});
    if(raw.includes('47b1eb61')) return response({type:'FeatureCollection',features:[]});
    return response({type:'FeatureCollection',features:[]});
  };

  const items=await queryMaltaNationalEvidence(35.9,14.51,fetcher);
  assert.equal(items.length,10);
  assert.equal(items.find(x=>x.id==='mt-geology-bedrock')?.status,'VERIFIED');
  assert.match(items.find(x=>x.id==='mt-geology-bedrock')?.claim||'',/Globigerina Limestone/);
  assert.equal((items.find(x=>x.id==='mt-geology-artificial')?.value as any)?.intersects,true);
  assert.equal((items.find(x=>x.id==='mt-flood-risk')?.value as any)?.intersects,true);
  assert.equal((items.find(x=>x.id==='mt-natura2000')?.value as any)?.intersects,false);
  assert.equal((items.find(x=>x.id==='mt-geology-faults')?.value as any)?.count,1);

  const report:any={
    soil:{geologicalUnit:'Not available',lithologyType:'Not available',stratigraphicPeriod:'Not available',sourceName:'fallback',groundwaterRegime:'Not available'},
    geosurvey_context:{},
    environment:{waterProtectionZone:false,natura2000Intersect:false},
    terrain:{floodInundationRisk:{status:'MODELLED',level:'Low',statutoryZoneStatus:'modelled',description:'modelled',sourceName:'fallback',limitation:'fallback'}}
  };
  enrichMaltaNationalEvidence(report,items);
  assert.equal(report.soil.geologicalUnit,'Globigerina Limestone');
  assert.equal(report.soil.lithologyType,'limestone');
  assert.match(report.soil.groundwaterRegime,/Mean Sea Level Groundwater Body/);
  assert.equal(report.terrain.floodInundationRisk.status,'VERIFIED');
  assert.equal(report.terrain.floodInundationRisk.level,'High');
  assert.equal(report.malta_ground_context.artificialGround.intersects,true);
});

test('Malta official-source failures never become negative findings',async()=>{
  const fetcher:typeof fetch=async()=>response('down',503,'text/plain');
  const items=await queryMaltaNationalEvidence(35.9,14.51,fetcher);
  assert.equal(items.length,10);
  assert.ok(items.every(item=>item.status==='REQUIRES_VERIFICATION'));
  assert.ok(items.every(item=>/unavailable/i.test(item.id)));
});

test('Malta generic INSPIRE bedrock object name is not promoted as a geological unit',async()=>{
  const fetcher:typeof fetch=async(input:any)=>{
    const url=new URL(String(input));
    if(url.searchParams.get('REQUEST')==='GetCapabilities') return response(caps,200,'text/xml');
    if(url.searchParams.get('REQUEST')==='DescribeFeatureType') return response(schema,200,'text/xml');
    const raw=String(input);
    if(raw.includes('b67296ce')) return response({type:'FeatureCollection',features:[polygon({name:'BEDROCK_POLYGON'})]});
    return response({type:'FeatureCollection'});
  };
  const items=await queryMaltaNationalEvidence(35.9,14.51,fetcher);
  const bedrock=items.find(x=>x.id==='mt-geology-bedrock-malformed');
  assert.equal(bedrock?.status,'REQUIRES_VERIFICATION');
  assert.match(bedrock?.claim||'',/no readable geological unit/i);
  assert.equal(items.find(x=>x.id==='mt-flood-hazard')?.status,'VERIFIED');
  assert.equal((items.find(x=>x.id==='mt-flood-hazard')?.value as any)?.intersects,false);
});
