import test from 'node:test';
import assert from 'node:assert/strict';
import { queryLuxembourgGroundwater } from './luxembourgGroundwaterService';

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('Luxembourg groundwater adapter uses an explicit reference-borehole groundwater level', async () => {
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes('/collections/653/items')) {
      return response({
        features: [{
          geometry: { type: 'Point', coordinates: [6.14418, 49.55603] },
          properties: { Nom: 'Fentange' }
        }]
      });
    }
    if (url.includes('/collections/2176/items')) {
      return response({
        features: [{
          geometry: { type: 'Point', coordinates: [6.14, 49.62] },
          properties: {
            NRFORAGE: 'FR-187-047',
            DESIGNAT: 'FPZ-403-12 / Pz 2 / SH-17-2',
            ALT_TN: 289.84,
            REM: ' - li2: ab 219.0m / -69m/ niv. nappe: 290.76m'
          }
        }]
      });
    }
    throw new Error('Unexpected URL: ' + url);
  };

  const result = await queryLuxembourgGroundwater(49.6116, 6.1319, fetcher);
  const groundwater = result.find(item => item.id === 'lu-geo-groundwater-level');

  assert.equal(groundwater?.status, 'VERIFIED');
  assert.equal((groundwater?.value as any).groundwaterElevationM, 290.76);
  assert.equal((groundwater?.value as any).boreholeTerrainElevationM, 289.84);
  assert.equal((groundwater?.value as any).groundwaterDepthM, 0.92);
  assert.equal((groundwater?.value as any).measurementDate, null);
  assert.equal((groundwater?.value as any).boreholeId, 'FR-187-047');
});

test('Luxembourg groundwater adapter exposes station context without inventing a numeric level', async () => {
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes('/collections/653/items')) {
      return response({
        features: [{
          geometry: { type: 'Point', coordinates: [6.14418, 49.55603] },
          properties: { Nom: 'Fentange' }
        }]
      });
    }
    if (url.includes('/collections/2176/items')) return response({ features: [] });
    throw new Error('Unexpected URL: ' + url);
  };

  const result = await queryLuxembourgGroundwater(49.6116, 6.1319, fetcher);
  assert.equal(result[0].status, 'REQUIRES_VERIFICATION');
  assert.equal(result[0].id, 'lu-geo-groundwater-station-context');
  assert.equal((result[0].value as any).currentNumericLevelAvailable, false);
});
