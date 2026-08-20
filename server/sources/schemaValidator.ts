import { createHash } from 'node:crypto';
import { EndpointProbeResult, SourceEndpoint } from './sourceTypes';

const normalizeFields = (fields: EndpointProbeResult['observedFields']) => fields.map(field => ({ name: field.name.toUpperCase(), type: (field.type || '').toUpperCase() })).sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type));

export function schemaFingerprint(endpoint: SourceEndpoint, probe: EndpointProbeResult): string {
  const meaningful = { layers: [...probe.observedLayers].map(String).sort(), fields: normalizeFields(probe.observedFields), capabilities: [...probe.capabilities].sort(), endpointType: endpoint.type };
  return createHash('sha256').update(JSON.stringify(meaningful)).digest('hex');
}

export function validateEndpointSchema(endpoint: SourceEndpoint, probe: EndpointProbeResult) {
  const layers = new Set(probe.observedLayers.map(String));
  const fields = new Set(probe.observedFields.map(field => field.name.toUpperCase()));
  const missingLayers = endpoint.expectedLayers.filter(layer => !layers.has(String(layer)));
  const missingFieldGroups = endpoint.requiredFieldGroups.filter(group => !group.some(field => fields.has(field.toUpperCase())));
  const missingCapabilities = endpoint.expectedCapabilities.filter(capability => !probe.capabilities.includes(capability));
  return { valid: missingLayers.length === 0 && missingFieldGroups.length === 0 && missingCapabilities.length === 0, missingLayers, missingFieldGroups, missingCapabilities, fingerprint: schemaFingerprint(endpoint, probe) };
}
