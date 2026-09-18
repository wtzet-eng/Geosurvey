import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBelgiumCadastreToReport, queryBelgiumCadastre } from './belgiumCadastreService';

const response = (body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

test('Belgian federal cadastre returns parcel identity and registered area without claiming official geometry', async()=>{
  const fetcher:typeof fetch=async()=>response({type:'FeatureCollection',features:[{type:'Feature',geometry:null,properties:{
    nationalCadastralReference:'11806F1209/00L007',label:'1209L7',areaValue:'351,943437',inspireId_versionId:'2026-01-01',zoning:'96',administrativeUnit:'8'
  }}]});
  const result=await queryBelgiumCadastre(51.2194,4.4025,fetcher);
  assert.equal(result.success,true);
  assert.equal(result.parcel?.parcelId,'11806F1209/00L007');
  assert.ok((result.parcel?.officialAreaM2||0)>351 && (result.parcel?.officialAreaM2||0)<352);
  const report:any={parcel:{countryCode:'BE',isOfficialGeometry:false,areaCalculatedM2:1000},evidenceRegistry:[{id:'cadastre-spatial-index'}]};
  applyBelgiumCadastreToReport(report,result,1000);
  assert.equal(report.parcel.status,'VERIFIED');
  assert.equal(report.parcel.officialAreaM2,result.parcel?.officialAreaM2);
  assert.equal(report.parcel.isOfficialGeometry,false);
  assert.equal(report.parcel.geometryPoints,undefined);
});

test('Belgian cadastral source failure fails closed', async()=>{
  const fetcher:typeof fetch=async()=>response({error:'down'},503);
  const result=await queryBelgiumCadastre(50.8466,4.3528,fetcher);
  assert.equal(result.success,false);
  assert.equal(result.reasonCode,'SOURCE_UNAVAILABLE');
  assert.equal(result.evidence[0].status,'REQUIRES_VERIFICATION');
});
