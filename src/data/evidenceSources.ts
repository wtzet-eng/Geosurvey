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
      id: 'pgi-geolog', title: 'PGI CBDG GeoLOG', provider: 'Państwowy Instytut Geologiczny – PIB', category: 'geology',
      url: 'https://geolog.pgi.gov.pl/', description: 'National geological map viewer and access point for geological, hydrogeological, engineering-geological and geohazard layers.'
    },
    {
      id: 'pgi-smgp-50k', title: 'Detailed Geological Map of Poland (SMGP)', provider: 'PGI-PIB', category: 'geology', scale: '1:50,000',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/smgp50k/MapServer/WMSServer', description: 'Primary detailed surface-geology map series for Poland.'
    },
    {
      id: 'pgi-mlp-50k', title: 'Lithogenetic Map of Poland (MLP)', provider: 'PGI-PIB', category: 'geology', scale: '1:50,000',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/mlp50k/MapServer/WMSServer', description: 'Surface lithology and genesis of deposits.'
    },
    {
      id: 'pgi-mgp-200k', title: 'Geological Map of Poland (MGP)', provider: 'PGI-PIB', category: 'geology', scale: '1:200,000',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/mgp200k_a/MapServer/WMSServer', description: 'Regional geological context.'
    },
    {
      id: 'pgi-engineering-50k', title: 'Engineering Geology Map of Poland', provider: 'PGI-PIB', category: 'engineering', scale: '1:50,000',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/geoinz/smgip50k/MapServer/WMSServer', description: 'Engineering-geological conditions relevant to construction screening.'
    },
    {
      id: 'pgi-engineering-boreholes', title: 'Engineering-geological boreholes', provider: 'PGI-PIB', category: 'boreholes',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/geoinz/atlas_gi_otwory/MapServer/WMSServer', description: 'Engineering-geological borehole map service.'
    },
    {
      id: 'pgi-boreholes', title: 'CBDG boreholes', provider: 'PGI-PIB', category: 'boreholes',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/cbdg_otwory/MapServer/WMSServer', description: 'National borehole database.'
    },
    {
      id: 'pgi-groundwater', title: 'Groundwater bodies and hydrogeology', provider: 'PGI-PIB', category: 'hydrogeology',
      url: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/hydrogeologia/jcwpd/MapServer/WMSServer', description: 'Groundwater-body information and hydrogeological context.'
    },
    {
      id: 'pgi-landslides', title: 'SOPO landslides and susceptible areas', provider: 'PGI-PIB', category: 'hazards',
      url: 'https://osuwiska.pgi.gov.pl/', description: 'Official Polish landslide and mass-movement information.'
    },
    {
      id: 'gugik-uldk', title: 'GUGiK ULDK / EGiB', provider: 'GUGiK', category: 'planning',
      url: 'https://uldk.gugik.gov.pl/', description: 'Official cadastral parcel identification and geometry service.'
    },
    {
      id: 'wody-polskie-isok', title: 'ISOK flood hazard information', provider: 'PGW Wody Polskie', category: 'hazards',
      url: 'https://wody.isok.gov.pl/', description: 'Official Polish flood-hazard and flood-risk information.'
    }
  ],
  GB: [
    {
      id: 'bgs-geoindex', title: 'BGS GeoIndex Onshore', provider: 'British Geological Survey', category: 'geology', scale: '1:50,000',
      url: 'https://mapapps2.bgs.ac.uk/geoindex/home.html', description: 'National geological map and geoscience index for Great Britain, including bedrock and superficial geology.'
    },
    {
      id: 'bgs-geosure', title: 'BGS GeoSure Ground Stability', provider: 'British Geological Survey', category: 'hazards',
      url: 'https://www.bgs.ac.uk/geological-hazards/geosure/', description: 'BGS national ground-stability datasets covering hazards such as shrink-swell and landslide susceptibility.'
    },
    {
      id: 'bgs-boreholes', title: 'BGS National Borehole Records', provider: 'British Geological Survey', category: 'boreholes',
      url: 'https://www.bgs.ac.uk/geological-hazards/national-borehole-archive/', description: 'National archive and index of borehole records held by the British Geological Survey.'
    },
    {
      id: 'bgs-opengeoscience', title: 'BGS OpenGeoscience', provider: 'British Geological Survey', category: 'geology',
      url: 'https://www.bgs.ac.uk/opengeoscience/', description: 'BGS open geological datasets and web services.'
    },
    {
      id: 'environment-agency-flood-map', title: 'Flood Map for Planning', provider: 'Environment Agency', category: 'hazards',
      url: 'https://flood-map-for-planning.service.gov.uk/', description: 'Official planning flood-risk information for England, including flood zones used in planning decisions.'
    },
    {
      id: 'environment-agency-long-term-flood-risk', title: 'Long-term flood risk', provider: 'Environment Agency', category: 'hazards',
      url: 'https://check-long-term-flood-risk.service.gov.uk/', description: 'Official long-term flood-risk information for England.'
    },
    {
      id: 'natural-resources-wales-flood', title: 'Flood risk and hazard maps', provider: 'Natural Resources Wales', category: 'hazards',
      url: 'https://naturalresources.wales/flooding/', description: 'Official Welsh flood-risk information and mapping.'
    },
    {
      id: 'hm-land-registry-ppd', title: 'Price Paid Data', provider: 'HM Land Registry', category: 'planning',
      url: 'https://www.gov.uk/government/collections/price-paid-data', description: 'Official residential property transaction data for England and Wales.'
    },
    {
      id: 'gov-planning', title: 'Planning Practice Guidance', provider: 'UK Government', category: 'planning',
      url: 'https://www.gov.uk/government/collections/planning-practice-guidance', description: 'National planning policy guidance relevant to development screening in England.'
    }
  ],
  DE: [
    { id: 'bgr-geoviewer', title: 'BGR Geoportal / Geoviewer', provider: 'Bundesanstalt für Geowissenschaften und Rohstoffe (BGR)', category: 'geology', url: 'https://www.bgr.bund.de/DE/Themen/Geoinformationen/Geoviewer/geoviewer_node.html', description: 'Federal geological and geoscientific map services.' },
    { id: 'bgr-boreholes', title: 'BGR / German borehole information', provider: 'BGR and State Geological Surveys', category: 'boreholes', url: 'https://www.bgr.bund.de/DE/Themen/Geodaten/INSPIRE/inspire_node.html', description: 'INSPIRE and geological data services including borehole information.' },
    { id: 'inspire-de', title: 'German INSPIRE geoscience services', provider: 'BGR / German geological services', category: 'geology', url: 'https://www.bgr.bund.de/DE/Themen/Geodaten/INSPIRE/inspire_node.html', description: 'Standards-based geoscience services and discovery.' }
  ],
  FR: [
    { id: 'brgm-infoterre', title: 'BRGM InfoTerre', provider: 'BRGM', category: 'geology', url: 'https://infoterre.brgm.fr/', description: 'National French geological and geoscientific portal.' },
    { id: 'brgm-bss', title: 'BSS boreholes', provider: 'BRGM', category: 'boreholes', url: 'https://infoterre.brgm.fr/page/bss', description: 'French national subsurface and borehole database.' },
    { id: 'brgm-ogc', title: 'BRGM OGC services', provider: 'BRGM', category: 'geology', url: 'https://infoterre.brgm.fr/page/geoservices-ogc', description: 'Standards-based geological services.' }
  ]
};

export function getEvidenceSources(countryCode?: string): EvidenceSourceLink[] {
  const code = (countryCode || 'EU').toUpperCase();
  return EVIDENCE_SOURCES[code] || EVIDENCE_SOURCES.EU || [];
}
