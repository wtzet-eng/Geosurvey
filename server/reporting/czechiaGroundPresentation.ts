import { CanonicalReport, ReportLanguage } from './canonicalReport';

export interface CzechiaGroundPresentation {
  narrative: string;
  sourceNames: string[];
  engineeringGeology?: { code: string | null; name: string | null; characterization: string | null; typicalRocks: string | null; scale: string | null };
  hydrogeology?: { unit: string | null; rock: string | null; transmissivity: string | null; description: string | null; scale: string | null };
  boreholes?: { count: number; hydrogeologicalCount: number; nearestDistanceM: number | null; searchRadiusM: number | null };
  slopeDeformation?: { count: number };
}

const copy = {
  en: {
    engineering: (name: string | null, code: string | null, characterization: string | null, rocks: string | null, scale: string | null) =>
      `ČGS engineering-geological zoning${scale ? ` (${scale})` : ''}: ${name || code || 'mapped zone'}${code && code !== name ? ` (${code})` : ''}${characterization ? `; ${characterization}` : ''}${rocks ? `; typical mapped rocks: ${rocks}` : ''}.`,
    hydro: (unit: string | null, rock: string | null, transmissivity: string | null, description: string | null, scale: string | null) =>
      `ČGS hydrogeological context${scale ? ` (${scale})` : ''}: ${[unit, rock, transmissivity ? `transmissivity ${transmissivity}` : null, description].filter(Boolean).join('; ') || 'mapped hydrogeological context returned'}.`,
    boreholes: (count: number, hydro: number, nearest: number | null, radius: number | null) =>
      `ČGS borehole registry: ${count} nearby record${count === 1 ? '' : 's'} returned${radius ? ` within ${(radius / 1000).toFixed(0)} km` : ''}, including ${hydro} with hydrogeological data${nearest === null ? '' : `; nearest approximately ${nearest} m from the site`}.`,
    deformation: (count: number) => `ČGS field-verified slope-deformation register: ${count} mapped deformation polygon${count === 1 ? '' : 's'} intersects the selected coordinate.`,
    boundary: 'These mapped and nearby-investigation records are screening context only. They do not establish parcel stratigraphy, groundwater level, density/consistency, bearing capacity, cohesion, friction angle, settlement or foundation design.'
  },
  de: {
    engineering: (name: string | null, code: string | null, characterization: string | null, rocks: string | null, scale: string | null) =>
      `ČGS-Ingenieurgeologische Zonierung${scale ? ` (${scale})` : ''}: ${name || code || 'kartierte Zone'}${code && code !== name ? ` (${code})` : ''}${characterization ? `; ${characterization}` : ''}${rocks ? `; typische kartierte Gesteine: ${rocks}` : ''}.`,
    hydro: (unit: string | null, rock: string | null, transmissivity: string | null, description: string | null, scale: string | null) =>
      `ČGS-hydrogeologischer Kontext${scale ? ` (${scale})` : ''}: ${[unit, rock, transmissivity ? `Transmissivität ${transmissivity}` : null, description].filter(Boolean).join('; ') || 'kartierter hydrogeologischer Kontext verfügbar'}.`,
    boreholes: (count: number, hydro: number, nearest: number | null, radius: number | null) =>
      `ČGS-Bohrungsregister: ${count} Datensatz${count === 1 ? '' : 'sätze'}${radius ? ` im Umkreis von ${(radius / 1000).toFixed(0)} km` : ''}, davon ${hydro} mit hydrogeologischen Daten${nearest === null ? '' : `; nächster Datensatz etwa ${nearest} m vom Standort entfernt`}.`,
    deformation: (count: number) => `ČGS-Register feldverifizierter Hangdeformationen: ${count} kartierte Deformationsfläche${count === 1 ? '' : 'n'} schneidet den ausgewählten Standortpunkt.`,
    boundary: 'Diese kartierten Daten und Untersuchungen in der Umgebung dienen nur der Vorprüfung. Sie belegen weder die Schichtenfolge des Grundstücks noch Grundwasserstand, Lagerungszustand/Konsistenz, Tragfähigkeit, Kohäsion, Reibungswinkel, Setzung oder Gründungsbemessung.'
  },
  pl: {
    engineering: (name: string | null, code: string | null, characterization: string | null, rocks: string | null, scale: string | null) =>
      `ČGS — strefa inżyniersko-geologiczna${scale ? ` (${scale})` : ''}: ${name || code || 'strefa kartowana'}${code && code !== name ? ` (${code})` : ''}${characterization ? `; ${characterization}` : ''}${rocks ? `; typowe kartowane skały/grunty: ${rocks}` : ''}.`,
    hydro: (unit: string | null, rock: string | null, transmissivity: string | null, description: string | null, scale: string | null) =>
      `ČGS — kontekst hydrogeologiczny${scale ? ` (${scale})` : ''}: ${[unit, rock, transmissivity ? `transmisywność ${transmissivity}` : null, description].filter(Boolean).join('; ') || 'zwrócono kartowany kontekst hydrogeologiczny'}.`,
    boreholes: (count: number, hydro: number, nearest: number | null, radius: number | null) =>
      `Rejestr otworów ČGS: ${count} pobliskich rekordów${radius ? ` w promieniu ${(radius / 1000).toFixed(0)} km` : ''}, w tym ${hydro} z danymi hydrogeologicznymi${nearest === null ? '' : `; najbliższy rekord około ${nearest} m od lokalizacji`}.`,
    deformation: (count: number) => `Rejestr terenowo zweryfikowanych deformacji stokowych ČGS: ${count} kartowanych obszarów deformacji przecina wybraną lokalizację.`,
    boundary: 'Dane kartowane i pobliskie otwory są wyłącznie kontekstem analizy wstępnej. Nie potwierdzają profilu pod działką, poziomu wód gruntowych, stanu/zagęszczenia, nośności, kohezji, kąta tarcia, osiadań ani rozwiązania posadowienia.'
  }
} satisfies Record<ReportLanguage, {
  engineering: (name: string | null, code: string | null, characterization: string | null, rocks: string | null, scale: string | null) => string;
  hydro: (unit: string | null, rock: string | null, transmissivity: string | null, description: string | null, scale: string | null) => string;
  boreholes: (count: number, hydro: number, nearest: number | null, radius: number | null) => string;
  deformation: (count: number) => string;
  boundary: string;
}>;

const stringOrNull = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
const finiteOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

export function renderCzechiaGroundPresentation(canonical: CanonicalReport, language: ReportLanguage): CzechiaGroundPresentation | null {
  if (canonical.countryCode !== 'CZ') return null;
  const engineeringRecord = canonical.evidenceRecords.find(record => record.id === 'cz-cgs-engineering-geology' && record.status === 'VERIFIED');
  const hydroRecord = canonical.evidenceRecords.find(record => record.id === 'cz-cgs-hydrogeology' && record.status === 'VERIFIED');
  const boreholeRecord = canonical.evidenceRecords.find(record => record.id === 'cz-cgs-borehole-context' && record.status === 'VERIFIED');
  const deformationRecord = canonical.evidenceRecords.find(record => record.id === 'cz-cgs-slope-deformation-site' && record.status === 'VERIFIED');
  if (!engineeringRecord && !hydroRecord && !boreholeRecord && !deformationRecord) return null;

  const c = copy[language];
  const parts: string[] = [];
  const sources = new Set<string>();
  let engineeringGeology: CzechiaGroundPresentation['engineeringGeology'];
  let hydrogeology: CzechiaGroundPresentation['hydrogeology'];
  let boreholes: CzechiaGroundPresentation['boreholes'];
  let slopeDeformation: CzechiaGroundPresentation['slopeDeformation'];

  if (engineeringRecord) {
    const raw = (engineeringRecord.value || {}) as Record<string, unknown>;
    const code = stringOrNull(raw.code); const name = stringOrNull(raw.name); const characterization = stringOrNull(raw.characterization);
    const typicalRocks = stringOrNull(raw.typicalRocks); const scale = stringOrNull(raw.scale);
    parts.push(c.engineering(name, code, characterization, typicalRocks, scale));
    sources.add(engineeringRecord.sourceName);
    engineeringGeology = { code, name, characterization, typicalRocks, scale };
  }

  if (hydroRecord) {
    const raw = (hydroRecord.value || {}) as Record<string, unknown>;
    const unit = stringOrNull(raw.unit) || stringOrNull(raw.name); const rock = stringOrNull(raw.rock);
    const transmissivity = stringOrNull(raw.transmissivity); const description = stringOrNull(raw.description); const scale = stringOrNull(raw.scale);
    parts.push(c.hydro(unit, rock, transmissivity, description, scale));
    sources.add(hydroRecord.sourceName);
    hydrogeology = { unit, rock, transmissivity, description, scale };
  }

  if (boreholeRecord) {
    const raw = (boreholeRecord.value || {}) as Record<string, unknown>;
    const rows = Array.isArray(raw.boreholes) ? raw.boreholes : [];
    const hydroRows = Array.isArray(raw.hydrogeologicalBoreholes) ? raw.hydrogeologicalBoreholes : [];
    const nearestDistanceM = finiteOrNull(raw.nearestDistanceM);
    const searchRadiusM = finiteOrNull(raw.searchRadiusM);
    parts.push(c.boreholes(rows.length, hydroRows.length, nearestDistanceM, searchRadiusM));
    sources.add(boreholeRecord.sourceName);
    boreholes = { count: rows.length, hydrogeologicalCount: hydroRows.length, nearestDistanceM, searchRadiusM };
  }

  if (deformationRecord) {
    const raw = (deformationRecord.value || {}) as Record<string, unknown>;
    const count = finiteOrNull(raw.count) ?? 0;
    parts.push(c.deformation(count));
    sources.add(deformationRecord.sourceName);
    slopeDeformation = { count };
  }

  if (!parts.length) return null;
  parts.push(c.boundary);
  return { narrative: parts.join(' '), sourceNames: [...sources], engineeringGeology, hydrogeology, boreholes, slopeDeformation };
}
