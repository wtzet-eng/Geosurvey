import type { EvidenceItem } from '../types';

const WMS_URL = 'https://ros-inspire.themapcloud.com/maps/wms';
const SOURCE_NAME = 'Registers of Scotland INSPIRE Cadastral Parcels';
const SOURCE_URL = 'https://www.ros.gov.uk/open-data';
const WMS_LAYER = 'CP.CadastralParcel';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function hasFeatureInfo(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || /ServiceException/i.test(trimmed)) return false;
  try {
    const json = JSON.parse(trimmed);
    if (Array.isArray(json.features)) return json.features.length > 0;
    if (json.features && typeof json.features === 'object') return true;
    return Object.keys(json).length > 0;
  } catch {
    return /inspireid|cadastral|parcel|title/i.test(trimmed);
  }
}

export interface ScotlandCadastreResult {
  success: boolean;
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
  evidence: EvidenceItem[];
  reasonCode?: string;
}

export async function queryScotlandCadastre(lat: number, lng: number): Promise<ScotlandCadastreResult> {
  const delta = 0.001;
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    SRS: 'EPSG:4326',
    BBOX: `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`,
    WIDTH: '101',
    HEIGHT: '101',
    X: '50',
    Y: '50',
    LAYERS: WMS_LAYER,
    QUERY_LAYERS: WMS_LAYER,
    STYLES: '',
    FORMAT: 'image/png',
    INFO_FORMAT: 'application/json',
    FEATURE_COUNT: '5'
  });

  try {
    const response = await fetch(`${WMS_URL}?${params.toString()}`, {
      headers: { 'User-Agent': 'GroundSurf/1.0 Scotland cadastral evidence' }
    });
    if (!response.ok) throw new Error('RoS WMS HTTP ' + response.status);
    const text = await response.text();

    if (!hasFeatureInfo(text)) {
      return {
        success: false,
        sourceName: SOURCE_NAME,
        sourceUrl: SOURCE_URL,
        datasetDate: today(),
        reasonCode: 'NO_DATA',
        evidence: [{
          id: 'scotland-ros-cadastral-site',
          category: 'Cadastre & identification',
          claim: 'Registers of Scotland returned no cadastral parcel feature at the selected coordinate.',
          status: 'REQUIRES_VERIFICATION',
          sourceName: SOURCE_NAME,
          sourceUrl: SOURCE_URL,
          datasetDate: today(),
          spatialRelationship: 'Selected coordinate queried against the RoS INSPIRE cadastral layer',
          calculationMethod: 'Registers of Scotland WMS GetFeatureInfo point query',
          confidence: 'Medium',
          value: { reasonCode: 'NO_DATA' },
          limitation: 'A missing WMS feature does not by itself establish that the land is unregistered. The Land Register / ScotLIS record should be checked where parcel identity matters.'
        }]
      };
    }

    return {
      success: true,
      sourceName: SOURCE_NAME,
      sourceUrl: SOURCE_URL,
      datasetDate: today(),
      evidence: [{
        id: 'scotland-ros-cadastral-site',
        category: 'Cadastre & identification',
        claim: 'Registers of Scotland INSPIRE returned a cadastral parcel feature at the selected coordinate.',
        status: 'VERIFIED',
        sourceName: SOURCE_NAME,
        sourceUrl: SOURCE_URL,
        datasetDate: today(),
        spatialRelationship: 'Selected coordinate intersects a RoS INSPIRE cadastral parcel',
        calculationMethod: 'Registers of Scotland WMS GetFeatureInfo point query',
        confidence: 'High',
        value: { layer: WMS_LAYER },
        limitation: 'The INSPIRE cadastral parcel is a subset of the Scottish Cadastral Map and shows the indicative position and extent of ownership polygons. It does not by itself establish the full extent of rights in the registered title; ScotLIS/title documents remain the reference for detailed legal interpretation.'
      }]
    };
  } catch (error) {
    return {
      success: false,
      sourceName: SOURCE_NAME,
      sourceUrl: SOURCE_URL,
      datasetDate: today(),
      reasonCode: 'SOURCE_UNAVAILABLE',
      evidence: [{
        id: 'scotland-ros-cadastral-unavailable',
        category: 'Cadastre & identification',
        claim: 'The Registers of Scotland INSPIRE cadastral service could not be queried for the selected site.',
        status: 'REQUIRES_VERIFICATION',
        sourceName: SOURCE_NAME,
        sourceUrl: SOURCE_URL,
        datasetDate: today(),
        spatialRelationship: 'Selected coordinate',
        calculationMethod: 'Registers of Scotland WMS GetFeatureInfo',
        confidence: 'Low',
        value: { reasonCode: 'SOURCE_UNAVAILABLE', error: error instanceof Error ? error.message : String(error) },
        limitation: 'A service failure is not evidence that the property is unregistered. Check ScotLIS or the relevant title documents.'
      }]
    };
  }
}
