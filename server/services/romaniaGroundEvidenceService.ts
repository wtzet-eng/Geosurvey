import type { EvidenceItem } from '../types';

const INSPIRE_PARCEL_URL = 'https://geoportal.ancpi.ro/inspireview/rest/services/CP/CP_View/MapServer/1';
const LEGACY_PARCEL_URL = 'https://geoportal.ancpi.ro/arcgis/rest/services/ImobileStereoPublic/MapServer/0';
const CADASTRE_PORTAL_URL = 'https://geoportal.ancpi.ro/imobile.html';
const GEOLOGY_URL = 'https://geoportal.igr.ro/';
const GEOLOGY_200K_URL = 'https://geoportal.igr.ro/viewgeol200k';
const FLOOD_URL = 'https://inundatii.ro/';

export interface RomaniaCadastreResult {
  success: boolean;
  sourceName: string;
  sourceUrl: string;
  parcel?: { parcelId: string; officialAreaM2?: number; geometryPoints?: [number, number][]; landRegistryNumber?: string };
  evidence: EvidenceItem[];
  limitation: string;
}

function pointInRing(point: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  const [px, py] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const intersects = ((yi > py) !== (yj > py)) && px < (xj - xi) * (py - yi) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function ringForPoint(feature: any, lng: number, lat: number): [number, number][] | undefined {
  const g = feature?.geometry;
  const rings = g?.rings ?? (g?.type === 'Polygon' ? g.coordinates : undefined);
  const polygons = Array.isArray(rings) && Array.isArray(rings[0]?.[0]) && Array.isArray(rings[0]?.[0]?.[0]) ? rings : [rings];
  for (const polygon of polygons) {
    const outer = polygon?.[0];
    if (!Array.isArray(outer) || outer.length < 3) continue;
    const ring = outer.map((p: any) => [Number(p?.[0]), Number(p?.[1])] as [number, number]);
    if (ring.every(([x,y]) => Number.isFinite(x) && Number.isFinite(y)) && pointInRing([lng,lat], ring)) return ring;
  }
  return undefined;
}

async function queryLayer(url: string, lat: number, lng: number, fetcher: typeof fetch): Promise<any | null> {
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    geometry: JSON.stringify({ x: lng, y: lat }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326'
  });
  try {
    const response = await fetcher(url + '/query?' + params.toString(), { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

function parseParcel(data: any, lat: number, lng: number, legacy = false) {
  const feature = Array.isArray(data?.features) ? data.features.find((f: any) => ringForPoint(f, lng, lat)) : undefined;
  if (!feature) return null;
  const p = feature.attributes ?? feature.properties ?? {};
  const parcelId = String(
    p.nationalCadastralRef ?? p.IDENTIFIER ?? p.label ?? p.id_localId ?? p.INSPIRE_ID ?? ''
  ).trim();
  if (!parcelId) return null;
  const area = Number(p.areaValue ?? p.area ?? p.SHAPE_Area);
  const geometryPoints = ringForPoint(feature, lng, lat);
  return {
    parcelId,
    officialAreaM2: Number.isFinite(area) ? area : undefined,
    geometryPoints,
    landRegistryNumber: String(p.NR_CARTE_FUNCIARA ?? '').trim() || undefined
  };
}

export async function queryRomaniaCadastre(lat: number, lng: number, fetcher: typeof fetch = fetch): Promise<RomaniaCadastreResult> {
  const today = new Date().toISOString().slice(0,10);
  const limitation = 'Official cadastral screening evidence only. ANCPI states that its public viewer is for locating registered immovables; ownership, title, easements and legally conclusive boundaries require the appropriate official cadastral/land-register verification.';
  let parcel = await queryLayer(INSPIRE_PARCEL_URL, lat, lng, fetcher);
  let parsed = parcel ? parseParcel(parcel, lat, lng) : null;
  let sourceUrl = INSPIRE_PARCEL_URL;
  let sourceName = 'ANCPI — INSPIRE cadastral parcel service';
  if (!parsed) {
    parcel = await queryLayer(LEGACY_PARCEL_URL, lat, lng, fetcher);
    parsed = parcel ? parseParcel(parcel, lat, lng, fetcher === fetch) : null;
    if (parsed) { sourceUrl = LEGACY_PARCEL_URL; sourceName = 'ANCPI — public Imobile cadastral service'; }
  }
  if (parsed) {
    return {
      success: true, sourceName, sourceUrl, parcel: parsed,
      evidence: [{
        id: 'ro-ancpi-cadastre-parcel', category: 'Cadastre & Identification',
        claim: `ANCPI cadastral data identifies parcel ${parsed.parcelId} at the selected coordinate${parsed.officialAreaM2 ? ` with a mapped area of ${Math.round(parsed.officialAreaM2)} m²` : ''}.`,
        status: 'VERIFIED', sourceName, sourceUrl, datasetDate: today,
        spatialRelationship: 'Official cadastral parcel polygon contains the selected coordinate',
        calculationMethod: 'ANCPI ArcGIS parcel-layer point intersection in EPSG:4326',
        confidence: 'High', limitation, value: parsed
      }]
    };
  }
  return {
    success: false, sourceName, sourceUrl,
    evidence: [{
      id: 'ro-ancpi-cadastre-no-parcel', category: 'Cadastre & Identification',
      claim: 'The official ANCPI cadastral services were queried at the selected coordinate but no identifiable parcel polygon was returned.',
      status: 'REQUIRES_VERIFICATION', sourceName, sourceUrl, datasetDate: today,
      spatialRelationship: 'Selected site coordinate', calculationMethod: 'ANCPI ArcGIS cadastral point query',
      confidence: 'Medium', limitation, value: { portalUrl: CADASTRE_PORTAL_URL }
    }],
    limitation
  };
}

export function romaniaGroundEvidence(): EvidenceItem[] {
  const today = new Date().toISOString().slice(0,10);
  return [
    {
      id: 'ro-igr-geology', category: 'Mapped geology',
      claim: 'The Geological Institute of Romania provides official geological mapping at 1:50,000, 1:100,000 and 1:200,000 scales, plus hydrogeological mapping. Coverage is extensive but the 1:50,000 series is not complete nationwide.',
      status: 'REQUIRES_VERIFICATION', sourceName: 'Geological Institute of Romania (IGR)', sourceUrl: GEOLOGY_URL,
      datasetDate: today, spatialRelationship: 'National geological source available', calculationMethod: 'Official IGR spatial-data catalogue review',
      confidence: 'High', limitation: 'A mapped regional geological unit is not a parcel-scale engineering investigation; local boreholes and site investigation remain necessary.'
    },
    {
      id: 'ro-igr-hydrogeology', category: 'Groundwater / hydrogeology',
      claim: 'IGR provides official hydrogeological mapping at 1:100,000 scale and spatial geological services that can support groundwater screening.',
      status: 'REQUIRES_VERIFICATION', sourceName: 'Geological Institute of Romania (IGR)', sourceUrl: GEOLOGY_URL,
      datasetDate: today, spatialRelationship: 'National hydrogeological source available', calculationMethod: 'Official IGR map catalogue review',
      confidence: 'High', limitation: 'This integration does not infer a parcel-specific groundwater level or yield from regional mapping.'
    },
    {
      id: 'ro-igr-200k-map', category: 'Mapped geology',
      claim: 'IGR exposes a searchable 1:200,000 geological map with geological units and boundaries, providing a national regional-geology screening layer.',
      status: 'REQUIRES_VERIFICATION', sourceName: 'Geological Institute of Romania', sourceUrl: GEOLOGY_200K_URL,
      datasetDate: today, spatialRelationship: 'Regional map source available for the selected location', calculationMethod: 'Official IGR web map availability check',
      confidence: 'High', limitation: 'The current GroundSurf integration records the authoritative map but does not yet intersect its lithology polygons automatically.'
    },
    {
      id: 'ro-flood-risk', category: 'Flood & water hazard',
      claim: 'Romania publishes official updated flood-hazard and flood-risk maps through the RO-FLOODS programme and the national water administration.',
      status: 'REQUIRES_VERIFICATION', sourceName: 'Administrația Națională Apele Române — RO-FLOODS', sourceUrl: FLOOD_URL,
      datasetDate: today, spatialRelationship: 'National flood-risk source available for the selected location', calculationMethod: 'Official RO-FLOODS source review',
      confidence: 'High', limitation: 'GroundSurf does not treat the absence of an automated flood-polygon match as evidence of no flood risk.'
    },
    {
      id: 'ro-urban-geology', category: 'Urban / engineering geology',
      claim: 'Romania has local engineering-geological and geotechnical information, but GroundSurf does not assume a single nationwide parcel-scale urban-geology layer. Urban geology will be added city by city where an authoritative spatial dataset can be matched to the selected site.',
      status: 'REQUIRES_VERIFICATION', sourceName: 'Geological Institute of Romania / local planning authorities', sourceUrl: GEOLOGY_URL,
      datasetDate: today, spatialRelationship: 'Urban-geology framework; city-specific spatial matching pending',
      calculationMethod: 'Review of official Romanian geological spatial-data catalogue',
      confidence: 'Medium', limitation: 'Local studies, boreholes and municipal planning/geotechnical datasets may be needed for city-specific conclusions.'
    }
  ];
}
