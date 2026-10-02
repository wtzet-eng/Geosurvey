import assert from 'node:assert/strict';
import test from 'node:test';
import { queryFinlandGroundwater } from './finlandGroundwaterService';

test('Finland groundwater adapter parses dated GTK groundwater-pipe observation', async () => {
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes('/MapServer/0/query?')) {
      return new Response(JSON.stringify({
        features: [{
          attributes: {
            OBJECTID: 19551,
            TUTKIMUSTAPA: 'VP',
            TUNNUS2: '636',
            PAIVAYS: '23022005',
            ALKUPERAINEN_DATA: [
              'TY  0',
              'TT  VP',
              'XY  22468.600 48980.200 18.540 23022005 636',
              '  16.99 23022005 19.89 15.39 1.00',
              '  16.95 01032005 19.89 15.39 1.00',
              '  16.96 02032005 19.89 15.39 1.00',
              '-1  MS'
            ].join('\n')
          },
          geometry: { x: 24.808621841150938, y: 60.18757341659072 }
        }]
      }), { status: 200 });
    }
    throw new Error('Unexpected URL: ' + url);
  };

  const result = await queryFinlandGroundwater(60.17, 24.94, fetcher);
  const groundwater = result.find(item => item.id === 'fi-gtk-groundwater-level');

  assert.equal(groundwater?.status, 'VERIFIED');
  assert.equal((groundwater?.value as any).groundwaterElevationM, 16.96);
  assert.equal((groundwater?.value as any).referenceElevationM, 18.54);
  assert.equal((groundwater?.value as any).groundwaterDepthM, 1.58);
  assert.equal((groundwater?.value as any).stationDistanceKm > 0, true);
  assert.equal((groundwater?.value as any).measurementDate, '2005-03-02');
  assert.equal((groundwater?.value as any).historical, true);
});

test('Finland groundwater adapter returns a verification fallback when no groundwater-pipe measurement is available', async () => {
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes('/MapServer/0/query?')) {
      return new Response(JSON.stringify({ features: [] }), { status: 200 });
    }
    throw new Error('Unexpected URL: ' + url);
  };

  const result = await queryFinlandGroundwater(60.17, 24.94, fetcher);
  assert.equal(result[0].status, 'REQUIRES_VERIFICATION');
  assert.equal(result[0].id, 'fi-gtk-groundwater-no-measurement');
});
