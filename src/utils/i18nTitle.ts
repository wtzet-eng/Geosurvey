[Reading 161 lines from start (total: 161 lines, 0 remaining)]

const TITLES_MAP: Record<string, string> = {
  en: "Screen Your Building Site: Ground Risks and Land Value",
  de: "Prüfen Sie Ihr Baugrundstück: Georisiken und Bodenwert",
  pl: "Wstępna ocena działki budowlanej: zagrożenia geologiczne i wartość gruntu",
  fr: "Analyse préliminaire du terrain : risques géologiques et valeur foncière",
  es: "Análisis preliminar de la parcela: riesgos geológicos y valor del suelo",
  it: "Valuta il tuo terreno edificabile: rischi geologici e valore di mercato",
  nl: "Vooronderzoek van uw bouwkavel: geologische risico's en grondwaarde",
  pt: "Avalie o seu terreno para construção: riscos geológicos e valor de mercado",
  cs: "Předběžné prověření stavebního pozemku: geologická rizika a hodnota pozemku",
  sv: "Förhandsgranskning av byggtomten: geologiska risker och tomtmarksvärde",
  da: "Indledende screening af din byggegrund: georisici og grundværdi",
  fi: "Tontin ennakkotarkastus: geologiset riskit ja maan arvo",
  hu: "Értékelje építési telkét: geológiai kockázatok és piaci érték",
  ro: "Evaluează-ți terenul constructibil: riscuri geologice și valoare de piață",
  el: "Aξιολογήστε το οικόπεδό σας: γεωλογικοί κίνδυνοι και εμπορική αξία",
  hr: "Procijenite svoje građevinsko zemljište: geološki rizici i tržišna vrijednost",
  sk: "Predbežné preverenie stavebného pozemku: geologické riziká a hodnota pozemku",
  sl: "Ocenite svoje stavbno zemljišče: geološka tveganja in tržna vrednost",
  et: "Hinda oma ehituskrunti: geoloogilised ohud ja turuväärtus",
  lv: "Novērtējiet savu apbūves gabalu: ģeoloģiskie riski un tirgus vērtība",
  lt: "Įvertinkite savo statybos sklypą: geologiniai pavojai ir rinkos vertė",
  no: "Forhåndsvurdering av byggetomten: geofarer og tomteverdi"
};

export function getBrowserLanguage(): string {
  if (typeof navigator === "undefined") return "en";
  const navLang = navigator.language || (navigator.languages && navigator.languages[0]) || "en";
  return navLang.toLowerCase().split("-")[0];
}

export function getLocalizedTitle(langCode?: string): string {
  const code = (langCode || getBrowserLanguage()).toLowerCase().split("-")[0];
  return TITLES_MAP[code] || TITLES_MAP.en;
}

export interface FrontPageI18n {
  badge: string;
  heroTitle: string;
  heroSub: string;
  step1: string;
  searchPh: string;
  step2: string;
  areaLbl: string;
  countryLbl: string;
  langLbl: string;
  btnGen: string;
  modeCircle: string;
  modeRect: string;
  modePoly: string;
  finishPoly: string;
  clear: string;
  clickPrompt: string;
}

const FRONT_PAGE_DICTIONARY: Record<string, Partial<FrontPageI18n>> = {
  pl: {
    badge: "Europejski System Informacji O Terenie i Ryzyku Geologicznym",
    heroSub: "Zbieramy w jednym miejscu dostępne dane o działce. Wybierz lokalizację, aby sprawdzić podłoże, zagrożenia, planowanie i wartość samego gruntu wraz z lukami w danych.",
    step1: "1. Określ granice działki", searchPh: "Szukaj adresu lub miejscowości (np. Warszawa, Kraków, Berlin)...", step2: "2. Konfiguracja i Parametry", areaLbl: "Powierzchnia działki (m²)", countryLbl: "Kraj (Europa)", langLbl: "Język raportu", btnGen: "Sprawdź działkę", modeCircle: "Koło", modeRect: "Prostokąt", modePoly: "Dowolny wielokąt", finishPoly: "Zakończ wielokąt", clear: "Wyczyść", clickPrompt: "Kliknij na mapie, aby umieścić obszar działki."
  },
  de: {
    badge: "Europäische Baugrund- und Georisiko-Plattform",
    heroSub: "Wir bündeln die verfügbaren Daten zu einem Grundstück an einem Ort. Wählen Sie einen Standort und prüfen Sie Untergrund, Gefahren, Planung und Bodenwert samt Datenlücken.",
    step1: "1. Grundstücksgrenzen festlegen", searchPh: "Adresse oder Stadt suchen (z.B. München, Berlin, Wien)...", step2: "2. Konfiguration & Parameter", areaLbl: "Grundstücksfläche (m²)", countryLbl: "Land (Europa)", langLbl: "Berichtssprache", btnGen: "Grundstück prüfen", modeCircle: "Kreis", modeRect: "Rechteck", modePoly: "Freies Polygon", finishPoly: "Polygon fertigstellen", clear: "Löschen", clickPrompt: "Klicken Sie auf die Karte, um die Grenze festzulegen."
  },
  fr: {
    badge: "Système Européen d'Information Géotechnique et Foncière",
    heroSub: "Dessinez ou sélectionnez n'importe quel terrain à bâtir en Europe. Obtenez un rapport d'analyse sur la capacité portante, les risques géologiques, le PLU et la valeur foncière.",
    step1: "1. Définir les limites du terrain", searchPh: "Rechercher une adresse ou une ville (ex. Paris, Lyon, Bruxelles)...", step2: "2. Configuration & Paramètres", areaLbl: "Superficie du terrain (m²)", countryLbl: "Pays (Europe)", langLbl: "Langue du rapport", btnGen: "Analyser le terrain", modeCircle: "Cercle", modeRect: "Rectangle", modePoly: "Polygone libre", finishPoly: "Terminer le polygone", clear: "Effacer", clickPrompt: "Cliquez sur la carte pour définir la limite."
  },
  es: {
    badge: "Plataforma Europea de Información Geotécnica y Valoración",
    heroSub: "Trace o seleccione cualquier parcela edificable en Europa. Obtenga un informe con análisis de portancia del suelo, riesgos geológicos, plan urbanístico y valor de mercado.",
    step1: "1. Definir los límites de la parcela", searchPh: "Buscar dirección o ciudad (ej. Madrid, Barcelona, Valencia)...", step2: "2. Configuración y Parámetros", areaLbl: "Superficie de la parcela (m²)", countryLbl: "País (Europa)", langLbl: "Idioma del informe", btnGen: "Analizar la parcela", modeCircle: "Círculo", modeRect: "Rectángulo", modePoly: "Polígono libre", finishPoly: "Finalizar polígono", clear: "Borrar", clickPrompt: "Haga clic en el mapa para colocar el límite."
  },
  it: {
    badge: "Sistema Europeo di Informazione Geotecnica e Immobiliare",
    heroSub: "Traccia o seleziona qualsiasi terreno edificabile in Europa. Ricevi un rapporto sull'analisi della portanza del suolo, rischi geologici, piano urbanistico e valore di mercato.",
    step1: "1. Definisci i confini del terreno", searchPh: "Cerca indirizzo o città (es. Roma, Milano, Torino)...", step2: "2. Configurazione e Parametri", areaLbl: "Superficie del terreno (m²)", countryLbl: "Paese (Europa)", langLbl: "Lingua del rapporto", btnGen: "Verifica qualità e valore del terreno", modeCircle: "Cerchio", modeRect: "Rettangolo", modePoly: "Poligono libero", finishPoly: "Completa poligono", clear: "Cancella", clickPrompt: "Clicca sulla mappa per definire il confine."
  },
  nl: {
    badge: "Europees Geotechnisch en Vastgoed Informatiesysteem",
    heroSub: "Teken of selecteer een bouwkavel in Europa. Ontvang een analyserapport met bodemgesteldheid, geologische risico's, bestemmingsplan en marktwaarde.",
    step1: "1. Bepaal de kavelgrenzen", searchPh: "Zoek adres of plaats (bijv. Amsterdam, Rotterdam, Antwerpen)...", step2: "2. Configuratie & Parameters", areaLbl: "Kaveloppervlakte (m²)", countryLbl: "Land (Europa)", langLbl: "Taal van rapport", btnGen: "Vooronderzoek starten", modeCircle: "Cirkel", modeRect: "Rechthoek", modePoly: "Vrij polygoon", finishPoly: "Polygoon voltooien", clear: "Wis", clickPrompt: "Klik op de kaart om de grens te plaatsen."
  },
  cs: {
    badge: "Evropská platforma pro stavební pozemky a geologická rizika",
    heroSub: "Nakreslete nebo vyberte stavební pozemek v Evropě. Získejte předběžný report založený na dostupných veřejných datech o podloží, geologických rizicích, územním plánování a hodnotě pozemku.",
    step1: "1. Určete hranice pozemku", searchPh: "Hledat adresu nebo obec (např. Praha, Brno, Ostrava)...", step2: "2. Konfigurace a parametry", areaLbl: "Plocha pozemku (m²)", countryLbl: "Země (Evropa)", langLbl: "Jazyk reportu", btnGen: "Prověřit pozemek", modeCircle: "Kruh", modeRect: "Obdélník", modePoly: "Volný polygon", finishPoly: "Dokončit polygon", clear: "Vymazat", clickPrompt: "Kliknutím do mapy určete hranici pozemku."
  },
  sv: {
    badge: "Europeisk plattform för byggmark och geologiska risker",
    heroSub: "Rita eller välj en byggtomt i Europa. Få en preliminär rapport baserad på tillgängliga offentliga data om markförhållanden, geologiska risker, planläggning och tomtmarknadsvärde.",
    step1: "1. Ange tomtgränsen",
    searchPh: "Sök adress eller ort (t.ex. Stockholm, Göteborg, Malmö)...",
    step2: "2. Konfiguration och parametrar",
    areaLbl: "Tomtarea (m²)",
    countryLbl: "Land (Europa)",
    langLbl: "Rapportspråk",
    btnGen: "Förhandsgranska tomt",
    modeCircle: "Cirkel", modeRect: "Rektangel", modePoly: "Fri polygon", finishPoly: "Slutför polygon", clear: "Rensa", clickPrompt: "Klicka på kartan för att ange gränsen."
  },
  da: {
    badge: "Europæisk platform for byggegrunde og georisici",
    heroSub: "Vi samler de tilgængelige oplysninger om grunden ét sted. Vælg et sted for at se dokumentation om jordbund, risici, planforhold og jordværdi, med datamangler tydeligt markeret.",
    step1: "1. Angiv grundens afgrænsning",
    searchPh: "Søg efter adresse eller by (f.eks. København, Aarhus, Odense)...",
    step2: "2. Indstillinger og parametre",
    areaLbl: "Grundareal (m²)",
    countryLbl: "Land (Europa)",
    langLbl: "Rapportsprog",
    btnGen: "Undersøg grunden",
    modeCircle: "Cirkel",
    modeRect: "Rektangel",
    modePoly: "Fri polygon",
    finishPoly: "Afslut polygon",
    clear: "Ryd",
    clickPrompt: "Klik på kortet for at angive grænsen."
  },
  no: {
    badge: "Europeisk plattform for byggegrunn og geofarer",
    heroSub: "Tegn eller velg en byggetomt i Europa. Få en foreløpig rapport basert på tilgjengelige offentlige data om grunnforhold, geologiske farer, arealplanlegging og tomteverdi.",
    step1: "1. Angi tomtegrensen",
    searchPh: "Søk etter adresse eller sted (f.eks. Oslo, Bergen, Trondheim)...",
    step2: "2. Konfigurasjon og parametere",
    areaLbl: "Tomteareal (m²)",
    countryLbl: "Land (Europa)",
    langLbl: "Rapportspråk",
    btnGen: "Forhåndsvurder tomt",
    modeCircle: "Sirkel",
    modeRect: "Rektangel",
    modePoly: "Fritt polygon",
    finishPoly: "Fullfør polygon",
    clear: "Tøm",
    clickPrompt: "Klikk på kartet for å angi grensen."
  }
};

export function getFrontPageI18n(langCode?: string): FrontPageI18n {
  const code = (langCode || getBrowserLanguage()).toLowerCase().split("-")[0];
  const custom = FRONT_PAGE_DICTIONARY[code] || {};
  return {
    badge: custom.badge || "European Real Estate & Geotechnical Intelligence",
    heroTitle: TITLES_MAP[code] || TITLES_MAP.en,
    heroSub: custom.heroSub || "We collect the land data you need to know in one place. Choose a site to see available ground, hazard, planning and land-value evidence, with gaps clearly marked.",
    step1: custom.step1 || "1. Define site boundary",
    searchPh: custom.searchPh || "Search address or city (e.g. London, Paris, Warsaw)...",
    step2: custom.step2 || "2. Configuration & Parameters",
    areaLbl: custom.areaLbl || "Site Area (m²)",
    countryLbl: custom.countryLbl || "Country (Europe)",
    langLbl: custom.langLbl || "Report Language",
    btnGen: custom.btnGen || "Screen Site",
    modeCircle: custom.modeCircle || "Circle",
    modeRect: custom.modeRect || "Box",
    modePoly: custom.modePoly || "Free Polygon",
    finishPoly: custom.finishPoly || "Finish Polygon",
    clear: custom.clear || "Clear",
    clickPrompt: custom.clickPrompt || "Click the map to place boundary."
  };
}

[executed on device: toma (e8359509-e325-4515-b2ff-2da47ff811ad)]