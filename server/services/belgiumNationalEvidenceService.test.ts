import test from 'node:test';
import assert from 'node:assert/strict';
import { queryBelgiumNationalEvidence, resolveBelgiumRegion } from './belgiumNationalEvidenceService';

const response=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

test('Belgian region routing uses ISO codes and safe name fallbacks',()=>{
  assert.equal(resolveBelgiumRegion('BE-VLG'),'FLANDERS');
  assert.equal(resolveBelgiumRegion('BE-WAL'),'WALLONIA');
  assert.equal(resolveBelgiumRegion('BE-BRU'),'BRUSSELS');
  assert.equal(resolveBelgiumRegion('', 'Liège'),'WALLONIA');
  assert.equal(resolveBelgiumRegion('', '', 'Bruxelles-Capitale'),'BRUSSELS');
});

test('Flanders returns official geology plus contextual boreholes',async()=>{
  const fetcher:typeof fetch=async(input:any)=>{
    const url=String(input);
    if(url.includes('request=GetFeatureInfo')) return response({features:[{properties:{code:'Li',formatie:'Formatie van Lillo',beschrijving:'fijn zand'}}]});
    if(url.includes('request=GetFeature')) return response({features:[{geometry:{type:'Point',coordinates:[4.4026,51.2195]},properties:{id:'1',boornummer:'B1',diepte_tot_m:12,gemeente:'Antwerpen',doel:'Geotechnisch onderzoek',methode:'boring'}}]});
    return response({},404);
  };
  const items=await queryBelgiumNationalEvidence(51.2194,4.4025,{regionCode:'BE-VLG'},fetcher);
  const geology=items.find(x=>x.id==='be-fl-geology');
  const boreholes=items.find(x=>x.id==='be-fl-boreholes');
  assert.equal(geology?.status,'VERIFIED');
  assert.match(geology?.claim||'',/Formatie van Lillo/);
  assert.equal(boreholes?.status,'VERIFIED');
  assert.equal((boreholes?.value as any)?.records?.length,1);
});

test('Wallonia geology uses the regional lithostratigraphic service',async()=>{
  const fetcher:typeof fetch=async()=>response({features:[{attributes:{SIGLE:'LUX',NOM:'Formation de Luxembourg',DESCRIPTION:'calcaires gréseux et sables',FORM_SYSTEME:'Jurassique',CARTE_EDITION:'2022'}}]});
  const items=await queryBelgiumNationalEvidence(49.683,5.817,{regionCode:'BE-WAL'},fetcher);
  const geology=items.find(x=>x.id==='be-wa-geology');
  assert.equal(geology?.status,'VERIFIED');
  assert.match(geology?.claim||'',/Formation de Luxembourg/);
});

test('Brussels stays explicit where regional subsurface automation is not validated',async()=>{
  const items=await queryBelgiumNationalEvidence(50.8466,4.3528,{regionCode:'BE-BRU'});
  assert.ok(items.some(x=>x.id==='be-region'&&x.status==='VERIFIED'));
  assert.ok(items.some(x=>x.id==='be-bru-geology-manual'&&x.status==='REQUIRES_VERIFICATION'));
});
