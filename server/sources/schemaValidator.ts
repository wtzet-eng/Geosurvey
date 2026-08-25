import { createHash } from 'node:crypto';
import { EndpointProbeResult, SourceEndpoint } from './sourceTypes';

const normalizeFields = (fields: EndpointProbeResult['observedFields']) => fields
  .map(field => ({ name: field.name.toUpperCase(), type: (field.type || '').toUpperCase() }))
  .sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type));
const normalizeCapabilities = (capabilities: string[]) => capabilities.map(value => value.toUpperCase()).sort();
const hasGroup = (fields: Set<string>, group: string[]) => group.some(field => fields.has(field.toUpperCase()));

export function schemaFingerprint(endpoint: SourceEndpoint, probe: EndpointProbeResult): string {
  const requiredFieldNames = new Set(endpoint.requiredFieldGroups.flat().map(field => field.toUpperCase()));
  for (const requirement of endpoint.layerSchemaRequirements || []) for (const field of requirement.requiredFieldGroups.flat()) requiredFieldNames.add(field.toUpperCase());
  const relevantFields = normalizeFields(probe.observedFields).filter(field => requiredFieldNames.size === 0 || requiredFieldNames.has(field.name));
  const layerSchemas = (probe.observedLayerSchemas || []).map(schema => ({
    layer: String(schema.layer),
    fields: normalizeFields(schema.fields).filter(field => {
      const requirement = endpoint.layerSchemaRequirements?.find(item => String(item.layer) === String(schema.layer));
      if (!requirement) return false;
      const required = new Set(requirement.requiredFieldGroups.flat().map(value => value.toUpperCase()));
      return required.has(field.name);
    })
  })).sort((a, b) => a.layer.localeCompare(b.layer));

  // Fingerprint only layer identities that the integration explicitly depends on.
  // Several public WMS catalogues (including PGI-PIB) can add/reorder unrelated
  // published layers without changing the schema required by GeoSurvey. Treating
  // that catalogue churn as SCHEMA_CHANGED caused false source outages.
  const expectedLayers = new Set(endpoint.expectedLayers.map(String));
  const relevantLayers = endpoint.expectedLayers.length
    ? probe.observedLayers.map(String).filter(layer => expectedLayers.has(layer)).sort()
    : [];

  const meaningful = { layers: relevantLayers, fields: relevantFields, layerSchemas, capabilities: normalizeCapabilities(probe.capabilities), endpointType: endpoint.type };
  return createHash('sha256').update(JSON.stringify(meaningful)).digest('hex');
}

export function validateEndpointSchema(endpoint: SourceEndpoint, probe: EndpointProbeResult) {
  const layers = new Set(probe.observedLayers.map(String));
  const fields = new Set(probe.observedFields.map(field => field.name.toUpperCase()));
  const missingLayers = endpoint.expectedLayers.filter(layer => !layers.has(String(layer)));
  const missingFieldGroups = endpoint.requiredFieldGroups.filter(group => !hasGroup(fields, group));
  const observedLayerSchemas = new Map((probe.observedLayerSchemas || []).map(schema => [String(schema.layer), new Set(schema.fields.map(field => field.name.toUpperCase()))]));
  const missingLayerFieldGroups = (endpoint.layerSchemaRequirements || []).flatMap(requirement => {
    const layerFields = observedLayerSchemas.get(String(requirement.layer));
    if (!layerFields) return [{ layer: requirement.layer, missingGroups: requirement.requiredFieldGroups }];
    const missingGroups = requirement.requiredFieldGroups.filter(group => !hasGroup(layerFields, group));
    return missingGroups.length ? [{ layer: requirement.layer, missingGroups }] : [];
  });
  const capabilities = new Set(probe.capabilities.map(value => value.toUpperCase()));
  const missingCapabilities = endpoint.expectedCapabilities.filter(capability => !capabilities.has(capability.toUpperCase()));
  return {
    valid: missingLayers.length === 0 && missingFieldGroups.length === 0 && missingLayerFieldGroups.length === 0 && missingCapabilities.length === 0,
    missingLayers,
    missingFieldGroups,
    missingLayerFieldGroups,
    missingCapabilities,
    fingerprint: schemaFingerprint(endpoint, probe)
  };
}
