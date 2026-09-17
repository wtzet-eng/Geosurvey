// Match explicit classifications only: prose mentioning a hazard is not a risk class.
export function riskSeverity(value: string): 'high' | 'moderate' | 'other' {
  const label = value.trim().toLocaleLowerCase();
  if (['high','very high','hoch','sehr hoch','wysokie','wysoki','wysoka','bardzo wysokie','élevé','très élevé','alto','muy alto','korkea','erittäin korkea','hoog','zeer hoog'].includes(label)) return 'high';
  if (['moderate','medium','mäßig','mittel','umiarkowane','umiarkowany','modéré','moderado','kohtalainen','matig'].includes(label)) return 'moderate';
  return 'other';
}

// Remove repeated complete sentences/paragraphs within a section, never across source records.
// A period must be followed by whitespace, so decimals and URLs stay intact.
export function distinctProse(value?: string, previous = ''): string {
  const parts = (text: string) => text.match(/[^!?]+?[.!?](?=\s|$)|[^!?]+$/gu) || [];
  const key = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const seen = new Set(parts(previous).map(key));
  return parts(value || '').filter(part => {
    const normalized = key(part);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).map(part => part.trim()).join(' ');
}

const copies = {
 en: { coverage:'Data coverage', note:'This weighted index describes available evidence, not site quality or risk. It is not a percentage of the plot verified.', flags:'Findings to address before a decision', caution:'A mapped or modelled high-risk classification needs closer assessment. The evidence label describes its source, not whether the site is safe.', findings:'Key findings at a glance', mapped:'Mapped geology', terrain:'Terrain slope', parcel:'Mapped parcel reference', limits:'These results help plan your next checks; they do not establish buildability.', index:'Weighted index' },
 pl: { coverage:'Dostępność danych', note:'Ten ważony wskaźnik opisuje dostępność dowodów, a nie jakość działki ani ryzyko. Nie oznacza procentu zweryfikowanej działki.', flags:'Kwestie do wyjaśnienia przed decyzją', caution:'Wysoka klasa ryzyka z mapy lub modelu wymaga dokładniejszej oceny. Etykieta dowodów opisuje źródło, a nie bezpieczeństwo działki.', findings:'Najważniejsze wyniki w skrócie', mapped:'Geologia według mapy', terrain:'Nachylenie terenu', parcel:'Identyfikator działki na mapie', limits:'Te wyniki pomagają zaplanować dalsze sprawdzenia; nie potwierdzają możliwości zabudowy.', index:'Wskaźnik ważony' },
 de: { coverage:'Datenabdeckung', note:'Dieser gewichtete Index beschreibt verfügbare Nachweise, nicht Grundstücksqualität oder Risiko. Er ist kein Prozentsatz des geprüften Grundstücks.', flags:'Vor einer Entscheidung näher prüfen', caution:'Eine hohe Risikoklasse aus Karten oder Modellen erfordert eine nähere Bewertung. Der Evidenzstatus beschreibt die Quelle, nicht die Sicherheit des Grundstücks.', findings:'Wichtigste Ergebnisse auf einen Blick', mapped:'Kartierte Geologie', terrain:'Geländeneigung', parcel:'Kartierte Flurstücksreferenz', limits:'Diese Ergebnisse helfen bei weiteren Prüfungen; sie bestätigen keine Bebaubarkeit.', index:'Gewichteter Index' }
};
const coverageTranslations: Record<string, {coverage:string; note:string; index:string}> = {
 fr: {coverage:'Couverture des données', note:'Cet indice pondéré décrit les preuves disponibles, pas la qualité du terrain ni le risque. Ce n’est pas un pourcentage du terrain vérifié.', index:'Indice pondéré'},
 es: {coverage:'Cobertura de datos', note:'Este índice ponderado describe la evidencia disponible, no la calidad del terreno ni el riesgo. No es un porcentaje del terreno verificado.', index:'Índice ponderado'},
 fi: {coverage:'Tietojen kattavuus', note:'Painotettu indeksi kuvaa saatavilla olevaa näyttöä, ei tontin laatua tai riskiä. Se ei ole tarkistetun tontin prosenttiosuus.', index:'Painotettu indeksi'},
 nl: {coverage:'Datadekking', note:'Deze gewogen index beschrijft beschikbare informatie, niet de kwaliteit of het risico van het perceel. Het is geen percentage van het gecontroleerde perceel.', index:'Gewogen index'}
};
export const coverageCopy = (language:string) => coverageTranslations[language.toLowerCase().slice(0,2)] || findingsCopy(language);
export const findingsCopy = (language: string) => copies[language.toLowerCase().slice(0,2) as keyof typeof copies] || copies.en;
