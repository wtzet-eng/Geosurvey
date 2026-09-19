type FetchLike = typeof fetch;

export type MaltaWfsStatus = 'OK' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA';

export interface MaltaWfsResult {
  status: MaltaWfsStatus;
  features: any[];
  typeName?: string;
  error?: string;
}

const decodeXml = (value: string) => value
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .trim();

const featureTypeNames = (xml: string): string[] => {
  const blocks = xml.match(/<(?:\w+:)?FeatureType\b[\s\S]*?<\/(?:\w+:)?FeatureType>/gi) || [];
  const names = blocks.map(block => {
    const match = block.match(/<(?:\w+:)?Name>([\s\S]*?)<\/(?:\w+:)?Name>/i);
    return match ? decodeXml(match[1]) : '';
  }).filter(Boolean);
  return [...new Set(names)];
};

async function request(fetcher: FetchLike, url: string, accept: string, timeoutMs = 10000): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { Accept: accept, 'User-Agent': 'LandSurf/1.0 Malta official evidence' },
      signal: ctrl.signal
    });
    return response.ok ? response : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const serviceUrl = (base: string, params: Record<string, string>): string => {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
};

export async function queryMaltaWfs(
  baseUrl: string,
  lat: number,
  lng: number,
  radiusM: number,
  fetcher: FetchLike = fetch
): Promise<MaltaWfsResult> {
  const capabilitiesUrl = serviceUrl(baseUrl, { SERVICE: 'WFS', REQUEST: 'GetCapabilities', VERSION: '2.0.0' });
  const capabilitiesResponse = await request(fetcher, capabilitiesUrl, 'application/xml,text/xml,*/*');
  if (!capabilitiesResponse) return { status: 'SOURCE_UNAVAILABLE', features: [], error: 'GetCapabilities failed' };

  let capabilities = '';
  try { capabilities = await capabilitiesResponse.text(); } catch {
    return { status: 'MALFORMED_DATA', features: [], error: 'Unreadable GetCapabilities response' };
  }
  const names = featureTypeNames(capabilities);
  const typeName = names[0];
  if (!typeName) return { status: 'MALFORMED_DATA', features: [], error: 'No WFS feature type discovered' };

  const dy = radiusM / 111320;
  const dx = radiusM / (111320 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  const bbox = `${lng - dx},${lat - dy},${lng + dx},${lat + dy},EPSG:4326`;

  const attempts = [
    serviceUrl(baseUrl, {
      SERVICE: 'WFS', REQUEST: 'GetFeature', VERSION: '2.0.0', TYPENAMES: typeName,
      OUTPUTFORMAT: 'application/json', SRSNAME: 'EPSG:4326', BBOX: bbox, COUNT: '100'
    }),
    serviceUrl(baseUrl, {
      SERVICE: 'WFS', REQUEST: 'GetFeature', VERSION: '1.1.0', TYPENAME: typeName,
      OUTPUTFORMAT: 'application/json', SRSNAME: 'EPSG:4326', BBOX: bbox, MAXFEATURES: '100'
    })
  ];

  for (const url of attempts) {
    const response = await request(fetcher, url, 'application/geo+json,application/json,*/*', 12000);
    if (!response) continue;
    try {
      const body: any = JSON.parse(await response.text());
      if (Array.isArray(body?.features)) return { status: 'OK', features: body.features, typeName };
    } catch {
      // Try the alternate WFS version before failing closed.
    }
  }
  return { status: 'SOURCE_UNAVAILABLE', features: [], typeName, error: 'GeoJSON GetFeature query failed' };
}

export function pointInGeometry(geometry: any, lng: number, lat: number): boolean {
  const pointInRing = (ring: any[]): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = Number(ring[i]?.[0]), yi = Number(ring[i]?.[1]);
      const xj = Number(ring[j]?.[0]), yj = Number(ring[j]?.[1]);
      if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
      const intersects = ((yi > lat) !== (yj > lat))
        && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || Number.EPSILON) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  };
  if (geometry?.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    return Boolean(rings[0] && pointInRing(rings[0]) && !rings.slice(1).some((ring: any[]) => pointInRing(ring)));
  }
  if (geometry?.type === 'MultiPolygon') {
    return (geometry.coordinates || []).some((polygon: any[]) =>
      polygon?.[0] && pointInRing(polygon[0]) && !polygon.slice(1).some((ring: any[]) => pointInRing(ring))
    );
  }
  return false;
}

export function geometryPoints(geometry: any): [number, number][] {
  const rings = geometry?.type === 'Polygon'
    ? geometry.coordinates
    : geometry?.type === 'MultiPolygon'
      ? geometry.coordinates?.[0]
      : null;
  const ring = Array.isArray(rings?.[0]) ? rings[0] : [];
  return ring
    .map((point: any) => [Number(point?.[1]), Number(point?.[0])] as [number, number])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

export function propertyValue(properties: Record<string, any>, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const key = Object.keys(properties || {}).find(name => pattern.test(name));
    if (!key) continue;
    const raw = properties[key];
    if (raw === null || raw === undefined) continue;
    const value = String(raw).trim().replace(/\s+/g, ' ');
    if (value && !/^(null|none|unknown|n\/a|-+)$/i.test(value)) return value;
  }
  return null;
}

export function propertyNumber(properties: Record<string, any>, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const key = Object.keys(properties || {}).find(name => pattern.test(name));
    if (!key) continue;
    const raw = properties[key];
    const value = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(value)) return value;
  }
  return null;
}
