import { CanonicalReport, ReportLanguage } from './canonicalReport';

export interface SlovakiaGroundPresentation {
  narrative: string;
  sourceNames: string[];
  engineeringGeology?: { zone: string | null; formation: string | null; scale: string | null };
  hydrogeology?: { lithology: string | null; permeability: string | null; hydrogeologicalFunction: string | null };
  boreholes?: { engineeringCount: number; hydrogeologicalCount: number; nearestDistanceM: number | null; searchRadiusM: number | null };
}

const copy = {
  en: {
    engineering: (zone: string | null, formation: string | null) => `ŠGÚDŠ engineering-geological zoning at the site: ${zone || 'mapped zone'}${formation && formation !== zone ? ` (${formation})` : ''}.`,
    hydro: (lithology: string | null, permeability: string | null, fn: string | null) => `ŠGÚDŠ hydrogeological context: ${[lithology, permeability, fn].filter(Boolean).join('; ') || 'mapped collector context returned'}.`,
    boreholes: (engineering: number, hydro: number, nearest: number | null, radius: number | null) => `ŠGÚDŠ borehole registry: ${engineering} engineering/multipurpose and ${hydro} hydrogeological record${engineering + hydro === 1 ? '' : 's'} returned${radius ? ` within ${(radius / 1000).toFixed(0)} km` : ''}${nearest === null ? '' : `; nearest approximately ${nearest} m from the site`}.`,
    boundary: 'These national mapped and nearby-investigation records are screening context only. They do not establish parcel stratigraphy, density/consistency, groundwater level, bearing capacity, strength parameters or foundation design.'
  },
  de: {
    engineering: (zone: string | null, formation: string | null) => `ŠGÚDŠ-Ingenieurgeologische Zonierung am Standort: ${zone || 'kartierte Zone'}${formation && formation !== zone ? ` (${formation})` : ''}.`,
    hydro: (lithology: string | null, permeability: string | null, fn: string | null) => `ŠGÚDŠ-hydrogeologischer Kontext: ${[lithology, permeability, fn].filter(Boolean).join('; ') || 'kartierter Grundwasserleiter-Kontext verfügbar'}.`,
    boreholes: (engineering: number, hydro: number, nearest: number | null, radius: number | null) => `ŠGÚDŠ-Bohrungsregister: ${engineering} ingenieur-/mehrzweckbezogene und ${hydro} hydrogeologische Datensätze${radius ? ` im Umkreis von ${(radius / 1000).toFixed(0)} km` : ''}${nearest === null ? '' : `; nächster Datensatz etwa ${nearest} m vom Standort entfernt`}.`,
    boundary: 'Diese national kartierten Daten und Untersuchungen in der Umgebung dienen nur der Vorprüfung. Sie belegen weder die Schichtenfolge des Grundstücks noch Lagerungszustand/Konsistenz, Grundwasserstand, Tragfähigkeit, Festigkeitsparameter oder Gründungsbemessung.'
  },
  pl: {
    engineering: (zone: string | null, formation: string | null) => `ŠGÚDŠ — strefa inżyniersko-geologiczna w lokalizacji: ${zone || 'strefa kartowana'}${formation && formation !== zone ? ` (${formation})` : ''}.`,
    hydro: (lithology: string | null, permeability: string | null, fn: string | null) => `ŠGÚDŠ — kontekst hydrogeologiczny: ${[lithology, permeability, fn].filter(Boolean).join('; ') || 'zwrócono kartowany kontekst warstwy wodonośnej'}.`,
    boreholes: (engineering: number, hydro: number, nearest: number | null, radius: number | null) => `Rejestr otworów ŠGÚDŠ: ${engineering} otworów inżynierskich/wielozadaniowych i ${hydro} hydrogeologicznych${radius ? ` w promieniu ${(radius / 1000).toFixed(0)} km` : ''}${nearest === null ? '' : `; najbliższy zwrócony rekord około ${nearest} m od lokalizacji`}.`,
    boundary: 'Krajowe dane kartowane i pobliskie otwory są wyłącznie kontekstem analizy wstępnej. Nie potwierdzają profilu pod działką, stanu/stopnia zagęszczenia, poziomu wód gruntowych, nośności, parametrów wytrzymałościowych ani rozwiązania posadowienia.'
  }
} satisfies Record<ReportLanguage, {
  engineering: (zone: string | null, formation: string | null) => string;
  hydro: (lithology: string | null, permeability: string | null, fn: string | null) => string;
  boreholes: (engineering: number, hydro: number, nearest: number | null, radius: number | null) => string;
  boundary: string;
}>;

const stringOrNull = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const finiteOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

export function renderSlovakiaGroundPresentation(canonical: CanonicalReport, language: ReportLanguage): SlovakiaGroundPresentation | null {
  if (canonical.countryCode !== 'SK') return null;
  const engineeringRecord = canonical.evidenceRecords.find(record => record.id === 'sk-sguds-engineering-geology-50k' && record.status === 'VERIFIED');
  const hydroRecord = canonical.evidenceRecords.find(record => record.id === 'sk-sguds-hydrogeology' && record.status === 'VERIFIED');
  const boreholeRecord = canonical.evidenceRecords.find(record => record.id === 'sk-sguds-borehole-context' && record.status === 'VERIFIED');
  if (!engineeringRecord && !hydroRecord && !boreholeRecord) return null;

  const c = copy[language];
  const parts: string[] = [];
  const sources = new Set<string>();
  let engineeringGeology: SlovakiaGroundPresentation['engineeringGeology'];
  let hydrogeology: SlovakiaGroundPresentation['hydrogeology'];
  let boreholes: SlovakiaGroundPresentation['boreholes'];

  if (engineeringRecord) {
    const raw = (engineeringRecord.value || {}) as Record<string, unknown>;
    const zone = stringOrNull(raw.zone);
    const formation = stringOrNull(raw.formation);
    const scale = stringOrNull(raw.scale);
    parts.push(c.engineering(zone, formation));
    sources.add(engineeringRecord.sourceName);
    engineeringGeology = { zone, formation, scale };
  }

  if (hydroRecord) {
    const raw = (hydroRecord.value || {}) as Record<string, unknown>;
    const lithology = stringOrNull(raw.lithology);
    const permeability = stringOrNull(raw.permeability);
    const hydrogeologicalFunction = stringOrNull(raw.hydrogeologicalFunction);
    parts.push(c.hydro(lithology, permeability, hydrogeologicalFunction));
    sources.add(hydroRecord.sourceName);
    hydrogeology = { lithology, permeability, hydrogeologicalFunction };
  }

  if (boreholeRecord) {
    const raw = (boreholeRecord.value || {}) as Record<string, unknown>;
    const engineering = Array.isArray(raw.engineeringBoreholes) ? raw.engineeringBoreholes as Array<Record<string, unknown>> : [];
    const hydro = Array.isArray(raw.hydrogeologicalBoreholes) ? raw.hydrogeologicalBoreholes as Array<Record<string, unknown>> : [];
    const nearestDistanceM = [...engineering, ...hydro].map(row => finiteOrNull(row.distanceM)).filter((distance): distance is number => distance !== null).sort((a, b) => a - b)[0] ?? null;
    const searchRadiusM = finiteOrNull(raw.searchRadiusM);
    parts.push(c.boreholes(engineering.length, hydro.length, nearestDistanceM, searchRadiusM));
    sources.add(boreholeRecord.sourceName);
    boreholes = { engineeringCount: engineering.length, hydrogeologicalCount: hydro.length, nearestDistanceM, searchRadiusM };
  }

  if (!parts.length) return null;
  parts.push(c.boundary);
  return { narrative: parts.join(' '), sourceNames: [...sources], engineeringGeology, hydrogeology, boreholes };
}
