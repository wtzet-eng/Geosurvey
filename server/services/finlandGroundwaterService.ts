import type { EvidenceItem } from '../types';

type FetchLike = typeof fetch;

const GTK_GROUND_INVESTIGATIONS =
  'https://gtkdata.gtk.fi/arcgis/rest/services/Rajapinnat/GTK_Pohjatutkimukset_WFS/MapServer/0/query';
const GTK_PORTAL =
  'https://www.gtk.fi/en/services/data-sets-and-online-services-geo-fi/interface-services/';
const SEARCH_RADIUS_M = 10000;
const SOURCE = 'Geological Survey of Finland (GTK) — Pohjatutkimukset';

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
      headers: { Accept: 'application/json', 'User-Agent': 'GroundSurf/1.0 Finland groundwater evidence' },
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

function parseDate(value: string): Date | null {
  if (!/^\d{8}$/.test(value) || value === '00000000') return null;
  const day = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4)) - 1;
  const year = Number(value.slice(4, 8));
  const date = new Date(Date.UTC(year, month, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface ParsedWaterObservation {
  groundwaterElevationM: number;
  measurementDate: string;
}

function parseGroundwaterRecord(raw: unknown): { referenceElevationM: number; observations: ParsedWaterObservation[] } | null {
  const text = clean(raw);
  if (!text) return null;

  const header = text.match(/^\s*XY\s+\S+\s+\S+\s+(-?\d+(?:\.\d+)?)\s+(\d{8})\s+\S+/mi);
  if (!header) return null;

  const referenceElevationM = num(header[1]);
  if (referenceElevationM === null) return null;

  const headerDate = parseDate(header[2]);
  const headerEnd = header.index === undefined ? 0 : header.index + header[0].length;
  const body = text.slice(headerEnd);
  const observations: ParsedWaterObservation[] = [];

  const rowPattern = /^\s*(-?\d+(?:\.\d+)?)\s+(\d{8})\b/gm;
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(body)) !== null) {
    const groundwaterElevationM = num(match[1]);
    const date = parseDate(match[2]);
    if (groundwaterElevationM === null || !date) continue;
    observations.push({
      groundwaterElevationM,
      measurementDate: formatDate(date)
    });
  }

  if (!observations.length && headerDate) {
    return null;
  }

  return { referenceElevationM, observations };
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
    spatialRelationship: 'GTK groundwater-pipe (VP) search around the selected coordinate',
    calculationMethod: 'GTK Pohjatutkimukset WFS spatial query for groundwater-pipe records',
    confidence: 'Low',
    limitation: 'No usable dated groundwater observation was returned from a nearby GTK groundwater pipe. This is not evidence that groundwater is absent; local groundwater investigation and current water-level measurements may still be needed.',
    value: { reasonCode }
  };
}

export async function queryFinlandGroundwater(
  lat: number,
  lng: number,
  fetcher: FetchLike = fetch
): Promise<EvidenceItem[]> {
  const params = new URLSearchParams({
    f: 'json',
    where: "TUTKIMUSTAPA='VP'",
    geometry: lng.toFixed(7) + ',' + lat.toFixed(7),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    distance: String(SEARCH_RADIUS_M),
    units: 'esriSRUnit_Meter',
    outFields: 'OBJECTID,TUTKIMUSTAPA,TUNNUS2,PAIVAYS,ALKUPERAINEN_DATA,Z_KALLIO,KA_SYVYYS',
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: '100'
  });

  const url = GTK_GROUND_INVESTIGATIONS + '?' + params.toString();
  const payload = await getJson(fetcher, url);
  const features = Array.isArray(payload?.features) ? payload.features : [];

  const candidates = features.map((feature: any) => {
    const attrs = feature?.attributes || {};
    const pointLng = num(feature?.geometry?.x);
    const pointLat = num(feature?.geometry?.y);
    const parsed = parseGroundwaterRecord(attrs.ALKUPERAINEN_DATA);
    if (pointLat === null || pointLng === null || !parsed?.observations.length) return null;

    const latest = [...parsed.observations].sort((a, b) =>
      String(b.measurementDate).localeCompare(String(a.measurementDate))
    )[0];
    const groundwaterDepthM = parsed.referenceElevationM - latest.groundwaterElevationM;
    if (!Number.isFinite(groundwaterDepthM)) return null;

    return {
      attrs,
      pointLat,
      pointLng,
      referenceElevationM: parsed.referenceElevationM,
      groundwaterElevationM: latest.groundwaterElevationM,
      groundwaterDepthM,
      measurementDate: latest.measurementDate,
      distanceKm: haversineKm(lat, lng, pointLat, pointLng)
    };
  }).filter((item: any): item is any => Boolean(item))
    .filter((item: any) => item.distanceKm <= SEARCH_RADIUS_M / 1000)
    .sort((a: any, b: any) =>
      a.distanceKm - b.distanceKm || String(b.measurementDate).localeCompare(String(a.measurementDate))
    );

  if (!candidates.length) {
    return [noData(
      'fi-gtk-groundwater-no-measurement',
      'GTK groundwater-pipe records returned no usable dated groundwater observation within 10 km of the selected site.',
      url,
      features.length ? 'NO_USABLE_MEASUREMENT' : 'NO_DATA'
    )];
  }

  const nearest = candidates[0];
  const stationName = clean(nearest.attrs.TUNNUS2) || 'GTK groundwater pipe';
  const measurementDate = new Date(nearest.measurementDate + 'T00:00:00Z');
  const ageYears = Number.isFinite(measurementDate.getTime())
    ? (Date.now() - measurementDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    : null;
  const historical = ageYears !== null && ageYears > 3;

  const historicalText = historical ? ' This is a historical measurement.' : '';
  const claim =
    'GTK records a measured groundwater level of ' + nearest.groundwaterElevationM.toFixed(2)
    + ' m at groundwater pipe ' + stationName + ', corresponding to about '
    + Math.abs(nearest.groundwaterDepthM).toFixed(2)
    + ' m ' + (nearest.groundwaterDepthM >= 0 ? 'below' : 'above')
    + ' the pipe reference elevation, approximately ' + nearest.distanceKm.toFixed(2)
    + ' km from the selected site, measured on ' + nearest.measurementDate + '.'
    + historicalText;

  return [{
    id: 'fi-gtk-groundwater-level',
    category: 'Groundwater monitoring',
    claim,
    status: 'VERIFIED',
    sourceName: SOURCE,
    sourceUrl: url,
    datasetDate: nearest.measurementDate,
    spatialRelationship: 'Nearest usable GTK groundwater-pipe (VP) observation: ' + nearest.distanceKm.toFixed(2) + ' km from the selected coordinate',
    calculationMethod: 'GTK Pohjatutkimukset WFS groundwater-pipe (VP) records; latest dated water-level row parsed from the raw record; groundwater depth derived as pipe reference elevation minus recorded groundwater elevation; WGS84 great-circle distance ranking',
    confidence: nearest.distanceKm <= 2 ? 'High' : nearest.distanceKm <= 5 ? 'Medium' : 'Low',
    limitation: 'This is an observed groundwater level at a nearby groundwater pipe, not a measurement beneath the selected parcel. Finnish groundwater levels can vary spatially and seasonally, and many GTK ground-investigation observations are historical; the observation should not be treated as the current design groundwater level without site-specific investigation.',
    value: {
      monitoringPoint: stationName,
      recordId: nearest.attrs.OBJECTID ?? null,
      stationDistanceKm: nearest.distanceKm,
      groundwaterDepthM: Math.abs(nearest.groundwaterDepthM),
      groundwaterElevationM: nearest.groundwaterElevationM,
      referenceElevationM: nearest.referenceElevationM,
      measurementDate: nearest.measurementDate,
      historical,
      sourceDataset: 'GTK Pohjatutkimukset'
    }
  }];
}

export function enrichFinlandGroundwater(report: Record<string, any>, evidence: EvidenceItem[]): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...evidence);

  const groundwater = evidence.find(item => item.id === 'fi-gtk-groundwater-level' && item.status === 'VERIFIED');
  if (!groundwater) return;

  const value = groundwater.value || {};
  report.finland_groundwater = {
    measured: true,
    groundwaterDepthM: value.groundwaterDepthM ?? null,
    groundwaterElevationM: value.groundwaterElevationM ?? null,
    referenceElevationM: value.referenceElevationM ?? null,
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
      'GTK Finland returned a dated measured groundwater observation from a nearby groundwater pipe. The observation is credited as vicinity evidence, not as a parcel measurement.';
  }
}

export const FINLAND_GROUNDWATER_SOURCE = GTK_GROUND_INVESTIGATIONS;
