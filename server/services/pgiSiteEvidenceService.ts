import { resolveSource } from '../sources/resolver';
import { LogicalSourceId, ResolutionResult, SourceEndpoint, SourceProvenance } from '../sources/sourceTypes';
import { EvidenceLevel } from '../types';
import { AvailabilityReason } from '../reporting/canonicalReport';
import { MappedGroundSample, SpatialEvidenceScope, SpatialSamplePoint, summarizeGroundContext } from './groundContextService';

export interface PgiSiteEvidence {
  id: string;
  category: string;
  claim: string;
  status: EvidenceLevel;
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  spatialRelationship: string;
  calculationMethod: string;
  confidence: 'High' | 'Medium' | 'Low';
  value: unknown;
  limitation: string;
  reasonCode?: AvailabilityReason;
  resolverProvenance?: SourceProvenance;
  spatialScope?: SpatialEvidenceScope;
}

type FetchLike = typeof fetch;
type GeologicalField = 'unit' | 'lithology' | 'period' | 'genesis';
const SOURCE = 'Państwowy Instytut Geologiczny – PIB';
const today = () => new Date().toISOString().slice(0, 10);

const reasonForResolution = (resolution: ResolutionResult): AvailabilityReason =>
  resolution.status === 'SCHEMA_CHANGED' ? 'MALFORMED_DATA' : 'SOURCE_UNAVAILABLE';

function featureList(info: any): any[] {
  if (Array.isArray(info?.features)) return info.features;
  if (Array.isArray(info?.FeatureInfo)) return info.FeatureInfo;
  if (info?.FeatureInfo && typeof info.FeatureInfo === 'object') return [info.FeatureInfo];
  return [];
}

function usableMappedText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text || /^(not available|no data|unknown|unavailable|requires verification|brak danych|niedostępne|null|none)$/i.test(text)) return null;
  return text;
}

function mergedFeatureProperties(info: any): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const feature of featureList(info)) {
    const props = feature?.properties;
    if (!props || typeof props !== 'object') continue;
    for (const [key, value] of Object.entries(props)) {
      if (!(key in merged) && usableMappedText(value) !== null) merged[key] = value;
    }
  }
  return merged;
}

function pgiFeatureProperties(evidence: PgiSiteEvidence | undefined): Record<string, unknown> {
  const info = (evidence?.value as { featureInfo?: any } | null)?.featureInfo;
  return mergedFeatureProperties(info);
}

function pgiProperty(props: Record<string, unknown>, patterns: RegExp[]): string | null {
  const key = Object.keys(props).find(candidate => patterns.some(pattern => pattern.test(candidate)));
  return key ? usableMappedText(props[key]) : null;
}

function contextDescriptor(info: any, patterns: RegExp[], maxValues = 4): string | null {
  const props = mergedFeatureProperties(info);
  const values = Object.entries(props)
    .filter(([key]) => !/^__/.test(key) && patterns.some(pattern => pattern.test(key)))
    .map(([, raw]) => usableMappedText(raw))
    .filter((value): value is string => Boolean(value));
  return [...new Set(values)].slice(0, maxValues).join(' · ') || null;
}

const FIELD_PATTERNS: Record<GeologicalField, RegExp[]> = {
  unit: [/geolog/i, /jednost/i, /unit/i, /utwor/i, /wydzielen/i, /symbol/i],
  lithology: [/litolog/i, /lithology/i, /rock/i, /osad/i, /material/i, /grunt/i],
  period: [/strat/i, /wiek/i, /age/i, /okres/i, /period/i, /era/i],
  genesis: [/litogen/i, /gene[sz]/i, /pochodzen/i, /origin/i]
};

const BUILDING_GROUND_PATTERNS = [/warunk/i, /podloz/i, /podłoż/i, /budow/i, /grunt/i, /klas/i, /opis/i, /wydziel/i, /symbol/i];
const DOCUMENT_POINT_PATTERNS = [/litolog/i, /strat/i, /profil/i, /sond/i, /wkop/i, /szurf/i, /odsłon/i, /odslon/i, /głęb/i, /gleb/i, /utwor/i, /osad/i, /wiek/i, /opis/i];

function mapFamily(evidence: PgiSiteEvidence): string {
  if (/pgi-smgp-50k/i.test(evidence.id)) return 'SMGP';
  if (/pgi-mlp-50k/i.test(evidence.id)) return 'MLP';
  if (/pgi-engineering-geology/i.test(evidence.id)) return 'ENGINEERING';
  if (/pgi-mgp-regional/i.test(evidence.id)) return 'MGP';
  return 'OTHER';
}

const FIELD_SOURCE_ORDER: Record<GeologicalField, string[]> = {
  unit: ['SMGP', 'MGP', 'ENGINEERING', 'MLP'],
  lithology: ['SMGP', 'MLP', 'ENGINEERING', 'MGP'],
  period: ['SMGP', 'MGP', 'MLP', 'ENGINEERING'],
  genesis: ['MLP', 'SMGP', 'MGP', 'ENGINEERING']
};

function selectFieldEvidence(maps: PgiSiteEvidence[], field: GeologicalField): { value: string; evidence: PgiSiteEvidence } | null {
  const ordered = [...maps].sort((a, b) => {
    const order = FIELD_SOURCE_ORDER[field];
    return order.indexOf(mapFamily(a)) - order.indexOf(mapFamily(b));
  });
  for (const evidence of ordered) {
    const value = pgiProperty(pgiFeatureProperties(evidence), FIELD_PATTERNS[field]);
    if (value) return { value, evidence };
  }
  return null;
}

function mappedGroundSample(evidence: PgiSiteEvidence): MappedGroundSample | null {
  if (evidence.status !== 'VERIFIED' || !/pgi-(?:smgp-50k|mlp-50k|mgp-regional|engineering-geology)/i.test(evidence.id)) return null;
  const props = pgiFeatureProperties(evidence);
  const unit = pgiProperty(props, FIELD_PATTERNS.unit);
  const lithology = pgiProperty(props, FIELD_PATTERNS.lithology);
  const geologicalAge = pgiProperty(props, FIELD_PATTERNS.period);
  if (!unit && !lithology) return null;
  return {
    pointId: String((evidence.value as any)?.samplePoint?.id || evidence.id),
    scope: evidence.spatialScope || 'SITE',
    unit,
    lithology,
    geologicalAge,
    sourceName: evidence.sourceName,
    sourceScale: String((evidence.value as any)?.scale || '') || null
  };
}

function primarySpatialContextSamples(allVerifiedMaps: PgiSiteEvidence[]): MappedGroundSample[] {
  for (const family of ['SMGP', 'MGP', 'MLP', 'ENGINEERING']) {
    const samples = allVerifiedMaps
      .filter(item => mapFamily(item) === family)
      .map(mappedGroundSample)
      .filter((sample): sample is MappedGroundSample => Boolean(sample));
    if (samples.length) return samples;
  }
  return [];
}

export function enrichGeologyFromPgi(report: any, pgiEvidence: PgiSiteEvidence[]): void {
  const allVerifiedMaps = pgiEvidence.filter(item => /Geological Map|Lithogenetic Map|Engineering-Geological Map/i.test(item.category || '') && item.status === 'VERIFIED');
  const maps = allVerifiedMaps.filter(item => item.spatialScope === 'SITE' || (!item.spatialScope && /-site$/.test(item.id)));
  const boreholes = pgiEvidence.filter(item => item.category === 'Boreholes' && item.status === 'VERIFIED');
  const buildingGround = pgiEvidence.find(item => item.id === 'pgi-mgsp-building-ground-site' && item.status === 'VERIFIED');
  const documentationPoints = pgiEvidence.filter(item => /pgi-(?:smgp-documentation|cbdg-research)-points-context/.test(item.id) && item.status === 'VERIFIED');
  const contextSamples = primarySpatialContextSamples(allVerifiedMaps);
  report.ground_context = summarizeGroundContext(contextSamples);
  if (!maps.length && !boreholes.length && !buildingGround && !documentationPoints.length) return;

  const unit = selectFieldEvidence(maps, 'unit');
  const lithology = selectFieldEvidence(maps, 'lithology');
  const period = selectFieldEvidence(maps, 'period');
  const genesis = selectFieldEvidence(maps, 'genesis');
  const hasMappedGeology = Boolean(unit || lithology || period || genesis);
  const geoContext = report.geosurvey_context || {};
  const selectedFields = { unit, lithology, period, genesis };
  const selectedSourceIds = new Set(Object.values(selectedFields).filter(Boolean).map(item => (item as { evidence: PgiSiteEvidence }).evidence.id));

  report.geosurvey_context = {
    ...geoContext,
    geological_unit_name: unit?.value ?? null,
    lithology_type: lithology?.value ?? null,
    geological_period_era: period?.value ?? null,
    genetic_origin: genesis?.value ?? null,
    pgi_evidence_status: hasMappedGeology ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
    pgi_map_evidence_count: maps.length,
    pgi_context_evidence_count: contextSamples.filter(sample => sample.scope !== 'SITE').length,
    pgi_borehole_count: boreholes.length,
    pgi_boreholes: boreholes.map((item: any) => ({ distance_km: item.value?.distanceKm, feature_id: item.value?.featureId, properties: item.value?.properties, geological_profile: item.value?.geologicalProfileProperties, spatial_scope: item.spatialScope || 'VICINITY' })),
    pgi_building_ground_context: buildingGround ? {
      descriptor: (buildingGround.value as any)?.descriptor || null,
      properties: mergedFeatureProperties((buildingGround.value as any)?.featureInfo),
      source: buildingGround.sourceName,
      url: buildingGround.sourceUrl,
      scale: (buildingGround.value as any)?.scale || '1:50,000'
    } : null,
    pgi_documentation_points: documentationPoints.flatMap(item => (item.value as any)?.observations || []).slice(0, 20),
    pgi_documentation_point_count: documentationPoints.reduce((sum, item) => sum + Number((item.value as any)?.observationCount || 0), 0),
    pgi_field_sources: Object.fromEntries(Object.entries(selectedFields).filter(([, item]) => Boolean(item)).map(([field, item]) => {
      const selected = item as { value: string; evidence: PgiSiteEvidence };
      return [field, { value: selected.value, category: selected.evidence.category, source: selected.evidence.sourceName, url: selected.evidence.sourceUrl, scale: (selected.evidence.value as any)?.scale || null }];
    })),
    pgi_sources: maps.filter(item => selectedSourceIds.has(item.id)).map(item => ({ category: item.category, source: item.sourceName, url: item.sourceUrl, status: item.status, scale: (item.value as any)?.scale || null, limitation: item.limitation }))
  };
  report.geosurvey_context.evidence_level = hasMappedGeology ? 'VERIFIED' : 'REQUIRES_VERIFICATION';
}

async function fetchResponse(fetcher: FetchLike, url: string, accept: string, timeoutMs = 7000): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { headers: { 'User-Agent': 'GeoSurvey/1.0 evidence extraction', Accept: accept }, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 7000): Promise<any | null> {
  const response = await fetchResponse(fetcher, url, 'application/json', timeoutMs);
  if (!response?.ok) return null;
  try { return await response.json(); } catch { return null; }
}

function parseWmsLayers(xml: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /<(?:Layer|wms:Layer)[^>]*>[\s\S]*?<Name>([^<]+)<\/Name>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const name = match[1].trim();
    if (name && !seen.has(name)) { seen.add(name); out.push(name); }
  }
  return out;
}

function wmsCapabilities(xml: string): string[] {
  const capabilities = ['GetCapabilities'];
  if (/<(?:GetMap|wms:GetMap)\b/i.test(xml)) capabilities.push('GetMap');
  if (/<(?:GetFeatureInfo|wms:GetFeatureInfo)\b/i.test(xml)) capabilities.push('GetFeatureInfo');
  return capabilities;
}

async function probeWms(fetcher: FetchLike, endpoint: SourceEndpoint) {
  let response: Response | null = null;
  let xml = '';
  for (const version of ['1.3.0', '1.1.1']) {
    response = await fetchResponse(fetcher, `${endpoint.url}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=${version}`, 'application/xml,text/xml');
    xml = response?.ok ? await response.text() : '';
    if (parseWmsLayers(xml).length) break;
  }
  const layers = parseWmsLayers(xml);
  return {
    connectivity: Boolean(response),
    httpStatus: response?.status,
    serviceAvailable: Boolean(response?.ok && layers.length),
    observedLayers: layers,
    observedFields: [],
    capabilities: wmsCapabilities(xml),
    payload: { layers }
  };
}

async function resolveWms(fetcher: FetchLike, id: LogicalSourceId) {
  return resolveSource(id, endpoint => probeWms(fetcher, endpoint));
}

function selectMapLayers(layers: string[], mapId: string, limit = 4): string[] {
  const keywords: Record<string, RegExp> = {
    'smgp-50k': /smgp|geolog|litolog|utw|czwart|wydzielen|warstw/i,
    'mlp-50k': /mlp|litogen|gene[sz]|utw|osad/i,
    'mgp-regional': /mgp|geolog|litolog|utw/i,
    'engineering-geology': /inz|inż|engineering|grunt|podloz|podłoż|warunk|geolog/i,
    'mgsp-building-ground': /warunk|podloz|podłoż|budow|grunt|building|ground/i,
    'documentation-points': /punkt|pkt|dokument|sond|wkop|szurf|odslon|odsłon|profil/i,
    'research-points': /punkt|pkt|badaw|research|analiz/i,
    boreholes: /otwor|odwiert|borehole/i
  };
  const usable = layers.filter(layer => !/legend|index|overview|ramka|arkusz|sheet|siatka/i.test(layer));
  const matching = usable.filter(layer => keywords[mapId]?.test(layer));
  const ordered = [...matching, ...usable.filter(layer => !matching.includes(layer))];
  return [...new Set(ordered)].slice(0, limit);
}

function decodeXmlText(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
}

function objectFromAttributeString(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /([\w:.-]+)=["']([^"']*)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) result[match[1].replace(/^.*:/, '')] = decodeXmlText(match[2]);
  return result;
}

function parseFeatureInfoBody(body: string, contentType: string): any | null {
  const trimmed = body.trim();
  if (!trimmed || /ServiceException|ExceptionReport/i.test(trimmed)) return null;
  if (/json/i.test(contentType) || /^[\[{]/.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed);
      if (featureList(parsed).length || Array.isArray(parsed?.features)) return parsed;
    } catch { /* try text/XML/HTML below */ }
  }

  const features: Array<{ properties: Record<string, unknown> }> = [];
  const fieldsRe = /<FIELDS\b([^>]*)\/?\s*>/gi;
  let fieldsMatch: RegExpExecArray | null;
  while ((fieldsMatch = fieldsRe.exec(trimmed))) {
    const properties = objectFromAttributeString(fieldsMatch[1]);
    if (Object.keys(properties).length) features.push({ properties });
  }

  if (!features.length && /<html|<table|<tr/i.test(trimmed)) {
    const properties: Record<string, string> = {};
    const rowRe = /<tr[^>]*>\s*<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
    let row: RegExpExecArray | null;
    while ((row = rowRe.exec(trimmed))) {
      const key = decodeXmlText(row[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
      const value = decodeXmlText(row[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
      if (key && value) properties[key] = value;
    }
    if (Object.keys(properties).length) features.push({ properties });
  }

  if (!features.length && /<[^>]+>/.test(trimmed)) {
    const properties: Record<string, string> = {};
    const elementRe = /<([\w:.-]+)(?:\s[^>]*)?>\s*([^<>]+?)\s*<\/\1>/g;
    let element: RegExpExecArray | null;
    while ((element = elementRe.exec(trimmed))) {
      const key = element[1].replace(/^.*:/, '');
      const value = decodeXmlText(element[2]);
      if (!/^(featureMember|boundedBy|coordinates|pos|name)$/i.test(key) && value) properties[key] = value;
    }
    if (Object.keys(properties).length) features.push({ properties });
  }

  if (!features.length) {
    const properties: Record<string, string> = {};
    for (const line of trimmed.split(/\r?\n/)) {
      const match = line.match(/^\s*([\w .:/()ąćęłńóśźżĄĆĘŁŃÓŚŹŻ-]{2,80})\s*(?:=|:)\s*["']?(.+?)["']?\s*$/);
      if (!match) continue;
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && value && !/^Layer$/i.test(key)) properties[key] = value;
    }
    if (Object.keys(properties).length) features.push({ properties });
  }

  return features.length ? { features } : null;
}

async function wmsGetInfo(fetcher: FetchLike, serviceUrl: string, layer: string, lat: number, lng: number): Promise<any | null> {
  const delta = 0.0008;
  const formats = ['application/json', 'application/vnd.ogc.gml', 'text/xml', 'text/plain', 'text/html'];
  let emptyResponse: any | null = null;
  for (const version of ['1.3.0', '1.1.1']) {
    for (const infoFormat of formats) {
      const params = new URLSearchParams({ SERVICE: 'WMS', VERSION: version, REQUEST: 'GetFeatureInfo', LAYERS: layer, QUERY_LAYERS: layer, BBOX: `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`, WIDTH: '101', HEIGHT: '101', INFO_FORMAT: infoFormat, FEATURE_COUNT: '5' });
      if (version === '1.3.0') {
        params.set('CRS', 'CRS:84'); params.set('I', '50'); params.set('J', '50');
      } else {
        params.set('SRS', 'EPSG:4326'); params.set('X', '50'); params.set('Y', '50');
      }
      const response = await fetchResponse(fetcher, `${serviceUrl}?${params.toString()}`, infoFormat, 6000);
      if (!response?.ok) continue;
      const body = await response.text();
      const parsed = parseFeatureInfoBody(body, response.headers.get('content-type') || infoFormat);
      if (parsed && featureList(parsed).length) return { ...parsed, infoFormat, queriedLayer: layer, wmsVersion: version };
      if (parsed && !emptyResponse) emptyResponse = { ...parsed, infoFormat, queriedLayer: layer, wmsVersion: version };
    }
  }
  return emptyResponse;
}

function combinedFeatureInfo(results: Array<{ layer: string; info: any | null }>): any | null {
  const features = results.flatMap(result => featureList(result.info).map(feature => ({ ...feature, properties: { ...(feature?.properties || {}), __sourceLayer: result.layer } })));
  return features.length ? { features } : null;
}

function unavailableMapEvidence(map: MapDefinition, resolution: ResolutionResult): PgiSiteEvidence {
  const reasonCode = reasonForResolution(resolution);
  return {
    id: `pgi-${map.id}-unavailable`, category: map.title, claim: `${map.title}: approved source route could not be validated.`,
    status: 'REQUIRES_VERIFICATION', sourceName: SOURCE,
    sourceUrl: map.portalUrl, datasetDate: today(), spatialRelationship: 'Site coordinate',
    calculationMethod: 'Source resolver with WMS connectivity, capability and service validation', confidence: 'Low',
    value: { reasonCode, resolverStatus: resolution.status, attempts: resolution.attempts }, reasonCode,
    limitation: 'Source failure is not evidence that mapped geological information or a geological feature is absent.'
  };
}

interface MapDefinition { id: string; logicalSourceId: LogicalSourceId; title: string; scale: string; portalUrl: string; }
const MAPS: MapDefinition[] = [
  { id: 'smgp-50k', logicalSourceId: 'PL_SMGP_DETAILED_GEOLOGY', title: 'Detailed Geological Map of Poland (SMGP)', scale: '1:50,000', portalUrl: 'https://geolog.pgi.gov.pl' },
  { id: 'mlp-50k', logicalSourceId: 'PL_MLP_LITHOGENETIC', title: 'Lithogenetic Map of Poland (MLP)', scale: '1:50,000', portalUrl: 'https://geolog.pgi.gov.pl' },
  { id: 'engineering-geology', logicalSourceId: 'PL_ENGINEERING_GEOLOGY', title: 'Engineering-Geological Map of Poland', scale: 'source scale', portalUrl: 'https://geolog.pgi.gov.pl' },
  { id: 'mgp-regional', logicalSourceId: 'PL_MGP_REGIONAL_GEOLOGY', title: 'Geological Map of Poland (MGP)', scale: 'regional', portalUrl: 'https://geolog.pgi.gov.pl' }
];

function centreSample(lat: number, lng: number): SpatialSamplePoint {
  return { id: 'site-centroid', lat, lng, scope: 'SITE', label: 'Site centroid' };
}

export async function queryPolandGeologicalMaps(lat: number, lng: number, fetcher: FetchLike = fetch, samplingPoints?: SpatialSamplePoint[]): Promise<PgiSiteEvidence[]> {
  const evidence: PgiSiteEvidence[] = [];
  const centre = samplingPoints?.find(point => point.scope === 'SITE') || centreSample(lat, lng);
  for (const map of MAPS) {
    const resolution = await resolveWms(fetcher, map.logicalSourceId);
    if (!resolution.endpoint) { evidence.push(unavailableMapEvidence(map, resolution)); continue; }
    const layers = (resolution.probe?.payload as { layers?: string[] } | undefined)?.layers || [];
    const selectedLayers = selectMapLayers(layers, map.id);
    const queryPoints = map.id === 'smgp-50k' && samplingPoints?.length ? samplingPoints : [centre];
    for (const point of queryPoints) {
      const pointLayers = point.scope === 'SITE' ? selectedLayers : selectedLayers.slice(0, 1);
      const layerResults: Array<{ layer: string; info: any | null }> = [];
      for (const layer of pointLayers) layerResults.push({ layer, info: await wmsGetInfo(fetcher, resolution.endpoint.url, layer, point.lat, point.lng) });
      const info = combinedFeatureInfo(layerResults);
      const hasFeature = featureList(info).length > 0;
      if (point.scope !== 'SITE' && !hasFeature) continue;
      const reasonCode: AvailabilityReason | undefined = hasFeature ? undefined : 'NO_DATA';
      const isSite = point.scope === 'SITE';
      evidence.push({
        id: isSite ? `pgi-${map.id}-site` : `pgi-${map.id}-${point.id}`,
        category: map.title,
        claim: hasFeature
          ? isSite ? `${map.title}: site coordinate returned mapped feature information from ${layerResults.filter(result => featureList(result.info).length).length} queried layer(s).` : `${map.title}: a deterministic ${point.scope.toLowerCase()} sample returned mapped feature information.`
          : `${map.title}: source was queried successfully, but no feature information was returned at the tested coordinate.`,
        status: hasFeature ? 'VERIFIED' : 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: resolution.endpoint.url,
        datasetDate: today(),
        spatialRelationship: isSite ? 'Exact site centre queried' : point.scope === 'PARCEL' ? 'Representative parcel-geometry sample' : `Vicinity sample (${point.label})`,
        calculationMethod: isSite ? 'Resolved OGC WMS GetFeatureInfo across selected relevant geological layers with multi-format and WMS-version fallback parsing' : `Resolved OGC WMS GetFeatureInfo at deterministic ${point.scope} sample point`,
        confidence: hasFeature ? 'Medium' : 'Low', reasonCode, resolverProvenance: resolution.provenance || undefined, spatialScope: point.scope,
        value: { scale: map.scale, availableLayers: layers.slice(0, 100), queriedLayers: pointLayers, featureInfo: info, samplePoint: point, reasonCode, resolverProvenance: resolution.provenance },
        limitation: isSite
          ? hasFeature ? 'Mapped evidence is screening context. Only site investigation and original map/document review can confirm conditions beneath the parcel.' : 'A successful query without a returned feature does not establish geological absence or a geological unit.'
          : 'This is mapped context at a sampled coordinate. It is not a polygon intersection and does not establish strata beneath the parcel, deposit thickness, groundwater conditions, engineering properties or an exact geological-boundary distance.'
      });
    }
  }
  return evidence;
}

export async function queryPolandBuildingGroundContext(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<PgiSiteEvidence[]> {
  const resolution = await resolveWms(fetcher, 'PL_MGSP_BUILDING_GROUND');
  if (!resolution.endpoint) {
    const reasonCode = reasonForResolution(resolution);
    return [{ id: 'pgi-mgsp-building-ground-unavailable', category: 'MGśP building-ground conditions', claim: 'The approved MGśP building-ground route could not be validated.', status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: 'https://baza.pgi.gov.pl/cbdg/geoportal/uslugi/gis', datasetDate: today(), spatialRelationship: 'Site coordinate', calculationMethod: 'Source resolver with WMS capability validation', confidence: 'Low', value: { reasonCode, attempts: resolution.attempts }, reasonCode, limitation: 'Source failure is not evidence of favourable or unfavourable building-ground conditions.' }];
  }
  const layers = (resolution.probe?.payload as { layers?: string[] } | undefined)?.layers || [];
  const selectedLayers = selectMapLayers(layers, 'mgsp-building-ground', 4);
  const layerResults: Array<{ layer: string; info: any | null }> = [];
  for (const layer of selectedLayers) layerResults.push({ layer, info: await wmsGetInfo(fetcher, resolution.endpoint.url, layer, lat, lng) });
  const info = combinedFeatureInfo(layerResults);
  const hasFeature = featureList(info).length > 0;
  const reasonCode: AvailabilityReason | undefined = hasFeature ? undefined : 'NO_DATA';
  return [{
    id: 'pgi-mgsp-building-ground-site', category: 'MGśP building-ground conditions',
    claim: hasFeature ? 'MGśP returned mapped building-ground context at the site coordinate.' : 'MGśP was queried successfully but returned no building-ground feature information at the tested coordinate.',
    status: hasFeature ? 'VERIFIED' : 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: resolution.endpoint.url, datasetDate: today(),
    spatialRelationship: 'Exact site centre queried on the 1:50,000 geoenvironmental building-ground map',
    calculationMethod: 'Resolved MGśP WMS GetFeatureInfo across relevant layers with multi-format and WMS-version fallback parsing', confidence: hasFeature ? 'Medium' : 'Low',
    value: { scale: '1:50,000', availableLayers: layers.slice(0, 100), queriedLayers: selectedLayers, featureInfo: info, descriptor: contextDescriptor(info, BUILDING_GROUND_PATTERNS), reasonCode, resolverProvenance: resolution.provenance },
    reasonCode, resolverProvenance: resolution.provenance || undefined, spatialScope: 'SITE',
    limitation: hasFeature ? 'MGśP building-ground conditions are mapped screening context at 1:50,000 scale. They are not a parcel-specific geotechnical classification and do not supply design bearing capacity, settlement, groundwater or foundation recommendations.' : 'No returned MGśP feature is not evidence that the site has no relevant building-ground condition. Original map coverage should be checked.'
  }];
}

async function queryPolandPointContextSource(
  lat: number,
  lng: number,
  logicalSourceId: 'PL_SMGP_DOCUMENTATION_POINTS' | 'PL_CBDG_RESEARCH_POINTS',
  id: 'smgp-documentation' | 'cbdg-research',
  title: string,
  fetcher: FetchLike,
  samplingPoints?: SpatialSamplePoint[]
): Promise<PgiSiteEvidence[]> {
  const resolution = await resolveWms(fetcher, logicalSourceId);
  if (!resolution.endpoint) {
    const reasonCode = reasonForResolution(resolution);
    return [{ id: `pgi-${id}-points-unavailable`, category: title, claim: `${title}: approved route could not be validated.`, status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: 'https://baza.pgi.gov.pl/cbdg/geoportal/uslugi/gis', datasetDate: today(), spatialRelationship: 'Site and vicinity context', calculationMethod: 'Source resolver with WMS capability validation', confidence: 'Low', value: { reasonCode, attempts: resolution.attempts }, reasonCode, limitation: 'Source failure is not evidence that documentation or research points are absent.' }];
  }
  const layers = (resolution.probe?.payload as { layers?: string[] } | undefined)?.layers || [];
  const selector = id === 'smgp-documentation' ? 'documentation-points' : 'research-points';
  const selectedLayers = selectMapLayers(layers, selector, 2);
  const points = samplingPoints?.length ? samplingPoints : [centreSample(lat, lng)];
  const observations: Array<{ samplePoint: SpatialSamplePoint; properties: Record<string, unknown>; descriptor: string | null }> = [];
  const seen = new Set<string>();
  for (const point of points) {
    for (const layer of selectedLayers.slice(0, point.scope === 'SITE' ? 2 : 1)) {
      const info = await wmsGetInfo(fetcher, resolution.endpoint.url, layer, point.lat, point.lng);
      for (const feature of featureList(info)) {
        const properties = feature?.properties && typeof feature.properties === 'object' ? feature.properties as Record<string, unknown> : {};
        const signature = JSON.stringify(properties);
        if (!Object.keys(properties).length || seen.has(signature)) continue;
        seen.add(signature);
        observations.push({ samplePoint: point, properties, descriptor: contextDescriptor({ features: [{ properties }] }, DOCUMENT_POINT_PATTERNS) });
      }
    }
  }
  const hasFeature = observations.length > 0;
  const reasonCode: AvailabilityReason | undefined = hasFeature ? undefined : 'NO_DATA';
  return [{
    id: `pgi-${id}-points-context`, category: title,
    claim: hasFeature ? `${title}: ${observations.length} contextual feature response(s) were returned across deterministic site/parcel/vicinity samples.` : `${title}: the service was queried successfully but returned no feature at the tested sample coordinates.`,
    status: hasFeature ? 'VERIFIED' : 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: resolution.endpoint.url, datasetDate: today(),
    spatialRelationship: `${points.length} deterministic site/parcel/vicinity sample positions; no exact feature distance inferred from WMS`,
    calculationMethod: 'Resolved WMS GetFeatureInfo sampling with multi-format and WMS-version fallback parsing and duplicate suppression', confidence: hasFeature ? 'Medium' : 'Low',
    value: { observationCount: observations.length, observations: observations.slice(0, 20), availableLayers: layers.slice(0, 100), queriedLayers: selectedLayers, reasonCode, resolverProvenance: resolution.provenance },
    reasonCode, resolverProvenance: resolution.provenance || undefined, spatialScope: 'VICINITY',
    limitation: hasFeature ? 'Documentation/research points are nearby contextual observations. They do not establish a continuous geological profile beneath the parcel; original point records and site investigation are required for site-specific use.' : 'No returned point at the sampled coordinates is not proof that no documentation or research point exists nearby.'
  }];
}

export async function queryPolandDocumentationPoints(lat: number, lng: number, fetcher: FetchLike = fetch, samplingPoints?: SpatialSamplePoint[]): Promise<PgiSiteEvidence[]> {
  const [smgp, research] = await Promise.all([
    queryPolandPointContextSource(lat, lng, 'PL_SMGP_DOCUMENTATION_POINTS', 'smgp-documentation', 'SMGP documentation points', fetcher, samplingPoints),
    queryPolandPointContextSource(lat, lng, 'PL_CBDG_RESEARCH_POINTS', 'cbdg-research', 'CBDG research points', fetcher, samplingPoints)
  ]);
  return [...smgp, ...research];
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function profileFromProperties(properties: any): Record<string, unknown> | null {
  if (!properties || typeof properties !== 'object') return null;
  const patterns = [/litolog/i, /strat/i, /warstw/i, /profil/i, /otwor/i, /głęb/i, /gleb/i, /depth/i, /groundwater/i, /woda/i, /utwor/i, /osad/i, /wiek/i, /age/i, /opis/i, /description/i, /rock/i, /soil/i];
  const selected = Object.fromEntries(Object.entries(properties).filter(([key]) => patterns.some(pattern => pattern.test(key))));
  return Object.keys(selected).length ? selected : null;
}

async function resolveBoreholeSource(fetcher: FetchLike) {
  return resolveSource<any>('PL_ENGINEERING_BOREHOLES', async endpoint => {
    if (endpoint.type === 'WMS') return probeWms(fetcher, endpoint);
    const response = await fetchResponse(fetcher, `${endpoint.url}/collections`, 'application/json');
    const data = response?.ok ? await response.json().catch(() => null) : null;
    const collections = Array.isArray(data?.collections) ? data.collections : [];
    const collection = collections.find((item: any) => /odwiert|borehole|otwor/i.test(`${item.id || ''} ${item.title || ''}`));
    return { connectivity: Boolean(response), httpStatus: response?.status, serviceAvailable: Boolean(response?.ok && collection), observedLayers: collection ? [collection.id] : [], observedFields: [], capabilities: collection ? ['collections', 'items'] : ['collections'], payload: { collection } };
  });
}

export async function queryPolandBoreholes(lat: number, lng: number, radiusKm = 2, fetcher: FetchLike = fetch): Promise<PgiSiteEvidence[]> {
  const resolution = await resolveBoreholeSource(fetcher);
  if (!resolution.endpoint) {
    const reasonCode = reasonForResolution(resolution);
    return [{ id: 'pgi-boreholes-unavailable', category: 'Boreholes', claim: 'No approved PGI-PIB borehole route could be validated.', status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: 'https://geolog.pgi.gov.pl', datasetDate: today(), spatialRelationship: `Within ${radiusKm} km search window`, calculationMethod: 'Source resolver and provider capability validation', confidence: 'Low', value: { reasonCode, attempts: resolution.attempts }, reasonCode, limitation: 'Source unavailability is not evidence that boreholes are absent.' }];
  }

  if (resolution.endpoint.type === 'WMS') {
    const layers = (resolution.probe?.payload as { layers?: string[] } | undefined)?.layers || [];
    const layer = selectMapLayers(layers, 'boreholes', 1)[0];
    const info = layer ? await wmsGetInfo(fetcher, resolution.endpoint.url, layer, lat, lng) : null;
    const hasFeature = featureList(info).length > 0;
    const reasonCode: AvailabilityReason | undefined = hasFeature ? undefined : 'NO_DATA';
    return [{ id: 'pgi-boreholes-wms-context', category: 'Boreholes', claim: hasFeature ? 'PGI-PIB borehole WMS returned contextual feature information.' : 'PGI-PIB borehole WMS was queried successfully but returned no feature at the site coordinate.', status: hasFeature ? 'VERIFIED' : 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: resolution.endpoint.url, datasetDate: today(), spatialRelationship: 'Site-centre contextual query', calculationMethod: 'Resolved WMS GetFeatureInfo with multi-format and WMS-version fallback parsing', confidence: hasFeature ? 'Medium' : 'Low', value: { featureInfo: info, reasonCode, resolverProvenance: resolution.provenance }, reasonCode, resolverProvenance: resolution.provenance || undefined, spatialScope: 'VICINITY', limitation: 'WMS borehole context does not establish conditions beneath the parcel. Original borehole records must be reviewed.' }];
  }

  const collection = (resolution.probe?.payload as { collection?: any } | undefined)?.collection;
  const dLat = radiusKm / 111.32; const dLng = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));
  const bbox = `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
  const url = `${resolution.endpoint.url}/collections/${encodeURIComponent(collection.id)}/items?bbox=${bbox}&limit=100`;
  const data = await fetchJson(fetcher, url, 10000);
  if (!data) return [{ id: 'pgi-boreholes-query-unavailable', category: 'Boreholes', claim: 'The PGI-PIB borehole collection was discovered, but its spatial query failed.', status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: url, datasetDate: today(), spatialRelationship: `Within ${radiusKm} km search window`, calculationMethod: 'Resolved PGI-PIB OGC API Features spatial query', confidence: 'Low', value: { reasonCode: 'SOURCE_UNAVAILABLE', resolverProvenance: resolution.provenance }, reasonCode: 'SOURCE_UNAVAILABLE', resolverProvenance: resolution.provenance || undefined, limitation: 'Query failure is not evidence that boreholes are absent.' }];

  const results = (data.features || []).map((feature: any, index: number) => {
    const coordinates = feature?.geometry?.coordinates; const flng = Number(coordinates?.[0]); const flat = Number(coordinates?.[1]);
    const distanceKm = Number.isFinite(flng) && Number.isFinite(flat) ? haversineKm(lat, lng, flat, flng) : null;
    return { feature, distanceKm, index };
  }).filter((item: any) => item.distanceKm === null || item.distanceKm <= radiusKm).sort((a: any, b: any) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)).slice(0, 20);

  if (!results.length) return [{ id: 'pgi-boreholes-none-found', category: 'Boreholes', claim: `The PGI-PIB borehole source was queried successfully, but no feature was returned within ${radiusKm} km.`, status: 'REQUIRES_VERIFICATION', sourceName: SOURCE, sourceUrl: url, datasetDate: today(), spatialRelationship: `No returned feature within ${radiusKm} km`, calculationMethod: 'Resolved PGI-PIB OGC API Features spatial query', confidence: 'Low', value: { collection: collection.id, featureCount: 0, reasonCode: 'NO_DATA', resolverProvenance: resolution.provenance }, reasonCode: 'NO_DATA', resolverProvenance: resolution.provenance || undefined, limitation: 'No mapped borehole in this dataset is not proof that no borehole exists. Local archives may contain additional records.' }];

  return results.map((item: any) => {
    const profile = profileFromProperties(item.feature.properties);
    return { id: `pgi-borehole-${item.feature.id ?? item.index}`, category: 'Boreholes', claim: `PGI-PIB borehole record identified${item.distanceKm !== null ? ` ${item.distanceKm.toFixed(2)} km from the site centre` : ''}.`, status: 'VERIFIED' as const, sourceName: SOURCE, sourceUrl: url, datasetDate: today(), spatialRelationship: item.distanceKm !== null ? `${item.distanceKm.toFixed(2)} km from site centre` : `Within ${radiusKm} km search window`, calculationMethod: 'Resolved PGI-PIB OGC API Features spatial query', confidence: item.distanceKm !== null && item.distanceKm < 0.5 ? 'High' as const : 'Medium' as const, value: { featureId: item.feature.id, coordinates: item.feature.geometry?.coordinates, distanceKm: item.distanceKm, collection: collection.id, properties: item.feature.properties, geologicalProfileProperties: profile, resolverProvenance: resolution.provenance }, resolverProvenance: resolution.provenance || undefined, spatialScope: 'VICINITY' as const, limitation: 'A nearby record is contextual evidence, not a continuous parcel-specific ground model. Original borehole documentation must be reviewed before design use.' };
  });
}

export async function queryPolandSiteEvidence(lat: number, lng: number, fetcher: FetchLike = fetch, samplingPoints?: SpatialSamplePoint[]): Promise<PgiSiteEvidence[]> {
  const [maps, boreholes, buildingGround, documentationPoints] = await Promise.all([
    queryPolandGeologicalMaps(lat, lng, fetcher, samplingPoints),
    queryPolandBoreholes(lat, lng, 2, fetcher),
    queryPolandBuildingGroundContext(lat, lng, fetcher),
    queryPolandDocumentationPoints(lat, lng, fetcher, samplingPoints)
  ]);
  return [...maps, ...boreholes, ...buildingGround, ...documentationPoints];
}
