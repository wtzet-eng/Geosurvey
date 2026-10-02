import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyThuringiaHydrogeologyResult {
  state: 'Thüringen';
  evidence: EvidenceItem[];
  hydrogeologyMapped: boolean;
  groundwaterDepthMapped: boolean;
}

const HYDRO_WMS = 'https://www.geoproxy.geoportal-th.de/geoproxy/services/hydrogeologie?';
const SOURCE = 'TLUBN Thüringen — Hydrogeologie / Grundwasser';
const STATE = 'Thüringen' as const;
const today = () => new Date().toISOString().slice(0, 10);

async function fetchText(url: string, fetcher: typeof fetch): Promise<string | null> {
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/xml, text/xml, text/plain' } });
    return response.ok ? await response.text() : null;
  } catch { return null; }
}

function findLayer(capabilities: string, terms: string[]): string | null {
  const re = /<Layer[^>]*>[\s\S]*?<Name>([^<]+)<\/Name>[\s\S]*?<Title>([^<]+)<\/Title>[\s\S]*?<\/Layer>/gi;
  for (const match of capabilities.matchAll(re)) {
    const name = match[1].trim();
    const title = match[2].trim().toLowerCase();
    if (terms.some(term => title.includes(term) || name.toLowerCase().includes(term))) return name;
  }
  return null;
}

function infoUrl(base: string, layer: string, lat: number, lng: number): string {
  const d = 0.02;
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetFeatureInfo',
    LAYERS: layer,
    QUERY_LAYERS: layer,
    INFO_FORMAT: 'text/plain',
    CRS: 'EPSG:4326',
    BBOX: [(lat - d).toFixed(6), (lng - d).toFixed(6), (lat + d).toFixed(6), (lng + d).toFixed(6)].join(','),
    WIDTH: '101',
    HEIGHT: '101',
    I: '50',
    J: '50',
    FEATURE_COUNT: '5'
  });
  return base + params.toString();
}

async function queryLayer(
  terms: string[],
  lat: number,
  lng: number,
  fetcher: typeof fetch
): Promise<{ text: string | null; url: string }> {
  const capabilitiesUrl = HYDRO_WMS + 'REQUEST=GetCapabilities&SERVICE=WMS&VERSION=1.3.0';
  const capabilities = await fetchText(capabilitiesUrl, fetcher);
  if (!capabilities) return { text: null, url: capabilitiesUrl };
  const layer = findLayer(capabilities, terms);
  if (!layer) return { text: null, url: capabilitiesUrl };
  const url = infoUrl(HYDRO_WMS, layer, lat, lng);
  return { text: await fetchText(url, fetcher), url };
}

function addEvidence(
  evidence: EvidenceItem[],
  id: string,
  query: { text: string | null; url: string },
  claim: string,
  limitation: string,
  confidence: 'High' | 'Medium' | 'Low' = 'Medium'
): void {
  if (!query.text || /serviceexception|exceptionreport|error/i.test(query.text)) return;
  evidence.push({
    id,
    category: 'Hydrogeology',
    claim: claim + ' Official TLUBN response: ' + query.text.replace(/\s+/g, ' ').trim().slice(0, 1800),
    status: 'VERIFIED',
    sourceName: SOURCE,
    sourceUrl: query.url,
    datasetDate: today(),
    spatialRelationship: 'Official Thüringen GeoProxy WMS GetFeatureInfo response at the selected coordinate',
    calculationMethod: 'TLUBN GeoProxy WMS GetCapabilities layer discovery followed by point GetFeatureInfo query',
    confidence,
    limitation,
    value: { attributeResponse: query.text }
  });
}

export async function queryGermanyThuringiaHydrogeology(
  lat: number,
  lng: number,
  state: string | null | undefined,
  fetcher: typeof fetch = fetch
): Promise<GermanyThuringiaHydrogeologyResult> {
  const normalized = String(state || '').trim().toLowerCase();
  if (normalized && !['thüringen', 'thueringen', 'thuringia'].some(value => normalized === value || normalized.includes(value))) {
    return { state: STATE, evidence: [], hydrogeologyMapped: false, groundwaterDepthMapped: false };
  }

  const evidence: EvidenceItem[] = [];

  const hydro = await queryLayer(
    ['hydrogeologische übersichtskarte', 'huek200', 'hydrogeologie', 'aquifer'],
    lat, lng, fetcher
  );
  addEvidence(
    evidence,
    'de-th-huek200-hydrogeology',
    hydro,
    'The official Thüringen HÜK200 hydrogeological mapping provides regional information on groundwater-bearing units and hydrogeological conditions at the selected location.',
    'HÜK200 is regional mapping and does not establish a current site groundwater level or excavation inflow rate.'
  );

  const groundwaterDepth = await queryLayer(
    ['grundwasserflurabstand'],
    lat, lng, fetcher
  );
  addEvidence(
    evidence,
    'de-th-groundwater-depth',
    groundwaterDepth,
    'The official Thüringen Grundwasserflurabstand dataset describes the thickness of the unsaturated zone down to the upper groundwater body. This is directly relevant to screening whether groundwater may be encountered during excavation.',
    'The mapped groundwater depth represents an estimated regional mean condition. TLUBN describes the dataset as being derived from borehole groundwater intercepts in confined settings and mean groundwater levels combined with the DGM25 in unconfined settings. It is not a current site measurement and local/perched groundwater and seasonal variation can differ.',
    'High'
  );

  const groundwaterContours = await queryLayer(
    ['grundwassergleichenplan', 'grundwassergleichen', 'isohypse'],
    lat, lng, fetcher
  );
  addEvidence(
    evidence,
    'de-th-groundwater-contours',
    groundwaterContours,
    'The official Thüringen Grundwassergleichenplan provides regional groundwater-elevation contours for the upper main groundwater body and indicates broad groundwater flow gradients and other hydrogeological features.',
    'Groundwater contours describe regional hydraulic conditions. They should not be treated as a property-level current groundwater measurement.'
  );

  const protection = await queryLayer(
    ['schutzfunktion der grundwasserüberdeckung', 'schutzfunktion'],
    lat, lng, fetcher
  );
  addEvidence(
    evidence,
    'de-th-groundwater-cover-protection',
    protection,
    'The official Thüringen mapping includes the natural protective function of the groundwater-cover layers, which helps interpret how vulnerable groundwater may be to surface-derived contamination.',
    'This is a regional protection assessment and does not replace a site contamination investigation.'
  );

  if (!evidence.length) {
    evidence.push({
      id: 'de-th-hydrogeology-no-data',
      category: 'Hydrogeology',
      claim: 'The official Thüringen hydrogeological WMS did not return a usable attribute response for the selected coordinate.',
      status: 'REQUIRES_VERIFICATION',
      sourceName: SOURCE,
      sourceUrl: HYDRO_WMS,
      datasetDate: today(),
      spatialRelationship: 'Selected site coordinate in Thüringen',
      calculationMethod: 'Official TLUBN GeoProxy WMS query; missing responses are not interpreted as negative findings',
      confidence: 'Low',
      limitation: 'No current groundwater condition is inferred from a missing regional-map response.',
      value: { reasonCode: 'INSUFFICIENT_EVIDENCE' }
    });
  }

  return {
    state: STATE,
    evidence,
    hydrogeologyMapped: evidence.some(item => item.id === 'de-th-huek200-hydrogeology'),
    groundwaterDepthMapped: evidence.some(item => item.id === 'de-th-groundwater-depth')
  };
}

export function enrichGermanyThuringiaHydrogeology(
  report: VerifiedSiteReport & Record<string, any>,
  result: GermanyThuringiaHydrogeologyResult
): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...result.evidence);

  const hydro = result.evidence.find(item => item.id === 'de-th-huek200-hydrogeology' && item.status === 'VERIFIED');
  const groundwaterDepth = result.evidence.find(item => item.id === 'de-th-groundwater-depth' && item.status === 'VERIFIED');
  const contours = result.evidence.find(item => item.id === 'de-th-groundwater-contours' && item.status === 'VERIFIED');

  report.geosurvey_context = {
    ...(report.geosurvey_context || {}),
    th_hydrogeology_mapped: Boolean(hydro),
    th_groundwater_depth_mapped: Boolean(groundwaterDepth),
    th_groundwater_contours_mapped: Boolean(contours),
    th_hydrogeology_evidence_level: hydro || groundwaterDepth || contours ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
    th_hydrogeology_source: SOURCE
  };

  if (report.soil && (hydro || groundwaterDepth || contours)) {
    report.soil.groundwaterNotice = [
      groundwaterDepth?.claim,
      contours?.claim,
      hydro?.claim,
      'For construction screening, the mapped groundwater depth should be compared with the planned excavation depth. A property can be outside a mapped flood area and still encounter groundwater during excavation; local observations and site investigation remain necessary.'
    ].filter(Boolean).join(' ');
  }
}

export const GERMANY_THURINGIA_HYDROGEOLOGY_SOURCES = {
  hydrogeologyWms: HYDRO_WMS,
  groundwaterDepth: 'https://geomis.geoportal-th.de/geonetwork/srv/resources/datasets/72c4da04-160b-43d1-8c08-0768744c955a',
  groundwaterContours: 'https://geomis.geoportal-th.de/geonetwork/srv/search?keyword=Grundwasserscheiden',
  hydrogeologyMetadata: 'https://geomis.geoportal-th.de/geonetwork/srv/api/records/6004da0c-c9a6-442a-bd24-f4aef8fcfcdc'
};
