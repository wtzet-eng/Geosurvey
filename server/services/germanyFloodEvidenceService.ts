import type { EvidenceItem } from '../types';

const BAFG_BASE = 'https://geoportal.bafg.de/arcgis3/rest/services/nHWGK_HWRK';
const PORTAL = 'https://geoportal.bafg.de/karten/HWRM/';
const today = () => new Date().toISOString().slice(0, 10);
type FetchLike = typeof fetch;

function makeEvidence(id: string, claim: string, sourceUrl: string, value: Record<string, unknown>, status: 'VERIFIED' | 'REQUIRES_VERIFICATION', limitation: string): EvidenceItem {
  return { id, category: 'Flooding / water risk', claim, status, sourceName: 'WasserBLIcK / Bundesanstalt für Gewässerkunde (BfG) & Länder authorities', sourceUrl, datasetDate: today(), spatialRelationship: 'Selected site coordinate tested against the national flood-hazard map layer', calculationMethod: 'BfG ArcGIS REST spatial query against the state-specific flood-depth layer', confidence: status === 'VERIFIED' ? 'High' : 'Low', value, limitation };
}

async function queryLayer(layerPath: string, lat: number, lng: number, fetcher: FetchLike): Promise<any | null> {
  const params = new URLSearchParams({ where: '1=1', geometry: JSON.stringify({ x: lng, y: lat }), geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'false', f: 'json' });
  try {
    const response = await fetcher(BAFG_BASE + '/' + layerPath + '/MapServer/7/query?' + params.toString(), { headers: { Accept: 'application/json', 'User-Agent': 'GroundSurf/1.0 Germany flood evidence' } });
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.error || !Array.isArray(data?.features)) return null;
    return data.features[0] || null;
  } catch { return null; }
}

function layerForState(state: string | null | undefined): string | null {
  const normalized = String(state || '').trim().toLowerCase();
  return normalized === 'mecklenburg-vorpommern' || normalized === 'mecklenburg-western pomerania' || normalized === 'mecklenburg-vorpommern, deutschland' ? '7' : null;
}

function depthLabel(tClass: unknown): string | null {
  const n = Number(tClass);
  if (!Number.isFinite(n)) return null;
  const labels: Record<number, string> = { 11: '0–0.5 m', 12: '>0.5–1 m', 13: '>1–2 m', 14: '>2–4 m', 15: '>4 m', 21: 'protected area 0–0.5 m', 22: 'protected area >0.5–1 m', 23: 'protected area >1–2 m', 24: 'protected area >2–4 m', 25: 'protected area >4 m', 31: 'informational area 0–0.5 m', 32: 'informational area >0.5–1 m', 33: 'informational area >1–2 m', 34: 'informational area >2–4 m', 35: 'informational area >4 m' };
  return labels[n] || null;
}

export async function queryGermanyFloodEvidence(lat: number, lng: number, state: string | null | undefined, fetcher: FetchLike = fetch): Promise<EvidenceItem[]> {
  if (!layerForState(state)) return [makeEvidence('de-flood-state-open', 'Germany has official national flood-hazard mapping assembled from the Länder, but the current GroundSurf integration has not yet matched a state-specific query layer for this location.', PORTAL, { reasonCode: 'STATE_LAYER_NOT_YET_INTEGRATED', state: state || null }, 'REQUIRES_VERIFICATION', 'The national flood framework is available, but a missing state-specific integration is not evidence that flood hazard is absent.')];
  const [medium, low] = await Promise.all([queryLayer('RWMe', lat, lng, fetcher), queryLayer('RWlo', lat, lng, fetcher)]);
  const evidence: EvidenceItem[] = [];
  const mediumDepth = depthLabel(medium?.attributes?.T_class);
  const lowDepth = depthLabel(low?.attributes?.T_class);
  if (medium) evidence.push(makeEvidence('de-mv-flood-medium', 'The national German flood-hazard service returns a medium-probability river-flood inundation polygon at the selected coordinate for Mecklenburg-Vorpommern' + (mediumDepth ? ', with mapped water-depth class ' + mediumDepth : '') + '.', BAFG_BASE + '/RWMe/MapServer/7', { scenario: 'medium probability', waterDepthClass: mediumDepth, T_class: medium.attributes?.T_class ?? null, state: 'Mecklenburg-Vorpommern' }, 'VERIFIED', 'This is mapped flood-hazard evidence, not a measurement of flood depth at the property. Current legally designated flood areas should be confirmed with the competent Land authority.'));
  else evidence.push(makeEvidence('de-mv-flood-medium-open', 'The BfG national medium-probability flood-hazard query returned no polygon containing the selected coordinate in the integrated Mecklenburg-Vorpommern layer.', BAFG_BASE + '/RWMe/MapServer/7', { scenario: 'medium probability', reasonCode: 'NO_RETURNED_POLYGON', state: 'Mecklenburg-Vorpommern' }, 'REQUIRES_VERIFICATION', 'No returned polygon is not proof that the property cannot flood; other scenarios, surface-water flooding and updated Land datasets require separate checks.'));
  if (low) evidence.push(makeEvidence('de-mv-flood-low', 'The national German flood-hazard service returns a low-probability river-flood inundation polygon at the selected coordinate for Mecklenburg-Vorpommern' + (lowDepth ? ', with mapped water-depth class ' + lowDepth : '') + '.', BAFG_BASE + '/RWlo/MapServer/7', { scenario: 'low probability', waterDepthClass: lowDepth, T_class: low.attributes?.T_class ?? null, state: 'Mecklenburg-Vorpommern' }, 'VERIFIED', 'This is mapped flood-hazard evidence, not a measurement of flood depth at the property. Current legally designated flood areas should be confirmed with the competent Land authority.'));
  else evidence.push(makeEvidence('de-mv-flood-low-open', 'The BfG national low-probability flood-hazard query returned no polygon containing the selected coordinate in the integrated Mecklenburg-Vorpommern layer.', BAFG_BASE + '/RWlo/MapServer/7', { scenario: 'low probability', reasonCode: 'NO_RETURNED_POLYGON', state: 'Mecklenburg-Vorpommern' }, 'REQUIRES_VERIFICATION', 'No returned polygon is not proof that the property cannot flood; other scenarios, surface-water flooding and updated Land datasets require separate checks.'));
  return evidence;
}

export const GERMANY_FLOOD_SOURCES = { portal: PORTAL, medium: BAFG_BASE + '/RWMe/MapServer/7', low: BAFG_BASE + '/RWlo/MapServer/7' };