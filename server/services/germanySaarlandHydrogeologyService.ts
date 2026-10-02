import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanySaarlandHydrogeologyResult {
  state: 'Saarland';
  evidence: EvidenceItem[];
  hydrogeologyMapped: boolean;
  groundwaterMonitoringMapped: boolean;
}

const HYDRO_WMS = 'https://geoportal.saarland.de/geoserver/ows?';
const SOURCE = 'LfU Saarland — Hydrogeologie / Grundwasser';
const STATE = 'Saarland' as const;
const today = () => new Date().toISOString().slice(0, 10);

async function fetchText(url: string, fetcher: typeof fetch): Promise<string | null> {
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/xml, text/xml, text/plain, application/json' } });
    return response.ok ? await response.text() : null;
  } catch { return null; }
}

function findLayer(capabilities: string, terms: string[]): string | null {
  const re = /<Layer[^>]*>[\s\S]*?<Name>([^<]+)<\/Name>[\s\S]*?(?:<Title>([^<]+)<\/Title>)?[\s\S]*?<\/Layer>/gi;
  for (const match of capabilities.matchAll(re)) {
    const name = match[1].trim();
    const title = (match[2] || '').trim().toLowerCase();
    if (terms.some(term => title.includes(term) || name.toLowerCase().includes(term))) return name;
  }
  return null;
}

function infoUrl(layer: string, lat: number, lng: number): string {
  const d = 0.02;
  return HYDRO_WMS + new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo',
    LAYERS: layer, QUERY_LAYERS: layer, INFO_FORMAT: 'text/plain',
    CRS: 'EPSG:4326',
    BBOX: [(lat - d).toFixed(6), (lng - d).toFixed(6), (lat + d).toFixed(6), (lng + d).toFixed(6)].join(','),
    WIDTH: '101', HEIGHT: '101', I: '50', J: '50', FEATURE_COUNT: '5'
  }).toString();
}

async function queryLayer(terms: string[], lat: number, lng: number, fetcher: typeof fetch) {
  const capabilitiesUrl = HYDRO_WMS + 'SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0';
  const capabilities = await fetchText(capabilitiesUrl, fetcher);
  if (!capabilities) return { text: null, url: capabilitiesUrl };
  const layer = findLayer(capabilities, terms);
  if (!layer) return { text: null, url: capabilitiesUrl };
  const url = infoUrl(layer, lat, lng);
  return { text: await fetchText(url, fetcher), url };
}

function addEvidence(evidence: EvidenceItem[], id: string, query: { text: string | null; url: string }, claim: string, limitation: string, confidence: 'High' | 'Medium' | 'Low' = 'Medium') {
  if (!query.text || /serviceexception|exceptionreport|error/i.test(query.text)) return;
  evidence.push({
    id, category: 'Hydrogeology',
    claim: claim + ' Official Saarland response: ' + query.text.replace(/\s+/g, ' ').trim().slice(0, 1800),
    status: 'VERIFIED', sourceName: SOURCE, sourceUrl: query.url, datasetDate: today(),
    spatialRelationship: 'Official Saarland Geoportal WMS GetFeatureInfo response at the selected coordinate',
    calculationMethod: 'Saarland Geoportal WMS GetCapabilities layer discovery followed by point GetFeatureInfo query',
    confidence, limitation, value: { attributeResponse: query.text }
  });
}

export async function queryGermanySaarlandHydrogeology(lat: number, lng: number, state: string | null | undefined, fetcher: typeof fetch = fetch): Promise<GermanySaarlandHydrogeologyResult> {
  const normalized = String(state || '').trim().toLowerCase();
  if (normalized && !['saarland'].includes(normalized)) return { state: STATE, evidence: [], hydrogeologyMapped: false, groundwaterMonitoringMapped: false };

  const evidence: EvidenceItem[] = [];

  const hydro = await queryLayer(['hydrogeologie', 'grundwasserleiter', 'hydrogeologische übersicht'], lat, lng, fetcher);
  addEvidence(evidence, 'de-sl-hydrogeology', hydro,
    'Official Saarland hydrogeological mapping identifies regional groundwater-bearing formations and hydrogeological conditions relevant to groundwater occurrence.',
    'Regional mapping does not establish a current property groundwater level or excavation inflow rate.');

  const groundwater = await queryLayer(['grundwasserkörper', 'grundwasser'], lat, lng, fetcher);
  addEvidence(evidence, 'de-sl-groundwater-body', groundwater,
    'Official Saarland water information identifies the groundwater body and regional groundwater setting at the selected location.',
    'Groundwater-body classification is regional and should not be interpreted as a site-specific groundwater level.');

  const monitoring = await queryLayer(['grundwassermessstellen', 'messstellen', 'grundwassermessnetz'], lat, lng, fetcher);
  addEvidence(evidence, 'de-sl-groundwater-monitoring', monitoring,
    'The Saarland groundwater monitoring network provides official observation points that can help put local groundwater conditions into regional context.',
    'A nearby monitoring station does not establish the groundwater level beneath the property; distance, screened aquifer, elevation and measurement date matter.');

  if (!evidence.length) evidence.push({
    id: 'de-sl-hydrogeology-no-data', category: 'Hydrogeology',
    claim: 'The official Saarland hydrogeological service did not return a usable attribute response for the selected coordinate.',
    status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: HYDRO_WMS, datasetDate: today(),
    spatialRelationship: 'Selected site coordinate in Saarland',
    calculationMethod: 'Official Saarland Geoportal WMS query; missing responses are not interpreted as negative findings',
    confidence: 'Low', limitation: 'No current groundwater condition is inferred from a missing regional-map response.',
    value: { reasonCode: 'INSUFFICIENT_EVIDENCE' }
  });

  return {
    state: STATE, evidence,
    hydrogeologyMapped: evidence.some(i => i.id === 'de-sl-hydrogeology' && i.status === 'VERIFIED'),
    groundwaterMonitoringMapped: evidence.some(i => i.id === 'de-sl-groundwater-monitoring' && i.status === 'VERIFIED')
  };
}

export function enrichGermanySaarlandHydrogeology(report: VerifiedSiteReport & Record<string, any>, result: GermanySaarlandHydrogeologyResult): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...result.evidence);
  const hydro = result.evidence.find(i => i.id === 'de-sl-hydrogeology' && i.status === 'VERIFIED');
  const body = result.evidence.find(i => i.id === 'de-sl-groundwater-body' && i.status === 'VERIFIED');
  const monitoring = result.evidence.find(i => i.id === 'de-sl-groundwater-monitoring' && i.status === 'VERIFIED');
  report.geosurvey_context = {
    ...(report.geosurvey_context || {}),
    sl_hydrogeology_mapped: Boolean(hydro),
    sl_groundwater_body_mapped: Boolean(body),
    sl_groundwater_monitoring_mapped: Boolean(monitoring),
    sl_hydrogeology_evidence_level: hydro || body || monitoring ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
    sl_hydrogeology_source: SOURCE
  };
  if (report.soil && (hydro || body || monitoring)) {
    report.soil.groundwaterNotice = [
      hydro?.claim, body?.claim, monitoring?.claim,
      'For construction screening, regional groundwater evidence should be compared with the planned excavation depth. A site can be outside a mapped flood area and still encounter groundwater during excavation.',
      'Local groundwater levels, perched water and seasonal effects require site-specific verification before dewatering assumptions are made.'
    ].filter(Boolean).join(' ');
  }
}

export const GERMANY_SAARLAND_HYDROGEOLOGY_SOURCES = {
  hydrogeologyWms: HYDRO_WMS,
  geoportal: 'https://geoportal.saarland.de/',
  waterInformation: 'https://www.saarland.de/mukmav/DE/portale/wasser/grundwasser/grundwasser_node.html',
  openData: 'https://www.shop.lvgl.saarland.de/index.php?id=18&option=com_content&view=article'
};
