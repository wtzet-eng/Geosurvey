import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import {
  confirmPaddleCreditTransaction,
  createPaddleCreditTransaction,
  getPaddleBillingRuntimeConfig,
  parsePaddleCreditCompletion,
  verifyPaddleWebhookSignature
} from './paddleBillingService';

const env = {
  PADDLE_ENVIRONMENT: 'sandbox',
  PADDLE_API_KEY: 'pdl_sdbx_test_api_key',
  PADDLE_CLIENT_TOKEN: 'test_client_token',
  PADDLE_AI_CREDIT_PRICE_ID: 'pri_testcredits',
  AI_CREDIT_PACK_SIZE: '50',
  PADDLE_WEBHOOK_SECRET: 'whsec_test'
} as NodeJS.ProcessEnv;

test('Paddle billing defaults to sandbox and configurable credit packs', () => {
  const config = getPaddleBillingRuntimeConfig(env);
  assert.equal(config.environment, 'sandbox');
  assert.equal(config.apiBaseUrl, 'https://sandbox-api.paddle.com');
  assert.equal(config.creditPackSize, 50);
  assert.equal(config.checkoutConfigured, true);
  assert.equal(config.webhookConfigured, true);
});

test('credit checkout transaction is created server-side with authenticated SurveyLand user metadata', async () => {
  let calledUrl = '';
  let request: any;
  const fetcher: any = async (url: string, init: any) => {
    calledUrl = url;
    request = { headers: init.headers, body: JSON.parse(init.body) };
    return {
      ok: true,
      status: 201,
      json: async () => ({ data: { id: 'txn_checkout123' } })
    };
  };

  const result = await createPaddleCreditTransaction({ uid: 'firebase-user-7', email: 'user@example.test' }, { fetcher, env });
  assert.equal(calledUrl, 'https://sandbox-api.paddle.com/transactions');
  assert.equal(request.headers.Authorization, 'Bearer pdl_sdbx_test_api_key');
  assert.deepEqual(request.body.items, [{ price_id: 'pri_testcredits', quantity: 1 }]);
  assert.equal(request.body.collection_mode, 'automatic');
  assert.equal(request.body.custom_data.surveyland_uid, 'firebase-user-7');
  assert.equal(request.body.custom_data.surveyland_product, 'ai_credit_pack');
  assert.equal(result.transactionId, 'txn_checkout123');
  assert.equal(result.creditPackSize, 50);
});

test('completed Paddle transaction is accepted only for the authenticated user and configured price', async () => {
  const transaction = {
    id: 'txn_paid123',
    status: 'completed',
    custom_data: { surveyland_uid: 'firebase-user-7', surveyland_product: 'ai_credit_pack' },
    items: [{ price: { id: 'pri_testcredits' }, quantity: 1 }]
  };
  const fetcher: any = async () => ({ ok: true, status: 200, json: async () => ({ data: transaction }) });

  const result = await confirmPaddleCreditTransaction('txn_paid123', 'firebase-user-7', { fetcher, env });
  assert.deepEqual(result, { transactionId: 'txn_paid123', uid: 'firebase-user-7', credits: 50 });

  await assert.rejects(
    () => confirmPaddleCreditTransaction('txn_paid123', 'different-user', { fetcher, env }),
    /not a completed SurveyLand credit purchase/i
  );

  const wrongPriceFetcher: any = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: { ...transaction, items: [{ price: { id: 'pri_other' }, quantity: 1 }] } })
  });
  await assert.rejects(
    () => confirmPaddleCreditTransaction('txn_paid123', 'firebase-user-7', { fetcher: wrongPriceFetcher, env }),
    /not a completed SurveyLand credit purchase/i
  );
});

test('Paddle webhook helper validates HMAC over raw body and parses only matching completed credit transactions', () => {
  const rawBody = JSON.stringify({ event_type: 'transaction.completed', data: { id: 'txn_webhook' } });
  const timestamp = 1_700_000_000;
  const signature = createHmac('sha256', 'whsec_test').update(`${timestamp}:${rawBody}`, 'utf8').digest('hex');
  assert.equal(verifyPaddleWebhookSignature(rawBody, `ts=${timestamp};h1=${signature}`, 'whsec_test', timestamp * 1000), true);
  assert.equal(verifyPaddleWebhookSignature(rawBody, `ts=${timestamp};h1=deadbeef`, 'whsec_test', timestamp * 1000), false);

  const parsed = parsePaddleCreditCompletion({
    event_type: 'transaction.completed',
    data: {
      id: 'txn_webhook',
      status: 'completed',
      custom_data: { surveyland_uid: 'firebase-user-7', surveyland_product: 'ai_credit_pack' },
      items: [{ price: { id: 'pri_testcredits' } }]
    }
  }, env);
  assert.deepEqual(parsed, { transactionId: 'txn_webhook', uid: 'firebase-user-7', credits: 50 });
});
