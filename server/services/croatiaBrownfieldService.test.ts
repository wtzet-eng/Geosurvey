import assert from 'node:assert/strict';
import test from 'node:test';
import { CROATIA_BROWNFIELD_WFS, fetchCroatiaBrownfieldEvidence } from './croatiaBrownfieldService';

const body = (features: any[]) => ({ type: 'FeatureCollection', totalFeatures: features.length, features });
const polygon = (inside: boolean) => inside
  ? [[[15.98,45.81],[15.985,45.81],[15.985,45.82],[15.98,45.82],[15.98,45.81]]]
  : [[[15.90,45.70],[15.91,45.70],[15.91,45.71],[15.90,45.71],[15.90,45.70]]];
const feature = (inside = true) => ({ type: 'Feature', id: 'brownfield_area.1', geometry: { type: 'MultiPolygon', coordinates: [polygon(inside)] }, properties: { sifra_brownfield_podrucja: 'HR-BFR-1', naziv_brownfield_podrucja: 'Test Brownfield', status_brownfield_podrucja: 'Aktivno', prethodna_namjena_brownfielda: 'proizvodna', zagadenost_podrucja_tf: false, zagadenost_podrucja: null } });
const mockFetch = (data: unknown, fail = false): typeof fetch => (async () => { if (fail) throw new Error('network'); return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } }); }) as typeof fetch;

test('Croatia brownfield service detects an official polygon containing the coordinate', async () => {
  const e = await fetchCroatiaBrownfieldEvidence(45.815, 15.982, mockFetch(body([feature(true)])));
  assert.equal(e.status, 'VERIFIED'); assert.equal(e.id, 'hr-brownfield-register'); assert.equal((e.value as any).onSite, true); assert.equal((e.value as any).nearest.name, 'Test Brownfield'); assert.equal(e.sourceUrl, CROATIA_BROWNFIELD_WFS);
});

test('Croatia brownfield service reports no nearby register feature', async () => {
  const e = await fetchCroatiaBrownfieldEvidence(45.815, 15.982, mockFetch(body([feature(false)])));
  assert.equal(e.status, 'VERIFIED'); assert.equal((e.value as any).matchCount, 0);
});

test('Croatia brownfield service fails closed on source outage', async () => {
  const e = await fetchCroatiaBrownfieldEvidence(45.815, 15.982, mockFetch({}, true));
  assert.equal(e.status, 'REQUIRES_VERIFICATION'); assert.equal((e.value as any).reasonCode, 'SOURCE_UNAVAILABLE');
});
