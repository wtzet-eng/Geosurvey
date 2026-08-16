// Geometric helpers for site selection shapes (lat/lng arrays: [lat, lng])

export function polygonAreaM2(points: [number, number][]): number {
  if (!points || points.length < 3) return 0;
  let total = 0;
  const R = 6378137;
  for (let i = 0; i < points.length; i++) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[(i + 1) % points.length];
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    total += dLng * (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
  }
  return Math.abs((total * R * R) / 2.0);
}

export function centroid(points: [number, number][]): [number, number] {
  if (!points || points.length === 0) return [0, 0];
  const lat = points.reduce((s, p) => s + p[0], 0) / points.length;
  const lng = points.reduce((s, p) => s + p[1], 0) / points.length;
  return [lat, lng];
}

export function rectVertices(corners: [number, number][]): [number, number][] {
  if (!corners || corners.length < 2) return corners || [];
  const [[lat1, lng1], [lat2, lng2]] = corners;
  return [
    [lat1, lng1],
    [lat1, lng2],
    [lat2, lng2],
    [lat2, lng1],
  ];
}

export interface ShapeObj {
  type: 'circle' | 'rectangle' | 'polygon';
  center?: [number, number];
  corners?: [number, number][];
  points?: [number, number][];
  radius?: number;
}

export function shapeCenter(shape: ShapeObj | null): [number, number] | null {
  if (!shape) return null;
  if (shape.type === "circle" && shape.center) return shape.center;
  if (shape.type === "rectangle" && shape.corners) return centroid(rectVertices(shape.corners));
  if (shape.type === "polygon" && shape.points) return centroid(shape.points || []);
  return null;
}

export function shapeAreaM2(shape: ShapeObj | null, areaSize?: number): number {
  if (!shape) return areaSize || 0;
  if (shape.type === "circle") return areaSize || 0;
  if (shape.type === "rectangle" && shape.corners) return polygonAreaM2(rectVertices(shape.corners));
  if (shape.type === "polygon" && shape.points) return polygonAreaM2(shape.points || []);
  return areaSize || 0;
}

export function boundaryText(shape: ShapeObj | null, areaM2?: number): string {
  if (!shape) return "";
  const a = Math.round(areaM2 || 0);
  if (shape.type === "circle" && shape.center) {
    const r = Math.round(Math.sqrt((areaM2 || 1) / Math.PI));
    return `a circular area of approximately ${a} m² (radius ${r} m) centred at (${shape.center[0].toFixed(5)}, ${shape.center[1].toFixed(5)})`;
  }
  if (shape.type === "rectangle" && shape.corners) {
    const v = rectVertices(shape.corners);
    return `a rectangular site of approximately ${a} m² with corners ${v.map((p) => `(${p[0].toFixed(5)}, ${p[1].toFixed(5)})`).join(", ")}`;
  }
  if (shape.type === "polygon" && shape.points) {
    return `an irregular polygon site of approximately ${a} m² with vertices ${shape.points.map((p) => `(${p[0].toFixed(5)}, ${p[1].toFixed(5)})`).join(", ")}`;
  }
  return "";
}
