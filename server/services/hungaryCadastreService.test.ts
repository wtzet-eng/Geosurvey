import test from 'node:test';
import assert from 'node:assert/strict';
import { queryHungaryCadastre } from './hungaryCadastreService';

test('Hungarian cadastral query identifies a containing Lechner parcel', async () => {
  const polygon = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[19,47],[19.001,47],[19.001,47.001],[19,47.001],[19,47]]] },
      properties: { nationalcadastralreference: '123/4', areavalue: 1000, administrativeunit: 'Test settlement' }
    }]
  };
  const fetcher = async () => new Response(JSON.stringify(polygon), { status: 200, headers: { 'content-type': 'application/geo+json' } });
  const result = await queryHungaryCadastre(47.0005, 19.0005, fetcher as typeof fetch);
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, '123/4');
  assert.equal(result.parcel?.officialAreaM2, 1000);
});

test('Hungarian cadastral query preserves limited public coverage when no parcel is returned', async () => {
  const fetcher = async () => new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 });
  const result = await queryHungaryCadastre(47.5, 19.0, fetcher as typeof fetch);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, 'NO_DATA');
  assert.match(result.limitation, /Mesterszállás/);
});
