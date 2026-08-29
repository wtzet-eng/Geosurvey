export type CountrySupportMaturity = 'SUPPORTED' | 'LIMITED';

export type CountryCapability =
  | 'nationalCadastre'
  | 'nationalGeology'
  | 'nationalBoreholes'
  | 'nationalHydrogeology'
  | 'nationalFlood'
  | 'nationalPlanning'
  | 'nationalValuation'
  | 'nationalRadon'
  | 'nationalMining';

export interface CountrySupportCapabilities {
  nationalCadastre: boolean;
  nationalGeology: boolean;
  nationalBoreholes: boolean;
  nationalHydrogeology: boolean;
  nationalFlood: boolean;
  nationalPlanning: boolean;
  nationalValuation: boolean;
  nationalRadon: boolean;
  nationalMining: boolean;
}

export interface CountrySupportProfile {
  countryCode: string;
  maturity: CountrySupportMaturity;
  capabilities: CountrySupportCapabilities;
}

const NONE: CountrySupportCapabilities = {
  nationalCadastre: false,
  nationalGeology: false,
  nationalBoreholes: false,
  nationalHydrogeology: false,
  nationalFlood: false,
  nationalPlanning: false,
  nationalValuation: false,
  nationalRadon: false,
  nationalMining: false
};

const SUPPORT: Record<string, CountrySupportProfile> = {
  PL: {
    countryCode: 'PL',
    maturity: 'SUPPORTED',
    capabilities: {
      ...NONE,
      nationalCadastre: true,
      nationalGeology: true,
      nationalBoreholes: true,
      nationalHydrogeology: true
    }
  },
  GB: {
    countryCode: 'GB',
    maturity: 'SUPPORTED',
    capabilities: {
      ...NONE,
      nationalGeology: true,
      nationalBoreholes: true,
      nationalHydrogeology: true
    }
  },
  FR: {
    countryCode: 'FR',
    maturity: 'LIMITED',
    capabilities: {
      ...NONE,
      nationalGeology: true,
      nationalBoreholes: true
    }
  }
};

export function getCountrySupport(countryCode: string): CountrySupportProfile {
  const code = String(countryCode || 'EU').toUpperCase();
  return SUPPORT[code] || { countryCode: code, maturity: 'LIMITED', capabilities: { ...NONE } };
}

export function supportsCountryCapability(countryCode: string, capability: CountryCapability): boolean {
  return getCountrySupport(countryCode).capabilities[capability];
}

const labels = {
  en: { SUPPORTED: 'Supported', LIMITED: 'Limited coverage' },
  de: { SUPPORTED: 'Unterstützt', LIMITED: 'Begrenzte Abdeckung' },
  pl: { SUPPORTED: 'Obsługiwany', LIMITED: 'Ograniczony zakres' }
} as const;

const notices = {
  en: {
    SUPPORTED: 'National source integrations are available for selected capabilities. Unsupported categories still require official verification.',
    LIMITED: 'Limited coverage: national cadastre, geology, planning, flood and valuation integrations are not yet automated for this country. The report still uses validated cross-border terrain, OpenStreetMap and SoilGrids evidence when available, and points to official authorities for manual verification.',
    PARTIAL: 'Limited coverage: selected national source integrations are available, while other national categories still require official verification. The report also retains validated cross-border terrain, OpenStreetMap and SoilGrids evidence when available.'
  },
  de: {
    SUPPORTED: 'Für ausgewählte Bereiche stehen nationale Quellenintegrationen zur Verfügung. Nicht unterstützte Kategorien erfordern weiterhin eine amtliche Prüfung.',
    LIMITED: 'Begrenzte Abdeckung: Nationale Kataster-, Geologie-, Planungs-, Hochwasser- und Bewertungsquellen sind für dieses Land noch nicht automatisiert. Der Bericht nutzt weiterhin validierte länderübergreifende Gelände-, OpenStreetMap- und SoilGrids-Daten, sofern verfügbar, und verweist zur manuellen Prüfung auf die zuständigen Behörden.',
    PARTIAL: 'Begrenzte Abdeckung: Für ausgewählte Bereiche stehen nationale Quellenintegrationen zur Verfügung; andere nationale Kategorien erfordern weiterhin eine amtliche Prüfung. Zusätzlich werden validierte länderübergreifende Gelände-, OpenStreetMap- und SoilGrids-Daten genutzt, sofern verfügbar.'
  },
  pl: {
    SUPPORTED: 'Dla wybranych zakresów dostępne są integracje ze źródłami krajowymi. Nieobsługiwane kategorie nadal wymagają urzędowej weryfikacji.',
    LIMITED: 'Ograniczony zakres: krajowe integracje katastralne, geologiczne, planistyczne, powodziowe i wycenowe nie są jeszcze zautomatyzowane dla tego kraju. Raport nadal wykorzystuje zweryfikowane dane transgraniczne o terenie, OpenStreetMap i SoilGrids, jeśli są dostępne, oraz wskazuje właściwe organy do ręcznej weryfikacji.',
    PARTIAL: 'Ograniczony zakres: dla wybranych kategorii dostępne są integracje ze źródłami krajowymi, a pozostałe zakresy nadal wymagają urzędowej weryfikacji. Raport zachowuje również zweryfikowane dane transgraniczne o terenie, OpenStreetMap i SoilGrids, jeśli są dostępne.'
  }
} as const;

const normalizeLanguage = (language: string): 'en' | 'de' | 'pl' => language === 'de' || language === 'pl' ? language : 'en';

export function getCountrySupportLabel(countryCode: string, language = 'en'): string {
  const lang = normalizeLanguage(language);
  return labels[lang][getCountrySupport(countryCode).maturity];
}

export function getCountrySupportNotice(countryCode: string, language = 'en'): string {
  const lang = normalizeLanguage(language);
  const support = getCountrySupport(countryCode);
  if (support.maturity === 'LIMITED' && Object.values(support.capabilities).some(Boolean)) return notices[lang].PARTIAL;
  return notices[lang][support.maturity];
}
