import type { EvidenceItem } from '../types';

const BOREHOLE_WFS_URL = 'https://map.hugeo.hu/arcgis/services/furas/map_frs_fdt_web_mercator/MapServer/WFSServer';
const GEOLOGY_WMS_URL = 'https://map.hugeo.hu/arcgis/services/fdt100/fdt_100/MapServer/WMSServer';
const HUGEO_PORTAL_URL = 'https://map.hugeo.hu/';
const RADIUS_M = 3000;

export interface HungaryGroundEvidenceResult {
  evidence: EvidenceItem[];
  context: {
    geological_unit_name?: string;
    lithology_type?: string;
    source_name?: string;
    source_url?: string;
    evidence_level?: 'VERIFIED' | 'MODELLED' | 'REQUIRES_VERIFICATION';
    borehole_count?: number;
    nearest_borehole_distance_m?: number | null;
  };
}

function wgs84ToWebMercator(lat: number, lng: number): [number, number] {
  const x = lng * 20037508.34 / 180;
  const y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180;
  return [x, y];
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371008.8;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

async function fetchJson(fetcher: typeof fetch, url: string): Promise<any | null> {
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/geo+json, application/json' } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function queryBoreholes(lat: number, lng: number, fetcher: typeof fetch): Promise<{ evidence?: EvidenceItem; count: number; nearestDistanceM: number | null }> {
  const [x, y] = wgs84ToWebMercator(lat, lng);
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'furas_map_frs_fdt_web_mercator:Földtani_réteginformáció',
    outputFormat: 'GEOJSON',
    bbox: [x - RADIUS_M, y - RADIUS_M, x + RADIUS_M, y + RADIUS_M, 'EPSG:3857'].join(','),
    count: '100'
  });
  const data = await fetchJson(fetcher, `${BOREHOLE_WFS_URL}?${params.toString()}`);
  const features = Array.isArray(data?.features) ? data.features : [];
  const nearby = features
    .map((feature: any) => {
      const [featureLng, featureLat] = Array.isArray(feature?.geometry?.coordinates)
        ? [Number(feature.geometry.coordinates[0]), Number(feature.geometry.coordinates[1])]
        : [NaN, NaN];
      if (!Number.isFinite(featureLat) || !Number.isFinite(featureLng)) return null;
      return {
        distanceM: haversineM(lat, lng, featureLat, featureLng),
        id: String(feature?.properties?.['Fúrás_jele__száma'] ?? '').trim(),
        depthM: Number(feature?.properties?.['Talpmélység']),
        year: Number(feature?.properties?.['Fúrás_mélyítésének_éve'])
      };
    })
    .filter(Boolean) as Array<{ distanceM: number; id: string; depthM: number; year: number }>;

  nearby.sort((a, b) => a.distanceM - b.distanceM);
  const nearest = nearby[0] || null;
  const sourceName = 'SZTFH / HUGEO — Fúr­áspontok és földtani réteginformáció';
  if (!features.length) {
    return {
      count: 0,
      nearestDistanceM: null,
      evidence: {
        id: 'hu-hugeo-boreholes-no-data',
        category: 'Borehole / ground investigation context',
        claim: 'The official HUGEO drilling-point service returned no drilling records within the 3 km screening radius.',
        status: 'REQUIRES_VERIFICATION',
        sourceName,
        sourceUrl: BOREHOLE_WFS_URL,
        datasetDate: new Date().toISOString().slice(0, 10),
        spatialRelationship: '3 km radius around selected location',
        calculationMethod: 'HUGEO WFS spatial screening of Földtani_réteginformáció',
        confidence: 'Medium',
        limitation: 'Absence of returned drilling records does not prove absence of boreholes or investigations. The query is a 3 km screening search, not a complete engineering investigation.'
      }
    };
  }

  const text = nearest
    ? `${features.length} nearby HUGEO drilling records were returned within 3 km; nearest record ${nearest.id || 'without a public borehole code'} is approximately ${Math.round(nearest.distanceM)} m away${Number.isFinite(nearest.depthM) ? `, with recorded depth ${nearest.depthM} m` : ''}${Number.isFinite(nearest.year) ? ` (drilled ${nearest.year})` : ''}.`
    : `${features.length} nearby HUGEO drilling records were returned within 3 km.`;

  return {
    count: features.length,
    nearestDistanceM: nearest?.distanceM ?? null,
    evidence: {
      id: 'hu-hugeo-borehole-context',
      category: 'Borehole / ground investigation context',
      claim: text,
      status: 'VERIFIED',
      sourceName,
      sourceUrl: BOREHOLE_WFS_URL,
      datasetDate: new Date().toISOString().slice(0, 10),
      spatialRelationship: 'Nearby HUGEO drilling records within 3 km of selected location',
      calculationMethod: 'HUGEO WFS Földtani_réteginformáció query in EPSG:3857',
      confidence: 'High',
      limitation: 'Nearby drilling records provide investigation context but do not establish the complete stratigraphy, bearing capacity, groundwater level or settlement behavior beneath the selected parcel.'
    }
  };
}

async function queryGeology(lat: number, lng: number, fetcher: typeof fetch): Promise<{ evidence?: EvidenceItem; unit?: string; lithology?: string }> {
  const delta = 0.01;
  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetFeatureInfo',
    layers: '1',
    query_layers: '1',
    styles: '',
    crs: 'CRS:84',
    bbox: [lng - delta, lat - delta, lng + delta, lat + delta].join(','),
    width: '101',
    height: '101',
    i: '51',
    j: '51',
    info_format: 'application/geo+json',
    feature_count: '8'
  });
  const url = `${GEOLOGY_WMS_URL}?${params.toString()}`;
  const data = await fetchJson(fetcher, url);
  const features = Array.isArray(data?.features) ? data.features : [];
  const names: string[] = [];
  const lithologies: string[] = [];
  for (const feature of features) {
    const p = feature?.properties || {};
    const name = String(p['Név'] ?? '').trim();
    const lithology = String(p['Litológia'] ?? '').trim();
    if (name && !names.includes(name)) names.push(name);
    if (lithology && !lithologies.includes(lithology)) lithologies.push(lithology);
  }
  if (!features.length || !names.length) {
    return {
      evidence: {
        id: 'hu-hugeo-geology-no-data',
        category: 'Mapped geology',
        claim: 'The official HUGEO 1:100,000 geological map did not return a readable geological feature at the selected point.',
        status: 'REQUIRES_VERIFICATION',
        sourceName: 'SZTFH / HUGEO — Hungary geological map 1:100,000',
        sourceUrl: GEOLOGY_WMS_URL,
        datasetDate: new Date().toISOString().slice(0, 10),
        spatialRelationship: 'Point query at selected coordinate',
        calculationMethod: 'HUGEO WMS GetFeatureInfo, layer 1 (Földtan)',
        confidence: 'Low',
        limitation: 'Mapped geology is regional screening evidence. Lack of a returned feature does not establish absence of a geological unit or hazard at parcel scale.'
      }
    };
  }

  const unit = names[0];
  const context = names.slice(0, 4).join('; ');
  const lithology = lithologies[0];
  return {
    unit,
    lithology,
    evidence: {
      id: 'hu-hugeo-geology-point',
      category: 'Mapped geology',
      claim: `HUGEO 1:100,000 geological map returned a point-intersecting mapped record: ${context}.`,
      status: 'VERIFIED',
      sourceName: 'SZTFH / HUGEO — Hungary geological map 1:100,000',
      sourceUrl: GEOLOGY_WMS_URL,
      datasetDate: new Date().toISOString().slice(0, 10),
      spatialRelationship: 'Point query at selected coordinate',
      calculationMethod: 'HUGEO WMS GetFeatureInfo on layer 1 (Földtan) using CRS:84',
      confidence: 'High',
      limitation: 'This is mapped regional geology, not a parcel-scale geotechnical interpretation. Multiple returned map records may represent overlapping mapped information; site-specific stratigraphy and engineering parameters require investigation.',
      value: { unit, lithology, mappedRecords: names, mappedLithologies: lithologies }
    }
  };
}

export async function queryHungaryGroundEvidence(lat: number, lng: number, fetcher: typeof fetch = fetch): Promise<HungaryGroundEvidenceResult> {
  const [boreholes, geology] = await Promise.all([
    queryBoreholes(lat, lng, fetcher),
    queryGeology(lat, lng, fetcher)
  ]);

  const evidence: EvidenceItem[] = [];
  if (geology.evidence) evidence.push(geology.evidence);
  if (boreholes.evidence) evidence.push(boreholes.evidence);
  evidence.push({
    id: 'hu-hugeo-engineering-geology-context',
    category: 'Urban / engineering geology',
    claim: 'Hungary has official HUGEO geological, applied-geology and geophysical information. GroundSurf uses the point-matched geological map and nearby drilling records automatically; engineering-geological design conclusions still require the relevant official local investigation or professional study.',
    status: 'REQUIRES_VERIFICATION',
    sourceName: 'SZTFH / HUGEO',
    sourceUrl: HUGEO_PORTAL_URL,
    datasetDate: new Date().toISOString().slice(0, 10),
    spatialRelationship: 'National engineering-geology source context for selected location',
    calculationMethod: 'Official HUGEO map-service catalogue review',
    confidence: 'High',
    limitation: 'Engineering geology is not represented by one parcel-scale national layer in this GroundSurf version. Local engineering studies, boreholes and project-specific investigations remain authoritative.'
  });

  return {
    evidence,
    context: {
      geological_unit_name: geology.unit,
      lithology_type: geology.lithology,
      source_name: geology.unit ? 'SZTFH / HUGEO — Hungary geological map 1:100,000' : undefined,
      source_url: geology.unit ? GEOLOGY_WMS_URL : undefined,
      evidence_level: geology.unit ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
      borehole_count: boreholes.count,
      nearest_borehole_distance_m: boreholes.nearestDistanceM
    }
  };
}

export function enrichHungaryGroundEvidence(report: any, result: HungaryGroundEvidenceResult): void {
  if (!report) return;
  const existing = report.geosurvey_context && typeof report.geosurvey_context === 'object' ? report.geosurvey_context : {};
  report.geosurvey_context = {
    ...existing,
    ...(result.context.geological_unit_name ? {
      geological_unit_name: result.context.geological_unit_name,
      lithology_type: result.context.lithology_type || null,
      source_name: result.context.source_name,
      source_url: result.context.source_url,
      evidence_level: result.context.evidence_level
    } : {}),
    hu_borehole_count: result.context.borehole_count ?? 0,
    hu_nearest_borehole_distance_m: result.context.nearest_borehole_distance_m ?? null
  };
}
