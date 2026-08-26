import { AvailabilityReason, CanonicalReport, ReportLanguage, RiskClassification, normalizeReportLanguage } from './canonicalReport';
import { renderGeologicalInterpretation, resolveGeologicalInterpretation } from '../interpretation/resolver';
import { renderIndicativeGroundOrientation, resolveIndicativeGroundOrientation } from '../interpretation/orientation';
import { getCountrySupportLabel, getCountrySupportNotice } from '../../src/data/countrySupport';
import { GroundVariabilityClass, MappedMaterialIndicator } from '../services/groundContextService';

type Section = { summary: string; detail: string; evidence_level: string; source_cited?: string; limitation_notice?: string };

const copy = {
  en: { unavailable: 'not available', requires: 'Requires verification', sourceUnavailable: 'The required source data was unavailable. No scientific value was inferred.', authoritative: 'Binding information requires confirmation by the competent authority.', geology: 'According to {source}, the site geological unit is {unit}.', geologyMissing: 'A geological unit is not available from the reviewed sources.', terrain: 'Modelled terrain: elevation {elevation} m and slope {slope}°.', terrainMissing: 'Terrain measurements are not available.', flood: 'Flood screening classification: {risk}.', soil: 'Soil model texture: {texture}; bearing capacity: {bearing}.', planning: 'Planning parameters require confirmation under {instrument}.', road: 'Nearest mapped road: {road}, approximately {distance} m away.', environment: 'Environmental screening identified {area}.', environmentClear: 'No protected-area feature was mapped in the reviewed query area.', valuation: 'Indicative statistical value: {min}–{max} {currency}.', summary: 'This evidence-led assessment covers {country}. Geological unit: {unit}. Terrain: {terrain}. Soil: {soil}. Evidence score: {score}/100. The statistical valuation is {min}–{max} {currency}.', summaryNoValuation: 'This evidence-led assessment covers {country}. Geological unit: {unit}. Terrain: {terrain}. Soil: {soil}. Evidence score: {score}/100. No automated site valuation is presented because a supported national valuation acquisition is not available.', limitation: 'Known limitation', claim: 'Evidence record for {category}.', spatial: 'Spatial relationship recorded for the selected site.', method: 'Source-specific ingestion and normalization into the canonical evidence model.', checklist: ['Obtain the official planning certificate.', 'Commission a Eurocode 7 geotechnical site investigation.', 'Commission a certified topographical survey.', 'Obtain formal utility connection terms.', 'Verify title, boundaries, easements and encumbrances.'], topics: ['Official planning confirmation', 'Geotechnical site investigation', 'Topographical survey', 'Utility connection terms', 'Title and cadastral verification'], disclaimers: ['This automated report is for preliminary screening and is not an official administrative certificate.', 'No automated valuation is presented unless a supported national acquisition provides adequate evidence.', 'Modelled soil evidence does not replace a Eurocode 7 site investigation.', 'Binding planning rights require official confirmation.', 'Source availability and limitations must be reviewed before an investment decision.'] },
  de: { unavailable: 'nicht verfügbar', requires: 'Prüfung erforderlich', sourceUnavailable: 'Die erforderlichen Quelldaten waren nicht verfügbar. Es wurde kein wissenschaftlicher Wert abgeleitet.', authoritative: 'Verbindliche Angaben erfordern die Bestätigung durch die zuständige Behörde.', geology: 'Nach Angaben von {source} liegt der Standort im Bereich der geologischen Einheit {unit}.', geologyMissing: 'Eine geologische Einheit ist in den geprüften Quellen nicht verfügbar.', terrain: 'Modelliertes Gelände: Höhe {elevation} m und Neigung {slope}°.', terrainMissing: 'Geländemesswerte sind nicht verfügbar.', flood: 'Klassifizierung der Hochwasservorprüfung: {risk}.', soil: 'Bodenmodell: Textur {texture}; Tragfähigkeit: {bearing}.', planning: 'Planungsparameter müssen nach {instrument} bestätigt werden.', road: 'Nächste kartierte Straße: {road}, ungefähr {distance} m entfernt.', environment: 'Die Umweltprüfung identifizierte {area}.', environmentClear: 'Im geprüften Abfragegebiet wurde kein Schutzgebietsobjekt kartiert.', valuation: 'Indikativer statistischer Wert: {min}–{max} {currency}.', summary: 'Diese evidenzbasierte Standortbewertung betrifft {country}. Geologische Einheit: {unit}. Gelände: {terrain}. Boden: {soil}. Evidenzwert: {score}/100. Der statistische Richtwert beträgt {min}–{max} {currency}.', summaryNoValuation: 'Diese evidenzbasierte Standortbewertung betrifft {country}. Geologische Einheit: {unit}. Gelände: {terrain}. Boden: {soil}. Evidenzwert: {score}/100. Eine automatisierte Standortbewertung wird nicht angegeben, weil keine unterstützte nationale Bewertungsquelle vorliegt.', limitation: 'Bekannte Einschränkung', claim: 'Evidenznachweis für {category}.', spatial: 'Räumlicher Bezug für den ausgewählten Standort dokumentiert.', method: 'Quellenspezifische Erfassung und Normalisierung in das kanonische Evidenzmodell.', checklist: ['Amtlichen Planungsnachweis einholen.', 'Baugrunduntersuchung nach Eurocode 7 beauftragen.', 'Amtliche topografische Vermessung beauftragen.', 'Formelle Anschlussbedingungen der Versorger einholen.', 'Eigentum, Grenzen, Dienstbarkeiten und Belastungen prüfen.'], topics: ['Amtliche Planungsbestätigung', 'Baugrunduntersuchung', 'Topografische Vermessung', 'Versorgungsanschlüsse', 'Grundbuch- und Katasterprüfung'], disclaimers: ['Dieser automatisierte Bericht dient nur der Vorprüfung und ist keine amtliche Bescheinigung.', 'Eine automatisierte Bewertung wird nur bei ausreichender Evidenz aus einer unterstützten nationalen Quelle dargestellt.', 'Modellierte Bodendaten ersetzen keine Baugrunduntersuchung nach Eurocode 7.', 'Verbindliches Planungsrecht erfordert eine amtliche Bestätigung.', 'Quellenverfügbarkeit und Einschränkungen sind vor einer Investitionsentscheidung zu prüfen.'] },
  pl: { unavailable: 'brak danych', requires: 'Wymaga weryfikacji', sourceUnavailable: 'Wymagane dane źródłowe były niedostępne. Nie wyprowadzono wartości naukowej.', authoritative: 'Wiążące informacje wymagają potwierdzenia przez właściwy organ.', geology: 'Według danych {source} lokalizacja znajduje się w obrębie jednostki geologicznej {unit}.', geologyMissing: 'Jednostka geologiczna nie jest dostępna w przeanalizowanych źródłach.', terrain: 'Model terenu: wysokość {elevation} m i nachylenie {slope}°.', terrainMissing: 'Pomiary terenu są niedostępne.', flood: 'Klasyfikacja wstępnej oceny powodziowej: {risk}.', soil: 'Model gleby: tekstura {texture}; nośność: {bearing}.', planning: 'Parametry planistyczne wymagają potwierdzenia na podstawie {instrument}.', road: 'Najbliższa zmapowana droga: {road}, w odległości około {distance} m.', environment: 'Analiza środowiskowa wykazała {area}.', environmentClear: 'W analizowanym obszarze zapytania nie zmapowano obiektu chronionego.', valuation: 'Orientacyjna wartość statystyczna: {min}–{max} {currency}.', summary: 'Niniejsza oparta na dowodach ocena dotyczy lokalizacji w {country}. Jednostka geologiczna: {unit}. Teren: {terrain}. Gleba: {soil}. Wynik jakości dowodów: {score}/100. Statystyczny przedział wartości wynosi {min}–{max} {currency}.', summaryNoValuation: 'Niniejsza oparta na dowodach ocena dotyczy lokalizacji w {country}. Jednostka geologiczna: {unit}. Teren: {terrain}. Gleba: {soil}. Wynik jakości dowodów: {score}/100. Nie przedstawiono automatycznej wyceny lokalizacji, ponieważ brak obsługiwanej krajowej integracji wycenowej.', limitation: 'Znane ograniczenie', claim: 'Rekord dowodowy dla kategorii {category}.', spatial: 'Zarejestrowano relację przestrzenną dla wybranej lokalizacji.', method: 'Pozyskanie ze źródła i normalizacja do kanonicznego modelu dowodowego.', checklist: ['Uzyskać urzędowy dokument planistyczny.', 'Zlecić badania geotechniczne zgodne z Eurokodem 7.', 'Zlecić uprawnioną mapę do celów projektowych.', 'Uzyskać formalne warunki przyłączenia mediów.', 'Zweryfikować tytuł prawny, granice, służebności i obciążenia.'], topics: ['Urzędowe potwierdzenie planistyczne', 'Badania geotechniczne', 'Mapa do celów projektowych', 'Warunki przyłączenia mediów', 'Weryfikacja księgi wieczystej i katastru'], disclaimers: ['Ten automatyczny raport służy wyłącznie analizie wstępnej i nie jest dokumentem urzędowym.', 'Automatyczna wycena jest prezentowana wyłącznie przy wystarczających dowodach z obsługiwanej krajowej integracji.', 'Modelowane dane glebowe nie zastępują badań geotechnicznych zgodnych z Eurokodem 7.', 'Wiążące prawa zabudowy wymagają urzędowego potwierdzenia.', 'Przed decyzją inwestycyjną należy sprawdzić dostępność i ograniczenia źródeł.'] }
} satisfies Record<ReportLanguage, Record<string, string | string[]>>;

const interpolate = (template: string, values: Record<string, unknown>) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
const value = (input: unknown, unavailable: string) => input === null || input === undefined || input === '' ? unavailable : String(input);
const risk = (classification: RiskClassification, language: ReportLanguage) => {
  const labels = { en: { NEGLIGIBLE: 'Negligible', LOW: 'Low', MODERATE: 'Moderate', HIGH: 'High' }, de: { NEGLIGIBLE: 'Vernachlässigbar', LOW: 'Gering', MODERATE: 'Mäßig', HIGH: 'Hoch' }, pl: { NEGLIGIBLE: 'Znikome', LOW: 'Niskie', MODERATE: 'Umiarkowane', HIGH: 'Wysokie' } };
  return classification ? labels[language][classification] : copy[language].unavailable as string;
};

const reasonCopy: Record<ReportLanguage, Record<AvailabilityReason, string>> = {
  en: {
    NO_DATA: 'The source was queried successfully but returned no feature for this location. This is not evidence of absence.',
    SOURCE_UNAVAILABLE: 'The source was temporarily unavailable or could not be reached. Verification is required.',
    MALFORMED_DATA: 'The source responded, but its structure could not be validated safely. No value was inferred.',
    PARAMETER_NOT_PROVIDED: 'This parameter is not provided by the dataset used for this assessment.',
    INSUFFICIENT_EVIDENCE: 'The available evidence is insufficient to infer this value safely.',
    NOT_SUPPORTED_FOR_COUNTRY: 'This automated national source is not supported for the selected country. Consult the competent authority.',
    AUTHORITATIVE_DATA_REQUIRED: 'This information requires confirmation in an authoritative document or by the competent authority.'
  },
  de: {
    NO_DATA: 'Die Quelle wurde erfolgreich abgefragt, lieferte für diesen Standort jedoch kein Objekt. Dies belegt keine Abwesenheit.',
    SOURCE_UNAVAILABLE: 'Die Quelle war vorübergehend nicht verfügbar oder nicht erreichbar. Eine Prüfung ist erforderlich.',
    MALFORMED_DATA: 'Die Quelle antwortete, ihre Struktur konnte jedoch nicht sicher validiert werden. Es wurde kein Wert abgeleitet.',
    PARAMETER_NOT_PROVIDED: 'Dieser Parameter wird vom verwendeten Datensatz nicht bereitgestellt.',
    INSUFFICIENT_EVIDENCE: 'Die verfügbare Evidenz reicht nicht aus, um diesen Wert sicher abzuleiten.',
    NOT_SUPPORTED_FOR_COUNTRY: 'Diese automatisierte nationale Quelle wird für das ausgewählte Land nicht unterstützt. Die zuständige Behörde ist zu konsultieren.',
    AUTHORITATIVE_DATA_REQUIRED: 'Diese Angabe muss durch ein amtliches Dokument oder die zuständige Behörde bestätigt werden.'
  },
  pl: {
    NO_DATA: 'Źródło zostało odpytane prawidłowo, ale nie zwróciło obiektu dla tej lokalizacji. Nie stanowi to dowodu braku zjawiska.',
    SOURCE_UNAVAILABLE: 'Źródło było czasowo niedostępne lub nie można było nawiązać połączenia. Wymagana jest weryfikacja.',
    MALFORMED_DATA: 'Źródło odpowiedziało, ale nie udało się bezpiecznie potwierdzić struktury danych. Nie wyprowadzono wartości.',
    PARAMETER_NOT_PROVIDED: 'Parametr nie jest udostępniany przez wykorzystany zbiór danych.',
    INSUFFICIENT_EVIDENCE: 'Dostępne dowody są niewystarczające do bezpiecznego wyznaczenia tej wartości.',
    NOT_SUPPORTED_FOR_COUNTRY: 'Automatyczne krajowe źródło nie jest obsługiwane dla wybranego kraju. Należy sprawdzić dane właściwego organu.',
    AUTHORITATIVE_DATA_REQUIRED: 'Informacja wymaga potwierdzenia w dokumencie urzędowym lub przez właściwy organ.'
  }
};

export const localizeAvailabilityReason = (reason: AvailabilityReason, language: ReportLanguage): string => reasonCopy[language][reason];

const localizedClassification = (input: string | null, language: ReportLanguage, unavailable: string): string => {
  if (!input) return unavailable;
  const phrases: Record<ReportLanguage, Record<string, string>> = {
    en: { 'LOW TO VERY LOW': 'Low to very low', LOW: 'Low', MODERATE: 'Moderate', HIGH: 'High' },
    de: { 'LOW TO VERY LOW': 'Gering bis sehr gering', LOW: 'Gering', MODERATE: 'Mäßig', HIGH: 'Hoch' },
    pl: { 'LOW TO VERY LOW': 'Niskie do bardzo niskiego', LOW: 'Niskie', MODERATE: 'Umiarkowane', HIGH: 'Wysokie' }
  };
  const exact = phrases[language][input.trim().toUpperCase()];
  if (exact) return exact;
  return input.replace(/\((Low to Very Low|Low|Moderate|High)\)/gi, match => `(${phrases[language][match.slice(1, -1).toUpperCase()] || match.slice(1, -1)})`);
};

const hazardCopy = {
  en: { landslide: 'Landslide susceptibility classification: {risk}.', seismic: 'Seismic screening value: {value}.', radon: 'Radon screening classification: {value}.', mining: 'Mining-subsidence screening classification: {value}.' },
  de: { landslide: 'Klassifizierung der Hangrutschungsanfälligkeit: {risk}.', seismic: 'Wert der seismischen Vorprüfung: {value}.', radon: 'Klassifizierung der Radonvorprüfung: {value}.', mining: 'Klassifizierung der Bergsenkungsvorprüfung: {value}.' },
  pl: { landslide: 'Klasyfikacja podatności na osuwiska: {risk}.', seismic: 'Wartość wstępnej oceny sejsmicznej: {value}.', radon: 'Klasyfikacja wstępnej oceny radonowej: {value}.', mining: 'Klasyfikacja wstępnej oceny szkód górniczych: {value}.' }
} satisfies Record<ReportLanguage, Record<string, string>>;

const groundContextCopy = {
  en: {
    title: 'Ground variability / Geological context',
    labels: { LOW: 'Low mapped variability', MODERATE: 'Moderate mapped variability', HIGH: 'High mapped variability', INSUFFICIENT_EVIDENCE: 'Insufficient evidence' },
    mappedUniform: 'The reviewed mapped samples are consistent with one dominant ground unit in the sampled area.',
    transition: 'Different mapped ground units were returned across the site/parcel/vicinity samples, indicating a possible transition zone.',
    insufficient: 'The available mapped samples are not sufficient to characterize spatial ground variability.',
    materials: 'Mapped context indicators',
    mappedUnits: 'Mapped units observed',
    samples: 'usable mapped samples',
    soilStable: 'Multi-point SoilGrids sampling did not show a change in the reviewed topsoil model values.',
    soilVariable: 'Multi-point SoilGrids sampling shows variation in the reviewed topsoil model values.',
    soilUnavailable: 'Multi-point SoilGrids context is not available.',
    investigateTransition: 'Investigation focus: test the mapped transition and confirm which materials occur beneath the site, including changes in thickness and condition.',
    investigateOrganic: 'Investigation focus: specifically test for soft/organic or alluvial deposits and their lateral variability; do not assume nearby mapped deposits occur beneath the site.',
    investigateGeneral: 'Investigation focus: confirm material, origin, condition and groundwater with site-specific investigation before engineering decisions.',
    limitation: 'Mapped and modelled context is screening evidence only. Nearby responses do not establish site strata, deposit thickness, groundwater conditions, density/state or engineering properties, and sparse samples do not define an exact geological boundary.'
  },
  de: {
    title: 'Variabilität der Baugrundverhältnisse / Geologischer Kontext',
    labels: { LOW: 'Geringe kartierte Variabilität', MODERATE: 'Mittlere kartierte Variabilität', HIGH: 'Hohe kartierte Variabilität', INSUFFICIENT_EVIDENCE: 'Unzureichende Evidenz' },
    mappedUniform: 'Die geprüften Kartenstichproben stimmen mit einer dominierenden Baugrundeinheit im beprobten Umfeld überein.',
    transition: 'In Standort-, Flurstücks- oder Umgebungsstichproben wurden unterschiedliche kartierte Einheiten erfasst; dies weist auf einen möglichen Übergangsbereich hin.',
    insufficient: 'Die verfügbaren Kartenstichproben reichen nicht aus, um die räumliche Baugrundvariabilität zu charakterisieren.',
    materials: 'Hinweise aus dem kartierten Kontext',
    mappedUnits: 'Beobachtete kartierte Einheiten',
    samples: 'verwertbare Kartenstichproben',
    soilStable: 'Die Mehrpunktabfrage von SoilGrids zeigte keine Änderung der geprüften Oberboden-Modellwerte.',
    soilVariable: 'Die Mehrpunktabfrage von SoilGrids zeigt Unterschiede in den geprüften Oberboden-Modellwerten.',
    soilUnavailable: 'Ein Mehrpunkt-Kontext aus SoilGrids ist nicht verfügbar.',
    investigateTransition: 'Untersuchungsschwerpunkt: den kartierten Übergang prüfen und feststellen, welche Materialien tatsächlich unter dem Standort vorkommen, einschließlich Mächtigkeits- und Zustandsänderungen.',
    investigateOrganic: 'Untersuchungsschwerpunkt: gezielt auf weiche/organische oder alluviale Ablagerungen und deren seitliche Veränderlichkeit prüfen; benachbarte Kartierungen dürfen nicht auf den Standort übertragen werden.',
    investigateGeneral: 'Untersuchungsschwerpunkt: Material, Entstehung, Zustand und Grundwasser durch standortbezogene Untersuchungen bestätigen, bevor ingenieurtechnische Entscheidungen getroffen werden.',
    limitation: 'Kartierter und modellierter Kontext dient nur der Vorprüfung. Nahegelegene Nachweise belegen keine Schichten, Mächtigkeiten, Grundwasserverhältnisse, Lagerungszustände oder technischen Kennwerte am Standort; Stichproben definieren keine exakte geologische Grenze.'
  },
  pl: {
    title: 'Zmienność warunków gruntowych / Kontekst geologiczny',
    labels: { LOW: 'Niska zmienność kartowana', MODERATE: 'Umiarkowana zmienność kartowana', HIGH: 'Wysoka zmienność kartowana', INSUFFICIENT_EVIDENCE: 'Niewystarczające dane' },
    mappedUniform: 'Przeanalizowane próbki mapowe są zgodne z jedną dominującą jednostką gruntową w badanym otoczeniu.',
    transition: 'W próbkach dla lokalizacji, działki lub otoczenia uzyskano różne kartowane jednostki, co wskazuje na możliwą strefę przejściową.',
    insufficient: 'Dostępne próbki mapowe są niewystarczające do scharakteryzowania przestrzennej zmienności warunków gruntowych.',
    materials: 'Wskaźniki z kontekstu kartowanego',
    mappedUnits: 'Zaobserwowane jednostki kartowane',
    samples: 'użyteczne próbki mapowe',
    soilStable: 'Wielopunktowe próbkowanie SoilGrids nie wykazało zmiany w analizowanych modelowanych wartościach warstwy powierzchniowej.',
    soilVariable: 'Wielopunktowe próbkowanie SoilGrids wskazuje zmienność analizowanych modelowanych wartości warstwy powierzchniowej.',
    soilUnavailable: 'Wielopunktowy kontekst SoilGrids jest niedostępny.',
    investigateTransition: 'Co sprawdzić: zbadać kartowaną strefę przejściową i potwierdzić, jakie grunty rzeczywiście występują pod lokalizacją, w tym zmiany miąższości i stanu.',
    investigateOrganic: 'Co sprawdzić: ukierunkować badania na grunty słabe/organiczne lub aluwialne i ich zmienność boczną; nie zakładać, że osady zmapowane w sąsiedztwie występują pod działką.',
    investigateGeneral: 'Co sprawdzić: potwierdzić materiał, genezę, stan i warunki wodne badaniami dla konkretnej lokalizacji przed decyzjami inżynierskimi.',
    limitation: 'Kontekst kartowany i modelowany służy wyłącznie analizie wstępnej. Dane z sąsiedztwa nie potwierdzają profilu, miąższości, warunków wodnych, stanu ani parametrów inżynierskich pod lokalizacją, a rzadkie próbki nie wyznaczają dokładnego przebiegu granicy geologicznej.'
  }
} satisfies Record<ReportLanguage, { title: string; labels: Record<GroundVariabilityClass, string>; mappedUniform: string; transition: string; insufficient: string; materials: string; mappedUnits: string; samples: string; soilStable: string; soilVariable: string; soilUnavailable: string; investigateTransition: string; investigateOrganic: string; investigateGeneral: string; limitation: string }>;

const materialLabels: Record<ReportLanguage, Record<MappedMaterialIndicator, string>> = {
  en: { ALLUVIAL: 'alluvial deposits', ORGANIC_OR_PEAT: 'organic / peat deposits', MADE_GROUND: 'made ground', GLACIOFLUVIAL: 'glaciofluvial deposits', TILL: 'till', COHESIVE: 'cohesive material', GRANULAR: 'granular material', OTHER: 'other mapped material' },
  de: { ALLUVIAL: 'alluviale Ablagerungen', ORGANIC_OR_PEAT: 'organische / Torfablagerungen', MADE_GROUND: 'Auffüllungen', GLACIOFLUVIAL: 'glazifluviale Ablagerungen', TILL: 'Geschiebemergel / Till', COHESIVE: 'bindiges Material', GRANULAR: 'körniges Material', OTHER: 'sonstiges kartiertes Material' },
  pl: { ALLUVIAL: 'osady aluwialne', ORGANIC_OR_PEAT: 'osady organiczne / torfy', MADE_GROUND: 'nasypy', GLACIOFLUVIAL: 'osady wodnolodowcowe', TILL: 'gliny zwałowe / till', COHESIVE: 'grunty spoiste', GRANULAR: 'grunty niespoiste', OTHER: 'inne kartowane utwory' }
};

const contextRecordIds = new Set(['pgi-mgsp-building-ground-site', 'pgi-smgp-documentation-points-context', 'pgi-cbdg-research-points-context']);
const siteContextCopy = {
  en: {
    buildingCategory: 'MGśP building-ground conditions', documentationCategory: 'SMGP documentation points', researchCategory: 'CBDG research points',
    building: (descriptor: string | null) => descriptor ? `MGśP mapped building-ground context: ${descriptor}.` : 'MGśP returned mapped building-ground context at the site coordinate.',
    documentation: (count: number, descriptors: string[]) => `SMGP documentation points: ${count} contextual observation${count === 1 ? '' : 's'} returned${descriptors.length ? ` (${descriptors.join('; ')})` : ''}.`,
    research: (count: number, descriptors: string[]) => `CBDG research points: ${count} contextual observation${count === 1 ? '' : 's'} returned${descriptors.length ? ` (${descriptors.join('; ')})` : ''}.`,
    boundary: 'Mapped building-ground information and documentation/research points are preliminary context only; conditions beneath the parcel require site investigation and review of the original source records.',
    spatial: 'Mapped site or deterministic site/parcel/vicinity context; no unsampled feature distance is inferred.',
    method: 'Official PGI-PIB WMS evidence successfully returned and retained with source scope.'
  },
  de: {
    buildingCategory: 'MGśP-Baugrundbedingungen', documentationCategory: 'SMGP-Dokumentationspunkte', researchCategory: 'CBDG-Untersuchungspunkte',
    building: (descriptor: string | null) => descriptor ? `Kartierter MGśP-Baugrundkontext: ${descriptor}.` : 'MGśP lieferte kartierten Baugrundkontext am Standortkoordinatenpunkt.',
    documentation: (count: number, descriptors: string[]) => `SMGP-Dokumentationspunkte: ${count} kontextuelle Beobachtung${count === 1 ? '' : 'en'} zurückgegeben${descriptors.length ? ` (${descriptors.join('; ')})` : ''}.`,
    research: (count: number, descriptors: string[]) => `CBDG-Untersuchungspunkte: ${count} kontextuelle Beobachtung${count === 1 ? '' : 'en'} zurückgegeben${descriptors.length ? ` (${descriptors.join('; ')})` : ''}.`,
    boundary: 'Kartierte Baugrundangaben sowie Dokumentations- und Untersuchungspunkte sind nur Vorprüfungskontext; die Verhältnisse unter dem Flurstück müssen durch Standortuntersuchungen und Prüfung der Originalunterlagen bestätigt werden.',
    spatial: 'Kartierter Standort- oder deterministischer Standort-/Flurstücks-/Umgebungskontext; keine nicht gemessene Objektdistanz wird abgeleitet.',
    method: 'Amtliche PGI-PIB-WMS-Evidenz wurde erfolgreich zurückgegeben und mit ihrem räumlichen Bezug beibehalten.'
  },
  pl: {
    buildingCategory: 'Warunki podłoża budowlanego (MGśP)', documentationCategory: 'Punkty dokumentacyjne SMGP', researchCategory: 'Punkty badawcze CBDG',
    building: (descriptor: string | null) => descriptor ? `Kartowany kontekst warunków podłoża MGśP: ${descriptor}.` : 'MGśP zwróciła kartowany kontekst warunków podłoża dla współrzędnych lokalizacji.',
    documentation: (count: number, descriptors: string[]) => `Punkty dokumentacyjne SMGP: zwrócono ${count} kontekstowe obserwacje${descriptors.length ? ` (${descriptors.join('; ')})` : ''}.`,
    research: (count: number, descriptors: string[]) => `Punkty badawcze CBDG: zwrócono ${count} kontekstowe obserwacje${descriptors.length ? ` (${descriptors.join('; ')})` : ''}.`,
    boundary: 'Dane kartowane oraz punkty dokumentacyjne i badawcze są kontekstem analizy wstępnej; warunki pod działką potwierdzają dopiero badania terenowe i dokumentacja źródłowa.',
    spatial: 'Kartowany kontekst lokalizacji lub deterministyczne próbki lokalizacji/działki/otoczenia; nie wyznacza się niezmierzonej odległości do obiektu.',
    method: 'Urzędowe dane WMS PIG-PIB zostały zwrócone prawidłowo i zachowano ich zakres przestrzenny.'
  }
} satisfies Record<ReportLanguage, {
  buildingCategory: string; documentationCategory: string; researchCategory: string;
  building: (descriptor: string | null) => string; documentation: (count: number, descriptors: string[]) => string; research: (count: number, descriptors: string[]) => string;
  boundary: string; spatial: string; method: string;
}>;

function siteContextRecordPresentation(record: CanonicalReport['evidenceRecords'][number], language: ReportLanguage) {
  if (!contextRecordIds.has(record.id) || record.status !== 'VERIFIED') return null;
  const c = siteContextCopy[language];
  const raw = (record.value || {}) as { descriptor?: unknown; observationCount?: unknown; observations?: Array<{ descriptor?: unknown }> };
  const descriptor = typeof raw.descriptor === 'string' && raw.descriptor.trim() ? raw.descriptor.trim() : null;
  const count = Number.isFinite(Number(raw.observationCount)) ? Number(raw.observationCount) : 0;
  const descriptors = Array.isArray(raw.observations)
    ? [...new Set(raw.observations.map(item => typeof item?.descriptor === 'string' ? item.descriptor.trim() : '').filter(Boolean))].slice(0, 3)
    : [];
  if (record.id === 'pgi-mgsp-building-ground-site') return { category: c.buildingCategory, claim: c.building(descriptor) };
  if (record.id === 'pgi-smgp-documentation-points-context') return { category: c.documentationCategory, claim: c.documentation(count, descriptors) };
  return { category: c.researchCategory, claim: c.research(count, descriptors) };
}

/** Renders reader-facing prose from canonical evidence without mutating scientific facts. */
export function renderLocalizedReport(canonical: CanonicalReport, requestedLanguage: string) {
  const language = normalizeReportLanguage(requestedLanguage);
  const t = copy[language];
  const unavailable = t.unavailable as string;
  const countryNames: Record<ReportLanguage, Record<string, string>> = { en: { PL: 'Poland', GB: 'United Kingdom', DE: 'Germany' }, de: { PL: 'Polen', GB: 'Vereinigtes Königreich', DE: 'Deutschland' }, pl: { PL: 'Polska', GB: 'Wielka Brytania', DE: 'Niemcy' } };
  const countryName = countryNames[language][canonical.countryCode] || canonical.countryName;
  const supportLabel = getCountrySupportLabel(canonical.countryCode, language);
  const supportNotice = getCountrySupportNotice(canonical.countryCode, language);
  const geologyUnit = value(canonical.geology.unitName, unavailable);
  const terrainText = canonical.terrain.elevationM === null ? t.terrainMissing as string : interpolate(t.terrain as string, { elevation: canonical.terrain.elevationM, slope: value(canonical.terrain.slopeDegrees, unavailable) });
  const soilText = interpolate(t.soil as string, { texture: canonical.soil.texture || localizeAvailabilityReason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED', language), bearing: canonical.soil.bearingCapacity || localizeAvailabilityReason('INSUFFICIENT_EVIDENCE', language) });
  const geologyText = canonical.geology.unitName ? interpolate(t.geology as string, { source: canonical.geology.sourceName, unit: canonical.geology.unitName }) : t.geologyMissing as string;
  const resolvedInterpretation = canonical.countryCode === 'GB' ? resolveGeologicalInterpretation(canonical.geology) : null;
  const interpretation = resolvedInterpretation ? renderGeologicalInterpretation(resolvedInterpretation, language) : null;
  const geologyDetail = interpretation ? `${geologyText} ${interpretation.summary} ${interpretation.disclaimer}` : geologyText;
  const geologySource = interpretation ? `${canonical.geology.sourceName}; ${interpretation.source.title} (${interpretation.source.publicationId}) — ${interpretation.source.url}` : canonical.geology.sourceName;
  const successfulSiteContext = canonical.evidenceRecords.map(record => ({ record, presentation: siteContextRecordPresentation(record, language) })).filter(item => item.presentation !== null);
  const hasSuccessfulSiteContext = successfulSiteContext.length > 0;
  const polishOrientation = canonical.countryCode === 'PL'
    ? renderIndicativeGroundOrientation(resolveIndicativeGroundOrientation({ geology: canonical.geology, texture: canonical.soil.texture }), language)
    : null;
  const orientationHeading = language === 'pl' ? 'Orientacyjna ocena geotechniczna' : language === 'de' ? 'Orientierende geotechnische Einschätzung' : 'Indicative geotechnical orientation';
  const orientationFocus = language === 'pl' ? 'Co sprawdzić' : language === 'de' ? 'Zu prüfen' : 'What to investigate';
  const groundDetailBase = polishOrientation
    ? `${canonical.soil.reasonCode && !hasSuccessfulSiteContext ? t.sourceUnavailable as string : t.authoritative as string} ${orientationHeading}: ${polishOrientation.label}. ${polishOrientation.summary} ${orientationFocus}: ${polishOrientation.investigationFocus} ${polishOrientation.disclaimer}`
    : canonical.soil.reasonCode && !hasSuccessfulSiteContext ? t.sourceUnavailable as string : t.authoritative as string;

  const gc = canonical.groundContext;
  const gcText = groundContextCopy[language];
  const mapped = gc?.mapped || null;
  const soilVariability = gc?.soilVariability || null;
  const variabilityCode: GroundVariabilityClass = mapped?.variabilityClass || (soilVariability && soilVariability.validSampleCount >= 2 ? (soilVariability.variationObserved ? 'MODERATE' : 'LOW') : 'INSUFFICIENT_EVIDENCE');
  const importantOrganic = Boolean(mapped?.materialIndicators.some(indicator => indicator === 'ORGANIC_OR_PEAT' || indicator === 'ALLUVIAL' || indicator === 'MADE_GROUND'));
  const contextSummary = mapped?.sampleCount
    ? mapped.transitionIndicated ? gcText.transition : gcText.mappedUniform
    : gcText.insufficient;
  const investigationFocus = importantOrganic ? gcText.investigateOrganic : mapped?.transitionIndicated ? gcText.investigateTransition : gcText.investigateGeneral;
  const soilVariabilityText = soilVariability?.validSampleCount
    ? soilVariability.variationObserved ? gcText.soilVariable : gcText.soilStable
    : gcText.soilUnavailable;
  const groundContext = {
    title: gcText.title,
    evidence_level: gc?.status || 'REQUIRES_VERIFICATION',
    variability_code: variabilityCode,
    variability_label: gcText.labels[variabilityCode],
    summary: contextSummary,
    mapped_units_label: gcText.mappedUnits,
    mapped_units: mapped?.distinctMappedUnits || [],
    material_indicators_label: gcText.materials,
    material_indicators: (mapped?.materialIndicators || []).map(indicator => materialLabels[language][indicator]),
    transition_indicated: mapped?.transitionIndicated || false,
    sample_label: gcText.samples,
    sample_count: mapped?.sampleCount || 0,
    site_sample_count: mapped?.siteSampleCount || 0,
    parcel_sample_count: mapped?.parcelSampleCount || 0,
    vicinity_sample_count: mapped?.vicinitySampleCount || 0,
    soil_model_summary: soilVariabilityText,
    soil_model_sample_count: soilVariability?.validSampleCount || 0,
    soil_sand_range: soilVariability?.topsoilSandPctRange || null,
    soil_silt_range: soilVariability?.topsoilSiltPctRange || null,
    soil_clay_range: soilVariability?.topsoilClayPctRange || null,
    investigation_focus: investigationFocus,
    limitation: gcText.limitation,
    source_name: mapped?.sourceName || soilVariability?.sourceName || null,
    source_scale: mapped?.sourceScale || soilVariability?.sourceResolution || null,
    terrain_min_elevation_m: canonical.terrain.minElevationM ?? null,
    terrain_max_elevation_m: canonical.terrain.maxElevationM ?? null,
    terrain_local_relief_m: canonical.terrain.localReliefM ?? null
  };
  const siteContextNarrative = successfulSiteContext.map(item => item.presentation!.claim);
  const groundDetailCore = gc ? `${groundDetailBase} ${contextSummary} ${investigationFocus}` : groundDetailBase;
  const groundDetail = `${groundDetailCore}${siteContextNarrative.length ? ` ${siteContextNarrative.join(' ')} ${siteContextCopy[language].boundary}` : ''}`.trim();
  const floodText = canonical.flood.classification ? interpolate(t.flood as string, { risk: risk(canonical.flood.classification, language) }) : localizeAvailabilityReason(canonical.flood.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED', language);
  const hazardText = hazardCopy[language];
  const roadText = interpolate(t.road as string, { road: value(canonical.infrastructure.roadName || canonical.infrastructure.roadType, unavailable), distance: value(canonical.infrastructure.distanceM, unavailable) });
  const environmentText = canonical.environment.protectedAreaName ? interpolate(t.environment as string, { area: canonical.environment.protectedAreaName }) : t.environmentClear as string;
  const valuationAvailable = canonical.valuation.min !== null && canonical.valuation.max !== null;
  const valuationText = valuationAvailable
    ? interpolate(t.valuation as string, { min: canonical.valuation.min!.toLocaleString(language), max: canonical.valuation.max!.toLocaleString(language), currency: canonical.valuation.currency })
    : localizeAvailabilityReason(canonical.valuation.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED', language);
  const section = (summary: string, detail: string, status: string, source?: string, limitation?: string): Section => ({ summary, detail, evidence_level: status, source_cited: source, limitation_notice: limitation });
  const unavailableNotice = (reason?: AvailabilityReason) => reason ? localizeAvailabilityReason(reason, language) : undefined;
  const localizedCategory = language === 'pl' ? 'Dowody naukowe' : language === 'de' ? 'Wissenschaftliche Evidenz' : 'Scientific evidence';
  const supportCategory = language === 'pl' ? 'Zakres obsługi kraju' : language === 'de' ? 'Länderabdeckung' : 'Country coverage';
  const evidenceRegistry = canonical.evidenceRecords.flatMap(record => {
    const reason = (record.value as { reasonCode?: AvailabilityReason } | null)?.reasonCode;
    const isSupportRecord = record.id.startsWith('country-support-');
    const contextPresentation = siteContextRecordPresentation(record, language);
    if (contextRecordIds.has(record.id) && !contextPresentation) return [];
    if (contextPresentation) return [{
      ...record,
      category: contextPresentation.category,
      claim: contextPresentation.claim,
      spatialRelationship: siteContextCopy[language].spatial,
      calculationMethod: siteContextCopy[language].method,
      confidence: language === 'pl' ? ({ High: 'Wysoka', Medium: 'Średnia', Low: 'Niska' }[record.confidence] || record.confidence) : language === 'de' ? ({ High: 'Hoch', Medium: 'Mittel', Low: 'Niedrig' }[record.confidence] || record.confidence) : record.confidence,
      limitation: siteContextCopy[language].boundary
    }];
    return [{
      ...record,
      category: isSupportRecord ? supportCategory : localizedCategory,
      claim: isSupportRecord ? localizeAvailabilityReason('NOT_SUPPORTED_FOR_COUNTRY', language) : interpolate(t.claim as string, { category: localizedCategory }),
      spatialRelationship: isSupportRecord ? supportNotice : t.spatial as string,
      calculationMethod: isSupportRecord ? supportLabel : t.method as string,
      confidence: language === 'pl' ? ({ High: 'Wysoka', Medium: 'Średnia', Low: 'Niska' }[record.confidence] || record.confidence) : language === 'de' ? ({ High: 'Hoch', Medium: 'Mittel', Low: 'Niedrig' }[record.confidence] || record.confidence) : record.confidence,
      limitation: record.status === 'REQUIRES_VERIFICATION' ? localizeAvailabilityReason(reason || 'AUTHORITATIVE_DATA_REQUIRED', language) : t.authoritative as string
    }];
  });
  const checklist = (t.checklist as string[]).map((reason, index) => ({ topic: (t.topics as string[])[index], reason, recommendedAuthorityOrExpert: index === 0 ? canonical.planning.authorityName : canonical.authorities.cadastre, priority: index === 3 ? 'Medium' : 'High' }));
  const utilityNames = {
    en: { ELECTRICITY: 'Electricity', WATER: 'Potable water', SEWER: 'Sanitary sewer', GAS: 'Natural gas', TELECOM: 'Telecommunications', OTHER: 'Utility' },
    de: { ELECTRICITY: 'Strom', WATER: 'Trinkwasser', SEWER: 'Schmutzwasserkanal', GAS: 'Erdgas', TELECOM: 'Telekommunikation', OTHER: 'Versorgung' },
    pl: { ELECTRICITY: 'Energia elektryczna', WATER: 'Woda pitna', SEWER: 'Kanalizacja sanitarna', GAS: 'Gaz ziemny', TELECOM: 'Telekomunikacja', OTHER: 'Sieć uzbrojenia' }
  } as const;
  const utilityAvailable = {
    en: (distance: number | null) => distance === null ? 'Mapped in the reviewed open dataset.' : `Mapped approximately ${distance} m from the site. Connection terms require operator confirmation.`,
    de: (distance: number | null) => distance === null ? 'Im geprüften offenen Datensatz kartiert.' : `Ungefähr ${distance} m vom Standort kartiert. Anschlussbedingungen müssen vom Betreiber bestätigt werden.`,
    pl: (distance: number | null) => distance === null ? 'Zmapowano w przeanalizowanym otwartym zbiorze danych.' : `Zmapowano w odległości około ${distance} m od lokalizacji. Warunki przyłączenia wymagają potwierdzenia przez operatora.`
  };
  const utilitiesChecklist = (canonical.utilities || []).map(item => ({ utility: utilityNames[language][item.utilityCode], status: item.mapped ? utilityAvailable[language](item.distanceM) : localizeAvailabilityReason(item.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED', language), evidence_level: item.status, provider_type: item.sourceName, distance_m: item.distanceM ?? undefined, mapped_in_dataset: item.mapped, limitation: item.mapped ? localizeAvailabilityReason('AUTHORITATIVE_DATA_REQUIRED', language) : localizeAvailabilityReason(item.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED', language) }));
  const statusLabels = { en: { VERIFIED: 'Verified', MODELLED: 'Modelled', REQUIRES_VERIFICATION: 'Requires verification' }, de: { VERIFIED: 'Verifiziert', MODELLED: 'Modelliert', REQUIRES_VERIFICATION: 'Prüfung erforderlich' }, pl: { VERIFIED: 'Zweryfikowane', MODELLED: 'Modelowane', REQUIRES_VERIFICATION: 'Wymaga weryfikacji' } } as const;
  const dataSources = canonical.sourceRecords.map(source => ({ name: source.name, url: source.url, authority: source.name, verification_status: statusLabels[language][source.status] }));
  const summaryCore = valuationAvailable
    ? interpolate(t.summary as string, { country: countryName, unit: geologyUnit, terrain: terrainText, soil: canonical.soil.texture || localizeAvailabilityReason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED', language), score: canonical.evidenceScore.totalScore, min: canonical.valuation.min!.toLocaleString(language), max: canonical.valuation.max!.toLocaleString(language), currency: canonical.valuation.currency })
    : interpolate(t.summaryNoValuation as string, { country: countryName, unit: geologyUnit, terrain: terrainText, soil: canonical.soil.texture || localizeAvailabilityReason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED', language), score: canonical.evidenceScore.totalScore });
  const summary = canonical.support.maturity === 'LIMITED' ? `${summaryCore} ${supportNotice}` : summaryCore;
  return {
    language,
    countrySupport: { maturity: canonical.support.maturity, label: supportLabel, notice: supportNotice, capabilities: canonical.support.capabilities },
    groundContext,
    summary,
    titles: language === 'pl' ? { estimated_value: 'Orientacyjna wartość statystyczna', confidence: 'Jakość dowodów', executive_summary: 'Podsumowanie wykonawcze' } : language === 'de' ? { estimated_value: 'Indikativer statistischer Wert', confidence: 'Evidenzqualität', executive_summary: 'Zusammenfassung' } : { estimated_value: 'Indicative statistical value', confidence: 'Evidence quality', executive_summary: 'Executive summary' },
    confidenceLabel: canonical.evidenceScore.totalScore >= 75 ? (language === 'pl' ? 'Wysoka jakość dowodów' : language === 'de' ? 'Hohe Evidenzqualität' : 'High evidence quality') : canonical.evidenceScore.totalScore >= 50 ? (language === 'pl' ? 'Umiarkowana jakość dowodów' : language === 'de' ? 'Mittlere Evidenzqualität' : 'Moderate evidence quality') : (language === 'pl' ? 'Wstępna jakość dowodów' : language === 'de' ? 'Vorläufige Evidenzqualität' : 'Preliminary evidence quality'),
    unavailableReasons: {
      geology: localizeAvailabilityReason(canonical.geology.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED', language),
      soilTexture: localizeAvailabilityReason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED', language),
      engineeringParameter: localizeAvailabilityReason('INSUFFICIENT_EVIDENCE', language),
      groundwater: localizeAvailabilityReason(canonical.support.capabilities.nationalHydrogeology ? 'AUTHORITATIVE_DATA_REQUIRED' : 'NOT_SUPPORTED_FOR_COUNTRY', language),
      planning: localizeAvailabilityReason(canonical.planning.reasonCode, language),
      valuation: localizeAvailabilityReason(canonical.valuation.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED', language),
      sourceUnavailable: localizeAvailabilityReason('SOURCE_UNAVAILABLE', language),
      noFeature: localizeAvailabilityReason('NO_DATA', language)
    },
    sections: {
      soil_and_ground: section(soilText, groundDetail, canonical.soil.status, canonical.soil.sourceName, unavailableNotice(canonical.soil.reasonCode)),
      geohazard_risk: section(interpolate(t.geology as string, { source: canonical.geology.sourceName, unit: geologyUnit }), geologyDetail, canonical.geology.status, geologySource, unavailableNotice(canonical.geology.reasonCode)),
      flooding_risk: section(floodText, unavailableNotice(canonical.flood.reasonCode) || t.authoritative as string, canonical.flood.status, canonical.flood.sourceName, unavailableNotice(canonical.flood.reasonCode)),
      zoning_and_land_use: section(interpolate(t.planning as string, { instrument: canonical.planning.instrumentName }), unavailableNotice(canonical.planning.reasonCode) || t.authoritative as string, canonical.planning.status, canonical.planning.sourceName, unavailableNotice(canonical.planning.reasonCode)),
      building_regulations: section(t.authoritative as string, interpolate(t.planning as string, { instrument: canonical.planning.instrumentName }), canonical.planning.status, canonical.planning.authorityName, unavailableNotice(canonical.planning.reasonCode)),
      environmental_factors: section(environmentText, canonical.environment.reasonCode ? t.sourceUnavailable as string : t.authoritative as string, canonical.environment.status, canonical.environment.sourceName, unavailableNotice(canonical.environment.reasonCode)),
      infrastructure_and_access: section(roadText, canonical.infrastructure.reasonCode ? t.sourceUnavailable as string : t.authoritative as string, canonical.infrastructure.status, canonical.infrastructure.sourceName, unavailableNotice(canonical.infrastructure.reasonCode)),
      market_and_comparables: section(valuationText, unavailableNotice(canonical.valuation.reasonCode) || t.authoritative as string, canonical.valuation.status, canonical.valuation.sourceName, unavailableNotice(canonical.valuation.reasonCode)),
      development_cost_outlook: section(t.authoritative as string, (t.checklist as string[]).join(' '), 'REQUIRES_VERIFICATION')
    },
    evidenceRegistry,
    verificationChecklist: checklist,
    utilitiesChecklist,
    dataSources,
    legalDisclaimers: canonical.support.maturity === 'LIMITED' ? [supportNotice, ...(t.disclaimers as string[])] : t.disclaimers as string[],
    valuationMethodology: valuationText,
    technicalNarrative: {
      groundwater_depth_m: unavailable,
      groundwater_notice: canonical.support.capabilities.nationalHydrogeology ? t.authoritative as string : localizeAvailabilityReason('NOT_SUPPORTED_FOR_COUNTRY', language),
      zoning_name: canonical.planning.instrumentName,
      max_far: unavailable,
      max_building_coverage_pct: unavailable,
      min_biologically_active_pct: unavailable,
      max_height_m: unavailable,
      utility_status: t.authoritative as string
    },
    riskMatrix: [
      { category: language === 'pl' ? 'Osuwiska' : language === 'de' ? 'Hangrutschung' : 'Landslide', level: canonical.hazards.landslide.classification ? risk(canonical.hazards.landslide.classification, language) : unavailable, evidence_level: canonical.hazards.landslide.status, detail: canonical.hazards.landslide.classification ? interpolate(hazardText.landslide, { risk: risk(canonical.hazards.landslide.classification, language) }) : t.sourceUnavailable as string },
      { category: language === 'pl' ? 'Sejsmika' : language === 'de' ? 'Seismik' : 'Seismic', level: localizedClassification(canonical.hazards.seismic.classification, language, unavailable), evidence_level: canonical.hazards.seismic.status, detail: interpolate(hazardText.seismic, { value: localizedClassification(canonical.hazards.seismic.pga, language, unavailable) }) },
      { category: 'Radon', level: localizedClassification(canonical.hazards.radon.classification, language, unavailable), evidence_level: canonical.hazards.radon.status, detail: canonical.hazards.radon.classification ? interpolate(hazardText.radon, { value: localizedClassification(canonical.hazards.radon.classification, language, unavailable) }) : unavailableNotice(canonical.hazards.radon.reasonCode) },
      { category: language === 'pl' ? 'Szkody górnicze' : language === 'de' ? 'Bergbausenkung' : 'Mining subsidence', level: localizedClassification(canonical.hazards.mining.classification, language, unavailable), evidence_level: canonical.hazards.mining.status, detail: canonical.hazards.mining.classification ? interpolate(hazardText.mining, { value: localizedClassification(canonical.hazards.mining.classification, language, unavailable) }) : unavailableNotice(canonical.hazards.mining.reasonCode) }
    ],
    keyRisks: (t.checklist as string[]).slice(0, 3),
    opportunities: language === 'pl' ? ['Kanoniczny model zachowuje pochodzenie i status dowodów.', 'Dane terenowe, glebowe i źródłowe są prezentowane we wspólnym widoku.'] : language === 'de' ? ['Das kanonische Modell bewahrt Herkunft und Status der Evidenz.', 'Gelände-, Boden- und Quelldaten werden gemeinsam dargestellt.'] : ['The canonical model preserves evidence provenance and status.', 'Terrain, soil and source evidence are presented in one view.']
  };
}
