import { CanonicalReport, ReportLanguage } from './canonicalReport';

export interface CroatiaGroundPresentation {
  narrative: string;
  geohazardNarrative: string;
  sourceNames: string[];
  focus: string;
  mappedUnit: string | null;
  lithology: string | null;
  geologicalAge: string | null;
}

type CroatiaCopyLanguage = 'en' | 'de' | 'pl';

const copy = {
  en: {
    regional: (unit: string) => `HGI national geological mapping places the site in ${unit}.`,
    sedimentary: 'This is broad regional screening: the mapped class does not establish whether the site contains loose natural deposits, fill, weathered material, or their thickness and condition.',
    clastic: 'The mapped context is clastic sedimentary rock. Regional mapping does not establish rockhead depth, weathering, fracturing or local engineering properties.',
    limestone: 'The mapped context is limestone. Regional mapping does not establish rockhead depth, fracturing or any cavities/karst features at the site; these should only be assessed from more detailed local evidence where relevant.',
    generic: 'The mapped geological context is regional screening evidence and does not establish parcel-specific ground conditions.',
    focusSedimentary: 'Investigation focus: confirm the material and its origin, thickness, condition, groundwater relationship and any fill or soft layers with site-specific ground investigation.',
    focusRock: 'Investigation focus: confirm rockhead depth, weathering and fracturing with site-specific investigation; use more detailed HGI mapping where available.',
    focusLimestone: 'Investigation focus: confirm rockhead, fracturing and any locally relevant cavity/karst evidence before relying on the regional limestone map for development decisions.',
    age: (age: string) => `Mapped geological age: ${age}.`,
    scale: 'The automated layer is the HGI INSPIRE Geological Map at 1:300,000; more detailed HGI geological series are available for direct review.',
    hazardBoundary: 'The geological finding is not a landslide, flood or foundation classification. Those questions require separate hazard evidence and site-specific investigation.',
    boundary: 'This evidence supports due-diligence screening only. It is not a geotechnical investigation and does not provide foundation design parameters or a measured groundwater level.'
  },
  de: {
    regional: (unit: string) => `Die nationale geologische HGI-Kartierung ordnet den Standort ${unit} zu.`,
    sedimentary: 'Dies ist eine grobe regionale Vorprüfung: Die kartierte Klasse zeigt nicht, ob am Standort lockere natürliche Ablagerungen, Auffüllungen oder verwittertes Material vorliegen oder wie mächtig und fest diese sind.',
    clastic: 'Der kartierte Kontext ist klastisches Sedimentgestein. Die regionale Kartierung bestimmt weder die Tiefenlage des Felsens noch Verwitterung, Klüftung oder lokale technische Kennwerte.',
    limestone: 'Der kartierte Kontext ist Kalkstein. Die regionale Kartierung bestimmt weder die Felsoberkante noch Klüftung oder Hohlräume/Karstmerkmale am Standort; solche Merkmale sollten nur anhand detaillierter lokaler Nachweise geprüft werden.',
    generic: 'Der kartierte geologische Kontext ist eine regionale Vorprüfung und beschreibt nicht den standortbezogenen Baugrund.',
    focusSedimentary: 'Untersuchungsschwerpunkt: Material und Entstehung sowie Mächtigkeit, Zustand, Verhältnis zum Grundwasser und mögliche Auffüllungen oder weiche Schichten durch eine standortbezogene Baugrunderkundung bestätigen.',
    focusRock: 'Untersuchungsschwerpunkt: Felsoberkante, Verwitterung und Klüftung durch eine standortbezogene Untersuchung bestätigen und verfügbare detailliertere HGI-Karten heranziehen.',
    focusLimestone: 'Untersuchungsschwerpunkt: Felsoberkante, Klüftung und gegebenenfalls lokal relevante Hohlraum-/Karsthinweise prüfen, bevor Entscheidungen allein auf die regionale Kalksteinkartierung gestützt werden.',
    age: (age: string) => `Kartiertes geologisches Alter: ${age}.`,
    scale: 'Die automatisierte Ebene ist die HGI-INSPIRE-Geologische Karte 1:300.000; detailliertere HGI-Kartenreihen sind zur direkten Prüfung verfügbar.',
    hazardBoundary: 'Der geologische Befund ist keine Klassifizierung von Hangrutschung, Hochwasser oder Gründung. Diese Fragen erfordern separate Gefahrennachweise und standortbezogene Untersuchungen.',
    boundary: 'Diese Evidenz dient nur der Vorprüfung. Sie ersetzt keine Baugrunduntersuchung und liefert keine Gründungsbemessungswerte oder gemessenen Grundwasserstände.'
  },
  pl: {
    regional: (unit: string) => `Krajowe kartowanie geologiczne HGI wskazuje dla lokalizacji ${unit}.`,
    sedimentary: 'Jest to szeroki kontekst do analizy wstępnej: kartowana klasa nie określa, czy pod lokalizacją występują luźne osady naturalne, nasypy lub zwietrzelina ani jaka jest ich miąższość i stan.',
    clastic: 'Kartowany kontekst stanowią klastyczne skały osadowe. Kartowanie regionalne nie określa głębokości stropu skały, stopnia zwietrzenia, spękania ani lokalnych parametrów inżynierskich.',
    limestone: 'Kartowany kontekst stanowią wapienie. Kartowanie regionalne nie określa głębokości stropu skały, spękania ani ewentualnych pustek/cech krasowych pod lokalizacją; takie cechy należy oceniać wyłącznie na podstawie bardziej szczegółowych lokalnych danych, jeżeli są istotne.',
    generic: 'Kartowany kontekst geologiczny jest regionalnym materiałem do analizy wstępnej i nie określa warunków gruntowych konkretnej działki.',
    focusSedimentary: 'Co sprawdzić: potwierdzić materiał i jego genezę, miąższość, stan, relację z wodami gruntowymi oraz ewentualne nasypy lub warstwy słabe w badaniu podłoża dla lokalizacji.',
    focusRock: 'Co sprawdzić: potwierdzić głębokość stropu skały, zwietrzenie i spękanie w badaniu dla lokalizacji oraz wykorzystać dostępne bardziej szczegółowe mapy HGI.',
    focusLimestone: 'Co sprawdzić: potwierdzić strop skały, spękanie oraz lokalnie istotne informacje o pustkach/krasie, zanim decyzje inwestycyjne zostaną oparte na regionalnym kartowaniu wapieni.',
    age: (age: string) => `Kartowany wiek geologiczny: ${age}.`,
    scale: 'Automatycznie wykorzystywana warstwa to HGI INSPIRE Geological Map w skali 1:300 000; do bezpośredniej weryfikacji dostępne są bardziej szczegółowe serie HGI.',
    hazardBoundary: 'Wynik geologiczny nie jest klasyfikacją osuwisk, powodzi ani fundamentowania. Te kwestie wymagają odrębnych danych o zagrożeniach i badań dla konkretnej lokalizacji.',
    boundary: 'Dowód służy wyłącznie do analizy wstępnej. Nie zastępuje badań geotechnicznych i nie podaje parametrów do projektowania fundamentów ani pomierzonego poziomu wód gruntowych.'
  }
} as const satisfies Record<CroatiaCopyLanguage, Record<string, unknown>>;

function finiteString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function renderCroatiaGroundPresentation(canonical: CanonicalReport, language: ReportLanguage): CroatiaGroundPresentation | null {
  if (canonical.countryCode !== 'HR' || canonical.geology.status !== 'VERIFIED') return null;
  const unit = finiteString(canonical.geology.unitName);
  const lithology = finiteString(canonical.geology.lithology);
  const geologicalAge = finiteString(canonical.geology.geologicalAge);
  if (!unit && !lithology && !geologicalAge) return null;

  const copyLanguage: CroatiaCopyLanguage = language === 'de' ? 'de' : language === 'pl' ? 'pl' : 'en';
  const c = copy[copyLanguage];
  const unitText = unit || [geologicalAge, lithology].filter(Boolean).join(' — ') || c.generic;
  const normalized = `${unit || ''} ${lithology || ''}`.toLowerCase();
  const isLimestone = /limestone|wapien|kalkstein/.test(normalized);
  const isClastic = /clastic sedimentary|klast|klastisches/.test(normalized);
  const isBroadSedimentary = /sedimentary material|materiał osadow|sedimentäres material/.test(normalized) && !isClastic && !isLimestone;
  const detail = isLimestone ? c.limestone : isClastic ? c.clastic : isBroadSedimentary ? c.sedimentary : c.generic;
  const focus = isLimestone ? c.focusLimestone : isClastic ? c.focusRock : c.focusSedimentary;
  const parts = [c.regional(unitText), lithology && !unitText.toLowerCase().includes(lithology.toLowerCase()) ? lithology : null, geologicalAge ? c.age(geologicalAge) : null, detail, c.scale, focus, c.boundary].filter(Boolean) as string[];
  const geohazardNarrative = `${c.regional(unitText)} ${c.hazardBoundary}`;

  return {
    narrative: parts.join(' '),
    geohazardNarrative,
    sourceNames: canonical.geology.sourceName ? [canonical.geology.sourceName] : [],
    focus,
    mappedUnit: unit,
    lithology,
    geologicalAge
  };
}
