import type { EvidenceItem } from '../types';

const SOURCE_NAME = 'Northern Ireland Land Registry / Land & Property Services';
const SOURCE_URL = 'https://www.finance-ni.gov.uk/articles/land-registry-map';
const LANDWEB_URL = 'https://www.finance-ni.gov.uk/articles/landweb-direct-access';

export function getNorthernIrelandLandRegistryEvidence(): EvidenceItem[] {
  return [{
    id: 'ni-land-registry-map-context',
    category: 'Cadastre & identification',
    claim: 'Northern Ireland uses the Land Registry map and folio system to identify registered holdings; the selected site should be checked against the Land Registry map and relevant folio.',
    status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    datasetDate: new Date().toISOString().slice(0, 10),
    spatialRelationship: 'Selected site in Northern Ireland',
    calculationMethod: 'Jurisdiction-specific Land Registry source identification',
    confidence: 'Medium',
    value: { landRegistryMapUrl: SOURCE_URL, landWebUrl: LANDWEB_URL },
    limitation: 'The Northern Ireland Land Registry map is a location reference and does not guarantee boundaries. The official guidance states that the registered holding and boundary extent must be checked through the relevant registry map, folio and title documents. Automated public parcel geometry is not treated as available here.'
  }];
}
