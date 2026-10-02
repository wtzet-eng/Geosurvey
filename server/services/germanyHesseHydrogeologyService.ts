import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyHesseHydrogeologyResult {
  state: 'Hessen';
  evidence: EvidenceItem[];
  hydrogeologyMapped: boolean;
  groundwaterMonitoringMapped: boolean;
  groundwaterDepthCoverage: 'available-in-rhine-main-plain' | 'not-available-statewide' | 'unknown';
}

const HUEK_WMS = 'https://services.bgr.de/wms/grundwasser/huek200_ogwl/?';
const PROTECTION_WMS = 'https://services.bgr.de/wms/grundwasser/sgwu/?';
const MONITORING_WMS = 'https://www.geoportal.hessen.de/mapbender/php/wms.php?inspire=1&layer_id=38405&';
const SOURCE = 'HLNUG / BGR Hessen — Hydrogeologie und Grundwasser';
const STATE = 'Hessen' as const;
const today = () => new Date().toISOString().slice(0, 10);

async function fetchText(url: string, fetcher: typeof fetch): Promise<string | null> {
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/xml, text/xml, text/plain' } });
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

function getFeatureInfoUrl(base: string, layer: string, lat: number, lng: number): string {
  const d = 0.015;
  return base + new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    LAYERS: layer,
    QUERY_LAYERS: layer,
    INFO_FORMAT: 'text/plain',
    SRS: 'EPSG:4326',
    BBOX: [(lng - d).toFixed(6), (lat - d).toFixed(6), (lng + d).toFixed(6), (lat + d).toFixed(6)].join(','),
    WIDTH: '101',
    HEIGHT: '101',
    X: '50',
    Y: '50',
    FEATURE_COUNT: '5'
  }).toString();
}

async function queryWms(
  base: string,
  terms: string[],
  lat: number,
  lng: number,
  fetcher: typeof fetch
): Promise<{ text: string | null; url: string }> {
  const capabilitiesUrl = base + 'REQUEST=GetCapabilities&SERVICE=WMS&VERSION=1.1.1';
  const capabilities = await fetchText(capabilitiesUrl, fetcher);
  if (!capabilities) return { text: null, url: capabilitiesUrl };
  const layer = findLayer(capabilities, terms);
  if (!layer) return { text: null, url: capabilitiesUrl };
  const url = getFeatureInfoUrl(base, layer, lat, lng);
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
    claim: claim + ' Official map response: ' + query.text.replace(/\s+/g, ' ').trim().slice(0, 1600),
    status: 'VERIFIED',
    sourceName: SOURCE,
    sourceUrl: query.url,
    datasetDate: today(),
    spatialRelationship: 'Official Hessen/BGR WMS GetFeatureInfo response at the selected coordinate',
    calculationMethod: 'WMS GetCapabilities layer discovery followed by point GetFeatureInfo query',
    confidence,
    limitation,
    value: { attributeResponse: query.text }
  });
}

export async function queryGermanyHesseHydrogeology(
  lat: number,
  lng: number,
  state: string | null | undefined,
  fetcher: typeof fetch = fetch
): Promise<GermanyHesseHydrogeologyResult> {
  const normalized = String(state || '').trim().toLowerCase();
  if (normalized && !['hessen', 'hesse'].includes(normalized)) {
    return { state: STATE, evidence: [], hydrogeologyMapped: false, groundwaterMonitoringMapped: false, groundwaterDepthCoverage: 'unknown' };
  }

  const evidence: EvidenceItem[] = [];

  const hydro = await queryWms(HUEK_WMS, ['hük200', 'huek200', 'hydrogeologische übersichtskarte', 'hydrogeologisch'], lat, lng, fetcher);
  addEvidence(
    evidence,
    'de-he-huek200-hydrogeology',
    hydro,
    'The HÜK200 hydrogeological mapping provides regional evidence on groundwater-bearing geological units and hydrogeological conditions.',
    'This is regional mapping and does not establish a current property groundwater level or excavation inflow rate.'
  );

  const protection = await queryWms(PROTECTION_WMS, ['schutzpotential', 'schutzpotenzial', 'grundwasserüberdeckung', 'schutzfunktion'], lat, lng, fetcher);
  addEvidence(
    evidence,
    'de-he-groundwater-cover-protection',
    protection,
    'The groundwater-cover protection mapping helps assess the natural protective function of overlying deposits for groundwater.',
    'Regional protection mapping does not replace a site contamination or groundwater investigation.'
  );

  const monitoring = await queryWms(MONITORING_WMS, ['grundwassermessstellen', 'groundwater monitoring', 'grundwasser'], lat, lng, fetcher);
  addEvidence(
    evidence,
    'de-he-groundwater-monitoring',
    monitoring,
    'The official Hessen groundwater monitoring network provides mapped groundwater monitoring points from the Hessian groundwater database and state groundwater service.',
    'A monitoring point is not itself a property groundwater level. Its screened interval, elevation, distance and time series must be considered before using it for site-specific interpretation.'
  );

  evidence.push({
    id: 'de-he-groundwater-depth-coverage',
    category: 'Hydrogeology',
    claim: 'HLNUG publishes groundwater-depth (Grundwasserflurabstand) and groundwater-elevation maps for the Hessian Rhine Plain and Main Plain. These maps provide area-wide information on groundwater depth and flow direction in those mapped areas.',
    status: 'VERIFIED',
    sourceName: 'HLNUG — Grundwasserstandskarten',
    sourceUrl: 'https://www.hlnug.de/themen/wasser/grundwasser/grundwasserkarten',
    datasetDate: today(),
    spatialRelationship: 'Hesse-wide service context; detailed mapped coverage is concentrated in the Hessian Rhine and Main plains',
    calculationMethod: 'Official HLNUG documentation review',
    confidence: 'High',
    limitation: 'HLNUG states that comparable groundwater-depth maps are not available statewide because monitoring density is insufficient in other parts of Hesse. Do not infer a groundwater depth where the detailed mapped coverage does not exist.',
    value: { coverage: 'Hessisches Ried / Mainebene' }
  });

  if (!evidence.some(item => item.status === 'VERIFIED')) {
    evidence.push({
      id: 'de-he-hydrogeology-no-data',
      category: 'Hydrogeology',
      claim: 'No usable attribute response was returned from the official Hessen/BGR hydrogeology services at the selected coordinate.',
      status: 'REQUIRES_VERIFICATION',
      sourceName: SOURCE,
      sourceUrl: HUEK_WMS,
      datasetDate: today(),
      spatialRelationship: 'Selected site coordinate in Hessen',
      calculationMethod: 'Official WMS queries; missing responses are not interpreted as negative findings',
      confidence: 'Low',
      limitation: 'No current groundwater condition is inferred from missing map responses.',
      value: { reasonCode: 'INSUFFICIENT_EVIDENCE' }
    });
  }

  return {
    state: STATE,
    evidence,
    hydrogeologyMapped: evidence.some(item => item.id === 'de-he-huek200-hydrogeology'),
    groundwaterMonitoringMapped: evidence.some(item => item.id === 'de-he-groundwater-monitoring'),
    groundwaterDepthCoverage: 'available-in-rhine-main-plain'
  };
}

export function enrichGermanyHesseHydrogeology(
  report: VerifiedSiteReport & Record<string, any>,
  result: GermanyHesseHydrogeologyResult
): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...result.evidence);

  const hydro = result.evidence.find(item => item.id === 'de-he-huek200-hydrogeology' && item.status === 'VERIFIED');
  const protection = result.evidence.find(item => item.id === 'de-he-groundwater-cover-protection' && item.status === 'VERIFIED');
  const monitoring = result.evidence.find(item => item.id === 'de-he-groundwater-monitoring' && item.status === 'VERIFIED');
  const depthCoverage = result.evidence.find(item => item.id === 'de-he-groundwater-depth-coverage');

  report.geosurvey_context = {
    ...(report.geosurvey_context || {}),
    he_hydrogeology_mapped: Boolean(hydro),
    he_groundwater_monitoring_mapped: Boolean(monitoring),
    he_groundwater_depth_mapping_available: result.groundwaterDepthCoverage === 'available-in-rhine-main-plain',
    he_hydrogeology_evidence_level: hydro || monitoring ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
    he_hydrogeology_source: SOURCE
  };

  if (report.soil && (hydro || monitoring || depthCoverage)) {
    report.soil.groundwaterNotice = [
      hydro?.claim,
      depthCoverage?.claim,
      monitoring?.claim,
      protection?.claim,
      'For construction screening, a mapped groundwater-depth value should only be used where the detailed HLNUG coverage applies. Elsewhere in Hessen, the hydrogeological setting and monitoring network can still indicate that groundwater investigation is warranted, but a statewide depth estimate should not be invented.',
      'A property can be outside a mapped flood area and still encounter groundwater during excavation.'
    ].filter(Boolean).join(' ');
  }
}

export const GERMANY_HESSE_HYDROGEOLOGY_SOURCES = {
  huek200Wms: HUEK_WMS,
  groundwaterCoverProtectionWms: PROTECTION_WMS,
  groundwaterMonitoringWms: MONITORING_WMS,
  groundwaterMaps: 'https://www.hlnug.de/themen/wasser/grundwasser/grundwasserkarten'
};
