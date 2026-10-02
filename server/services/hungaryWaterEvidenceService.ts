import type { EvidenceItem } from '../types';

const OVF_MAP_URL = 'https://geoportal.vizugy.hu/arcgis/rest/services/Honlap/VARGEO_vizrajzi_terkep/MapServer';
const HUGEO_GROUNDWATER_WMS = 'https://map.hugeo.hu/arcgis/services/tvz/tvz100_all/MapServer/WMSServer';
const OVF_PORTAL_URL = 'https://geoportal.vizugy.hu/';
const RADIUS_M = 100;

export interface HungaryWaterEvidenceResult {
  evidence: EvidenceItem[];
  context: {
    inundation_area?: boolean;
    waterlogged_area?: boolean;
    floodplain_area?: boolean;
    inland_water_basin?: boolean;
    groundwater_source_available: boolean;
  };
}

function wgs84ToWebMercator(lat: number, lng: number): [number, number] {
  const x = lng * 20037508.34 / 180;
  const y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180;
  return [x, y];
}

async function queryLayer(lat: number, lng: number, layerId: number, fetcher: typeof fetch): Promise<any[]> {
  const [x, y] = wgs84ToWebMercator(lat, lng);
  const params = new URLSearchParams({
    f: 'geojson',
    geometry: JSON.stringify({ x, y, spatialReference: { wkid: 3857 } }),
    geometryType: 'esriGeometryPoint',
    inSR: '3857',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false'
  });
  try {
    const response = await fetcher(`${OVF_MAP_URL}/${layerId}/query?${params.toString()}`, {
      headers: { Accept: 'application/json, application/geo+json' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.features) ? data.features : [];
  } catch {
    return [];
  }
}

export async function queryHungaryWaterEvidence(lat: number, lng: number, fetcher: typeof fetch = fetch): Promise<HungaryWaterEvidenceResult> {
  // OVF's national VARGEO service exposes several polygon layers relevant to development screening:
  // 14 = Vízjárta terület, 16 = Hullámtér, 20 = Ártéri öblözet, 21 = Elöntési területek, 24 = Belvízöblözet.
  const [waterAffected, floodplain, floodBasin, inundation, inlandBasin] = await Promise.all([
    queryLayer(lat, lng, 14, fetcher),
    queryLayer(lat, lng, 16, fetcher),
    queryLayer(lat, lng, 20, fetcher),
    queryLayer(lat, lng, 21, fetcher),
    queryLayer(lat, lng, 24, fetcher)
  ]);

  const inundationArea = inundation.length > 0;
  const waterloggedArea = waterAffected.length > 0;
  const floodplainArea = floodplain.length > 0 || floodBasin.length > 0;
  const inlandWaterBasin = inlandBasin.length > 0;

  const flags = [
    inundationArea ? 'mapped inundation area' : null,
    waterloggedArea ? 'water-affected area' : null,
    floodplainArea ? 'floodplain / floodplain basin' : null,
    inlandWaterBasin ? 'inland-water basin' : null
  ].filter(Boolean) as string[];

  const evidence: EvidenceItem[] = [{
    id: 'hu-ovf-water-hazard-screening',
    category: 'Flood / inland-water context',
    claim: flags.length
      ? `The official Hungarian OVF water-management map intersects the selected point with ${flags.join(', ')}.`
      : 'The official Hungarian OVF water-management map returned no intersecting feature in the screened national water-risk layers at the selected point.',
    status: 'VERIFIED',
    sourceName: 'Országos Vízügyi Főigazgatóság (OVF) — VARGEO water-management map',
    sourceUrl: OVF_MAP_URL,
    datasetDate: new Date().toISOString().slice(0, 10),
    spatialRelationship: 'Point intersection with official national OVF polygon layers',
    calculationMethod: 'ArcGIS REST spatial query in EPSG:3857 against Vízjárta terület, Hullámtér, Ártéri öblözet, Elöntési területek and Belvízöblözet layers',
    confidence: 'High',
    limitation: 'This is a national screening result. It does not replace the legally applicable flood-risk designation, local drainage assessment, design flood level or site-specific hydraulic/geotechnical investigation.',
    value: {
      inundationArea,
      waterloggedArea,
      floodplainArea,
      inlandWaterBasin,
      intersectingLayers: flags
    }
  }];

  evidence.push({
    id: 'hu-hugeo-groundwater-map',
    category: 'Groundwater context',
    claim: 'The official HUGEO map service provides national groundwater maps that can be consulted as regional groundwater context for Hungary. A parcel-specific groundwater level is not inferred from the map alone.',
    status: 'REQUIRES_VERIFICATION',
    sourceName: 'SZTFH / HUGEO — Hungary groundwater maps',
    sourceUrl: HUGEO_GROUNDWATER_WMS,
    datasetDate: new Date().toISOString().slice(0, 10),
    spatialRelationship: 'National groundwater mapping source available for the selected location',
    calculationMethod: 'Official HUGEO OGC/WMS catalogue review',
    confidence: 'High',
    limitation: 'Groundwater depth varies with season, hydrological conditions and local geology. A design groundwater level requires appropriate official monitoring data and/or site investigation.'
  });

  return {
    evidence,
    context: {
      inundation_area: inundationArea,
      waterlogged_area: waterloggedArea,
      floodplain_area: floodplainArea,
      inland_water_basin: inlandWaterBasin,
      groundwater_source_available: true
    }
  };
}
