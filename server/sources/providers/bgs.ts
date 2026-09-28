import { SourceEndpoint } from '../sourceTypes';

const provider = 'British Geological Survey';
const common = {
  provider,
  country: 'GB',
  coverage: 'Great Britain',
  type: 'ARCGIS_REST' as const,
  expectedCapabilities: ['query'],
  licence: 'BGS OpenGeoscience terms',
  approval: 'APPROVED' as const
};

const bedrockGroups = [['LEX_D', 'LEX_RCS_D', 'LEX'], ['RCS_D', 'RCS_X', 'LEX_RCS_D'], ['MIN_TIME_D', 'MIN_PERIOD', 'MAX_PERIOD']];
const superficialGroups = [['LEX_D', 'LEX_RCS_D', 'LEX'], ['RCS_D', 'RCS_X', 'LEX_RCS_D']];

export const BGS_SOURCE_ENDPOINTS: SourceEndpoint[] = [
  {
    ...common,
    id: 'bgs-detailed-arcgis',
    logicalSourceId: 'BGS_DETAILED_GEOLOGY',
    url: 'https://map.bgs.ac.uk/arcgis/rest/services/BGS_Detailed_Geology/MapServer',
    priority: 1,
    evidenceTier: 1,
    compatibilityGroup: 'bgs-detailed-50k',
    expectedLayers: [3, 4],
    requiredFieldGroups: [],
    layerSchemaRequirements: [
      { layer: 4, requiredFieldGroups: bedrockGroups },
      { layer: 3, requiredFieldGroups: superficialGroups }
    ],
    provenance: 'BGS Detailed Geology, bedrock layer 4 and superficial layer 3'
  },
  {
    ...common,
    id: 'bgs-regional-arcgis',
    logicalSourceId: 'BGS_REGIONAL_GEOLOGY',
    url: 'https://map.bgs.ac.uk/arcgis/rest/services/SDDS/Geology_625k/MapServer',
    priority: 1,
    evidenceTier: 2,
    compatibilityGroup: 'bgs-regional-625k',
    expectedLayers: [2, 3],
    requiredFieldGroups: [],
    layerSchemaRequirements: [
      { layer: 3, requiredFieldGroups: superficialGroups },
      { layer: 2, requiredFieldGroups: superficialGroups }
    ],
    provenance: 'BGS 1:625,000 regional geology, bedrock layer 3 and superficial layer 2'
  },
  {
    ...common,
    id: 'bgs-geoindex-boreholes',
    logicalSourceId: 'BGS_BOREHOLES',
    url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/boreholes/MapServer',
    priority: 1,
    evidenceTier: 1,
    compatibilityGroup: 'bgs-geoindex-boreholes',
    expectedLayers: [],
    requiredFieldGroups: [],
    provenance: 'BGS GeoIndex onshore borehole context'
  },
  {
    ...common,
    id: 'bgs-engineering-geology',
    logicalSourceId: 'BGS_ENGINEERING_GEOLOGY',
    url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/engineering_geology/MapServer',
    priority: 1,
    evidenceTier: 2,
    compatibilityGroup: 'bgs-engineering-geology',
    expectedLayers: [2, 3],
    requiredFieldGroups: [],
    layerSchemaRequirements: [
      { layer: 2, requiredFieldGroups: [['Superficial_EGWeb.ENG_DESC']] },
      { layer: 3, requiredFieldGroups: [['ENG_DESC']] }
    ],
    provenance: 'BGS GeoIndex 1:1M superficial and bedrock engineering geology'
  },
  {
    ...common,
    id: 'bgs-urban-3d-models',
    logicalSourceId: 'BGS_URBAN_3D_MODELS',
    url: 'https://map.bgs.ac.uk/arcgis/rest/services/SDDS/Urban_Interactive_Models/MapServer',
    priority: 1,
    evidenceTier: 2,
    compatibilityGroup: 'bgs-urban-3d-models',
    expectedLayers: [0, 1],
    requiredFieldGroups: [],
    layerSchemaRequirements: [
      { layer: 0, requiredFieldGroups: [['NAME', 'MODELID']] }
    ],
    provenance: 'BGS Urban Interactive 3D geological model coverage'
  },
  {
    ...common,
    id: 'bgs-geoindex-hydrogeology',
    logicalSourceId: 'BGS_HYDROGEOLOGY',
    url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hydrogeology/MapServer',
    priority: 1,
    evidenceTier: 2,
    compatibilityGroup: 'bgs-geoindex-hydrogeology',
    expectedLayers: [],
    requiredFieldGroups: [],
    provenance: 'BGS GeoIndex modelled hydrogeology context'
  }
];
