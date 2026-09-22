/** Croatia evidence catalogue: official sources identified for the first full-stack country implementation. */
export type CroatiaEvidenceStatus = 'LIVE_VERIFIED' | 'DOCUMENTED' | 'NOT_YET_INTEGRATED';

export interface CroatiaEvidenceLayer {
  id: string;
  category: string;
  dataset: string;
  provider: string;
  serviceUrl: string;
  serviceType: 'WFS' | 'WMS' | 'ATOM' | 'PORTAL';
  status: CroatiaEvidenceStatus;
  dueDiligenceUse: string;
  limitation?: string;
}

export const CROATIA_EVIDENCE_LAYERS: CroatiaEvidenceLayer[] = [
  { id: 'hr-cadastre-parcels', category: 'Cadastre', dataset: 'Cadastral parcels and cadastral municipalities INSPIRE', provider: 'State Geodetic Administration (DGU)', serviceUrl: 'https://api.uredjenazemlja.hr/services/inspire/cp/wfs', serviceType: 'WFS', status: 'LIVE_VERIFIED', dueDiligenceUse: 'Official parcel geometry, cadastral parcel and cadastral municipality evidence.' },
  { id: 'hr-buildings-cadastre', category: 'Buildings', dataset: 'Buildings from Digital Cadastral Map INSPIRE', provider: 'State Geodetic Administration (DGU)', serviceUrl: 'https://api.uredjenazemlja.hr/services/inspire/bu/wfs', serviceType: 'WFS', status: 'DOCUMENTED', dueDiligenceUse: 'Mapped buildings and structures associated with cadastral evidence.' },
  { id: 'hr-addresses', category: 'Address', dataset: 'INSPIRE Addresses', provider: 'State Geodetic Administration (DGU)', serviceUrl: 'https://geoportal.dgu.hr/services/atom/ad/xml', serviceType: 'ATOM', status: 'DOCUMENTED', dueDiligenceUse: 'Address-to-location context and cross-checking the selected site.' },
  { id: 'hr-orthophoto-2025-26', category: 'Aerial imagery', dataset: 'Digital orthophoto 2025/26', provider: 'State Geodetic Administration (DGU)', serviceUrl: 'https://geoportal.dgu.hr/services/inspire/orthophoto_2025_2026/wms', serviceType: 'WMS', status: 'DOCUMENTED', dueDiligenceUse: 'Recent visual evidence for buildings, access, land use and surrounding conditions.' },
  { id: 'hr-elevation', category: 'Terrain', dataset: 'INSPIRE Elevation / Digital Terrain Model', provider: 'State Geodetic Administration (DGU)', serviceUrl: 'https://geoportal.dgu.hr/services/atom/el-cov/xml', serviceType: 'ATOM', status: 'DOCUMENTED', dueDiligenceUse: 'Elevation, slope and terrain screening.' },
  { id: 'hr-protected-areas', category: 'Protected areas', dataset: 'Protected areas of the Republic of Croatia - INSPIRE', provider: 'Republic of Croatia public-sector data catalogue', serviceUrl: 'https://data.gov.hr/ckan/en/dataset/zatiena-podruja-republike-hrvatske-inspire', serviceType: 'PORTAL', status: 'DOCUMENTED', dueDiligenceUse: 'Protected-area overlap and environmental constraints.' },
  { id: 'hr-natura2000', category: 'Protected areas', dataset: 'Natura 2000 ecological network of the Republic of Croatia - INSPIRE', provider: 'Republic of Croatia public-sector data catalogue', serviceUrl: 'https://data.gov.hr/ckan/en/dataset/ekoloka-mrea-natura-2000-republike-hrvatske-inspire', serviceType: 'PORTAL', status: 'DOCUMENTED', dueDiligenceUse: 'Natura 2000 screening and conservation constraints.' },
  { id: 'hr-contamination', category: 'Contamination', dataset: 'Environmental Pollution Register - INSPIRE', provider: 'Republic of Croatia public-sector data catalogue', serviceUrl: 'https://data.gov.hr/ckan/en/dataset/registar-oneiavanja-okolia-inspire', serviceType: 'PORTAL', status: 'DOCUMENTED', dueDiligenceUse: 'Potential pollution sources, releases, transfers and waste disposal near the site.', limitation: 'A register hit is evidence requiring interpretation; absence of a hit is not proof that land is uncontaminated.' },
  { id: 'hr-planning', category: 'Planning', dataset: 'Physical Planning Information System (ISPU)', provider: 'Ministry of Physical Planning, Construction and State Assets', serviceUrl: 'https://portal-ispu.gov.hr/en/', serviceType: 'PORTAL', status: 'DOCUMENTED', dueDiligenceUse: 'Spatial plans, permits, planning conditions and location information.' },
  { id: 'hr-land-use', category: 'Land use', dataset: 'INSPIRE land use / land cover services', provider: 'State Geodetic Administration (DGU)', serviceUrl: 'https://geoportal.dgu.hr/cms/en/data-and-services/', serviceType: 'PORTAL', status: 'DOCUMENTED', dueDiligenceUse: 'Recorded land-use and land-cover context; useful alongside cadastral and planning evidence.' },
  { id: 'hr-flood-hazard-2019', category: 'Flood hazard', dataset: 'Flood Hazard Maps 2019 - WMS', provider: 'Hrvatske vode', serviceUrl: 'https://servisi.voda.hr/poplave_opasnosti_2019/wms', serviceType: 'WMS', status: 'LIVE_VERIFIED', dueDiligenceUse: 'Official flood-hazard screening for high-, medium- and low-probability scenarios at the selected coordinate.', limitation: 'The maps do not represent every possible flooding mechanism and are screening evidence, not a site-specific flood-risk assessment.' },
  { id: 'hr-geology-300k-inspire', category: 'Geology', dataset: 'Geological Map of Croatia 1:300,000 - INSPIRE WFS', provider: 'Croatian Geological Survey (Hrvatski geološki institut)', serviceUrl: 'https://transformiraj.nipp.hr/ows/services/org.2.abf7ddc6-7578-4070-a9db-c291a42e55c6_wfs', serviceType: 'WFS', status: 'LIVE_VERIFIED', dueDiligenceUse: 'Regional mapped geological, lithological and geochronological context at the selected coordinate.', limitation: 'This 1:300,000 layer is regional screening evidence. More detailed HGI geological series exist but are not yet automated by this integration.' },
  { id: 'hr-hydrography', category: 'Hydrology', dataset: 'INSPIRE Hydrography', provider: 'State Geodetic Administration (DGU)', serviceUrl: 'https://geoportal.dgu.hr/cms/en/data-and-services/', serviceType: 'PORTAL', status: 'DOCUMENTED', dueDiligenceUse: 'Nearby rivers, water bodies and hydrographic context.' },
  { id: 'hr-brownfields', category: 'Previous land use', dataset: 'Brownfields Area Register', provider: 'Ministry of Physical Planning, Construction and State Assets', serviceUrl: 'https://portal-ispu.gov.hr/en/e-services', serviceType: 'PORTAL', status: 'DOCUMENTED', dueDiligenceUse: 'Potentially useful indicator of previously developed or underused sites.' }
];

export function getCroatiaEvidenceLayers(): CroatiaEvidenceLayer[] {
  return CROATIA_EVIDENCE_LAYERS;
}
