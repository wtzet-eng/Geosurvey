import type { EvidenceItem } from '../types';
import { inflateSync } from 'node:zlib';

const WMS = 'https://servisi.voda.hr/poplave_opasnosti_2019/wms';
const SOURCE = 'Hrvatske vode — Flood Hazard Maps 2019 (WMS)';
const SOURCE_URL = 'https://www.voda.hr/hr/karte-opasnosti-od-poplava-2019';

const SCENARIOS = [
  { key: 'high', layer: 'hr.fd.opasnost-od-poplave-velika-vjerojatnost_2019', label: 'high probability (~25-year scenario)', level: 'High' as const },
  { key: 'medium', layer: 'hr.fd.opasnost-od-poplave-srednja-vjerojatnost_2019', label: 'medium probability (~100-year scenario)', level: 'Moderate' as const },
  { key: 'low', layer: 'hr.fd.opasnost-od-poplave-mala-vjerojatnost_2019', label: 'low probability (~1000-year scenario)', level: 'Low' as const }
] as const;

type FetchLike = typeof fetch;
type Pixel = { r: number; g: number; b: number; a: number };

function readPngCenter(buffer: ArrayBuffer): Pixel | null {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length < 33 || view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) return null;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  let palette: Uint8Array | null = null;
  let transparency: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset); const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    const data = bytes.slice(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = view.getUint32(offset + 8); height = view.getUint32(offset + 12); bitDepth = data[8]; colorType = data[9];
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') transparency = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    offset += length + 12;
  }
  if (width !== 1 || height !== 1 || ![2, 3, 6].includes(colorType)) return null;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length < 2 || raw[0] !== 0) return null;
  if (colorType === 3) {
    if (!palette || palette.length < 3 || ![1, 2, 4, 8].includes(bitDepth)) return null;
    const index = bitDepth === 8 ? raw[1] : raw[1] >> (8 - bitDepth);
    const p = index * 3;
    if (p + 2 >= palette.length) return null;
    return { r: palette[p], g: palette[p + 1], b: palette[p + 2], a: transparency?.[index] ?? 255 };
  }
  if (bitDepth !== 8) return null;
  const channels = colorType === 6 ? 4 : 3;
  const px = Array.from(raw.slice(1, 1 + channels));
  if (px.length !== channels) return null;
  return colorType === 6 ? { r: px[0], g: px[1], b: px[2], a: px[3] } : { r: px[0], g: px[1], b: px[2], a: 255 };
}

async function mapPixel(lat: number, lng: number, layer: string, fetcher: FetchLike): Promise<Pixel | null> {
  const delta = 0.0002;
  const params = new URLSearchParams({
    service: 'WMS', version: '1.3.0', request: 'GetMap', layers: layer, styles: '',
    crs: 'EPSG:4326', bbox: `${lat - delta},${lng - delta},${lat + delta},${lng + delta}`,
    width: '1', height: '1', format: 'image/png', transparent: 'true'
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetcher(`${WMS}?${params}`, { signal: controller.signal, headers: { 'User-Agent': 'LandSurf/1.0 Croatia flood evidence', Accept: 'image/png' } });
    if (!response.ok) return null;
    return readPngCenter(await response.arrayBuffer());
  } catch { return null; } finally { clearTimeout(timer); }
}

export interface CroatiaFloodEvidence {
  status: 'VERIFIED' | 'REQUIRES_VERIFICATION';
  level: 'Negligible' | 'Low' | 'Moderate' | 'High' | 'Not available';
  description: string;
  scenario: string | null;
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  evidence: EvidenceItem;
}

export async function fetchCroatiaFloodEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<CroatiaFloodEvidence> {
  const results = await Promise.all(SCENARIOS.map(async scenario => ({ scenario, pixel: await mapPixel(lat, lng, scenario.layer, fetcher) })));
  if (results.some(result => result.pixel === null)) {
    return {
      status: 'REQUIRES_VERIFICATION', level: 'Not available', scenario: null,
      description: 'Croatian official flood-hazard maps could not be queried reliably at the selected coordinate. No flood-risk classification has been inferred.',
      sourceName: SOURCE, sourceUrl: SOURCE_URL, datasetDate: '2019',
      evidence: {
        id: 'hr-flood-hazard-unavailable', category: 'Hydrology & Flooding',
        claim: 'The Croatian official flood-hazard WMS could not be queried reliably for the selected coordinate.',
        status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: SOURCE_URL, datasetDate: '2019',
        spatialRelationship: 'Selected coordinate', calculationMethod: 'Official Hrvatske vode WMS GetMap point screen across three 2019 flood scenarios',
        confidence: 'Low', limitation: 'Source failure is not evidence that flood risk is absent. The official map does not show every possible flooding scenario.'
      }
    };
  }

  const hit = results.find(result => result.pixel!.a > 0);
  const level = hit?.scenario.level || 'Negligible';
  const scenario = hit?.scenario.label || null;
  const description = hit
    ? `The selected coordinate intersects the official Croatian flood-hazard map for the ${scenario}.`
    : 'No mapped flood-hazard area was returned at the selected coordinate in the three 2019 Croatian official scenario layers.';
  const limitation = 'The 2019 flood-hazard maps cover identified areas of potential significant flood risk and do not represent every possible flooding mechanism. They are screening evidence, not a site-specific flood-risk assessment.';
  return {
    status: 'VERIFIED', level, scenario, description, sourceName: SOURCE, sourceUrl: SOURCE_URL, datasetDate: '2019',
    evidence: {
      id: 'hr-flood-hazard-site', category: 'Hydrology & Flooding', claim: description, status: 'VERIFIED',
      sourceName: SOURCE, sourceUrl: SOURCE_URL, datasetDate: '2019', spatialRelationship: 'Official WMS scenario map screen at selected coordinate',
      calculationMethod: 'Hrvatske vode WMS GetMap 1x1 pixel screen across high-, medium- and low-probability 2019 scenarios; highest intersecting scenario retained',
      confidence: 'High', limitation, value: { scenario, level, scenariosChecked: SCENARIOS.map(item => item.key), mapService: WMS }
    }
  };
}
