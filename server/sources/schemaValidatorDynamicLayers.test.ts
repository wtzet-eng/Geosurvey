import assert from 'node:assert/strict';
import test from 'node:test';
import { schemaFingerprint, validateEndpointSchema } from './schemaValidator';
import { sourceEndpoints } from './registry';

test('Polish WMS fingerprint ignores unrelated published layer inventory changes', () => {
  const endpoint = sourceEndpoints('PL_SMGP_DETAILED_GEOLOGY')[0];
  assert.equal(endpoint.expectedLayers.length, 0);
  const base = {
    connectivity: true,
    httpStatus: 200,
    serviceAvailable: true,
    observedLayers: ['Geologia', 'Litologia'],
    observedFields: [],
    capabilities: ['GetCapabilities', 'GetMap', 'GetFeatureInfo']
  };
  const expanded = { ...base, observedLayers: ['Legenda', 'Geologia', 'Nowa_warstwa_pomocnicza', 'Litologia'] };
  assert.equal(validateEndpointSchema(endpoint, base).valid, true);
  assert.equal(validateEndpointSchema(endpoint, expanded).valid, true);
  assert.equal(schemaFingerprint(endpoint, base), schemaFingerprint(endpoint, expanded));
});
