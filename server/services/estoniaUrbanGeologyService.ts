import { EvidenceItem } from '../types';

type FetchLike = typeof fetch;

const XGIS = 'https://xgis.maaamet.ee/xgis2/service';
const BUILDING_WFS = XGIS + '/18f51fs';
const PARNU_WFS = XGIS + '/1fggtsf';
const WATER_WFS = XGIS + '/mdt82c';
const PORTAL = 'https://geoportaal.maaamet.ee/index.php?lang_id=1&page_id=417';
const DATASET_DATE = '2024-12-10';
const SURVEY_RADIUS_M = 5000;
const MAX_FEATURES = 100;

const BUILDING_TYPES = new Set([
  'ehitusplatsi uuring', 'geotehniline uuring', 'geotehniline kontroll',
  'ehitusgeoloogiline iseloomustus', 'hüdrogeoloogiline uuring',
  'reostusuuring', 'ehitusgeoloogiline kaardistamine'
]);

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim().replace(/\s+/g, ' ');
  return cleaned || null;
}

function numberValue(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function projectTo3301(lat: number, lng: number): [number, number] {
  const a = 6378137;
  const f = 1 / 298.257222101;
  const e = Math.sqrt(2 * f - f * f);
  const lat1 = 58 * Math.PI / 180;
  const lat2 = (59 + 1 / 3) * Math.PI / 180;
  const lat0 = (57 + 31 / 60 + 3.194 / 3600) * Math.PI / 180;
  const lon0 = 24 * Math.PI / 180;
  const m = (p: number) => Math.cos(p) / Math.sqrt(1 - e * e * Math.sin(p) ** 2);
  const t = (p: number) => Math.tan(Math.PI / 4 - p / 2) /
    ((1 - e * Math.sin(p)) / (1 + e * Math.sin(p))) ** (e / 2);
  const n = Math.log(m(lat1) / m(lat2)) / Math.log(t(lat1) / t(lat2));
  const k = m(lat1) / (n * t(lat1) ** n);
  const rho0 = a * k * t(lat0) ** n;
  const phi = lat * Math.PI / 180;
  const lambda = lng * Math.PI / 180;
  const rho = a * k * t(phi) ** n;
  const theta = n * (lambda - lon0);
  return [500000 + rho * Math.sin(theta), 6375000 + rho0 - rho * Math.cos(theta)];
}

function bboxUrl(service: string, typeName: string, lat: number, lng: number, radiusM: number): string {
  const [x, y] = projectTo3301(lat, lng);
  const params = new URLSearchParams({
    service: 'WFS', version: '1.0.0', request: 'GetFeature', typeName,
    outputFormat: 'text/xml; subtype=gml/2.1.2', SRSNAME: 'EPSG:3301',
    BBOX: [x - radiusM, y - radiusM, x + radiusM, y + radiusM].map(v => v.toFixed(2)).join(','),
    maxFeatures: String(MAX_FEATURES)
  });
  return service + '?' + params.toString();
}

async function fetchText(fetcher: FetchLike, url: string, timeoutMs = 9000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { signal: controller.signal });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface ParsedFeature {
  id: string | null;
  properties: Record<string, string>;
  rings: [number, number][][];
}

function parseGmlFeatures(xml: string): ParsedFeature[] {
  const members = xml.match(/<(?:[A-Za-z_][\w.-]*:)?featureMember\b[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?featureMember>/g) || [];
  return members.map(member => {
    const id = member.match(/\bfid="([^"]+)"/)?.[1] || null;
    const properties: Record<string, string> = {};
    const rings: [number, number][][] = [];
    const body = member.replace(/<(?:[A-Za-z_][\w.-]*:)?(?:GEOM_ALA|msGeometry|boundedBy)\b[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?(?:GEOM_ALA|msGeometry|boundedBy)>/g, '');
    for (const match of body.matchAll(/<([A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)\b[^>]*>([^<]*)<\/\1\2>/g)) {
      const value = text(match[3]);
      if (value) properties[match[2]] = value;
    }
    for (const match of member.matchAll(/<([A-Za-z_][\w.-]*:)?coordinates\b[^>]*>([\s\S]*?)<\/\1coordinates>/g)) {
      const ring = match[2].trim().split(/\s+/).map(pair => {
        const [x, y] = pair.split(',').map(Number);
        return Number.isFinite(x) && Number.isFinite(y) ? [x, y] as [number, number] : null;
      }).filter((point): point is [number, number] => Boolean(point));
      if (ring.length >= 3) rings.push(ring);
    }
    return { id, properties, rings };
  });
}

function pointInRing(point: [number, number], ring: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / ((yj - yi) || Number.EPSILON) + xi) inside = !inside;
  }
  return inside;
}

function containsSite(site: [number, number], rings: [number, number][][]): boolean {
  return rings.some(ring => pointInRing(site, ring));
}

function centroid(rings: [number, number][][]): [number, number] | null {
  const ring = rings[0];
  if (!ring?.length) return null;
  const sum = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return [sum[0] / ring.length, sum[1] / ring.length];
}

function distanceM(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function evidence(
  id: string, category: string, claim: string, sourceUrl: string,
  relationship: string, method: string, confidence: 'High' | 'Medium' | 'Low',
  value: Record<string, unknown>, limitation: string,
  status: 'VERIFIED' | 'MODELLED' | 'REQUIRES_VERIFICATION' = 'VERIFIED',
  sourceName = 'Maa- ja Ruumiamet / Estonian Geological Survey (EGT)'
): EvidenceItem {
  return {
    id, category, claim, status,
    sourceName,
    sourceUrl, datasetDate: DATASET_DATE, spatialRelationship: relationship,
    calculationMethod: method, confidence, value, limitation
  };
}

function surveyType(value: unknown): string {
  return (text(value) || '').toLowerCase();
}

function inParnu(lat: number, lng: number): boolean {
  return lat >= 58.25 && lat <= 58.55 && lng >= 24.1 && lng <= 24.8;
}

function inTartu(lat: number, lng: number): boolean {
  return lat >= 58.28 && lat <= 58.48 && lng >= 26.55 && lng <= 26.95;
}

function landslideLabel(value: unknown): string {
  const labels: Record<string, string> = {
    savi_potents: 'potential clay-slide area',
    savilihked: 'clay-slide area',
    liiv_potents: 'potential sand-slide area',
    liivalihked: 'sand-slide area',
    savi_liivalihke: 'clay–sand slide area',
    ohutu: 'ohutu (no hazard class in this dataset)'
  };
  const key = surveyType(value);
  return labels[key] || text(value) || 'mapped landslide class';
}

export interface EstoniaUrbanEvidenceResult { evidence: EvidenceItem[]; }

export async function queryEstoniaUrbanGeology(
  lat: number, lng: number, fetcher: FetchLike = fetch
): Promise<EstoniaUrbanEvidenceResult> {
  const site = projectTo3301(lat, lng);
  const evidenceItems: EvidenceItem[] = [];
  const surveyUrl = bboxUrl(BUILDING_WFS, 'EHITUSGEOLOOGIA_ALA_LIIK', lat, lng, SURVEY_RADIUS_M);
  const surveyXml = await fetchText(fetcher, surveyUrl);

  if (surveyXml === null) {
    evidenceItems.push(evidence(
      'ee-egt-building-geology-unavailable', 'Urban geology & ground investigations',
      'The official Estonia building-geology survey layer could not be queried for this location.', PORTAL,
      'Selected site coordinate', 'Maa- ja Ruumiamet X-GIS WFS query against the official building-geology survey layer',
      'Low', { reasonCode: 'SOURCE_UNAVAILABLE' },
      'The building-geology application data are a historical snapshot dated 10 December 2024. Source failure is not evidence that surveys are absent; newer information should be checked with EGT.',
      'REQUIRES_VERIFICATION'
    ));
  } else {
    const surveys = parseGmlFeatures(surveyXml).map(feature => {
      const centre = centroid(feature.rings);
      return centre ? {
        feature, distanceM: distanceM(site, centre), contains: containsSite(site, feature.rings)
      } : null;
    }).filter((item): item is { feature: ParsedFeature; distanceM: number; contains: boolean } => Boolean(item))
      .filter(item => item.contains || item.distanceM <= SURVEY_RADIUS_M)
      .sort((a, b) => Number(b.contains) - Number(a.contains) || a.distanceM - b.distanceM);

    if (surveys.length) {
      const relevant = surveys.filter(item => BUILDING_TYPES.has(surveyType(item.feature.properties.LIIK_TXT)) || item.contains);
      const pool = relevant.length ? relevant : surveys;
      const nearest = pool[0];
      const examples = pool.slice(0, 5).map(item => ({
        reference: item.feature.properties.ID || item.feature.id,
        name: text(item.feature.properties.NIMI),
        year: numberValue(item.feature.properties.AASTA),
        type: text(item.feature.properties.LIIK_TXT),
        stage: text(item.feature.properties.STAADIUM_TXT),
        maxDepthM: numberValue(item.feature.properties.MAX_SYGAV),
        address: text(item.feature.properties.ORIG_AADRESS),
        distanceM: Math.round(item.distanceM),
        containsSite: item.contains
      }));
      const capped = parseGmlFeatures(surveyXml).length >= MAX_FEATURES;
      evidenceItems.push(evidence(
        'ee-egt-building-geology-surveys', 'Urban geology & ground investigations',
        'The official Estonia building-geology survey layer returned ' + (capped ? 'at least ' : '') + surveys.length +
          ' mapped survey areas within 5 km of the selected coordinate. The nearest selected survey is about ' +
          Math.round(nearest.distanceM).toLocaleString('en-GB') + ' m away.', surveyUrl,
        nearest.contains ? 'Survey area polygon containing the selected coordinate' : 'Nearby official survey areas within 5 km',
        'Maa- ja Ruumiamet X-GIS WFS query in EPSG:3301; local centroid distance and polygon containment', 'Medium',
        { recordCount: surveys.length, capped, asOf: DATASET_DATE, nearestDistanceM: Math.round(nearest.distanceM), examples },
        'Nearby historical survey areas are contextual evidence, not a measured ground profile beneath the parcel. Individual reports may contain useful logs, but their findings must not be transferred to the parcel without appropriate verification.'
      ));
    } else {
      evidenceItems.push(evidence(
        'ee-egt-building-geology-open', 'Urban geology & ground investigations',
        'No mapped building-geology survey area was returned within 5 km of the selected coordinate.', PORTAL,
        'Nearby official building-geology survey search', 'Maa- ja Ruumiamet X-GIS WFS query in EPSG:3301', 'Low',
        { reasonCode: 'NO_DATA', searchRadiusKm: 5, asOf: DATASET_DATE },
        'No returned survey is not evidence that no investigation exists. The application is a 10 December 2024 snapshot and additional records may be available through EGT or the archive.',
        'REQUIRES_VERIFICATION'
      ));
    }
  }

  if (inParnu(lat, lng)) {
    const url = bboxUrl(PARNU_WFS, 'ehgeol_lihkeoht_2024', lat, lng, 12000);
    const xml = await fetchText(fetcher, url);
    const matches = xml ? parseGmlFeatures(xml).filter(feature => containsSite(site, feature.rings)) : [];
    if (matches.length) {
      const classes = [...new Set(matches.map(feature => landslideLabel(feature.properties.klass)))];
      const soils = [...new Set(matches.map(feature => text(feature.properties.pinnas)).filter(Boolean))];
      evidenceItems.push(evidence(
        'ee-parnu-2024-landslide-risk', 'Urban geohazard screening',
        'A 2024 Pärnu-area building-geology study maps the selected coordinate in ' + classes.join(', ') +
          (soils.length ? ' with mapped soil context: ' + soils.join(', ') : '') + '.', url,
        'Mapped 2024 Pärnu landslide-risk polygon containing the selected coordinate',
        'Maa- ja Ruumiamet X-GIS WFS query with local polygon containment', 'High',
        { classes, soils, polygonIds: matches.map(feature => feature.properties.id || feature.id).filter(Boolean), reportLinks: matches.map(feature => feature.properties.aruanne).filter(Boolean) },
        'This is a mapped regional/local hazard-screening layer. It does not replace site-specific slope stability calculations, soil testing or engineering design.',
        'VERIFIED',
        'Pärnu City Government / Maa- ja Ruumiamet / Estonian Geological Survey (EGT)'
      ));
    }
  }

  if (inTartu(lat, lng)) {
    const url = bboxUrl(WATER_WFS, 'veetase_kuni_1_75_m', lat, lng, 3000);
    const xml = await fetchText(fetcher, url);
    const matches = xml ? parseGmlFeatures(xml).filter(feature => containsSite(site, feature.rings)) : [];
    if (matches.length) {
      evidenceItems.push(evidence(
        'ee-tartu-water-level-rise-1-75m', 'Water & flood screening',
        'The official Estonia water-level-rise model maps the selected coordinate within the +1.75 m model area.', url,
        'Model polygon containing the selected coordinate',
        'Maa- ja Ruumiamet X-GIS WFS query with local polygon containment', 'Medium',
        { modelledRiseM: 1.75, modelAreaIds: matches.map(feature => feature.properties.ID || feature.id).filter(Boolean) },
        'The +1.75 m layer is a theoretical water-level-rise model, not a flood probability or parcel-specific flood depth. It should be interpreted alongside local terrain and flood-risk information.',
        'MODELLED',
        'Maa- ja Ruumiamet'
      ));
    }
  }

  return { evidence: evidenceItems };
}

export function enrichEstoniaUrbanEvidence(report: any, evidenceItems: EvidenceItem[]): void {
  if (!report || !evidenceItems.length) return;
  const existing = report.geosurvey_context && typeof report.geosurvey_context === 'object' ? report.geosurvey_context : {};
  const surveys = evidenceItems.find(item => item.id === 'ee-egt-building-geology-surveys' && item.status === 'VERIFIED');
  const surveyValue = surveys?.value as Record<string, unknown> | undefined;
  const landslide = evidenceItems.find(item => item.id === 'ee-parnu-2024-landslide-risk' && item.status === 'VERIFIED');
  const waterModel = evidenceItems.find(item => item.id === 'ee-tartu-water-level-rise-1-75m' && item.status === 'MODELLED');

  report.geosurvey_context = {
    ...existing,
    urban_building_geology_survey_count: numberValue(surveyValue?.recordCount),
    urban_building_geology_nearest_distance_m: numberValue(surveyValue?.nearestDistanceM),
    urban_building_geology_as_of: text(surveyValue?.asOf) || (surveys ? DATASET_DATE : existing.urban_building_geology_as_of),
    urban_building_geology_examples: surveyValue?.examples || existing.urban_building_geology_examples,
    urban_landslide_dataset_class: text((landslide?.value as any)?.classes?.[0]),
    urban_landslide_dataset_soil: text((landslide?.value as any)?.soils?.[0]),
    urban_water_level_rise_model_m: waterModel ? 1.75 : existing.urban_water_level_rise_model_m,
    urban_water_level_rise_modelled: Boolean(waterModel) || existing.urban_water_level_rise_modelled
  };

  if (surveys) {
    report.geosurvey_context.urban_evidence_level = 'VERIFIED';
    report.geosurvey_context.urban_building_geology_source_name = surveys.sourceName;
    report.geosurvey_context.urban_building_geology_source_url = surveys.sourceUrl;
  }
  if (landslide) report.geosurvey_context.urban_landslide_evidence_level = 'VERIFIED';
  if (waterModel) report.geosurvey_context.urban_water_level_evidence_level = 'MODELLED';
}

export const ESTONIA_URBAN_GEOLOGY_SOURCES = {
  buildingGeology: BUILDING_WFS,
  parnuLandslide2024: PARNU_WFS,
  waterLevelRise175: WATER_WFS,
  portal: PORTAL
};
