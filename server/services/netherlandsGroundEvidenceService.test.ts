import assert from 'node:assert/strict';
import { test } from 'node:test';
import { queryNetherlandsGroundEvidence, wgs84ToRd } from './netherlandsGroundEvidenceService';

const response = (text: string) => ({ ok: true, status: 200, text: async () => text } as Response);

const z = Array.from({ length: 313 }, (_, i) => -50 + i * 0.5);
const lithok = Array(313).fill(-127);
lithok[308] = 6; lithok[309] = 2; lithok[310] = 1; lithok[311] = 0; lithok[312] = 0;
const uncertainty = Array(313).fill(-127);
uncertainty[308] = 20; uncertainty[309] = 25; uncertainty[310] = 30; uncertainty[311] = 0; uncertainty[312] = 0;
const fixture = [
  'Dataset: geotop.nc',
  'x, 122100',
  'y, 486700',
  'z, ' + z.join(', '),
  'lithok.lithok[lithok.x=122100][lithok.y=486700], ' + lithok.join(', '),
  'onz_lk.onz_lk[onz_lk.x=122100][onz_lk.y=486700], ' + uncertainty.join(', ')
].join('\n');

test('WGS84 to RD New lands in the expected 100 m GeoTOP cell near Amsterdam', () => {
  const [x, y] = wgs84ToRd(52.3676, 4.9041);
  assert.ok(Math.abs(x - 122100) < 100);
  assert.ok(Math.abs(y - 486700) < 100);
});

test('GeoTOP query parses a modelled vertical column into depth bands and samples', async () => {
  let requestedUrl = '';
  const result = await queryNetherlandsGroundEvidence(52.3676, 4.9041, async (url) => {
    requestedUrl = String(url);
    return response(fixture);
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'nl-geotop-profile');
  assert.equal(result[0].status, 'MODELLED');
  const value = result[0].value as any;
  assert.equal(value.modelVersion, 'GeoTOP v1.6.1');
  assert.equal(value.grid.xM, 122100);
  assert.equal(value.grid.yM, 486700);
  assert.equal(value.modelTopElevationMNAP, 106);
  assert.equal(value.selectedSamples[0].material, 'anthropogenic / made ground');
  assert.match(value.layers[0].material, /made ground/i);
  assert.match(value.layers[value.layers.length - 1].material, /fine sand|medium sand|clay|peat/i);
  assert.match(requestedUrl, /GeoTOP.*ascii/);
});

test('GeoTOP reports source-unavailable status without inventing a profile', async () => {
  const result = await queryNetherlandsGroundEvidence(52.3676, 4.9041, async () => {
    throw new Error('offline');
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].status, 'REQUIRES_VERIFICATION');
  assert.equal((result[0].value as any).reasonCode, 'SOURCE_UNAVAILABLE');
});
