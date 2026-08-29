import { LogicalSourceId, SourceEndpoint } from './sourceTypes';
import { BGS_SOURCE_ENDPOINTS } from './providers/bgs';
import { SOILGRIDS_SOURCE_ENDPOINTS } from './providers/soilgrids';
import { POLAND_SOURCE_ENDPOINTS } from './providers/poland';
import { FRANCE_SOURCE_ENDPOINTS } from './providers/france';

const endpoints: SourceEndpoint[] = [...BGS_SOURCE_ENDPOINTS, ...SOILGRIDS_SOURCE_ENDPOINTS, ...POLAND_SOURCE_ENDPOINTS, ...FRANCE_SOURCE_ENDPOINTS];
export const SOURCE_REGISTRY = new Map<LogicalSourceId, SourceEndpoint[]>([...new Set(endpoints.map(endpoint => endpoint.logicalSourceId))].map(id => [id, endpoints.filter(endpoint => endpoint.logicalSourceId === id).sort((a, b) => a.priority - b.priority)]));
export const sourceEndpoints = (id: LogicalSourceId, registry = SOURCE_REGISTRY) => registry.get(id) || [];
export const approvedSourceEndpoints = (id: LogicalSourceId, registry = SOURCE_REGISTRY) => sourceEndpoints(id, registry).filter(endpoint => endpoint.approval === 'APPROVED');
