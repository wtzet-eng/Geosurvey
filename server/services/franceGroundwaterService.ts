import type { EvidenceItem } from '../types';

type FetchLike = typeof fetch;

const HUBEAU_STATIONS = 'https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/stations';
const HUBEAU_CHRONIQUES = 'https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/chroniques';
const RADIUS_KM = 10;

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const r = 6371;
  const p = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * p / 2) ** 2
    + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin((lng2 - lng1) * p / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
};

const num = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const clean = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const today = () => new Date().toISOString().slice(0, 10);

async function getJson(fetcher: FetchLike, url: string, timeoutMs = 7000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'GroundSurf/1.0 France groundwater evidence' },
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

function noData(id: string, claim: string, reasonCode: string, sourceUrl = HUBEAU_STATIONS): EvidenceItem {
  return {
    id,
    category: 'Hydrogeology',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName: 'Hub’Eau / ADES — Piézométrie',
    sourceUrl,
    datasetDate: today(),
    spatialRelationship: 'France-wide groundwater monitoring source queried around the selected coordinate',
    calculationMethod: 'Hub’Eau ADES API spatial station search',
    confidence: 'Low',
    limitation: 'No usable nearby groundwater measurement was returned. This is not evidence that groundwater is absent; local investigations and the official ADES record should be checked.',
    value: { reasonCode }
  };
}

export async function queryFranceGroundwater(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<EvidenceItem[]> {
  const latDelta = RADIUS_KM / 111.32;
  const lngDelta = RADIUS_KM / Math.max(111.32 * Math.cos(lat * Math.PI / 180), 1);
  const bbox = [lng - lngDelta, lat - latDelta, lng + lngDelta, lat + latDelta].join(',');

  const stationParams = new URLSearchParams({
    bbox,
    size: '1000',
    nb_mesures_piezo_min: '1',
    format: 'json'
  });
  const stationUrl = HUBEAU_STATIONS + '?' + stationParams.toString();
  const stationPayload = await getJson(fetcher, stationUrl);
  const stations = Array.isArray(stationPayload?.data) ? stationPayload.data : [];

  if (!stations.length) {
    return [noData(
      'fr-hubeau-groundwater-no-stations',
      'Hub’Eau / ADES returned no piezometric monitoring station in the screened area around the selected coordinate.',
      'NO_DATA',
      stationUrl
    )];
  }

  const candidates = stations
    .map((station: any) => {
      const stationLng = num(station?.x ?? station?.geometry?.coordinates?.[0]);
      const stationLat = num(station?.y ?? station?.geometry?.coordinates?.[1]);
      if (stationLat === null || stationLng === null) return null;
      const distanceKm = haversineKm(lat, lng, stationLat, stationLng);
      return {
        station,
        distanceKm,
        bssId: clean(station?.bss_id),
        codeBss: clean(station?.code_bss),
        altitudeM: num(station?.altitude_station)
      };
    })
    .filter((item: any): item is any => Boolean(item?.bssId && item.distanceKm <= RADIUS_KM))
    .sort((a: any, b: any) => {
      const aRecent = a.station?.date_fin_mesure ? Date.parse(a.station.date_fin_mesure) : 0;
      const bRecent = b.station?.date_fin_mesure ? Date.parse(b.station.date_fin_mesure) : 0;
      const aRecentFlag = aRecent > 0 && Date.now() - aRecent < 3 * 365.25 * 24 * 60 * 60 * 1000 ? 0 : 1;
      const bRecentFlag = bRecent > 0 && Date.now() - bRecent < 3 * 365.25 * 24 * 60 * 60 * 1000 ? 0 : 1;
      return aRecentFlag - bRecentFlag || a.distanceKm - b.distanceKm;
    })
    .slice(0, 8);

  const measured = await Promise.all(candidates.map(async (candidate: any) => {
    const params = new URLSearchParams({ bss_id: candidate.bssId, size: '1', sort: 'desc', format: 'json' });
    const payload = await getJson(fetcher, HUBEAU_CHRONIQUES + '?' + params.toString());
    const reading = Array.isArray(payload?.data) ? payload.data[0] : null;
    const depthM = num(reading?.profondeur_nappe);
    const levelM = num(reading?.niveau_nappe_eau);
    if (!reading || depthM === null || !clean(reading?.date_mesure)) return null;
    return { candidate, reading, depthM, levelM };
  }));

  const usable = measured.filter(Boolean).sort((a: any, b: any) => a.candidate.distanceKm - b.candidate.distanceKm) as any[];

  if (!usable.length) {
    return [noData(
      'fr-hubeau-groundwater-no-measurement',
      'Hub’Eau / ADES identified nearby piezometric stations, but no usable dated groundwater-depth measurement could be retrieved for the selected location.',
      'NO_DATA',
      HUBEAU_CHRONIQUES
    )];
  }

  const nearest = usable[0];
  const stationName = clean(nearest.candidate.station?.libelle_pe)
    || clean(nearest.candidate.station?.nom_commune)
    || nearest.candidate.bssId;
  const date = clean(nearest.reading.date_mesure)!;
  const depthText = nearest.depthM.toFixed(1) + ' m below ground';
  const levelText = nearest.levelM !== null
    ? '; piezometric level ' + nearest.levelM.toFixed(2) + ' m relative to sea level'
    : '';
  const claim = 'The official Hub’Eau / ADES groundwater network records a measured groundwater depth of '
    + depthText + ' at ' + stationName + ', approximately ' + nearest.candidate.distanceKm.toFixed(2)
    + ' km from the selected site, on ' + date + levelText + '.';

  return [{
    id: 'fr-hubeau-groundwater-level',
    category: 'Groundwater monitoring',
    claim,
    status: 'VERIFIED',
    sourceName: 'Hub’Eau / ADES — Piézométrie',
    sourceUrl: HUBEAU_CHRONIQUES + '?bss_id=' + encodeURIComponent(nearest.candidate.bssId),
    datasetDate: date,
    spatialRelationship: 'Nearest usable piezometric measurement: ' + nearest.candidate.distanceKm.toFixed(2) + ' km from the selected coordinate',
    calculationMethod: 'Hub’Eau ADES station search in a 10 km bounding box, WGS84 great-circle distance ranking, then latest chronicle record per candidate station',
    confidence: nearest.candidate.distanceKm <= 2 ? 'High' : 'Medium',
    limitation: 'This is an observed groundwater level at a nearby monitoring point, not a measurement beneath the selected parcel. Groundwater levels can vary spatially and seasonally and may change after rainfall or abstraction; the measured value should not be treated as the design groundwater level without site-specific investigation.',
    value: {
      stationName,
      bssId: nearest.candidate.bssId,
      codeBss: nearest.candidate.codeBss,
      stationDistanceKm: nearest.candidate.distanceKm,
      measurementDate: date,
      groundwaterDepthM: nearest.depthM,
      piezometricLevelM: nearest.levelM,
      stationAltitudeM: nearest.candidate.altitudeM
    }
  }];
}

export function enrichFranceGroundwater(report: Record<string, any>, evidence: EvidenceItem[]): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...evidence);

  const level = evidence.find(item => item.id === 'fr-hubeau-groundwater-level' && item.status === 'VERIFIED');
  if (!level) return;

  const value = level.value || {};
  report.france_groundwater = {
    measured: true,
    groundwaterDepthM: value.groundwaterDepthM ?? null,
    piezometricLevelM: value.piezometricLevelM ?? null,
    stationDistanceKm: value.stationDistanceKm ?? null,
    measurementDate: value.measurementDate ?? null,
    stationName: value.stationName ?? null,
    bssId: value.bssId ?? null,
    source: level.sourceName
  };

  if (report.evidenceScore?.breakdown?.geologyAndGroundwater) {
    report.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(
      18,
      Number(report.evidenceScore.breakdown.geologyAndGroundwater.score) || 0
    );
    report.evidenceScore.breakdown.geologyAndGroundwater.rationale =
      'Hub’Eau / ADES returned a dated measured groundwater level from a nearby French piezometric monitoring station. The observation is credited as vicinity evidence, not as a parcel measurement.';
  }
}

export const FRANCE_GROUNDWATER_SOURCE = HUBEAU_STATIONS;
