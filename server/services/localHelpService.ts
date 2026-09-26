export interface LocalHelpBusiness {
  name: string;
  category: 'surveyor' | 'architect' | 'engineering' | 'environment' | 'planning' | 'geotechnical' | 'other';
  distanceM: number;
  website?: string;
  phone?: string;
  address?: string;
  source: string;
}

function classify(tags: Record<string, string>): LocalHelpBusiness['category'] {
  const value = [tags.office, tags.craft, tags.name, tags.description].filter(Boolean).join(' ').toLowerCase();
  if (/surveyor|vermesser|landm[aä]ler|geometer/.test(value)) return 'surveyor';
  if (/architect|architekt|architecte|arquitect/.test(value)) return 'architect';
  if (/geotechn|geotechnik|geotechnique/.test(value)) return 'geotechnical';
  if (/environment|umwelt|environnement|ecolog|hydrogeolog/.test(value)) return 'environment';
  if (/planning|urbanist|stadtplanung|am[eé]nagement|ruimtelijk/.test(value)) return 'planning';
  if (/engineer|ingenieur|ingenieur/.test(value)) return 'engineering';
  return 'other';
}

export async function queryLocalHelp(lat: number, lng: number, query = ''): Promise<LocalHelpBusiness[]> {
  const radius = 3500;
  const overpass = '[out:json][timeout:12];(' +
    'nwr["office"~"architect|engineer|consulting|environmental_consultant|planning"](around:' + radius + ',' + lat + ',' + lng + ');' +
    'nwr["craft"~"surveyor|land_surveyor"](around:' + radius + ',' + lat + ',' + lng + ');' +
    'nwr["office"="geotechnical_engineer"](around:' + radius + ',' + lat + ',' + lng + ');' +
    ');out center 40;';

  let response: Response | null = null;
  for (const endpoint of [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ]) {
    try {
      const candidate = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'GroundSurf/1.0 local help lookup' },
        body: 'data=' + encodeURIComponent(overpass),
        signal: AbortSignal.timeout(7000)
      });
      if (candidate.ok) { response = candidate; break; }
    } catch {}
  }
  if (!response) return [];

  try {
    const data: any = await response.json();
    if (!Array.isArray(data?.elements)) return [];
    const wanted = String(query || '').toLowerCase();
    const results: LocalHelpBusiness[] = [];

    for (const element of data.elements) {
      const tags = element.tags || {};
      const elLat = element.lat ?? element.center?.lat;
      const elLng = element.lon ?? element.center?.lon;
      if (!Number.isFinite(elLat) || !Number.isFinite(elLng)) continue;

      const lat1 = lat * Math.PI / 180;
      const lat2 = Number(elLat) * Math.PI / 180;
      const dLat = lat2 - lat1;
      const dLng = (Number(elLng) - lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      const distanceM = Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
      const category = classify(tags);
      const text = [tags.name, tags.office, tags.craft, tags.description].filter(Boolean).join(' ').toLowerCase();

      const matches = !wanted
        || text.includes(wanted)
        || (wanted.includes('survey') && category === 'surveyor')
        || (wanted.includes('build') && ['architect', 'engineering', 'geotechnical', 'surveyor'].includes(category))
        || (wanted.includes('ground') && ['geotechnical', 'engineering', 'surveyor'].includes(category))
        || (wanted.includes('contamin') && category === 'environment')
        || (wanted.includes('environment') && category === 'environment')
        || (wanted.includes('planning') && category === 'planning');
      if (!matches) continue;

      results.push({
        name: tags.name || tags.operator || tags.brand || 'Unnamed local service',
        category,
        distanceM,
        website: tags.website || tags['contact:website'],
        phone: tags.phone || tags['contact:phone'],
        address: [tags['addr:street'], tags['addr:housenumber'], tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ') || undefined,
        source: 'OpenStreetMap'
      });
    }

    const seen = new Set<string>();
    return results
      .sort((a, b) => a.distanceM - b.distanceM)
      .filter((item) => {
        const key = item.name.toLowerCase() + '|' + item.category;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
  } catch {
    return [];
  }
}
