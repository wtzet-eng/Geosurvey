import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchPolandCadastralParcel } from './poland';

const originalFetch = globalThis.fetch;

test('GUGiK ULDK includes EPSG:4326 in xy and returns the official parcel geometry', async () => {
  let requestedUrl = '';
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response([
      '0',
      '146510_8.0502.1/3|SRID=4326;POLYGON((21.012 52.229,21.013 52.229,21.013 52.230,21.012 52.230,21.012 52.229))|146510_8.0502.1/3|Warszawa|m.st. Warszawa|mazowieckie|Śródmieście'
    ].join('\n'), { status: 200, headers: { 'content-type': 'text/plain' } });
  }) as typeof fetch;
  try {
    const result = await fetchPolandCadastralParcel(52.2297, 21.0122);
    const params = new URL(requestedUrl).searchParams;
    assert.equal(params.get('xy'), '21.012200,52.229700,4326');
    assert.equal(result.success, true);
    assert.equal(result.parcelId, '146510_8.0502.1/3');
    assert.equal(result.voivodeship, 'mazowieckie');
    assert.equal(result.isOfficialGeometry, true);
    assert.ok((result.officialAreaM2 || 0) > 0);
    assert.ok((result.geometryPoints || []).length >= 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
