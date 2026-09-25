import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA' | 'STATE_NOT_AUTOMATED';
  sourceName: string;
  publisher?: string;
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
  wfsTypeName?: string;
  wfsVersion?: string;
  querySrsName?: string;
  bboxCrs?: string;
  bboxEpsilon?: number;
  schema: 'INSPIRE' | 'BERLIN' | 'BREMEN' | 'THURINGIA';
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
    state: 'Berlin', stateCode: 'DE-BE',
    schema: 'BERLIN', wfsTypeName: 'alkis_flurstuecke:flurstuecke',
    aliases: ['berlin', 'de-be'],
    wfsUrl: 'https://gdi.berlin.de/services/wfs/alkis_flurstuecke',
    wmsUrl: 'https://gdi.berlin.de/services/wms/alkis_flurstuecke',
    wmsLayer: 'flurstuecke', wmsStyle: 'alkis_flurstuecke',
    sourceName: 'Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen Berlin — ALKIS Berlin Flurstücke WFS',
    publisher: 'Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen Berlin',
    portalUrl: 'https://daten.berlin.de/datensaetze/alkis-berlin-flurstucke-wfs-1bc014d7',
    evidenceId: 'de-be-alkis-cadastre'
  },
  {
    state: 'Bremen', stateCode: 'DE-HB',
    schema: 'BREMEN', wfsTypeName: 'app:flurstuecke',
    aliases: ['bremen', 'freie hansestadt bremen', 'de-hb', 'bremen and bremerhaven'],
    wfsUrl: 'https://geodienste.bremen.de/wfs_hduk2958loah3976niun',
    wmsUrl: 'https://geodienste.bremen.de/wms_inspire_cp_alkis',
    wmsLayer: 'cp_cadastralparcel', wmsStyle: 'cp_cadastralparcel',
    sourceName: 'Landesamt GeoInformation Bremen — ALKIS Flurstücke',
    publisher: 'Landesamt GeoInformation Bremen',
    portalUrl: 'https://metaver.de/trefferanzeige?docuuid=181B6EB2-AE14-4774-9B65-DB21FF4286C8',
    evidenceId: 'de-hb-alkis-cadastre'
  },
  {
    state: 'Baden-Württemberg', stateCode: 'DE-BW',
    schema: 'INSPIRE',
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
    schema: 'INSPIRE',
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
    schema: 'INSPIRE',
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
    schema: 'INSPIRE',
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
    schema: 'INSPIRE',
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
    schema: 'INSPIRE',
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
    state: 'Sachsen', stateCode: 'DE-SN',
    schema: 'INSPIRE', querySrsName: 'EPSG:4258', bboxCrs: 'urn:ogc:def:crs:EPSG::4258', bboxEpsilon: 0.001,
    aliases: ['sachsen', 'saxony', 'de-sn'],
    wfsUrl: 'https://geodienste.sachsen.de/aaa/public_inspire/alkis/cp/dls/wfs',
    wmsUrl: 'https://geodienste.sachsen.de/iwms_geosn_flurstuecke/guest',
    wmsStyle: 'CP.CadastralParcel.OutlinesOnly',
    sourceName: 'GeoSN — INSPIRE-WFS Flurstücke/Grundstücke ALKIS Sachsen',
    publisher: 'GeoSN',
    portalUrl: 'https://www.geodaten.sachsen.de/',
    evidenceId: 'de-sn-alkis-cadastre'
  },
  {
    state: 'Saarland', stateCode: 'DE-SL',
    schema: 'INSPIRE', querySrsName: 'EPSG:4258', bboxCrs: 'urn:ogc:def:crs:EPSG::4258',
    aliases: ['saarland', 'de-sl'],
    wfsUrl: 'https://geoportal.saarland.de/gdi-sl/inspirewfs_Flurstuecke_Grundstuecke_ALKIS',
    wmsUrl: 'https://geoportal.saarland.de/gdi-sl/inspirewms_Flurstuecke_Grundstuecke_ALKIS',
    wmsStyle: 'CP.CadastralParcel.Default',
    sourceName: 'Geoportal Saarland — INSPIRE-WFS Flurstücke/Grundstücke ALKIS',
    publisher: 'Landesamt für Vermessung, Geoinformation und Landentwicklung Saarland',
    portalUrl: 'https://geoportal.saarland.de/',
    evidenceId: 'de-sl-alkis-cadastre'
  },
  {
    state: 'Thüringen', stateCode: 'DE-TH',
    schema: 'THURINGIA', wfsTypeName: 'ave:Flurstueck', querySrsName: 'EPSG:25832', bboxCrs: 'urn:ogc:def:crs:EPSG::25832', bboxEpsilon: 500,
    aliases: ['thüringen', 'thueringen', 'thuringia', 'de-th'],
    wfsUrl: 'https://www.geoproxy.geoportal-th.de/geoproxy/services/adv_alkis_v2_wfs',
    wmsUrl: 'https://www.geoproxy.geoportal-th.de/geoproxy/services/INSPIREcp',
    wmsStyle: 'CP.CadastralParcel.Default',
    sourceName: 'TLBG Thüringen — ALKIS Flurstücke WFS',
    publisher: 'Thüringer Landesamt für Bodenmanagement und Geoinformation',
    portalUrl: 'https://geomis.geoportal-th.de/geonetwork/srv/search?keyword=Flurstücke',
    evidenceId: 'de-th-alkis-cadastre'
  },
  {
    state: 'Sachsen-Anhalt', stateCode: 'DE-ST',
    schema: 'INSPIRE',
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
    schema: 'INSPIRE',
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
    schema: 'INSPIRE',
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

function wgs84ToUtm32(lat: number, lon: number): [number, number] {
  const a = 6378137;
  const eccentricity = 0.08181919084262149;
  const k0 = 0.9996;
  const e2 = eccentricity ** 2;
  const ep2 = e2 / (1 - e2);
  const phi = lat * Math.PI / 180;
  const lambda = lon * Math.PI / 180;
  const lambda0 = 9 * Math.PI / 180;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const n = a / Math.sqrt(1 - e2 * sinPhi ** 2);
  const t = tanPhi ** 2;
  const c = ep2 * cosPhi ** 2;
  const aa = cosPhi * (lambda - lambda0);
  const m = a * (
    (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi)
  );
  const x = 500000 + k0 * n * (
    aa + (1 - t + c) * aa ** 3 / 6 + (5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * aa ** 5 / 120
  );
  const y = k0 * (
    m + n * tanPhi * (aa ** 2 / 2 + (5 - t + 9 * c + 4 * c ** 2) * aa ** 4 / 24 + (61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * aa ** 6 / 720)
  );
  return [x, y];
}

function utm32ToWgs84(easting: number, northing: number): [number, number] {
  const a = 6378137;
  const eccentricity = 0.08181919084262149;
  const k0 = 0.9996;
  const e1 = (1 - Math.sqrt(1 - eccentricity ** 2)) / (1 + Math.sqrt(1 - eccentricity ** 2));
  const x = easting - 500000;
  const y = northing;
  const m = y / k0;
  const mu = m / (a * (1 - eccentricity ** 2 / 4 - 3 * eccentricity ** 4 / 64 - 5 * eccentricity ** 6 / 256));
  const j1 = 3 * e1 / 2 - 27 * e1 ** 3 / 32;
  const j2 = 21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32;
  const j3 = 151 * e1 ** 3 / 96;
  const j4 = 1097 * e1 ** 4 / 512;
  const fp = mu + j1 * Math.sin(2 * mu) + j2 * Math.sin(4 * mu) + j3 * Math.sin(6 * mu) + j4 * Math.sin(8 * mu);
  const e2 = eccentricity ** 2 / (1 - eccentricity ** 2);
  const c1 = e2 * Math.cos(fp) ** 2;
  const t1 = Math.tan(fp) ** 2;
  const n1 = a / Math.sqrt(1 - eccentricity ** 2 * Math.sin(fp) ** 2);
  const r1 = a * (1 - eccentricity ** 2) / (1 - eccentricity ** 2 * Math.sin(fp) ** 2) ** 1.5;
  const d = x / (n1 * k0);
  const q1 = n1 * Math.tan(fp) / r1;
  const q2 = d ** 2 / 2;
  const q3 = (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * e2) * d ** 4 / 24;
  const q4 = (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * e2 - 3 * c1 ** 2) * d ** 6 / 720;
  const lat = fp - q1 * (q2 - q3 + q4);
  const lon0 = (32 * 6 - 183) * Math.PI / 180;
  const lon = lon0 + (d - (1 + 2 * t1 + c1) * d ** 3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * e2 + 24 * t1 ** 2) * d ** 5 / 120) / Math.cos(fp);
  return [lat * 180 / Math.PI, lon * 180 / Math.PI];
}
function extractMembers(xml: string, profile: GermanyCadastreProfile) {
  const featureName = profile.schema === 'INSPIRE' ? 'CadastralParcel' : profile.schema === 'THURINGIA' ? 'Flurstueck' : 'flurstuecke';
  const featurePattern = new RegExp(`<(?:(?:[A-Za-z0-9_.-]+):)?${featureName}\\b[\\s\\S]*?<\\/(?:(?:[A-Za-z0-9_.-]+):)?${featureName}>`, 'gi');
  const readTag = (member: string, names: string[]) => {
    for (const name of names) {
      const match = member.match(new RegExp(`<(?:[A-Za-z0-9_.-]+:)?${name}[^>]*>([^<]+)<\\/(?:[A-Za-z0-9_.-]+:)?${name}>`, 'i'));
      const value = text(match?.[1]);
      if (value) return value;
    }
    return null;
  };
  return [...xml.matchAll(featurePattern)].map(match => {
    const member = match[0];
    const label = profile.schema === 'INSPIRE'
      ? readTag(member, ['label'])
      : profile.schema === 'BERLIN'
      ? (() => {
          const numerator = readTag(member, ['zae']);
          const denominator = readTag(member, ['nen']);
          return numerator ? `${numerator}${denominator ? '/' + denominator : ''}` : null;
        })()
      : (() => {
          const numerator = readTag(member, ['flstnrzae']);
          const denominator = readTag(member, ['flstnrnen']);
          return numerator ? `${numerator}${denominator ? '/' + denominator : ''}` : null;
        })();
    const ref = profile.schema === 'INSPIRE'
      ? readTag(member, ['nationalCadastralReference'])
      : profile.schema === 'BERLIN'
      ? readTag(member, ['fsko'])
      : readTag(member, ['flstkennz']);
    const area = numberValue(profile.schema === 'INSPIRE'
      ? readTag(member, ['areaValue'])
      : profile.schema === 'BERLIN'
      ? readTag(member, ['afl'])
      : readTag(member, ['flaeche']));
    const positions = [...member.matchAll(/<gml:posList>([^<]+)<\/gml:posList>/g)].flatMap(match => match[1].trim().split(/\s+/).map(Number));
    const ring: [number, number][] = [];
    for (let i = 0; i + 1 < positions.length; i += 2) {
      const a = positions[i], b = positions[i + 1];
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const point: [number, number] = profile.schema === 'THURINGIA'
        ? utm32ToWgs84(a, b)
        : a >= 47 && a <= 56 && b >= 4 && b <= 16
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
  return { success: false, reasonCode, sourceName, publisher: profile?.publisher, sourceUrl, datasetDate: today(), evidence: [evidence], limitation: evidence.limitation };
}

export async function queryGermanyCadastre(lat: number, lng: number, state: string | null | undefined, fetcher: typeof fetch = fetch): Promise<GermanyCadastreResult> {
  const profile = profileForState(state);
  if (!profile) {
    return unavailable('STATE_NOT_AUTOMATED', state
      ? `Germany's cadastral data are administered by the federal states. LandSurf has not yet validated an automated official parcel lookup for ${state}.`
      : 'Germany\'s cadastral data are administered by the federal states. A German Land must be identified before an official parcel service can be selected.', profile);
  }
  const e = profile.bboxEpsilon || 0.00012;
  const querySrsName = profile.querySrsName || 'EPSG:4326';
  const [west, south, east, north] = querySrsName === 'EPSG:25832'
    ? (() => {
        const [x, y] = wgs84ToUtm32(lat, lng);
        return [x - e, y - e, x + e, y + e];
      })()
    : [lat - e, lng - e, lat + e, lng + e];
  const bbox = [west, south, east, north, profile.bboxCrs || 'urn:ogc:def:crs:EPSG::4326'].join(',');
  const params = new URLSearchParams({ service: 'WFS', version: profile.wfsVersion || '2.0.0', request: 'GetFeature', typeNames: profile.wfsTypeName || 'cp:CadastralParcel', srsName: querySrsName, bbox, count: '100' });
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
  const candidates = extractMembers(xml, profile);
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
    publisher: profile.publisher,
    sourceUrl: url,
    datasetDate: today(),
    parcel,
    evidence: [evidence],
    limitation: evidence.limitation,
    viewServiceUrl: profile.wmsUrl,
    viewLayer: profile.wmsLayer || 'CP.CadastralParcel',
    viewStyle: profile.wmsStyle,
    viewAttribution: profile.publisher,
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
