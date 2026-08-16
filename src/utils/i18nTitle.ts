const TITLES_MAP: Record<string, string> = {
  en: "Evaluate Your Building Site: Geohazard and Market Value",
  de: "Bewerten Sie Ihr Baugrundstück: Geogefahren und Marktwert",
  pl: "Wyceń swoją działkę budowlaną: zagrożenia geologiczne i wartość rynkowa",
  fr: "Évaluez votre terrain à bâtir : risques géologiques et valeur marchande",
  es: "Evalúe su terreno edificable: riesgos geológicos y valor de mercado",
  it: "Valuta il tuo terreno edificabile: rischi geologici e valore di mercato",
  nl: "Evalueer uw bouwkavel: geologische risico's en marktwaarde",
  pt: "Avalie o seu terreno para construção: riscos geológicos e valor de mercado",
  cs: "Oceňte svůj stavební pozemek: geologická rizika a tržní hodnota",
  sv: "Utvärdera din byggnadstomt: georisker och marknadsvärde",
  da: "Evaluer din byggegrund: georisici og markedsværdi",
  fi: "Arvioi tonttisi: geologiset riskit ja markkina-arvo",
  hu: "Értékelje építési telkét: geológiai kockázatok és piaci érték",
  ro: "Evaluează-ți terenul constructibil: riscuri geologice și valoare de piață",
  el: "Aξιολογήστε το οικόπεδό σας: γεωλογικοί κίνδυνοι και εμπορική αξία",
  hr: "Procijenite svoje građevinsko zemljište: geološki rizici i tržišna vrijednost",
  sk: "Ohodnoťte svoj stavebný pozemok: geologické riziká a trhová hodnota",
  sl: "Ocenite svoje stavbno zemljišče: geološka tveganja in tržna vrednost",
  et: "Hinda oma ehituskrunti: geoloogilised ohud ja turuväärtus",
  lv: "Novērtējiet savu apbūves gabalu: ģeoloģiskie riski un tirgus vērtība",
  lt: "Įvertinkite savo statybos sklypą: geologiniai pavojai ir rinkos vertė",
  no: "Evaluer din byggetomt: geofarer og markedsverdi"
};

export function getBrowserLanguage(): string {
  if (typeof navigator === "undefined") return "en";
  const navLang = navigator.language || (navigator.languages && navigator.languages[0]) || "en";
  const code = navLang.toLowerCase().split("-")[0];
  return code;
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
    heroSub: "Wskaż lub narysuj dowolną działkę budowlaną w Europie. Otrzymaj natychmiastowy raport AI analizujący nośność gruntu, ryzyka geologiczne, plan zagospodarowania oraz szacunkową wartość rynkową.",
    step1: "1. Określ granice działki",
    searchPh: "Szukaj adresu lub miejscowości (np. Warszawa, Kraków, Berlin)...",
    step2: "2. Konfiguracja i Parametry",
    areaLbl: "Powierzchnia działki (m²)",
    countryLbl: "Kraj (Europa)",
    langLbl: "Język raportu",
    btnGen: "Sprawdź jakość i wartość działki",
    modeCircle: "Koło",
    modeRect: "Prostokąt",
    modePoly: "Dowolny wielokąt",
    finishPoly: "Zakończ wielokąt",
    clear: "Wyczyść",
    clickPrompt: "Kliknij na mapie, aby umieścić obszar działki."
  },
  de: {
    badge: "Europäische Baugrund- und Georisiko-Plattform",
    heroSub: "Zeichnen oder wählen Sie ein Baugrundstück in Europa. Erhalten Sie einen KI-Baugrundbericht mit Analyse von Tragfähigkeit, Geogefahren, Bebauungsplan und Marktwert.",
    step1: "1. Grundstücksgrenzen festlegen",
    searchPh: "Adresse oder Stadt suchen (z.B. München, Berlin, Wien)...",
    step2: "2. Konfiguration & Parameter",
    areaLbl: "Grundstücksfläche (m²)",
    countryLbl: "Land (Europa)",
    langLbl: "Berichtssprache",
    btnGen: "Baugrundstück prüfen & bewerten",
    modeCircle: "Kreis",
    modeRect: "Rechteck",
    modePoly: "Freies Polygon",
    finishPoly: "Polygon fertigstellen",
    clear: "Löschen",
    clickPrompt: "Klicken Sie auf die Karte, um die Grenze festzulegen."
  },
  fr: {
    badge: "Système Européen d'Information Géotechnique et Foncière",
    heroSub: "Dessinez ou sélectionnez n'importe quel terrain à bâtir en Europe. Obtenez un rapport d'analyse sur la capacité portante, les risques géologiques, le PLU et la valeur foncière.",
    step1: "1. Définir les limites du terrain",
    searchPh: "Rechercher une adresse ou une ville (ex. Paris, Lyon, Bruxelles)...",
    step2: "2. Configuration & Paramètres",
    areaLbl: "Superficie du terrain (m²)",
    countryLbl: "Pays (Europe)",
    langLbl: "Langue du rapport",
    btnGen: "Évaluer la qualité et la valeur du terrain",
    modeCircle: "Cercle",
    modeRect: "Rectangle",
    modePoly: "Polygone libre",
    finishPoly: "Terminer le polygone",
    clear: "Effacer",
    clickPrompt: "Cliquez sur la carte pour définir la limite."
  },
  es: {
    badge: "Plataforma Europea de Información Geotécnica y Valoración",
    heroSub: "Trace o seleccione cualquier parcela edificable en Europa. Obtenga un informe con análisis de portancia del suelo, riesgos geológicos, plan urbanístico y valor de mercado.",
    step1: "1. Definir los límites de la parcela",
    searchPh: "Buscar dirección o ciudad (ej. Madrid, Barcelona, Valencia)...",
    step2: "2. Configuración y Parámetros",
    areaLbl: "Superficie de la parcela (m²)",
    countryLbl: "País (Europa)",
    langLbl: "Idioma del informe",
    btnGen: "Comprobar calidad y valor de la parcela",
    modeCircle: "Círculo",
    modeRect: "Rectángulo",
    modePoly: "Polígono libre",
    finishPoly: "Finalizar polígono",
    clear: "Borrar",
    clickPrompt: "Haga clic en el mapa para colocar el límite."
  },
  it: {
    badge: "Sistema Europeo di Informazione Geotecnica e Immobiliare",
    heroSub: "Traccia o seleziona qualsiasi terreno edificabile in Europa. Ricevi un rapporto sull'analisi della portanza del suolo, rischi geologici, piano urbanistico e valore di mercato.",
    step1: "1. Definisci i confini del terreno",
    searchPh: "Cerca indirizzo o città (es. Roma, Milano, Torino)...",
    step2: "2. Configurazione e Parametri",
    areaLbl: "Superficie del terreno (m²)",
    countryLbl: "Paese (Europa)",
    langLbl: "Lingua del rapporto",
    btnGen: "Verifica qualità e valore del terreno",
    modeCircle: "Cerchio",
    modeRect: "Rettangolo",
    modePoly: "Poligono libero",
    finishPoly: "Completa poligono",
    clear: "Cancella",
    clickPrompt: "Clicca sulla mappa per definire il confine."
  },
  nl: {
    badge: "Europees Geotechnisch en Vastgoed Informatiesysteem",
    heroSub: "Teken of selecteer een bouwkavel in Europa. Ontvang een analyserapport met bodemgesteldheid, geologische risico's, bestemmingsplan en marktwaarde.",
    step1: "1. Bepaal de kavelgrenzen",
    searchPh: "Zoek adres of plaats (bijv. Amsterdam, Rotterdam, Antwerpen)...",
    step2: "2. Configuratie & Parameters",
    areaLbl: "Kaveloppervlakte (m²)",
    countryLbl: "Land (Europa)",
    langLbl: "Taal van rapport",
    btnGen: "Controleer kwaliteit & waarde van kavel",
    modeCircle: "Cirkel",
    modeRect: "Rechthoek",
    modePoly: "Vrij polygoon",
    finishPoly: "Polygoon voltooien",
    clear: "Wis",
    clickPrompt: "Klik op de kaart om de grens te plaatsen."
  }
};

export function getFrontPageI18n(langCode?: string): FrontPageI18n {
  const code = (langCode || getBrowserLanguage()).toLowerCase().split("-")[0];
  const custom = FRONT_PAGE_DICTIONARY[code] || {};
  
  return {
    badge: custom.badge || "European Real Estate & Geotechnical Intelligence",
    heroTitle: TITLES_MAP[code] || TITLES_MAP.en,
    heroSub: custom.heroSub || "Draw or specify any building plot across Europe. Receive an instant AI-powered ground-truth report analyzing soil bearing capacity, geohazard risks, zoning restrictions, and real market value.",
    step1: custom.step1 || "1. Define site boundary",
    searchPh: custom.searchPh || "Search address or city (e.g. London, Paris, Warsaw)...",
    step2: custom.step2 || "2. Configuration & Parameters",
    areaLbl: custom.areaLbl || "Site Area (m²)",
    countryLbl: custom.countryLbl || "Country (Europe)",
    langLbl: custom.langLbl || "Report Language",
    btnGen: custom.btnGen || "Check Quality & Value of Site",
    modeCircle: custom.modeCircle || "Circle",
    modeRect: custom.modeRect || "Box",
    modePoly: custom.modePoly || "Free Polygon",
    finishPoly: custom.finishPoly || "Finish Polygon",
    clear: custom.clear || "Clear",
    clickPrompt: custom.clickPrompt || "Click the map to place boundary."
  };
}
