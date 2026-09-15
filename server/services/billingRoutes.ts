import express from 'express';
import { verifyFirebaseAuthorization } from './firebaseAuthService';
import { getAiEntitlement, getAiQuotaRuntimeConfig, type ServiceOptions } from './aiQuotaService';
import { getPaddleBillingRuntimeConfig, verifyPaddleWebhookSignature } from './paddleBillingService';
import { createCreditCheckout, fulfillCreditPurchase, publicCreditBillingState } from './creditCheckoutService';

/** Mount before the app-wide JSON parser so Paddle signatures cover the original bytes. */
export function createBillingRouter(options: ServiceOptions = {}) {
  const router = express.Router();
  const env = options.env || process.env;
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.post('/paddle/webhook', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
    const config = getPaddleBillingRuntimeConfig(env);
    if (!config.webhookConfigured || !getAiQuotaRuntimeConfig(env).enabled) {
      return res.status(503).json({ error: 'Payment confirmation is not configured.' });
    }
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    if (!verifyPaddleWebhookSignature(raw, req.get('Paddle-Signature'), config.webhookSecret)) {
      return res.status(400).json({ error: 'Invalid payment signature.' });
    }
    let event: any;
    try { event = JSON.parse(raw); } catch { return res.status(400).json({ error: 'Invalid payment event.' }); }
    if (event?.event_type !== 'transaction.completed' || event?.data?.custom_data?.surveyland_product !== 'ai_credit_pack') {
      return res.json({ received: true, ignored: true });
    }
    try {
      const result = await fulfillCreditPurchase(String(event.data?.id || ''), null, { ...options, signedTransaction: event.data });
      return res.json({ received: true, duplicate: result.duplicate });
    } catch {
      // Non-2xx keeps Paddle retries active. Never acknowledge before the durable grant.
      return res.status(503).json({ error: 'Credit confirmation pending; retry this notification.' });
    }
  });

  const checkouts = new Map<string, { start: number; count: number }>();
  router.use(async (req, res, next) => {
    try {
      const auth = await verifyFirebaseAuthorization(req.headers.authorization, { apiKey: env.FIREBASE_WEB_API_KEY, fetcher: options.fetcher });
      if (!auth.ok) return res.status(auth.reason === 'AUTH_NOT_CONFIGURED' ? 503 : 401).json({ error: 'Sign in to manage AI credits.' });
      res.locals.billingUser = auth.user;
      next();
    } catch { res.status(503).json({ error: 'Account verification is temporarily unavailable.' }); }
  });
  router.get('/status', async (_req, res) => {
    try {
      return res.json({ kind: 'entitlement', entitlement: await getAiEntitlement(res.locals.billingUser.uid, options), billing: publicCreditBillingState(env) });
    } catch { return res.status(503).json({ error: 'Could not load AI credits. Please retry.' }); }
  });
  router.post('/checkout', express.json({ limit: '2kb' }), async (_req, res) => {
    const billing = publicCreditBillingState(env);
    if (!billing.configured) return res.status(503).json({ kind: 'billing_unavailable', error: 'Credit packs are not available yet.', billing });
    const user = res.locals.billingUser;
    const now = Date.now();
    const previous = checkouts.get(user.uid);
    const count = previous && now - previous.start < 60_000 ? previous.count : 0;
    if (count >= 5) return res.status(429).json({ error: 'Please wait a minute before starting another checkout.' });
    if (checkouts.size >= 5000) checkouts.delete(checkouts.keys().next().value!);
    checkouts.set(user.uid, { start: count ? previous!.start : now, count: count + 1 });
    try {
      const entitlement = await getAiEntitlement(user.uid, options);
      const checkout = await createCreditCheckout(user, options);
      return res.json({ kind: 'checkout', entitlement, billing, ...checkout });
    } catch { return res.status(503).json({ error: 'Checkout is temporarily unavailable. No checkout was opened.' }); }
  });
  router.post('/confirm', express.json({ limit: '2kb' }), async (req, res) => {
    const transactionId = req.body?.transactionId;
    if (typeof transactionId !== 'string' || !/^txn_[a-z0-9]+$/i.test(transactionId)) {
      return res.status(400).json({ error: 'A valid transaction ID is required.' });
    }
    try {
      const result = await fulfillCreditPurchase(transactionId, res.locals.billingUser.uid, options);
      return res.json({ kind: 'purchase_confirmed', ...result, billing: publicCreditBillingState(env) });
    } catch {
      return res.status(202).json({ kind: 'purchase_pending', error: 'Purchase is not confirmed for this account yet. Refresh credits shortly.' });
    }
  });
  return router;
}