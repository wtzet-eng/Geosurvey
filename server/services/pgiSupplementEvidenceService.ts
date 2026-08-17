import type { PgiSiteEvidence } from './pgiSiteEvidenceService';

const OGC_API = 'https://ogcapi.pgi.gov.pl';
const SOURCE = 'Państwowy Instytut Geologiczny – PIB';

async function json(url: string, timeoutMs = 7000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'GeoSurvey/1.0 evidence extraction' }, signal: controller.signal });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const p1 = aLat * Math.PI / 180, p2 = bLat * Math.PI / 180;
  const dp = (bLat - aLat) * Math.PI / 180, dl = (bLng - aLng) * Math.PI / 180;
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function collections() {
  const d = await json(`${OGC_API}/collections`);
  return d?.collections || [];
}

async function find(pattern: RegExp) {
  return (await collections()).find((c: any) => pattern.test(`${c.id || ''} ${c.title || ''}`));
}

async function queryCollection(collection: any, lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));
  const url = `${OGC_API}/collections/${encodeURIComponent(collection.id)}/items?bbox=${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}&limit=100`;
  const d = await json(url, 10000);
  return { url, features: d?.features || [] };
}

function evidence(category: string, claim: string, status: PgiSiteEvidence['status'], sourceUrl: string, method: string, value: any, limitation: string, confidence: PgiSiteEvidence['confidence'] = 'Medium'): PgiSiteEvidence {
  return { id: `pgi-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, category, claim, status, sourceName: SOURCE, sourceUrl, datasetDate: new Date().toISOString().slice(0, 10), spatialRelationship: 'Site-centred desktop query', calculationMethod: method, confidence, value, limitation };
}

export async function queryPolandHydroAndHazards(lat: number, lng: number, radiusKm = 5): Promise<PgiSiteEvidence[]> {
  const out: PgiSiteEvidence[] = [];

  const hydro = await find(/hydrogeolog|hydro/i);
  if (hydro) {
    const result = await queryCollection(hydro, lat, lng, radiusKm);
    const nearby = result.features.map((f: any) => {
      const c = f?.geometry?.coordinates;
      return { f, d: Array.isArray(c) ? distanceKm(lat, lng, Number(c[1]), Number(c[0])) : null };
    }).filter((x: any) => x.d === null || x.d <= radiusKm).sort((a: any, b: any) => (a.d ?? 999) - (b.d ?? 999)).slice(0, 10);
    out.push(evidence('Hydrogeology', nearby.length ? `PIG-PIB hydrogeological features were identified within the ${radiusKm} km desktop search area.` : `The PIG-PIB hydrogeology collection was queried successfully, but returned no feature within ${radiusKm} km.`, nearby.length ? 'VERIFIED' : 'REQUIRES_VERIFICATION', result.url, 'PIG-PIB OGC API Features spatial query', { collection: hydro.id, features: nearby.map((x: any) => ({ id: x.f.id, distanceKm: x.d, properties: x.f.properties, geometry: x.f.geometry })) }, 'Hydrogeological database coverage and nearby observations do not establish the groundwater level beneath the proposed development. Site-specific groundwater measurements may be required.', nearby.length ? 'Medium' : 'Low'));
  } else {
    out.push(evidence('Hydrogeology', 'PIG-PIB hydrogeological OGC API collection could not be discovered at analysis time.', 'UNAVAILABLE', `${OGC_API}/collections`, 'OGC API collection discovery', null, 'This is a service/coverage limitation, not evidence that hydrogeological information does not exist.', 'Low'));
  }

  const hazards = await find(/zagrożenia geologiczne|geohazard|hazard/i);
  if (hazards) {
    const result = await queryCollection(hazards, lat, lng, radiusKm);
    const relevant = result.features.slice(0, 25);
    out.push(evidence('Geological Hazards', relevant.length ? `PIG-PIB geological-hazard features were returned for the site search area.` : `The PIG-PIB geological-hazard collection was queried successfully, but no feature was returned for the ${radiusKm} km search area.`, relevant.length ? 'VERIFIED' : 'REQUIRES_VERIFICATION', result.url, 'PIG-PIB OGC API Features spatial query', { collection: hazards.id, featureCount: relevant.length, features: relevant.map((f: any) => ({ id: f.id, properties: f.properties, geometry: f.geometry })) }, 'A negative desktop result does not prove that a hazard is absent. Hazard screening must consider map scale, dataset completeness and, where relevant, specialist investigation.', relevant.length ? 'Medium' : 'Low'));
  } else {
    out.push(evidence('Geological Hazards', 'PIG-PIB geological-hazard collection could not be discovered at analysis time.', 'UNAVAILABLE', `${OGC_API}/collections`, 'OGC API collection discovery', null, 'This is a service/coverage limitation, not evidence that geological hazards are absent.', 'Low'));
  }

  return out;
}
