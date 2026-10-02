import { describe, expect, it } from 'vitest';
import { queryBulgariaGroundEvidence } from './bulgariaGroundEvidenceService';

describe('queryBulgariaGroundEvidence', () => {
  it('records Bulgarian national geology and flood sources', async () => {
    const fakeFetch = async () => new Response(JSON.stringify({ layers: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    const result = await queryBulgariaGroundEvidence(42.6977, 23.3219, fakeFetch as typeof fetch);
    expect(result.evidence.some(item => item.id === 'bg-bas-geology')).toBe(true);
    expect(result.evidence.some(item => item.id === 'bg-flood-risk')).toBe(true);
    expect(result.evidence.some(item => item.id === 'bg-sofia-urban-geology')).toBe(true);
  });
});
