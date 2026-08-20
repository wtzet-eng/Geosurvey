import { LogicalSourceId, SourceEndpoint } from './sourceTypes';
export interface DiscoveredSourceCandidate { endpoint: SourceEndpoint; status: 'CANDIDATE_REPLACEMENT'; reasons: string[]; activated: false; }
export interface SourceCatalogueDiscovery { discover(logicalSourceId: LogicalSourceId): Promise<DiscoveredSourceCandidate[]>; }
export function candidateReplacement(endpoint: Omit<SourceEndpoint, 'approval'>, reasons: string[]): DiscoveredSourceCandidate { return { endpoint: { ...endpoint, approval: 'CANDIDATE' }, status: 'CANDIDATE_REPLACEMENT', reasons, activated: false }; }
