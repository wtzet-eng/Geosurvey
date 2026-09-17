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

type BuyerInput = {
 slope?: number | null;
 risks: {category:string; level:string; evidence_level?:string}[];
 planningConfirmed:boolean;
 floodConfirmed:boolean;
};
const buyerCopies = {
 en: {suitabilityNote:'A preliminary view of site conditions, not confirmation that development is permitted or feasible.', positive:'Suitability for development', concerns:'Potential hazards', checks:'What still needs checking', flat:'The terrain has a gentle mapped slope ({slope}°). This may simplify layout, though foundations and drainage still need checking.', low:'{category}: the reported classification is {level}. This is an encouraging screening result, not a site guarantee.', risk:'{category}: {level}. Ask a qualified specialist how this could affect your proposed use and costs.', noPositive:'The available evidence is not enough to assess development suitability.', noConcern:'No explicit moderate or high hazard classification was returned. Incomplete coverage means other risks may remain.', planning:'Confirm that your intended use is permitted with the local planning authority.', flood:'Check the official flood assessment before proceeding with your plans.', site:'Confirm boundaries, access and ground conditions for your intended use.' },
 pl: {suitabilityNote:'Wstępny obraz warunków działki, a nie potwierdzenie, że zabudowa jest dozwolona lub wykonalna.', positive:'Przydatność do zabudowy', concerns:'Potencjalne zagrożenia', checks:'Co jeszcze trzeba sprawdzić', flat:'Teren ma niewielkie nachylenie według modelu ({slope}°). Może to ułatwić rozplanowanie zabudowy, ale fundamenty i odwodnienie nadal wymagają sprawdzenia.', low:'{category}: zgłoszona klasa to {level}. To zachęcający wynik wstępnego sprawdzenia, a nie gwarancja bezpieczeństwa działki.', risk:'{category}: {level}. Zapytaj specjalistę, jak może to wpłynąć na planowane wykorzystanie i koszty.', noPositive:'Dostępne dane nie wystarczają jeszcze do oceny przydatności do zabudowy.', noConcern:'Nie zwrócono jednoznacznej umiarkowanej ani wysokiej klasy zagrożenia. Niepełne dane mogą pozostawiać inne ryzyka nierozpoznane.', planning:'Potwierdź we właściwym urzędzie, czy planowane wykorzystanie działki jest dozwolone.', flood:'Przed realizacją planów sprawdź oficjalną ocenę zagrożenia powodziowego.', site:'Potwierdź granice, dostęp i warunki gruntowe dla planowanego wykorzystania.' },
 de: {suitabilityNote:'Eine erste Einschätzung der Standortbedingungen, keine Bestätigung, dass eine Bebauung zulässig oder machbar ist.', positive:'Eignung für eine Bebauung', concerns:'Mögliche Gefahren', checks:'Was noch zu prüfen ist', flat:'Das Gelände weist laut Modell eine geringe Neigung auf ({slope}°). Das kann die Anordnung der Bebauung erleichtern; Gründung und Entwässerung bleiben zu prüfen.', low:'{category}: gemeldete Klasse {level}. Ein ermutigendes erstes Ergebnis, keine Sicherheitsgarantie für das Grundstück.', risk:'{category}: {level}. Lassen Sie fachlich prüfen, wie dies Ihre geplante Nutzung und Kosten beeinflussen könnte.', noPositive:'Die verfügbaren Daten reichen noch nicht aus, um die Eignung für eine Bebauung zu beurteilen.', noConcern:'Es wurde keine ausdrückliche mittlere oder hohe Gefahrenklasse zurückgegeben. Bei unvollständigen Daten können weitere Risiken offenbleiben.', planning:'Bestätigen Sie mit der Planungsbehörde, dass Ihre geplante Nutzung zulässig ist.', flood:'Prüfen Sie vor der Umsetzung Ihrer Pläne die amtliche Hochwasserbewertung.', site:'Bestätigen Sie Grenzen, Zugang und Baugrund für Ihre geplante Nutzung.' }
};
export function buyerSummary(input:BuyerInput, language:string) {
 const copy=buyerCopies[language.toLowerCase().slice(0,2) as keyof typeof buyerCopies] || buyerCopies.en;
 const positives:string[]=[];
 if (typeof input.slope==='number' && Number.isFinite(input.slope) && input.slope>=0 && input.slope<=5) positives.push(copy.flat.replace('{slope}',String(input.slope)));
 const lowLabels=['low','negligible','gering','niedrig','vernachlässigbar','niskie','niski','znikome'];
 for (const risk of input.risks) {
   if (['VERIFIED','MODELLED'].includes(risk.evidence_level || '') && lowLabels.includes(risk.level.trim().toLowerCase())) positives.push(copy.low.replace('{category}',risk.category).replace('{level}',risk.level));
 }
 const concerns=input.risks.filter(r=>riskSeverity(r.level)!=='other').sort((a,b)=>(riskSeverity(a.level)==='high'?0:1)-(riskSeverity(b.level)==='high'?0:1)).map(r=>copy.risk.replace('{category}',r.category).replace('{level}',r.level));
 const checks=[...(!input.planningConfirmed?[copy.planning]:[]),...(!input.floodConfirmed?[copy.flood]:[]),copy.site];
 return {copy, positives:positives.slice(0,2), concerns:concerns.slice(0,2), checks};
}
