import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyBremenHydrogeologyResult {
  state: 'Bremen';
  evidence: EvidenceItem[];
  groundwaterDepthMapped: boolean;
  groundwaterContoursMapped: boolean;
  groundwaterMonitoringMapped: boolean;
}

const GDfB_WMS = 'https://gdfbmapserver.marum.de/cgi-bin/mapserv?Map=/var/www/html/SUBVIntern/Internet_wms.map&';
const MONITORING_WMS = 'https://geodienste.bremen.de/wms_grundwassermessstellen?';
const SOURCE = 'Geologischer Dienst Bremen / SUKW — Hydrogeologie und Grundwasser';
const STATE = 'Bremen' as const;
const today = () => new Date().toISOString().slice(0, 10);

async function fetchText(url: string, fetcher: typeof fetch): Promise<string | null> {
  try {
    const r = await fetcher(url, {
      headers: { Accept: 'application/xml, text/xml, text/plain, application/json' }
    });
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

function findLayer(capabilities: string, terms: string[]): string | null {
  const re = /<Layer[^>]*>[\s\S]*?<Name>([^<]+)<\/Name>[\s\S]*?(?:<Title>([^<]+)<\/Title>)?[\s\S]*?<\/Layer>/gi;
  for (const m of capabilities.matchAll(re)) {
    const name = m[1].trim();
    const title = (m[2] || '').trim().toLowerCase();
    if (terms.some(term => name.toLowerCase().includes(term) || title.includes(term))) return name;
  }
  return null;
}

async function queryWms(
  base: string,
  terms: string[],
  lat: number,
  lng: number,
  fetcher: typeof fetch
): Promise<{ text: string | null; url: string }> {
  const capUrl = base + 'SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1';
  const caps = await fetchText(capUrl, fetcher);
  if (!caps) return { text: null, url: capUrl };
  const layer = findLayer(caps, terms);
  if (!layer) return { text: null, url: capUrl };

  const d = 0.02;
  const url = base + new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    SRS: 'EPSG:4326',
    LAYERS: layer,
    QUERY_LAYERS: layer,
    INFO_FORMAT: 'text/plain',
    BBOX: [(lng - d).toFixed(6), (lat - d).toFixed(6), (lng + d).toFixed(6), (lat + d).toFixed(6)].join(','),
    WIDTH: '101',
    HEIGHT: '101',
    X: '50',
    Y: '50',
    FEATURE_COUNT: '10'
  }).toString();

  return { text: await fetchText(url, fetcher), url };
}

function addEvidence(
  evidence: EvidenceItem[],
  id: string,
  query: { text: string | null; url: string },
  claim: string,
  limitation: string,
  confidence: 'High' | 'Medium' | 'Low' = 'High'
): void {
  if (!query.text || /serviceexception|exceptionreport|error/i.test(query.text)) return;
  evidence.push({
    id,
    category: 'Hydrogeology',
    claim: claim + ' Official Bremen response: ' + query.text.replace(/\s+/g, ' ').trim().slice(0, 1800),
    status: 'VERIFIED',
    sourceName: SOURCE,
    sourceUrl: query.url,
    datasetDate: today(),
    spatialRelationship: 'Official Bremen Geologischer Dienst WMS GetFeatureInfo response at the selected coordinate',
    calculationMethod: 'WMS GetCapabilities layer discovery followed by point GetFeatureInfo query',
    confidence,
    limitation,
    value: { attributeResponse: query.text }
  });
}

export async function queryGermanyBremenHydrogeology(
  lat: number,
  lng: number,
  state: string | null | undefined,
  fetcher: typeof fetch = fetch
): Promise<GermanyBremenHydrogeologyResult> {
  const normalized = String(state || '').trim().toLowerCase();
  if (normalized && !['bremen', 'freies bremen', 'freie hansestadt bremen'].includes(normalized)) {
    return {
      state: STATE,
      evidence: [],
      groundwaterDepthMapped: false,
      groundwaterContoursMapped: false,
      groundwaterMonitoringMapped: false
    };
  }

  const evidence: EvidenceItem[] = [];

  const groundwaterDepth = await queryWms(
    GDfB_WMS,
    ['grundwasserflurabstand', 'höchststand und tiefststand', 'höchststand', 'grundwasserflur'],
    lat, lng, fetcher
  );
  addEvidence(
    evidence,
    'de-hb-groundwater-depth',
    groundwaterDepth,
    'The official Geologischer Dienst Bremen hydrogeology service provides location-based information on groundwater conditions, including the highest and lowest groundwater levels at the selected site. This is directly relevant for screening whether groundwater may be encountered during excavation.',
    'The map is a regional planning product and does not replace a current groundwater measurement at the property. The reported high/low values should be interpreted together with the map date, local geology and planned excavation depth.',
    'High'
  );

  const contours = await queryWms(
    GDfB_WMS,
    ['grundwassergleichenplan', 'grundwassergleichen', 'gwk'],
    lat, lng, fetcher
  );
  addEvidence(
    evidence,
    'de-hb-groundwater-contours',
    contours,
    'The official Bremen groundwater-contour plan provides groundwater-pressure/elevation information in metres above NN and shows the regional groundwater surface and flow gradients.',
    'The published contour plan is based on November 2011 groundwater-pressure observations and is not a current groundwater measurement. Seasonal and hydrological conditions can differ materially from the mapped reference period.',
    'High'
  );

  const hydro = await queryWms(
    GDfB_WMS,
    ['grundwasser', 'hydrogeologie', 'geoplan', 'grundwasserleiter'],
    lat, lng, fetcher
  );
  addEvidence(
    evidence,
    'de-hb-hydrogeology',
    hydro,
    'Bremen has a dedicated geological and hydrogeological planning information system (GEOPLAN) that combines geoscientific planning material, geological/hydrogeological assessments and borehole information into regional and three-dimensional models.',
    'Regional hydrogeological planning information does not establish parcel-level conditions; local boreholes and project-specific investigation remain necessary for detailed construction design.'
  );

  const monitoring = await queryWms(
    MONITORING_WMS,
    ['grundwassermessstellen', 'grundwassermessstelle', 'messstellen'],
    lat, lng, fetcher
  );
  addEvidence(
    evidence,
    'de-hb-groundwater-monitoring',
    monitoring,
    'The official Bremen groundwater monitoring network contains more than 170 stations across Bremen and Bremerhaven, with long time series at many locations. A monitoring station response near the selected coordinate can therefore provide important local context for groundwater conditions.',
    'A monitoring location does not equal a property-level groundwater measurement. Station distance, screened aquifer, elevation, observation date and seasonal conditions must be considered. Current numerical readings are exposed publicly for only a subset of stations.',
    'High'
  );

  if (!evidence.length) {
    evidence.push({
      id: 'de-hb-hydrogeology-no-data',
      category: 'Hydrogeology',
      claim: 'The official Bremen hydrogeological services did not return a usable attribute response for the selected coordinate.',
      status: 'REQUIRES_VERIFICATION',
      sourceName: SOURCE,
      sourceUrl: GDfB_WMS,
      datasetDate: today(),
      spatialRelationship: 'Selected site coordinate in Bremen',
      calculationMethod: 'Official Bremen WMS query; missing responses are not interpreted as negative findings',
      confidence: 'Low',
      limitation: 'No current groundwater condition is inferred from a missing regional-map response.',
      value: { reasonCode: 'INSUFFICIENT_EVIDENCE' }
    });
  }

  return {
    state: STATE,
    evidence,
    groundwaterDepthMapped: evidence.some(i => i.id === 'de-hb-groundwater-depth' && i.status === 'VERIFIED'),
    groundwaterContoursMapped: evidence.some(i => i.id === 'de-hb-groundwater-contours' && i.status === 'VERIFIED'),
    groundwaterMonitoringMapped: evidence.some(i => i.id === 'de-hb-groundwater-monitoring' && i.status === 'VERIFIED')
  };
}

export function enrichGermanyBremenHydrogeology(
  report: VerifiedSiteReport & Record<string, any>,
  result: GermanyBremenHydrogeologyResult
): void {
  if (!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry = [];
  report.evidenceRegistry.push(...result.evidence);

  const depth = result.evidence.find(i => i.id === 'de-hb-groundwater-depth' && i.status === 'VERIFIED');
  const contours = result.evidence.find(i => i.id === 'de-hb-groundwater-contours' && i.status === 'VERIFIED');
  const hydro = result.evidence.find(i => i.id === 'de-hb-hydrogeology' && i.status === 'VERIFIED');
  const monitoring = result.evidence.find(i => i.id === 'de-hb-groundwater-monitoring' && i.status === 'VERIFIED');

  report.geosurvey_context = {
    ...(report.geosurvey_context || {}),
    hb_groundwater_depth_mapped: Boolean(depth),
    hb_groundwater_contours_mapped: Boolean(contours),
    hb_hydrogeology_mapped: Boolean(hydro),
    hb_groundwater_monitoring_mapped: Boolean(monitoring),
    hb_hydrogeology_evidence_level: depth || contours || hydro || monitoring ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
    hb_hydrogeology_source: SOURCE
  };

  if (report.soil && (depth || contours || hydro || monitoring)) {
    report.soil.groundwaterNotice = [
      depth?.claim,
      contours?.claim,
      hydro?.claim,
      monitoring?.claim,
      'For construction screening, Bremen groundwater evidence should be compared with the planned excavation depth. A property can be outside a mapped flood area and still encounter groundwater during excavation.',
      'The Bremen location-based groundwater map is a regional screening source. Current local groundwater conditions, perched or seasonally elevated water and dewatering requirements require site-specific verification.'
    ].filter(Boolean).join(' ');
  }
}

export const GERMANY_BREMEN_HYDROGEOLOGY_SOURCES = {
  geologicServiceWms: GDfB_WMS,
  groundwaterMonitoringWms: MONITORING_WMS,
  groundwaterLevels: 'https://www.umwelt.bremen.de/grundwasser',
  hydrogeologyMap: 'https://gdfbmapserver.marum.de/mapbender3/application/Hydrogeologie',
  geoportal: 'https://geoportal.bremen.de/geoportal/',
  geoplanBackground: 'https://umwelt.bremen.de/sixcms/media.php/13/Bremischer%20Beitrag%202021%20bis%202027.pdf'
};
