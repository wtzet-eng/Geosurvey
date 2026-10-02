import assert from 'node:assert/strict';
import testFn from 'node:test';
import { queryIcelandCadastre } from './icelandCadastreService';
testFn('Iceland cadastral query identifies the containing parcel',async()=>{
 const data={type:'FeatureCollection',features:[{type:'Feature',properties:{landeignanumer:'IS-TEST-1'},geometry:{type:'Polygon',coordinates:[[[20,64],[20.001,64],[20.001,64.001],[20,64.001],[20,64]]]}}]};
 const fetcher=async()=>new Response(JSON.stringify(data),{status:200});
 const r=await queryIcelandCadastre(64.0005,20.0005,fetcher as typeof fetch);
 assert.equal(r.success,true); assert.equal(r.parcel?.parcelId,'IS-TEST-1');
});
testFn('Iceland cadastral query handles unavailable service',async()=>{
 const fetcher=async()=>new Response('bad gateway',{status:502});
 const r=await queryIcelandCadastre(64,20,fetcher as typeof fetch);
 assert.equal(r.success,false); assert.equal(r.reasonCode,'SOURCE_UNAVAILABLE');
});