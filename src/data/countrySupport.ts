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

const valuationOnly = (countryCode: string): CountrySupportProfile => ({
  countryCode,
  maturity: 'LIMITED',
  capabilities: { ...NONE, nationalValuation: true }
});

const SUPPORT: Record<string, CountrySupportProfile> = {
  PL: { countryCode: 'PL', maturity: 'SUPPORTED', capabilities: { ...NONE, nationalCadastre: true, nationalGeology: true, nationalBoreholes: true, nationalHydrogeology: true } },
  GB: { countryCode: 'GB', maturity: 'SUPPORTED', capabilities: { ...NONE, nationalGeology: true, nationalBoreholes: true, nationalHydrogeology: true } },
  DE: valuationOnly('DE'),
  NL: { countryCode: 'NL', maturity: 'LIMITED', capabilities: { ...NONE, nationalCadastre: true } },
  FR: { countryCode: 'FR', maturity: 'LIMITED', capabilities: { ...NONE, nationalGeology: true, nationalBoreholes: true, nationalValuation: true } },
  SK: { countryCode: 'SK', maturity: 'LIMITED', capabilities: { ...NONE, nationalGeology: true, nationalBoreholes: true, nationalHydrogeology: true, nationalValuation: true } },
  CZ: { countryCode: 'CZ', maturity: 'LIMITED', capabilities: { ...NONE, nationalCadastre: true, nationalGeology: true, nationalBoreholes: true, nationalHydrogeology: true, nationalRadon: true, nationalMining: true } },
  DK: { countryCode: 'DK', maturity: 'LIMITED', capabilities: { ...NONE, nationalCadastre: true, nationalGeology: true, nationalBoreholes: true, nationalHydrogeology: true, nationalPlanning: true } },
  SE: { countryCode: 'SE', maturity: 'LIMITED', capabilities: { ...NONE, nationalGeology: true, nationalBoreholes: true, nationalHydrogeology: true } },
  NO: { countryCode: 'NO', maturity: 'LIMITED', capabilities: { ...NONE, nationalCadastre: true, nationalGeology: true, nationalBoreholes: true, nationalRadon: true } },
  AT: valuationOnly('AT'), ES: valuationOnly('ES'), FI: valuationOnly('FI'),
  IE: { countryCode: 'IE', maturity: 'LIMITED', capabilities: { ...NONE, nationalCadastre: true, nationalGeology: true, nationalBoreholes: true, nationalHydrogeology: true, nationalValuation: true, nationalRadon: true } }
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
  pl: { SUPPORTED: 'Obsługiwany', LIMITED: 'Ograniczony zakres' },
  sk: { SUPPORTED: 'Podporované', LIMITED: 'Obmedzené pokrytie' },
  da: { SUPPORTED: 'Understøttet', LIMITED: 'Begrænset dækning' },
  fr: { SUPPORTED: 'Pris en charge', LIMITED: 'Couverture limitée' },
  es: { SUPPORTED: 'Compatible', LIMITED: 'Cobertura limitada' },
  fi: { SUPPORTED: 'Tuettu', LIMITED: 'Rajoitettu kattavuus' }
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
  },
  sk: {
    SUPPORTED: 'Pre vybrané oblasti sú dostupné národné zdrojové integrácie. Nepodporované kategórie naďalej vyžadujú úradné overenie.',
    LIMITED: 'Obmedzené pokrytie: národné katastrálne, geologické, plánovacie, povodňové a oceňovacie integrácie ešte nie sú pre túto krajinu plne automatizované. Report naďalej využíva overené cezhraničné terénne údaje, OpenStreetMap a SoilGrids, ak sú dostupné, a odkazuje na príslušné orgány na manuálne overenie.',
    PARTIAL: 'Obmedzené pokrytie: vybrané národné zdrojové integrácie sú dostupné, zatiaľ čo ostatné národné kategórie naďalej vyžadujú úradné overenie. Report zároveň zachováva overené cezhraničné terénne údaje, OpenStreetMap a SoilGrids, ak sú dostupné.'
  },
  da: {
    SUPPORTED: 'Nationale kildeintegrationer er tilgængelige for udvalgte områder. Ikke-understøttede kategorier kræver fortsat officiel verifikation.',
    LIMITED: 'Begrænset dækning: nationale integrationer for matrikel, geologi, planlægning, oversvømmelse og værdi er endnu ikke fuldt automatiseret. Rapporten anvender fortsat validerede tværnationale terræn-, OpenStreetMap- og SoilGrids-data, hvor de er tilgængelige, og henviser til officielle myndigheder for kontrol.',
    PARTIAL: 'Begrænset dækning: udvalgte danske nationale kilder er integreret, mens øvrige kategorier fortsat kræver officiel verifikation. Rapporten bevarer også validerede tværnationale terræn-, OpenStreetMap- og SoilGrids-data, hvor de er tilgængelige.'
  },
  fr: {
    SUPPORTED: 'Des intégrations de sources nationales sont disponibles pour certaines catégories. Les catégories non prises en charge nécessitent toujours une vérification officielle.',
    LIMITED: 'Couverture limitée : les intégrations nationales pour le cadastre, la géologie, l’urbanisme, les inondations et la valeur foncière ne sont pas toutes automatisées pour ce pays. Le rapport utilise également les données transfrontalières validées de terrain, OpenStreetMap et SoilGrids lorsqu’elles sont disponibles et renvoie vers les autorités compétentes pour vérification.',
    PARTIAL: 'Couverture limitée : certaines sources nationales sont intégrées, tandis que les autres catégories nationales nécessitent toujours une vérification officielle. Le rapport conserve également les données transfrontalières validées de terrain, OpenStreetMap et SoilGrids lorsqu’elles sont disponibles.'
  },
  es: {
    SUPPORTED: 'Hay integraciones de fuentes nacionales disponibles para determinadas categorías. Las categorías no compatibles siguen requiriendo verificación oficial.',
    LIMITED: 'Cobertura limitada: las integraciones nacionales de catastro, geología, planeamiento, inundación y valoración no están todas automatizadas para este país. El informe también utiliza datos transfronterizos validados de terreno, OpenStreetMap y SoilGrids cuando están disponibles y remite a las autoridades competentes para su verificación.',
    PARTIAL: 'Cobertura limitada: algunas fuentes nacionales están integradas, mientras que otras categorías siguen requiriendo verificación oficial. El informe conserva además datos transfronterizos validados de terreno, OpenStreetMap y SoilGrids cuando están disponibles.'
  },
  fi: {
    SUPPORTED: 'Valituissa luokissa on käytettävissä kansallisia lähdeintegraatioita. Tukemattomat luokat on edelleen tarkistettava virallisista lähteistä.',
    LIMITED: 'Rajoitettu kattavuus: kansallisia kiinteistörekisteri-, geologia-, kaavoitus-, tulva- ja maan arvon lähteitä ei ole kaikilta osin automatisoitu tälle maalle. Raportti käyttää lisäksi validoituja rajat ylittäviä maasto-, OpenStreetMap- ja SoilGrids-aineistoja niiden ollessa saatavilla ja ohjaa viranomaislähteisiin tarkistusta varten.',
    PARTIAL: 'Rajoitettu kattavuus: osa kansallisista lähteistä on integroitu, mutta muut luokat vaativat edelleen virallisen tarkistuksen. Raportti säilyttää myös validoidut rajat ylittävät maasto-, OpenStreetMap- ja SoilGrids-aineistot niiden ollessa saatavilla.'
  }
} as const;

type SupportLanguage = keyof typeof labels;
const normalizeLanguage = (language: string): SupportLanguage => {
  const code = String(language || '').toLowerCase().split('-')[0];
  return (['de', 'pl', 'sk', 'da', 'fr', 'es', 'fi'] as SupportLanguage[]).includes(code as SupportLanguage) ? code as SupportLanguage : 'en';
};

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
