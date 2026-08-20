import assert from 'node:assert/strict';
import test from 'node:test';
import { BGS_ENDPOINTS, fetchBgsSiteEvidence, ukGeotechnicalDesignFallback } from './bgsEvidenceService';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const mockFetch = (routes: (url: string) => unknown): typeof fetch => (async (input: string | URL | Request) => { const url=String(input); const value=routes(url); return value===undefined?json({},404):json(value); }) as typeof fetch;

test('uses detailed BGS geology before regional fallback', async () => {
  const endpoints={detailed:'https://test/detailed',regional:'https://test/regional',hydrogeology:'https://test/hydro',boreholes:'https://test/bore'};
  const result=await fetchBgsSiteEvidence(52,-1,mockFetch(url=>{
    if(url==='https://test/detailed?f=pjson') return {layers:[{id:4,name:'BGS.50k.Bedrock'}]};
    if(url.startsWith('https://test/detailed/4/query')) return {features:[{attributes:{LEX_D:'German Basin Formation',LITH:'Mudstone',AGE:'Triassic'}}]};
    if(url.endsWith('?f=pjson')) return {layers:[]};
    return undefined;
  }),endpoints);
  assert.equal(result.geology.available,true); assert.equal(result.geology.tier,1); assert.equal(result.geology.unitName,'German Basin Formation'); assert.equal(result.geology.lithology,'Mudstone'); assert.equal(result.geology.geologicalAge,'Triassic');
});

test('falls back to regional BGS geology', async () => {
  const endpoints={detailed:'https://test/detailed',regional:'https://test/regional',hydrogeology:'https://test/hydro',boreholes:'https://test/bore'};
  const result=await fetchBgsSiteEvidence(52,-1,mockFetch(url=>{
    if(url==='https://test/detailed?f=pjson') return {layers:[]};
    if(url==='https://test/regional?f=pjson') return {layers:[{id:3,name:'Geology 625k Bedrock'}]};
    if(url.startsWith('https://test/regional/3/query')) return {features:[{attributes:{LEXICON:'Mercia Mudstone Group',LITHOLOGY:'Mudstone',MAX_AGE:'Triassic'}}]};
    if(url.endsWith('?f=pjson')) return {layers:[]};
    return undefined;
  }),endpoints);
  assert.equal(result.geology.tier,2); assert.equal(result.geology.unitName,'Mercia Mudstone Group');
});

test('keeps UK design geotechnical values unavailable',()=>{const x=ukGeotechnicalDesignFallback();assert.match(x.bearingCapacity,/Not available/);assert.ok(Number.isNaN(x.frictionAngle));assert.ok(Number.isNaN(x.cohesion));});

test('production BGS endpoints point to verified service families',()=>{assert.match(BGS_ENDPOINTS.regional,/SDDS\/Geology_625k/);assert.match(BGS_ENDPOINTS.hydrogeology,/GeoIndex_Onshore\/hydrogeology/);assert.match(BGS_ENDPOINTS.boreholes,/GeoIndex_Onshore\/boreholes/);});
