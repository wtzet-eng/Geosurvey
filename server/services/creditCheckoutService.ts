import { getAiQuotaRuntimeConfig, getCreditPurchaseOrder, grantPurchasedCredits, saveCreditPurchaseOrder, type ServiceOptions } from './aiQuotaService';
import { confirmPaddleCreditTransaction, createPaddleCreditTransaction, getPaddleBillingRuntimeConfig, parsePaddleCreditCompletion } from './paddleBillingService';

export function publicCreditBillingState(env: NodeJS.ProcessEnv = process.env) {
  const config = getPaddleBillingRuntimeConfig(env);
  return { provider: 'paddle' as const, configured: config.checkoutConfigured && getAiQuotaRuntimeConfig(env).enabled,
    environment: config.environment, creditPackSize: config.creditPackSize };
}

export async function createCreditCheckout(user: { uid: string; email?: string | null }, options: ServiceOptions = {}) {
  const env = options.env || process.env;
  if (!publicCreditBillingState(env).configured) throw new Error('Credit checkout is not configured.');
  const config = getPaddleBillingRuntimeConfig(env);
  const checkout = await createPaddleCreditTransaction(user, options);
  // Do not expose a payable checkout until its owner, product and credits are durable.
  await saveCreditPurchaseOrder({ transactionId: checkout.transactionId, uid: user.uid,
    priceId: config.priceId, credits: config.creditPackSize, environment: config.environment }, options);
  return checkout;
}

export async function fulfillCreditPurchase(
  transactionId: string, expectedUid: string | null,
  options: ServiceOptions & { signedTransaction?: unknown } = {}
) {
  const env = options.env || process.env;
  const order = await getCreditPurchaseOrder(transactionId, options);
  if (!order || (expectedUid !== null && order.uid !== expectedUid)) throw new Error('Purchase is not available for this account.');
  if (order.environment !== getPaddleBillingRuntimeConfig(env).environment) throw new Error('Purchase environment mismatch.');
  // A price or pack-size change must not change an order already placed.
  const orderEnv = { ...env, PADDLE_AI_CREDIT_PRICE_ID: order.priceId, AI_CREDIT_PACK_SIZE: String(order.credits) };
  const completion = options.signedTransaction
    ? parsePaddleCreditCompletion({ event_type: 'transaction.completed', data: options.signedTransaction }, orderEnv)
    : await confirmPaddleCreditTransaction(transactionId, order.uid, { ...options, env: orderEnv });
  if (!completion || completion.uid !== order.uid || completion.transactionId !== transactionId) {
    throw new Error('Purchase has not completed or does not match its saved order.');
  }
  // Webhook delivery and browser confirmation share this atomic, idempotent grant.
  return grantPurchasedCredits(order.uid, order.credits, transactionId, options);
}