import { EvidenceItem } from '../types';

export interface FinlandNationalEvidenceResult {
  evidence: EvidenceItem[];
  sourceCount: number;
}

type FetchLike = typeof fetch;

const GTK_BEDROCK = 'https://gtkdata.gtk.fi/arcgis/rest/services/Rajapinnat/GTK_Kalliopera_WMS/MapServer';
const GTK_SOIL = 'https://gtkdata.gtk.fi/arcgis/rest/services/Rajapinnat/GTK_Maapera_WMS/MapServer';
const GTK_GROUND = 'https://gtkdata.gtk.fi/arcgis/rest/services/Rajapinnat/GTK_Pohjatutkimukset_WMS/MapServer';
const GTK_PORTAL = 'https://www.gtk.fi/en/services/data-sets-and-online-services-geo-fi/interface-services/';
const today = () => new Date().toISOString().slice(0, 10);

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs = 9000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'GroundSurf/1.0 Finland geological evidence' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json && typeof json === 'object' && !json.error ? json : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim().replace(/\s+/g, ' ');
  return cleaned || null;
}

function queryUrl(service: string, layerId: number, lat: number, lng: number, distanceM?: number): string {
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
    resultRecordCount: distanceM ? '25' : '5'
  });
  if (distanceM) {
    params.set('distance', String(distanceM));
    params.set('units', 'esriSRUnit_Meter');
  }
  return `${service}/${layerId}/query?${params.toString()}`;
}

async function pointQuery(service: string, layerId: number, lat: number, lng: number, distanceM?: number, fetcher: FetchLike = fetch): Promise<any[]> {
  const json = await fetchJson(fetcher, queryUrl(service, layerId, lat, lng, distanceM));
  return Array.isArray(json?.features) ? json.features : [];
}

function sourceEvidence(id: string, category: string, claim: string, sourceUrl: string, relationship: string, method: string, confidence: 'High' | 'Medium' | 'Low', value: any, limitation: string, status: 'VERIFIED' | 'REQUIRES_VERIFICATION' = 'VERIFIED'): EvidenceItem {
  return {
    id, category, claim, status, sourceName: 'Geological Survey of Finland (GTK)', sourceUrl,
    datasetDate: today(), spatialRelationship: relationship, calculationMethod: method,
    confidence, value, limitation
  };
}

export async function queryFinlandNationalEvidence(lat: number, lng: number, municipality: string | null = null, fetcher: FetchLike = fetch): Promise<FinlandNationalEvidenceResult> {
  const evidence: EvidenceItem[] = [];
  const municipalityName = text(municipality);
  if (municipalityName && /^(Helsinki)$/i.test(municipalityName.trim())) {
    evidence.push(sourceEvidence(
      'fi-gtk-helsinki-geochemical-baseline',
      'Environmental / soil chemistry context',
      'GTK and the City of Helsinki have published a dedicated Helsinki soil-geochemical baseline covering natural and urban soil materials; the study is intended as regional background context when soil contamination and remediation needs are assessed.',
      'https://gtkdata.gtk.fi/TapirEN/pages_en/paakaupunkiseutu.html',
      'Helsinki municipal study area',
      'Published GTK Helsinki metropolitan geochemical baseline study; not a parcel-specific concentration measurement',
      'Medium',
      { studyArea: 'Helsinki', samplingYears: '1996–2009', media: ['humus', 'topsoil 0–40 cm'], materials: ['sand', 'till', 'clay', 'silt', 'peat', 'mineral soil rich in organic matter'], analytes: ['metals and metalloids', 'PAH/PCB in part of the study'] },
      'This is regional background information, not a soil sample from the selected parcel. Actual contamination or remediation needs require site-specific sampling and comparison with the applicable Finnish assessment framework.'
    ));
  }

  const [bedrock, soil20k, acidSulphate, pressureSoundings, rockDrillings, groundwaterWells] = await Promise.all([
    pointQuery(GTK_BEDROCK, 51, lat, lng, undefined, fetcher),
    pointQuery(GTK_SOIL, 46, lat, lng, undefined, fetcher),
    pointQuery(GTK_SOIL, 34, lat, lng, undefined, fetcher),
    pointQuery(GTK_GROUND, 1, lat, lng, 5000, fetcher),
    pointQuery(GTK_GROUND, 15, lat, lng, 5000, fetcher),
    pointQuery(GTK_GROUND, 17, lat, lng, 5000, fetcher)
  ]);

  const b = bedrock[0]?.attributes || {};
  const rock = text(b.ROCK_NAME_) || text(b.LITHODEME_) || text(b.ORIGINAL_NAME);
  if (rock) {
    evidence.push(sourceEvidence(
      'fi-gtk-bedrock',
      'Geology',
      `GTK bedrock mapping identifies ${rock}${text(b.ROCK_CLASS_) ? ` (${text(b.ROCK_CLASS_)})` : ''} at the selected coordinate.`,
      `${GTK_BEDROCK}/51/query`,
      'Mapped GTK bedrock unit containing the selected coordinate',
      'ArcGIS point-in-polygon query of GTK bedrock lithological units',
      'High',
      { rockName: rock, rockClass: text(b.ROCK_CLASS_), lithodeme: text(b.LITHODEME_), geologicalEra: text(b.ERA_), geologicalPeriod: text(b.PERIOD_) },
      'GTK regional/detailed mapping is screening evidence. It does not establish rockhead depth, fracture condition, weathering or site-specific foundation parameters.'
    ));
  } else {
    evidence.push(sourceEvidence(
      'fi-gtk-bedrock-unavailable',
      'Geology',
      'GTK bedrock mapping was queried at the selected coordinate, but no usable mapped rock-unit attributes were returned.',
      GTK_PORTAL,
      'Selected site coordinate',
      'ArcGIS point query of GTK bedrock lithological units',
      'Low',
      { reasonCode: 'NO_DATA' },
      'No returned mapped rock unit is not evidence that bedrock is absent. Review the GTK map and local ground investigations.',
      'REQUIRES_VERIFICATION'
    ));
  }

  const s = soil20k[0]?.attributes || {};
  const soilName = text(s.POHJAMAALAJI) || text(s.PINTAMAALAJI);
  if (soilName && !/kartoittamaton/i.test(soilName)) {
    evidence.push(sourceEvidence(
      'fi-gtk-soil',
      'Soil & near-surface geology',
      `GTK 1:20,000 / 1:50,000 soil mapping identifies ${soilName} at the selected coordinate${text(s.PINTAMAALAJI) && text(s.POHJAMAALAJI) && text(s.PINTAMAALAJI) !== text(s.POHJAMAALAJI) ? `; surface layer: ${text(s.PINTAMAALAJI)}` : ''}.`,
      `${GTK_SOIL}/46/query`,
      'Mapped GTK soil polygon containing the selected coordinate',
      'ArcGIS point-in-polygon query of GTK detailed soil / subsoil mapping',
      'High',
      { surfaceSoil: text(s.PINTAMAALAJI), subsoil: text(s.POHJAMAALAJI), formation: text(s.MUODOSTUMA) },
      'Mapped soil information is regional/detailed screening evidence. It does not establish layer thickness, bearing capacity, settlement parameters or the need for piling.'
    ));
  }

  if (acidSulphate.length) {
    const a = acidSulphate[0]?.attributes || {};
    evidence.push(sourceEvidence(
      'fi-gtk-acid-sulphate-soils',
      'Geological / environmental risk',
      'GTK acid sulphate soil mapping intersects the selected coordinate.',
      `${GTK_SOIL}/34/query`,
      'Mapped acid-sulphate-soil screening polygon at the selected coordinate',
      'ArcGIS point-in-polygon query of GTK acid sulphate soil 1:250,000 area mapping',
      'Medium',
      { attributes: a },
      'This is a screening indicator. Actual acid-sulphate conditions and excavation/water-management implications require site-specific investigation.'
    ));
  } else {
    evidence.push(sourceEvidence(
      'fi-gtk-acid-sulphate-open',
      'Geological / environmental risk',
      'GTK acid sulphate soil mapping was checked at the selected coordinate; the public mapped layer did not return an intersecting polygon.',
      `${GTK_SOIL}/34/query`,
      'Selected site coordinate',
      'ArcGIS point-in-polygon query of GTK acid sulphate soil 1:250,000 area mapping',
      'Low',
      { reasonCode: 'NO_DATA' },
      'No intersecting mapped polygon is not proof that acid sulphate soils are absent. Local soil investigation may still be relevant, especially in coastal and low-lying Finnish terrain.',
      'REQUIRES_VERIFICATION'
    ));
  }

  const groundCount = pressureSoundings.length + rockDrillings.length;
  if (groundCount || groundwaterWells.length) {
    evidence.push(sourceEvidence(
      'fi-gtk-ground-investigations',
      'Ground investigations',
      `GTK returned ${groundCount + groundwaterWells.length} nearby ground-investigation or groundwater records within approximately 5 km of the selected coordinate across pressure-sounding, rock-drilling and groundwater-well layers.`,
      GTK_PORTAL,
      'Vicinity screening within approximately 5 km',
      'ArcGIS distance query against selected GTK ground-investigation layers',
      'Medium',
      { pressureSoundings: pressureSoundings.length, rockDrillings: rockDrillings.length, groundwaterWells: groundwaterWells.length, searchRadiusM: 5000 },
      'Nearby investigations are contextual observations and do not establish the conditions beneath the selected parcel. Individual logs should be reviewed where foundation or groundwater questions are material.'
    ));
  } else {
    evidence.push(sourceEvidence(
      'fi-gtk-ground-investigations-open',
      'Ground investigations',
      'Selected GTK nearby ground-investigation and groundwater layers returned no records in the tested 5 km search.',
      GTK_PORTAL,
      'Vicinity screening within approximately 5 km',
      'ArcGIS distance query against selected GTK ground-investigation layers',
      'Low',
      { reasonCode: 'NO_DATA', searchRadiusM: 5000 },
      'No returned record is not proof that no ground investigation exists nearby. GTK ground-investigation records should be searched directly when detailed site data are needed.',
      'REQUIRES_VERIFICATION'
    ));
  }

  return { evidence, sourceCount: evidence.length };
}

export const FINLAND_GEOLOGY_SOURCES = {
  gtkPortal: GTK_PORTAL,
  bedrockService: GTK_BEDROCK,
  soilService: GTK_SOIL,
  groundInvestigationService: GTK_GROUND
};
