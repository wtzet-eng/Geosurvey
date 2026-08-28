export type LogicalSourceId = 'BGS_DETAILED_GEOLOGY' | 'BGS_REGIONAL_GEOLOGY' | 'BGS_BOREHOLES' | 'BGS_HYDROGEOLOGY' | 'SOILGRIDS_MODEL' | 'PL_SMGP_DETAILED_GEOLOGY' | 'PL_MLP_LITHOGENETIC' | 'PL_MGP_REGIONAL_GEOLOGY' | 'PL_ENGINEERING_GEOLOGY' | 'PL_ENGINEERING_BOREHOLES' | 'PL_ENGINEERING_PROPERTIES' | 'PL_HYDROGEOLOGY' | 'PL_GROUNDWATER_MONITORING' | 'PL_SOPO_LANDSLIDES' | 'PL_MGSP_BUILDING_GROUND' | 'PL_SMGP_DOCUMENTATION_POINTS' | 'PL_CBDG_RESEARCH_POINTS';
export type EndpointType = 'ARCGIS_REST' | 'WMS' | 'REST_JSON' | 'OGC_API' | 'WCS' | 'RASTER';
export type SourceHealthStatus = 'HEALTHY' | 'DEGRADED' | 'FALLBACK_ACTIVE' | 'UNAVAILABLE' | 'SCHEMA_CHANGED' | 'ENDPOINT_MOVED' | 'RATE_LIMITED' | 'AUTH_REQUIRED' | 'CANDIDATE_REPLACEMENT';
export type ApprovalStatus = 'APPROVED' | 'CANDIDATE';

export interface LayerSchemaRequirement {
  layer: string | number;
  requiredFieldGroups: string[][];
}

export interface SourceEndpoint {
  id: string;
  logicalSourceId: LogicalSourceId;
  provider: string;
  country: string;
  coverage: string;
  type: EndpointType;
  url: string;
  priority: number;
  evidenceTier: 1 | 2 | 3 | 4;
  compatibilityGroup: string;
  expectedCapabilities: string[];
  expectedLayers: Array<string | number>;
  requiredFieldGroups: string[][];
  layerSchemaRequirements?: LayerSchemaRequirement[];
  licence?: string;
  provenance: string;
  approval: ApprovalStatus;
}

export interface ObservedLayerSchema {
  layer: string | number;
  fields: Array<{ name: string; type?: string }>;
}

export interface EndpointProbeResult<T = unknown> {
  connectivity: boolean;
  httpStatus?: number;
  serviceAvailable: boolean;
  observedLayers: Array<string | number>;
  observedFields: Array<{ name: string; type?: string }>;
  observedLayerSchemas?: ObservedLayerSchema[];
  capabilities: string[];
  payload?: T;
}

export interface SourceProvenance {
  logicalSourceId: LogicalSourceId;
  provider: string;
  endpointId: string;
  endpointUsed: string;
  endpointType: EndpointType;
  evidenceTier: number;
  resolverStatus: SourceHealthStatus;
  retrievalTimestamp: string;
  schemaFingerprint: string | null;
}

export interface ResolutionResult<T = unknown> {
  endpoint: SourceEndpoint | null;
  status: SourceHealthStatus;
  probe: EndpointProbeResult<T> | null;
  provenance: SourceProvenance | null;
  attempts: Array<{ endpointId: string; status: SourceHealthStatus }>;
}

export interface OperationalSourceMetadata {
  logicalSourceId: LogicalSourceId;
  lastHealthyEndpoint?: string;
  lastValidatedAt?: string;
  schemaFingerprint?: string;
  consecutiveFailureCount: number;
  lastSuccessfulQuery?: string;
}
