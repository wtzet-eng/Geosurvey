import { InspireCadastralSource } from '../adapters/inspireCadastral';

export interface CzechiaInspireParcel {
  inspireId: string;
  nationalCadastralReference: string | null;
  label: string | null;
  areaM2: number | null;
  geometryPoints: [number, number][];
  beginLifespanVersion: string | null;
}

export interface CzechiaInspireResult {
  success: boolean;
  source: InspireCadastralSource;
  datasetDate: string;
  parcel?: CzechiaInspireParcel;
  limitation: string;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
}

const SOURCE: InspireCadastralSource = {
  countryCode: 'CZ', countryName: 'Czechia',
  serviceUrl: 'https://services.cuzk.gov.cz/wfs/inspire-CP-wfs.asp',
  featureType: 'cp:CadastralParcel',
  provider: 'Český úřad zeměměřický a katastrální (ČÚZK)',
  underlyingSystem: 'Information System of the Cadastre of Real Estates (ISKN)',
  sourceLevel: 'INSPIRE_DERIVED',
  coverageNote: 'CP parcel polygons are published for cadastral units with a digital cadastral map.',
  status: 'CONNECTED'
};
const today = () => new Date().toISOString().slice(0, 10);

type FetchLike = typeof fetch;

function number(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseFeatures(xml: string): CzechiaInspireParcel[] {
  const members = [...xml.matchAll(/<cp:CadastralParcel\b[\s\S]*?<\/cp:CadastralParcel>/g)].map(match => match[0]);
  return members.map(block => {
  const id = block.match(/<cp:CadastralParcel\s+gml:id="([^"]+)"/i)?.[1];
  const ref = block.match(/<cp:nationalCadastralReference>([^<]+)<\/cp:nationalCadastralReference>/i)?.[1] || null;
  const label = block.match(/<cp:label>([^<]+)<\/cp:label>/i)?.[1] || null;
  const area = number(block.match(/<cp:areaValue[^>]*>([^<]+)<\/cp:areaValue>/i)?.[1]);
  const begin = block.match(/<cp:beginLifespanVersion>([^<]+)<\/cp:beginLifespanVersion>/i)?.[1] || null;
  const pos = block.match(/<gml:posList[^>]*>([^<]+)<\/gml:posList>/i)?.[1];
  if (!id || !pos) return null;
  const values = pos.trim().split(/\s+/).map(Number);
  const geometryPoints: [number, number][] = [];
  for (let i = 0; i + 1 < values.length; i += 2) {
    if (Number.isFinite(values[i]) && Number.isFinite(values[i + 1])) geometryPoints.push([values[i], values[i + 1]]);
  }
  if (geometryPoints.length < 3) return null;
  return { inspireId: id, nationalCadastralReference: ref, label, areaM2: area, geometryPoints, beginLifespanVersion: begin };
  }).filter((parcel): parcel is CzechiaInspireParcel => Boolean(parcel));
}

function bboxFromGeometry(points: [number, number][]): string {
  const lats = points.map(p => p[0]);
  const lngs = points.map(p => p[1]);
  const pad = 0.00002;
  return `${Math.min(...lats)-pad},${Math.min(...lngs)-pad},${Math.max(...lats)+pad},${Math.max(...lngs)+pad},urn:ogc:def:crs:EPSG::4326`;
}

export async function queryCzechiaInspireCadastre(points: [number, number][], expectedNationalCadastralReference?: string | null, fetcher: FetchLike = fetch): Promise<CzechiaInspireResult> {
  if (points.length < 3) return { success: false, source: SOURCE, datasetDate: today(), limitation: 'A site boundary is required to query the INSPIRE cadastral parcel service.', reasonCode: 'NO_DATA' };
  const params = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'cp:CadastralParcel', srsName: 'http://www.opengis.net/def/crs/EPSG/0/4326', bbox: bboxFromGeometry(points), count: '100' });
  const url = `${SOURCE.serviceUrl}?${params}`;
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/gml+xml, text/xml', 'User-Agent': 'LandSurf/1.0 Czechia INSPIRE cadastral evidence' } });
    if (!response.ok) return { success: false, source: SOURCE, datasetDate: today(), limitation: `ČÚZK INSPIRE WFS returned HTTP ${response.status}.`, reasonCode: 'SOURCE_UNAVAILABLE' };
    const xml = await response.text();
    if (!xml.includes('<FeatureCollection')) return { success: false, source: SOURCE, datasetDate: today(), limitation: 'The ČÚZK INSPIRE response was not a WFS feature collection.', reasonCode: 'MALFORMED_DATA' };
    const parcels = parseFeatures(xml);
    const parcel = (expectedNationalCadastralReference && parcels.find(candidate => candidate.nationalCadastralReference === expectedNationalCadastralReference)) || parcels[0];
    if (!parcel) return { success: false, source: SOURCE, datasetDate: today(), limitation: 'No usable INSPIRE CadastralParcel was returned for the supplied boundary.', reasonCode: 'NO_DATA' };
    return { success: true, source: SOURCE, datasetDate: today(), parcel, limitation: 'INSPIRE is an interoperable publication of national cadastral data. Ownership, encumbrances and legal title still require the authoritative Czech cadastral records.' };
  } catch {
    return { success: false, source: SOURCE, datasetDate: today(), limitation: 'The ČÚZK INSPIRE WFS could not be reached.', reasonCode: 'SOURCE_UNAVAILABLE' };
  }
}
