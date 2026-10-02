import assert from 'node:assert/strict';
import test from 'node:test';
import { queryPolandGroundwater } from './polandGroundwaterService';

test('Poland groundwater adapter returns nearest dated PIG-PIB observation', async () => {
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes('/MapServer/0/query?')) {
      return new Response(JSON.stringify({
        features: [{
          attributes: {
            ID: 9029,
            NR_PKT_MONIT_ILOSC: 'II_22_2',
            AKTUALNIE_OBSERWOWANY: 'Tak',
            RZEDNA_TERENU: 109.8,
            GLEBOKOSC_ZWIERCIADLA: 7.16,
            DATA_POMIARU: 1788127200000,
            WOJEWODZTWO: 'mazowieckie',
            MIEJSCOWOSC: 'Warszawa'
          },
          geometry: { x: 20.8794768, y: 52.21286 }
        }]
      }), { status: 200 });
    }
    throw new Error('Unexpected URL: ' + url);
  };

  const result = await queryPolandGroundwater(52.23, 20.995, fetcher);
  const groundwater = result.find(item => item.id === 'pl-pgi-groundwater-level');

  assert.equal(groundwater?.status, 'VERIFIED');
  assert.equal((groundwater?.value as any).groundwaterDepthM, 7.16);
  assert.equal((groundwater?.value as any).voivodeship, 'mazowieckie');
  assert.equal((groundwater?.value as any).locality, 'Warszawa');
  assert.equal((groundwater?.value as any).measurementDate, '2026-08-30');
});

test('Poland groundwater adapter returns a verification fallback when no measurement is available', async () => {
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes('/MapServer/0/query?')) {
      return new Response(JSON.stringify({ features: [] }), { status: 200 });
    }
    throw new Error('Unexpected URL: ' + url);
  };

  const result = await queryPolandGroundwater(52.23, 20.995, fetcher);
  assert.equal(result[0].status, 'REQUIRES_VERIFICATION');
  assert.equal(result[0].id, 'pl-pgi-groundwater-no-measurement');
});
