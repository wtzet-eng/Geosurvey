import type { EvidenceItem } from '../types';

export const ALBANIA_ASIG_WMS = 'https://geoportal.asig.gov.al/service/wms';
export const ALBANIA_ASIG_WMTS = 'https://geoportal.asig.gov.al/service/wmts?request=getCapabilities';
export const ALBANIA_PORTAL = 'https://geoportal.asig.gov.al/map/';
export const ALBANIA_SERVICES = 'https://geoportal.asig.gov.al/en/services?category=cadastral%20parcels';

export interface AlbaniaGroundEvidenceResult {
  evidence: EvidenceItem[];
  sourceUrl: string;
  limitation: string;
}

export function albaniaGroundEvidence(): AlbaniaGroundEvidenceResult {
  const today = new Date().toISOString().slice(0, 10);
  const limitation = 'ASIG provides official national geospatial layers, but a mapped regional or thematic layer is not a parcel-scale engineering investigation. GroundSurf should not infer site-specific construction conditions without the relevant local investigation.';
  const evidence: EvidenceItem[] = [
    {
      id: 'al-asig-cadastre',
      category: 'Cadastre & Identification',
      claim: 'Albania publishes official cadastral parcel and cadastral-building layers through the ASIG National Geoportal, including areas updated through the Albanian Cadastre Agency multifunctional system.',
      status: 'REQUIRES_VERIFICATION',
      sourceName: 'ASIG National Geoportal / State Cadastre Agency',
      sourceUrl: ALBANIA_SERVICES,
      datasetDate: today,
      spatialRelationship: 'Official national cadastral layer available for map verification',
      calculationMethod: 'ASIG National Geoportal cadastral-layer review',
      confidence: 'High',
      limitation: 'The current public integration provides the official map layer but does not yet claim automated parcel-ID extraction from an ASIG feature-query endpoint.'
    },
    {
      id: 'al-asig-geology',
      category: 'Mapped geology',
      claim: 'ASIG publishes national geological mapping including 1:100,000 and 1:200,000 geological maps and thematic geology layers covering Albania.',
      status: 'REQUIRES_VERIFICATION',
      sourceName: 'ASIG National Geoportal / Albanian geological data',
      sourceUrl: 'https://geoportal.asig.gov.al/en/services',
      datasetDate: today,
      spatialRelationship: 'National geological source available for map verification',
      calculationMethod: 'Official ASIG service catalogue review',
      confidence: 'High',
      limitation
    },
    {
      id: 'al-asig-engineering-geology',
      category: 'Urban / engineering geology',
      claim: 'ASIG publishes engineering-geological thematic maps for all 12 Albanian counties, derived from the 1:100,000 geological mapping framework.',
      status: 'REQUIRES_VERIFICATION',
      sourceName: 'ASIG National Geoportal — Engineering Geology',
      sourceUrl: 'https://geoportal.asig.gov.al/en/services',
      datasetDate: today,
      spatialRelationship: 'County-scale engineering-geology source available',
      calculationMethod: 'Official ASIG service catalogue review',
      confidence: 'High',
      limitation: 'County-scale engineering-geological mapping is screening evidence; local boreholes and site investigation are still required for design.'
    },
    {
      id: 'al-asig-hydrogeology',
      category: 'Groundwater & Hydrogeology',
      claim: 'ASIG publishes hydrogeological thematic maps as part of Albania’s national geological information.',
      status: 'REQUIRES_VERIFICATION',
      sourceName: 'ASIG National Geoportal — Hydrogeology',
      sourceUrl: 'https://geoportal.asig.gov.al/en/services',
      datasetDate: today,
      spatialRelationship: 'National hydrogeological source available',
      calculationMethod: 'Official ASIG service catalogue review',
      confidence: 'High',
      limitation
    },
    {
      id: 'al-asig-geological-hazard',
      category: 'Ground hazards',
      claim: 'ASIG publishes geological-hazard thematic maps as well as natural-risk-zone information, providing an official starting point for landslide, geological and other natural-hazard screening.',
      status: 'REQUIRES_VERIFICATION',
      sourceName: 'ASIG National Geoportal — Geological and Natural Risk Maps',
      sourceUrl: 'https://geoportal.asig.gov.al/en/services',
      datasetDate: today,
      spatialRelationship: 'National hazard layers available',
      calculationMethod: 'Official ASIG service catalogue review',
      confidence: 'High',
      limitation: 'Hazard-map presence does not establish that a particular parcel is safe or unsafe; the relevant mapped hazard layer must be checked against the site.'
    },
    {
      id: 'al-asig-flood-risk',
      category: 'Flood risk',
      claim: 'Albania publishes flood-risk maps for the six main river basins, including risk information by return period, depth and flow velocity.',
      status: 'REQUIRES_VERIFICATION',
      sourceName: 'ASIG / Water Resources Management Agency — Flood Risk Maps',
      sourceUrl: 'https://geoportal.asig.gov.al/en/node/1696',
      datasetDate: today,
      spatialRelationship: 'National river-basin flood-risk source available',
      calculationMethod: 'Official ASIG natural-risk-zone publication review',
      confidence: 'High',
      limitation: 'Flood mapping is regional risk evidence; parcel-scale drainage, finished levels and site-specific flood assessment may still be necessary.'
    },
    {
      id: 'al-asig-soil-landuse',
      category: 'Soil & Land Use',
      claim: 'The ASIG National Geoportal includes Pedology, Land Cover and Land Use themes, alongside elevation and hydrography.',
      status: 'REQUIRES_VERIFICATION',
      sourceName: 'ASIG National Geoportal',
      sourceUrl: ALBANIA_PORTAL,
      datasetDate: today,
      spatialRelationship: 'National soil and land-use themes available',
      calculationMethod: 'Official ASIG geoportal theme catalogue review',
      confidence: 'High',
      limitation
    }
  ];
  return { evidence, sourceUrl: ALBANIA_PORTAL, limitation };
}
