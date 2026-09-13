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
    checkoutConfigured: Boolean(apiKey && clientToken && priceId),
    webhookConfigured: Boolean(webhookSecret)
  };
}

export async function createPaddleCreditTransaction(
  user: { uid: string; email?: string | null },
  options: { fetcher?: FetchLike; env?: NodeJS.ProcessEnv } = {}
): Promise<{ transactionId: string; environment: PaddleEnvironment; clientToken: string; creditPackSize: number }> {
  const config = getPaddleBillingRuntimeConfig(options.env || process.env);
  if (!config.checkoutConfigured) throw new Error('Paddle checkout is not configured.');
  const fetcher = options.fetcher || fetch;
  const response = await fetcher(`${config.apiBaseUrl}/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Paddle-Version': '1'
    },
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
  if (!response.ok || !payload?.data?.id) {
    throw new Error(`Paddle transaction creation failed (${response.status}).`);
  }
  return {
    transactionId: String(payload.data.id),
    environment: config.environment,
    clientToken: config.clientToken,
    creditPackSize: config.creditPackSize
  };
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
  toleranceSeconds = 300
): boolean {
  if (!rawBody || !signatureHeader || !secret) return false;
  const parts = signatureHeader.split(';').map(part => part.trim()).filter(Boolean);
  const timestamp = parts.find(part => part.startsWith('ts='))?.slice(3);
  const signatures = parts.filter(part => part.startsWith('h1=')).map(part => part.slice(3));
  const timestampNumber = Number(timestamp);
  if (!timestamp || !Number.isFinite(timestampNumber) || signatures.length === 0) return false;
  if (Math.abs(Math.floor(nowMs / 1000) - timestampNumber) > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}:${rawBody}`, 'utf8').digest('hex');
  return signatures.some(signature => safeHexEqual(expected, signature));
}

export interface PaddleCreditCompletion {
  transactionId: string;
  uid: string;
  credits: number;
}

export function parsePaddleCreditCompletion(event: any, env: NodeJS.ProcessEnv = process.env): PaddleCreditCompletion | null {
  const config = getPaddleBillingRuntimeConfig(env);
  if (event?.event_type !== 'transaction.completed') return null;
  const data = event?.data;
  if (!data?.id || data?.status !== 'completed') return null;
  if (data?.custom_data?.surveyland_product !== 'ai_credit_pack') return null;
  const uid = typeof data?.custom_data?.surveyland_uid === 'string' ? data.custom_data.surveyland_uid.trim() : '';
  if (!uid) return null;
  const items = Array.isArray(data?.items) ? data.items : [];
  const expectedPrice = config.priceId;
  const priceMatches = Boolean(expectedPrice) && items.some((item: any) => item?.price?.id === expectedPrice || item?.price_id === expectedPrice);
  if (!priceMatches) return null;
  return { transactionId: String(data.id), uid, credits: config.creditPackSize };
}
