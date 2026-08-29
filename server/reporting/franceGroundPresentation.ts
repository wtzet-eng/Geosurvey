import { CanonicalReport, ReportLanguage } from './canonicalReport';

export interface FranceGroundPresentation {
  narrative: string;
  sourceNames: string[];
  bss?: { observationCount: number; nearestDistanceKm: number | null; nearestRecordId: string | null };
  shrinkSwell?: { descriptor: string };
}

const copy = {
  en: {
    bss: (count: number, distance: number | null, id: string | null) => `BRGM Banque du Sous-Sol: ${count} nearby contextual record${count === 1 ? '' : 's'} returned${distance === null ? '' : `; nearest approximately ${distance.toFixed(2)} km away`}${id ? ` (record ${id})` : ''}.`,
    clay: (descriptor: string) => `BRGM/Géorisques shrink–swell clay screening at the site: ${descriptor}.`,
    boundary: 'Nearby BSS records and mapped shrink–swell exposure are preliminary screening context only; they do not establish the parcel soil profile, groundwater conditions or engineering design parameters.'
  },
  de: {
    bss: (count: number, distance: number | null, id: string | null) => `BRGM Banque du Sous-Sol: ${count} kontextuelle Datensätze in der Umgebung${distance === null ? '' : `; nächster Datensatz etwa ${distance.toFixed(2)} km entfernt`}${id ? ` (Datensatz ${id})` : ''}.`,
    clay: (descriptor: string) => `BRGM/Géorisques-Vorprüfung zum Quellen und Schwinden toniger Böden am Standort: ${descriptor}.`,
    boundary: 'Nahe BSS-Datensätze und die kartierte Tonboden-Exposition dienen nur der Vorprüfung; daraus werden weder das Bodenprofil des Grundstücks noch Grundwasserverhältnisse oder technische Bemessungswerte abgeleitet.'
  },
  pl: {
    bss: (count: number, distance: number | null, id: string | null) => `BRGM Banque du Sous-Sol: zwrócono ${count} kontekstowe rekord${count === 1 ? '' : 'y'} w otoczeniu${distance === null ? '' : `; najbliższy około ${distance.toFixed(2)} km od lokalizacji`}${id ? ` (rekord ${id})` : ''}.`,
    clay: (descriptor: string) => `BRGM/Géorisques — kartowana podatność gruntów ilastych na skurcz i pęcznienie: ${descriptor}.`,
    boundary: 'Pobliskie rekordy BSS i kartowana ekspozycja na skurcz–pęcznienie są wyłącznie kontekstem analizy wstępnej; nie potwierdzają profilu gruntu pod działką, warunków wodnych ani parametrów projektowych.'
  }
} satisfies Record<ReportLanguage, {
  bss: (count: number, distance: number | null, id: string | null) => string;
  clay: (descriptor: string) => string;
  boundary: string;
}>;

const finiteOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const stringOrNull = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;

export function renderFranceGroundPresentation(canonical: CanonicalReport, language: ReportLanguage): FranceGroundPresentation | null {
  if (canonical.countryCode !== 'FR') return null;
  const bssRecord = canonical.evidenceRecords.find(record => record.id === 'fr-brgm-bss-context' && record.status === 'VERIFIED');
  const clayRecord = canonical.evidenceRecords.find(record => record.id === 'fr-brgm-shrink-swell-site' && record.status === 'VERIFIED');
  if (!bssRecord && !clayRecord) return null;

  const c = copy[language];
  const parts: string[] = [];
  const sources = new Set<string>();
  let bss: FranceGroundPresentation['bss'];
  let shrinkSwell: FranceGroundPresentation['shrinkSwell'];

  if (bssRecord) {
    const raw = (bssRecord.value || {}) as Record<string, unknown>;
    const observationCount = Number.isFinite(Number(raw.observationCount)) ? Number(raw.observationCount) : 0;
    const nearestDistanceKm = finiteOrNull(raw.nearestDistanceKm);
    const nearestRecordId = stringOrNull(raw.nearestRecordId);
    parts.push(c.bss(observationCount, nearestDistanceKm, nearestRecordId));
    sources.add(bssRecord.sourceName);
    bss = { observationCount, nearestDistanceKm, nearestRecordId };
  }

  if (clayRecord) {
    const raw = (clayRecord.value || {}) as Record<string, unknown>;
    const descriptor = stringOrNull(raw.descriptor);
    if (descriptor) {
      parts.push(c.clay(descriptor));
      sources.add(clayRecord.sourceName);
      shrinkSwell = { descriptor };
    }
  }

  if (!parts.length) return null;
  parts.push(c.boundary);
  return { narrative: parts.join(' '), sourceNames: [...sources], bss, shrinkSwell };
}
