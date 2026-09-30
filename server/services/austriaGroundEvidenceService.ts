import type { EvidenceItem } from '../types';

const GEOLOGY_WMS = 'https://gis.geologie.ac.at/geoserver/ge_einheiten/wms';
const SOURCE_NAME = 'GeoSphere Austria — Geological Units 1:50,000';
const SOURCE_URL = 'https://gis.geologie.ac.at/maps.html';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type FeatureInfo = {
  description?: string;
  name?: string;
  lithology?: string;
  representativeLithology?: string;
  olderNamedAge?: string;
  youngerNamedAge?: string;
  eventEnvironment?: string;
  eventProcess?: string;
};

async function queryLayer(lat: number, lng: number, layer: string): Promise<FeatureInfo | null> {
  const delta = 0.002;
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetFeatureInfo',
    CRS: 'EPSG:4326',
    BBOX: `${lat - delta},${lng - delta},${lat + delta},${lng + delta}`,
    WIDTH: '101',
    HEIGHT: '101',
    I: '50',
    J: '50',
    LAYERS: layer,
    QUERY_LAYERS: layer,
    STYLES: '',
    FORMAT: 'image/png',
    INFO_FORMAT: 'application/json',
    FEATURE_COUNT: '1'
  });
  const response = await fetch(`${GEOLOGY_WMS}?${params.toString()}`, {
    headers: { 'User-Agent': 'GroundSurf/1.0 Austria geological evidence' }
  });
  if (!response.ok) throw new Error('GeoSphere Austria WMS HTTP ' + response.status);
  const json = await response.json();
  const feature = Array.isArray(json?.features) ? json.features[0] : null;
  return feature?.properties || null;
}

export interface AustriaGroundEvidenceResult {
  evidence: EvidenceItem[];
  geologyFound: boolean;
}

export async function queryAustriaGroundEvidence(lat: number, lng: number): Promise<AustriaGroundEvidenceResult> {
  try {
    const lithology = await queryLayer(lat, lng, 'GE.GeologicUnit.50k.Lithology');
    const age = await queryLayer(lat, lng, 'GE.GeologicUnit.50k.AgeOfRocks');
    if (!lithology && !age) {
      return {
        geologyFound: false,
        evidence: [{
          id: 'at-geosphere-geology-site',
          category: 'Geology & ground',
          claim: 'GeoSphere Austria returned no 1:50,000 geological-unit feature at the selected coordinate.',
          status: 'REQUIRES_VERIFICATION',
          sourceName: SOURCE_NAME,
          sourceUrl: SOURCE_URL,
          datasetDate: today(),
          spatialRelationship: 'Selected site centre',
          calculationMethod: 'GeoSphere Austria INSPIRE WMS GetFeatureInfo against 1:50,000 geological-unit layers',
          confidence: 'Low',
          limitation: 'A missing mapped feature is not evidence that the site has no geological information. Local geological sources or a site investigation may still provide more detailed information.',
          value: { reasonCode: 'NO_DATA' }
        }]
      };
    }

    const props: FeatureInfo = { ...(lithology || {}), ...(age || {}) };
    const material = props.representativeLithology || props.lithology || null;
    const ageText = props.olderNamedAge && props.youngerNamedAge && props.olderNamedAge !== props.youngerNamedAge
      ? `${props.olderNamedAge}–${props.youngerNamedAge}`
      : props.olderNamedAge || props.youngerNamedAge || null;
    const descriptor = [props.name, material ? `material: ${material}` : null, ageText ? `age: ${ageText}` : null].filter(Boolean).join('; ');

    return {
      geologyFound: true,
      evidence: [{
        id: 'at-geosphere-geology-site',
        category: 'Geology & ground',
        claim: `GeoSphere Austria mapped the site within ${descriptor || 'a 1:50,000 geological unit'}.`,
        status: 'VERIFIED',
        sourceName: SOURCE_NAME,
        sourceUrl: SOURCE_URL,
        datasetDate: today(),
        spatialRelationship: 'Selected coordinate intersects the mapped 1:50,000 geological unit',
        calculationMethod: 'GeoSphere Austria INSPIRE WMS GetFeatureInfo; 1:50,000 lithology and age layers',
        confidence: 'High',
        limitation: 'This is regional geological mapping. It does not establish parcel-scale stratigraphy, soil thickness, bearing capacity, groundwater depth or construction parameters.',
        value: {
          name: props.name || null,
          lithology: material,
          geologicalAge: ageText,
          description: props.description || null,
          eventEnvironment: props.eventEnvironment || null,
          eventProcess: props.eventProcess || null
        }
      }]
    };
  } catch (error) {
    return {
      geologyFound: false,
      evidence: [{
        id: 'at-geosphere-geology-unavailable',
        category: 'Geology & ground',
        claim: 'GeoSphere Austria geological mapping could not be queried for the selected site.',
        status: 'REQUIRES_VERIFICATION',
        sourceName: SOURCE_NAME,
        sourceUrl: SOURCE_URL,
        datasetDate: today(),
        spatialRelationship: 'Selected site centre',
        calculationMethod: 'GeoSphere Austria INSPIRE WMS GetFeatureInfo',
        confidence: 'Low',
        limitation: 'A service failure is not evidence that geological information is absent. Check GeoSphere Austria directly or obtain a local geological/geotechnical investigation.',
        value: { reasonCode: 'SOURCE_UNAVAILABLE', error: error instanceof Error ? error.message : String(error) }
      }]
    };
  }
}
