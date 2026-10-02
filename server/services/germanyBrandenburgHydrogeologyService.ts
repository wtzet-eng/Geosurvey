import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyBrandenburgHydrogeologyResult {
  state: 'Brandenburg';
  evidence: EvidenceItem[];
  nearSurfaceAquiferMapped: boolean;
  groundwaterCoverProtectionMapped: boolean;
  artesianGroundwaterMapped: boolean;
}

const HGK_WMS = 'https://inspire.brandenburg.de/services/hgk_wms?';
const SOURCE = 'LBGR Brandenburg — Hydrogeologische Karten HYK50';
const STATE = 'Brandenburg' as const;
const today = () => new Date().toISOString().slice(0, 10);

async function fetchText(url: string, fetcher: typeof fetch): Promise<string | null> {
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/xml, text/xml, text/plain' } });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

function findLayer(capabilities: string, terms: string[]): string | null {
  const layerPattern = /<Layer[^>]*>[\s\S]*?<Name>([^<]+)<\/Name>[\s\S]*?<Title>([^<]+)<\/Title>[\s\S]*?<\/Layer>/gi;
  for (const match of capabilities.matchAll(layerPattern)) {
    const name = match[1].trim();
    const title = match[2].trim().toLowerCase();
    if (terms.some(term => title.includes(term) || name.toLowerCase().includes(term))) return name;
  }
  return null;
}

function featureInfoUrl(layer: string, lat: number, lng: number): string {
  const d = 0.015;
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
  return HGK_WMS + new URLSearchParams({ ...Object.fromEntries(params), REQUEST: 'GetFeatureInfo' }).toString();
}

async function queryTheme(
  capabilities: string,
  terms: string[],
  lat: number,
  lng: number,
  fetcher: typeof fetch
): Promise<{ text: string | null; url: string; layer: string | null }> {
  const layer = findLayer(capabilities, terms);
  if (!layer) return { text: null, url: HGK_WMS, layer: null };
  const url = featureInfoUrl(layer, lat, lng);
  return { text: await fetchText(url, fetcher), url, layer };
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 1800);
}

function makeEvidence(
  id: string,
  response: string,
  url: string,
  claim: string,
  limitation: string
): EvidenceItem {
  return {
    id,
    category: 'Hydrogeology',
    claim: claim + ' Official LBGR response: ' + compact(response),
    status: 'VERIFIED',
    sourceName: SOURCE,
    sourceUrl: url,
    datasetDate: today(),
    spatialRelationship: 'Official LBGR WMS GetFeatureInfo response at the selected coordinate',
    calculationMethod: 'LBGR WMS GetCapabilities layer discovery followed by point GetFeatureInfo query',
    confidence: 'Medium',
    limitation,
    value: { attributeResponse: response }
  };
}

export async function queryGermanyBrandenburgHydrogeology(
  lat: number,
  lng: number,
  state: string | null | undefined,
  fetcher: typeof fetch = fetch
): Promise<GermanyBrandenburgHydrogeologyResult> {
  const normalized = String(state || '').trim().toLowerCase();
  const stateOk = !normalized || normalized.includes('brandenburg');
  if (!stateOk) {
    return { state: STATE, evidence: [], nearSurfaceAquiferMapped: false, groundwaterCoverProtectionMapped: false, artesianGroundwaterMapped: false };
  }

  const evidence: EvidenceItem[] = [];
  const capabilitiesUrl = HGK_WMS + 'REQUEST=GetCapabilities&SERVICE=WMS&VERSION=1.3.0';
  const capabilities = await fetchText(capabilitiesUrl, fetcher);

  if (capabilities) {
    const nearSurface = await queryTheme(capabilities, ['hyk50-1', 'oberflächennaher gwlk', 'oberflächennah'], lat, lng, fetcher);
    if (nearSurface.text) {
      evidence.push(makeEvidence(
        'de-bb-hyk50-near-surface-aquifer',
        nearSurface.text,
        nearSurface.url,
        'The LBGR HYK50 provides site-positioned regional information on the near-surface groundwater-bearing / groundwater-retarding system.',
        'HYK50 is detailed regional mapping, not a current groundwater-level measurement. It does not by itself establish seasonal high groundwater or excavation inflow.'
      ));
    }

    const protection = await queryTheme(capabilities, ['schutzfunktion grundwasserüberdeckung', 'hyk50-3'], lat, lng, fetcher);
    if (protection.text) {
      evidence.push(makeEvidence(
        'de-bb-hyk50-groundwater-cover-protection',
        protection.text,
        protection.url,
        'The LBGR HYK50 provides a mapped assessment of the protective function of the groundwater cover at the selected location.',
        'Protection-function mapping describes the regional protective character of the cover above groundwater. It is not a direct measurement of groundwater depth or construction dewatering demand.'
      ));
    }

    const artesian = await queryTheme(capabilities, ['artesisch-gespannte grundwasservorkommen', 'bohrungen_artesisch_gw'], lat, lng, fetcher);
    if (artesian.text && !/no feature|no features|empty/i.test(artesian.text)) {
      evidence.push(makeEvidence(
        'de-bb-artesian-groundwater',
        artesian.text,
        artesian.url,
        'The LBGR hydrogeological service contains mapped evidence concerning artesian/confined groundwater occurrences near the selected location.',
        'The artesian occurrence dataset is based on known boreholes and is not guaranteed complete; recorded water levels may relate to the time of drilling rather than present conditions.'
      ));
    }
  }

  if (!evidence.length) {
    evidence.push({
      id: 'de-bb-hydrogeology-no-data',
      category: 'Hydrogeology',
      claim: 'The official LBGR hydrogeological WMS did not return a usable attribute response for the selected coordinate.',
      status: 'REQUIRES_VERIFICATION',
      sourceName: SOURCE,
      sourceUrl: HGK_WMS,
      datasetDate: today(),
      spatialRelationship: 'Selected site coordinate in Brandenburg',
      calculationMethod: 'Official LBGR WMS query; missing responses are not interpreted as negative findings',
      confidence: 'Low',
      limitation: 'No current groundwater condition is inferred from a missing map response. Local groundwater observations remain necessary where excavation may interact with groundwater.',
      value: { reasonCode: 'INSUFFICIENT_EVIDENCE' }
    });
  }

  return {
    state: STATE,
    evidence,
    nearSurfaceAquiferMapped: evidence.some(item => item.id === 'de-bb-hyk50-near-surface-aquifer'),
    groundwaterCoverProtectionMapped: evidence.some(item => item.id === 'de-bb-hyk50-groundwater-cover-protection'),
    artesianGroundwaterMapped: evidence.some(item => item.id === 'de-bb-artesian-groundwater')
  };
}

export function enrichGermanyBrandenburgHydrogeology(
  report: VerifiedSiteReport & Record<string, any>,
  result: GermanyBrandenburgHydrogeologyResult
): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...result.evidence);

  const nearSurface = result.evidence.find(item => item.id === 'de-bb-hyk50-near-surface-aquifer' && item.status === 'VERIFIED');
  const protection = result.evidence.find(item => item.id === 'de-bb-hyk50-groundwater-cover-protection' && item.status === 'VERIFIED');
  const artesian = result.evidence.find(item => item.id === 'de-bb-artesian-groundwater' && item.status === 'VERIFIED');

  report.geosurvey_context = {
    ...(report.geosurvey_context || {}),
    bb_hyk50_near_surface_aquifer_mapped: Boolean(nearSurface),
    bb_hyk50_groundwater_cover_protection_mapped: Boolean(protection),
    bb_artesian_groundwater_mapped: Boolean(artesian),
    bb_hydrogeology_evidence_level: nearSurface || protection || artesian ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
    bb_hydrogeology_source: SOURCE
  };

  if (report.soil && (nearSurface || protection || artesian)) {
    report.soil.groundwaterNotice = [
      nearSurface?.claim,
      protection?.claim,
      artesian?.claim,
      'For construction screening, these regional data indicate the hydrogeological setting but do not replace site groundwater observations. Excavation depth, seasonal groundwater variation and local perched or confined water should be checked before dewatering assumptions are made.'
    ].filter(Boolean).join(' ');
  }
}

export const GERMANY_BRANDENBURG_HYDROGEOLOGY_SOURCES = {
  wms: HGK_WMS,
  capabilities: HGK_WMS + 'REQUEST=GetCapabilities&SERVICE=WMS&VERSION=1.3.0',
  dataset: 'LBGR Brandenburg — Hydrogeologisches Kartenwerk 1:50 000 (HYK50)'
};
