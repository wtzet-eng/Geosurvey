import React, { useEffect } from 'react';
import { ReportViewEvidenceV2 } from './ReportViewEvidenceV2';
import { SiteReport } from '../types';

interface ReportViewProps {
  report: SiteReport;
  onBack?: () => void;
}

/**
 * The analysis pipeline already receives report.language. The evidence report
 * view, however, contains presentation strings and narrative fragments that can
 * still arrive in English. Keep scientific values, dataset names, authority
 * names and URLs untouched, but localize reader-facing prose.
 */
const UI_TRANSLATIONS: Record<string, Record<string, string>> = {
  de: {
    'Back': 'Zurück', 'Drive': 'Drive', 'Embed': 'Einbetten', 'Share': 'Teilen', 'Copied': 'Kopiert', 'PDF': 'PDF',
    'Preliminary Site Assessment': 'Vorläufige Standortbewertung', 'Evidence first': 'Evidenz zuerst',
    '1. Executive Summary': '1. Zusammenfassung', 'Evidence': 'Evidenz', 'Verified': 'Verifiziert', 'Modelled': 'Modelliert', 'Needs verification': 'Prüfung erforderlich', 'Not scored': 'Nicht bewertet',
    '2. Site & Parcel': '2. Standort & Flurstück', 'Site & Parcel': 'Standort & Flurstück', 'Location': 'Standort', 'Coordinates': 'Koordinaten', 'Area': 'Fläche', 'Cadastral parcel': 'Flurstück', 'Official area': 'Amtliche Fläche', 'Elevation': 'Höhe', 'Slope': 'Neigung', 'Aspect': 'Exposition',
    '3. Geological Evidence': '3. Geologische Evidenz', 'Geological Evidence': 'Geologische Evidenz', 'Geological unit': 'Geologische Einheit', 'Lithology': 'Lithologie', 'Stratigraphic context': 'Stratigraphischer Kontext', 'Groundwater regime': 'Grundwasserverhältnisse', 'Interpretation boundary': 'Grenze der Interpretation', 'Pedological profile': 'Bodenprofil', 'Depth': 'Tiefe', 'Material / texture': 'Material / Textur', 'Mechanical interpretation': 'Mechanische Interpretation', 'Sand': 'Sand', 'Silt': 'Schluff', 'Clay': 'Ton',
    '4. Ground & Foundation Conditions': '4. Baugrund & Gründungsverhältnisse', 'Ground & Foundation Conditions': 'Baugrund & Gründungsverhältnisse', 'Soil texture': 'Bodentextur', 'Bearing capacity': 'Tragfähigkeit', 'Friction angle': 'Reibungswinkel', 'Cohesion': 'Kohäsion', 'Drainage': 'Drainage', 'Hydraulic conductivity': 'Hydraulische Leitfähigkeit', 'Bulk density': 'Trockenrohdichte',
    '5. Geohazard Screening': '5. Geogefahren-Screening', 'Geohazard Screening': 'Geogefahren-Screening', '5. Flooding & Hydrology': '5. Hochwasser & Hydrologie', 'Flooding & Hydrology': 'Hochwasser & Hydrologie', 'Groundwater depth': 'Grundwassertiefe', 'Groundwater notice': 'Hinweis zum Grundwasser', 'Geological portal': 'Geologisches Portal', 'Flood / hydrology evidence': 'Hochwasser-/Hydrologie-Evidenz',
    '6. Environment': '6. Umwelt', 'Environment': 'Umwelt', 'Surrounding land use': 'Umgebende Landnutzung', 'Source records': 'Quellennachweise',
    '7. Archaeology & Heritage': '7. Archäologie & Kulturerbe', 'Archaeology & Heritage': 'Archäologie & Kulturerbe',
    '8. Planning / Development Constraints': '8. Planungs-/Entwicklungsbeschränkungen', 'Planning / Development Constraints': 'Planungs-/Entwicklungsbeschränkungen', 'Zoning designation': 'Planungsrechtliche Ausweisung', 'Building coverage': 'Bebaute Fläche', 'Biologically active area': 'Biologisch aktive Fläche', 'Maximum height': 'Maximale Höhe', 'Setbacks': 'Abstandsflächen',
    '8. Building & Regulatory Requirements': '8. Bau- & Genehmigungsanforderungen', 'Building & Regulatory Requirements': 'Bau- & Genehmigungsanforderungen',
    '9. Development Implications': '9. Auswirkungen auf die Entwicklung', 'Development Implications': 'Auswirkungen auf die Entwicklung', 'Potential opportunities': 'Mögliche Chancen', 'Key constraints / uncertainties': 'Wesentliche Einschränkungen / Unsicherheiten',
    '9. Market & Valuation Context': '9. Markt- & Bewertungsrahmen', 'Market & Valuation Context': 'Markt- & Bewertungsrahmen', 'Indicative range': 'Orientierungsspanne', 'Median / unit': 'Median / Einheit', 'Valuation basis': 'Bewertungsgrundlage', 'Comparable evidence': 'Vergleichsnachweise',
    'Section 10': 'Abschnitt 10', 'Recommended Investigations': 'Empfohlene Untersuchungen', 'Section 11': 'Abschnitt 11', 'Evidence Register & Source Library': 'Evidenzregister & Quellenbibliothek', 'direct source links': 'direkte Quellenlinks', 'Sources returned by the analysis pipeline': 'Von der Analysepipeline zurückgegebene Quellen',
    'Important limitations and professional disclaimer': 'Wichtige Einschränkungen und fachlicher Haftungsausschluss', 'Limitation:': 'Einschränkung:', 'Professional boundary:': 'Fachliche Abgrenzung:', 'Interpretation boundary:': 'Interpretationsgrenze:',
    'Show fewer': 'Weniger anzeigen', 'Show all sources': 'Alle Quellen anzeigen', 'Open source': 'Quelle öffnen', 'Requires verification': 'Prüfung erforderlich', 'Generated': 'Erstellt',
  },
  fr: {
    'Back': 'Retour', 'Share': 'Partager', 'Copied': 'Copié', 'Preliminary Site Assessment': 'Évaluation préliminaire du site', 'Evidence first': "Les preuves d'abord", 'Executive Summary': 'Synthèse exécutive', 'Site & Parcel': 'Site & parcelle', 'Location': 'Localisation', 'Coordinates': 'Coordonnées', 'Area': 'Surface', 'Elevation': 'Altitude', 'Slope': 'Pente', 'Geological Evidence': 'Données géologiques', 'Geological unit': 'Unité géologique', 'Lithology': 'Lithologie', 'Groundwater regime': 'Régime des eaux souterraines', 'Ground & Foundation Conditions': 'Sol & conditions de fondation', 'Soil texture': 'Texture du sol', 'Bearing capacity': 'Portance', 'Geohazard Screening': 'Dépistage des géorisques', 'Flooding & Hydrology': 'Inondation & hydrologie', 'Environment': 'Environnement', 'Archaeology & Heritage': 'Archéologie & patrimoine', 'Planning / Development Constraints': 'Contraintes d’aménagement', 'Building & Regulatory Requirements': 'Exigences de construction et réglementaires', 'Development Implications': 'Implications pour le développement', 'Market & Valuation Context': 'Marché & contexte de valorisation', 'Recommended Investigations': 'Investigations recommandées', 'Evidence Register & Source Library': 'Registre des preuves & bibliothèque des sources', 'Important limitations and professional disclaimer': 'Limites importantes et avertissement professionnel', 'Open source': 'Ouvrir la source', 'Requires verification': 'Vérification requise', 'Verified': 'Vérifié', 'Modelled': 'Modélisé'
  },
  pl: {
    'Back': 'Wstecz', 'Drive': 'Dysk', 'Embed': 'Osadź', 'Share': 'Udostępnij', 'Copied': 'Skopiowano', 'PDF': 'PDF',
    'Preliminary Site Assessment': 'Wstępna ocena lokalizacji', 'Evidence first': 'Najpierw dowody',
    '1. Executive Summary': '1. Podsumowanie', 'Evidence': 'Dowody', 'Verified': 'Zweryfikowane', 'Modelled': 'Modelowane', 'Needs verification': 'Wymaga weryfikacji', 'Not scored': 'Brak oceny',
    '2. Site & Parcel': '2. Lokalizacja i działka', 'Site & Parcel': 'Lokalizacja i działka', 'Location': 'Lokalizacja', 'Coordinates': 'Współrzędne', 'Area': 'Powierzchnia', 'Cadastral parcel': 'Działka ewidencyjna', 'Official area': 'Powierzchnia urzędowa', 'Elevation': 'Wysokość', 'Slope': 'Nachylenie', 'Aspect': 'Ekspozycja',
    '3. Geological Evidence': '3. Dane geologiczne', 'Geological Evidence': 'Dane geologiczne', 'Geological unit': 'Jednostka geologiczna', 'Lithology': 'Litologia', 'Stratigraphic context': 'Kontekst stratygraficzny', 'Groundwater regime': 'Warunki wodonośne', 'Interpretation boundary': 'Granica interpretacji', 'Pedological profile': 'Profil glebowy', 'Depth': 'Głębokość', 'Material / texture': 'Materiał / tekstura', 'Mechanical interpretation': 'Interpretacja mechaniczna', 'Sand': 'Piasek', 'Silt': 'Pył', 'Clay': 'Ił',
    '4. Ground & Foundation Conditions': '4. Warunki gruntowe i fundamentowe', 'Ground & Foundation Conditions': 'Warunki gruntowe i fundamentowe', 'Soil texture': 'Tekstura gleby', 'Bearing capacity': 'Nośność', 'Friction angle': 'Kąt tarcia wewnętrznego', 'Cohesion': 'Spójność', 'Drainage': 'Drenaż', 'Hydraulic conductivity': 'Przewodność hydrauliczna', 'Bulk density': 'Gęstość objętościowa',
    '5. Geohazard Screening': '5. Ocena zagrożeń geologicznych', 'Geohazard Screening': 'Ocena zagrożeń geologicznych', '5. Flooding & Hydrology': '5. Powodzie i hydrologia', 'Flooding & Hydrology': 'Powodzie i hydrologia', 'Groundwater depth': 'Głębokość wód gruntowych', 'Groundwater notice': 'Informacja o wodach gruntowych', 'Geological portal': 'Portal geologiczny', 'Flood / hydrology evidence': 'Dane o powodziach i hydrologii',
    '6. Environment': '6. Środowisko', 'Environment': 'Środowisko', 'Surrounding land use': 'Użytkowanie terenu w otoczeniu', 'Source records': 'Rejestry źródłowe',
    '7. Archaeology & Heritage': '7. Archeologia i dziedzictwo', 'Archaeology & Heritage': 'Archeologia i dziedzictwo',
    '8. Planning / Development Constraints': '8. Ograniczenia planistyczne i inwestycyjne', 'Planning / Development Constraints': 'Ograniczenia planistyczne i inwestycyjne', 'Zoning designation': 'Przeznaczenie planistyczne', 'Building coverage': 'Powierzchnia zabudowy', 'Biologically active area': 'Powierzchnia biologicznie czynna', 'Maximum height': 'Maksymalna wysokość', 'Setbacks': 'Odległości od granic',
    '8. Building & Regulatory Requirements': '8. Wymogi budowlane i prawne', 'Building & Regulatory Requirements': 'Wymogi budowlane i prawne',
    '9. Development Implications': '9. Implikacje inwestycyjne', 'Development Implications': 'Implikacje inwestycyjne', 'Potential opportunities': 'Potencjalne możliwości', 'Key constraints / uncertainties': 'Kluczowe ograniczenia / niepewności',
    '9. Market & Valuation Context': '9. Rynek i kontekst wyceny', 'Market & Valuation Context': 'Rynek i kontekst wyceny', 'Indicative range': 'Zakres orientacyjny', 'Median / unit': 'Mediana / jednostka', 'Valuation basis': 'Podstawa wyceny', 'Comparable evidence': 'Dane porównawcze',
    'Section 10': 'Sekcja 10', 'Recommended Investigations': 'Zalecane badania', 'Section 11': 'Sekcja 11', 'Evidence Register & Source Library': 'Rejestr dowodów i biblioteka źródeł', 'direct source links': 'bezpośrednie linki do źródeł', 'Sources returned by the analysis pipeline': 'Źródła zwrócone przez moduł analizy',
    'Evidence Audit Registry (Claim → Source → Method → Limitation)': 'Rejestr audytu dowodów (teza → źródło → metoda → ograniczenie)',
    'Every technical parameter mapped to its provenance and epistemic limitation': 'Każdy parametr techniczny jest powiązany ze źródłem, metodą i ograniczeniem wiarygodności',
    'All': 'Wszystkie', 'Unverified': 'Niezweryfikowane', 'Source': 'Źródło', 'Authoritative Source & Date': 'Źródło autorytatywne i data', 'Access Portal / Viewer': 'Otwórz portal / przeglądarkę', 'Spatial Relationship': 'Relacja przestrzenna', 'Calculation / Ingestion Method': 'Metoda obliczeń / pozyskania danych', 'Confidence Level:': 'Poziom pewności:', 'Known Limitation & Caveat': 'Znane ograniczenia i zastrzeżenia',
    'Important limitations and professional disclaimer': 'Ważne ograniczenia i zastrzeżenia zawodowe', 'Limitation:': 'Ograniczenie:', 'Professional boundary:': 'Granica odpowiedzialności zawodowej:', 'Interpretation boundary:': 'Granica interpretacji:',
    'Show fewer': 'Pokaż mniej', 'Show all sources': 'Pokaż wszystkie źródła', 'Open source': 'Otwórz źródło', 'Requires verification': 'Wymaga weryfikacji', 'Generated': 'Wygenerowano',
    'Source cited by analysis:': 'Źródło wskazane przez analizę:', 'Modelled unless supported by site investigation': 'Modelowane, o ile nie potwierdzono badaniami terenowymi'
  }
};

const PL_PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Not available from the datasets reviewed/gi, 'Brak danych w przeanalizowanych zbiorach'],
  [/Not available — no location-specific national radon dataset was queried/gi, 'Brak danych — nie wykonano zapytania do krajowego zbioru danych radonowych dla tej lokalizacji'],
  [/Not available — no location-specific mining registry query was completed/gi, 'Brak danych — nie wykonano zapytania do rejestru górniczego dla tej lokalizacji'],
  [/Not available — national geological map not queried/gi, 'Brak danych — nie wykonano zapytania do krajowej mapy geologicznej'],
  [/Not available — requires hydrogeological evidence/gi, 'Brak danych — wymagane są dane hydrogeologiczne'],
  [/Not directly measured \(Requires on-site borehole\)/gi, 'Nie zmierzono bezpośrednio (wymagany odwiert terenowy)'],
  [/Requires local cadastre extract/gi, 'Wymaga wypisu z właściwego rejestru katastralnego'],
  [/Requires local planning confirmation/gi, 'Wymaga potwierdzenia w lokalnym urzędzie planistycznym'],
  [/Requires municipal confirmation/gi, 'Wymaga potwierdzenia w gminie'],
  [/Requires on-site investigation/gi, 'Wymaga badań terenowych'],
  [/Requires verification/gi, 'Wymaga weryfikacji'],
  [/Screening only; specialist verification may be required\./gi, 'Wyłącznie analiza przesiewowa; może być wymagana weryfikacja specjalistyczna.'],
  [/Utility capacity and legal access require direct confirmation\./gi, 'Przepustowość sieci oraz prawny dostęp wymagają bezpośredniego potwierdzenia.'],
  [/No construction cost quote is generated by this screening\./gi, 'Ta analiza przesiewowa nie stanowi kosztorysu robót budowlanych.'],
  [/No structured hazard records were returned\. This is not evidence that hazards are absent\./gi, 'Nie zwrócono ustrukturyzowanych danych o zagrożeniach. Nie oznacza to, że zagrożenia nie występują.'],
  [/current geological classification is preliminary regional\/modelled information\. It is not a site-specific geological investigation\./gi, 'Obecna klasyfikacja geologiczna ma charakter wstępny, regionalny lub modelowany. Nie jest to badanie geologiczne konkretnej działki.'],
  [/The authoritative map and borehole services below are the evidence base for further verification\./gi, 'Poniższe autorytatywne mapy i bazy otworów stanowią podstawę do dalszej weryfikacji.'],
  [/Terrain elevation data is not available; landslide susceptibility has not been inferred\./gi, 'Dane wysokościowe terenu są niedostępne; nie wyznaczono podatności na osuwiska.'],
  [/Hydrology proximity data is not available because the spatial query did not complete\. No flood-risk classification has been inferred\./gi, 'Dane o bliskości cieków są niedostępne, ponieważ zapytanie przestrzenne nie zakończyło się poprawnie. Nie wyznaczono klasy ryzyka powodziowego.'],
  [/Environmental spatial query unavailable; no protected-area overlap or distance conclusion was inferred\./gi, 'Zapytanie przestrzenne dotyczące środowiska jest niedostępne; nie wyciągnięto wniosku o nakładaniu się obszarów chronionych ani o odległości od nich.'],
  [/SoilGrids query unavailable; no soil texture or engineering properties inferred\./gi, 'Zapytanie SoilGrids jest niedostępne; nie wyznaczono tekstury gleby ani parametrów inżynierskich.'],
  [/Elevation dataset query unavailable; no elevation, slope, or aspect result inferred\./gi, 'Zapytanie do zbioru wysokościowego jest niedostępne; nie wyznaczono wysokości, nachylenia ani ekspozycji.'],
  [/Nearest public road corridor unconfirmed in open dataset/gi, 'Najbliższy publiczny korytarz drogowy nie został potwierdzony w otwartym zbiorze danych'],
  [/No power lines\/transformers mapped in immediate OpenStreetMap buffer\./gi, 'W bezpośrednim buforze OpenStreetMap nie zmapowano linii energetycznych ani transformatorów.'],
  [/No municipal water pipeline mapped in open vector dataset\./gi, 'W otwartym zbiorze wektorowym nie zmapowano komunalnego wodociągu.'],
  [/No sanitary sewer mapped in open dataset\./gi, 'W otwartym zbiorze danych nie zmapowano kanalizacji sanitarnej.'],
  [/No gas pipeline mapped in immediate vector buffer\./gi, 'W bezpośrednim buforze wektorowym nie zmapowano gazociągu.'],
  [/No telecom infrastructure mapped in immediate buffer\./gi, 'W bezpośrednim buforze nie zmapowano infrastruktury telekomunikacyjnej.'],
  [/Preliminary pedological estimate/gi, 'Wstępne oszacowanie pedologiczne'],
  [/Indicative Automated Econometric Benchmark/gi, 'Orientacyjny automatyczny model ekonometryczny'],
  [/Indicative Valuation Benchmark/gi, 'Orientacyjny benchmark wartości'],
  [/Soil Texture:/gi, 'Tekstura gleby:'],
  [/Road access:/gi, 'Dostęp drogowy:'],
  [/Direct access:/gi, 'Dostęp bezpośredni:'],
  [/Surface:/gi, 'Nawierzchnia:'],
  [/Landslide susceptibility/gi, 'Podatność na osuwiska'],
  [/Seismic hazard/gi, 'Zagrożenie sejsmiczne'],
  [/Radon potential/gi, 'Potencjał radonowy'],
  [/Mining subsidence/gi, 'Osiadanie górnicze'],
  [/Potential Mining Area/gi, 'Potencjalny obszar górniczy'],
  [/No direct comparable deeds verified/gi, 'Nie zweryfikowano bezpośrednich transakcji porównawczych'],
  [/0 Direct Comparable Deeds Verified/gi, '0 zweryfikowanych bezpośrednich transakcji porównawczych'],
  [/High uncertainty/gi, 'Wysoka niepewność'],
  [/Medium uncertainty/gi, 'Umiarkowana niepewność'],
  [/Low uncertainty/gi, 'Niska niepewność'],
  [/Not available/gi, 'Brak danych']
];

function localizeText(root: HTMLElement, language: string) {
  const map = UI_TRANSLATIONS[language];
  if (!map) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  for (const textNode of nodes) {
    const raw = textNode.nodeValue;
    const value = raw?.trim();
    if (!raw || !value) continue;
    const translated = map[value];
    if (translated) {
      textNode.nodeValue = raw.replace(value, translated);
      continue;
    }
    if (language === 'pl') {
      let localized = raw;
      for (const [pattern, replacement] of PL_PHRASE_REPLACEMENTS) localized = localized.replace(pattern, replacement);
      if (localized !== raw) textNode.nodeValue = localized;
    }
  }
}

function localizedSummary(report: SiteReport): string | undefined {
  const lang = report.language?.toLowerCase();
  if (lang === 'pl' || lang === 'en') return report.report_data.summary;
  const d = report.report_data;
  const t = d.technical_parameters || {};
  const score = d.evidence_score?.totalScore;
  const place = report.location_name || `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`;
  const soil = d.soil_metrics?.usda_texture || d.geosurvey_context?.lithology_type || '—';
  const elev = t.elevation_amsl;
  const slope = t.slope_degrees;
  const min = d.site_value_estimate?.min;
  const max = d.site_value_estimate?.max;
  const currency = d.site_value_estimate?.currency || '';
  if (lang === 'de') {
    return `Diese vorläufige Standortbewertung bündelt mehrere Evidenzquellen für den Standort ${place} mit einer Fläche von ${report.area_size.toLocaleString()} m². Der Evidenz-Qualitätsindex beträgt ${score ?? '—'}/100. Die topografische Analyse ergibt eine mittlere Höhe von ${elev ?? '—'} m ü. NHN und eine Geländeneigung von ${slope ?? '—'}°. Die wissenschaftlichen Bodenmodelldaten weisen auf ${soil} hin. Die Grundwassertiefe wurde nicht direkt gemessen. Die angegebenen Werte sind eine vorläufige Desktop-Analyse; verbindliche Aussagen zu Baugrund, Hochwasser, Planungsrecht und Gründung erfordern die jeweils zuständigen amtlichen Nachweise und fachgerechte Untersuchungen. Die indikative statistische Grundstückswertspanne beträgt ${min !== undefined && max !== undefined ? `${min.toLocaleString()}–${max.toLocaleString()} ${currency}` : '—'}.`;
  }
  if (lang === 'fr') {
    return `Cette évaluation préliminaire du site synthétise plusieurs sources de données pour le site ${place}, sur une superficie de ${report.area_size.toLocaleString()} m². Le score de qualité des preuves est de ${score ?? '—'}/100. L’analyse topographique indique une altitude moyenne de ${elev ?? '—'} m et une pente de ${slope ?? '—'}°. Les données scientifiques de cartographie des sols indiquent ${soil}. La profondeur de la nappe n’a pas été mesurée directement. Les résultats sont indicatifs et nécessitent la vérification des données officielles ainsi que les investigations professionnelles appropriées avant toute décision de construction. La fourchette statistique indicative de valeur foncière est de ${min !== undefined && max !== undefined ? `${min.toLocaleString()}–${max.toLocaleString()} ${currency}` : '—'}.`;
  }
  return report.report_data.summary;
}

export const ReportView: React.FC<ReportViewProps> = ({ report, onBack }) => {
  useEffect(() => {
    const root = document.body;
    localizeText(root, report.language?.toLowerCase() || 'en');
    const observer = new MutationObserver(() => localizeText(root, report.language?.toLowerCase() || 'en'));
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [report.language]);

  const localizedReport = React.useMemo(() => {
    const summary = localizedSummary(report);
    if (!summary || summary === report.report_data.summary) return report;
    return { ...report, report_data: { ...report.report_data, summary } };
  }, [report]);

  return <ReportViewEvidenceV2 report={localizedReport} onBack={onBack} />;
};
