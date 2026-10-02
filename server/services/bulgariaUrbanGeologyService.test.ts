import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { queryBulgariaUrbanGeology } from './bulgariaUrbanGeologyService';

describe('queryBulgariaUrbanGeology', () => {
  it('adds Sofia urban geology evidence inside Sofia', async () => {
    const fakeFetch = async () => new Response(JSON.stringify({ resources: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    const result = await queryBulgariaUrbanGeology(42.6977, 23.3219, fakeFetch as typeof fetch);
    assert.equal(result.some(item => item.id === 'bg-sofia-urban-geology'), true);
    assert.equal(result.some(item => item.id === 'bg-sofia-groundwater'), true);
    assert.equal(result.some(item => item.id === 'bg-sofia-faults'), true);
  });

  it('does not apply Sofia urban geology outside Sofia', async () => {
    const result = await queryBulgariaUrbanGeology(43.2141, 27.9147, async () => new Response('{}'));
    assert.equal(result.length, 0);
  });
});
