import { EvidenceItem } from '../types';

type FetchLike = typeof fetch;

const GEO_WFS = 'https://geoserver.lvgmc.lv/geoserver/ge/ows';
const FLOOD_WFS = 'https://geoserver.lvgmc.lv/geoserver/am/ows';
const PORTAL = 'https://geolatvija.lv/';
const today = () => new Date().toISOString().slice(0, 10);

async function queryFeatures(fetcher: FetchLike, service: string, typeNames: string, lat: number, lng: number): Promise<any[]> {
  const delta = 0.003;
  const params = new URLSearchParams({
    service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames,
    srsName: 'EPSG:4326', outputFormat: 'application/json', count: '20',
    BBOX: `${lng - delta},${lat - delta},${lng + delta},${lat + delta},EPSG:4326`
  });
  try {
    const response = await fetcher(`${service}?${params}`, { headers: { Accept: 'application/json', 'User-Agent': 'GroundSurf/1.0 Latvia national evidence' } });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.features) ? data.features : [];
  } catch { return []; }
}

function firstRing(geometry: any): [number, number][] | undefined {
  const coordinates = geometry?.type === 'Polygon' ? geometry.coordinates?.[0] : geometry?.type === 'MultiPolygon' ? geometry.coordinates?.[0]?.[0] : null;
  if (!Array.isArray(coordinates)) return undefined;
  const points = coordinates.map((pair: any) => [Number(pair?.[1]), Number(pair?.[0])] as [number, number]).filter((pair: [number, number]) => Number.isFinite(pair[0]) && Number.isFinite(pair[1]));
  return points.length >= 3 ? points : undefined;
}

function contains(point: [number, number], polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]; const b = polygon[j];
    const crosses = ((a[1] > point[1]) !== (b[1] > point[1])) && (point[0] < (b[0] - a[0]) * (point[1] - a[1]) / ((b[1] - a[1]) || Number.EPSILON) + a[0]);
    if (crosses) inside = !inside;
  }
  return inside;
}

function selectedFeature(features: any[], point: [number, number]): any | null {
  return features.find(feature => { const r = firstRing(feature?.geometry); return r ? contains(point, r) : false; }) || null;
}

function makeEvidence(id: string, category: string, claim: string, sourceUrl: string, relationship: string, value: any, limitation: string, status: 'VERIFIED' | 'REQUIRES_VERIFICATION' = 'VERIFIED'): EvidenceItem {
  return {
    id, category, claim, status,
    sourceName: 'Latvian Environment, Geology and Meteorology Centre (LVĢMC)',
    sourceUrl, datasetDate: today(), spatialRelationship: relationship,
    calculationMethod: 'LVĢMC GeoServer WFS query with local point-in-polygon selection',
    confidence: status === 'VERIFIED' ? 'High' : 'Low', value, limitation
  };
}

export async function queryLatviaNationalEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<EvidenceItem[]> {
  const point: [number, number] = [lat, lng];
  const [lithology, aquifers, waterBodies, karst, faults, floods] = await Promise.all([
    queryFeatures(fetcher, GEO_WFS, 'ge:GE.GeologicUnit.Lithology', lat, lng),
    queryFeatures(fetcher, GEO_WFS, 'ge:GE.AquiferSystems', lat, lng),
    queryFeatures(fetcher, GEO_WFS, 'ge:GE.GroundWaterbody', lat, lng),
    queryFeatures(fetcher, GEO_WFS, 'ge:GE.GeologicUnit.KarsticTerrain', lat, lng),
    queryFeatures(fetcher, GEO_WFS, 'ge:GE.GeologicFault', lat, lng),
    queryFeatures(fetcher, FLOOD_WFS, 'am:AM.FloodUnitOfManagement', lat, lng)
  ]);
  const evidence: EvidenceItem[] = [];

  const lithologyFeature = selectedFeature(lithology, point);
  if (lithologyFeature) {
    const p = lithologyFeature.properties || {};
    evidence.push(makeEvidence(
      'lv-lvgmc-quaternary-geology', 'Soil & near-surface geology',
      `LVĢMC mapping identifies ${p.material_label || p.material_code || 'a mapped Quaternary material'} at the selected coordinate.`,
      `${GEO_WFS}?service=WFS&typeNames=ge:GE.GeologicUnit.Lithology`,
      'Mapped Quaternary geology polygon containing the selected coordinate',
      { material: p.material_label || p.material_code || null, mappingFrame: p.mappingframe_label || null },
      'Regional mapped geology does not establish thickness, density, bearing capacity or settlement parameters at parcel scale.'
    ));
  } else {
    evidence.push(makeEvidence(
      'lv-lvgmc-quaternary-geology-open', 'Soil & near-surface geology',
      'The LVĢMC Quaternary geology query returned no mapped polygon containing the selected coordinate.', PORTAL,
      'Selected site coordinate', { reasonCode: 'NO_DATA' },
      'No returned polygon is not evidence that mapped geology is absent or that ground conditions are benign.', 'REQUIRES_VERIFICATION'
    ));
  }

  const aquiferFeature = selectedFeature(aquifers, point);
  if (aquiferFeature) {
    const p = aquiferFeature.properties || {};
    evidence.push(makeEvidence(
      'lv-lvgmc-aquifer', 'Hydrogeology',
      `LVĢMC hydrogeological mapping identifies a ${p.mineralization_label || 'mapped'} aquifer system at the selected coordinate.`,
      `${GEO_WFS}?service=WFS&typeNames=ge:GE.AquiferSystems`,
      'Mapped aquifer-system polygon containing the selected coordinate',
      { mineralization: p.mineralization_label || null, condition: p.conditionOfGroundWaterBody_title || null },
      'Mapped hydrogeology is screening context and does not establish site groundwater level, seasonal variation or dewatering requirements.'
    ));
  } else {
    evidence.push(makeEvidence(
      'lv-lvgmc-aquifer-open', 'Hydrogeology',
      'The LVĢMC aquifer-system query returned no mapped polygon containing the selected coordinate.', PORTAL,
      'Selected site coordinate', { reasonCode: 'NO_DATA' },
      'No returned polygon is not evidence that groundwater is absent or unimportant.', 'REQUIRES_VERIFICATION'
    ));
  }

  const groundwaterFeature = selectedFeature(waterBodies, point);
  if (groundwaterFeature) {
    const p = groundwaterFeature.properties || {};
    evidence.push(makeEvidence(
      'lv-lvgmc-groundwater-body', 'Hydrogeology',
      `LVĢMC identifies groundwater body ${p.id_localId || 'for the mapped area'} at the selected coordinate.`,
      `${GEO_WFS}?service=WFS&typeNames=ge:GE.GroundWaterbody`,
      'Mapped groundwater-body polygon containing the selected coordinate',
      { id: p.id_localId || null, title: p.id_namespace || null, mineralization: p.mineralization_label || null },
      'Groundwater-body mapping is regional context, not a parcel-specific groundwater measurement.'
    ));
  }

  const karstFeature = selectedFeature(karst, point);
  if (karstFeature) {
    evidence.push(makeEvidence(
      'lv-lvgmc-karst', 'Geohazard context',
      'The LVĢMC geology service maps a karst-process area at the selected coordinate.',
      `${GEO_WFS}?service=WFS&typeNames=ge:GE.GeologicUnit.KarsticTerrain`,
      'Mapped karst polygon containing the selected coordinate', {},
      'Karst mapping is a screening indicator; local subsurface verification may be needed for foundations and excavation.'
    ));
  }

  const faultFeature = selectedFeature(faults, point);
  if (faultFeature) {
    evidence.push(makeEvidence(
      'lv-lvgmc-fault', 'Geohazard context',
      'The LVĢMC geology service maps a tectonic-fault zone at the selected coordinate.',
      `${GEO_WFS}?service=WFS&typeNames=ge:GE.GeologicFault`,
      'Mapped tectonic-fault polygon containing the selected coordinate', {},
      'Mapped fault zones require local geological interpretation; this does not establish active faulting or a site-specific seismic design parameter.'
    ));
  }

  const floodFeature = selectedFeature(floods, point);
  if (floodFeature) {
    const p = floodFeature.properties || {};
    evidence.push(makeEvidence(
      'lv-geolatvija-flood', 'Flooding / water risk',
      `The Latvian national flood-risk service places the selected coordinate inside the mapped flood-risk management area${p.geographicalName1 ? ` ${p.geographicalName1}` : ''}.`,
      `${FLOOD_WFS}?service=WFS&typeNames=am:AM.FloodUnitOfManagement`,
      'Mapped flood-risk management polygon containing the selected coordinate',
      { geographicalName: p.geographicalName1 || null, zoneType: p.zoneType_label1 || null },
      'This layer identifies flood-risk management areas. It is not a parcel-specific depth or return-period result; detailed flood maps should be checked where inundation matters.'
    ));
  } else {
    evidence.push(makeEvidence(
      'lv-geolatvija-flood-open', 'Flooding / water risk',
      'The Latvian national flood-risk management query returned no mapped management polygon containing the selected coordinate.', PORTAL,
      'Selected site coordinate', { reasonCode: 'NO_DATA' },
      'No returned polygon is not proof of no flood hazard; detailed national flood-risk maps should be reviewed.', 'REQUIRES_VERIFICATION'
    ));
  }

  return evidence;
}

export function applyLatviaNationalEvidenceToReport(report: any, evidence: EvidenceItem[]): void {
  if (!report) return;
  const existing = report.geosurvey_context && typeof report.geosurvey_context === 'object' ? report.geosurvey_context : {};
  const geology = evidence.find(item => item.id === 'lv-lvgmc-quaternary-geology' && item.status === 'VERIFIED');
  const aquifer = evidence.find(item => item.id === 'lv-lvgmc-aquifer' && item.status === 'VERIFIED');
  const geologyValue = (geology?.value && typeof geology.value === 'object') ? geology.value as Record<string, unknown> : {};
  const aquiferValue = (aquifer?.value && typeof aquifer.value === 'object') ? aquifer.value as Record<string, unknown> : {};
  const material = typeof geologyValue.material === 'string' ? geologyValue.material : null;
  const mineralization = typeof aquiferValue.mineralization === 'string' ? aquiferValue.mineralization : null;
  report.geosurvey_context = {
    ...existing,
    survey_authority: 'Latvian Environment, Geology and Meteorology Centre (LVĢMC)',
    source_name: 'LVĢMC — Quaternary geology and hydrogeology',
    source_url: PORTAL,
    geological_unit_name: material || existing.geological_unit_name,
    lithology_type: material || existing.lithology_type,
    groundwater_regime: mineralization ? `${mineralization} groundwater` : existing.groundwater_regime,
    evidence_level: geology || aquifer ? 'VERIFIED' : existing.evidence_level
  };
}

export const LATVIA_GEOLOGY_SOURCES = { geologyWfs: GEO_WFS, aquiferWfs: GEO_WFS, floodWfs: FLOOD_WFS, portal: PORTAL };
