import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanySchleswigHolsteinHydrogeologyResult {
  state: 'Schleswig-Holstein';
  evidence: EvidenceItem[];
  hydrogeologyMapped: boolean;
  groundwaterDepthMapped: boolean;
  groundwaterDepthType: 'pedological-screening' | 'not-mapped';
}

const HYDRO_WMS = 'https://umweltgeodienste.schleswig-holstein.de/WMS_Hydrogeologie?';
const SOIL_WMS = 'https://umweltgeodienste.schleswig-holstein.de/WMS_BodenkundlicheKarten?';
const SOURCE = 'LfU Schleswig-Holstein — Hydrogeologie / Grundwasser';
const STATE = 'Schleswig-Holstein' as const;
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

function infoUrl(base: string, layer: string, lat: number, lng: number): string {
  const d = 0.02;
  return base + new URLSearchParams({
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
  }).toString();
}

async function queryLayer(
  base: string,
  terms: string[],
  lat: number,
  lng: number,
  fetcher: typeof fetch
): Promise<{ text: string | null; url: string }> {
  const capabilitiesUrl = base + 'REQUEST=GetCapabilities&SERVICE=WMS&VERSION=1.3.0';
  const capabilities = await fetchText(capabilitiesUrl, fetcher);
  if (!capabilities) return { text: null, url: capabilitiesUrl };
  const layer = findLayer(capabilities, terms);
  if (!layer) return { text: null, url: capabilitiesUrl };
  const url = infoUrl(base, layer, lat, lng);
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
    claim: claim + ' Official Schleswig-Holstein response: ' + query.text.replace(/\s+/g, ' ').trim().slice(0, 1800),
    status: 'VERIFIED',
    sourceName: SOURCE,
    sourceUrl: query.url,
    datasetDate: today(),
    spatialRelationship: 'Official LfU Schleswig-Holstein WMS GetFeatureInfo response at the selected coordinate',
    calculationMethod: 'WMS GetCapabilities layer discovery followed by point GetFeatureInfo query',
    confidence,
    limitation,
    value: { attributeResponse: query.text }
  });
}

export async function queryGermanySchleswigHolsteinHydrogeology(
  lat: number,
  lng: number,
  state: string | null | undefined,
  fetcher: typeof fetch = fetch
): Promise<GermanySchleswigHolsteinHydrogeologyResult> {
  const normalized = String(state || '').trim().toLowerCase();
  if (normalized && !['schleswig-holstein', 'schleswig holstein', 'schleswigholstein'].includes(normalized)) {
    return { state: STATE, evidence: [], hydrogeologyMapped: false, groundwaterDepthMapped: false, groundwaterDepthType: 'not-mapped' };
  }

  const evidence: EvidenceItem[] = [];

  const hydro = await queryLayer(
    HYDRO_WMS,
    ['hydrogeologische übersichtskarten', 'hydrogeologische übersichtskarte', 'oberflächennaher wasserleiter', 'wasserleiter', 'hydrogeologie'],
    lat, lng, fetcher
  );
  addEvidence(
    evidence,
    'de-sh-hydrogeology',
    hydro,
    'The official Schleswig-Holstein hydrogeological mapping provides regional information on groundwater-bearing units, aquifer distribution and the hydrostratigraphic setting.',
    'The mapping is regional and does not establish a current property groundwater level or excavation inflow rate.'
  );

  const aquiferProtection = await queryLayer(
    HYDRO_WMS,
    ['schutzwirkung der deckschichten', 'schutzwirkung', 'deckschichten'],
    lat, lng, fetcher
  );
  addEvidence(
    evidence,
    'de-sh-groundwater-cover-protection',
    aquiferProtection,
    'The official Schleswig-Holstein mapping includes the protective effect of confining cover layers above near-surface groundwater systems.',
    'Regional protection mapping does not replace a site contamination or groundwater investigation.'
  );

  const groundwaterDepth = await queryLayer(
    SOIL_WMS,
    ['grundwasserflurabstand', 'grundwasserstufe'],
    lat, lng, fetcher
  );
  addEvidence(
    evidence,
    'de-sh-groundwater-depth-screening',
    groundwaterDepth,
    'The official Schleswig-Holstein pedological groundwater-depth mapping provides a seven-class screening of mean groundwater depth conditions; this can be useful for identifying sites where shallow groundwater may complicate excavation.',
    'This is a pedological groundwater-depth interpretation, not the hydrogeological groundwater table. Values below 2 m are not differentiated, the mapping is based on the 1:250,000 soil overview and land-use differentiation, and local drainage and scale effects can materially change conditions. It is not suitable as parcel-level construction proof.'
  , 'High');

  if (!evidence.length) {
    evidence.push({
      id: 'de-sh-hydrogeology-no-data',
      category: 'Hydrogeology',
      claim: 'The official Schleswig-Holstein hydrogeological services did not return a usable attribute response for the selected coordinate.',
      status: 'REQUIRES_VERIFICATION',
      sourceName: SOURCE,
      sourceUrl: HYDRO_WMS,
      datasetDate: today(),
      spatialRelationship: 'Selected site coordinate in Schleswig-Holstein',
      calculationMethod: 'Official LfU Schleswig-Holstein WMS query; missing responses are not interpreted as negative findings',
      confidence: 'Low',
      limitation: 'No current groundwater condition is inferred from a missing regional-map response.',
      value: { reasonCode: 'INSUFFICIENT_EVIDENCE' }
    });
  }

  return {
    state: STATE,
    evidence,
    hydrogeologyMapped: evidence.some(item => item.id === 'de-sh-hydrogeology'),
    groundwaterDepthMapped: evidence.some(item => item.id === 'de-sh-groundwater-depth-screening'),
    groundwaterDepthType: evidence.some(item => item.id === 'de-sh-groundwater-depth-screening') ? 'pedological-screening' : 'not-mapped'
  };
}

export function enrichGermanySchleswigHolsteinHydrogeology(
  report: VerifiedSiteReport & Record<string, any>,
  result: GermanySchleswigHolsteinHydrogeologyResult
): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...result.evidence);

  const hydro = result.evidence.find(item => item.id === 'de-sh-hydrogeology' && item.status === 'VERIFIED');
  const protection = result.evidence.find(item => item.id === 'de-sh-groundwater-cover-protection' && item.status === 'VERIFIED');
  const depth = result.evidence.find(item => item.id === 'de-sh-groundwater-depth-screening' && item.status === 'VERIFIED');

  report.geosurvey_context = {
    ...(report.geosurvey_context || {}),
    sh_hydrogeology_mapped: Boolean(hydro),
    sh_groundwater_depth_mapped: Boolean(depth),
    sh_groundwater_depth_type: result.groundwaterDepthType,
    sh_hydrogeology_evidence_level: hydro || depth ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
    sh_hydrogeology_source: SOURCE
  };

  if (report.soil && (hydro || depth || protection)) {
    report.soil.groundwaterNotice = [
      depth?.claim,
      hydro?.claim,
      protection?.claim,
      'For construction screening, shallow groundwater indications should be compared with the planned excavation depth. A property can be outside a mapped flood area and still encounter groundwater during excavation.',
      'The Schleswig-Holstein pedological groundwater-depth map is a regional screening layer, not a parcel-level groundwater measurement; local groundwater observations and site investigation remain necessary before dewatering assumptions are made.'
    ].filter(Boolean).join(' ');
  }
}

export const GERMANY_SCHLESWIG_HOLSTEIN_HYDROGEOLOGY_SOURCES = {
  hydrogeologyWms: HYDRO_WMS,
  soilGroundwaterDepthWms: SOIL_WMS,
  hydrogeologyCapabilities: 'https://umweltgeodienste.schleswig-holstein.de/WMS_Hydrogeologie?SERVICE=WMS&REQUEST=GetCapabilities&',
  soilCapabilities: 'https://umweltgeodienste.schleswig-holstein.de/WMS_BodenkundlicheKarten?SERVICE=WMS&REQUEST=GetCapabilities&',
  metadata: 'https://umweltportal.schleswig-holstein.de/trefferanzeige?docuuid=D822BE72-1292-4D4A-A6F1-6B7C2F2EDFB0'
};
