import { test } from 'node:test';
import assert from 'node:assert/strict';
import { querySloveniaCadastre, wgs84ToD96TM } from './sloveniaCadastreService';

test('querySloveniaCadastre identifies a containing official parcel polygon', async () => {
  const lat = 46.1512, lng = 14.9955;
  const [x, y] = wgs84ToD96TM(lat, lng);
  assert.ok(Number.isFinite(x) && Number.isFinite(y));
  const ring = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { nationalCadastralReference: 'SI.TEST.1', areaValue: 500 }, geometry: { type: 'Polygon', coordinates: [[[x - 5, y - 5], [x + 5, y - 5], [x + 5, y + 5], [x - 5, y + 5], [x - 5, y - 5]]] } }] };
  const fetcher = async () => new Response(JSON.stringify(ring), { status: 200, headers: { 'content-type': 'application/geo+json' } });
  const result = await querySloveniaCadastre(lat, lng, fetcher as typeof fetch);
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, 'SI.TEST.1');
  assert.equal(result.parcel?.officialAreaM2, 500);
});
