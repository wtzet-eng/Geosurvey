import assert from 'node:assert/strict';
import testFn from 'node:test';
import { queryCyprusCadastre } from './cyprusCadastreService';

testFn('Cyprus DLS cadastral query selects the parcel containing the point', async () => {
  const polygon = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { id_localId: 'CY-TEST-123', areaValue: 423.5 },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [33.0, 35.0], [33.001, 35.0], [33.001, 35.001], [33.0, 35.001], [33.0, 35.0]
        ]]
      }
    }]
  };
  const fetcher = async () => new Response(JSON.stringify(polygon), { status: 200, headers: { 'content-type': 'application/geo+json' } });
  const result = await queryCyprusCadastre(35.0005, 33.0005, fetcher as typeof fetch);

  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, 'CY-TEST-123');
  assert.equal(result.parcel?.officialAreaM2, 423.5);
  assert.equal(result.geometryPoints?.length, 5);
  assert.equal(result.viewLayer, 'Cadastral Parcel');
});

testFn('Cyprus DLS cadastral query reports unavailable sources', async () => {
  const fetcher = async () => new Response('bad gateway', { status: 502 });
  const result = await queryCyprusCadastre(35, 33, fetcher as typeof fetch);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, 'SOURCE_UNAVAILABLE');
  assert.equal(result.evidence[0]?.status, 'REQUIRES_VERIFICATION');
});
