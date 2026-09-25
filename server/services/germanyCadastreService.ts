import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA' | 'STATE_NOT_AUTOMATED';
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  parcel?: { parcelId: string; nationalCadastralReference: string | null; officialAreaM2: number | null; geometryPoints: [number, number][]; state: string; stateCode: string };
  viewServiceUrl?: string;
  viewLayer?: string;
  viewStyle?: string;
  viewAttribution?: string;
  evidence: EvidenceItem[];
  limitation: string;
}

interface GermanyCadastreProfile {
  state: string;
  stateCode: string;
  aliases: string[];
  wfsUrl: string;
  wmsUrl: string;
  wmsLayer?: string;
  wmsStyle: string;
  sourceName: string;
  publisher: string;
  portalUrl: string;
  evidenceId: string;
}

const PROFILES: GermanyCadastreProfile[] = [
  {
    state: 'Baden-Württemberg', stateCode: 'DE-BW',
    aliases: ['baden-württemberg', 'baden-wurttemberg', 'baden wuerttemberg', 'de-bw'],
    wfsUrl: 'https://owsproxy.lgl-bw.de/owsproxy/wfs/WFS_INSP_BW_Flst_ALKIS',
    wmsUrl: 'https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_INSP_BW_Flst_ALKIS',
    wmsLayer: 'alkis:CP.CadastralParcel',
    wmsStyle: 'cadastralparcel',
    sourceName: 'LGL Baden-Württemberg — INSPIRE-WFS Flurstücke/Grundstücke ALKIS',
    publisher: 'LGL Baden-Württemberg',
    portalUrl: 'https://www.lgl-bw.de/Produkte/Geodatendienste/INSPIRE/index.html',
    evidenceId: 'de-bw-alkis-cadastre'
  },
  {
    state: 'Brandenburg', stateCode: 'DE-BB',
    aliases: ['brandenburg', 'de-bb'],
    wfsUrl: 'https://inspire.brandenburg.de/services/cp_alkis_wfs',
    wmsUrl: 'https://inspire.brandenburg.de/services/cp_alkis_wms',
    wmsStyle: 'CP.CadastralParcel.OutlinesOnly',
    sourceName: 'GeoBasis-DE/LGB — INSPIRE-WFS Flurstücke/Grundstücke ALKIS Brandenburg',
    publisher: 'GeoBasis-DE/LGB',
    portalUrl: 'https://geobroker.geobasis-bb.de/gbss.php?MODE=GetProductInformation&PRODUCTID=77402954-cb0f-497d-ac47-c64d7c8dcc81',
    evidenceId: 'de-bb-alkis-cadastre'
  },
  {
    state: 'Hamburg', stateCode: 'DE-HH',
    aliases: ['hamburg', 'de-hh'],
    wfsUrl: 'https://geodienste.hamburg.de/HH_WFS_INSPIRE_Flurstuecke',
    wmsUrl: 'https://geodienste.hamburg.de/HH_WMS_INSPIRE_Flurstuecke',
    wmsStyle: 'CP.CadastralParcel.Default',
    sourceName: 'Landesbetrieb Geoinformation und Vermessung Hamburg — INSPIRE WFS Flurstücke/Grundstücke ALKIS',
    publisher: 'Landesbetrieb Geoinformation und Vermessung Hamburg',
    portalUrl: 'https://suche.transparenz.hamburg.de/dataset/inspire-hh-flurstuecke-grundstuecke-alkis',
    evidenceId: 'de-hh-alkis-cadastre'
  },
  {
    state: 'Hessen', stateCode: 'DE-HE',
    aliases: ['hessen', 'hesse', 'de-he'],
    wfsUrl: 'https://inspire-hessen.de/ows/services/org.2.07247d95-adc7-4c7d-9c7a-ed17af855317_wfs',
    wmsUrl: 'https://inspire-hessen.de/ows/services/org.2.07247d95-adc7-4c7d-9c7a-ed17af855317_wms',
    wmsStyle: 'CP.CadastralParcel.Default',
    sourceName: 'Hessisches Landesamt für Bodenmanagement und Geoinformation — INSPIRE-WFS Flurstücke/Grundstücke ALKIS',
    publisher: 'Hessisches Landesamt für Bodenmanagement und Geoinformation',
    portalUrl: 'https://www.geoportal.hessen.de/spatial-objects/710',
    evidenceId: 'de-he-alkis-cadastre'
  },
  {
    state: 'Niedersachsen', stateCode: 'DE-NI',
    aliases: ['niedersachsen', 'lower saxony', 'de-ni'],
    wfsUrl: 'https://www.inspire.niedersachsen.de/doorman/noauth/alkis-dls-cp',
    wmsUrl: 'https://www.inspire.niedersachsen.de/doorman/noauth/alkis-vs-cp',
    wmsStyle: 'CP.CadastralParcel.OutlinesOnly',
    sourceName: 'LGLN — INSPIRE-WFS NI Flurstücke/Grundstücke ALKIS',
    publisher: 'Landesamt für Geoinformation und Landesvermessung Niedersachsen',
    portalUrl: 'https://numis.niedersachsen.de/trefferanzeige?docuuid=d5b05158-fd60-4749-9913-4d4afa85986b',
    evidenceId: 'de-ni-alkis-cadastre'
  },
  {
    state: 'Nordrhein-Westfalen', stateCode: 'DE-NW',
    aliases: ['nordrhein-westfalen', 'north rhine-westphalia', 'north rhine westphalia', 'de-nw'],
    wfsUrl: 'https://www.wfs.nrw.de/geobasis/wfs_nw_inspire-flurstuecke_alkis',
    wmsUrl: 'https://www.wms.nrw.de/geobasis/wms_nw_inspire-flurstuecke_alkis',
    wmsStyle: 'CP.CadastralParcel.Default',
    sourceName: 'GeoBasis NRW — INSPIRE-WFS NW Flurstücke/Grundstücke ALKIS',
    publisher: 'GeoBasis NRW',
    portalUrl: 'https://www.bezreg-koeln.nrw.de/geobasis-nrw/produkte-und-dienste/inspire/inspire-nw-flurstuecke-grundstuecke',
    evidenceId: 'de-nw-alkis-cadastre'
  },
  {
    state: 'Sachsen-Anhalt', stateCode: 'DE-ST',
    aliases: ['sachsen-anhalt', 'saxony-anhalt', 'de-st'],
    wfsUrl: 'https://geodatenportal.sachsen-anhalt.de/ows_INSPIRE_LVermGeo_ALKIS_CP_WFS',
    wmsUrl: 'https://geodatenportal.sachsen-anhalt.de/ows_INSPIRE_LVermGeo_ALKIS_CP_WMS',
    wmsStyle: 'CP.CadastralParcel.OutlinesOnly',
    sourceName: 'LVermGeo Sachsen-Anhalt — INSPIRE-WFS Flurstücke/Grundstücke ALKIS',
    publisher: 'Landesamt für Vermessung und Geoinformation Sachsen-Anhalt',
    portalUrl: 'https://www.lvermgeo.sachsen-anhalt.de/de/gdp-open-data.html',
    evidenceId: 'de-st-alkis-cadastre'
  },
  {
    state: 'Schleswig-Holstein', stateCode: 'DE-SH',
    aliases: ['schleswig-holstein', 'schleswig holstein', 'de-sh'],
    wfsUrl: 'https://service.gdi-sh.de/SH_INSPIREDOWNLOAD_AI_CP_ALKIS',
    wmsUrl: 'https://service.gdi-sh.de/SH_INSPIREVIEW_AI_CP_ALKIS',
    wmsStyle: 'CP.CadastralParcel.OutlinesOnly',
    sourceName: 'GeoBasis-DE/LVermGeo SH — INSPIRE WFS Flurstücke/Grundstücke ALKIS',
    publisher: 'Landesamt für Vermessung und Geoinformation Schleswig-Holstein',
    portalUrl: 'https://www.govdata.de/suche/daten/inspire-sh-flurstucke-grundstucke-alkis',
    evidenceId: 'de-sh-alkis-cadastre'
  },
  {
    state: 'Mecklenburg-Vorpommern', stateCode: 'DE-MV',
    aliases: ['mecklenburg-vorpommern', 'mecklenburg western pomerania', 'de-mv'],
    wfsUrl: 'https://www.geodaten-mv.de/dienste/inspire_cp_alkis_download',
    wmsUrl: 'https://www.geodaten-mv.de/dienste/inspire_cp_alkis_view',
    wmsStyle: 'CP.CadastralParcel.OutlinesOnly',
    sourceName: 'GeoBasis-DE/M-V — INSPIRE-WFS Flurstücke/Grundstücke ALKIS',
    publisher: 'GeoBasis-DE/M-V',
    portalUrl: 'https://www.geoportal-mv.de/portal/Geowebdienste/INSPIRE-Themen/Flurstuecke_Grundstuecke',
    evidenceId: 'de-mv-alkis-cadastre'
  }
];

function profileForState(state: string | null | undefined): GermanyCadastreProfile | null {
  const normalized = String(state || '').trim().toLowerCase();
  if (!normalized) return null;
  return PROFILES.find(profile => profile.aliases.includes(normalized)) || null;
}

const today = () => new Date().toISOString().slice(0, 10);

function text(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  return s || null;
}
function numberValue(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function pointInRing(lat: number, lng: number, ring: [number, number][]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0], xi = ring[i][1], yj = ring[j][0], xj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi) inside = !inside;
  }
  return inside;
}
function extractMembers(xml: string) {
  return [...xml.matchAll(/<(?:[A-Za-z0-9_.-]+:)?CadastralParcel\b[\s\S]*?<\/(?:[A-Za-z0-9_.-]+:)?CadastralParcel>/g)].map(match => {
    const member = match[0];
    const label = text(member.match(/<(?:[A-Za-z0-9_.-]+:)?label>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?label>/)?.[1]);
    const ref = text(member.match(/<(?:[A-Za-z0-9_.-]+:)?nationalCadastralReference>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?nationalCadastralReference>/)?.[1]);
    const area = numberValue(member.match(/<(?:[A-Za-z0-9_.-]+:)?areaValue[^>]*>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?areaValue>/)?.[1]);
    const exterior = member.match(/<gml:exterior>([\s\S]*?)<\/gml:exterior>/)?.[1] || '';
    const positions = [...exterior.matchAll(/<gml:posList>([^<]+)<\/gml:posList>/g)].flatMap(match => match[1].trim().split(/\s+/).map(Number));
    const ring: [number, number][] = [];
    for (let i = 0; i + 1 < positions.length; i += 2) {
      const a = positions[i], b = positions[i + 1];
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const point: [number, number] = a >= 47 && a <= 56 && b >= 4 && b <= 16
        ? [a, b]
        : b >= 47 && b <= 56 && a >= 4 && a <= 16
        ? [b, a]
        : [a, b];
      const previous = ring[ring.length - 1];
      if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) ring.push(point);
    }
    return { label, ref, area, ring };
  }).filter(item => item.ring.length >= 3);
}
function unavailable(reasonCode: GermanyCadastreResult['reasonCode'], claim: string, profile: GermanyCadastreProfile | null = null, sourceUrl = profile?.portalUrl || 'https://www.bkg.bund.de'): GermanyCadastreResult {
  const sourceName = profile?.sourceName || 'German cadastral services';
  const evidence: EvidenceItem = {
    id: 'de-cadastre-unavailable', category: 'Cadastre & identification', claim, status: 'REQUIRES_VERIFICATION',
    sourceName, sourceUrl, datasetDate: today(), spatialRelationship: 'Selected site coordinate',
    calculationMethod: 'State-specific official cadastral source routing; no negative inference from failed acquisition',
    confidence: 'Low',
    limitation: 'A failed or unimplemented lookup is not evidence that a parcel does not exist. Official cadastral verification remains required.',
    value: { reasonCode, state: profile?.state || null, stateCode: profile?.stateCode || null }
  };
  return { success: false, reasonCode, sourceName, sourceUrl, datasetDate: today(), evidence: [evidence], limitation: evidence.limitation };
}

export async function queryGermanyCadastre(lat: number, lng: number, state: string | null | undefined, fetcher: typeof fetch = fetch): Promise<GermanyCadastreResult> {
  const profile = profileForState(state);
  if (!profile) {
    return unavailable('STATE_NOT_AUTOMATED', state
      ? `Germany's cadastral data are administered by the federal states. LandSurf has not yet validated an automated official parcel lookup for ${state}.`
      : 'Germany\'s cadastral data are administered by the federal states. A German Land must be identified before an official parcel service can be selected.', profile);
  }
  const e = 0.00012;
  const bbox = [lat - e, lng - e, lat + e, lng + e, 'urn:ogc:def:crs:EPSG::4326'].join(',');
  const params = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'cp:CadastralParcel', srsName: 'EPSG:4326', bbox, count: '100' });
  const serviceUrl = new URL(profile.wfsUrl);
  params.forEach((value, key) => serviceUrl.searchParams.set(key, value));
  const url = serviceUrl.toString();
  let xml = '';
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/gml+xml, text/xml', 'User-Agent': 'LandSurf/1.0 Germany cadastral evidence' } });
    if (!response.ok) return unavailable('SOURCE_UNAVAILABLE', `The official ${profile.state} ALKIS parcel service returned HTTP ${response.status}.`, profile, url);
    xml = await response.text();
  } catch {
    return unavailable('SOURCE_UNAVAILABLE', `The official ${profile.state} ALKIS parcel service could not be reached.`, profile, url);
  }
  const candidates = extractMembers(xml);
  if (!candidates.length) return unavailable('NO_DATA', `The official ${profile.state} ALKIS parcel service returned no parcel geometry for the selected coordinate.`, profile, url);
  const selected = candidates.find(candidate => pointInRing(lat, lng, candidate.ring));
  if (!selected || !selected.label) return unavailable('MALFORMED_DATA', `The official ${profile.state} ALKIS service returned parcel data, but no single containing parcel could be resolved.`, profile, url);
  const parcel = { parcelId: 'Flurstück ' + selected.label, nationalCadastralReference: selected.ref, officialAreaM2: selected.area, geometryPoints: selected.ring, state: profile.state, stateCode: profile.stateCode };
  const claim = `The official ${profile.state} ALKIS service identifies ${parcel.parcelId}` + (parcel.officialAreaM2 !== null ? ` with a registered area of ${parcel.officialAreaM2} m²` : '') + ' at the selected coordinate.';
  const evidence: EvidenceItem = {
    id: profile.evidenceId, category: 'Cadastre & identification', claim, status: 'VERIFIED',
    sourceName: profile.sourceName, sourceUrl: url, datasetDate: today(),
    spatialRelationship: 'Official INSPIRE cadastral parcel polygon containing the selected coordinate',
    calculationMethod: `${profile.state} INSPIRE-WFS cp:CadastralParcel bbox query in EPSG:4326; containing polygon resolved by point-in-polygon test`,
    confidence: 'High',
    limitation: 'The returned parcel polygon is official cadastral evidence, but this report does not establish ownership, title, easements or a legally re-surveyed boundary. Those matters require the competent cadastral and land-register authorities.',
    value: parcel
  };
  return {
    success: true,
    sourceName: profile.sourceName,
    sourceUrl: url,
    datasetDate: today(),
    parcel,
    evidence: [evidence],
    limitation: evidence.limitation,
    viewServiceUrl: profile.wmsUrl,
    viewLayer: profile.wmsLayer || 'CP.CadastralParcel',
    viewStyle: profile.wmsStyle,
    viewAttribution: profile.stateCode === 'DE-BW' ? '© LGL Baden-Württemberg' : profile.stateCode === 'DE-BB' ? '© GeoBasis-DE/LGB' : profile.stateCode === 'DE-HE' ? '© GeoBasis Hessen' : profile.stateCode === 'DE-NI' ? '© LGLN' : profile.stateCode === 'DE-SN' ? '© GeoSN' : profile.stateCode === 'DE-ST' ? '© LVermGeo Sachsen-Anhalt' : profile.stateCode === 'DE-SH' ? '© GeoBasis-DE/LVermGeo SH' : profile.stateCode === 'DE-HH' ? '© Landesbetrieb Geoinformation und Vermessung Hamburg' : profile.stateCode === 'DE-SL' ? '© GeoBasis DE/LVGL-SL' : profile.publisher
  };
}

export function applyGermanyCadastreToReport(report: VerifiedSiteReport & Record<string, any>, result: GermanyCadastreResult, requestedAreaM2: number): void {
  report.evidenceRegistry = Array.isArray(report.evidenceRegistry) ? report.evidenceRegistry.filter(item => !/^cadastre-(spatial-index|parcel-id)$/.test(item.id)) : [];
  report.evidenceRegistry.push(...result.evidence);
  if (!result.success || !result.parcel) return;
  report.parcel = { ...report.parcel, status: 'VERIFIED', parcelId: result.parcel.parcelId, countryCode: 'DE', geometryPoints: result.parcel.geometryPoints, isOfficialGeometry: true, areaCalculatedM2: requestedAreaM2, officialAreaM2: result.parcel.officialAreaM2 ?? undefined, cadastralSource: result.sourceName, datasetDate: result.datasetDate, limitation: result.limitation };
  report.germany_cadastre = result.parcel;
}
export const GERMANY_CADASTRE_SOURCE = PROFILES.map(({ state, stateCode, sourceName, wfsUrl, wmsUrl, portalUrl }) => ({ state, stateCode, sourceName, serviceUrl: wfsUrl, viewServiceUrl: wmsUrl, portalUrl }));
