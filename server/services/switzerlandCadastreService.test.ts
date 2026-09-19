import test from 'node:test';
import assert from 'node:assert/strict';
import { applySwitzerlandCadastreToReport, querySwitzerlandCadastre } from './switzerlandCadastreService';

const response=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

test('Swiss official surveying returns the containing parcel and official geometry',async()=>{
  const fetcher:typeof fetch=async()=>response({type:'FeatureCollection',features:[{
    type:'Feature',id:'parcel-1',
    geometry:{type:'Polygon',coordinates:[[[8.53,47.37],[8.55,47.37],[8.55,47.39],[8.53,47.39],[8.53,47.37]]]},
    properties:{egrid:'CH123456789012',nummer:'812',gemeinde:'Zürich',kanton:'ZH',flaeche:'642'}
  }]});
  const result=await querySwitzerlandCadastre(47.3769,8.5417,fetcher);
  assert.equal(result.success,true);
  assert.equal(result.parcel?.egrid,'CH123456789012');
  assert.equal(result.parcel?.parcelNumber,'812');
  assert.equal(result.parcel?.officialAreaM2,642);
  assert.ok((result.parcel?.geometryPoints.length||0)>=4);
  assert.equal(result.evidence[0].status,'VERIFIED');
  assert.match(result.evidence[0].limitation,/does not establish ownership/i);

  const report:any={parcel:{countryCode:'CH',isOfficialGeometry:false,areaCalculatedM2:700},evidenceRegistry:[{id:'cadastre-spatial-index'}]};
  applySwitzerlandCadastreToReport(report,result,700);
  assert.equal(report.parcel.status,'VERIFIED');
  assert.equal(report.parcel.isOfficialGeometry,true);
  assert.equal(report.parcel.parcelId,'CH123456789012');
  assert.equal(report.parcel.officialAreaM2,642);
  assert.ok(report.parcel.geometryPoints.length>=4);
});

test('Swiss cadastre never substitutes a nearby parcel that does not contain the selected point',async()=>{
  const fetcher:typeof fetch=async()=>response({type:'FeatureCollection',features:[{
    type:'Feature',geometry:{type:'Polygon',coordinates:[[[8.60,47.40],[8.61,47.40],[8.61,47.41],[8.60,47.41],[8.60,47.40]]]},
    properties:{egrid:'CH-WRONG'}
  }]});
  const result=await querySwitzerlandCadastre(47.3769,8.5417,fetcher);
  assert.equal(result.success,false);
  assert.equal(result.reasonCode,'NO_DATA');
  assert.equal(result.evidence[0].status,'REQUIRES_VERIFICATION');
});

test('Swiss cadastral source failure fails closed',async()=>{
  const fetcher:typeof fetch=async()=>response({error:'down'},503);
  const result=await querySwitzerlandCadastre(46.948,7.4474,fetcher);
  assert.equal(result.success,false);
  assert.equal(result.reasonCode,'SOURCE_UNAVAILABLE');
  assert.equal(result.evidence[0].status,'REQUIRES_VERIFICATION');
});
