import { BoundaryShape } from '../types';

/**
 * Calculate approximate area in m² for a boundary shape
 */
export function calculateBoundaryArea(shape: BoundaryShape | null, defaultArea = 1000): number {
  if (!shape) return defaultArea;

  if (shape.type === 'circle') {
    const radius = shape.radius || Math.sqrt(defaultArea / Math.PI);
    return Math.round(Math.PI * radius * radius);
  }

  if (shape.type === 'rectangle' && shape.corners && shape.corners.length >= 2) {
    const [p1, p2] = shape.corners;
    const latDistance = haversineDistance(p1, [p2[0], p1[1]]);
    const lngDistance = haversineDistance(p1, [p1[0], p2[1]]);
    return Math.round(latDistance * lngDistance);
  }

  if (shape.type === 'polygon' && shape.points && shape.points.length >= 3) {
    return Math.round(polygonAreaInMeters(shape.points));
  }

  return defaultArea;
}

/**
 * Get the center coordinate [lat, lng] of a boundary shape
 */
export function getBoundaryCenter(shape: BoundaryShape | null): [number, number] | null {
  if (!shape) return null;

  if (shape.type === 'circle' && shape.center) {
    return shape.center;
  }

  if (shape.type === 'rectangle' && shape.corners && shape.corners.length >= 2) {
    const lats = shape.corners.map(c => c[0]);
    const lngs = shape.corners.map(c => c[1]);
    const avgLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const avgLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    return [avgLat, avgLng];
  }

  if (shape.type === 'polygon' && shape.points && shape.points.length > 0) {
    const lats = shape.points.map(p => p[0]);
    const lngs = shape.points.map(p => p[1]);
    const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    return [avgLat, avgLng];
  }

  return null;
}

/**
 * Haversine distance in meters between two lat/lng coordinates
 */
export function haversineDistance(coords1: [number, number], coords2: [number, number]): number {
  const R = 6371000; // Earth radius in meters
  const lat1 = (coords1[0] * Math.PI) / 180;
  const lat2 = (coords2[0] * Math.PI) / 180;
  const deltaLat = ((coords2[0] - coords1[0]) * Math.PI) / 180;
  const deltaLng = ((coords2[1] - coords1[1]) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Planar Shoelace formula converted to approximate square meters
 */
export function polygonAreaInMeters(points: [number, number][]): number {
  if (points.length < 3) return 0;
  const R = 6378137; // radius of Earth in meters
  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const p1 = points[i];
    const p2 = points[j];

    const p1LatRad = (p1[0] * Math.PI) / 180;
    const p2LatRad = (p2[0] * Math.PI) / 180;
    const p1LngRad = (p1[1] * Math.PI) / 180;
    const p2LngRad = (p2[1] * Math.PI) / 180;

    area += (p2LngRad - p1LngRad) * (2 + Math.sin(p1LatRad) + Math.sin(p2LatRad));
  }

  area = (Math.abs(area) * R * R) / 2;
  return area;
}

export function formatCurrency(num: number | string | undefined, currency = 'EUR'): string {
  if (num === undefined || num === null) return '—';
  const val = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(val)) return String(num);

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(val);
  } catch {
    return `${currency} ${val.toLocaleString()}`;
  }
}
