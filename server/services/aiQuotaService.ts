type FetchLike = typeof fetch;

export type AiQuotaBucket = 'free' | 'purchased';

export interface AiEntitlement {
  enabled: boolean;
  freeLimit: number;
  freeUsed: number;
  freeRemaining: number;
  purchasedCredits: number;
  totalRemaining: number;
  paywallRequired: boolean;
}

export interface AiQuotaReservation {
  bucket: AiQuotaBucket;
  entitlement: AiEntitlement;
}

interface StoredEntitlement {
  freeUsed: number;
  purchasedCredits: number;
  updateTime: string | null;
}

interface RuntimeConfig {
  enabled: boolean;
  projectId: string;
  databaseId: string;
  entitlementCollection: string;
  transactionCollection: string;
  freeLimit: number;
}

interface ServiceOptions {
  fetcher?: FetchLike;
  accessToken?: string;
  env?: NodeJS.ProcessEnv;
}

const clampNonNegativeInteger = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback;
};

const safeDocumentId = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, char => `_${char.charCodeAt(0).toString(16)}_`);

export function getAiQuotaRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const projectId = String(env.AI_QUOTA_FIRESTORE_PROJECT_ID || '').trim();
  const enabled = String(env.AI_QUOTA_ENFORCEMENT || '').toLowerCase() === 'true' && Boolean(projectId);
  return {
    enabled,
    projectId,
    databaseId: String(env.AI_QUOTA_FIRESTORE_DATABASE_ID || '(default)').trim() || '(default)',
    entitlementCollection: String(env.AI_QUOTA_FIRESTORE_COLLECTION || 'surveylandAiEntitlements').trim() || 'surveylandAiEntitlements',
    transactionCollection: String(env.AI_QUOTA_TRANSACTION_COLLECTION || 'surveylandPaddleTransactions').trim() || 'surveylandPaddleTransactions',
    freeLimit: clampNonNegativeInteger(env.AI_FREE_REPORT_LIMIT, 25)
  };
}

const entitlementFromStored = (stored: StoredEntitlement, config: RuntimeConfig): AiEntitlement => {
  const freeUsed = Math.min(config.freeLimit, clampNonNegativeInteger(stored.freeUsed));
  const purchasedCredits = clampNonNegativeInteger(stored.purchasedCredits);
  const freeRemaining = Math.max(0, config.freeLimit - freeUsed);
  const totalRemaining = freeRemaining + purchasedCredits;
  return {
    enabled: config.enabled,
    freeLimit: config.freeLimit,
    freeUsed,
    freeRemaining,
    purchasedCredits,
    totalRemaining,
    paywallRequired: config.enabled && totalRemaining <= 0
  };
};

const disabledEntitlement = (config: RuntimeConfig): AiEntitlement => entitlementFromStored({ freeUsed: 0, purchasedCredits: 0, updateTime: null }, config);

async function getGoogleAccessToken(fetcher: FetchLike, options: ServiceOptions): Promise<string> {
  const explicit = String(options.accessToken || options.env?.AI_QUOTA_FIRESTORE_ACCESS_TOKEN || process.env.AI_QUOTA_FIRESTORE_ACCESS_TOKEN || '').trim();
  if (explicit) return explicit;
  const response = await fetcher('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
    headers: { 'Metadata-Flavor': 'Google' }
  });
  if (!response.ok) throw new Error(`Firestore metadata token unavailable (${response.status}).`);
  const payload: any = await response.json();
  if (!payload?.access_token) throw new Error('Firestore metadata token response did not include an access token.');
  return String(payload.access_token);
}

const databaseName = (config: RuntimeConfig) => `projects/${config.projectId}/databases/${config.databaseId}`;
const entitlementName = (uid: string, config: RuntimeConfig) => `${databaseName(config)}/documents/${config.entitlementCollection}/${safeDocumentId(uid)}`;
const transactionName = (transactionId: string, config: RuntimeConfig) => `${databaseName(config)}/documents/${config.transactionCollection}/${safeDocumentId(transactionId)}`;
const firestoreUrl = (resourceName: string) => `https://firestore.googleapis.com/v1/${resourceName}`;

const intField = (value: number) => ({ integerValue: String(clampNonNegativeInteger(value)) });
const stringField = (value: string) => ({ stringValue: value });
const timestampField = (value = new Date().toISOString()) => ({ timestampValue: value });

function parseStoredDocument(payload: any): StoredEntitlement {
  const freeUsed = clampNonNegativeInteger(payload?.fields?.freeUsed?.integerValue);
  const purchasedCredits = clampNonNegativeInteger(payload?.fields?.purchasedCredits?.integerValue);
  return { freeUsed, purchasedCredits, updateTime: typeof payload?.updateTime === 'string' ? payload.updateTime : null };
}

async function readDocument(name: string, token: string, fetcher: FetchLike): Promise<{ exists: boolean; payload: any | null }> {
  const response = await fetcher(firestoreUrl(name), { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return { exists: false, payload: null };
  if (!response.ok) throw new Error(`Firestore read failed (${response.status}).`);
  return { exists: true, payload: await response.json() };
}

async function commitWrites(config: RuntimeConfig, token: string, fetcher: FetchLike, writes: any[]): Promise<Response> {
  return fetcher(`${firestoreUrl(`${databaseName(config)}/documents`)}:commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes })
  });
}

const entitlementWrite = (uid: string, stored: StoredEntitlement, previousExists: boolean, config: RuntimeConfig) => ({
  update: {
    name: entitlementName(uid, config),
    fields: {
      freeUsed: intField(stored.freeUsed),
      purchasedCredits: intField(stored.purchasedCredits),
      updatedAt: timestampField()
    }
  },
  currentDocument: previousExists && stored.updateTime ? { updateTime: stored.updateTime } : { exists: false }
});

const retryableCommit = (response: Response) => response.status === 409 || response.status === 412;

async function updateEntitlementOptimistically(
  uid: string,
  mutate: (stored: StoredEntitlement) => { changed: boolean; next: StoredEntitlement; result: AiQuotaReservation | AiEntitlement },
  options: ServiceOptions = {}
): Promise<AiQuotaReservation | AiEntitlement> {
  const config = getAiQuotaRuntimeConfig(options.env || process.env);
  if (!config.enabled) return disabledEntitlement(config);
  const fetcher = options.fetcher || fetch;
  const token = await getGoogleAccessToken(fetcher, options);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readDocument(entitlementName(uid, config), token, fetcher);
    const stored = current.exists ? parseStoredDocument(current.payload) : { freeUsed: 0, purchasedCredits: 0, updateTime: null };
    const mutation = mutate(stored);
    if (!mutation.changed) return mutation.result;
    const response = await commitWrites(config, token, fetcher, [entitlementWrite(uid, mutation.next, current.exists, config)]);
    if (response.ok) return mutation.result;
    if (!retryableCommit(response)) throw new Error(`Firestore quota commit failed (${response.status}).`);
  }
  throw new Error('Firestore quota update conflicted repeatedly.');
}

export async function getAiEntitlement(uid: string, options: ServiceOptions = {}): Promise<AiEntitlement> {
  const config = getAiQuotaRuntimeConfig(options.env || process.env);
  if (!config.enabled) return disabledEntitlement(config);
  const fetcher = options.fetcher || fetch;
  const token = await getGoogleAccessToken(fetcher, options);
  const current = await readDocument(entitlementName(uid, config), token, fetcher);
  const stored = current.exists ? parseStoredDocument(current.payload) : { freeUsed: 0, purchasedCredits: 0, updateTime: null };
  return entitlementFromStored(stored, config);
}

export async function reserveAiInterpretation(uid: string, options: ServiceOptions = {}): Promise<AiQuotaReservation | null> {
  const config = getAiQuotaRuntimeConfig(options.env || process.env);
  if (!config.enabled) return { bucket: 'free', entitlement: disabledEntitlement(config) };
  const result = await updateEntitlementOptimistically(uid, stored => {
    if (stored.freeUsed < config.freeLimit) {
      const next = { ...stored, freeUsed: stored.freeUsed + 1 };
      return { changed: true, next, result: { bucket: 'free' as const, entitlement: entitlementFromStored(next, config) } };
    }
    if (stored.purchasedCredits > 0) {
      const next = { ...stored, purchasedCredits: stored.purchasedCredits - 1 };
      return { changed: true, next, result: { bucket: 'purchased' as const, entitlement: entitlementFromStored(next, config) } };
    }
    return { changed: false, next: stored, result: entitlementFromStored(stored, config) };
  }, options);
  return 'bucket' in result ? result : null;
}

export async function refundAiInterpretation(uid: string, bucket: AiQuotaBucket, options: ServiceOptions = {}): Promise<AiEntitlement> {
  const config = getAiQuotaRuntimeConfig(options.env || process.env);
  if (!config.enabled) return disabledEntitlement(config);
  const result = await updateEntitlementOptimistically(uid, stored => {
    const next = bucket === 'free'
      ? { ...stored, freeUsed: Math.max(0, stored.freeUsed - 1) }
      : { ...stored, purchasedCredits: stored.purchasedCredits + 1 };
    return { changed: true, next, result: entitlementFromStored(next, config) };
  }, options);
  return 'bucket' in result ? result.entitlement : result;
}

export async function grantPurchasedCredits(
  uid: string,
  credits: number,
  transactionId: string,
  options: ServiceOptions = {}
): Promise<{ entitlement: AiEntitlement; duplicate: boolean }> {
  const config = getAiQuotaRuntimeConfig(options.env || process.env);
  if (!config.enabled) throw new Error('Persistent AI quota storage is not configured.');
  const amount = clampNonNegativeInteger(credits);
  if (!amount) throw new Error('Credit grant must be greater than zero.');
  const fetcher = options.fetcher || fetch;
  const token = await getGoogleAccessToken(fetcher, options);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const receipt = await readDocument(transactionName(transactionId, config), token, fetcher);
    const current = await readDocument(entitlementName(uid, config), token, fetcher);
    const stored = current.exists ? parseStoredDocument(current.payload) : { freeUsed: 0, purchasedCredits: 0, updateTime: null };
    if (receipt.exists) return { entitlement: entitlementFromStored(stored, config), duplicate: true };

    const next = { ...stored, purchasedCredits: stored.purchasedCredits + amount };
    const receiptWrite = {
      update: {
        name: transactionName(transactionId, config),
        fields: {
          uid: stringField(uid),
          credits: intField(amount),
          transactionId: stringField(transactionId),
          createdAt: timestampField()
        }
      },
      currentDocument: { exists: false }
    };
    const response = await commitWrites(config, token, fetcher, [receiptWrite, entitlementWrite(uid, next, current.exists, config)]);
    if (response.ok) return { entitlement: entitlementFromStored(next, config), duplicate: false };
    if (!retryableCommit(response)) throw new Error(`Firestore credit grant failed (${response.status}).`);
  }
  throw new Error('Firestore credit grant conflicted repeatedly.');
}
