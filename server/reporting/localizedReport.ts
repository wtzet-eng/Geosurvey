import { CanonicalReport, ReportLanguage, RiskClassification, normalizeReportLanguage } from './canonicalReport';

type Section = { summary: string; detail: string; evidence_level: string; source_cited?: string; limitation_notice?: string };

const copy = {
  en: { unavailable: 'not available', requires: 'Requires verification', sourceUnavailable: 'The required source data was unavailable. No scientific value was inferred.', authoritative: 'Binding information requires confirmation by the competent authority.', geology: 'According to {source}, the site geological unit is {unit}.', geologyMissing: 'A geological unit is not available from the reviewed sources.', terrain: 'Modelled terrain: elevation {elevation} m and slope {slope}°.', terrainMissing: 'Terrain measurements are not available.', flood: 'Flood screening classification: {risk}.', soil: 'Soil model texture: {texture}; bearing capacity: {bearing}.', planning: 'Planning parameters require confirmation under {instrument}.', road: 'Nearest mapped road: {road}, approximately {distance} m away.', environment: 'Environmental screening identified {area}.', environmentClear: 'No protected-area feature was mapped in the reviewed query area.', valuation: 'Indicative statistical value: {min}–{max} {currency}.', summary: 'This evidence-led assessment covers {country}. Geological unit: {unit}. Terrain: {terrain}. Soil: {soil}. Evidence score: {score}/100. The statistical valuation is {min}–{max} {currency}.', limitation: 'Known limitation', claim: 'Evidence record for {category}.', spatial: 'Spatial relationship recorded for the selected site.', method: 'Source-specific ingestion and normalization into the canonical evidence model.', checklist: ['Obtain the official planning certificate.', 'Commission a Eurocode 7 geotechnical site investigation.', 'Commission a certified topographical survey.', 'Obtain formal utility connection terms.', 'Verify title, boundaries, easements and encumbrances.'], topics: ['Official planning confirmation', 'Geotechnical site investigation', 'Topographical survey', 'Utility connection terms', 'Title and cadastral verification'], disclaimers: ['This automated report is for preliminary screening and is not an official administrative certificate.', 'The valuation is an indicative statistical model and not a licensed appraisal.', 'Modelled soil evidence does not replace a Eurocode 7 site investigation.', 'Binding planning rights require official confirmation.', 'Source availability and limitations must be reviewed before an investment decision.'] },
  de: { unavailable: 'nicht verfügbar', requires: 'Prüfung erforderlich', sourceUnavailable: 'Die erforderlichen Quelldaten waren nicht verfügbar. Es wurde kein wissenschaftlicher Wert abgeleitet.', authoritative: 'Verbindliche Angaben erfordern die Bestätigung durch die zuständige Behörde.', geology: 'Nach Angaben von {source} liegt der Standort im Bereich der geologischen Einheit {unit}.', geologyMissing: 'Eine geologische Einheit ist in den geprüften Quellen nicht verfügbar.', terrain: 'Modelliertes Gelände: Höhe {elevation} m und Neigung {slope}°.', terrainMissing: 'Geländemesswerte sind nicht verfügbar.', flood: 'Klassifizierung der Hochwasservorprüfung: {risk}.', soil: 'Bodenmodell: Textur {texture}; Tragfähigkeit: {bearing}.', planning: 'Planungsparameter müssen nach {instrument} bestätigt werden.', road: 'Nächste kartierte Straße: {road}, ungefähr {distance} m entfernt.', environment: 'Die Umweltprüfung identifizierte {area}.', environmentClear: 'Im geprüften Abfragegebiet wurde kein Schutzgebietsobjekt kartiert.', valuation: 'Indikativer statistischer Wert: {min}–{max} {currency}.', summary: 'Diese evidenzbasierte Standortbewertung betrifft {country}. Geologische Einheit: {unit}. Gelände: {terrain}. Boden: {soil}. Evidenzwert: {score}/100. Der statistische Richtwert beträgt {min}–{max} {currency}.', limitation: 'Bekannte Einschränkung', claim: 'Evidenznachweis für {category}.', spatial: 'Räumlicher Bezug für den ausgewählten Standort dokumentiert.', method: 'Quellenspezifische Erfassung und Normalisierung in das kanonische Evidenzmodell.', checklist: ['Amtlichen Planungsnachweis einholen.', 'Baugrunduntersuchung nach Eurocode 7 beauftragen.', 'Amtliche topografische Vermessung beauftragen.', 'Formelle Anschlussbedingungen der Versorger einholen.', 'Eigentum, Grenzen, Dienstbarkeiten und Belastungen prüfen.'], topics: ['Amtliche Planungsbestätigung', 'Baugrunduntersuchung', 'Topografische Vermessung', 'Versorgungsanschlüsse', 'Grundbuch- und Katasterprüfung'], disclaimers: ['Dieser automatisierte Bericht dient nur der Vorprüfung und ist keine amtliche Bescheinigung.', 'Die Bewertung ist ein statistischer Richtwert und kein Verkehrswertgutachten.', 'Modellierte Bodendaten ersetzen keine Baugrunduntersuchung nach Eurocode 7.', 'Verbindliches Planungsrecht erfordert eine amtliche Bestätigung.', 'Quellenverfügbarkeit und Einschränkungen sind vor einer Investitionsentscheidung zu prüfen.'] },
  pl: { unavailable: 'brak danych', requires: 'Wymaga weryfikacji', sourceUnavailable: 'Wymagane dane źródłowe były niedostępne. Nie wyprowadzono wartości naukowej.', authoritative: 'Wiążące informacje wymagają potwierdzenia przez właściwy organ.', geology: 'Według danych {source} lokalizacja znajduje się w obrębie jednostki geologicznej {unit}.', geologyMissing: 'Jednostka geologiczna nie jest dostępna w przeanalizowanych źródłach.', terrain: 'Model terenu: wysokość {elevation} m i nachylenie {slope}°.', terrainMissing: 'Pomiary terenu są niedostępne.', flood: 'Klasyfikacja wstępnej oceny powodziowej: {risk}.', soil: 'Model gleby: tekstura {texture}; nośność: {bearing}.', planning: 'Parametry planistyczne wymagają potwierdzenia na podstawie {instrument}.', road: 'Najbliższa zmapowana droga: {road}, w odległości około {distance} m.', environment: 'Analiza środowiskowa wykazała {area}.', environmentClear: 'W analizowanym obszarze zapytania nie zmapowano obiektu chronionego.', valuation: 'Orientacyjna wartość statystyczna: {min}–{max} {currency}.', summary: 'Niniejsza oparta na dowodach ocena dotyczy lokalizacji w {country}. Jednostka geologiczna: {unit}. Teren: {terrain}. Gleba: {soil}. Wynik jakości dowodów: {score}/100. Statystyczny przedział wartości wynosi {min}–{max} {currency}.', limitation: 'Znane ograniczenie', claim: 'Rekord dowodowy dla kategorii {category}.', spatial: 'Zarejestrowano relację przestrzenną dla wybranej lokalizacji.', method: 'Pozyskanie ze źródła i normalizacja do kanonicznego modelu dowodowego.', checklist: ['Uzyskać urzędowy dokument planistyczny.', 'Zlecić badania geotechniczne zgodne z Eurokodem 7.', 'Zlecić uprawnioną mapę do celów projektowych.', 'Uzyskać formalne warunki przyłączenia mediów.', 'Zweryfikować tytuł prawny, granice, służebności i obciążenia.'], topics: ['Urzędowe potwierdzenie planistyczne', 'Badania geotechniczne', 'Mapa do celów projektowych', 'Warunki przyłączenia mediów', 'Weryfikacja księgi wieczystej i katastru'], disclaimers: ['Ten automatyczny raport służy wyłącznie analizie wstępnej i nie jest dokumentem urzędowym.', 'Wycena jest orientacyjnym modelem statystycznym, a nie operatem szacunkowym.', 'Modelowane dane glebowe nie zastępują badań geotechnicznych zgodnych z Eurokodem 7.', 'Wiążące prawa zabudowy wymagają urzędowego potwierdzenia.', 'Przed decyzją inwestycyjną należy sprawdzić dostępność i ograniczenia źródeł.'] }
} satisfies Record<ReportLanguage, Record<string, string | string[]>>;

const interpolate = (template: string, values: Record<string, unknown>) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
const value = (input: unknown, unavailable: string) => input === null || input === undefined || input === '' ? unavailable : String(input);
const risk = (classification: RiskClassification, language: ReportLanguage) => {
  const labels = { en: { NEGLIGIBLE: 'negligible', LOW: 'low', MODERATE: 'moderate', HIGH: 'high' }, de: { NEGLIGIBLE: 'vernachlässigbar', LOW: 'gering', MODERATE: 'mäßig', HIGH: 'hoch' }, pl: { NEGLIGIBLE: 'pomijalne', LOW: 'niskie', MODERATE: 'umiarkowane', HIGH: 'wysokie' } };
  return classification ? labels[language][classification] : copy[language].unavailable as string;
};

/** Renders reader-facing prose from canonical evidence without mutating scientific facts. */
export function renderLocalizedReport(canonical: CanonicalReport, requestedLanguage: string) {
  const language = normalizeReportLanguage(requestedLanguage);
  const t = copy[language];
  const unavailable = t.unavailable as string;
  const countryNames: Record<ReportLanguage, Record<string, string>> = { en: { PL: 'Poland', GB: 'United Kingdom', DE: 'Germany' }, de: { PL: 'Polen', GB: 'Vereinigtes Königreich', DE: 'Deutschland' }, pl: { PL: 'Polska', GB: 'Wielka Brytania', DE: 'Niemcy' } };
  const countryName = countryNames[language][canonical.countryCode] || canonical.countryName;
  const geologyUnit = value(canonical.geology.unitName, unavailable);
  const terrainText = canonical.terrain.elevationM === null ? t.terrainMissing as string : interpolate(t.terrain as string, { elevation: canonical.terrain.elevationM, slope: value(canonical.terrain.slopeDegrees, unavailable) });
  const soilText = interpolate(t.soil as string, { texture: value(canonical.soil.texture, unavailable), bearing: value(canonical.soil.bearingCapacity, unavailable) });
  const geologyText = canonical.geology.unitName ? interpolate(t.geology as string, { source: canonical.geology.sourceName, unit: canonical.geology.unitName }) : t.geologyMissing as string;
  const floodText = interpolate(t.flood as string, { risk: risk(canonical.flood.classification, language) });
  const roadText = interpolate(t.road as string, { road: value(canonical.infrastructure.roadName || canonical.infrastructure.roadType, unavailable), distance: value(canonical.infrastructure.distanceM, unavailable) });
  const environmentText = canonical.environment.protectedAreaName ? interpolate(t.environment as string, { area: canonical.environment.protectedAreaName }) : t.environmentClear as string;
  const valuationText = interpolate(t.valuation as string, { min: canonical.valuation.min.toLocaleString(language), max: canonical.valuation.max.toLocaleString(language), currency: canonical.valuation.currency });
  const section = (summary: string, detail: string, status: string, source?: string, limitation?: string): Section => ({ summary, detail, evidence_level: status, source_cited: source, limitation_notice: limitation });
  const unavailableNotice = (reason?: string) => reason ? t.sourceUnavailable as string : undefined;
  const localizedCategory = language === 'pl' ? 'Dowody naukowe' : language === 'de' ? 'Wissenschaftliche Evidenz' : 'Scientific evidence';
  const evidenceRegistry = canonical.evidenceRecords.map(record => ({
    ...record,
    category: localizedCategory,
    claim: interpolate(t.claim as string, { category: localizedCategory }),
    spatialRelationship: t.spatial as string,
    calculationMethod: t.method as string,
    limitation: record.status === 'REQUIRES_VERIFICATION' ? t.sourceUnavailable as string : t.authoritative as string
  }));
  const checklist = (t.checklist as string[]).map((reason, index) => ({ topic: (t.topics as string[])[index], reason, recommendedAuthorityOrExpert: index === 0 ? canonical.planning.authorityName : canonical.authorities.cadastre, priority: index === 3 ? 'Medium' : 'High' }));
  return {
    language,
    summary: interpolate(t.summary as string, { country: countryName, unit: geologyUnit, terrain: terrainText, soil: value(canonical.soil.texture, unavailable), score: canonical.evidenceScore.totalScore, min: canonical.valuation.min.toLocaleString(language), max: canonical.valuation.max.toLocaleString(language), currency: canonical.valuation.currency }),
    titles: language === 'pl' ? { estimated_value: 'Orientacyjna wartość statystyczna', confidence: 'Jakość dowodów', executive_summary: 'Podsumowanie wykonawcze' } : language === 'de' ? { estimated_value: 'Indikativer statistischer Wert', confidence: 'Evidenzqualität', executive_summary: 'Zusammenfassung' } : { estimated_value: 'Indicative statistical value', confidence: 'Evidence quality', executive_summary: 'Executive summary' },
    sections: {
      soil_and_ground: section(soilText, canonical.soil.reasonCode ? t.sourceUnavailable as string : t.authoritative as string, canonical.soil.status, canonical.soil.sourceName, unavailableNotice(canonical.soil.reasonCode)),
      geohazard_risk: section(interpolate(t.geology as string, { source: canonical.geology.sourceName, unit: geologyUnit }), geologyText, canonical.geology.status, canonical.geology.sourceName, unavailableNotice(canonical.geology.reasonCode)),
      flooding_risk: section(floodText, canonical.flood.reasonCode ? t.sourceUnavailable as string : t.authoritative as string, canonical.flood.status, canonical.flood.sourceName, unavailableNotice(canonical.flood.reasonCode)),
      zoning_and_land_use: section(interpolate(t.planning as string, { instrument: canonical.planning.instrumentName }), t.authoritative as string, canonical.planning.status, canonical.planning.sourceName),
      building_regulations: section(t.authoritative as string, interpolate(t.planning as string, { instrument: canonical.planning.instrumentName }), canonical.planning.status, canonical.planning.authorityName),
      environmental_factors: section(environmentText, canonical.environment.reasonCode ? t.sourceUnavailable as string : t.authoritative as string, canonical.environment.status, canonical.environment.sourceName, unavailableNotice(canonical.environment.reasonCode)),
      infrastructure_and_access: section(roadText, canonical.infrastructure.reasonCode ? t.sourceUnavailable as string : t.authoritative as string, canonical.infrastructure.status, canonical.infrastructure.sourceName, unavailableNotice(canonical.infrastructure.reasonCode)),
      market_and_comparables: section(valuationText, t.authoritative as string, canonical.valuation.status, canonical.valuation.sourceName),
      development_cost_outlook: section(t.authoritative as string, (t.checklist as string[]).join(' '), 'REQUIRES_VERIFICATION')
    },
    evidenceRegistry,
    verificationChecklist: checklist,
    legalDisclaimers: t.disclaimers as string[],
    valuationMethodology: valuationText,
    technicalNarrative: {
      groundwater_depth_m: unavailable,
      groundwater_notice: t.authoritative as string,
      zoning_name: canonical.planning.instrumentName,
      max_far: unavailable,
      max_building_coverage_pct: unavailable,
      min_biologically_active_pct: unavailable,
      max_height_m: unavailable,
      utility_status: t.authoritative as string
    },
    riskMatrix: [
      { category: language === 'pl' ? 'Osuwiska' : language === 'de' ? 'Hangrutschung' : 'Landslide', level: canonical.hazards.landslide.classification, evidence_level: canonical.hazards.landslide.status, detail: canonical.hazards.landslide.classification ? floodText : t.sourceUnavailable as string },
      { category: language === 'pl' ? 'Sejsmika' : language === 'de' ? 'Seismik' : 'Seismic', level: canonical.hazards.seismic.classification, evidence_level: canonical.hazards.seismic.status, detail: value(canonical.hazards.seismic.pga, unavailable) },
      { category: 'Radon', level: canonical.hazards.radon.classification, evidence_level: canonical.hazards.radon.status, detail: canonical.hazards.radon.classification || t.sourceUnavailable as string },
      { category: language === 'pl' ? 'Szkody górnicze' : language === 'de' ? 'Bergbausenkung' : 'Mining subsidence', level: canonical.hazards.mining.classification, evidence_level: canonical.hazards.mining.status, detail: canonical.hazards.mining.classification || t.sourceUnavailable as string }
    ],
    keyRisks: (t.checklist as string[]).slice(0, 3),
    opportunities: language === 'pl' ? ['Kanoniczny model zachowuje pochodzenie i status dowodów.', 'Dane terenowe, glebowe i źródłowe są prezentowane we wspólnym widoku.'] : language === 'de' ? ['Das kanonische Modell bewahrt Herkunft und Status der Evidenz.', 'Gelände-, Boden- und Quelldaten werden gemeinsam dargestellt.'] : ['The canonical model preserves evidence provenance and status.', 'Terrain, soil and source evidence are presented in one view.']
  };
}
