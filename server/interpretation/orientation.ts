import { CanonicalGeologyEvidence, ReportLanguage } from '../reporting/canonicalReport';

export type OrientationClass = 'GENERALLY_FAVOURABLE' | 'VARIABLE' | 'POTENTIALLY_CHALLENGING' | 'SPECIAL_CONCERN' | 'INSUFFICIENT_EVIDENCE';
export type OrientationBasis = 'MATERIAL' | 'GENETIC_ORIGIN' | 'AGE_CONTEXT' | 'OBSERVED_STATE' | 'GROUNDWATER_CONTEXT';

export interface GroundOrientationInput {
  geology: CanonicalGeologyEvidence;
  texture?: string | null;
  stateDescriptor?: string | null;
  additionalContext?: string | null;
}

export interface GroundOrientationResult {
  classification: OrientationClass;
  evidenceType: 'INDICATIVE_GEOTECHNICAL_ORIENTATION';
  siteSpecific: false;
  designUse: false;
  basis: OrientationBasis[];
  matchedSignals: string[];
  summary: Record<ReportLanguage, string>;
  investigationFocus: Record<ReportLanguage, string>;
  disclaimer: Record<ReportLanguage, string>;
}

const norm = (value: unknown) => String(value || '').trim().toLowerCase();
const containsAny = (text: string, terms: string[]) => terms.some(term => text.includes(term));

const copy = {
  disclaimer: {
    en: 'Indicative orientation only. This is not a measured, characteristic or design value and must not be used for foundation or earthworks design.',
    de: 'Nur orientierende Einschätzung. Dies ist kein gemessener, charakteristischer oder Bemessungswert und darf nicht für die Gründungs- oder Erdbaubemessung verwendet werden.',
    pl: 'Wyłącznie orientacyjna ocena. Nie jest to wartość pomierzona, charakterystyczna ani obliczeniowa i nie może być używana do projektowania fundamentów ani robót ziemnych.'
  },
  GENERALLY_FAVOURABLE: {
    summary: {
      en: 'The available description is broadly consistent with comparatively favourable preliminary ground behaviour, subject to confirmation of density/consistency, groundwater and local variability.',
      de: 'Die verfügbare Beschreibung ist grundsätzlich mit vergleichsweise günstigen Baugrundverhältnissen vereinbar, vorbehaltlich der Bestätigung von Lagerungsdichte/Konsistenz, Grundwasser und lokaler Variabilität.',
      pl: 'Dostępny opis jest ogólnie zgodny z relatywnie korzystnymi warunkami podłoża na etapie wstępnym, pod warunkiem potwierdzenia zagęszczenia/konsystencji, warunków wodnych i lokalnej zmienności.'
    },
    focus: {
      en: 'Confirm density or consistency, groundwater level, layer continuity and any loose or soft local zones.',
      de: 'Lagerungsdichte bzw. Konsistenz, Grundwasserstand, Schichtkontinuität sowie lokale lockere oder weiche Bereiche bestätigen.',
      pl: 'Potwierdzić stopień zagęszczenia lub konsystencję, poziom wód gruntowych, ciągłość warstw oraz lokalne strefy luźne lub słabe.'
    }
  },
  VARIABLE: {
    summary: {
      en: 'The mapped material or depositional origin suggests potentially variable ground conditions. Local changes in grain size, density, organic content or groundwater may be important.',
      de: 'Das kartierte Material bzw. seine Ablagerungsgenese deutet auf potenziell wechselhafte Baugrundverhältnisse hin. Lokale Unterschiede in Korngröße, Lagerungsdichte, organischem Anteil oder Grundwasser können wesentlich sein.',
      pl: 'Zmapowany materiał lub jego geneza wskazują na potencjalnie zmienne warunki podłoża. Istotne mogą być lokalne zmiany uziarnienia, zagęszczenia, zawartości części organicznych lub warunków wodnych.'
    },
    focus: {
      en: 'Investigate lateral and vertical variability, groundwater and the presence of loose, soft or organic interbeds.',
      de: 'Seitliche und vertikale Variabilität, Grundwasser sowie lockere, weiche oder organische Zwischenlagen untersuchen.',
      pl: 'Sprawdzić zmienność poziomą i pionową, warunki wodne oraz występowanie luźnych, słabych lub organicznych przewarstwień.'
    }
  },
  POTENTIALLY_CHALLENGING: {
    summary: {
      en: 'The available description contains indicators that can be associated with less favourable preliminary ground behaviour. Site investigation should establish whether these conditions are present beneath the site.',
      de: 'Die verfügbare Beschreibung enthält Hinweise, die mit weniger günstigen Baugrundverhältnissen verbunden sein können. Eine Baugrunduntersuchung sollte klären, ob diese Bedingungen am Standort tatsächlich vorliegen.',
      pl: 'Dostępny opis zawiera cechy, które mogą wiązać się z mniej korzystnymi warunkami podłoża. Badania geotechniczne powinny ustalić, czy takie warunki rzeczywiście występują w obrębie działki.'
    },
    focus: {
      en: 'Prioritise density/consistency, compressibility, groundwater, layer thickness and variability.',
      de: 'Lagerungsdichte/Konsistenz, Kompressibilität, Grundwasser, Schichtmächtigkeit und Variabilität vorrangig untersuchen.',
      pl: 'W pierwszej kolejności sprawdzić zagęszczenie/konsystencję, ściśliwość, warunki wodne, miąższość warstw i zmienność.'
    }
  },
  SPECIAL_CONCERN: {
    summary: {
      en: 'The mapped description includes a ground type that commonly warrants particular attention during early screening, such as organic deposits or made ground.',
      de: 'Die kartierte Beschreibung enthält einen Baugrundtyp, der bei der Vorprüfung üblicherweise besondere Aufmerksamkeit erfordert, beispielsweise organische Ablagerungen oder Auffüllungen.',
      pl: 'Zmapowany opis obejmuje typ podłoża, który zwykle wymaga szczególnej uwagi na etapie wstępnej oceny, np. grunty organiczne lub nasypy.'
    },
    focus: {
      en: 'Establish thickness, composition, variability, compressibility, groundwater and whether unsuitable or uncontrolled material is present.',
      de: 'Mächtigkeit, Zusammensetzung, Variabilität, Kompressibilität, Grundwasser und das mögliche Auftreten ungeeigneter oder unkontrollierter Materialien klären.',
      pl: 'Ustalić miąższość, skład, zmienność, ściśliwość, warunki wodne oraz obecność materiału niekontrolowanego lub nieprzydatnego.'
    }
  },
  INSUFFICIENT_EVIDENCE: {
    summary: {
      en: 'The available evidence is not specific enough to provide a meaningful geotechnical orientation.',
      de: 'Die verfügbaren Angaben sind nicht spezifisch genug für eine sinnvolle geotechnische Orientierung.',
      pl: 'Dostępne dane nie są wystarczająco szczegółowe, aby podać wiarygodną orientacyjną ocenę geotechniczną.'
    },
    focus: {
      en: 'Obtain more specific information on material, origin, state and groundwater before drawing preliminary conclusions.',
      de: 'Vor einer vorläufigen Bewertung sind genauere Angaben zu Material, Genese, Zustand und Grundwasser erforderlich.',
      pl: 'Przed formułowaniem wstępnych wniosków należy uzyskać dokładniejsze informacje o materiale, genezie, stanie i warunkach wodnych.'
    }
  }
} as const;

/** Conservative qualitative screening only; never creates design parameters. */
export function resolveIndicativeGroundOrientation(input: GroundOrientationInput): GroundOrientationResult {
  const joined = [input.geology.unitName, input.geology.lithology, input.geology.geologicalAge, input.texture, input.stateDescriptor, input.additionalContext]
    .map(norm)
    .filter(Boolean)
    .join(' | ');

  const basis = new Set<OrientationBasis>();
  const signals: string[] = [];
  const mark = (basisType: OrientationBasis, signal: string) => { basis.add(basisType); signals.push(signal); };

  if (containsAny(joined, ['torf', 'peat', 'gyttja', 'organic soil', 'organic deposit', 'namuł organiczny'])) {
    mark('MATERIAL', 'organic deposit');
    return makeResult('SPECIAL_CONCERN', basis, signals);
  }
  if (containsAny(joined, ['nasyp', 'made ground', 'fill', 'anthropogenic', 'antropogenic'])) {
    mark('GENETIC_ORIGIN', 'made/anthropogenic ground');
    return makeResult('SPECIAL_CONCERN', basis, signals);
  }

  // Resolve specific genetic origins before broader lexical roots.
  const glaciofluvial = containsAny(joined, ['glaciofluvial', 'fluvioglacial', 'wodnolodowcow', 'wodno-lodowcow']);
  const alluvial = !glaciofluvial && containsAny(joined, ['alluv', 'aluw', 'rzecz', 'mady', 'river deposit', 'fluvial']);
  const till = !glaciofluvial && containsAny(joined, ['glacial till', 'lodowcow', 'glina zwałowa', 'glina zwalowa', 'moren']);
  const recent = containsAny(joined, ['holocene', 'holoceń', 'holocen', 'recent', 'współczesn']);
  const sand = containsAny(joined, ['sand', 'piasek', 'piaski']);
  const dense = containsAny(joined, ['dense', 'very dense', 'zagęszcz', 'zageszcz', 'zwarty']);
  const loose = containsAny(joined, ['loose', 'very loose', 'luźn', 'luzn']);
  const soft = containsAny(joined, ['soft', 'very soft', 'miękk', 'miekk', 'plastyczn']);
  const clayey = containsAny(joined, ['clay', 'ił', 'il ', 'glina', 'silty clay']);

  if (alluvial) mark('GENETIC_ORIGIN', 'alluvial/fluvial origin');
  if (glaciofluvial) mark('GENETIC_ORIGIN', 'glaciofluvial origin');
  if (till) mark('GENETIC_ORIGIN', 'glacial/till origin');
  if (recent) mark('AGE_CONTEXT', 'recent/Holocene context');
  if (sand) mark('MATERIAL', 'sand');
  if (clayey) mark('MATERIAL', 'fine-grained/clayey material');
  if (dense) mark('OBSERVED_STATE', 'dense/compacted state');
  if (loose) mark('OBSERVED_STATE', 'loose state');
  if (soft) mark('OBSERVED_STATE', 'soft/plastic state');

  if (loose || soft) return makeResult('POTENTIALLY_CHALLENGING', basis, signals);
  if (alluvial && recent) return makeResult('VARIABLE', basis, signals);
  if (alluvial) return makeResult('VARIABLE', basis, signals);
  if (till) return makeResult('VARIABLE', basis, signals);
  if (glaciofluvial && sand && dense) return makeResult('GENERALLY_FAVOURABLE', basis, signals);
  if (sand && dense) return makeResult('GENERALLY_FAVOURABLE', basis, signals);
  if (glaciofluvial && sand) return makeResult('VARIABLE', basis, signals);
  if (clayey) return makeResult('VARIABLE', basis, signals);
  return makeResult('INSUFFICIENT_EVIDENCE', basis, signals);
}

function makeResult(classification: OrientationClass, basis: Set<OrientationBasis>, matchedSignals: string[]): GroundOrientationResult {
  return { classification, evidenceType: 'INDICATIVE_GEOTECHNICAL_ORIENTATION', siteSpecific: false, designUse: false, basis: [...basis], matchedSignals, summary: copy[classification].summary, investigationFocus: copy[classification].focus, disclaimer: copy.disclaimer };
}

export function renderIndicativeGroundOrientation(result: GroundOrientationResult, language: ReportLanguage) {
  const labels: Record<ReportLanguage, Record<OrientationClass, string>> = {
    en: { GENERALLY_FAVOURABLE: 'Generally favourable', VARIABLE: 'Variable / condition-dependent', POTENTIALLY_CHALLENGING: 'Potentially challenging', SPECIAL_CONCERN: 'Special concern', INSUFFICIENT_EVIDENCE: 'Insufficient evidence' },
    de: { GENERALLY_FAVOURABLE: 'Grundsätzlich günstig', VARIABLE: 'Variabel / zustandsabhängig', POTENTIALLY_CHALLENGING: 'Potenziell anspruchsvoll', SPECIAL_CONCERN: 'Besondere Aufmerksamkeit', INSUFFICIENT_EVIDENCE: 'Unzureichende Datengrundlage' },
    pl: { GENERALLY_FAVOURABLE: 'Ogólnie korzystne', VARIABLE: 'Zmienne / zależne od warunków', POTENTIALLY_CHALLENGING: 'Potencjalnie trudne', SPECIAL_CONCERN: 'Wymaga szczególnej uwagi', INSUFFICIENT_EVIDENCE: 'Niewystarczające dane' }
  };
  return { label: labels[language][result.classification], summary: result.summary[language], investigationFocus: result.investigationFocus[language], disclaimer: result.disclaimer[language], evidenceType: result.evidenceType, siteSpecific: result.siteSpecific, designUse: result.designUse, basis: result.basis, matchedSignals: result.matchedSignals };
}
