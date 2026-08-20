import { EndpointProbeResult, SourceEndpoint, SourceHealthStatus } from './sourceTypes';
import { validateEndpointSchema } from './schemaValidator';

export function endpointHealth(endpoint: SourceEndpoint, probe: EndpointProbeResult, previousFingerprint?: string): { status: SourceHealthStatus; fingerprint: string | null } {
  if (probe.httpStatus === 401 || probe.httpStatus === 403) return { status: 'AUTH_REQUIRED', fingerprint: null };
  if (probe.httpStatus === 429) return { status: 'RATE_LIMITED', fingerprint: null };
  if ([301, 302, 307, 308, 404, 410].includes(probe.httpStatus || 0)) return { status: 'ENDPOINT_MOVED', fingerprint: null };
  if (!probe.connectivity) return { status: 'UNAVAILABLE', fingerprint: null };
  if (!probe.serviceAvailable) return { status: 'DEGRADED', fingerprint: null };
  const validation = validateEndpointSchema(endpoint, probe);
  if (!validation.valid || (previousFingerprint && previousFingerprint !== validation.fingerprint)) return { status: 'SCHEMA_CHANGED', fingerprint: validation.fingerprint };
  return { status: 'HEALTHY', fingerprint: validation.fingerprint };
}
