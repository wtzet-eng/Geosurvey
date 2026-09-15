import { createHmac, timingSafeEqual } from 'crypto';

export type PaddleEnvironment = 'sandbox' | 'production';

type FetchLike = typeof fetch;

export interface PaddleBillingConfig {
  environment: PaddleEnvironment;
  apiBaseUrl: string;
  apiKey: string;
  clientToken: string;
  priceId: string;
  webhookSecret: string;
  creditPackSize: number;
  checkoutConfigured: boolean;
  webhookConfigured: boolean;
}

const positiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

export function getPaddleBillingRuntimeConfig(env: NodeJS.ProcessEnv = process.env): PaddleBillingConfig {
  const environment: PaddleEnvironment = String(env.PADDLE_ENVIRONMENT || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox';
  const apiKey = String(env.PADDLE_API_KEY || '').trim();
  const clientToken = String(env.PADDLE_CLIENT_TOKEN || '').trim();
  const priceId = String(env.PADDLE_AI_CREDIT_PRICE_ID || '').trim();
  const webhookSecret = String(env.PADDLE_WEBHOOK_SECRET || '').trim();
  return {
    environment,
    apiBaseUrl: environment === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com',
    apiKey,
    clientToken,
    priceId,
    webhookSecret,
    creditPackSize: positiveInteger(env.AI_CREDIT_PACK_SIZE, 50),
    checkoutConfigured: env.PADDLE_BILLING_ENABLED === 'true' && Boolean(apiKey && clientToken && priceId && webhookSecret),
    webhookConfigured: Boolean(webhookSecret)
  };
}

const paddleHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  'Paddle-Version': '1'
});

export async function createPaddleCreditTransaction(
  user: { uid: string; email?: string | null },
  options: { fetcher?: FetchLike; env?: NodeJS.ProcessEnv } = {}
): Promise<{ transactionId: string; environment: PaddleEnvironment; clientToken: string; creditPackSize: number }> {
  const config = getPaddleBillingRuntimeConfig(options.env || process.env);
  if (!config.checkoutConfigured) throw new Error('Paddle checkout is not configured.');
  const fetcher = options.fetcher || fetch;
  const response = await fetcher(`${config.apiBaseUrl}/transactions`, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: paddleHeaders(config.apiKey),
    body: JSON.stringify({
      items: [{ price_id: config.priceId, quantity: 1 }],
      collection_mode: 'automatic',
      custom_data: {
        surveyland_uid: user.uid,
        surveyland_product: 'ai_credit_pack'
      }
    })
  });
  const payload: any = await response.json().catch(() => null);
  if (!response.ok || !/^txn_[a-z0-9]+$/i.test(payload?.data?.id || '')) {
    throw new Error(`Paddle transaction creation failed (${response.status}).`);
  }
  const item = payload.data.items?.[0];
  if (payload.data.items?.length !== 1 || item?.price?.id !== config.priceId || item?.quantity !== 1 || item?.price?.billing_cycle !== null) {
    throw new Error('Credit checkout requires one configured one-time price.');
  }
  return {
    transactionId: String(payload.data.id),
    environment: config.environment,
    clientToken: config.clientToken,
    creditPackSize: config.creditPackSize
  };
}

export interface PaddleCreditCompletion {
  transactionId: string;
  uid: string;
  credits: number;
}

function parseCompletedTransaction(data: any, expectedUid: string | null, config: PaddleBillingConfig): PaddleCreditCompletion | null {
  if (!/^txn_[a-z0-9]+$/i.test(data?.id || '') || data?.status !== 'completed') return null;
  if (data?.custom_data?.surveyland_product !== 'ai_credit_pack') return null;
  const uid = typeof data?.custom_data?.surveyland_uid === 'string' ? data.custom_data.surveyland_uid.trim() : '';
  if (!uid || (expectedUid && uid !== expectedUid)) return null;
  const items = Array.isArray(data?.items) ? data.items : [];
  // One one-time pack per checkout. Reject extra items, subscriptions and edited quantities.
  const priceMatches = Boolean(config.priceId) && items.length === 1 && items[0]?.quantity === 1
    && (items[0]?.price?.id === config.priceId || items[0]?.price_id === config.priceId)
    && items[0]?.price?.billing_cycle === null && !data.subscription_id;
  if (!priceMatches) return null;
  return { transactionId: String(data.id), uid, credits: config.creditPackSize };
}

export async function confirmPaddleCreditTransaction(
  transactionId: string,
  expectedUid: string,
  options: { fetcher?: FetchLike; env?: NodeJS.ProcessEnv } = {}
): Promise<PaddleCreditCompletion> {
  const config = getPaddleBillingRuntimeConfig(options.env || process.env);
  // Previously created purchases must still settle when new checkout is disabled.
  if (!config.apiKey || !config.priceId) throw new Error('Paddle confirmation is not configured.');
  if (!/^txn_[a-z0-9]+$/i.test(transactionId)) throw new Error('Invalid Paddle transaction ID.');
  const fetcher = options.fetcher || fetch;
  const response = await fetcher(`${config.apiBaseUrl}/transactions/${encodeURIComponent(transactionId)}`, {
    headers: paddleHeaders(config.apiKey),
    signal: AbortSignal.timeout(10_000)
  });
  const payload: any = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Paddle transaction lookup failed (${response.status}).`);
  const completion = parseCompletedTransaction(payload?.data, expectedUid, config);
  if (!completion) throw new Error('Paddle transaction is not a completed SurveyLand credit purchase for this user.');
  return completion;
}

function safeHexEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right) || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function verifyPaddleWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  nowMs = Date.now(),
  toleranceSeconds = 5
): boolean {
  if (!rawBody || !signatureHeader || !secret) return false;
  const parts = signatureHeader.split(';').map(part => part.trim()).filter(Boolean);
  const timestamp = parts.find(part => part.startsWith('ts='))?.slice(3);
  const signatures = parts.filter(part => part.startsWith('h1=')).map(part => part.slice(3));
  const timestampNumber = Number(timestamp);
  if (!timestamp || !/^\d+$/.test(timestamp) || !Number.isSafeInteger(timestampNumber) || signatures.length === 0) return false;
  if (Math.abs(Math.floor(nowMs / 1000) - timestampNumber) > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}:${rawBody}`, 'utf8').digest('hex');
  return signatures.some(signature => safeHexEqual(expected, signature));
}

export function parsePaddleCreditCompletion(event: any, env: NodeJS.ProcessEnv = process.env): PaddleCreditCompletion | null {
  const config = getPaddleBillingRuntimeConfig(env);
  if (event?.event_type !== 'transaction.completed') return null;
  return parseCompletedTransaction(event?.data, null, config);
}