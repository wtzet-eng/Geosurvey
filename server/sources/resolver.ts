import { approvedSourceEndpoints, SOURCE_REGISTRY } from './registry';
import { endpointHealth } from './health';
import { EndpointProbeResult, LogicalSourceId, OperationalSourceMetadata, ResolutionResult, SourceEndpoint } from './sourceTypes';

const operationalCache = new Map<LogicalSourceId, OperationalSourceMetadata>();
const DEFAULT_TTL_MS = 15 * 60_000;
export const getOperationalMetadata = (id: LogicalSourceId) => operationalCache.get(id);
export const clearOperationalMetadata = () => operationalCache.clear();

export async function resolveSource<T>(logicalSourceId: LogicalSourceId, probeEndpoint: (endpoint: SourceEndpoint) => Promise<EndpointProbeResult<T>>, options: { ttlMs?: number; registry?: typeof SOURCE_REGISTRY; now?: () => Date; useCachedResolution?: boolean } = {}): Promise<ResolutionResult<T>> {
  const registry = options.registry || SOURCE_REGISTRY; const endpoints = approvedSourceEndpoints(logicalSourceId, registry); const now = options.now?.() || new Date(); const cached = operationalCache.get(logicalSourceId); const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
  const cachedFresh = cached?.lastValidatedAt && now.getTime() - new Date(cached.lastValidatedAt).getTime() < ttl;
  const cachedEndpoint = cachedFresh && cached.lastHealthyEndpoint ? endpoints.find(endpoint => endpoint.id === cached.lastHealthyEndpoint) : undefined;
  if (options.useCachedResolution && cachedEndpoint) {
    const status = cachedEndpoint.id === endpoints[0]?.id ? 'HEALTHY' : 'FALLBACK_ACTIVE';
    return { endpoint: cachedEndpoint, status, probe: null, attempts: [], provenance: { logicalSourceId, provider: cachedEndpoint.provider, endpointId: cachedEndpoint.id, endpointUsed: cachedEndpoint.url, endpointType: cachedEndpoint.type, evidenceTier: cachedEndpoint.evidenceTier, resolverStatus: status, retrievalTimestamp: now.toISOString(), schemaFingerprint: cached.schemaFingerprint || null } };
  }
  const ordered = cachedFresh && cached.lastHealthyEndpoint ? [...endpoints].sort((a, b) => a.id === cached.lastHealthyEndpoint ? -1 : b.id === cached.lastHealthyEndpoint ? 1 : a.priority - b.priority) : endpoints;
  const attempts: ResolutionResult<T>['attempts'] = [];
  const preferred = endpoints[0];
  for (const endpoint of ordered) {
    if (preferred && endpoint.id !== preferred.id && endpoint.evidenceTier === preferred.evidenceTier && endpoint.compatibilityGroup !== preferred.compatibilityGroup) {
      attempts.push({ endpointId: endpoint.id, status: 'DEGRADED' });
      continue;
    }
    const probe = await probeEndpoint(endpoint); const priorFingerprint = cached?.lastHealthyEndpoint === endpoint.id ? cached.schemaFingerprint : undefined; const health = endpointHealth(endpoint, probe, priorFingerprint); attempts.push({ endpointId: endpoint.id, status: health.status });
    if (health.status !== 'HEALTHY') { operationalCache.set(logicalSourceId, { logicalSourceId, ...cached, consecutiveFailureCount: (cached?.consecutiveFailureCount || 0) + 1, lastValidatedAt: now.toISOString() }); continue; }
    const fallback = endpoint.id !== preferred?.id;
    const status = fallback ? 'FALLBACK_ACTIVE' : 'HEALTHY';
    operationalCache.set(logicalSourceId, { logicalSourceId, lastHealthyEndpoint: endpoint.id, lastValidatedAt: now.toISOString(), schemaFingerprint: health.fingerprint || undefined, consecutiveFailureCount: 0, lastSuccessfulQuery: now.toISOString() });
    return { endpoint, status, probe, attempts, provenance: { logicalSourceId, provider: endpoint.provider, endpointId: endpoint.id, endpointUsed: endpoint.url, endpointType: endpoint.type, evidenceTier: endpoint.evidenceTier, resolverStatus: status, retrievalTimestamp: now.toISOString(), schemaFingerprint: health.fingerprint } };
  }
  return { endpoint: null, status: attempts.at(-1)?.status || 'UNAVAILABLE', probe: null, provenance: null, attempts };
}
