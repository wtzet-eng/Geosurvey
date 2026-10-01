import { test } from 'node:test';
import assert from 'node:assert/strict';
import { querySloveniaCadastre } from './sloveniaCadastreService';

test('querySloveniaCadastre identifies a containing official parcel polygon', async () => {
  const lat = 46.1512, lng = 14.9955;
  const response = await import('./sloveniaCadastreService');
  const projected = (response as any).__testWgs84ToD96?.(lat, lng);
  assert.ok(projected);
});
