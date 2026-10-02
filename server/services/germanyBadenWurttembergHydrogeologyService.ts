import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyBwHydrogeologyResult {
  state: 'Baden-Württemberg';
  evidence: EvidenceItem[];
  hydrogeologicalUnitFound: boolean;
  protectiveCoverFound: boolean;
}

const HK50_WMS = 'https://services.lgrb-bw.de/ms/lgrb_geola_hyd';
const HK50_SF_WMS = 'https://services.lgrb-bw.de/ms/lgrb_hyd_sf';
const SOURCE = 'LGRB Baden-Württemberg — Hydrogeologische Karte 1:50.000 (GeoLa HK50)';
const PROTECTION_SOURCE = 'LGRB Baden-Württemberg — Schutzfunktion der Grundwasserüberdeckung (GeoLa)';
const STATE = 'Baden-Württemberg' as const;
const today = () => new Date().toISOString().slice(0, 10);

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function noData(id: string, claim: string, url: string, sourceName = SOURCE): EvidenceItem {
  return {
    id,
    category: 'Hydrogeology',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName,
    sourceUrl: url,
    datasetDate: today(),
    spatialRelationship: 'Selected site coordinate in Baden-Württemberg',
    calculationMethod: 'Official LGRB GeoLa service acquisition; empty or failed responses are not interpreted as negative findings',
    confidence: 'Low',
    limitation: 'Regional mapping does not establish site-specific groundwater depth or current seasonal groundwater conditions. Confirm with local investigation where construction decisions depend on groundwater.',
    value: { reasonCode: 'INSUFFICIENT_EVIDENCE' }
  };
}

async function fetchText(url: string, fetcher: typeof fetch): Promise<{ ok: boolean; text?: string }> {
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/xml, text/xml, application/json' } });
    if (!response.ok) return { ok: false };
    return { ok: true, text: await response.text() };
  } catch {
    return { ok: false };
  }
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
  const delta = 0.01;
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
  return baseUrl + '?' + params.toString();
}

async function queryWmsTheme(
  baseUrl: string,
  capabilityTerms: string[],
  lat: number,
  lng: number,
  fetcher: typeof fetch
): Promise<{ text: string | null; url: string; layer: string | null }> {
  const capabilitiesUrl = baseUrl + '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities';
  const capabilities = await fetchText(capabilitiesUrl, fetcher);
  if (!capabilities.ok || !capabilities.text) return { text: null, url: capabilitiesUrl, layer: null };
  const layer = parseLayers(capabilities.text, capabilityTerms);
  if (!layer) return { text: null, url: capabilitiesUrl, layer: null };
  const url = getFeatureInfoUrl(baseUrl, layer, lat, lng);
  const result = await fetchText(url, fetcher);
  return { text: result.ok ? result.text || null : null, url, layer };
}

function buildWmsEvidence(
  id: string,
  sourceName: string,
  textValue: string,
  url: string,
  claim: string,
  limitation: string
): EvidenceItem {
  return {
    id,
    category: 'Hydrogeology',
    claim: claim + (textValue ? ' Official attribute response: ' + textValue.slice(0, 1200) : ''),
    status: 'VERIFIED',
    sourceName,
    sourceUrl: url,
    datasetDate: today(),
    spatialRelationship: 'Official LGRB WMS GetFeatureInfo response at the selected coordinate',
    calculationMethod: 'Official LGRB WMS GetCapabilities layer discovery followed by GetFeatureInfo at the selected coordinate',
    confidence: 'Medium',
    limitation,
    value: { attributeResponse: textValue }
  };
}

async function queryHydrogeology(lat: number, lng: number, fetcher: typeof fetch): Promise<GermanyBwHydrogeologyResult> {
  const evidence: EvidenceItem[] = [];

  const unit = await queryWmsTheme(HK50_WMS, ['hydrogeologische einheiten'], lat, lng, fetcher);
  if (unit.text) {
    evidence.push(buildWmsEvidence(
      'de-bw-hk50-hydrogeological-unit',
      SOURCE,
      unit.text,
      unit.url,
      'The official LGRB HK50 identifies hydrogeological information at the selected coordinate, including the mapped hydrogeological unit where available.',
      'HK50 is a regional 1:50,000 planning-scale dataset. LGRB states that individual-parcel conclusions cannot be derived from HK50 alone.'
    ));
  }

  const pgwl = await queryWmsTheme(HK50_WMS, ['porengrundwasserleiter'], lat, lng, fetcher);
  if (pgwl.text) {
    evidence.push(buildWmsEvidence(
      'de-bw-hk50-porous-aquifer',
      SOURCE,
      pgwl.text,
      pgwl.url,
      'The official LGRB HK50 identifies information about porous groundwater-bearing deposits at the selected coordinate where mapped.',
      'The mapped porous aquifer information is regional screening evidence and does not establish groundwater depth or seasonal water levels.'
    ));
  }

  const protection = await queryWmsTheme(HK50_SF_WMS, ['gesamtschutzfunktion der grundwasserüberdeckung', 'schutzfunktion der grundwasserüberdeckung'], lat, lng, fetcher);
  if (protection.text) {
    evidence.push(buildWmsEvidence(
      'de-bw-groundwater-cover-protection',
      PROTECTION_SOURCE,
      protection.text,
      protection.url,
      'The official LGRB dataset provides a regional assessment of the protective function of the groundwater overburden at the selected coordinate.',
      'The LGRB describes this as a regional overview dataset; it is not suitable for parcel-level conclusions. Input-data quality varies regionally and karst can reduce protection more than the model indicates.'
    ));
  }

  if (!evidence.length) {
    evidence.push(noData(
      'de-bw-hk50-no-data',
      'The official LGRB hydrogeological services did not return a usable attribute response for the selected coordinate.',
      HK50_WMS
    ));
  }

  return {
    state: STATE,
    evidence,
    hydrogeologicalUnitFound: evidence.some(item => item.id === 'de-bw-hk50-hydrogeological-unit'),
    protectiveCoverFound: evidence.some(item => item.id === 'de-bw-groundwater-cover-protection')
  };
}

function buildEvidence(id: string, feature: any, url: string, claimPrefix: string): EvidenceItem {
  const properties = feature?.properties && typeof feature.properties === 'object' ? feature.properties : {};
  const entries = Object.entries(properties)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim())
    .slice(0, 8)
    .map(([key, value]) => key + '=' + String(value))
    .join('; ');
  return {
    id,
    category: 'Hydrogeology',
    claim: claimPrefix + (entries ? ' Mapped attributes: ' + entries + '.' : ''),
    status: 'VERIFIED',
    sourceName: SOURCE,
    sourceUrl: url,
    datasetDate: today(),
    spatialRelationship: 'Official LGRB HK50 feature returned for the selected coordinate area',
    calculationMethod: 'LGRB GeoLa HK50 WFS spatial query using a small WGS84 bounding box around the selected coordinate',
    confidence: 'Medium',
    limitation: 'HK50 is a regional 1:50,000 planning-scale dataset. LGRB states that individual-property conclusions cannot be derived from HK50 alone; site investigation is required for site-specific decisions.',
    value: { properties }
  };
}

async function queryHydrogeology(lat: number, lng: number, fetcher: typeof fetch): Promise<GermanyBwHydrogeologyResult> {
  const evidence: EvidenceItem[] = [];
  const unit = await queryLayer('hydrogeologische_grundflaechen', lat, lng, fetcher);
  if (unit.feature) {
    evidence.push(buildEvidence(
      'de-bw-hk50-hydrogeological-unit',
      unit.feature,
      unit.url,
      'The official LGRB HK50 maps the selected location within a hydrogeological unit. The unit characterises groundwater-bearing behaviour, permeability and hydrogeological rock type.'
    ));
  }

  const cover = await queryLayer('hydrogeologische_deckschichten', lat, lng, fetcher);
  if (cover.feature) {
    evidence.push(buildEvidence(
      'de-bw-hk50-protective-cover',
      cover.feature,
      cover.url,
      'The official LGRB HK50 maps a hydrogeological cover-layer unit at the selected location. Cover layers can influence groundwater recharge, protection and the movement of water toward the aquifer.'
    ));
  }

  if (!evidence.length) {
    evidence.push(noData(
      'de-bw-hk50-no-data',
      'The official LGRB HK50 service did not return a usable hydrogeological feature for the selected coordinate.',
      HK50_WMS
    ));
  }

  return {
    state: STATE,
    evidence,
    hydrogeologicalUnitFound: evidence.some(item => item.id === 'de-bw-hk50-hydrogeological-unit'),
    protectiveCoverFound: evidence.some(item => item.id === 'de-bw-hk50-protective-cover')
  };
}

export async function queryGermanyBwHydrogeology(
  lat: number,
  lng: number,
  state: string | null | undefined,
  fetcher: typeof fetch = fetch
): Promise<GermanyBwHydrogeologyResult> {
  const normalized = String(state || '').trim().toLowerCase();
  const stateOk = !normalized || normalized.includes('baden-württemberg') || normalized.includes('baden-wuerttemberg');
  if (!stateOk) return { state: STATE, evidence: [], hydrogeologicalUnitFound: false, protectiveCoverFound: false };
  return queryHydrogeology(lat, lng, fetcher);
}

export function enrichGermanyBwHydrogeology(
  report: VerifiedSiteReport & Record<string, any>,
  result: GermanyBwHydrogeologyResult
): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...result.evidence);

  const unit = result.evidence.find(item => item.id === 'de-bw-hk50-hydrogeological-unit' && item.status === 'VERIFIED');
  const cover = result.evidence.find(item => item.id === 'de-bw-hk50-protective-cover' && item.status === 'VERIFIED');

  report.geosurvey_context = {
    ...(report.geosurvey_context || {}),
    bw_hk50_hydrogeological_unit_mapped: Boolean(unit),
    bw_hk50_cover_layer_mapped: Boolean(cover),
    bw_hk50_evidence_level: unit || cover ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
    bw_hk50_source: SOURCE
  };

  if (report.soil && (unit || cover)) {
    report.soil.groundwaterNotice = [
      unit?.claim,
      cover?.claim,
      'This Baden-Württemberg regional hydrogeological mapping is screening evidence. It does not establish the current groundwater level or whether excavation will require dewatering.'
    ].filter(Boolean).join(' ');
  }
}

export const GERMANY_BW_HYDROGEOLOGY_SOURCES = {
  wms: HK50_WMS,
  protectionWms: HK50_SF_WMS,
  dataset: 'GeoFachdaten BW — Hydrogeologie (GeoLa HK50)',
  protectionDataset: 'GeoFachdaten BW — Schutzfunktion der Grundwasserüberdeckung (HK50_SF)'
};
