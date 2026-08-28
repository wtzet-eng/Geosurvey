import assert from 'node:assert/strict';
import test from 'node:test';
import { POLAND_SOURCE_ENDPOINTS } from './providers/poland';
import { sourceEndpoints } from './registry';

test('Polish provider registry uses stable logical identities rather than URLs as source identity', () => {
  const ids = new Set(POLAND_SOURCE_ENDPOINTS.map(endpoint => endpoint.logicalSourceId));
  for (const expected of [
    'PL_SMGP_DETAILED_GEOLOGY',
    'PL_SMGP_DOCUMENTATION_POINTS',
    'PL_MLP_LITHOGENETIC',
    'PL_MGP_REGIONAL_GEOLOGY',
    'PL_ENGINEERING_GEOLOGY',
    'PL_ENGINEERING_BOREHOLES',
    'PL_ENGINEERING_PROPERTIES',
    'PL_MGSP_BUILDING_GROUND',
    'PL_CBDG_RESEARCH_POINTS',
    'PL_HYDROGEOLOGY',
    'PL_GROUNDWATER_MONITORING',
    'PL_SOPO_LANDSLIDES'
  ]) assert.ok(ids.has(expected as any), `missing ${expected}`);
});

test('detailed Polish geology is preferred to regional fallback', () => {
  const detailed = sourceEndpoints('PL_SMGP_DETAILED_GEOLOGY');
  const regional = sourceEndpoints('PL_MGP_REGIONAL_GEOLOGY');
  assert.equal(detailed[0].evidenceTier, 1);
  assert.match(detailed[0].provenance, /SMGP.*1:50,000/i);
  assert.equal(regional[0].evidenceTier, 2);
  assert.match(regional[0].provenance, /1:200,000/i);
  assert.equal(regional[1].evidenceTier, 3);
  assert.match(regional[1].provenance, /1:500,000/i);
});

test('MLP is a separate lithogenetic source and cannot masquerade as SMGP geology', () => {
  const mlp = sourceEndpoints('PL_MLP_LITHOGENETIC')[0];
  const smgp = sourceEndpoints('PL_SMGP_DETAILED_GEOLOGY')[0];
  assert.notEqual(mlp.logicalSourceId, smgp.logicalSourceId);
  assert.notEqual(mlp.compatibilityGroup, smgp.compatibilityGroup);
  assert.match(mlp.provenance, /Lithogenetic Map/i);
});

test('engineering geology uses current PGI 50k endpoint and has 300k and 500k fallbacks', () => {
  const maps = sourceEndpoints('PL_ENGINEERING_GEOLOGY');
  assert.equal(maps.length, 3);
  assert.match(maps[0].url, /geoinz\/smgip50k\/MapServer\/WMSServer$/i);
  assert.equal(maps[0].evidenceTier, 1);
  assert.match(maps[1].url, /geoinz\/pmgip300k\/MapServer\/WMSServer$/i);
  assert.equal(maps[1].evidenceTier, 2);
  assert.match(maps[2].url, /geoinz\/mgip500k\/MapServer\/WMSServer$/i);
  assert.equal(maps[2].evidenceTier, 3);
});

test('engineering geology and engineering properties remain separate evidence families', () => {
  const maps = sourceEndpoints('PL_ENGINEERING_GEOLOGY');
  const properties = sourceEndpoints('PL_ENGINEERING_PROPERTIES');
  assert.equal(maps.length, 3);
  assert.equal(properties.length, 1);
  assert.doesNotMatch(properties[0].provenance, /bearing capacity|foundation recommendation/i);
  assert.match(properties[0].provenance, /contextual evidence only/i);
});

test('borehole hierarchy includes OGC, engineering WMS and general CBDG WMS fallbacks', () => {
  const boreholes = sourceEndpoints('PL_ENGINEERING_BOREHOLES');
  assert.equal(boreholes.length, 3);
  assert.equal(boreholes[0].type, 'OGC_API');
  assert.match(boreholes[1].url, /atlas_gi_otwory\/MapServer\/WMSServer$/i);
  assert.match(boreholes[2].url, /cbdg_otwory\/MapServer\/WMSServer$/i);
  assert.ok(boreholes.every(endpoint => endpoint.approval === 'APPROVED'));
});

test('MGśP building-ground context has a current primary and legacy fallback without becoming design evidence', () => {
  const sources = sourceEndpoints('PL_MGSP_BUILDING_GROUND');
  assert.equal(sources.length, 2);
  assert.match(sources[0].url, /mgspIIWarPodlBud\/service\.svc\/get$/i);
  assert.match(sources[0].provenance, /building-ground conditions.*1:50,000/i);
  assert.equal(sources[0].evidenceTier, 1);
  assert.match(sources[1].url, /mgspWarPodlBud\/service\.svc\/get$/i);
  assert.equal(sources[1].evidenceTier, 2);
  assert.ok(sources.every(endpoint => endpoint.approval === 'APPROVED'));
});

test('SMGP documentation points and CBDG research points remain separate contextual evidence families', () => {
  const documentation = sourceEndpoints('PL_SMGP_DOCUMENTATION_POINTS');
  const research = sourceEndpoints('PL_CBDG_RESEARCH_POINTS');
  assert.equal(documentation.length, 1);
  assert.equal(research.length, 1);
  assert.match(documentation[0].url, /smgp_pktdok\/MapServer\/WMSServer$/i);
  assert.match(documentation[0].provenance, /documentation points/i);
  assert.match(research[0].url, /analizy_pkt_bad\/MapServer\/WMSServer$/i);
  assert.match(research[0].provenance, /research-point context/i);
  assert.notEqual(documentation[0].compatibilityGroup, research[0].compatibilityGroup);
});

test('hydrogeology context is separate from groundwater monitoring observations', () => {
  const hydro = sourceEndpoints('PL_HYDROGEOLOGY');
  const monitoring = sourceEndpoints('PL_GROUNDWATER_MONITORING');
  assert.equal(hydro.length, 2);
  assert.equal(monitoring.length, 1);
  assert.match(monitoring[0].provenance, /not parcel water-table measurements/i);
});

test('SOPO public WMS retains access limitations in registry metadata', () => {
  const sopo = sourceEndpoints('PL_SOPO_LANDSLIDES')[0];
  assert.match(sopo.url, /sopo_obszary\/MapServer\/WMSServer$/);
  assert.match(sopo.licence || '', /public.*1:25,000/i);
  assert.match(sopo.licence || '', /restricted/i);
  assert.equal(sopo.approval, 'APPROVED');
});
