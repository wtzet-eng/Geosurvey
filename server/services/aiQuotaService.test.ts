import test from 'node:test';
import assert from 'node:assert/strict';
import { getAiEntitlement, getAiQuotaRuntimeConfig, reserveAiInterpretation } from './aiQuotaService';

test('AI quota stays disabled unless persistent Firestore enforcement is explicitly configured', () => {
  const config = getAiQuotaRuntimeConfig({} as NodeJS.ProcessEnv);
  assert.equal(config.enabled, false);
  assert.equal(config.freeLimit, 25);
  assert.equal(config.entitlementCollection, 'surveylandAiEntitlements');
  assert.equal(config.transactionCollection, 'surveylandPaddleTransactions');
});

test('AI quota enables only with enforcement flag and Firestore project', () => {
  const config = getAiQuotaRuntimeConfig({
    AI_QUOTA_ENFORCEMENT: 'true',
    AI_QUOTA_FIRESTORE_PROJECT_ID: 'surveyland-test',
    AI_FREE_REPORT_LIMIT: '25'
  } as NodeJS.ProcessEnv);
  assert.equal(config.enabled, true);
  assert.equal(config.projectId, 'surveyland-test');
  assert.equal(config.freeLimit, 25);
});

test('disabled quota never creates a paywall or requires a Firestore network request', async () => {
  let calls = 0;
  const fetcher: any = async () => {
    calls += 1;
    throw new Error('network should not be called');
  };
  const entitlement = await getAiEntitlement('user-1', { fetcher, env: {} as NodeJS.ProcessEnv });
  assert.equal(calls, 0);
  assert.equal(entitlement.enabled, false);
  assert.equal(entitlement.freeLimit, 25);
  assert.equal(entitlement.freeRemaining, 25);
  assert.equal(entitlement.paywallRequired, false);

  const reservation = await reserveAiInterpretation('user-1', { fetcher, env: {} as NodeJS.ProcessEnv });
  assert.equal(calls, 0);
  assert.equal(reservation?.bucket, 'free');
  assert.equal(reservation?.entitlement.enabled, false);
});
