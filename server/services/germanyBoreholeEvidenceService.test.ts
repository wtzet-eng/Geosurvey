import test from 'node:test';
import assert from 'node:assert/strict';
import { queryGermanyBoreholes } from './germanyBoreholeEvidenceService';

test('Germany BGR borehole register parses nearby records and nearest distance', async()=>{
 const fetcher=async()=>new Response(JSON.stringify({features:[{geometry:{type:'Point',coordinates:[13.001,53.501]},properties:{gml_ID:'DE-1',totalLength:24.5,SGD:'MV',MERGE_SRC:'LUNG'}}]}),{status:200,headers:{'content-type':'application/json'}}) as any;
 const result=await queryGermanyBoreholes(53.5,13,fetcher,5000);
 assert.equal(result.status,'VERIFIED'); assert.equal(result.value.count,1); assert.equal(result.value.records[0].id,'DE-1'); assert.equal(result.value.records[0].depthM,24.5); assert.ok(result.value.nearestDistanceM>0);
});

test('Germany BGR borehole register reports source failure without implying absence', async()=>{
 const fetcher=async()=>new Response('no',{status:503}) as any;
 const result=await queryGermanyBoreholes(53.5,13,fetcher);
 assert.equal(result.status,'REQUIRES_VERIFICATION'); assert.equal(result.value.reasonCode,'SOURCE_UNAVAILABLE'); assert.match(result.limitation,/not evidence/i);
});
