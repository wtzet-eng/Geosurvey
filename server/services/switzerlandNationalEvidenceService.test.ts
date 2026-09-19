import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichSwitzerlandNationalEvidence, querySwitzerlandNationalEvidence } from './switzerlandNationalEvidenceService';

const response=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

function layerFrom(url:string):string {
  const decoded=decodeURIComponent(url);
  const match=decoded.match(/layers=all:([^&]+)/);
  return match?.[1]||'';
}

test('Swiss national evidence keeps official mapped context distinct from design conclusions',async()=>{
  const fetcher:typeof fetch=async(input:any)=>{
    const url=String(input);
    if(url.includes('/kataster_belasteter_standorte_v1_5_0/')){
      return response({type:'FeatureCollection',features:[]});
    }
    const layer=layerFrom(url);
    const labels:Record<string,string>={
      'ch.swisstopo.geologie-swissgeocover2d_bedrock':'Molasse',
      'ch.swisstopo.geologie-swissgeocover2d_unconsolidated':'Alluvial deposits',
      'ch.bafu.hydrogeologische-karte_100':'Porous aquifer context',
      'ch.bafu.grundwasserkoerper':'Groundwater body CH-GW-1',
      'ch.bafu.gefahren-baugrundklassen':'C',
      'ch.are.bauzonen':'Wohnzone'
    };
    return response({results:labels[layer]?[{attributes:{name:labels[layer]}}]:[]});
  };
  const items=await querySwitzerlandNationalEvidence(47.3769,8.5417,fetcher);
  assert.equal(items.length,7);
  assert.equal(items.find(x=>x.id==='ch-geocover-bedrock')?.status,'VERIFIED');
  assert.match(items.find(x=>x.id==='ch-geocover-bedrock')?.claim||'',/Molasse/);
  assert.equal(items.find(x=>x.id==='ch-building-zone')?.status,'VERIFIED');
  assert.match(items.find(x=>x.id==='ch-building-zone')?.limitation||'',/does not certify development rights/i);
  const kbs=items.find(x=>x.id==='ch-kbs-contaminated-sites');
  assert.equal(kbs?.status,'VERIFIED');
  assert.equal((kbs?.value as any)?.intersects,false);
  assert.match(kbs?.limitation||'',/screening query/i);

  const report:any={
    soil:{geologicalUnit:'Not available',sourceName:'fallback'},
    geosurvey_context:{},
    terrain:{geohazards:{seismicRisk:{status:'REQUIRES_VERIFICATION',zone:'Not available',sourceName:'fallback'}}},
    planning:{status:'REQUIRES_VERIFICATION',planDesignation:'Not available',sourceName:'fallback'}
  };
  enrichSwitzerlandNationalEvidence(report,items);
  assert.equal(report.soil.geologicalUnit,'Molasse');
  assert.equal(report.planning.status,'REQUIRES_VERIFICATION');
  assert.equal(report.planning.planDesignation,'Wohnzone');
});

test('Swiss contaminated-site overlap is surfaced without turning it into a geotechnical conclusion',async()=>{
  const fetcher:typeof fetch=async(input:any)=>{
    const url=String(input);
    if(url.includes('belastete_standorte_flaechen')){
      return response({type:'FeatureCollection',features:[{
        type:'Feature',
        geometry:{type:'Polygon',coordinates:[[[8.53,47.37],[8.55,47.37],[8.55,47.39],[8.53,47.39],[8.53,47.37]]]},
        properties:{egrid:'CH123',standorttyp:'Betriebsstandort',statusaltlv:'untersuchungsbedürftig',zustaendige_behoerde:'Kanton ZH'}
      }]});
    }
    if(url.includes('belastete_standorte_punkte')) return response({type:'FeatureCollection',features:[]});
    return response({results:[]});
  };
  const items=await querySwitzerlandNationalEvidence(47.3769,8.5417,fetcher);
  const kbs=items.find(x=>x.id==='ch-kbs-contaminated-sites');
  assert.equal(kbs?.status,'VERIFIED');
  assert.equal((kbs?.value as any)?.intersects,true);
  assert.match(kbs?.claim||'',/directly at the selected coordinate/i);
  assert.match(kbs?.limitation||'',/does not establish soil cleanliness/i);
});

test('Swiss official-source failures remain explicit and never become clear findings',async()=>{
  const fetcher:typeof fetch=async()=>response({error:'unavailable'},503);
  const items=await querySwitzerlandNationalEvidence(46.948,7.4474,fetcher);
  assert.equal(items.length,7);
  assert.ok(items.every(item=>item.status==='REQUIRES_VERIFICATION'));
  assert.match(items.find(x=>x.id==='ch-kbs-unavailable')?.claim||'',/no clear-site conclusion/i);
});
