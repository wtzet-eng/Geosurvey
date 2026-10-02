import type { EvidenceItem } from '../types';

type FetchLike = typeof fetch;

const EA_STATIONS = 'https://environment.data.gov.uk/flood-monitoring/id/stations';
const EA_ROOT = 'https://environment.data.gov.uk/flood-monitoring/id';
const SEPA_API = 'https://timeseries.sepa.org.uk/KiWIS/KiWIS';
const BGS_NGLA = 'https://www.bgs.ac.uk/groundwater/data/groundwater-levels/national-groundwater-level-archive/';

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
      headers: { Accept: 'application/json', 'User-Agent': 'GroundSurf/1.0 UK groundwater evidence' },
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
    category: 'Hydrogeology',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName: 'British Geological Survey — National Groundwater Level Archive',
    sourceUrl,
    datasetDate: new Date().toISOString().slice(0, 10),
    spatialRelationship: 'UK groundwater-level archive / regional monitoring context',
    calculationMethod: 'Groundwater source availability check',
    confidence: 'Low',
    limitation: 'A site-specific groundwater level was not retrieved from an open regional measurement service for this location. The BGS National Groundwater Level Archive contains UK groundwater-level data from the Environment Agency, Northern Ireland, SEPA and Natural Resources Wales; local or regional monitoring records should be checked before design use.',
    value: { reasonCode, archiveUrl: BGS_NGLA }
  };
}

async function queryEnglandGroundwater(lat: number, lng: number, fetcher: FetchLike): Promise<EvidenceItem | null> {
  const params = new URLSearchParams({
    type: 'Groundwater',
    lat: String(lat),
    long: String(lng),
    dist: '10',
    _view: 'full',
    _limit: '20'
  });
  const url = EA_STATIONS + '?' + params.toString();
  const payload = await getJson(fetcher, url);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const candidates = items
    .map((station: any) => {
      const stationLat = num(station?.lat);
      const stationLng = num(station?.long);
      const measure = Array.isArray(station?.measures) ? station.measures.find((m: any) => /groundwater/i.test(String(m?.qualifier || ''))) : station?.measures;
      const reading = measure?.latestReading;
      if (stationLat === null || stationLng === null || !measure || !reading) return null;
      const distanceKm = haversineKm(lat, lng, stationLat, stationLng);
      return { station, measure, reading, distanceKm };
    })
    .filter((item: any): item is any => Boolean(item))
    .sort((a: any, b: any) => a.distanceKm - b.distanceKm);

  if (!candidates.length) {
    return noData(
      'gb-ea-groundwater-no-measurement',
      'The Environment Agency groundwater station service returned no nearby station with a current groundwater reading.',
      url,
      'NO_DATA'
    );
  }

  const nearest = candidates[0];
  const value = num(nearest.reading?.value);
  const dateTime = clean(nearest.reading?.dateTime);
  const stationName = clean(nearest.station?.label) || clean(nearest.station?.stationReference) || 'groundwater monitoring station';
  const unit = clean(nearest.measure?.unitName) || 'mAOD';
  if (value === null || !dateTime) {
    return noData(
      'gb-ea-groundwater-invalid-reading',
      'The Environment Agency returned a nearby groundwater station but no usable dated reading.',
      url,
      'MALFORMED_DATA'
    );
  }

  return {
    id: 'gb-ea-groundwater-level',
    category: 'Groundwater monitoring',
    claim: 'The Environment Agency records a groundwater level of ' + value.toFixed(2) + ' ' + unit + ' at ' + stationName + ', approximately ' + nearest.distanceKm.toFixed(2) + ' km from the selected site, at ' + dateTime + '.',
    status: 'VERIFIED',
    sourceName: 'Environment Agency — groundwater monitoring',
    sourceUrl: EA_ROOT + '/stations/' + encodeURIComponent(nearest.station?.stationReference || ''),
    datasetDate: dateTime.slice(0, 10),
    spatialRelationship: 'Nearest Environment Agency groundwater station: ' + nearest.distanceKm.toFixed(2) + ' km from the selected coordinate',
    calculationMethod: 'Environment Agency real-time groundwater station search within 10 km and WGS84 great-circle distance ranking; latest published reading used',
    confidence: nearest.distanceKm <= 2 ? 'High' : 'Medium',
    limitation: 'This is an observed groundwater level at a nearby monitoring station, not a measurement beneath the selected parcel. The Environment Agency rounds public station coordinates and groundwater levels can vary spatially and over time; site-specific observations are still required for final excavation, waterproofing and foundation design.',
    value: {
      stationName,
      stationReference: nearest.station?.stationReference || null,
      stationDistanceKm: nearest.distanceKm,
      groundwaterLevelM: value,
      unit,
      measurementDateTime: dateTime
    }
  };
}

async function queryScotlandGroundwater(lat: number, lng: number, fetcher: FetchLike): Promise<EvidenceItem | null> {
  const stationParams = new URLSearchParams({
    service: 'kisters',
    type: 'queryServices',
    datasource: '0',
    request: 'getstationlist',
    stationparameter_no: 'GWL',
    returnfields: 'station_no,station_name,station_latitude,station_longitude,stationparameter_no',
    object_type: 'General',
    format: 'json'
  });
  const url = SEPA_API + '?' + stationParams.toString();
  const payload = await getJson(fetcher, url);
  const rows = Array.isArray(payload) ? payload.slice(1) : [];
  const candidates = rows
    .map((row: any[]) => {
      const stationNo = clean(row?.[0]);
      const stationName = clean(row?.[1]);
      const stationLat = num(row?.[2]);
      const stationLng = num(row?.[3]);
      if (!stationNo || stationLat === null || stationLng === null) return null;
      return { stationNo, stationName, stationLat, stationLng, distanceKm: haversineKm(lat, lng, stationLat, stationLng) };
    })
    .filter((item: any): item is any => Boolean(item))
    .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
    .slice(0, 6);

  if (!candidates.length) {
    return noData(
      'gb-sepa-groundwater-no-station',
      'SEPA returned no groundwater monitoring station from its open groundwater network catalogue.',
      url,
      'NO_DATA'
    );
  }

  const measured = await Promise.all(candidates.map(async (candidate: any) => {
    const listParams = new URLSearchParams({
      service: 'kisters',
      type: 'queryServices',
      datasource: '0',
      request: 'getTimeseriesList',
      station_no: candidate.stationNo,
      stationparameter_no: 'GWL',
      returnfields: 'station_no,station_name,station_latitude,station_longitude,stationparameter_name,stationparameter_no,ts_name,ts_id,coverage',
      dateformat: 'yyyy-MM-dd',
      format: 'json'
    });
    const listPayload = await getJson(fetcher, SEPA_API + '?' + listParams.toString());
    const seriesRows = Array.isArray(listPayload) ? listPayload.slice(1) : [];
    const dayMean = seriesRows.find((row: any[]) => row?.[6] === 'Day.Mean' || row?.[6] === 'Day.Min' || row?.[6] === 'Day.Max');
    if (!dayMean) return null;
    const tsName = clean(dayMean?.[6]);
    if (!tsName) return null;
    const valueParams = new URLSearchParams({
      service: 'kisters',
      type: 'queryServices',
      datasource: '0',
      request: 'getTimeseriesValues',
      metadata: 'true',
      returnfields: 'Timestamp,Value,Quality Code',
      ts_path: '1/' + candidate.stationNo + '/GWL/C' + tsName,
      to: new Date().toISOString().slice(0, 10),
      period: 'P14D',
      dateformat: "yyyy-MM-dd'T'HH:mm:ss",
      format: 'json'
    });
    const valuePayload = await getJson(fetcher, SEPA_API + '?' + valueParams.toString());
    const series = Array.isArray(valuePayload) ? valuePayload[0] : null;
    const data = Array.isArray(series?.data) ? series.data : [];
    const recent = [...data].reverse().find((row: any[]) => num(row?.[1]) !== null && clean(row?.[0]));
    if (!recent) return null;
    return { candidate, value: num(recent[1])!, timestamp: clean(recent[0])!, tsName };
  }));

  const usable = measured.filter(Boolean).sort((a: any, b: any) => a.candidate.distanceKm - b.candidate.distanceKm) as any[];
  if (!usable.length) {
    return noData(
      'gb-sepa-groundwater-no-measurement',
      'SEPA groundwater stations were found, but no usable recent groundwater level reading was returned.',
      url,
      'NO_DATA'
    );
  }

  const nearest = usable[0];
  return {
    id: 'gb-sepa-groundwater-level',
    category: 'Groundwater monitoring',
    claim: 'SEPA records a groundwater level of ' + nearest.value.toFixed(2) + ' m above Ordnance Datum at ' + (nearest.candidate.stationName || nearest.candidate.stationNo) + ', approximately ' + nearest.candidate.distanceKm.toFixed(2) + ' km from the selected site, on ' + nearest.timestamp + '.',
    status: 'VERIFIED',
    sourceName: 'SEPA — groundwater monitoring',
    sourceUrl: SEPA_API,
    datasetDate: nearest.timestamp.slice(0, 10),
    spatialRelationship: 'Nearest SEPA groundwater station: ' + nearest.candidate.distanceKm.toFixed(2) + ' km from the selected coordinate',
    calculationMethod: 'SEPA open GWL station catalogue, nearest-station WGS84 distance ranking, and latest available recent daily groundwater time-series value',
    confidence: nearest.candidate.distanceKm <= 5 ? 'High' : 'Medium',
    limitation: 'This is an observed groundwater level at a nearby SEPA monitoring station, not a measurement beneath the selected parcel. SEPA groundwater observations are referenced to the station datum/Ordnance Datum framework and can vary spatially and seasonally; site-specific investigation remains necessary for design.',
    value: {
      stationName: nearest.candidate.stationName,
      stationNumber: nearest.candidate.stationNo,
      stationDistanceKm: nearest.candidate.distanceKm,
      groundwaterLevelM: nearest.value,
      reference: 'm above Ordnance Datum',
      measurementDate: nearest.timestamp,
      timeSeries: nearest.tsName
    }
  };
}

export async function queryUKGroundwater(lat: number, lng: number, stateName: string | null, fetcher: FetchLike = fetch): Promise<EvidenceItem[]> {
  const state = String(stateName || '').toLowerCase();
  if (/scotland/.test(state)) {
    const evidence = await queryScotlandGroundwater(lat, lng, fetcher);
    return evidence ? [evidence] : [];
  }

  if (/northern ireland/.test(state)) {
    return [noData(
      'gb-ni-groundwater-archive-context',
      'The UK National Groundwater Level Archive includes groundwater monitoring data from Northern Ireland, but no automated site-specific NI groundwater level was retrieved for this analysis.',
      BGS_NGLA,
      'REGIONAL_SOURCE_ONLY'
    )];
  }

  if (/wales/.test(state)) {
    return [noData(
      'gb-wales-groundwater-archive-context',
      'The UK National Groundwater Level Archive includes groundwater monitoring data from Natural Resources Wales, but no automated site-specific Welsh groundwater level was retrieved for this analysis.',
      BGS_NGLA,
      'REGIONAL_SOURCE_ONLY'
    )];
  }

  const evidence = await queryEnglandGroundwater(lat, lng, fetcher);
  return evidence ? [evidence] : [];
}

export function enrichUKGroundwater(report: Record<string, any>, evidence: EvidenceItem[]): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...evidence);
  const observed = evidence.find(item => ['gb-ea-groundwater-level', 'gb-sepa-groundwater-level'].includes(item.id) && item.status === 'VERIFIED');
  if (!observed) return;

  const value = observed.value || {};
  report.uk_groundwater = {
    measured: true,
    groundwaterLevelM: value.groundwaterLevelM ?? null,
    unit: value.unit || value.reference || null,
    stationDistanceKm: value.stationDistanceKm ?? null,
    measurementDate: value.measurementDate || value.measurementDateTime || null,
    stationName: value.stationName || null,
    source: observed.sourceName
  };
}

export const UK_GROUNDWATER_SOURCES = {
  england: EA_STATIONS,
  scotland: SEPA_API,
  archive: BGS_NGLA
};
