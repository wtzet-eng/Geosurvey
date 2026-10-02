import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyLowerSaxonyHydrogeologyResult {
  state: 'Niedersachsen';
  evidence: EvidenceItem[];
  groundwaterSurfaceMapped: boolean;
  hydrogeologyMapped: boolean;
}

const LBEG_HYDRO_WMS = 'https://nibis.lbeg.de/net3/public/ogc.ashx?NodeId=37&Service=WMS';
const LBEG_HK50_GWO_WMS = 'https://nibis.lbeg.de/net3/public/ogc.ashx?NodeId=200&Service=WMS';
const SOURCE = 'LBEG Niedersachsen — Hydrogeologie / HK50 Grundwasseroberfläche';
const STATE = 'Niedersachsen' as const;
const today = () => new Date().toISOString().slice(0, 10);

function fetchText(url: string, fetcher: typeof fetch): Promise<{ ok: boolean; text?: string }> {
  return fetcher(url, { headers: { Accept: 'application/xml, text/xml, text/plain' } })
    .then(async response => ({ ok: response.ok, text: response.ok ? await response.text() : undefined }))
    .catch(() => ({ ok: false }));
}

function parseLayers(capabilities: string, terms: string[]): string | null {
  const matches = [...capabilities.matchAll(/<Layer[^>]*>[\\s\\S]*?<Name>([^<]+)<\\/Name>[\\s\\S]*?<Title>([^<]+)<\\/Title>[\\s\\S]*?<\\/Layer>/gi)];
  for (const match of matches) {
    const name = match[1].trim();
    const title = match[2].trim().toLowerCase();
    if (terms.some(term => title.includes(term) || name.toLowerCase().includes(term))) return name;
  }
  return null;
}

function getFeatureInfoUrl(baseUrl: string, layer: string, lat: number, lng: number): string {
  const delta = 0.015;
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetFeatureInfo',
    LAYERS: layer,
    QUERY_LAYERS: layer,
    INFO_FORMAT: 'text/plain',
    CRS: 'EPSG:4326',
    BBOX: [(lat - delta).toFixed(6), (lng - delta).toFixed(6), (lat + delta).toFixed(6), (lng + delta).toFixed(6)].join(','),
    WIDTH: '101',
    HEIGHT: '101',
    I: '50',
    J: '50',
    FEATURE_COUNT: '5'
  });
  return baseUrl + '&' + params.toString();
}

async function queryWmsTheme(
  baseUrl: string,
  terms: string[],
  lat: number,
  lng: number,
  fetcher: typeof fetch
): Promise<{ text: string | null; url: string; layer: string | null }> {
  const capabilitiesUrl = baseUrl + '&REQUEST=GetCapabilities&VERSION=1.3.0';
  const capabilities = await fetchText(capabilitiesUrl, fetcher);
  if (!capabilities.ok || !capabilities.text) return { text: null, url: capabilitiesUrl, layer: null };
  const layer = parseLayers(capabilities.text, terms);
  if (!layer) return { text: null, url: capabilitiesUrl, layer: null };
  const url = getFeatureInfoUrl(baseUrl, layer, lat, lng);
  const result = await fetchText(url, fetcher);
  return { text: result.ok ? result.text || null : null, url, layer };
}

function cleanAttributeResponse(value: string): string {
  return value.replace(/\\s+/g, ' ').trim().slice(0, 1600);
}

function groundwaterDepthClass(text: string): string | null {
  const match = text.match(/(?:tiefenstufe|grundwasserflurabstand|grundwasseroberfläche)[^\\n:]*[:=]\\s*([^\\n]+)/i);
  return match?.[1]?.trim() || null;
}

function evidenceFromWms(
  id: string,
  textValue: string,
  url: string,
  claim: string,
  limitation: string
): EvidenceItem {
  return {
    id,
    category: 'Hydrogeology',
    claim: claim + ' Official LBEG response: ' + cleanAttributeResponse(textValue),
    status: 'VERIFIED',
    sourceName: SOURCE,
    sourceUrl: url,
    datasetDate: today(),
    spatialRelationship: 'Official LBEG WMS GetFeatureInfo response at the selected coordinate',
    calculationMethod: 'LBEG WMS GetCapabilities layer discovery followed by point GetFeatureInfo query',
    confidence: 'Medium',
    limitation,
    value: { attributeResponse: textValue }
  };
}

export async function queryGermanyLowerSaxonyHydrogeology(
  lat: number,
  lng: number,
  state: string | null | undefined,
  fetcher: typeof fetch = fetch
): Promise<GermanyLowerSaxonyHydrogeologyResult> {
  const normalized = String(state || '').trim().toLowerCase();
  const stateOk = !normalized || normalized.includes('niedersachsen') || normalized.includes('lower saxony');
  if (!stateOk) return { state: STATE, evidence: [], groundwaterSurfaceMapped: false, hydrogeologyMapped: false };

  const evidence: EvidenceItem[] = [];

  const hydroUnit = await queryWmsTheme(
    LBEG_HYDRO_WMS,
    ['hydrogeologische einheiten', 'hydrogeologie'],
    lat,
    lng,
    fetcher
  );
  if (hydroUnit.text) {
    evidence.push(evidenceFromWms(
      'de-ni-hydrogeological-unit',
      hydroUnit.text,
      hydroUnit.url,
      'LBEG hydrogeological mapping provides regional information on the groundwater-bearing and groundwater-retarding character of the subsurface at the selected location.',
      'This is regional hydrogeological mapping. It does not establish a site-specific groundwater level, seasonal high water level or excavation inflow rate.'
    ));
  }

  const groundwater = await queryWmsTheme(
    LBEG_HK50_GWO_WMS,
    ['lage der grundwasseroberfläche', 'grundwasseroberfläche', 'tiefenstufen'],
    lat,
    lng,
    fetcher
  );
  if (groundwater.text) {
    const depthClass = groundwaterDepthClass(groundwater.text);
    evidence.push(evidenceFromWms(
      'de-ni-hk50-groundwater-surface',
      groundwater.text,
      groundwater.url,
      depthClass
        ? 'The LBEG HK50 maps a groundwater-surface/depth class at the selected location. This is directly relevant as screening evidence for possible groundwater encountered during excavation.'
        : 'The LBEG HK50 maps the regional groundwater surface of the first widespread groundwater-bearing layer in the unconsolidated areas of Lower Saxony at the selected location.',
      'LBEG states that the HK50 groundwater-surface mapping represents the first widespread aquifer in unconsolidated areas. It is a regional map, not a current site measurement; seasonal variation, local perched water and construction dewatering conditions require site-specific investigation.'
    ));
  }

  if (!evidence.length) {
    evidence.push({
      id: 'de-ni-hydrogeology-no-data',
      category: 'Hydrogeology',
      claim: 'The official LBEG hydrogeological WMS did not return a usable attribute response for the selected coordinate.',
      status: 'REQUIRES_VERIFICATION',
      sourceName: SOURCE,
      sourceUrl: LBEG_HYDRO_WMS,
      datasetDate: today(),
      spatialRelationship: 'Selected site coordinate in Niedersachsen',
      calculationMethod: 'Official LBEG WMS query; empty or failed responses are not interpreted as negative findings',
      confidence: 'Low',
      limitation: 'No current groundwater condition is inferred from a missing regional-map response. Local investigation remains necessary where groundwater may affect construction.',
      value: { reasonCode: 'INSUFFICIENT_EVIDENCE' }
    });
  }

  return {
    state: STATE,
    evidence,
    groundwaterSurfaceMapped: evidence.some(item => item.id === 'de-ni-hk50-groundwater-surface'),
    hydrogeologyMapped: evidence.some(item => item.id === 'de-ni-hydrogeological-unit')
  };
}

export function enrichGermanyLowerSaxonyHydrogeology(
  report: VerifiedSiteReport & Record<string, any>,
  result: GermanyLowerSaxonyHydrogeologyResult
): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...result.evidence);

  const groundwater = result.evidence.find(item => item.id === 'de-ni-hk50-groundwater-surface' && item.status === 'VERIFIED');
  const hydro = result.evidence.find(item => item.id === 'de-ni-hydrogeological-unit' && item.status === 'VERIFIED');

  report.geosurvey_context = {
    ...(report.geosurvey_context || {}),
    ni_hk50_groundwater_surface_mapped: Boolean(groundwater),
    ni_hydrogeological_unit_mapped: Boolean(hydro),
    ni_hydrogeology_evidence_level: groundwater || hydro ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
    ni_hydrogeology_source: SOURCE
  };

  if (report.soil && (groundwater || hydro)) {
    report.soil.groundwaterNotice = [
      groundwater?.claim,
      hydro?.claim,
      'For construction screening, this should be read as an indication of possible groundwater conditions rather than a current water-table measurement; local groundwater observations and the planned excavation depth are needed to assess dewatering requirements.'
    ].filter(Boolean).join(' ');
  }
}

export const GERMANY_LOWER_SAXONY_HYDROGEOLOGY_SOURCES = {
  hydrogeologyWms: LBEG_HYDRO_WMS,
  groundwaterSurfaceWms: LBEG_HK50_GWO_WMS,
  dataset: 'LBEG Niedersachsen — Hydrogeologie / Hydrogeologische Karte 1:50.000'
};
