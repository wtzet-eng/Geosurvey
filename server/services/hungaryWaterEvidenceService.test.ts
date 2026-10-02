import assert from 'node:assert/strict';
import test from 'node:test';
import { queryHungaryWaterEvidence } from './hungaryWaterEvidenceService';

test('Hungarian water evidence reads OVF intersecting layers and groundwater source', async () => {
  const fetcher = async (url: string) => {
    const layer = Number(url.match(/MapServer\/(\d+)\/query/)?.[1] ?? -1);
    const hit = [14, 16, 20, 21, 24].includes(layer) && layer !== 21;
    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features: hit ? [{ type: 'Feature', properties: { NAME: 'test' } }] : []
    }), { status: 200, headers: { 'content-type': 'application/geo+json' } });
  };
  const result = await queryHungaryWaterEvidence(47.4979, 19.0402, fetcher as typeof fetch);
  const water = result.evidence.find(item => item.id === 'hu-ovf-water-hazard-screening');
  assert.equal(water?.status, 'VERIFIED');
  assert.equal(result.context.waterlogged_area, true);
  assert.equal(result.context.inundation_area, false);
  assert.equal(result.context.groundwater_source_available, true);
});
