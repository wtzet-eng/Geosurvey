import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { queryBulgariaGroundEvidence } from './bulgariaGroundEvidenceService';

describe('queryBulgariaGroundEvidence', () => {
  it('records Bulgarian national geology and flood sources', async () => {
    const fakeFetch = async () => new Response(JSON.stringify({ layers: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    const result = await queryBulgariaGroundEvidence(42.6977, 23.3219, fakeFetch as typeof fetch);
    assert.equal(result.evidence.some(item => item.id === 'bg-bas-geology'), true);
    assert.equal(result.evidence.some(item => item.id === 'bg-flood-risk'), true);
    assert.equal(result.evidence.some(item => item.id === 'bg-sofia-urban-geology'), true);
  });
});
