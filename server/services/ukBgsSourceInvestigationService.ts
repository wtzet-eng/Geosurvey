import { queryUkAgsBoreholes, UkAgsBorehole } from './ukAgsEvidenceService';
import { EvidenceItem } from '../types';

const MAX_SOURCE_RECORDS = 5;
const RECORD_TIMEOUT_MS = 3500;

type FetchLike = typeof fetch;

export interface UkBgsSourceInvestigation {
  success: boolean;
  sourceCount: number;
  records: Array<{
    id: string;
    projectName: string | null;
    projectContact: string | null;
    engineer: string | null;
    finalDepthM: number | null;
    distanceM: number;
    recordUrl: string;
    logUrl: string | null;
    dataUrl: string | null;
    details: Record<string, unknown>;
  }>;
  evidence: EvidenceItem[];
  limitation: string;
}

const clean = (value: unknown, max = 2500): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
};

async function fetchRecord(borehole: UkAgsBorehole, fetcher: FetchLike): Promise<UkBgsSourceInvestigation['records'][number] | null> {
  const recordUrl = 'https://ogcapi.bgs.ac.uk/v2/collections/agsboreholeindex/items/' + encodeURIComponent(borehole.id);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECORD_TIMEOUT_MS);
  try {
    const response = await fetcher(recordUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'GroundSurf/1.0 (BGS source investigation)' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const payload: any = await response.json();
    const properties = payload?.properties && typeof payload.properties === 'object' ? payload.properties : {};
    const details = Object.fromEntries(
      Object.entries(properties)
        .filter(([key, value]) => !['x', 'y'].includes(key) && value !== null && value !== '')
        .slice(0, 30)
    );
    return {
      id: borehole.id,
      projectName: borehole.projectName,
      projectContact: borehole.projectContact,
      engineer: borehole.engineer,
      finalDepthM: borehole.finalDepthM,
      distanceM: Math.round(borehole.distanceM),
      recordUrl,
      logUrl: borehole.logUrl,
      dataUrl: borehole.dataUrl,
      details
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function investigateUkBgsSources(
  lat: number,
  lng: number,
  fetcher: FetchLike = fetch
): Promise<UkBgsSourceInvestigation> {
  const nearby = await queryUkAgsBoreholes(lat, lng, 2000, fetcher);
  if (!nearby.success) {
    return { success: false, sourceCount: 0, records: [], evidence: [], limitation: nearby.limitation };
  }

  const candidates = nearby.boreholes.slice(0, MAX_SOURCE_RECORDS);
  const fetched = await Promise.all(candidates.map(item => fetchRecord(item, fetcher)));
  const records = fetched.filter((item): item is NonNullable<typeof item> => Boolean(item));

  const evidence = records.map(record => ({
    id: 'gb-bgs-ags-record-' + record.id,
    category: 'Ground investigations',
    claim: `BGS AGS record ${record.id} is an open site-investigation record about ${record.distanceM} m from the selected location; recorded final depth is ${record.finalDepthM !== null ? record.finalDepthM + ' m' : 'not stated'}.`,
    status: 'VERIFIED',
    sourceName: 'British Geological Survey — AGS borehole record',
    sourceUrl: record.recordUrl,
    spatialRelationship: `Approximately ${record.distanceM} m from the selected location`,
    calculationMethod: 'Selected from the BGS AGS spatial index by nearest distance; record metadata fetched from the BGS OGC API feature endpoint.',
    confidence: 'High',
    limitation: 'This is nearby investigation evidence, not a measurement beneath the selected parcel. BGS states that AGS data are delivered as received and that BGS does not add interpretative values or observations.',
    value: {
      recordId: record.id,
      projectName: record.projectName,
      projectContact: record.projectContact,
      engineer: record.engineer,
      finalDepthM: record.finalDepthM,
      distanceM: record.distanceM,
      logUrl: record.logUrl,
      dataUrl: record.dataUrl,
      recordDetails: record.details
    }
  } satisfies EvidenceItem));

  return {
    success: true,
    sourceCount: records.length,
    records,
    evidence,
    limitation: records.length
      ? 'GroundSurf inspected the nearest available open BGS AGS record metadata. Detailed AGS files, logs and laboratory results are not automatically treated as parcel-specific ground conditions.'
      : 'Nearby BGS AGS locations were found, but their individual record endpoints did not return usable metadata.'
  };
}
