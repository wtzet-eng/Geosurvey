import { EvidenceItem } from "../types";

type FetchLike = typeof fetch;
export type NetherlandsGroundEvidence = EvidenceItem;

const DINOLoketGeoTOP = "https://www.dinodata.nl/opendap/GeoTOP/geotop.nc";
const DINOLoketGeoTOPAscii = "https://www.dinodata.nl/opendap/GeoTOP/geotop.nc.ascii";
const GEO_TOP_METADATA = "https://www.dinodata.nl/opendap/GeoTOP/geotop.nc.html";
const DATASET_DATE = "2025-05-01";
const X_MIN = 13600;
const Y_MIN = 338500;
const X_MAX = 278200;
const Y_MAX = 619600;
const GRID_M = 100;
const Z_STEP_M = 0.5;
const NO_DATA = -127;

const MATERIALS: Record<number, string> = {
  0: "anthropogenic / made ground",
  1: "organic material / peat",
  2: "clay",
  3: "clayey sand / sandy clay / silt",
  5: "fine sand",
  6: "medium sand",
  7: "coarse sand",
  8: "gravel",
  9: "shells"
};

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** WGS84 -> Dutch RD New polynomial, adequate for GeoTOP's 100 m horizontal cells. */
export function wgs84ToRd(lat: number, lng: number): [number, number] {
  const lat0 = 52.1551744;
  const lng0 = 5.38720621;
  const x0 = 155000;
  const y0 = 463000;
  const dLat = 0.36 * (lat - lat0);
  const dLng = 0.36 * (lng - lng0);
  const x = x0
    + 190094.945 * dLng
    - 11832.228 * dLat * dLng
    - 114.221 * dLat ** 2 * dLng
    - 32.391 * dLng ** 3
    - 0.705 * dLat
    - 2.340 * dLat ** 3 * dLng
    - 0.608 * dLat * dLng ** 3
    - 0.008 * dLng ** 2
    + 0.148 * dLat ** 2 * dLng ** 3;
  const y = y0
    + 309056.544 * dLat
    + 3638.893 * dLng ** 2
    + 73.077 * dLat ** 2
    - 157.984 * dLat * dLng ** 2
    + 59.788 * dLat ** 3
    + 0.433 * dLng
    - 6.439 * dLat ** 2 * dLng ** 2
    - 0.032 * dLat * dLng
    + 0.092 * dLng ** 4
    - 0.054 * dLat * dLng ** 4;
  return [x, y];
}

function gridIndex(rd: number, minimum: number, maximum: number): number | null {
  if (rd < minimum - GRID_M / 2 || rd > maximum + GRID_M / 2) return null;
  const index = Math.round((rd - minimum) / GRID_M);
  return index >= 0 ? index : null;
}

function numbersAfterComma(line: string): number[] {
  const comma = line.indexOf(",");
  if (comma < 0) return [];
  return line.slice(comma + 1).split(",").map(value => Number(value.trim())).filter(value => Number.isFinite(value));
}

function parseAsciiArray(body: string, variable: string): number[] {
  const lines = body.split(/\r?\n/);
  const line = lines.find(item => item.trimStart().startsWith(variable));
  return line ? numbersAfterComma(line) : [];
}

function groupedBand(values: number[], zValues: number[], topIndex: number, startDepthM: number, endDepthM: number) {
  const startOffset = Math.max(0, Math.round(startDepthM / Z_STEP_M));
  const endOffset = Math.max(startOffset + 1, Math.round(endDepthM / Z_STEP_M));
  const codes: number[] = [];
  for (let offset = startOffset; offset < endOffset; offset += 1) {
    const index = topIndex - offset;
    if (index < 0 || index >= values.length) continue;
    const code = values[index];
    if (Number.isFinite(code) && code !== NO_DATA && MATERIALS[code]) codes.push(code);
  }
  if (!codes.length) return null;
  const counts = new Map<number, number>();
  for (const code of codes) counts.set(code, (counts.get(code) || 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const dominantCode = ordered[0][0];
  const dominantCount = ordered[0][1];
  const representativeIndex = values.findIndex((code, index) => index <= topIndex && index >= topIndex - endOffset && code === dominantCode);
  const z = representativeIndex >= 0 ? finite(zValues[representativeIndex]) : null;
  return {
    fromDepthM: startDepthM,
    toDepthM: endDepthM,
    materialCode: dominantCode,
    material: MATERIALS[dominantCode],
    dominantFraction: Math.round((dominantCount / codes.length) * 100) / 100,
    observedMaterialCodes: ordered.map(([code]) => code),
    representativeElevationMNAP: z
  };
}

function selectedSamples(values: number[], uncertainty: number[], zValues: number[], topIndex: number) {
  return [0, 0.5, 1, 2, 5, 10, 20, 30].map(depthM => {
    const offset = Math.round(depthM / Z_STEP_M);
    const index = topIndex - offset;
    if (index < 0 || index >= values.length) return null;
    const code = values[index];
    if (!Number.isFinite(code) || code === NO_DATA || !MATERIALS[code]) return null;
    return {
      depthM,
      elevationMNAP: finite(zValues[index]),
      materialCode: code,
      material: MATERIALS[code],
      modelUncertaintyRaw: finite(uncertainty[index])
    };
  }).filter(Boolean);
}

function unavailable(reasonCode: "NO_DATA" | "SOURCE_UNAVAILABLE" | "MALFORMED_DATA", claim: string, sourceUrl = GEO_TOP_METADATA): NetherlandsGroundEvidence {
  return {
    id: "nl-geotop-profile-unavailable",
    category: "3D shallow subsurface model",
    claim,
    status: "REQUIRES_VERIFICATION",
    sourceName: "TNO Geological Survey of the Netherlands — BRO GeoTOP",
    sourceUrl,
    datasetDate: DATASET_DATE,
    spatialRelationship: "Selected site coordinate and nearest GeoTOP model column",
    calculationMethod: "Dutch RD New coordinate conversion and GeoTOP OPeNDAP query",
    confidence: "Low",
    limitation: "An unavailable or empty model query is not evidence that the subsurface condition is absent. Check DINOloket and use location-specific investigation where material.",
    value: { reasonCode }
  };
}

export async function queryNetherlandsGroundEvidence(lat: number, lng: number, fetcher: FetchLike = fetch): Promise<NetherlandsGroundEvidence[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [unavailable("NO_DATA", "The selected coordinate is not valid.")];
  const [rdX, rdY] = wgs84ToRd(lat, lng);
  const xIndex = gridIndex(rdX, X_MIN, X_MAX);
  const yIndex = gridIndex(rdY, Y_MIN, Y_MAX);
  if (xIndex === null || yIndex === null) return [unavailable("NO_DATA", "The selected coordinate falls outside the published GeoTOP model extent.")];

  const zMaxIndex = 312;
  const query = "x[" + xIndex + ":1:" + xIndex + "],y[" + yIndex + ":1:" + yIndex + "],z[0:1:" + zMaxIndex + "],lithok[" + xIndex + ":1:" + xIndex + "][" + yIndex + ":1:" + yIndex + "][0:1:" + zMaxIndex + "],onz_lk[" + xIndex + ":1:" + xIndex + "][" + yIndex + ":1:" + yIndex + "][0:1:" + zMaxIndex + "]";
  const url = DINOLoketGeoTOPAscii + "?" + query;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetcher(url, { headers: { Accept: "text/plain" }, signal: controller.signal });
    if (!response.ok) return [unavailable("SOURCE_UNAVAILABLE", "DINOloket GeoTOP did not return a successful response.", url)];
    const body = await response.text();
    const zValues = parseAsciiArray(body, "z,");
    const lithokValues = parseAsciiArray(body, "lithok.lithok");
    const uncertaintyValues = parseAsciiArray(body, "onz_lk.onz_lk");
    const xValues = parseAsciiArray(body, "x,");
    const yValues = parseAsciiArray(body, "y,");
    if (zValues.length < 300 || lithokValues.length < 300 || uncertaintyValues.length < 300) {
      return [unavailable("MALFORMED_DATA", "DINOloket GeoTOP responded, but the expected voxel profile could not be parsed safely.", url)];
    }

    let topIndex = -1;
    for (let index = Math.min(zValues.length, lithokValues.length) - 1; index >= 0; index -= 1) {
      const code = lithokValues[index];
      if (Number.isFinite(code) && code !== NO_DATA && MATERIALS[code]) {
        topIndex = index;
        break;
      }
    }
    if (topIndex < 0) return [unavailable("NO_DATA", "GeoTOP returned no modelled lithology for the nearest model column.", url)];

    const modelTopElevationMNAP = finite(zValues[topIndex]);
    const x = finite(xValues[0]) || rdX;
    const y = finite(yValues[0]) || rdY;
    const bands = [
      [0, 2],
      [2, 5],
      [5, 10],
      [10, 20],
      [20, 30]
    ].map(([from, to]) => groupedBand(lithokValues, zValues, topIndex, from, to)).filter(Boolean);
    const samples = selectedSamples(lithokValues, uncertaintyValues, zValues, topIndex);
    const first = samples[0] || null;
    const distinct = [...new Set(bands.map((band: any) => band.materialCode))];
    const claim = first
      ? "BRO GeoTOP v1.6.1 provides a modelled shallow-subsurface column at the selected location; the first modelled material below the inferred model top is " + first.material + "." + (distinct.length > 1 ? " The dominant material changes across the reported depth bands." : "")
      : "BRO GeoTOP v1.6.1 provides a modelled shallow-subsurface column at the selected location.";

    return [{
      id: "nl-geotop-profile",
      category: "3D shallow subsurface model",
      claim,
      status: "MODELLED",
      sourceName: "TNO Geological Survey of the Netherlands — BRO GeoTOP v1.6.1",
      sourceUrl: GEO_TOP_METADATA,
      datasetDate: DATASET_DATE,
      spatialRelationship: "Nearest GeoTOP 100 × 100 m horizontal model column to the selected coordinate; vertical levels at 0.5 m spacing",
      calculationMethod: "WGS84 -> Dutch RD New polynomial conversion, nearest 100 m GeoTOP x/y cell, OPeNDAP ASCII extraction of lithology and model-uncertainty profiles; depth bands are relative to the highest valid modelled voxel in that column",
      confidence: "Medium",
      limitation: "GeoTOP is a regional/subregional model and is not, by itself, a site-specific investigation for a street or building. The reported depth bands are modelled context, not measured borehole layers; they do not establish parcel stratigraphy, groundwater level, bearing capacity, settlement behaviour or foundation design. Confirm material and thickness with boreholes/CPTs and appropriate site investigation where needed.",
      value: {
        modelVersion: "GeoTOP v1.6.1",
        datasetUrl: DINOLoketGeoTOP,
        grid: { xM: x, yM: y, horizontalCellM: GRID_M },
        sourceCoordinate: { latitude: lat, longitude: lng },
        rdCoordinate: { xM: rdX, yM: rdY },
        gridIndices: { xIndex, yIndex },
        modelTopElevationMNAP,
        verticalResolutionM: Z_STEP_M,
        depthReference: "Approximate depth below the highest valid modelled voxel in the selected column",
        layers: bands,
        selectedSamples: samples,
        modelUncertaintyAvailable: uncertaintyValues.some(value => Number.isFinite(value) && value !== NO_DATA)
      }
    }];
  } catch {
    return [unavailable("SOURCE_UNAVAILABLE", "DINOloket GeoTOP was unavailable or timed out.", url)];
  } finally {
    clearTimeout(timer);
  }
}

export function enrichNetherlandsGroundEvidence(report: any, items: NetherlandsGroundEvidence[]): void {
  const profile = items.find(item => item.id === "nl-geotop-profile" && item.status === "MODELLED");
  if (!profile) return;
  const value = (profile.value || {}) as Record<string, unknown>;
  report.geosurvey_context = {
    ...(report.geosurvey_context || {}),
    geotop_profile: value,
    geotop_evidence_level: "MODELLED",
    geotop_source_name: profile.sourceName,
    geotop_source_url: profile.sourceUrl,
    geotop_model_version: value.modelVersion || "GeoTOP v1.6.1"
  };
}

export const NETHERLANDS_GEOTOP_SOURCES = {
  model: DINOLoketGeoTOP,
  metadata: GEO_TOP_METADATA,
  ascii: DINOLoketGeoTOPAscii
};
