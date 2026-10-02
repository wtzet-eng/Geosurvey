import assert from 'node:assert/strict';
import test from 'node:test';
import { queryUKGroundwater } from './ukGroundwaterEvidenceService';

test('England groundwater adapter returns latest Environment Agency groundwater level', async () => {
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes('/stations?')) {
      return new Response(JSON.stringify({
        items: [{
          stationReference: 'E99999',
          label: 'Test Groundwater Borehole',
          lat: 52.48,
          long: -1.89,
          measures: {
            qualifier: 'Groundwater',
            unitName: 'mAOD',
            latestReading: { value: 12.34, dateTime: '2026-10-02T20:00:00Z' }
          }
        }]
      }), { status: 200 });
    }
    throw new Error('Unexpected URL: ' + url);
  };

  const result = await queryUKGroundwater(52.48, -1.89, 'England', fetcher);
  const groundwater = result.find(item => item.id === 'gb-ea-groundwater-level');
  assert.equal(groundwater?.status, 'VERIFIED');
  assert.equal((groundwater?.value as any).groundwaterLevelM, 12.34);
  assert.equal((groundwater?.value as any).measurementDateTime, '2026-10-02T20:00:00Z');
});

test('Scotland groundwater adapter returns latest SEPA daily value', async () => {
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes('request=getstationlist')) {
      return new Response(JSON.stringify([
        ['station_no', 'station_name', 'station_latitude', 'station_longitude', 'stationparameter_no'],
        ['300348', 'Test Scottish Borehole', '57.58', '-3.84', 'GWL']
      ]), { status: 200 });
    }
    if (url.includes('request=getTimeseriesList')) {
      return new Response(JSON.stringify([
        ['station_no', 'station_name', 'station_latitude', 'station_longitude', 'stationparameter_name', 'stationparameter_no', 'ts_name', 'ts_id', 'coverage'],
        ['300348', 'Test Scottish Borehole', '57.58', '-3.84', 'GroundwaterLevel', 'GWL', 'Day.Mean', '12345', '2020-01-01/2026-10-02']
      ]), { status: 200 });
    }
    if (url.includes('request=getTimeseriesValues')) {
      return new Response(JSON.stringify([{
        ts_id: '12345',
        station_name: 'Test Scottish Borehole',
        data: [['2026-10-01T00:00:00', 18.75, 254]]
      }]), { status: 200 });
    }
    throw new Error('Unexpected URL: ' + url);
  };

  const result = await queryUKGroundwater(57.58, -3.84, 'Scotland', fetcher);
  const groundwater = result.find(item => item.id === 'gb-sepa-groundwater-level');
  assert.equal(groundwater?.status, 'VERIFIED');
  assert.equal((groundwater?.value as any).groundwaterLevelM, 18.75);
  assert.equal((groundwater?.value as any).measurementDate, '2026-10-01T00:00:00');
});

test('Wales uses BGS archive fallback rather than inventing a level', async () => {
  const result = await queryUKGroundwater(51.48, -3.18, 'Wales', async () => {
    throw new Error('fetch must not be called');
  });
  assert.equal(result[0].status, 'REQUIRES_VERIFICATION');
  assert.equal(result[0].id, 'gb-wales-groundwater-archive-context');
});
