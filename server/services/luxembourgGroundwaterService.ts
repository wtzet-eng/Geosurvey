import type { EvidenceItem } from '../types';

type FetchLike = typeof fetch;

const FEATURES = 'https://features.geoportail.lu';
const ALLUVIAL_STATIONS = 653;
const REFERENCE_BOREHOLES = 2176;
const SEARCH_RADIUS_M = 10000;
const SOURCE = "Administration de la gestion de l'eau / Geoportail Luxembourg";

const num = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const clean = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const r = 6371;
  const p = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * p / 2) ** 2
    + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin((lng2 - lng1) * p / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
};

function radiusBox(lat: number, lng: number, radiusM: number): string {
  const dy = radiusM / 111320;
  const dx = radiusM / (111320 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  return [lng - dx, lat - dy, lng + dx, lat + dy].join(',');
}

function itemsUrl(collection: number, bbox: string, limit = 100): string {
  return `${FEATURES}/collections/${collection}/items?f=json&limit=${limit}&bbox=${bbox}`;
}

async function getJson(fetcher: FetchLike, url: string, timeoutMs = 8000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/geo+json,application/json', 'User-Agent': 'GroundSurf/1.0 Luxembourg groundwater evidence' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function noData(id: string, claim: string, sourceUrl: string, reasonCode: string): EvidenceItem {
  return {
    id,
    category: 'Groundwater monitoring',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE,
    sourceUrl,
    datasetDate: new Date().toISOString().slice(0, 10),
    spatialRelationship: 'Luxembourg official groundwater monitoring / reference-borehole search around the selected coordinate',
    calculationMethod: 'Geoportail Luxembourg OGC API Features spatial screening with fail-closed validation',
    confidence: 'Low',
    limitation: 'No usable numeric groundwater-level observation was retrieved near the selected site. This is not evidence that groundwater is absent; review the official piezometer network and site-specific groundwater investigation.',
    value: { reasonCode }
  };
}

function parseWaterLevelFromRemark(raw: unknown): number | null {
  const text = clean(raw);
  if (!text) return null;
  const match = text.match(/niv\.?\s*nappe\s*:\s*(-?\d+(?:[\.,]\d+)?)\s*m/i);
  return match ? num(match[1]) : null;
}

export async function queryLuxembourgGroundwater(
  lat: number,
  lng: number,
  fetcher: FetchLike = fetch
): Promise<EvidenceItem[]> {
  const bbox = radiusBox(lat, lng, SEARCH_RADIUS_M);
  const [stationsPayload, boreholesPayload] = await Promise.all([
    getJson(fetcher, itemsUrl(ALLUVIAL_STATIONS, bbox, 50)),
    getJson(fetcher, itemsUrl(REFERENCE_BOREHOLES, bbox, 100))
  ]);

  const stations = Array.isArray(stationsPayload?.features) ? stationsPayload.features : [];
  const stationCandidates = stations.map((feature: any) => {
    const c = feature?.geometry?.coordinates;
    const stationLng = Array.isArray(c) ? num(c[0]) : null;
    const stationLat = Array.isArray(c) ? num(c[1]) : null;
    if (stationLat === null || stationLng === null) return null;
    const p = feature?.properties || {};
    return {
      name: clean(p.Nom),
      remarks: clean(p.Remarques),
      point: { lat: stationLat, lng: stationLng },
      distanceKm: haversineKm(lat, lng, stationLat, stationLng)
    };
  })
    .filter((item: any): item is any => Boolean(item?.point && item.distanceKm <= SEARCH_RADIUS_M / 1000))
    .sort((a: any, b: any) => a.distanceKm - b.distanceKm);

  const boreholes = Array.isArray(boreholesPayload?.features) ? boreholesPayload.features : [];
  const measuredCandidates = boreholes.map((feature: any) => {
    const c = feature?.geometry?.coordinates;
    const boreLng = Array.isArray(c) ? num(c[0]) : null;
    const boreLat = Array.isArray(c) ? num(c[1]) : null;
    const a = feature?.properties || {};
    const waterLevelM = parseWaterLevelFromRemark(a.REM);
    const terrainM = num(a.ALT_TN);
    if (boreLat === null || boreLng === null || waterLevelM === null || terrainM === null) return null;
    const distanceKm = haversineKm(lat, lng, boreLat, boreLng);
    if (distanceKm > SEARCH_RADIUS_M / 1000) return null;
    return {
      stationName: clean(a.DESIGNAT) || clean(a.NRFORAGE) || 'reference borehole',
      boreholeId: clean(a.NRFORAGE),
      waterLevelM,
      terrainM,
      depthBelowTerrainM: terrainM - waterLevelM,
      distanceKm,
      remark: clean(a.REM),
      sourceLog: clean(a.LIEN)
    };
  })
    .filter((item: any): item is any => Boolean(item))
    .sort((a: any, b: any) => a.distanceKm - b.distanceKm);

  const nearestMeasured = measuredCandidates[0];
  if (nearestMeasured) {
    const historical = true;
    const depth = nearestMeasured.depthBelowTerrainM;
    const depthPhrase = depth >= 0
      ? `${Math.abs(depth).toFixed(2)} m below the borehole ground elevation`
      : `${Math.abs(depth).toFixed(2)} m above the borehole ground elevation`;

    return [{
      id: 'lu-geo-groundwater-level',
      category: 'Groundwater monitoring',
      claim: `An official Luxembourg reference-borehole record reports a groundwater level of ${nearestMeasured.waterLevelM.toFixed(2)} m at ${nearestMeasured.stationName}, approximately ${nearestMeasured.distanceKm.toFixed(2)} km from the selected site; this corresponds to about ${depthPhrase}.`,
      status: 'VERIFIED',
      sourceName: SOURCE,
      sourceUrl: `${FEATURES}/collections/${REFERENCE_BOREHOLES}`,
      datasetDate: new Date().toISOString().slice(0, 10),
      spatialRelationship: `Nearest official reference borehole with an explicit groundwater-level note: ${nearestMeasured.distanceKm.toFixed(2)} km from the selected coordinate`,
      calculationMethod: 'Geoportail Luxembourg reference-borehole collection queried within 10 km; explicit "niv. nappe" elevation parsed from the official borehole remark; groundwater depth relative to the borehole terrain elevation calculated as ALT_TN minus groundwater elevation; WGS84 great-circle distance ranking',
      confidence: nearestMeasured.distanceKm <= 2 ? 'High' : nearestMeasured.distanceKm <= 5 ? 'Medium' : 'Low',
      limitation: 'The source record provides an explicit groundwater-level elevation but does not expose a measurement date in the public feature attributes. Treat this as official recorded borehole context, not as a current groundwater level beneath the selected parcel. Seasonal variation and local hydraulic conditions require site-specific investigation.',
      value: {
        monitoringPoint: nearestMeasured.stationName,
        boreholeId: nearestMeasured.boreholeId,
        stationDistanceKm: nearestMeasured.distanceKm,
        groundwaterElevationM: Number(nearestMeasured.waterLevelM.toFixed(2)),
        boreholeTerrainElevationM: Number(nearestMeasured.terrainM.toFixed(2)),
        groundwaterDepthM: Number(Math.abs(depth).toFixed(2)),
        groundwaterRelativeToTerrain: depth >= 0 ? 'below' : 'above',
        measurementDate: null,
        historical,
        sourceDataset: 'Geoportail Luxembourg — Forages de référence',
        sourceLog: nearestMeasured.sourceLog
      }
    }];
  }

  const nearestStation = stationCandidates[0];
  if (nearestStation) {
    return [{
      id: 'lu-geo-groundwater-station-context',
      category: 'Groundwater monitoring',
      claim: `The official Luxembourg alluvial-groundwater network has a piezometer at ${nearestStation.name || 'a monitoring station'}, approximately ${nearestStation.distanceKm.toFixed(2)} km from the selected site.`,
      status: 'REQUIRES_VERIFICATION',
      sourceName: SOURCE,
      sourceUrl: `${FEATURES}/collections/${ALLUVIAL_STATIONS}`,
      datasetDate: new Date().toISOString().slice(0, 10),
      spatialRelationship: `Nearest official alluvial-groundwater monitoring station: ${nearestStation.distanceKm.toFixed(2)} km from the selected coordinate`,
      calculationMethod: 'Geoportail Luxembourg alluvial-groundwater station collection queried within 10 km and ranked by WGS84 great-circle distance',
      confidence: nearestStation.distanceKm <= 2 ? 'Medium' : 'Low',
      limitation: 'The public station API exposes the piezometer location but not the current numeric water-level observation. Do not infer a groundwater depth from the station location alone; verify the station time series or obtain site-specific measurements.',
      value: {
        monitoringPoint: nearestStation.name,
        stationDistanceKm: nearestStation.distanceKm,
        currentNumericLevelAvailable: false,
        remarks: nearestStation.remarks
      }
    }];
  }

  return [noData(
    'lu-geo-groundwater-no-data',
    'The official Luxembourg groundwater station and reference-borehole collections returned no usable groundwater-level evidence within 10 km of the selected site.',
    `${FEATURES}/collections/${ALLUVIAL_STATIONS}`,
    stations.length || boreholes.length ? 'NO_USABLE_MEASUREMENT' : 'NO_DATA'
  )];
}

export function enrichLuxembourgGroundwater(report: Record<string, any>, evidence: EvidenceItem[]): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...evidence);

  const groundwater = evidence.find(item => item.id === 'lu-geo-groundwater-level' && item.status === 'VERIFIED');
  if (!groundwater) return;

  const value = groundwater.value || {};
  report.luxembourg_groundwater = {
    measured: true,
    groundwaterDepthM: value.groundwaterDepthM ?? null,
    groundwaterElevationM: value.groundwaterElevationM ?? null,
    boreholeTerrainElevationM: value.boreholeTerrainElevationM ?? null,
    measurementDate: value.measurementDate ?? null,
    historical: value.historical ?? null,
    stationDistanceKm: value.stationDistanceKm ?? null,
    stationName: value.monitoringPoint ?? null,
    source: groundwater.sourceName
  };

  if (report.evidenceScore?.breakdown?.geologyAndGroundwater) {
    report.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(
      18,
      Number(report.evidenceScore.breakdown.geologyAndGroundwater.score) || 0
    );
    report.evidenceScore.breakdown.geologyAndGroundwater.rationale =
      'Luxembourg Geoportail returned an official recorded groundwater-level elevation from a nearby reference borehole. The observation is credited as vicinity evidence, not as a current parcel measurement.';
  }
}

export const LUXEMBOURG_GROUNDWATER_SOURCE = `${FEATURES}/collections/${ALLUVIAL_STATIONS}`;
