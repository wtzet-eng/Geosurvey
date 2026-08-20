import { SourceEndpoint } from '../sourceTypes';
const common = { logicalSourceId: 'SOILGRIDS_MODEL' as const, provider: 'ISRIC — World Soil Information', country: 'GLOBAL', coverage: 'Global, 250 m', evidenceTier: 3 as const, compatibilityGroup: 'soilgrids-2-model', licence: 'CC BY 4.0', approval: 'APPROVED' as const };
export const SOILGRIDS_SOURCE_ENDPOINTS: SourceEndpoint[] = [
  { ...common, id: 'soilgrids-rest-v2', type: 'REST_JSON', url: 'https://rest.isric.org/soilgrids/v2.0/properties/query', priority: 1, expectedCapabilities: ['point-query'], expectedLayers: [], requiredFieldGroups: [['sand'], ['silt'], ['clay'], ['bdod'], ['phh2o'], ['soc']], provenance: 'SoilGrids 2.0 REST properties query' },
  { ...common, id: 'soilgrids-wms-mapserver', type: 'WMS', url: 'https://maps.isric.org/mapserv', priority: 2, expectedCapabilities: ['GetFeatureInfo'], expectedLayers: ['sand_0-5cm_mean', 'silt_0-5cm_mean', 'clay_0-5cm_mean', 'bdod_0-5cm_mean', 'phh2o_0-5cm_mean', 'soc_0-5cm_mean'], requiredFieldGroups: [], provenance: 'SoilGrids 2.0 WMS raster mean layers' }
];
