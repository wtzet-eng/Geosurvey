type FetchLike = typeof fetch;

export type LocationResolutionLevel = 'DETAILED' | 'LOCAL' | 'REGIONAL' | 'COORDINATES';

export interface ResolvedSiteLocation {
  locationName: string;
  municipality: string;
  county: string;
  state: string;
  road: string;
  countryCode: string;
  regionCode: string;
  resolutionLevel: LocationResolutionLevel;
}

export function getCenterFromShape(shape: any, reqBody?: any): [number, number] | null {
  if (reqBody?.latitude !== undefined && reqBody?.longitude !== undefined) {
    return [Number(reqBody.latitude), Number(reqBody.longitude)];
  }
  if (!shape) return null;
  if (shape.type === 'circle' && Array.isArray(shape.center) && shape.center.length >= 2) {
    return [Number(shape.center[0]), Number(shape.center[1])];
  }
  if (shape.type === 'rectangle' && shape.corners?.length >= 2) {
    const lats = shape.corners.map((c: any) => Number(Array.isArray(c) ? c[0] : c.lat));
    const lngs = shape.corners.map((c: any) => Number(Array.isArray(c) ? c[1] : c.lng));
    return [(lats[0] + lats[1]) / 2, (lngs[0] + lngs[1]) / 2];
  }
  if ((shape.type === 'polygon' || shape.coordinates) && (shape.points?.length > 0 || shape.coordinates?.length > 0)) {
    const pts = shape.points || shape.coordinates;
    const lats = pts.map((p: any) => Number(Array.isArray(p) ? p[0] : p.lat));
    const lngs = pts.map((p: any) => Number(Array.isArray(p) ? p[1] : p.lng));
    if (!lats.length || lats.some((value: number) => !Number.isFinite(value)) || lngs.some((value: number) => !Number.isFinite(value))) return null;
    return [
      lats.reduce((sum: number, value: number) => sum + value, 0) / lats.length,
      lngs.reduce((sum: number, value: number) => sum + value, 0) / lngs.length
    ];
  }
  if (Array.isArray(shape.center) && shape.center.length >= 2) {
    return [Number(shape.center[0]), Number(shape.center[1])];
  }
  return null;
}

function adminFields(data: any) {
  const address = data?.address || {};
  return {
    locationName: typeof data?.display_name === 'string' ? data.display_name.trim() : '',
    municipality: String(address.city || address.town || address.village || address.municipality || address.suburb || '').trim(),
    county: String(address.county || address.state_district || '').trim(),
    state: String(address.state || address.province || address.region || '').trim(),
    road: String(address.road || '').trim(),
    countryCode: String(address.country_code || '').trim().toUpperCase(),
    regionCode: String(address['ISO3166-2-lvl4'] || '').trim().toUpperCase()
  };
}
async function reverseAtZoom(lat: number, lng: number, zoom: number, fetcher: FetchLike, timeoutMs: number): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=${zoom}&addressdetails=1`,
      { headers: { 'User-Agent': 'GeoSurveyEvidenceApp/4.0' }, signal: controller.signal }
    );
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveSiteLocation(
  lat: number,
  lng: number,
  countryName: string,
  options: { fetcher?: FetchLike; timeoutMs?: number } = {}
): Promise<ResolvedSiteLocation> {
  const fetcher = options.fetcher || fetch;
  const timeoutMs = options.timeoutMs ?? 3500;
  const fallbackName = `${lat.toFixed(5)}, ${lng.toFixed(5)} (${countryName})`;
  const levels: Array<{ zoom: number; level: Exclude<LocationResolutionLevel, 'COORDINATES'> }> = [
    { zoom: 18, level: 'DETAILED' },
    { zoom: 10, level: 'LOCAL' },
    { zoom: 5, level: 'REGIONAL' }
  ];
  const resolved: ResolvedSiteLocation = {
    locationName: fallbackName,
    municipality: '',
    county: '',
    state: '',
    road: '',
    countryCode: '',
    regionCode: '',
    resolutionLevel: 'COORDINATES'
  };

  for (const candidate of levels) {
    const data = await reverseAtZoom(lat, lng, candidate.zoom, fetcher, timeoutMs);
    if (!data) continue;
    const fields = adminFields(data);
    if (fields.countryCode || fields.municipality || fields.county || fields.state) resolved.resolutionLevel = candidate.level;
    if (resolved.locationName === fallbackName && fields.locationName) resolved.locationName = fields.locationName;
    if (!resolved.municipality && fields.municipality) resolved.municipality = fields.municipality;
    if (!resolved.county && fields.county) resolved.county = fields.county;
    if (!resolved.state && fields.state) resolved.state = fields.state;
    if (!resolved.road && fields.road) resolved.road = fields.road;
    if (!resolved.countryCode && fields.countryCode) resolved.countryCode = fields.countryCode;
    if (!resolved.regionCode && fields.regionCode) resolved.regionCode = fields.regionCode;

    // A municipality or county is enough to retain local valuation context.
    // Broader lookups are only used when the detailed address cannot provide it.
    if (resolved.countryCode && (resolved.municipality || resolved.county)) break;
  }

  return resolved;
}
