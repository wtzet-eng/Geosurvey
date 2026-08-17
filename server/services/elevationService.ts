/**
 * Elevation & Slope Analysis Service
 * Samples a 9-point grid across the parcel area to calculate elevation relief,
 * average slope gradient (degrees and %), and terrain aspect direction.
 */

export interface ElevationGridResult {
  centerElevationM: number;
  minElevationM: number;
  maxElevationM: number;
  elevationDifferenceM: number;
  slopeDegrees: number;
  slopePercent: number;
  slopeCategory: 'Flat (0-2°)' | 'Gentle (2-5°)' | 'Moderate (5-10°)' | 'Steep (10-20°)' | 'Very Steep (>20°)';
  aspectDirection: string;
  sourceName: string;
  datasetDate: string;
  isMeasured: boolean;
}

const unavailable = (): ElevationGridResult => ({
  centerElevationM: NaN,
  minElevationM: NaN,
  maxElevationM: NaN,
  elevationDifferenceM: NaN,
  slopeDegrees: NaN,
  slopePercent: NaN,
  slopeCategory: 'Flat (0-2°)',
  aspectDirection: 'Not established',
  sourceName: 'Official elevation dataset query unavailable',
  datasetDate: new Date().toISOString().slice(0, 10),
  isMeasured: false
});

export async function calculateTerrainFromGrid(lat: number, lng: number, radiusM: number = 40): Promise<ElevationGridResult> {
  const latRad = (lat * Math.PI) / 180;
  const dLat = radiusM / 111139;
  const dLng = radiusM / (111139 * Math.max(0.2, Math.cos(latRad)));
  const lats = [lat + dLat, lat + dLat, lat + dLat, lat, lat, lat, lat - dLat, lat - dLat, lat - dLat];
  const lngs = [lng - dLng, lng, lng + dLng, lng - dLng, lng, lng + dLng, lng - dLng, lng, lng + dLng];
  const latsStr = lats.map(l => l.toFixed(6)).join(',');
  const lngsStr = lngs.map(g => g.toFixed(6)).join(',');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${latsStr}&longitude=${lngsStr}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return unavailable();
    const data: any = await res.json();
    if (!Array.isArray(data.elevation) || data.elevation.length < 9 || data.elevation.some((e: any) => typeof e !== 'number' || !Number.isFinite(e))) return unavailable();

    const elevs: number[] = data.elevation;
    const [zNW, zN, zNE, zW, zC, zE, zSW, zS, zSE] = elevs;
    const minE = Math.min(...elevs);
    const maxE = Math.max(...elevs);
    const diff = Math.round((maxE - minE) * 10) / 10;
    const dx = radiusM;
    const dy = radiusM;
    const dz_dx = ((zNE + 2 * zE + zSE) - (zNW + 2 * zW + zSW)) / (8 * dx);
    const dz_dy = ((zNW + 2 * zN + zNE) - (zSW + 2 * zS + zSE)) / (8 * dy);
    const slopeRad = Math.atan(Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy));
    const slopeDeg = Math.round(slopeRad * (180 / Math.PI) * 10) / 10;
    const slopePct = Math.round(Math.tan(slopeRad) * 100 * 10) / 10;
    let slopeCategory: ElevationGridResult['slopeCategory'] = 'Flat (0-2°)';
    if (slopeDeg >= 2 && slopeDeg < 5) slopeCategory = 'Gentle (2-5°)';
    else if (slopeDeg >= 5 && slopeDeg < 10) slopeCategory = 'Moderate (5-10°)';
    else if (slopeDeg >= 10 && slopeDeg < 20) slopeCategory = 'Steep (10-20°)';
    else if (slopeDeg >= 20) slopeCategory = 'Very Steep (>20°)';
    let aspectDeg = Math.atan2(-dz_dx, dz_dy) * (180 / Math.PI);
    if (aspectDeg < 0) aspectDeg += 360;
    const dirs = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
    const aspect = `${dirs[Math.round(aspectDeg / 45) % 8]} (${Math.round(aspectDeg)}°)`;
    return { centerElevationM: Math.round(zC * 10) / 10, minElevationM: Math.round(minE * 10) / 10, maxElevationM: Math.round(maxE * 10) / 10, elevationDifferenceM: diff, slopeDegrees: slopeDeg, slopePercent: slopePct, slopeCategory, aspectDirection: aspect, sourceName: 'Open-Meteo elevation API / Copernicus DEM-derived elevation', datasetDate: new Date().toISOString().slice(0, 10), isMeasured: false };
  } catch {
    return unavailable();
  }
}
