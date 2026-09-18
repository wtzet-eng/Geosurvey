import test from 'node:test';
import assert from 'node:assert/strict';
import { getCenterFromShape, resolveSiteLocation } from './locationResolutionService';

const jsonResponse = (body: any, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' }
});

test('site centre never falls back to a default city', () => {
  assert.equal(getCenterFromShape(null, {}), null);
  assert.equal(getCenterFromShape({ type: 'unknown' }, {}), null);
  assert.deepEqual(getCenterFromShape(null, { latitude: 36.7213, longitude: -4.4214 }), [36.7213, -4.4214]);
});

test('polygon centre remains derived from the selected geometry', () => {
  const centre = getCenterFromShape({ type: 'polygon', points: [[50, 10], [50, 12], [52, 12], [52, 10]] });
  assert.deepEqual(centre, [51, 11]);
});

test('detailed reverse lookup keeps local administrative context', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return jsonResponse({ display_name: 'Calle Santa María, Málaga, España', address: {
      road: 'Calle Santa María', city: 'Málaga', county: 'Málaga-Costa del Sol', state: 'Andalucía', country_code: 'es'
    }});
  };
  const result = await resolveSiteLocation(36.7213, -4.4214, 'Spain', { fetcher });
  assert.equal(calls, 1);
  assert.equal(result.locationName, 'Calle Santa María, Málaga, España');
  assert.equal(result.municipality, 'Málaga');
  assert.equal(result.county, 'Málaga-Costa del Sol');
  assert.equal(result.state, 'Andalucía');
  assert.equal(result.countryCode, 'ES');
  assert.equal(result.resolutionLevel, 'DETAILED');
});

test('failed detailed address falls back to a broader local jurisdiction', async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async (input: any) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('zoom=18')) return jsonResponse({ error: 'not found' }, 503);
    return jsonResponse({ display_name: 'Málaga, Andalucía, España', address: {
      city: 'Málaga', county: 'Málaga', state: 'Andalucía', country_code: 'es'
    }});
  };
  const result = await resolveSiteLocation(36.7213, -4.4214, 'Spain', { fetcher });
  assert.equal(urls.length, 2);
  assert.match(urls[1], /zoom=10/);
  assert.equal(result.municipality, 'Málaga');
  assert.equal(result.county, 'Málaga');
  assert.equal(result.state, 'Andalucía');
  assert.equal(result.resolutionLevel, 'LOCAL');
});
test('geocoder failure keeps the selected coordinates instead of inventing another place', async () => {
  const fetcher: typeof fetch = async () => jsonResponse({ error: 'unavailable' }, 503);
  const result = await resolveSiteLocation(51.5136, 7.4653, 'Germany', { fetcher });
  assert.equal(result.locationName, '51.51360, 7.46530 (Germany)');
  assert.equal(result.municipality, '');
  assert.equal(result.county, '');
  assert.equal(result.state, '');
  assert.equal(result.countryCode, '');
  assert.equal(result.resolutionLevel, 'COORDINATES');
});

test('partial detailed lookup can be supplemented by a coarser administrative lookup', async () => {
  const fetcher: typeof fetch = async (input: any) => {
    const url = String(input);
    if (url.includes('zoom=18')) return jsonResponse({ display_name: 'Selected site', address: { country_code: 'de' } });
    return jsonResponse({ display_name: 'Dortmund, Deutschland', address: {
      city: 'Dortmund', state: 'Nordrhein-Westfalen', country_code: 'de'
    }});
  };
  const result = await resolveSiteLocation(51.5136, 7.4653, 'Germany', { fetcher });
  assert.equal(result.locationName, 'Selected site');
  assert.equal(result.municipality, 'Dortmund');
  assert.equal(result.state, 'Nordrhein-Westfalen');
  assert.equal(result.countryCode, 'DE');
});


test('Belgian reverse lookup retains the regional ISO code for jurisdiction routing', async () => {
  const fetcher: typeof fetch = async () => jsonResponse({ display_name: 'Antwerpen, België', address: {
    city: 'Antwerpen', state: 'Antwerpen', country_code: 'be', 'ISO3166-2-lvl4': 'BE-VLG'
  }});
  const result = await resolveSiteLocation(51.2194, 4.4025, 'Belgium', { fetcher });
  assert.equal(result.countryCode, 'BE');
  assert.equal(result.regionCode, 'BE-VLG');
});
