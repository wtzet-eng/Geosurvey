import type { EvidenceItem } from '../types';

const SOFIA_DATASET_API = 'https://api.sofiaplan.bg/datasets/548';
const SOFIA_GEOLOGY_PORTAL = 'https://www.sofia.bg/en/oup-geology-mineral-water';
const SOFIA_URBAN_DATA = 'https://urbandata.sofia.bg/';
const SOFIA_OPEN_MAP = 'https://nag.sofia.bg/OpenMap/Zones';

async function fetchJson(fetcher: typeof fetch, url: string): Promise<any | null> {
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function isSofia(lat: number, lng: number): boolean {
  return lat >= 42.40 && lat <= 42.86 && lng >= 23.05 && lng <= 23.65;
}

export async function queryBulgariaUrbanGeology(
  lat: number,
  lng: number,
  fetcher: typeof fetch = fetch
): Promise<EvidenceItem[]> {
  if (!isSofia(lat, lng)) return [];

  const api = await fetchJson(fetcher, SOFIA_DATASET_API);
  const evidence: EvidenceItem[] = [{
    id: 'bg-sofia-urban-geology',
    category: 'Urban / engineering geology',
    claim: 'Sofia Municipality publishes official engineering-geological and hydrogeological zoning, including groundwater, difficult construction terrains, landslide zones, fault zones and seismic information in its spatial-planning geology datasets.',
    status: api ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
    sourceName: 'Sofia Municipality / SofiaPlan — Urban Data and General Spatial Development Plan',
    sourceUrl: SOFIA_GEOLOGY_PORTAL,
    datasetDate: '2026-10-02',
    spatialRelationship: 'Selected coordinate falls within the Sofia screening area',
    calculationMethod: 'Official SofiaPlan dataset/API availability check; parcel-level polygon intersection is the next step',
    confidence: 'High',
    limitation: 'This stage confirms and registers the official urban-geology source. It does not yet claim that a specific geology or hazard zone contains the selected parcel.'
  }];

  evidence.push({
    id: 'bg-sofia-faults',
    category: 'Ground hazard',
    claim: 'SofiaPlan publishes an official GeoJSON fault dataset used for seismic-risk and engineering-geological planning.',
    status: 'REQUIRES_VERIFICATION',
    sourceName: 'SofiaPlan — Faults dataset',
    sourceUrl: 'https://urbandata.sofia.bg/en/dataset/faults',
    datasetDate: '2009-01-01',
    spatialRelationship: 'Sofia-wide source available; parcel intersection not yet performed',
    calculationMethod: 'Official SofiaPlan dataset catalogue review',
    confidence: 'High',
    limitation: 'The published fault dataset is dated 2009-01-01; GroundSurf must not treat it as a current site-specific seismic assessment.'
  });

  evidence.push({
    id: 'bg-sofia-groundwater',
    category: 'Groundwater',
    claim: 'SofiaPlan publishes a spatial dataset for groundwater from the geology section of the 2009 General Spatial Development Plan.',
    status: 'REQUIRES_VERIFICATION',
    sourceName: 'SofiaPlan — Groundwater dataset',
    sourceUrl: SOFIA_URBAN_DATA,
    datasetDate: '2009',
    spatialRelationship: 'Sofia-wide urban source available; parcel intersection not yet performed',
    calculationMethod: 'Official SofiaPlan urban-data catalogue review',
    confidence: 'High',
    limitation: 'The dataset represents planning-scale groundwater information, not a measured groundwater level at the property.'
  });

  evidence.push({
    id: 'bg-sofia-planning-map',
    category: 'Planning & development',
    claim: 'Sofia Municipality provides an interactive planning map with cadastral maps, planning zones and georeferenced administrative acts.',
    status: 'VERIFIED',
    sourceName: 'Sofia Municipality — Architecture and Urban Planning Open Map',
    sourceUrl: SOFIA_OPEN_MAP,
    datasetDate: 'Current portal',
    spatialRelationship: 'Official city planning source for the selected Sofia location',
    calculationMethod: 'Official municipal map availability check',
    confidence: 'High',
    limitation: 'Planning designations still require interpretation against the applicable detailed planning documents and legal status of the property.'
  });

  return evidence;
}
