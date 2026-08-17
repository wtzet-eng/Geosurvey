export type PgiEvidenceStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'ERROR';

export interface PgiDatasetCoverage {
  id: string;
  title: string;
  scale?: string;
  serviceType: 'WMS';
  serviceUrl: string;
  status: PgiEvidenceStatus;
  matchedLayers: string[];
  checkedAt: string;
  limitation: string;
}

/**
 * First-stage PIG-PIB evidence discovery.
 *
 * This deliberately does NOT pretend that a WMS layer is a site observation.
 * It establishes whether authoritative map coverage is available for the
 * requested country/site and records the exact service used. A later stage can
 * use the discovered layer names with GetFeatureInfo or the corresponding WFS.
 */
const POLAND_WMS: Array<Omit<PgiDatasetCoverage, 'status' | 'matchedLayers' | 'checkedAt' | 'limitation'>> = [
  {
    id: 'pgi-smgp-50k',
    title: 'Detailed Geological Map of Poland (SMGP)',
    scale: '1:50,000',
    serviceType: 'WMS',
    serviceUrl: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/smgp50k/MapServer/WMSServer'
  },
  {
    id: 'pgi-mlp-50k',
    title: 'Lithogenetic Map of Poland (MLP)',
    scale: '1:50,000',
    serviceType: 'WMS',
    serviceUrl: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/mlp50k/MapServer/WMSServer'
  },
  {
    id: 'pgi-mgp-200k',
    title: 'Geological Map of Poland (MGP)',
    scale: '1:200,000',
    serviceType: 'WMS',
    serviceUrl: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/mgp200k_a/MapServer/WMSServer'
  },
  {
    id: 'pgi-mgp-200k-b',
    title: 'Geological Map of Poland without Quaternary deposits',
    scale: '1:200,000',
    serviceType: 'WMS',
    serviceUrl: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/kartografia/mgp200k_b/MapServer/WMSServer'
  },
  {
    id: 'pgi-engineering-50k',
    title: 'Detailed Engineering-Geological Map of Poland',
    scale: '1:50,000',
    serviceType: 'WMS',
    serviceUrl: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/geoinz/smgip50k/MapServer/WMSServer'
  },
  {
    id: 'pgi-boreholes',
    title: 'Central Geological Database — Boreholes',
    serviceType: 'WMS',
    serviceUrl: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/cbdg_otwory/MapServer/WMSServer'
  },
  {
    id: 'pgi-geoenvironmental-index',
    title: 'Geoenvironmental Map of Poland — index',
    scale: '1:50,000 / 1:100,000',
    serviceType: 'WMS',
    serviceUrl: 'https://cbdgmapa.pgi.gov.pl/arcgis/services/mgsp50k_skorowidz/MapServer/WMSServer'
  }
];

function xmlLayerNames(xml: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const re = /<(?:Layer|wms:Layer)[^>]*>[\s\S]*?<Name>([^<]+)<\/Name>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const name = match[1].trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

async function getCapabilities(url: string): Promise<{ status: PgiEvidenceStatus; layers: string[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`, {
      headers: { 'User-Agent': 'GeoSurvey/1.0 evidence discovery' },
      signal: controller.signal
    });
    if (!response.ok) return { status: 'ERROR', layers: [] };
    const xml = await response.text();
    const layers = xmlLayerNames(xml);
    return { status: layers.length ? 'AVAILABLE' : 'ERROR', layers };
  } catch {
    return { status: 'ERROR', layers: [] };
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverPolandGeologicalCoverage(): Promise<PgiDatasetCoverage[]> {
  const checkedAt = new Date().toISOString();
  const results = await Promise.all(POLAND_WMS.map(async source => {
    const result = await getCapabilities(source.serviceUrl);
    return {
      ...source,
      status: result.status,
      matchedLayers: result.layers,
      checkedAt,
      limitation: result.status === 'AVAILABLE'
        ? 'Map-service coverage confirmed. Layer availability is not itself a site-specific geological observation; the next stage must query the relevant layer at the site coordinate.'
        : 'The authoritative PIG-PIB service could not be queried during this analysis. Do not infer absence of geological evidence from this result.'
    } satisfies PgiDatasetCoverage;
  }));

  return results;
}

export function pgiCoverageToEvidenceItems(coverage: PgiDatasetCoverage[]) {
  return coverage.map(item => ({
    id: `pgi-coverage-${item.id}`,
    category: 'Polish Geological Evidence — Dataset Coverage',
    claim: `${item.title}${item.scale ? ` (${item.scale})` : ''}: ${item.status === 'AVAILABLE' ? 'authoritative map service reachable and layer metadata available' : 'service could not be queried during this analysis'}`,
    status: item.status === 'AVAILABLE' ? 'VERIFIED' as const : 'REQUIRES_VERIFICATION' as const,
    sourceName: 'Państwowy Instytut Geologiczny – PIB',
    sourceUrl: item.serviceUrl,
    datasetDate: item.checkedAt.slice(0, 10),
    spatialRelationship: 'National map/service coverage check; site-specific feature not yet interpreted',
    calculationMethod: 'OGC WMS GetCapabilities service discovery',
    confidence: item.status === 'AVAILABLE' ? 'High' as const : 'Low' as const,
    limitation: item.limitation,
    value: {
      datasetId: item.id,
      scale: item.scale,
      serviceType: item.serviceType,
      matchedLayers: item.matchedLayers
    }
  }));
}
