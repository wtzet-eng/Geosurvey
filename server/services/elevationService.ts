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

export async function calculateTerrainFromGrid(lat: number, lng: number, radiusM: number = 40): Promise<ElevationGridResult> {
  // Convert radius meters to approximate delta degrees
  // 1 deg lat ≈ 111,139 m
  // 1 deg lng ≈ 111,139 * cos(lat) m
  const latRad = (lat * Math.PI) / 180;
  const dLat = radiusM / 111139;
  const dLng = radiusM / (111139 * Math.max(0.2, Math.cos(latRad)));

  // 9 Grid coordinates:
  // [NW, N, NE]
  // [W,  C,  E]
  // [SW, S, SE]
  const lats = [
    lat + dLat, lat + dLat, lat + dLat,
    lat,        lat,        lat,
    lat - dLat, lat - dLat, lat - dLat
  ];
  const lngs = [
    lng - dLng, lng,        lng + dLng,
    lng - dLng, lng,        lng + dLng,
    lng - dLng, lng,        lng + dLng
  ];

  const latsStr = lats.map(l => l.toFixed(6)).join(',');
  const lngsStr = lngs.map(g => g.toFixed(6)).join(',');

  const fallback: ElevationGridResult = {
    centerElevationM: 120,
    minElevationM: 119,
    maxElevationM: 121,
    elevationDifferenceM: 2,
    slopeDegrees: 1.2,
    slopePercent: 2.1,
    slopeCategory: 'Flat (0-2°)',
    aspectDirection: 'South-East (135°)',
    sourceName: 'Open-Meteo European Copernicus DEM (90m/30m Global)',
    datasetDate: '2025/2026 Release',
    isMeasured: false
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const url = `https://api.open-meteo.com/v1/elevation?latitude=${latsStr}&longitude=${lngsStr}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      return fallback;
    }

    const data: any = await res.json();
    if (!Array.isArray(data.elevation) || data.elevation.length < 9) {
      return fallback;
    }

    const elevs: number[] = data.elevation.map((e: any) => (typeof e === 'number' ? e : 120));
    
    // Grid indices:
    // 0:NW, 1:N, 2:NE
    // 3:W,  4:C, 5:E
    // 6:SW, 7:S, 8:SE
    const zNW = elevs[0], zN = elevs[1], zNE = elevs[2];
    const zW  = elevs[3], zC = elevs[4], zE  = elevs[5];
    const zSW = elevs[6], zS = elevs[7], zSE = elevs[8];

    const minE = Math.min(...elevs);
    const maxE = Math.max(...elevs);
    const diff = Math.round((maxE - minE) * 10) / 10;

    // Finite difference partial derivatives (Sobel / Horn filter)
    // Distance in meters:
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

    // Aspect (downhill compass direction)
    let aspectDeg = Math.atan2(-dz_dx, dz_dy) * (180 / Math.PI);
    if (aspectDeg < 0) aspectDeg += 360;

    let aspectStr = 'South-Facing';
    if (aspectDeg >= 337.5 || aspectDeg < 22.5) aspectStr = `North-Facing (${Math.round(aspectDeg)}°)`;
    else if (aspectDeg >= 22.5 && aspectDeg < 67.5) aspectStr = `North-East-Facing (${Math.round(aspectDeg)}°)`;
    else if (aspectDeg >= 67.5 && aspectDeg < 112.5) aspectStr = `East-Facing (${Math.round(aspectDeg)}°)`;
    else if (aspectDeg >= 112.5 && aspectDeg < 157.5) aspectStr = `South-East-Facing (${Math.round(aspectDeg)}°)`;
    else if (aspectDeg >= 157.5 && aspectDeg < 202.5) aspectStr = `South-Facing (${Math.round(aspectDeg)}°)`;
    else if (aspectDeg >= 202.5 && aspectDeg < 247.5) aspectStr = `South-West-Facing (${Math.round(aspectDeg)}°)`;
    else if (aspectDeg >= 247.5 && aspectDeg < 292.5) aspectStr = `West-Facing (${Math.round(aspectDeg)}°)`;
    else if (aspectDeg >= 292.5 && aspectDeg < 337.5) aspectStr = `North-West-Facing (${Math.round(aspectDeg)}°)`;

    return {
      centerElevationM: Math.round(zC),
      minElevationM: Math.round(minE),
      maxElevationM: Math.round(maxE),
      elevationDifferenceM: diff,
      slopeDegrees: slopeDeg,
      slopePercent: slopePct,
      slopeCategory,
      aspectDirection: aspectStr,
      sourceName: 'Open-Meteo / Copernicus European DEM (EU-DEM v1.1)',
      datasetDate: '2025/2026',
      isMeasured: true
    };
  } catch (err) {
    return fallback;
  }
}
