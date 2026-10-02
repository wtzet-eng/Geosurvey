import type { EvidenceItem } from '../types';

const CADASTRE_INSPIRE_URL = 'https://inspire.cadastre.bg:6080/arcgis/rest/services/inspire/iServices/MapServer';
const CADASTRE_PORTAL_URL = 'https://kais.cadastre.bg/bg/Map';
const GEOLOGY_PORTAL_URL = 'https://www.geology.bas.bg/en';
const FLOOD_PORTAL_URL = 'https://www.moew.government.bg/bg/vodi/planove-za-upravlenie/planove-za-upravlenie-na-riska-ot-navodneniya-purn/';
const SOFIA_GEOLOGY_URL = 'https://www.sofia.bg/en/oup-geology-mineral-water';

export interface BulgariaGroundEvidenceResult {
  evidence: EvidenceItem[];
  context: {
    cadastralServiceAvailable: boolean;
    sofiaUrbanGeologyAvailable: boolean;
  };
}

async function checkJson(fetcher: typeof fetch, url: string): Promise<any | null> {
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function isSofia(lat: number, lng: number): boolean {
  return lat >= 42.40 && lat <= 42.86 && lng >= 23.05 && lng <= 23.65;
}

export async function queryBulgariaGroundEvidence(
  lat: number,
  lng: number,
  fetcher: typeof fetch = fetch
): Promise<BulgariaGroundEvidenceResult> {
  const today = new Date().toISOString().slice(0, 10);
  const evidence: EvidenceItem[] = [];
  const cadastreService = await checkJson(fetcher, CADASTRE_INSPIRE_URL);
  const cadastreAvailable = Boolean(cadastreService && Array.isArray(cadastreService.layers));

  evidence.push({
    id: 'bg-agkk-cadastre-service',
    category: 'Cadastre & Identification',
    claim: cadastreAvailable
      ? 'The official Bulgarian cadastral INSPIRE service is reachable and exposes the national cadastral information service.'
      : 'Bulgaria has an official cadastral INSPIRE service and KAIS portal, but the live service could not be queried reliably during this screening request.',
    status: cadastreAvailable ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
    sourceName: 'Geodesy, Cartography and Cadastre Agency (AGCC / AGKK) — KAIS / INSPIRE',
    sourceUrl: cadastreAvailable ? CADASTRE_INSPIRE_URL : CADASTRE_PORTAL_URL,
    datasetDate: today,
    spatialRelationship: 'National cadastral source for the selected Bulgarian location',
    calculationMethod: 'AGCC INSPIRE ArcGIS service availability check',
    confidence: cadastreAvailable ? 'High' : 'Medium',
    limitation: 'This first Bulgaria integration confirms the official cadastral service and coverage model. Parcel geometry and the legal cadastral record still require a successful parcel-level query from the current KAIS/INSPIRE service.',
    value: { coordinate: { lat, lng }, serviceUrl: CADASTRE_INSPIRE_URL, portalUrl: CADASTRE_PORTAL_URL }
  });

  evidence.push({
    id: 'bg-bas-geology',
    category: 'Mapped geology',
    claim: 'The Bulgarian Academy of Sciences Geological Institute provides national geological, tectonic, hydrogeological and engineering-geological mapping, including a 1:100,000 geological map and a national geological-hazard map.',
    status: 'REQUIRES_VERIFICATION',
    sourceName: 'Geological Institute, Bulgarian Academy of Sciences',
    sourceUrl: GEOLOGY_PORTAL_URL,
    datasetDate: today,
    spatialRelationship: 'National geological source available for the selected location; point-level map matching is not yet automated here',
    calculationMethod: 'Official Geological Institute source catalogue review',
    confidence: 'High',
    limitation: 'The existence of an official mapped unit does not by itself establish parcel-scale engineering properties. Site-specific ground conditions require appropriate investigation.'
  });

  evidence.push({
    id: 'bg-engineering-geology',
    category: 'Urban / engineering geology',
    claim: 'Bulgaria has official engineering-geological information at national scale, including engineering-geological and geological-danger mapping. GroundSurf will treat this as engineering-geology context rather than inventing parcel-scale conclusions.',
    status: 'REQUIRES_VERIFICATION',
    sourceName: 'Geological Institute, Bulgarian Academy of Sciences',
    sourceUrl: GEOLOGY_PORTAL_URL,
    datasetDate: today,
    spatialRelationship: 'National engineering-geology source available',
    calculationMethod: 'Official Geological Institute catalogue review',
    confidence: 'High',
    limitation: 'A dedicated national parcel-scale urban-geology layer has not been assumed. Local engineering studies remain necessary.'
  });

  const sofia = isSofia(lat, lng);
  if (sofia) {
    evidence.push({
      id: 'bg-sofia-urban-geology',
      category: 'Urban / engineering geology',
      claim: 'For Sofia, the official municipal planning material explicitly includes engineering-geological and hydrogeological zoning, microseismic zoning, and thermomineral-water mapping.',
      status: 'REQUIRES_VERIFICATION',
      sourceName: 'Sofia Municipality — General Spatial Development Plan, Geology and Mineral Waters',
      sourceUrl: SOFIA_GEOLOGY_URL,
      datasetDate: today,
      spatialRelationship: 'Selected coordinate falls within the Sofia screening area',
      calculationMethod: 'Official Sofia Municipality geology/mineral-water planning source matched to the selected coordinate',
      confidence: 'High',
      limitation: 'This confirms the existence of city-scale geological/hydrogeological zoning, but the current GroundSurf implementation does not yet spatially intersect the municipal zoning polygons.'
    });
  }

  evidence.push({
    id: 'bg-flood-risk',
    category: 'Flood & water hazard',
    claim: 'Bulgaria maintains official flood-hazard and flood-risk mapping under the Floods Directive for the four river-basin management regions; updated 2022–2027 plans are adopted, while newer combined cadastral/flood maps have also been prepared.',
    status: 'REQUIRES_VERIFICATION',
    sourceName: 'Ministry of Environment and Water — Flood Risk Management',
    sourceUrl: FLOOD_PORTAL_URL,
    datasetDate: today,
    spatialRelationship: 'National flood-risk source available for the selected location',
    calculationMethod: 'Official MOEW flood-risk mapping and planning source review',
    confidence: 'High',
    limitation: 'The current version records the official source but does not yet perform a parcel-level flood-polygon intersection. No flood absence is inferred from missing automated results.'
  });

  return {
    evidence,
    context: {
      cadastralServiceAvailable: cadastreAvailable,
      sofiaUrbanGeologyAvailable: sofia
    }
  };
}
