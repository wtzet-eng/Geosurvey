export interface EvidenceSourceLink {
  id: string;
  title: string;
  provider: string;
  category: 'geology' | 'engineering' | 'boreholes' | 'hydrogeology' | 'hazards' | 'environment' | 'planning';
  scale?: string;
  url: string;
  description: string;
}

export const EVIDENCE_SOURCES: Record<string, EvidenceSourceLink[]> = {
  PL: [
    {
      id: 'pgi-geolog',
      title: 'PGI CBDG GeoLOG',
      provider: 'Państwowy Instytut Geologiczny – PIB',
      category: 'geology',
      url: 'https://geolog.pgi.gov.pl/',
      description: 'National geological map viewer and access point for geological, hydrogeological, engineering-geological and geohazard layers.'
    },
    {
      id: 'pgi-smgp-50k',
      title: 'Detailed Geological Map of Poland (SMGP)',
      provider: 'PGI-PIB',
      category: 'geology',
      scale: '1:50,000',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/smgp50k/MapServer/WMSServer',
      description: 'Primary detailed surface-geology map series for Poland.'
    },
    {
      id: 'pgi-mlp-50k',
      title: 'Lithogenetic Map of Poland (MLP)',
      provider: 'PGI-PIB',
      category: 'geology',
      scale: '1:50,000',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/mlp50k/MapServer/WMSServer',
      description: 'Surface lithology and genesis of deposits, derived from the detailed geological mapping framework.'
    },
    {
      id: 'pgi-mgp-200k',
      title: 'Geological Map of Poland (MGP)',
      provider: 'PGI-PIB',
      category: 'geology',
      scale: '1:200,000',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/mgp200k_a/MapServer/WMSServer',
      description: 'Regional geological context and cross-border correlation.'
    },
    {
      id: 'pgi-engineering-50k',
      title: 'Engineering Geology Map of Poland',
      provider: 'PGI-PIB',
      category: 'engineering',
      scale: '1:50,000',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/geoinz/smgip50k/MapServer/WMSServer',
      description: 'Engineering-geological conditions relevant to construction screening.'
    },
    {
      id: 'pgi-engineering-boreholes',
      title: 'Engineering-geological boreholes',
      provider: 'PGI-PIB',
      category: 'boreholes',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/geoinz/atlas_gi_otwory/MapServer/WMSServer',
      description: 'Map service for engineering-geological boreholes.'
    },
    {
      id: 'pgi-boreholes',
      title: 'CBDG boreholes',
      provider: 'PGI-PIB',
      category: 'boreholes',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/cbdg_otwory/MapServer/WMSServer',
      description: 'National borehole database covering drillings from the nineteenth century to the present.'
    },
    {
      id: 'pgi-soil-properties',
      title: 'Physical and mechanical properties of soils and rocks',
      provider: 'PGI-PIB',
      category: 'engineering',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/geoinz/geoinz_wfm/MapServer/WMSServer',
      description: 'Engineering-geological physical and mechanical property data.'
    },
    {
      id: 'pgi-groundwater',
      title: 'Groundwater bodies and hydrogeology',
      provider: 'PGI-PIB',
      category: 'hydrogeology',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/hydrogeologia/jcwpd/MapServer/WMSServer',
      description: 'Groundwater-body information and hydrogeological context.'
    },
    {
      id: 'pgi-gzwp',
      title: 'Major Groundwater Reservoirs (GZWP)',
      provider: 'PGI-PIB',
      category: 'hydrogeology',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/hydrogeologia/gzwp/MapServer/WMSServer',
      description: 'National major groundwater reservoir mapping.'
    },
    {
      id: 'pgi-landslides',
      title: 'SOPO landslides and susceptible areas',
      provider: 'PGI-PIB',
      category: 'hazards',
      url: 'https://osuwiska.pgi.gov.pl/',
      description: 'Official Polish landslide and mass-movement information.'
    },
    {
      id: 'pgi-midas',
      title: 'MIDAS mineral resources and mining',
      provider: 'PGI-PIB',
      category: 'hazards',
      url: 'https://midas.pgi.gov.pl/',
      description: 'Mineral deposits, mining areas and related geological information.'
    },
    {
      id: 'pgi-environmental',
      title: 'Geoenvironmental Map of Poland',
      provider: 'PGI-PIB',
      category: 'environment',
      scale: '1:50,000',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/mgsp50k_skorowidz/MapServer/WMSServer',
      description: 'Geoenvironmental mapping including protected areas, resources and anthropogenic constraints.'
    },
    {
      id: 'gugik-uldk',
      title: 'GUGiK ULDK / EGiB',
      provider: 'GUGiK',
      category: 'planning',
      url: 'https://uldk.gugik.gov.pl/',
      description: 'Official cadastral parcel identification and geometry service used by GeoSurvey.'
    },
    {
      id: 'wody-polskie-isok',
      title: 'ISOK flood hazard information',
      provider: 'PGW Wody Polskie',
      category: 'hazards',
      url: 'https://wody.isok.gov.pl/',
      description: 'Official Polish flood-hazard and flood-risk information.'
    }
  ],
  DE: [
    {
      id: 'bgr-geoviewer',
      title: 'BGR Geoportal / Geoviewer',
      provider: 'Bundesanstalt für Geowissenschaften und Rohstoffe (BGR)',
      category: 'geology',
      url: 'https://www.bgr.bund.de/DE/Themen/Geoinformationen/Geoviewer/geoviewer_node.html',
      description: 'Federal geological and geoscientific map services.'
    },
    {
      id: 'bgr-boreholes',
      title: 'BGR / German borehole information',
      provider: 'BGR and State Geological Surveys',
      category: 'boreholes',
      url: 'https://www.bgr.bund.de/DE/Themen/Geodaten/INSPIRE/inspire_node.html',
      description: 'INSPIRE and geological data services including borehole information.'
    },
    {
      id: 'inspire-de',
      title: 'German INSPIRE geoscience services',
      provider: 'BGR / German geological services',
      category: 'geology',
      url: 'https://www.bgr.bund.de/DE/Themen/Geodaten/INSPIRE/inspire_node.html',
      description: 'Standards-based geoscience services and discovery.'
    }
  ],
  FR: [
    {
      id: 'brgm-infoterre',
      title: 'BRGM InfoTerre',
      provider: 'BRGM',
      category: 'geology',
      url: 'https://infoterre.brgm.fr/',
      description: 'National French geological and geoscientific portal.'
    },
    {
      id: 'brgm-bss',
      title: 'BSS boreholes',
      provider: 'BRGM',
      category: 'boreholes',
      url: 'https://infoterre.brgm.fr/page/bss',
      description: 'French national subsurface and borehole database.'
    },
    {
      id: 'brgm-ogc',
      title: 'BRGM OGC services',
      provider: 'BRGM',
      category: 'geology',
      url: 'https://infoterre.brgm.fr/page/geoservices-ogc',
      description: 'WMS/WFS and other standards-based geological services.'
    }
  ],
  GB: [
    {
      id: 'bgs-geoindex-onshore',
      title: 'BGS GeoIndex Onshore',
      provider: 'British Geological Survey',
      category: 'geology',
      scale: '1:50,000',
      url: 'https://mapapps2.bgs.ac.uk/geoindex/home.html',
      description: 'UK onshore geological map viewer for bedrock, superficial deposits, boreholes and related BGS datasets.'
    },
    {
      id: 'bgs-geology-wms',
      title: 'BGS geology web map services',
      provider: 'British Geological Survey',
      category: 'geology',
      scale: '1:50,000 / 1:625,000',
      url: 'https://www.bgs.ac.uk/technologies/web-map-services-wms/',
      description: 'OGC WMS services for BGS geology layers, including bedrock and superficial geology where licensed/available.'
    },
    {
      id: 'bgs-geosure',
      title: 'BGS GeoSure ground stability',
      provider: 'British Geological Survey',
      category: 'hazards',
      url: 'https://www.bgs.ac.uk/datasets/geosure/',
      description: 'Ground-stability hazard datasets covering shrink-swell, landslide, dissolution, compressible and collapsible ground indicators.'
    },
    {
      id: 'bgs-borehole-records',
      title: 'BGS borehole records',
      provider: 'British Geological Survey',
      category: 'boreholes',
      url: 'https://www.bgs.ac.uk/information-hub/borehole-records/',
      description: 'National Geological Repository index for UK borehole and site investigation records.'
    },
    {
      id: 'hm-land-registry-inspire',
      title: 'HM Land Registry INSPIRE Index Polygons',
      provider: 'HM Land Registry',
      category: 'planning',
      url: 'https://use-land-property-data.service.gov.uk/datasets/inspire',
      description: 'Indicative registered freehold property extents for England and Wales; useful for parcel-screening context, not legal boundary proof.'
    },
    {
      id: 'ea-flood-map-planning',
      title: 'Environment Agency Flood Map for Planning',
      provider: 'Environment Agency',
      category: 'hazards',
      url: 'https://environment.data.gov.uk/dataset/04532375-a198-476e-985e-0579a0a11b47',
      description: 'Flood Zones 2 and 3 planning dataset for river and sea flood-risk screening in England.'
    },
    {
      id: 'ea-flood-monitoring-api',
      title: 'Environment Agency flood-monitoring API',
      provider: 'Environment Agency',
      category: 'hydrogeology',
      url: 'https://www.api.gov.uk/ea/flood-monitoring/',
      description: 'Near-real-time flood warnings, flood areas, levels, flows and monitoring-station information.'
    },
    {
      id: 'hm-land-registry-ppd',
      title: 'HM Land Registry Price Paid Data',
      provider: 'HM Land Registry',
      category: 'planning',
      url: 'https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads',
      description: 'Open transaction-price dataset used for market-context checks; it does not replace a RICS valuation.'
    },
    {
      id: 'planning-data-gov-uk',
      title: 'Planning Data for England',
      provider: 'Department for Levelling Up, Housing and Communities',
      category: 'planning',
      url: 'https://www.planning.data.gov.uk/',
      description: 'Open planning and development-control datasets for England where available from local planning authorities.'
    }
  ],
  EU: [
    {
      id: 'egdi-europe-geology',
      title: 'European Geological Data Infrastructure',
      provider: 'EuroGeoSurveys',
      category: 'geology',
      url: 'https://www.europe-geology.eu',
      description: 'Pan-European geological data discovery and map services for countries without a dedicated GeoSurvey source list.'
    },
    {
      id: 'soilgrids-global',
      title: 'SoilGrids 2.0',
      provider: 'ISRIC – World Soil Information',
      category: 'engineering',
      url: 'https://soilgrids.org/',
      description: 'Global modelled soil properties used for preliminary soil texture and engineering-screening indicators.'
    },
    {
      id: 'copernicus-dem',
      title: 'Copernicus DEM',
      provider: 'European Space Agency / Copernicus',
      category: 'environment',
      url: 'https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM',
      description: 'European/global digital elevation data supporting slope, elevation and terrain analysis.'
    },
    {
      id: 'eea-natura2000',
      title: 'Natura 2000 data',
      provider: 'European Environment Agency',
      category: 'environment',
      url: 'https://www.eea.europa.eu/en/datahub/datahubitem-view/6fc8ad2d-195d-40f4-bdec-576e7d1268e4',
      description: 'European protected-area dataset for environmental screening.'
    },
    {
      id: 'osm-overpass',
      title: 'OpenStreetMap Overpass API',
      provider: 'OpenStreetMap community',
      category: 'planning',
      url: 'https://overpass-turbo.eu/',
      description: 'Open vector map data used for road, land-use, amenity and utility-proximity context.'
    }
  ],
};

export function getEvidenceSources(countryCode?: string): EvidenceSourceLink[] {
  return EVIDENCE_SOURCES[(countryCode || 'EU').toUpperCase()] || EVIDENCE_SOURCES.EU;
}
