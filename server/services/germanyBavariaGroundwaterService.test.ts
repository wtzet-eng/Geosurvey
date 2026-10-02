import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enrichGermanyBavariaGroundwater,
  queryGermanyBavariaGroundwater,
  toBavariaNative
} from './germanyBavariaGroundwaterService';

function response(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

test('Bavaria groundwater adapter combines high-groundwater mapping, hydro unit and contours', async () => {
  const [x, y] = toBavariaNative(48.1351, 11.5820);
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes('/identify?')) {
      return response({
        results: [{ layerId: 28, attributes: { 'Raster.Value': 1 } }]
      });
    }
    if (url.includes('/28/query?')) {
      return response({
        features: [{
          attributes: { kurztext: 'Quartär', symbologie: 'Quartäre Schotter' }
        }]
      });
    }
    if (url.includes('/39/query?')) {
      return response({
        features: [
          {
            attributes: { gwl: 'q', hoehe: 480, mth_text: 'Stichtagsmessung Niedrigwasser', quelle: 'official' },
            geometry: { paths: [[[x - 5000, y - 200], [x + 5000, y - 200]]] }
          },
          {
            attributes: { gwl: 'q', hoehe: 481, mth_text: 'Stichtagsmessung Niedrigwasser', quelle: 'official' },
            geometry: { paths: [[[x - 5000, y + 200], [x + 5000, y + 200]]] }
          }
        ]
      });
    }
    if (url.includes('/38/query?')) return response({ features: [] });
    throw new Error('Unexpected URL: ' + url);
  };
  const result = await queryGermanyBavariaGroundwater(
    48.1351, 11.5820, 'Bayern', fetcher, 480.5
  );
  assert.equal(result.highGroundwaterArea, true);
  assert.equal(result.modelledGroundwaterFound, true);
  const groundwater = result.evidence.find(item => item.id === 'de-by-groundwater-regional-model');
  assert.equal(groundwater?.status, 'MODELLED');
  assert.equal((groundwater?.value as any).estimatedGroundwaterElevationM, 480.5);
  assert.equal((groundwater?.value as any).estimatedDepthBelowGroundM, 0);
  assert.equal((groundwater?.value as any).riskLevel, 'High');

  const report: any = {
    evidenceRegistry: [],
    geosurvey_context: {},
    soil: {}
  };
  enrichGermanyBavariaGroundwater(report, result);
  assert.equal(report.geosurvey_context.bavaria_high_groundwater_area, true);
  assert.equal(report.geosurvey_context.bavaria_hydrogeological_unit, 'Quartär');
  assert.equal(report.soil.estimatedWaterTableDepthM, 'Indicative groundwater depth 0.0 m below modelled ground level');
  assert.equal(report.evidenceRegistry.length, 3);
});

test('Bavaria adapter ignores other German states', async () => {
  const result = await queryGermanyBavariaGroundwater(
    53.5, 13.9, 'Mecklenburg-Vorpommern',
    async () => { throw new Error('fetch must not be called'); },
    16
  );
  assert.equal(result.evidence.length, 0);
  assert.equal(result.highGroundwaterArea, null);
});