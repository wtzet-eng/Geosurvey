import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyFirebaseAuthorization } from './firebaseAuthService';

test('Firebase verification fails closed when server API key is absent', async () => {
  const result = await verifyFirebaseAuthorization('Bearer token', { apiKey: '' });
  assert.deepEqual(result, { ok: false, reason: 'AUTH_NOT_CONFIGURED' });
});

test('Firebase verification requires a bearer token', async () => {
  const result = await verifyFirebaseAuthorization(undefined, { apiKey: 'firebase-key' });
  assert.deepEqual(result, { ok: false, reason: 'MISSING_TOKEN' });
});

test('Firebase verification resolves authenticated user through accounts lookup', async () => {
  let request: any;
  const fetcher: any = async (url: string, init: any) => {
    request = { url, body: JSON.parse(init.body) };
    return {
      ok: true,
      json: async () => ({ users: [{ localId: 'uid-1', email: 'user@example.com', displayName: 'User', emailVerified: true, disabled: false }] })
    };
  };
  const result = await verifyFirebaseAuthorization('Bearer id-token', { apiKey: 'firebase-key', fetcher });
  assert.match(request.url, /identitytoolkit\.googleapis\.com\/v1\/accounts:lookup/);
  assert.match(request.url, /key=firebase-key/);
  assert.equal(request.body.idToken, 'id-token');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.user.uid, 'uid-1');
    assert.equal(result.user.emailVerified, true);
  }
});

test('Firebase verification rejects invalid tokens without leaking token details', async () => {
  const fetcher: any = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'INVALID_ID_TOKEN' } }) });
  const result = await verifyFirebaseAuthorization('Bearer bad-token', { apiKey: 'firebase-key', fetcher });
  assert.deepEqual(result, { ok: false, reason: 'INVALID_TOKEN' });
});
