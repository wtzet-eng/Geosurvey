import { SourceEndpoint } from '../sourceTypes';

const provider = 'Państwowy Instytut Geologiczny – PIB';
const common = {
  provider,
  country: 'PL',
  coverage: 'Poland',
  type: 'WMS' as const,
  expectedCapabilities: ['GetCapabilities', 'GetMap', 'GetFeatureInfo'],
  expectedLayers: [],
  requiredFieldGroups: [],
  licence: 'PGI-PIB / CBDG public data terms; source-specific restrictions may apply',
  approval: 'APPROVED' as const
};

export const POLAND_SOURCE_ENDPOINTS: SourceEndpoint[] = [
  {
    ...common,
    id: 'pl-pgi-boreholes-ogc-api',
    logicalSourceId: 'PL_ENGINEERING_BOREHOLES',
    type: 'OGC_API',
    url: 'https://ogcapi.pgi.gov.pl',
    priority: 1,
    evidenceTier: 1,
    compatibilityGroup: 'pl-engineering-boreholes',
    expectedCapabilities: ['collections', 'items'],
    provenance: 'PGI-PIB OGC API borehole feature records'
  },
  {
    ...common,
    id: 'pl-smgp-50k-wms',
    logicalSourceId: 'PL_SMGP_DETAILED_GEOLOGY',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/smgp50k/MapServer/WMSServer',
    priority: 1,
    evidenceTier: 1,
    compatibilityGroup: 'pl-geology-detailed',
    provenance: 'PGI-PIB Detailed Geological Map of Poland (SMGP), 1:50,000'
  },
  {
    ...common,
    id: 'pl-smgp-documentation-points-wms',
    logicalSourceId: 'PL_SMGP_DOCUMENTATION_POINTS',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/smgp_pktdok/MapServer/WMSServer',
    priority: 1,
    evidenceTier: 1,
    compatibilityGroup: 'pl-smgp-documentation-points',
    provenance: 'PGI-PIB SMGP documentation points, including mapped near-surface geological observations and profiles'
  },
  {
    ...common,
    id: 'pl-mlp-50k-wms',
    logicalSourceId: 'PL_MLP_LITHOGENETIC',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/mlp50k/MapServer/WMSServer',
    priority: 1,
    evidenceTier: 1,
    compatibilityGroup: 'pl-lithogenetic-detailed',
    provenance: 'PGI-PIB Lithogenetic Map of Poland (MLP), 1:50,000'
  },
  {
    ...common,
    id: 'pl-mgp-200k-wms',
    logicalSourceId: 'PL_MGP_REGIONAL_GEOLOGY',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/mgp200k_a/MapServer/WMSServer',
    priority: 1,
    evidenceTier: 2,
    compatibilityGroup: 'pl-geology-regional',
    provenance: 'PGI-PIB Geological Map of Poland (MGP), 1:200,000'
  },
  {
    ...common,
    id: 'pl-mgp-500k-2022-wms',
    logicalSourceId: 'PL_MGP_REGIONAL_GEOLOGY',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/mgp500k_2022/MapServer/WMSServer',
    priority: 2,
    evidenceTier: 3,
    compatibilityGroup: 'pl-geology-regional',
    provenance: 'PGI-PIB Geological Map of Poland (2022), 1:500,000'
  },
  {
    ...common,
    id: 'pl-mgp-500k-legacy-wms',
    logicalSourceId: 'PL_MGP_REGIONAL_GEOLOGY',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/mgp500k/MapServer/WMSServer',
    priority: 3,
    evidenceTier: 3,
    compatibilityGroup: 'pl-geology-regional',
    provenance: 'PGI-PIB Geological Map of Poland, 1:500,000 legacy published fallback'
  },
  {
    ...common,
    id: 'pl-engineering-geology-50k-abcd-wms',
    logicalSourceId: 'PL_ENGINEERING_GEOLOGY',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/geoinz/MgiP50k/MapServer/WMSServer',
    priority: 1,
    evidenceTier: 1,
    compatibilityGroup: 'pl-engineering-geology',
    provenance: 'PGI-PIB Engineering Geology Map of Poland, 1:50,000, published A/B/C/D sheets'
  },
  {
    ...common,
    id: 'pl-engineering-geology-50k-wms',
    logicalSourceId: 'PL_ENGINEERING_GEOLOGY',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/geoinz/smgip50k/MapServer/WMSServer',
    priority: 2,
    evidenceTier: 1,
    compatibilityGroup: 'pl-engineering-geology',
    provenance: 'PGI-PIB Engineering Geology Map of Poland, 1:50,000, published A/B fallback'
  },
  {
    ...common,
    id: 'pl-engineering-geology-300k-wms',
    logicalSourceId: 'PL_ENGINEERING_GEOLOGY',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/geoinz/pmgip300k/MapServer/WMSServer',
    priority: 3,
    evidenceTier: 2,
    compatibilityGroup: 'pl-engineering-geology',
    provenance: 'PGI-PIB Engineering Geology Map of Poland, 1:300,000'
  },
  {
    ...common,
    id: 'pl-engineering-geology-500k-wms',
    logicalSourceId: 'PL_ENGINEERING_GEOLOGY',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/geoinz/mgip500k/WMSServer',
    priority: 4,
    evidenceTier: 3,
    compatibilityGroup: 'pl-engineering-geology',
    provenance: 'PGI-PIB Engineering Geology Map of Poland, 1:500,000 published fallback'
  },
  {
    ...common,
    id: 'pl-mgspii-building-ground-wms',
    logicalSourceId: 'PL_MGSP_BUILDING_GROUND',
    url: 'https://emgsp.pgi.gov.pl/mgspIIWarPodlBud/service.svc/get',
    priority: 1,
    evidenceTier: 1,
    compatibilityGroup: 'pl-mgsp-building-ground',
    provenance: 'PGI-PIB Geoenvironmental Map of Poland (MGśP II), building-ground conditions, 1:50,000'
  },
  {
    ...common,
    id: 'pl-mgsp-building-ground-wms',
    logicalSourceId: 'PL_MGSP_BUILDING_GROUND',
    url: 'https://emgsp.pgi.gov.pl/mgspWarPodlBud/service.svc/get',
    priority: 2,
    evidenceTier: 2,
    compatibilityGroup: 'pl-mgsp-building-ground',
    provenance: 'PGI-PIB Geoenvironmental Map of Poland (MGśP), building-ground conditions, 1:50,000 legacy fallback'
  },
  {
    ...common,
    id: 'pl-engineering-boreholes-wms',
    logicalSourceId: 'PL_ENGINEERING_BOREHOLES',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/geoinz/atlas_gi_otwory/MapServer/WMSServer',
    priority: 2,
    evidenceTier: 2,
    compatibilityGroup: 'pl-engineering-boreholes',
    provenance: 'PGI-PIB engineering-geological borehole context'
  },
  {
    ...common,
    id: 'pl-cbdg-boreholes-wms',
    logicalSourceId: 'PL_ENGINEERING_BOREHOLES',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/cbdg_otwory/MapServer/WMSServer',
    priority: 3,
    evidenceTier: 2,
    compatibilityGroup: 'pl-engineering-boreholes',
    provenance: 'PGI-PIB Central Geological Database (CBDG) borehole context'
  },
  {
    ...common,
    id: 'pl-cbdg-research-points-wms',
    logicalSourceId: 'PL_CBDG_RESEARCH_POINTS',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/analizy_pkt_bad/MapServer/WMSServer',
    priority: 1,
    evidenceTier: 2,
    compatibilityGroup: 'pl-cbdg-research-points',
    provenance: 'PGI-PIB Central Geological Database research-point context'
  },
  {
    ...common,
    id: 'pl-engineering-properties-wms',
    logicalSourceId: 'PL_ENGINEERING_PROPERTIES',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/geoinz/geoinz_wfm/MapServer/WMSServer',
    priority: 1,
    evidenceTier: 1,
    compatibilityGroup: 'pl-engineering-properties',
    provenance: 'PGI-PIB physical and mechanical properties of soils and rocks; contextual evidence only'
  },
  {
    ...common,
    id: 'pl-gzwp-wms',
    logicalSourceId: 'PL_HYDROGEOLOGY',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/hydrogeologia/gzwp/MapServer/WMSServer',
    priority: 1,
    evidenceTier: 2,
    compatibilityGroup: 'pl-hydrogeology',
    provenance: 'PGI-PIB Major Groundwater Reservoirs (GZWP)'
  },
  {
    ...common,
    id: 'pl-jcwpd-wms',
    logicalSourceId: 'PL_HYDROGEOLOGY',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/hydrogeologia/jcwpd/MapServer/WMSServer',
    priority: 2,
    evidenceTier: 2,
    compatibilityGroup: 'pl-hydrogeology',
    provenance: 'PGI-PIB groundwater bodies (JCWPd)'
  },
  {
    ...common,
    id: 'pl-groundwater-monitoring-wms',
    logicalSourceId: 'PL_GROUNDWATER_MONITORING',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/hydrogeologia/mwp/MapServer/WMSServer',
    priority: 1,
    evidenceTier: 1,
    compatibilityGroup: 'pl-groundwater-monitoring',
    provenance: 'PGI-PIB groundwater monitoring context; observations are not parcel water-table measurements'
  },
  {
    ...common,
    id: 'pl-sopo-landslides-public-wms',
    logicalSourceId: 'PL_SOPO_LANDSLIDES',
    url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/geozagrozenia/sopo_obszary/MapServer/WMSServer',
    priority: 1,
    evidenceTier: 1,
    compatibilityGroup: 'pl-sopo-landslides',
    licence: 'SOPO public WMS terms; public raster display to 1:25,000, higher-detail resources may be restricted',
    provenance: 'PGI-PIB SOPO public landslide and mass-movement hazard mapping'
  }
];