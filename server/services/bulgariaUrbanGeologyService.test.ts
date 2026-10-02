import { describe, expect, it } from 'vitest';
import { queryBulgariaUrbanGeology } from './bulgariaUrbanGeologyService';

describe('queryBulgariaUrbanGeology', () => {
  it('adds Sofia urban geology evidence inside Sofia', async () => {
    const fakeFetch = async () => new Response(JSON.stringify({ resources: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    const result = await queryBulgariaUrbanGeology(42.6977, 23.3219, fakeFetch as typeof fetch);
    expect(result.some(item => item.id === 'bg-sofia-urban-geology')).toBe(true);
    expect(result.some(item => item.id === 'bg-sofia-groundwater')).toBe(true);
    expect(result.some(item => item.id === 'bg-sofia-faults')).toBe(true);
  });

  it('does not apply Sofia urban geology outside Sofia', async () => {
    const result = await queryBulgariaUrbanGeology(43.2141, 27.9147, async () => new Response('{}'));
    expect(result).toHaveLength(0);
  });
});
