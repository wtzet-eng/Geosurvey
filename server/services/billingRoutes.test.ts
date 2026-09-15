import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import express from 'express';
import { createBillingRouter } from './billingRoutes';
import { getAiEntitlement, reserveAiInterpretation } from './aiQuotaService';
import { interpretSurveyLandEvidence } from './aiInterpretationService';

const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function backend() {
  const env: NodeJS.ProcessEnv = {
    PADDLE_BILLING_ENABLED: 'true', PADDLE_ENVIRONMENT: 'sandbox', PADDLE_API_KEY: 'test-server-key',
    PADDLE_CLIENT_TOKEN: 'test_public', PADDLE_AI_CREDIT_PRICE_ID: 'pri_pack', PADDLE_WEBHOOK_SECRET: 'test-webhook-secret',
    AI_CREDIT_PACK_SIZE: '50', AI_QUOTA_ENFORCEMENT: 'true', AI_FREE_REPORT_LIMIT: '1',
    AI_QUOTA_FIRESTORE_PROJECT_ID: 'test-only-project', FIREBASE_WEB_API_KEY: 'test-firebase',
    MISTRAL_API_KEY: 'test-mistral'
  };
  const documents = new Map<string, any>(), transactions = new Map<string, any>();
  let version = 0, sequence = 0;
  const faults = { nextCommit: false };
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input), method = init?.method || 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.includes('identitytoolkit.googleapis.com')) {
      return /^token-user[12]$/.test(body?.idToken) ? json({ users: [{ localId: body.idToken.slice(6) }] }) : json({}, 400);
    }
    if (url.startsWith('https://sandbox-api.paddle.com/transactions')) {
      if (method === 'POST') {
        const id = `txn_test${++sequence}`;
        const transaction = { id, status: 'draft', custom_data: body.custom_data,
          items: body.items.map((i: any) => ({ quantity: i.quantity, price: { id: i.price_id, billing_cycle: null } })) };
        transactions.set(id, transaction);
        return json({ data: transaction }, 201);
      }
      return json({ data: transactions.get(url.split('/').at(-1)!) });
    }
    if (url.startsWith('https://firestore.googleapis.com/v1/')) {
      const resource = url.split('/v1/')[1];
      if (resource.endsWith(':commit')) {
        if (faults.nextCommit) { faults.nextCommit = false; return json({}, 503); }
        // Check every precondition first; apply all writes atomically.
        for (const w of body.writes) {
          const current = documents.get(w.update.name);
          if ((w.currentDocument?.exists === false && current) ||
              (w.currentDocument?.updateTime && current?.updateTime !== w.currentDocument.updateTime)) return json({}, 409);
        }
        for (const w of body.writes) documents.set(w.update.name, {
          ...structuredClone(w.update), updateTime: new Date(1700000000000 + ++version).toISOString()
        });
        return json({});
      }
      return documents.has(resource) ? json(documents.get(resource)) : json({}, 404);
    }
    if (url.startsWith('https://api.mistral.ai')) return json({ error: 'model unavailable' }, 503);
    throw new Error(`Unexpected test request: ${url}`);
  };
  return { env, documents, transactions, faults, options: { env, fetcher, accessToken: 'test-oauth' } };
}
async function fixture(t: any) {
  const b = backend(), app = express();
  app.use('/api/billing', createBillingRouter(b.options));
  app.use(express.json()); // Deliberately after raw webhook routing, like server.ts.
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/billing`;
  const request = (path: string, body?: any, user = 'user1') => fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer token-${user}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const checkout = async () => {
    const response = await request('/checkout', { uid: 'attacker', credits: 999999 });
    assert.equal(response.status, 200);
    return (await response.json()).transactionId as string;
  };
  const deliverRaw = (raw: string, timestamp = Math.floor(Date.now() / 1000), signature?: string) => {
    const h = signature ?? createHmac('sha256', b.env.PADDLE_WEBHOOK_SECRET!).update(`${timestamp}:${raw}`).digest('hex');
    return fetch(base + '/paddle/webhook', { method: 'POST', headers: {
      'Content-Type': 'application/json', 'Paddle-Signature': `ts=${timestamp};h1=${h}`
    }, body: raw });
  };
  const deliver = (transactionId: string) => deliverRaw(JSON.stringify({
    event_type: 'transaction.completed', data: b.transactions.get(transactionId)
  }, null, 2));
  return { ...b, request, checkout, deliver, deliverRaw };
}

test('billing routes require sign-in, ignore caller credit amounts, and allow top-ups before exhaustion', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/status', undefined, '')).status, 401);
  assert.equal((await f.request('/checkout', {}, '')).status, 401);
  assert.equal((await f.request('/confirm', { transactionId: 'txn_x' }, '')).status, 401);
  const status = await (await f.request('/status')).json();
  assert.equal(status.entitlement.freeRemaining, 1);
  assert.equal(JSON.stringify(status).includes('test-server-key'), false);
  const id = await f.checkout();
  const order = [...f.documents.values()].find(d => d.name.endsWith('Orders/' + id));
  assert.equal(order.fields.uid.stringValue, 'user1');
  assert.equal(order.fields.credits.integerValue, '50');
  assert.equal((await f.request('/confirm', { transactionId: id })).status, 202);
  assert.equal((await getAiEntitlement('user1', f.options)).purchasedCredits, 0);
  assert.equal((await f.request('/confirm', { transactionId: '../secret' })).status, 400);
});

test('webhook and browser confirmation race grants a paid order exactly once, even after price changes', async t => {
  const f = await fixture(t), id = await f.checkout();
  f.transactions.get(id).status = 'completed';
  f.env.AI_CREDIT_PACK_SIZE = '100'; f.env.PADDLE_AI_CREDIT_PRICE_ID = 'pri_new';
  f.env.PADDLE_BILLING_ENABLED = 'false';
  const results = await Promise.all([f.deliver(id), f.deliver(id), f.request('/confirm', { transactionId: id })]);
  assert.deepEqual(results.map(r => r.status), [200, 200, 200]);
  assert.equal((await getAiEntitlement('user1', f.options)).purchasedCredits, 50);
  assert.equal((await f.request('/confirm', { transactionId: id }, 'user2')).status, 202);
  assert.equal((await getAiEntitlement('user2', f.options)).purchasedCredits, 0);
  const repeat = await (await f.deliver(id)).json();
  assert.equal(repeat.duplicate, true);
  assert.equal((await f.request('/checkout', {})).status, 503);
});

test('webhook verifies original bytes and time, ignores unrelated events, and retries storage failures', async t => {
  const f = await fixture(t), id = await f.checkout();
  f.transactions.get(id).status = 'completed';
  const body = JSON.stringify({ event_type: 'transaction.completed', data: f.transactions.get(id) });
  assert.equal((await f.deliverRaw(body, Math.floor(Date.now() / 1000), 'deadbeef')).status, 400);
  assert.equal((await f.deliverRaw(body, Math.floor(Date.now() / 1000) - 60)).status, 400);
  assert.equal((await f.deliverRaw('{')).status, 400);
  assert.equal((await f.deliverRaw(JSON.stringify({ event_type: 'transaction.updated' }))).status, 200);
  f.faults.nextCommit = true;
  assert.equal((await f.deliver(id)).status, 503);
  assert.equal((await getAiEntitlement('user1', f.options)).purchasedCredits, 0);
  assert.equal((await f.deliver(id)).status, 200);
  assert.equal((await getAiEntitlement('user1', f.options)).purchasedCredits, 50);
});

test('wrong owner, price, quantities, subscriptions or environment never grant credit', async t => {
  const f = await fixture(t), id = await f.checkout(), original = structuredClone(f.transactions.get(id));
  const bad = [
    { status: 'draft' },
    { custom_data: { ...original.custom_data, surveyland_uid: 'user2' } },
    { items: [{ quantity: 1, price: { id: 'pri_wrong' } }] },
    { items: [{ quantity: 0, price: { id: 'pri_pack' } }] },
    { items: [original.items[0], original.items[0]] },
    { items: [{ quantity: 1, price: { id: 'pri_pack', billing_cycle: { interval: 'month' } } }] },
    { subscription_id: 'sub_other' }
  ];
  for (const override of bad) {
    f.transactions.set(id, { ...original, status: 'completed', ...override });
    assert.equal((await f.deliver(id)).status, 503);
  }
  f.transactions.set(id, { ...original, status: 'completed' });
  f.env.PADDLE_ENVIRONMENT = 'production';
  assert.equal((await f.deliver(id)).status, 503);
  assert.equal((await getAiEntitlement('user1', f.options)).purchasedCredits, 0);
});

test('failed order persistence never returns a payable checkout; disabled billing stays off', async t => {
  const f = await fixture(t);
  f.faults.nextCommit = true;
  assert.equal((await f.request('/checkout', {})).status, 503);
  assert.equal([...f.documents.values()].filter(d => d.name.includes('Orders/')).length, 0);
  f.env.PADDLE_WEBHOOK_SECRET = '';
  assert.equal((await f.request('/checkout', {})).status, 503);
  assert.equal((await f.deliverRaw('{}')).status, 503);
});

test('free allowance is concurrency-safe, paid credits reserve and failed AI calls restore them', async t => {
  const f = await fixture(t), id = await f.checkout();
  const reservations = await Promise.all([reserveAiInterpretation('user1', f.options), reserveAiInterpretation('user1', f.options)]);
  assert.equal(reservations.filter(Boolean).length, 1);
  f.transactions.get(id).status = 'completed';
  assert.equal((await f.deliver(id)).status, 200);
  f.env.AI_QUOTA_FIRESTORE_ACCESS_TOKEN = 'test-oauth';
  await assert.rejects(interpretSurveyLandEvidence({ id: 'report-1', __surveyland_token: 'token-user1', report_data: {} },
    { env: f.env, fetcher: f.options.fetcher }), /Mistral request failed/);
  assert.equal((await getAiEntitlement('user1', f.options)).purchasedCredits, 50);
});