import type { EvidenceItem, VerifiedSiteReport } from '../types';
import { geometryPoints, pointInGeometry, propertyNumber, propertyValue, queryMaltaWfs } from './maltaWfsClient';

type FetchLike = typeof fetch;

const WFS = 'https://haleconnect.com/ows/services/org.1261.9e965259-f5a1-4e3e-8a64-41281f4d7ffe_wfs';
const PORTAL = 'https://portal.data.gov.mt/dataset/parcels-of-registered-land';
const SOURCE = 'Malta Land Registry / Planning Authority — Parcels of Registered Land';
const LIMITATION = 'The open cadastral dataset is screening evidence for registered land. The Malta Data Portal states that portal content should not be treated as an official record unless confirmed. The result does not establish ownership, title rights, easements, encumbrances, boundary conclusiveness or whether every unreturned parcel is unregistered.';
const today = () => new Date().toISOString().slice(0, 10);

export interface MaltaCadastreResult {
  success: boolean;
  reasonCode?: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';
  sourceName: string;
  sourceUrl: string;
  evidence: EvidenceItem[];
  parcel?: {
    parcelId: string;
    label: string | null;
    officialAreaM2: number | null;
    geometryPoints: [number, number][];
  };
}

function unavailable(reasonCode: 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA', claim: string): MaltaCadastreResult {
  return {
    success: false,
    reasonCode,
    sourceName: SOURCE,
    sourceUrl: PORTAL,
    evidence: [{
      id: 'mt-registered-parcel-unavailable',
      category: 'Cadastre & identification',
      claim,
      status: 'REQUIRES_VERIFICATION',
      sourceName: SOURCE,
      sourceUrl: PORTAL,
      datasetDate: today(),
      spatialRelationship: 'Selected site coordinate',
      calculationMethod: 'Malta registered-land WFS query with dynamic feature-type discovery and point-in-polygon validation',
      confidence: 'Low',
      limitation: LIMITATION,
      value: { reasonCode }
    }]
  };
}

export async function queryMaltaCadastre(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<MaltaCadastreResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 35.78 || lat > 36.10 || lng < 14.15 || lng > 14.60) {
    return unavailable('NO_DATA', 'The coordinate is outside expected Maltese registered-parcel coverage.');
  }

  const result = await queryMaltaWfs(WFS, lat, lng, 15, fetcher);
  if (result.status === 'SOURCE_UNAVAILABLE') return unavailable('SOURCE_UNAVAILABLE', 'The Malta registered-land WFS could not be queried reliably.');
  if (result.status === 'MALFORMED_DATA') return unavailable('MALFORMED_DATA', 'The Malta registered-land service did not expose a usable WFS feature type.');

  const feature = result.features.find(feature => pointInGeometry(feature?.geometry, lng, lat));
  if (!feature) {
    return unavailable('NO_DATA', 'The registered-land service responded but returned no parcel polygon containing the selected coordinate. This is not evidence that the land has no legal parcel or title record.');
  }

  const p = feature.properties || {};
  const parcelId =
    propertyValue(p, [/national.*cadastral/i, /cadastral.*reference/i, /inspire.*local/i, /local.*id/i, /parcel.*id/i, /^id$/i, /reference/i, /label/i])
    || (feature.id ? String(feature.id) : null);
  if (!parcelId) return unavailable('MALFORMED_DATA', 'The Malta registered-land service returned a parcel polygon without a usable parcel reference.');

  const points = geometryPoints(feature.geometry);
  const parcel = {
    parcelId,
    label: propertyValue(p, [/label/i, /parcel.*number/i, /number/i, /name/i]),
    officialAreaM2: propertyNumber(p, [/area.*m2/i, /area/i, /shape.*area/i]),
    geometryPoints: points
  };

  return {
    success: true,
    sourceName: SOURCE,
    sourceUrl: PORTAL,
    parcel,
    evidence: [{
      id: 'mt-registered-parcel',
      category: 'Cadastre & identification',
      claim: `The Malta registered-land dataset returns parcel ${parcel.label || parcel.parcelId}${parcel.officialAreaM2 ? ` with mapped area approximately ${Math.round(parcel.officialAreaM2).toLocaleString('en')} m²` : ''} at the selected coordinate.`,
      status: 'VERIFIED',
      sourceName: SOURCE,
      sourceUrl: PORTAL,
      datasetDate: today(),
      spatialRelationship: 'Registered-land polygon containing the selected coordinate',
      calculationMethod: 'Hale Connect WFS GetFeature query in EPSG:4326 with point-in-polygon validation',
      confidence: 'High',
      limitation: LIMITATION,
      value: parcel
    }]
  };
}

export function applyMaltaCadastreToReport(report: VerifiedSiteReport & Record<string, any>, result: MaltaCadastreResult, requestedAreaM2: number): void {
  report.evidenceRegistry = Array.isArray(report.evidenceRegistry)
    ? report.evidenceRegistry.filter(item => !/cadastre-spatial-index|cadastre-parcel-id/.test(item.id))
    : [];
  report.evidenceRegistry.push(...result.evidence);
  if (!result.parcel) return;

  report.parcel = {
    ...report.parcel,
    status: 'VERIFIED',
    parcelId: result.parcel.parcelId,
    countryCode: 'MT',
    areaCalculatedM2: requestedAreaM2,
    officialAreaM2: result.parcel.officialAreaM2 ?? undefined,
    isOfficialGeometry: false,
    cadastralSource: SOURCE,
    datasetDate: today(),
    limitation: LIMITATION
  };
  report.malta_cadastre = {
    ...result.parcel,
    geometryScreeningOnly: result.parcel.geometryPoints
  };
}
