import test from 'node:test';
import assert from 'node:assert/strict';
import { queryHungaryGroundEvidence } from './hungaryGroundEvidenceService';

test('Hungarian ground service parses HUGEO geology and nearby boreholes', async () => {
  const responses = new Map<string, string>([
    ['wfs', JSON.stringify({ type: 'FeatureCollection', features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [19.04, 47.498] },
      properties: { 'Fúrás_jele__száma': 'TEST-1', 'Talpmélység': 22, 'Fúrás_mélyítésének_éve': 2020 }
    }] })],
    ['wms', JSON.stringify({ type: 'FeatureCollection', features: [{
      type: 'Feature',
      geometry: null,
      properties: { 'Név': 'Feltöltés', 'Litológia': 'agyag' }
    }] })]
  ]);
  const fetcher = async (url: string) => new Response(url.includes('WFSServer') ? responses.get('wfs') : responses.get('wms'), { status: 200, headers: { 'content-type': 'application/geo+json' } });
  const result = await queryHungaryGroundEvidence(47.4979, 19.0402, fetcher as typeof fetch);
  assert.ok(result.evidence.some(item => item.id === 'hu-hugeo-geology-point' && item.status === 'VERIFIED'));
  assert.ok(result.evidence.some(item => item.id === 'hu-hugeo-borehole-context' && item.status === 'VERIFIED'));
  assert.equal(result.context.geological_unit_name, 'Feltöltés');
});
