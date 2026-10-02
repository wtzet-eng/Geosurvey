import assert from 'node:assert/strict';
import test from 'node:test';
import { queryFranceGroundwater } from './franceGroundwaterService';

test('France groundwater adapter returns nearest dated ADES measurement', async () => {
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes('/stations?')) {
      return new Response(JSON.stringify({
        data: [{
          bss_id: 'BSS_TEST',
          code_bss: '00000X0000/TEST',
          x: 2.35,
          y: 48.84,
          altitude_station: '35.0',
          libelle_pe: 'Test piezometer'
        }]
      }), { status: 200 });
    }
    if (url.includes('/chroniques?')) {
      return new Response(JSON.stringify({
        data: [{
          date_mesure: '2026-09-30',
          profondeur_nappe: 4.2,
          niveau_nappe_eau: 30.8
        }]
      }), { status: 200 });
    }
    throw new Error('Unexpected URL: ' + url);
  };

  const result = await queryFranceGroundwater(48.84, 2.35, fetcher);
  const groundwater = result.find(item => item.id === 'fr-hubeau-groundwater-level');

  assert.equal(groundwater?.status, 'VERIFIED');
  assert.equal((groundwater?.value as any).groundwaterDepthM, 4.2);
  assert.equal((groundwater?.value as any).piezometricLevelM, 30.8);
  assert.equal((groundwater?.value as any).measurementDate, '2026-09-30');
});
