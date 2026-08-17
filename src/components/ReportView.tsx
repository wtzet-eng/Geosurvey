import React, { useEffect } from 'react';
import { ReportViewEvidenceV2 } from './ReportViewEvidenceV2';
import { SiteReport } from '../types';

interface ReportViewProps {
  report: SiteReport;
  onBack?: () => void;
}

/**
 * The analysis pipeline already receives report.language. The evidence report
 * view, however, contains a number of presentation strings that were hard-coded
 * in English. Keep the working report component intact and localize its UI here.
 * Data values, dataset names and source names are deliberately not translated.
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
    'Show fewer': 'Weniger anzeigen', 'Show all sources': 'Alle Quellen anzeigen', 'Open source': 'Quelle öffnen', 'Requires verification': 'Prüfung erforderlich', 'Verified': 'Verifiziert', 'Modelled': 'Modelliert',
    'Generated': 'Erstellt', 'This is not evidence that hazards are absent.': 'Dies ist kein Nachweis dafür, dass Gefahren nicht vorhanden sind.',
  },
  fr: {
    'Back': 'Retour', 'Share': 'Partager', 'Copied': 'Copié', 'Preliminary Site Assessment': 'Évaluation préliminaire du site', 'Evidence first': "Les preuves d'abord", 'Executive Summary': 'Synthèse exécutive', 'Site & Parcel': 'Site & parcelle', 'Location': 'Localisation', 'Coordinates': 'Coordonnées', 'Area': 'Surface', 'Elevation': 'Altitude', 'Slope': 'Pente', 'Geological Evidence': 'Données géologiques', 'Geological unit': 'Unité géologique', 'Lithology': 'Lithologie', 'Groundwater regime': 'Régime des eaux souterraines', 'Ground & Foundation Conditions': 'Sol & conditions de fondation', 'Soil texture': 'Texture du sol', 'Bearing capacity': 'Portance', 'Geohazard Screening': 'Dépistage des géorisques', 'Flooding & Hydrology': 'Inondation & hydrologie', 'Environment': 'Environnement', 'Archaeology & Heritage': 'Archéologie & patrimoine', 'Planning / Development Constraints': 'Contraintes d’aménagement', 'Building & Regulatory Requirements': 'Exigences de construction et réglementaires', 'Development Implications': 'Implications pour le développement', 'Market & Valuation Context': 'Marché & contexte de valorisation', 'Recommended Investigations': 'Investigations recommandées', 'Evidence Register & Source Library': 'Registre des preuves & bibliothèque des sources', 'Important limitations and professional disclaimer': 'Limites importantes et avertissement professionnel', 'Open source': 'Ouvrir la source', 'Requires verification': 'Vérification requise', 'Verified': 'Vérifié', 'Modelled': 'Modélisé', 'Share': 'Partager', 'PDF': 'PDF'
  },
  pl: {
    'Back': 'Wstecz', 'Share': 'Udostępnij', 'Copied': 'Skopiowano', 'Preliminary Site Assessment': 'Wstępna ocena lokalizacji', 'Evidence first': 'Najpierw dowody', 'Executive Summary': 'Podsumowanie', 'Site & Parcel': 'Lokalizacja i działka', 'Location': 'Lokalizacja', 'Coordinates': 'Współrzędne', 'Area': 'Powierzchnia', 'Elevation': 'Wysokość', 'Slope': 'Nachylenie', 'Geological Evidence': 'Dane geologiczne', 'Geological unit': 'Jednostka geologiczna', 'Lithology': 'Litologia', 'Groundwater regime': 'Warunki wodonośne', 'Ground & Foundation Conditions': 'Warunki gruntowe i fundamentowe', 'Soil texture': 'Tekstura gleby', 'Bearing capacity': 'Nośność', 'Geohazard Screening': 'Ocena zagrożeń geologicznych', 'Flooding & Hydrology': 'Powodzie i hydrologia', 'Environment': 'Środowisko', 'Archaeology & Heritage': 'Archeologia i dziedzictwo', 'Planning / Development Constraints': 'Ograniczenia planistyczne i inwestycyjne', 'Building & Regulatory Requirements': 'Wymogi budowlane i prawne', 'Development Implications': 'Implikacje inwestycyjne', 'Market & Valuation Context': 'Rynek i kontekst wyceny', 'Recommended Investigations': 'Zalecane badania', 'Evidence Register & Source Library': 'Rejestr dowodów i biblioteka źródeł', 'Important limitations and professional disclaimer': 'Ważne ograniczenia i zastrzeżenia zawodowe', 'Open source': 'Otwórz źródło', 'Requires verification': 'Wymaga weryfikacji', 'Verified': 'Zweryfikowane', 'Modelled': 'Modelowane', 'PDF': 'PDF'
  }
};

function localizeText(root: HTMLElement, language: string) {
  const map = UI_TRANSLATIONS[language];
  if (!map) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  for (const textNode of nodes) {
    const value = textNode.nodeValue?.trim();
    if (!value) continue;
    const translated = map[value];
    if (translated) textNode.nodeValue = textNode.nodeValue!.replace(value, translated);
  }
}

export const ReportView: React.FC<ReportViewProps> = ({ report, onBack }) => {
  useEffect(() => {
    const root = document.body;
    localizeText(root, report.language?.toLowerCase() || 'en');
    const observer = new MutationObserver(() => localizeText(root, report.language?.toLowerCase() || 'en'));
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [report.language]);

  return <ReportViewEvidenceV2 report={report} onBack={onBack} />;
};
