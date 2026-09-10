import { CanonicalReport, ReportLanguage } from './canonicalReport';

export interface CzechiaCadastrePresentation {
  narrative: string;
  sourceNames: string[];
  parcel?: { parcelNumber: string | null; areaM2: number | null; landType: string | null; landUse: string | null; cadastralAreaName: string | null };
  buildings?: { count: number; examples: Array<{ id: string | null; use: string | null; floorCount: number | null; floorAreaM2: number | null; builtUpAreaM2: number | null }> };
}

const copy = {
  en: {
    parcel: (number: string | null, area: number | null, landType: string | null, landUse: string | null, cadastralArea: string | null) => `ČÚZK RÚIAN cadastral context: parcel ${number || 'identified parcel'}${area !== null ? `; registered area ${area.toLocaleString('en-GB')} m²` : ''}${landType ? `; land type ${landType}` : ''}${landUse ? `; recorded use ${landUse}` : ''}${cadastralArea ? `; cadastral area ${cadastralArea}` : ''}.`,
    buildings: (count: number, example: string | null) => `ČÚZK RÚIAN returned ${count} registered building object${count === 1 ? '' : 's'} intersecting the parcel${example ? `; ${example}` : ''}.`,
    example: (use: string | null, floors: number | null, floorArea: number | null, builtUp: number | null) => [use ? `recorded use ${use}` : null, floors !== null ? `${floors} floor${floors === 1 ? '' : 's'}` : null, floorArea !== null ? `floor area ${floorArea} m²` : null, builtUp !== null ? `built-up area ${builtUp} m²` : null].filter(Boolean).join(', '),
    boundary: 'RÚIAN is authoritative territorial registry context, but it does not establish ownership, title, easements or encumbrances. Building attributes are registry data, not a structural survey, condition assessment, planning permission or valuation; buildings remain excluded from the land-value estimate.'
  },
  de: {
    parcel: (number: string | null, area: number | null, landType: string | null, landUse: string | null, cadastralArea: string | null) => `ČÚZK-RÚIAN-Katasterkontext: Flurstück ${number || 'identifiziertes Flurstück'}${area !== null ? `; registrierte Fläche ${area.toLocaleString('de-DE')} m²` : ''}${landType ? `; Grundstücksart ${landType}` : ''}${landUse ? `; registrierte Nutzung ${landUse}` : ''}${cadastralArea ? `; Katastralgebiet ${cadastralArea}` : ''}.`,
    buildings: (count: number, example: string | null) => `ČÚZK RÚIAN lieferte ${count} registrierte${count === 1 ? 's' : ''} Gebäudeobjekt${count === 1 ? '' : 'e'}, das/die das Flurstück schneidet/schneiden${example ? `; ${example}` : ''}.`,
    example: (use: string | null, floors: number | null, floorArea: number | null, builtUp: number | null) => [use ? `registrierte Nutzung ${use}` : null, floors !== null ? `${floors} Geschoss${floors === 1 ? '' : 'e'}` : null, floorArea !== null ? `Geschossfläche ${floorArea} m²` : null, builtUp !== null ? `bebaute Fläche ${builtUp} m²` : null].filter(Boolean).join(', '),
    boundary: 'RÚIAN ist amtlicher territorialer Registerkontext, belegt jedoch weder Eigentum noch Rechtsinhaber, Dienstbarkeiten oder Belastungen. Gebäudeattribute sind Registerdaten und keine Tragwerksprüfung, Zustandsbewertung, Baugenehmigung oder Bewertung; Gebäude bleiben vom Bodenwert ausgeschlossen.'
  },
  pl: {
    parcel: (number: string | null, area: number | null, landType: string | null, landUse: string | null, cadastralArea: string | null) => `Kontekst katastralny ČÚZK RÚIAN: działka ${number || 'zidentyfikowana działka'}${area !== null ? `; powierzchnia rejestrowa ${area.toLocaleString('pl-PL')} m²` : ''}${landType ? `; rodzaj gruntu ${landType}` : ''}${landUse ? `; zarejestrowany sposób użytkowania ${landUse}` : ''}${cadastralArea ? `; obręb katastralny ${cadastralArea}` : ''}.`,
    buildings: (count: number, example: string | null) => `ČÚZK RÚIAN zwrócił ${count} zarejestrowan${count === 1 ? 'y obiekt budowlany' : 'ych obiektów budowlanych'} przecinających działkę${example ? `; ${example}` : ''}.`,
    example: (use: string | null, floors: number | null, floorArea: number | null, builtUp: number | null) => [use ? `zarejestrowane użytkowanie ${use}` : null, floors !== null ? `liczba kondygnacji ${floors}` : null, floorArea !== null ? `powierzchnia podłóg ${floorArea} m²` : null, builtUp !== null ? `powierzchnia zabudowy ${builtUp} m²` : null].filter(Boolean).join(', '),
    boundary: 'RÚIAN jest urzędowym rejestrem terytorialnym, ale nie potwierdza własności, tytułu prawnego, służebności ani obciążeń. Atrybuty budynków są danymi rejestrowymi, a nie oceną konstrukcji, stanu technicznego, pozwoleniem na budowę ani wyceną; budynki pozostają wyłączone z wartości gruntu.'
  }
} satisfies Record<ReportLanguage, {
  parcel: (number: string | null, area: number | null, landType: string | null, landUse: string | null, cadastralArea: string | null) => string;
  buildings: (count: number, example: string | null) => string;
  example: (use: string | null, floors: number | null, floorArea: number | null, builtUp: number | null) => string;
  boundary: string;
}>;

const stringOrNull = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

export function renderCzechiaCadastrePresentation(canonical: CanonicalReport, language: ReportLanguage): CzechiaCadastrePresentation | null {
  if (canonical.countryCode !== 'CZ') return null;
  const parcelRecord = canonical.evidenceRecords.find(record => record.id === 'cz-cuzk-ruian-parcel' && record.status === 'VERIFIED');
  const buildingRecord = canonical.evidenceRecords.find(record => record.id === 'cz-cuzk-ruian-buildings' && record.status === 'VERIFIED');
  if (!parcelRecord && !buildingRecord) return null;

  const c = copy[language];
  const parts: string[] = [];
  const sources = new Set<string>();
  let parcel: CzechiaCadastrePresentation['parcel'];
  let buildings: CzechiaCadastrePresentation['buildings'];

  if (parcelRecord) {
    const raw = (parcelRecord.value || {}) as Record<string, unknown>;
    parcel = {
      parcelNumber: stringOrNull(raw.parcelNumber),
      areaM2: numberOrNull(raw.areaM2),
      landType: stringOrNull(raw.landType),
      landUse: stringOrNull(raw.landUse),
      cadastralAreaName: stringOrNull(raw.cadastralAreaName)
    };
    parts.push(c.parcel(parcel.parcelNumber, parcel.areaM2, parcel.landType, parcel.landUse, parcel.cadastralAreaName));
    sources.add(parcelRecord.sourceName);
  }

  if (buildingRecord) {
    const raw = (buildingRecord.value || {}) as Record<string, unknown>;
    const rows = Array.isArray(raw.buildings) ? raw.buildings as Array<Record<string, unknown>> : [];
    const examples = rows.slice(0, 3).map(row => ({
      id: stringOrNull(row.id),
      use: stringOrNull(row.use),
      floorCount: numberOrNull(row.floorCount),
      floorAreaM2: numberOrNull(row.floorAreaM2),
      builtUpAreaM2: numberOrNull(row.builtUpAreaM2)
    }));
    buildings = { count: numberOrNull(raw.buildingCount) ?? rows.length, examples };
    const first = examples[0];
    const example = first ? c.example(first.use, first.floorCount, first.floorAreaM2, first.builtUpAreaM2) || null : null;
    parts.push(c.buildings(buildings.count, example));
    sources.add(buildingRecord.sourceName);
  }

  parts.push(c.boundary);
  return { narrative: parts.join(' '), sourceNames: [...sources], parcel, buildings };
}
