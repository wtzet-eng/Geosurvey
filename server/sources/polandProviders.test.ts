import assert from 'node:assert/strict';
import test from 'node:test';
import { POLAND_SOURCE_ENDPOINTS } from './providers/poland';
import { sourceEndpoints } from './registry';

test('Polish provider registry uses stable logical identities rather than URLs as source identity', () => {
  const ids = new Set(POLAND_SOURCE_ENDPOINTS.map(endpoint => endpoint.logicalSourceId));
  for (const expected of [
    'PL_SMGP_DETAILED_GEOLOGY',
    'PL_MLP_LITHOGENETIC',
    'PL_MGP_REGIONAL_GEOLOGY',
    'PL_ENGINEERING_GEOLOGY',
    'PL_ENGINEERING_BOREHOLES',
    'PL_ENGINEERING_PROPERTIES',
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

test('engineering geology and engineering properties remain separate evidence families', () => {
  const maps = sourceEndpoints('PL_ENGINEERING_GEOLOGY');
  const properties = sourceEndpoints('PL_ENGINEERING_PROPERTIES');
  assert.equal(maps.length, 2);
  assert.equal(properties.length, 1);
  assert.doesNotMatch(properties[0].provenance, /bearing capacity|foundation recommendation/i);
  assert.match(properties[0].provenance, /contextual evidence only/i);
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
