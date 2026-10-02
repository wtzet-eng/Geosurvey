import test from 'node:test';
import assert from 'node:assert/strict';
import { queryUkAgsBoreholes } from './ukAgsEvidenceService';

test('UK AGS service parses nearby BGS AGS boreholes', async () => {
  const fetcher = async () => new Response(JSON.stringify({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-0.1001, 51.5001] },
      properties: {
        bgs_loca_id: 'AGS-TEST-1',
        proj_name: 'Test site investigation',
        proj_cont: 'Test client',
        proj_eng: 'Test engineer',
        loca_fdep: 18.5,
        ags_log_url: 'https://example.test/log',
        dad_item_url: 'https://example.test/data'
      }
    }]
  }), { status: 200, headers: { 'content-type': 'application/geo+json' } });

  const result = await queryUkAgsBoreholes(51.5, -0.1, 2000, fetcher as typeof fetch);
  assert.equal(result.success, true);
  assert.equal(result.count, 1);
  assert.equal(result.boreholes[0].id, 'AGS-TEST-1');
  assert.equal(result.boreholes[0].finalDepthM, 18.5);
  assert.equal(result.evidence?.status, 'VERIFIED');
});
