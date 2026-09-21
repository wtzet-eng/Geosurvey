import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCroatiaFloodEvidence } from './croatiaFloodService';

const BLUE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABBAMAAADtO9m6AAAAElBMVEW+6P9z3/9zsv96jvUATagAAABWEWpKAAAABnRSTlP//////wCzv6S/AAAACklEQVR4XmNQAAAAIgAhdd5MxQAAAABJRU5ErkJggg==', 'base64');
const TRANSPARENT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABBAMAAADtO9m6AAAAElBMVEW+6P9z3/9zsv96jvUATagAAABWEWpKAAAABnRSTlP//////wCzv6S/AAAACklEQVR4XmMIAAAAUgBRYRDyeQAAAABJRU5ErkJggg==', 'base64');

function mockFetch(layerResponses: Record<string, Buffer | null>) {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    const layer = new URL(url).searchParams.get('layers') || '';
    const body = layerResponses[layer];
    if (!body) throw new Error('source unavailable');
    return { ok: true, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) } as Response;
  };
}

test('Croatia flood service identifies the highest intersecting official scenario', async () => {
  const result = await fetchCroatiaFloodEvidence(45.775, 15.965, mockFetch({
    'hr.fd.opasnost-od-poplave-velika-vjerojatnost_2019': TRANSPARENT,
    'hr.fd.opasnost-od-poplave-srednja-vjerojatnost_2019': TRANSPARENT,
    'hr.fd.opasnost-od-poplave-mala-vjerojatnost_2019': BLUE
  }));
  assert.equal(result.status, 'VERIFIED');
  assert.equal(result.level, 'Low');
  assert.match(result.scenario || '', /1000-year/);
  assert.equal(result.evidence.id, 'hr-flood-hazard-site');
});

test('Croatia flood service fails closed when an official scenario cannot be queried', async () => {
  const result = await fetchCroatiaFloodEvidence(45.775, 15.965, mockFetch({
    'hr.fd.opasnost-od-poplave-velika-vjerojatnost_2019': TRANSPARENT,
    'hr.fd.opasnost-od-poplave-srednja-vjerojatnost_2019': null,
    'hr.fd.opasnost-od-poplave-mala-vjerojatnost_2019': BLUE
  }));
  assert.equal(result.status, 'REQUIRES_VERIFICATION');
  assert.equal(result.level, 'Not available');
  assert.match(result.evidence.claim, /could not be queried reliably/i);
});
