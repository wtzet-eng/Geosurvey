import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyBwHydrogeologyResult {
  state: 'Baden-Württemberg';
  evidence: EvidenceItem[];
  hydrogeologicalUnitFound: boolean;
  protectiveCoverFound: boolean;
}

const HK50_WMS = 'https://ows.lgrb-bw.de/geoserver/lgrb_hk50/wms';
const HK50_WFS = 'https://ows.lgrb-bw.de/geoserver/lgrb_hk50/ows';
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

function wfsUrl(typeName: string, lat: number, lng: number): string {
  const delta = 0.001;
  const params = new URLSearchParams({
    service: 'WFS',
    version: '1.1.0',
    request: 'GetFeature',
    typeName,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    maxFeatures: '5',
    bbox: [(lng - delta).toFixed(6), (lat - delta).toFixed(6), (lng + delta).toFixed(6), (lat + delta).toFixed(6), 'EPSG:4326'].join(',')
  });
  return HK50_WFS + '?' + params.toString();
}

function parseJsonFeatures(raw: string): any[] {
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data?.features) ? data.features : [];
  } catch {
    return [];
  }
}

function xmlFeatureText(raw: string): string {
  return raw.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

async function queryLayer(typeName: string, lat: number, lng: number, fetcher: typeof fetch): Promise<{ feature: any | null; url: string }> {
  const url = wfsUrl(typeName, lat, lng);
  const response = await fetchText(url, fetcher);
  if (!response.ok || !response.text) return { feature: null, url };
  const features = parseJsonFeatures(response.text);
  return { feature: features[0] || null, url };
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
  wfs: HK50_WFS,
  dataset: 'GeoFachdaten BW — Hydrogeologie (GeoLa HK50)',
  protectionDataset: 'GeoFachdaten BW — Schutzfunktion der Grundwasserüberdeckung (HK50_SF)'
};
