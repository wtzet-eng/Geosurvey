import test from 'node:test';
import assert from 'node:assert/strict';
import { investigateUkBgsSources } from './ukBgsSourceInvestigationService';

test('UK BGS source investigation fetches nearest record metadata', async () => {
  const fetcher = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/items?')) {
      return new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-0.1001, 51.5001] },
          properties: {
            bgs_loca_id: 'AGS-TEST-1',
            proj_name: 'Test ground investigation',
            proj_cont: 'Test client',
            proj_eng: 'Test engineer',
            loca_fdep: 24,
            ags_log_url: 'https://example.test/log',
            dad_item_url: 'https://example.test/data'
          }
        }]
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      type: 'Feature',
      properties: {
        bgs_loca_id: 'AGS-TEST-1',
        proj_name: 'Test ground investigation',
        loca_fdep: 24,
        some_metadata: 'borehole metadata'
      }
    }), { status: 200 });
  };

  const result = await investigateUkBgsSources(51.5, -0.1, fetcher as typeof fetch);
  assert.equal(result.success, true);
  assert.equal(result.sourceCount, 1);
  assert.equal(result.records[0].id, 'AGS-TEST-1');
  assert.equal(result.records[0].finalDepthM, 24);
  assert.equal(result.evidence[0].sourceName, 'British Geological Survey — AGS borehole record');
  assert.equal(result.evidence[0].value?.recordDetails?.some_metadata, 'borehole metadata');
});
