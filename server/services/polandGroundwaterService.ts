import type { EvidenceItem } from '../types';

type FetchLike = typeof fetch;

const MWP_LAYER = 'https://cbdgmapa.pgi.gov.pl/arcgis/rest/services/hydrogeologia/mwp/MapServer/0/query';
const SEARCH_RADIUS_M = 10000;
const SOURCE = 'Państwowa Służba Hydrogeologiczna (PIG-PIB) — Monitoring Wód Podziemnych';

const num = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
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

async function getJson(fetcher: FetchLike, url: string, timeoutMs = 7000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'GroundSurf/1.0 Poland groundwater evidence' },
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

function noData(id: string, claim: string, url: string, reasonCode: string): EvidenceItem {
  return {
    id,
    category: 'Groundwater monitoring',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName: SOURCE,
    sourceUrl: url,
    datasetDate: new Date().toISOString().slice(0, 10),
    spatialRelationship: 'PIG-PIB national groundwater-monitoring point search around the selected coordinate',
    calculationMethod: 'PIG-PIB ArcGIS spatial query of the national MWP monitoring layer',
    confidence: 'Low',
    limitation: 'No usable dated groundwater-depth observation was returned near the selected site. This is not evidence that groundwater is absent; local hydrogeological investigation and the original monitoring records should be checked.',
    value: { reasonCode }
  };
}

function parseMeasurementDate(value: unknown): string | null {
  const n = num(value);
  if (n !== null) {
    const date = new Date(n);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const text = clean(value);
  return text || null;
}

export async function queryPolandGroundwater(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<EvidenceItem[]> {
  const params = new URLSearchParams({
    f: 'json',
    where: "AKTUALNIE_OBSERWOWANY='Tak' AND GLEBOKOSC_ZWIERCIADLA IS NOT NULL",
    geometry: lng.toFixed(7) + ',' + lat.toFixed(7),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    distance: String(SEARCH_RADIUS_M),
    units: 'esriSRUnit_Meter',
    outFields: 'ID,NR_PKT_MONIT_ILOSC,AKTUALNIE_OBSERWOWANY,RZEDNA_TERENU,GLEBOKOSC_ZWIERCIADLA,DATA_POMIARU,WOJEWODZTWO,MIEJSCOWOSC',
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: '50'
  });

  const url = MWP_LAYER + '?' + params.toString();
  const payload = await getJson(fetcher, url);
  const features = Array.isArray(payload?.features) ? payload.features : [];

  const candidates = features.map((feature: any) => {
    const attrs = feature?.attributes || {};
    const pointLng = num(feature?.geometry?.x);
    const pointLat = num(feature?.geometry?.y);
    const depthM = num(attrs.GLEBOKOSC_ZWIERCIADLA);
    const date = parseMeasurementDate(attrs.DATA_POMIARU);
    if (pointLat === null || pointLng === null || depthM === null || !date) return null;
    return {
      attrs,
      pointLat,
      pointLng,
      depthM,
      date,
      distanceKm: haversineKm(lat, lng, pointLat, pointLng)
    };
  }).filter(Boolean)
    .filter((item: any) => item.distanceKm <= SEARCH_RADIUS_M / 1000)
    .sort((a: any, b: any) => a.distanceKm - b.distanceKm || String(b.date).localeCompare(String(a.date)));

  if (!candidates.length) {
    return [noData(
      'pl-pgi-groundwater-no-measurement',
      'PIG-PIB national groundwater monitoring returned no usable dated groundwater-depth observation within 10 km of the selected site.',
      url,
      features.length ? 'NO_USABLE_MEASUREMENT' : 'NO_DATA'
    )];
  }

  const nearest = candidates[0];
  const attrs = nearest.attrs;
  const stationName = clean(attrs.NR_PKT_MONIT_ILOSC) || 'PIG-PIB groundwater monitoring point';
  const voivodeship = clean(attrs.WOJEWODZTWO);
  const locality = clean(attrs.MIEJSCOWOSC);
  const measuredGroundElevation = num(attrs.RZEDNA_TERENU);
  const levelElevation = measuredGroundElevation !== null ? measuredGroundElevation - nearest.depthM : null;

  const claim = 'PIG-PIB national groundwater monitoring records a groundwater depth of '
    + nearest.depthM.toFixed(2) + ' m below ground at monitoring point ' + stationName
    + ', approximately ' + nearest.distanceKm.toFixed(2) + ' km from the selected site, measured on '
    + nearest.date
    + (locality ? ' in ' + locality : '')
    + (voivodeship ? ', ' + voivodeship : '') + '.';

  return [{
    id: 'pl-pgi-groundwater-level',
    category: 'Groundwater monitoring',
    claim,
    status: 'VERIFIED',
    sourceName: SOURCE,
    sourceUrl: url,
    datasetDate: nearest.date,
    spatialRelationship: 'Nearest usable PIG-PIB monitored groundwater point: ' + nearest.distanceKm.toFixed(2) + ' km from the selected coordinate',
    calculationMethod: 'PIG-PIB MWP ArcGIS spatial query within 10 km; active monitored points with explicit groundwater depth and measurement date; WGS84 great-circle distance ranking',
    confidence: nearest.distanceKm <= 2 ? 'High' : nearest.distanceKm <= 5 ? 'Medium' : 'Low',
    limitation: 'This is an observed groundwater depth at a nearby monitoring point, not a measurement beneath the selected parcel. Groundwater levels vary spatially and seasonally and may respond to rainfall or abstraction; it should not be treated as the property design groundwater level without site-specific investigation.',
    value: {
      monitoringPoint: stationName,
      monitoringId: attrs.ID ?? null,
      distanceKm: nearest.distanceKm,
      groundwaterDepthM: nearest.depthM,
      measurementDate: nearest.date,
      locality,
      voivodeship,
      measuredGroundElevationM: measuredGroundElevation,
      derivedGroundwaterElevationM: levelElevation
    }
  }];
}

export function enrichPolandGroundwater(report: Record<string, any>, evidence: EvidenceItem[]): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...evidence);

  const groundwater = evidence.find(item => item.id === 'pl-pgi-groundwater-level' && item.status === 'VERIFIED');
  if (!groundwater) return;

  const value = groundwater.value || {};
  report.poland_groundwater = {
    measured: true,
    groundwaterDepthM: value.groundwaterDepthM ?? null,
    measurementDate: value.measurementDate ?? null,
    stationDistanceKm: value.distanceKm ?? null,
    stationName: value.monitoringPoint ?? null,
    source: groundwater.sourceName
  };

  if (report.evidenceScore?.breakdown?.geologyAndGroundwater) {
    report.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(
      18,
      Number(report.evidenceScore.breakdown.geologyAndGroundwater.score) || 0
    );
    report.evidenceScore.breakdown.geologyAndGroundwater.rationale =
      'PIG-PIB national groundwater monitoring returned a dated measured groundwater depth from a nearby monitoring point. The observation is credited as vicinity evidence, not as a parcel measurement.';
  }
}

export const POLAND_GROUNDWATER_SOURCE = MWP_LAYER;
