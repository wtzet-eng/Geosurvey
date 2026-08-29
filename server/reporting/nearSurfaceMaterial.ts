import { CanonicalReport, ReportLanguage } from './canonicalReport';

const textureLabels: Record<ReportLanguage, Record<string, string>> = {
  en: {
    sand: 'sand',
    'loamy sand': 'loamy sand',
    'sandy loam': 'sandy loam',
    loam: 'loam',
    'silt loam': 'silt loam',
    silt: 'silt',
    'sandy clay loam': 'sandy clay loam',
    'clay loam': 'clay loam',
    'silty clay loam': 'silty clay loam',
    'sandy clay': 'sandy clay',
    'silty clay': 'silty clay',
    clay: 'clay'
  },
  de: {
    sand: 'Sand',
    'loamy sand': 'lehmiger Sand',
    'sandy loam': 'sandiger Lehm',
    loam: 'Lehm',
    'silt loam': 'schluffiger Lehm',
    silt: 'Schluff',
    'sandy clay loam': 'sandiger Tonlehm',
    'clay loam': 'Tonlehm',
    'silty clay loam': 'schluffiger Tonlehm',
    'sandy clay': 'sandiger Ton',
    'silty clay': 'schluffiger Ton',
    clay: 'Ton'
  },
  pl: {
    sand: 'piasek',
    'loamy sand': 'piasek gliniasty',
    'sandy loam': 'glina piaszczysta',
    loam: 'glina',
    'silt loam': 'glina pylasta',
    silt: 'pył',
    'sandy clay loam': 'glina ilasta piaszczysta',
    'clay loam': 'glina ilasta',
    'silty clay loam': 'glina ilasta pylasta',
    'sandy clay': 'ił piaszczysty',
    'silty clay': 'ił pylasty',
    clay: 'ił'
  }
};

const copy = {
  en: {
    heading: 'Near-surface material — soil model',
    source: 'Source',
    sandy: 'The model indicates a predominance of the sand fraction in the near-surface soil.',
    silty: 'The model indicates a predominance of the silt fraction in the near-surface soil.',
    clayey: 'The model indicates a predominance of the clay fraction in the near-surface soil.',
    fractions: (sand: number | null, silt: number | null, clay: number | null) => `Modelled fractions: sand ${sand ?? 'n/a'}%, silt ${silt ?? 'n/a'}%, clay ${clay ?? 'n/a'}%.`,
    limitation: 'This is modelled soil / near-surface context. It does not establish geological lithology, layer thickness, density/state or engineering parameters beneath the parcel.'
  },
  de: {
    heading: 'Oberflächennahes Material — Bodenmodell',
    source: 'Quelle',
    sandy: 'Das Modell weist auf einen überwiegenden Sandanteil im oberflächennahen Boden hin.',
    silty: 'Das Modell weist auf einen überwiegenden Schluffanteil im oberflächennahen Boden hin.',
    clayey: 'Das Modell weist auf einen überwiegenden Tonanteil im oberflächennahen Boden hin.',
    fractions: (sand: number | null, silt: number | null, clay: number | null) => `Modellierte Anteile: Sand ${sand ?? 'k. A.'}%, Schluff ${silt ?? 'k. A.'}%, Ton ${clay ?? 'k. A.'}%.`,
    limitation: 'Dies ist modellierter Boden- bzw. oberflächennaher Kontext. Daraus werden keine geologische Lithologie, Schichtmächtigkeit, Lagerungszustände oder technischen Kennwerte unter dem Flurstück abgeleitet.'
  },
  pl: {
    heading: 'Materiał przypowierzchniowy — model glebowy',
    source: 'Źródło',
    sandy: 'Model wskazuje przewagę frakcji piaszczystej w warstwie przypowierzchniowej.',
    silty: 'Model wskazuje przewagę frakcji pyłowej w warstwie przypowierzchniowej.',
    clayey: 'Model wskazuje przewagę frakcji ilastej w warstwie przypowierzchniowej.',
    fractions: (sand: number | null, silt: number | null, clay: number | null) => `Modelowane udziały frakcji: piasek ${sand ?? 'brak danych'}%, pył ${silt ?? 'brak danych'}%, ił ${clay ?? 'brak danych'}%.`,
    limitation: 'Jest to modelowany kontekst glebowy / przypowierzchniowy. Nie potwierdza litologii geologicznej, miąższości warstw, stanu gruntu ani parametrów inżynierskich pod działką.'
  }
} as const;

export function localizeSoilTexture(texture: string | null, language: ReportLanguage): string | null {
  if (!texture) return null;
  return textureLabels[language][texture.trim().toLowerCase()] || texture;
}

export function renderNearSurfaceMaterialFallback(canonical: CanonicalReport, language: ReportLanguage): string | null {
  // Validated only for country packs that actively query national mapped geology
  // and explicitly keep SoilGrids as separate pedological/near-surface evidence.
  if (!['PL', 'FR'].includes(canonical.countryCode) || !canonical.support.capabilities.nationalGeology || canonical.geology.unitName) return null;
  const localizedTexture = localizeSoilTexture(canonical.soil.texture, language);
  const sand = canonical.soil.sandPct;
  const silt = canonical.soil.siltPct;
  const clay = canonical.soil.clayPct;
  if (!localizedTexture && sand === null && silt === null && clay === null) return null;

  const c = copy[language];
  const measured = [
    { key: 'sand', value: sand },
    { key: 'silt', value: silt },
    { key: 'clay', value: clay }
  ].filter((item): item is { key: 'sand' | 'silt' | 'clay'; value: number } => typeof item.value === 'number' && Number.isFinite(item.value));
  const dominant = measured.length ? measured.reduce((best, current) => current.value > best.value ? current : best) : null;
  const dominance = dominant?.key === 'sand' ? c.sandy : dominant?.key === 'silt' ? c.silty : dominant?.key === 'clay' ? c.clayey : '';
  const texturePart = localizedTexture ? `${localizedTexture}.` : '';
  const fractionPart = measured.length ? c.fractions(sand, silt, clay) : '';
  return `${c.heading}: ${texturePart} ${dominance} ${fractionPart} ${c.source}: ${canonical.soil.sourceName}. ${c.limitation}`.replace(/\s+/g, ' ').trim();
}
