import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, FileText, Globe2,
  Layers3, Loader2, Map, Search, ShieldCheck, Sparkles, Phone,
  SquareArrowOutUpRight, Sun, Moon, Target
} from 'lucide-react';
import { MapPicker } from './components/MapPicker';
import { MapPreview } from './components/MapPreview';
import { SiteReport, BoundaryShape } from './types';
import { EUROPEAN_COUNTRIES } from './data/countries';
import { calculateBoundaryArea, getBoundaryCenter } from './utils/geo';
import { getAvailableReportLanguages, getDefaultReportLanguageForCountry, normalizeReportLanguage } from './utils/reportLanguageOptions';
import { apiFetch } from './lib/apiClient';
import { FloatingSupportLandSurf } from './components/SupportLandSurf';


type ChatTurn = {
  question: string;
  answer?: {
    answer: string;
    evidenceIds: string[];
    unknowns: string[];
    nextQuestions: string[];
    sourceIds: string[];
    actions: Array<{ kind: 'official_source' | 'field_investigation' | 'local_professional'; title: string; reason: string; professionalCategory?: 'surveyor' | 'architect' | 'engineering' | 'environment' | 'planning' | 'geotechnical' }>;
    localBusinesses?: Array<{ name: string; category: string; distanceM: number; website?: string; phone?: string; address?: string; source: string }>;
  };
  error?: string;
};

const COVERAGE = [
  ['cadastre', 'Where is it?', 'Wo ist es?', 'Gdzie znajduje się działka?', ['cadastre', 'parcel', 'boundary']],
  ['ground', 'What is beneath it?', 'Was befindet sich darunter?', 'Co znajduje się pod działką?', ['geology', 'soil', 'ground', 'borehole']],
  ['water', 'How does water behave?', 'Wie verhält sich das Wasser?', 'Jak zachowuje się woda?', ['water', 'flood', 'hydro', 'groundwater']],
  ['history', 'What happened here before?', 'Was geschah hier früher?', 'Co było tutaj wcześniej?', ['history', 'environment', 'contamination', 'land use']],
  ['planning', 'What could affect development?', 'Was könnte die Entwicklung beeinflussen?', 'Co może wpłynąć na możliwość zabudowy?', ['planning', 'zoning', 'building']],
  ['access', 'What is around it?', 'Was befindet sich in der Umgebung?', 'Co znajduje się w okolicy?', ['infrastructure', 'access', 'amenity', 'utility']]
] as const;

const STARTER_QUESTIONS = {
  en: ['Could this land flood?', 'What is underneath it?', 'Can I build here?', 'Could there be contamination?', 'What are the biggest unknowns?', 'What should I check before buying?'],
  de: ['Könnte dieses Grundstück überflutet werden?', 'Was befindet sich unter dem Grundstück?', 'Kann ich hier bauen?', 'Könnte es Altlasten oder Verunreinigungen geben?', 'Was sind die größten offenen Fragen?', 'Was sollte ich vor dem Kauf prüfen?'],
  pl: ['Czy ten teren może być zalewany?', 'Co znajduje się pod działką?', 'Czy można tutaj budować?', 'Czy mogą występować zanieczyszczenia?', 'Jakie są najważniejsze niewiadome?', 'Co należy sprawdzić przed zakupem?'],
  cs: ['Může být tento pozemek zaplaven?', 'Co se nachází pod pozemkem?', 'Lze zde stavět?', 'Může zde být kontaminace?', 'Jaké jsou největší neznámé?', 'Co bych měl před koupí ověřit?'],
  da: ['Kan denne grund blive oversvømmet?', 'Hvad ligger under grunden?', 'Må jeg bygge her?', 'Kan der være forurening?', 'Hvad er de største ubesvarede spørgsmål?', 'Hvad bør jeg undersøge før køb?'],
  nl: ['Kan dit terrein overstromen?', 'Wat bevindt zich onder de grond?', 'Kan ik hier bouwen?', 'Kan er sprake zijn van verontreiniging?', 'Wat zijn de belangrijkste onbekende factoren?', 'Wat moet ik controleren voordat ik koop?'],
  hr: ['Može li ovo zemljište biti poplavljeno?', 'Što se nalazi ispod zemljišta?', 'Može li se ovdje graditi?', 'Može li biti onečišćenja?', 'Koje su najveće nepoznanice?', 'Što trebam provjeriti prije kupnje?'],
  es: ['¿Puede inundarse este terreno?', '¿Qué hay debajo del terreno?', '¿Se puede construir aquí?', '¿Podría haber contaminación?', '¿Cuáles son las mayores incógnitas?', '¿Qué debo comprobar antes de comprar?'],
  fr: ['Ce terrain peut-il être inondé ?', 'Qu’y a-t-il sous le terrain ?', 'Peut-on construire ici ?', 'Y a-t-il un risque de pollution ?', 'Quelles sont les principales inconnues ?', 'Que dois-je vérifier avant l’achat ?'],
  no: ['Kan denne eiendommen bli oversvømt?', 'Hva ligger under eiendommen?', 'Kan jeg bygge her?', 'Kan det finnes forurensning?', 'Hva er de største usikkerhetene?', 'Hva bør jeg undersøke før kjøp?'],
  fi: ['Voiko tämä maa-alue tulvia?', 'Mitä maa-alueen alla on?', 'Voiko tänne rakentaa?', 'Voiko alueella olla saastumista?', 'Mitkä ovat suurimmat epävarmuudet?', 'Mitä pitäisi tarkistaa ennen ostoa?'],
  sv: ['Kan marken översvämmas?', 'Vad finns under marken?', 'Går det att bygga här?', 'Kan det finnas föroreningar?', 'Vilka är de största osäkerheterna?', 'Vad bör jag kontrollera före köp?']
} as const;

function starterQuestions(language: string): readonly string[] {
  const locale = String(language || '').toLowerCase().split('-')[0];
  if (locale === 'de') return STARTER_QUESTIONS.de;
  if (locale === 'pl') return STARTER_QUESTIONS.pl;
  if (locale === 'cs') return STARTER_QUESTIONS.cs;
  if (locale === 'da') return STARTER_QUESTIONS.da;
  if (locale === 'nl') return STARTER_QUESTIONS.nl;
  if (locale === 'hr') return STARTER_QUESTIONS.hr;
  if (locale === 'es') return STARTER_QUESTIONS.es;
  if (locale === 'fr') return STARTER_QUESTIONS.fr;
  if (locale === 'no') return STARTER_QUESTIONS.no;
  if (locale === 'fi') return STARTER_QUESTIONS.fi;
  if (locale === 'sv') return STARTER_QUESTIONS.sv;
  return STARTER_QUESTIONS.en;
}

const GROUND_SURF_COPY = {
  en: {
    badge: 'Public evidence, gathered in one place',
    heroTitle: 'First, I gather the evidence.',
    heroSubTitle: 'Then you decide what to ask.',
    heroText: 'GroundSurf searches the public evidence available for this land — cadastral records, ground, water, planning, environment and local context — and turns it into something you can explore.',
    whereTitle: 'Where shall we look?',
    whereHint: 'Search an address, or use the map to choose the land.',
    addressFlow: 'Address → parcel → evidence',
    promiseLabel: 'The promise',
    promiseMain: 'I gather the public evidence I can find.',
    promiseQuestion: 'What would you like to know?',
    evidenceFirst: 'Evidence before explanation.',
    unknownsVisible: 'Unknowns stay visible.',
    sourceTrail: 'Every answer can lead back to its source.',
    gatherButton: 'Gather the evidence',
    screeningNote: 'This is screening evidence, not a legal or engineering certification.',
    findingParcel: 'Finding the official parcel…',
    officialParcel: 'Official parcel identified.',
    landReady: 'Land selected and ready.',
    chooseLand: 'Choose the land on the map.',
    menuLanguage: 'Language',
    themeSystem: 'Follow browser', themeUseLight: 'Use light background', themeUseDark: 'Use dark background',
    gatheringEvidence: 'Gathering public evidence…'
  },
  de: {
    badge: 'Öffentliche Daten an einem Ort',
    heroTitle: 'Zuerst sammle ich die Belege.',
    heroSubTitle: 'Dann entscheidest du, was du fragen möchtest.',
    heroText: 'GroundSurf sucht die verfügbaren öffentlichen Informationen zu diesem Grundstück — Kataster, Untergrund, Wasser, Planung, Umwelt und das Umfeld — und macht sie gemeinsam erkundbar.',
    whereTitle: 'Wo sollen wir suchen?',
    whereHint: 'Adresse suchen oder das Grundstück auf der Karte auswählen.',
    addressFlow: 'Adresse → Flurstück → Belege',
    promiseLabel: 'Das Versprechen',
    promiseMain: 'Ich sammle die öffentlichen Belege, die ich finden kann.',
    promiseQuestion: 'Was möchtest du wissen?',
    evidenceFirst: 'Erst Belege, dann Erklärung.',
    unknownsVisible: 'Offene Punkte bleiben sichtbar.',
    sourceTrail: 'Jede Antwort kann zu ihrer Quelle zurückführen.',
    gatherButton: 'Belege sammeln',
    screeningNote: 'Dies ist eine Vorprüfung, keine rechtliche oder ingenieurtechnische Bestätigung.',
    findingParcel: 'Amtliches Flurstück wird gesucht…',
    officialParcel: 'Amtliches Flurstück identifiziert.',
    landReady: 'Grundstück ausgewählt und bereit.',
    chooseLand: 'Grundstück auf der Karte auswählen.',
    menuLanguage: 'Sprache',
    themeSystem: 'Browser folgen', themeUseLight: 'Hellen Hintergrund verwenden', themeUseDark: 'Dunklen Hintergrund verwenden',
    gatheringEvidence: 'Öffentliche Daten werden gesammelt…'
  },
  cs: {
    badge: 'Veřejné důkazy shromážděné na jednom místě', heroTitle: 'Nejprve shromáždím důkazy.', heroSubTitle: 'Pak se rozhodnete, na co se chcete zeptat.', heroText: 'GroundSurf vyhledává dostupné veřejné údaje o tomto pozemku — katastr, podloží, vodu, plánování, životní prostředí a místní souvislosti — a zpřístupní je k prozkoumání.', whereTitle: 'Kde máme hledat?', whereHint: 'Vyhledejte adresu nebo vyberte pozemek na mapě.', addressFlow: 'Adresa → parcela → důkazy', promiseLabel: 'Slib', promiseMain: 'Shromáždím dostupné veřejné důkazy.', promiseQuestion: 'Co byste chtěli vědět?', evidenceFirst: 'Nejprve důkazy, potom vysvětlení.', unknownsVisible: 'Neznámé skutečnosti zůstávají viditelné.', sourceTrail: 'Každá odpověď může vést zpět ke svému zdroji.', gatherButton: 'Shromáždit údaje', screeningNote: 'Jde o předběžné prověření, nikoli právní nebo inženýrské potvrzení.', findingParcel: 'Hledá se oficiální parcela…', officialParcel: 'Oficiální parcela identifikována.', landReady: 'Pozemek vybrán a připraven.', chooseLand: 'Vyberte pozemek na mapě.', menuLanguage: 'Jazyk', themeSystem: 'Podle prohlížeče', themeUseLight: 'Použít světlé pozadí', themeUseDark: 'Použít tmavé pozadí', gatheringEvidence: 'Shromažďování veřejných údajů…'
  },
  da: {
    badge: 'Offentlige oplysninger samlet ét sted', heroTitle: 'Først samler jeg oplysningerne.', heroSubTitle: 'Derefter beslutter du, hvad du vil spørge om.', heroText: 'GroundSurf søger efter tilgængelige offentlige oplysninger om grunden — matrikel, undergrund, vand, planlægning, miljø og lokal kontekst — og gør dem nemme at undersøge.', whereTitle: 'Hvor skal vi lede?', whereHint: 'Søg efter en adresse, eller vælg grunden på kortet.', addressFlow: 'Adresse → matrikel → oplysninger', promiseLabel: 'Løftet', promiseMain: 'Jeg samler de offentlige oplysninger, jeg kan finde.', promiseQuestion: 'Hvad vil du gerne vide?', evidenceFirst: 'Oplysninger før forklaring.', unknownsVisible: 'Det ukendte forbliver synligt.', sourceTrail: 'Hvert svar kan føres tilbage til sin kilde.', gatherButton: 'Saml oplysninger', screeningNote: 'Dette er en foreløbig screening, ikke en juridisk eller ingeniørmæssig certificering.', findingParcel: 'Finder den officielle matrikel…', officialParcel: 'Officiel matrikel identificeret.', landReady: 'Grund valgt og klar.', chooseLand: 'Vælg grunden på kortet.', menuLanguage: 'Sprog', themeSystem: 'Følg browser', themeUseLight: 'Brug lys baggrund', themeUseDark: 'Brug mørk baggrund', gatheringEvidence: 'Indsamler offentlige oplysninger…'
  },
  nl: {
    badge: 'Openbare gegevens op één plek verzameld', heroTitle: 'Eerst verzamel ik de gegevens.', heroSubTitle: 'Daarna bepaal je wat je wilt vragen.', heroText: 'GroundSurf zoekt naar beschikbare openbare gegevens over dit terrein — kadaster, ondergrond, water, planologie, milieu en lokale context — en maakt ze samen verkenbaar.', whereTitle: 'Waar zullen we zoeken?', whereHint: 'Zoek een adres of kies het terrein op de kaart.', addressFlow: 'Adres → perceel → gegevens', promiseLabel: 'De belofte', promiseMain: 'Ik verzamel de openbare gegevens die ik kan vinden.', promiseQuestion: 'Wat wil je weten?', evidenceFirst: 'Eerst gegevens, daarna uitleg.', unknownsVisible: 'Onbekende zaken blijven zichtbaar.', sourceTrail: 'Elk antwoord kan terugleiden naar de bron.', gatherButton: 'Gegevens verzamelen', screeningNote: 'Dit is een eerste screening, geen juridische of bouwtechnische bevestiging.', findingParcel: 'Officieel perceel wordt gezocht…', officialParcel: 'Officieel perceel geïdentificeerd.', landReady: 'Terrein geselecteerd en klaar.', chooseLand: 'Kies het terrein op de kaart.', menuLanguage: 'Taal', themeSystem: 'Browser volgen', themeUseLight: 'Lichte achtergrond gebruiken', themeUseDark: 'Donkere achtergrond gebruiken', gatheringEvidence: 'Openbare gegevens verzamelen…'
  },
  hr: {
    badge: 'Javni podaci prikupljeni na jednom mjestu', heroTitle: 'Najprije prikupljam dokaze.', heroSubTitle: 'Zatim odlučujete što želite pitati.', heroText: 'GroundSurf traži dostupne javne podatke o ovom zemljištu — katastar, podzemlje, vode, prostorno planiranje, okoliš i lokalni kontekst — i pretvara ih u podatke koje možete istražiti.', whereTitle: 'Gdje ćemo tražiti?', whereHint: 'Pretražite adresu ili odaberite zemljište na karti.', addressFlow: 'Adresa → čestica → dokazi', promiseLabel: 'Obećanje', promiseMain: 'Prikupljam dostupne javne dokaze.', promiseQuestion: 'Što želite saznati?', evidenceFirst: 'Najprije dokazi, zatim objašnjenje.', unknownsVisible: 'Nepoznate stvari ostaju vidljive.', sourceTrail: 'Svaki odgovor može voditi natrag do izvora.', gatherButton: 'Prikupi podatke', screeningNote: 'Ovo je početna provjera, a ne pravna ili inženjerska potvrda.', findingParcel: 'Traži se službena katastarska čestica…', officialParcel: 'Službena katastarska čestica identificirana.', landReady: 'Zemljište je odabrano i spremno.', chooseLand: 'Odaberite zemljište na karti.', menuLanguage: 'Jezik', themeSystem: 'Prema pregledniku', themeUseLight: 'Koristi svijetlu pozadinu', themeUseDark: 'Koristi tamnu pozadinu', gatheringEvidence: 'Prikupljanje javnih podataka…'
  },
  es: { badge: 'Datos públicos reunidos en un solo lugar', heroTitle: 'Primero recopilo las evidencias.', heroSubTitle: 'Después decides qué quieres preguntar.', heroText: 'GroundSurf busca los datos públicos disponibles sobre este terreno — catastro, subsuelo, agua, planificación, medio ambiente y contexto local — y los convierte en información que puedes explorar.', whereTitle: '¿Dónde debemos buscar?', whereHint: 'Busca una dirección o selecciona el terreno en el mapa.', addressFlow: 'Dirección → parcela → evidencias', promiseLabel: 'La promesa', promiseMain: 'Recopilo las evidencias públicas que puedo encontrar.', promiseQuestion: '¿Qué te gustaría saber?', evidenceFirst: 'Evidencias antes que explicaciones.', unknownsVisible: 'Las incógnitas permanecen visibles.', sourceTrail: 'Cada respuesta puede llevar de vuelta a su fuente.', gatherButton: 'Recopilar datos', screeningNote: 'Esto es una revisión preliminar, no una certificación legal o de ingeniería.', findingParcel: 'Buscando la parcela oficial…', officialParcel: 'Parcela oficial identificada.', landReady: 'Terreno seleccionado y listo.', chooseLand: 'Selecciona el terreno en el mapa.', menuLanguage: 'Idioma', themeSystem: 'Seguir navegador', themeUseLight: 'Usar fondo claro', themeUseDark: 'Usar fondo oscuro', gatheringEvidence: 'Recopilando datos públicos…'
  },
  fr: { badge: 'Données publiques réunies au même endroit', heroTitle: 'Je rassemble d’abord les données.', heroSubTitle: 'Ensuite, vous décidez ce que vous voulez demander.', heroText: 'GroundSurf recherche les données publiques disponibles sur ce terrain — cadastre, sous-sol, eau, urbanisme, environnement et contexte local — et les rend explorables.', whereTitle: 'Où devons-nous chercher ?', whereHint: 'Recherchez une adresse ou choisissez le terrain sur la carte.', addressFlow: 'Adresse → parcelle → données', promiseLabel: 'La promesse', promiseMain: 'Je rassemble les données publiques que je peux trouver.', promiseQuestion: 'Que souhaitez-vous savoir ?', evidenceFirst: 'Les données avant l’explication.', unknownsVisible: 'Les inconnues restent visibles.', sourceTrail: 'Chaque réponse peut mener à sa source.', gatherButton: 'Rassembler les données', screeningNote: 'Il s’agit d’un premier examen, pas d’une certification juridique ou d’ingénierie.', findingParcel: 'Recherche de la parcelle officielle…', officialParcel: 'Parcelle officielle identifiée.', landReady: 'Terrain sélectionné et prêt.', chooseLand: 'Choisissez le terrain sur la carte.', menuLanguage: 'Langue', themeSystem: 'Suivre le navigateur', themeUseLight: 'Utiliser un fond clair', themeUseDark: 'Utiliser un fond sombre', gatheringEvidence: 'Collecte des données publiques…'
  },
  no: { badge: 'Offentlige data samlet på ett sted', heroTitle: 'Først samler jeg dokumentasjonen.', heroSubTitle: 'Deretter bestemmer du hva du vil spørre om.', heroText: 'GroundSurf søker etter tilgjengelige offentlige data om denne eiendommen — matrikkel, grunnforhold, vann, planlegging, miljø og lokal kontekst — og gjør dem tilgjengelige for utforsking.', whereTitle: 'Hvor skal vi lete?', whereHint: 'Søk etter en adresse eller velg eiendommen på kartet.', addressFlow: 'Adresse → eiendom → dokumentasjon', promiseLabel: 'Løftet', promiseMain: 'Jeg samler de offentlige dataene jeg kan finne.', promiseQuestion: 'Hva vil du vite?', evidenceFirst: 'Dokumentasjon før forklaring.', unknownsVisible: 'Det som er ukjent, forblir synlig.', sourceTrail: 'Hvert svar kan føres tilbake til kilden.', gatherButton: 'Samle data', screeningNote: 'Dette er en foreløpig gjennomgang, ikke en juridisk eller ingeniørmessig sertifisering.', findingParcel: 'Finner den offisielle eiendommen…', officialParcel: 'Offisiell eiendom identifisert.', landReady: 'Eiendom valgt og klar.', chooseLand: 'Velg eiendommen på kartet.', menuLanguage: 'Språk', themeSystem: 'Følg nettleseren', themeUseLight: 'Bruk lys bakgrunn', themeUseDark: 'Bruk mørk bakgrunn', gatheringEvidence: 'Samler offentlige data…'
  },
  fi: { badge: 'Julkiset tiedot koottuna yhteen paikkaan', heroTitle: 'Ensin kokoan tiedot.', heroSubTitle: 'Sitten päätät, mitä haluat kysyä.', heroText: 'GroundSurf etsii tästä maa-alueesta saatavilla olevat julkiset tiedot — kiinteistörekisterin, maaperän, veden, kaavoituksen, ympäristön ja paikallisen kontekstin — ja tekee niistä tutkittavia.', whereTitle: 'Mistä etsitään?', whereHint: 'Hae osoitetta tai valitse alue kartalta.', addressFlow: 'Osoite → kiinteistö → tiedot', promiseLabel: 'Lupaus', promiseMain: 'Kokoan löytämäni julkiset tiedot.', promiseQuestion: 'Mitä haluaisit tietää?', evidenceFirst: 'Tiedot ennen selitystä.', unknownsVisible: 'Epävarmuudet pysyvät näkyvissä.', sourceTrail: 'Jokainen vastaus voi johtaa takaisin lähteeseen.', gatherButton: 'Kerää tiedot', screeningNote: 'Tämä on alustava selvitys, ei oikeudellinen tai insinööritekninen varmennus.', findingParcel: 'Etsitään virallista kiinteistöä…', officialParcel: 'Virallinen kiinteistö tunnistettu.', landReady: 'Alue valittu ja valmis.', chooseLand: 'Valitse alue kartalta.', menuLanguage: 'Kieli', themeSystem: 'Seuraa selainta', themeUseLight: 'Käytä vaaleaa taustaa', themeUseDark: 'Käytä tummaa taustaa', gatheringEvidence: 'Kerätään julkisia tietoja…'
  },
  sv: { badge: 'Offentliga uppgifter samlade på ett ställe', heroTitle: 'Först samlar jag uppgifterna.', heroSubTitle: 'Sedan bestämmer du vad du vill fråga om.', heroText: 'GroundSurf söker efter tillgängliga offentliga uppgifter om marken — fastighetsdata, markförhållanden, vatten, planering, miljö och lokala förhållanden — och gör dem möjliga att utforska.', whereTitle: 'Var ska vi leta?', whereHint: 'Sök efter en adress eller välj marken på kartan.', addressFlow: 'Adress → fastighet → uppgifter', promiseLabel: 'Löftet', promiseMain: 'Jag samlar de offentliga uppgifter jag kan hitta.', promiseQuestion: 'Vad vill du veta?', evidenceFirst: 'Uppgifter före förklaring.', unknownsVisible: 'Det okända förblir synligt.', sourceTrail: 'Varje svar kan leda tillbaka till sin källa.', gatherButton: 'Samla uppgifter', screeningNote: 'Detta är en inledande granskning, inte en juridisk eller ingenjörsmässig certifiering.', findingParcel: 'Letar efter den officiella fastigheten…', officialParcel: 'Officiell fastighet identifierad.', landReady: 'Mark vald och klar.', chooseLand: 'Välj marken på kartan.', menuLanguage: 'Språk', themeSystem: 'Följ webbläsaren', themeUseLight: 'Använd ljus bakgrund', themeUseDark: 'Använd mörk bakgrund', gatheringEvidence: 'Samlar offentliga uppgifter…'
  },
  pl: {
    badge: 'Publiczne dane zebrane w jednym miejscu',
    heroTitle: 'Najpierw zbieram dowody.',
    heroSubTitle: 'Potem decydujesz, o co chcesz zapytać.',
    heroText: 'GroundSurf zbiera dostępne publiczne dane o tej działce — kataster, podłoże, wodę, planowanie, środowisko i otoczenie — i przedstawia je w formie, którą możesz samodzielnie sprawdzać.',
    whereTitle: 'Gdzie szukamy?',
    whereHint: 'Wyszukaj adres lub wybierz działkę na mapie.',
    addressFlow: 'Adres → działka → dowody',
    promiseLabel: 'Obietnica',
    promiseMain: 'Zbieram dostępne publiczne dowody.',
    promiseQuestion: 'Czego chcesz się dowiedzieć?',
    evidenceFirst: 'Najpierw dowody, potem wyjaśnienie.',
    unknownsVisible: 'Niewiadome pozostają widoczne.',
    sourceTrail: 'Każda odpowiedź może prowadzić do źródła.',
    gatherButton: 'Zbierz dane',
    screeningNote: 'To wstępna analiza danych, a nie potwierdzenie prawne ani inżynierskie.',
    findingParcel: 'Wyszukiwanie oficjalnej działki…',
    officialParcel: 'Oficjalna działka została zidentyfikowana.',
    landReady: 'Działka wybrana i gotowa.',
    chooseLand: 'Wybierz działkę na mapie.',
    menuLanguage: 'Język',
    themeSystem: 'Zgodnie z przeglądarką', themeUseLight: 'Użyj jasnego tła', themeUseDark: 'Użyj ciemnego tła',
    gatheringEvidence: 'Zbieranie publicznych danych…'
  }
} as const;

type GroundSurfCopyKey = keyof typeof GROUND_SURF_COPY.en;
type ThemePreference = 'system' | 'light' | 'dark';

function groundSurfCopy(language: string, key: GroundSurfCopyKey): string {
  const locale = String(language || '').toLowerCase().split('-')[0];
  const selected = locale === 'de' ? 'de' : locale === 'pl' ? 'pl' : locale === 'cs' ? 'cs' : locale === 'da' ? 'da' : locale === 'nl' ? 'nl' : locale === 'hr' ? 'hr' : 'en';
  return GROUND_SURF_COPY[selected][key];
}

const APP_UI_COPY = {
  en: {
    evidenceGathered: 'Evidence gathered', detailedReport: 'Detailed report', adviser: 'GroundSurf adviser', askDirectly: 'Ask directly',
    gathered: 'I gathered the public evidence.', askIntro: 'What would you like to know?', evidenceItems: 'Evidence items',
    found: 'Here’s what I found.', orientation: 'A first orientation before you start asking questions.',
    itemsGathered: 'evidence items gathered', detailedTrail: 'The detailed report keeps the full evidence trail, methodology and source record.',
    openDetailed: 'Open detailed report', askAnything: 'Now ask anything.', promptsHint: 'These are prompts, not a menu. Ask in your own words too.',
    where: 'Where it is', ground: 'Ground', water: 'Water', planning: 'Planning',
    established: 'Established', mapped: 'Mapped', open: 'Open',
    place: 'The place', area: 'Area', parcel: 'Parcel', official: 'Official', notConfirmed: 'Not confirmed',
    evidenceMap: 'Evidence map', evidenceItem: 'evidence item', evidenceItemsPlural: 'evidence items', noMatching: 'No matching record found',
    behindAnswer: 'Evidence behind this answer', goDeeper: 'Go deeper', landRecord: 'The evidence can become a land record.',
    keepRecord: 'Keep the full screening report, sources and open questions together instead of printing a report and losing the trail.',
    sources: 'Sources', searchAnything: 'Ask anything about this land…', looking: 'Looking through the evidence…',
    stillOpen: 'Still open', whatNext: 'What would move this forward?', localHelp: 'Local help',
    website: 'Website', noLocalListing: 'No mapped local listing found', nearbySearch: 'Search nearby professionals',
    askNext: 'You could ask next'
  },
  de: {
    evidenceGathered: 'Belege gesammelt', detailedReport: 'Detaillierter Bericht', adviser: 'GroundSurf-Berater', askDirectly: 'Direkt fragen',
    gathered: 'Ich habe die öffentlichen Belege gesammelt.', askIntro: 'Was möchtest du wissen?', evidenceItems: 'Belege',
    found: 'Das habe ich gefunden.', orientation: 'Eine erste Orientierung, bevor du Fragen stellst.',
    itemsGathered: 'Belege gesammelt', detailedTrail: 'Der detaillierte Bericht bewahrt die vollständige Beweiskette, Methodik und Quellen.',
    openDetailed: 'Detaillierten Bericht öffnen', askAnything: 'Jetzt kannst du fragen.', promptsHint: 'Dies sind Anregungen, kein Menü. Du kannst auch frei fragen.',
    where: 'Wo es liegt', ground: 'Untergrund', water: 'Wasser', planning: 'Planung',
    established: 'Bestätigt', mapped: 'Kartiert', open: 'Offen',
    place: 'Der Ort', area: 'Fläche', parcel: 'Flurstück', official: 'Amtlich', notConfirmed: 'Nicht bestätigt',
    evidenceMap: 'Evidenzkarte', evidenceItem: 'Beleg', evidenceItemsPlural: 'Belege', noMatching: 'Kein passender Nachweis gefunden',
    behindAnswer: 'Belege hinter dieser Antwort', goDeeper: 'Weiter vertiefen', landRecord: 'Aus den Belegen kann ein Grundstücksdatensatz werden.',
    keepRecord: 'Bewahre Vorprüfung, Quellen und offene Fragen gemeinsam auf, statt einen Bericht auszudrucken und die Beweiskette zu verlieren.',
    sources: 'Quellen', searchAnything: 'Frage etwas über dieses Grundstück…', looking: 'Ich prüfe die Belege…',
    stillOpen: 'Noch offen', whatNext: 'Was würde hier weiterhelfen?', localHelp: 'Hilfe vor Ort',
    website: 'Website', noLocalListing: 'Kein passender lokaler Eintrag gefunden', nearbySearch: 'Fachleute in der Nähe suchen',
    askNext: 'Das könntest du als Nächstes fragen'
  },
  cs: {
    evidenceGathered: 'Důkazy shromážděny', detailedReport: 'Podrobná zpráva', adviser: 'Poradce GroundSurf', askDirectly: 'Zeptat se přímo', gathered: 'Shromáždil jsem veřejné důkazy.', askIntro: 'Co byste chtěli vědět?', evidenceItems: 'Důkazy', found: 'Tohle jsem našel.', orientation: 'První orientace před položením otázek.', itemsGathered: 'shromážděných důkazů', detailedTrail: 'Podrobná zpráva zachovává úplnou stopu důkazů, metodiku a zdroje.', openDetailed: 'Otevřít podrobnou zprávu', askAnything: 'Nyní se můžete zeptat.', promptsHint: 'Jsou to podněty, ne nabídka. Můžete se zeptat i vlastními slovy.', where: 'Kde se nachází', ground: 'Podloží', water: 'Voda', planning: 'Plánování', established: 'Potvrzeno', mapped: 'Zmapováno', open: 'Otevřeno', place: 'Místo', area: 'Plocha', parcel: 'Parcela', official: 'Oficiální', notConfirmed: 'Nepotvrzeno', evidenceMap: 'Mapa důkazů', evidenceItem: 'důkaz', evidenceItemsPlural: 'důkazy', noMatching: 'Nebyl nalezen odpovídající záznam', behindAnswer: 'Důkazy za touto odpovědí', goDeeper: 'Prověřit podrobněji', landRecord: 'Z důkazů může vzniknout úplný záznam pozemku.', keepRecord: 'Uchovejte úplnou prověrku, zdroje a otevřené otázky pohromadě, abyste neztratili stopu důkazů.', sources: 'Zdroje', searchAnything: 'Zeptejte se na tento pozemek…', looking: 'Procházím shromážděné důkazy…', stillOpen: 'Stále otevřené', whatNext: 'Co pomůže udělat další krok?', localHelp: 'Místní pomoc', website: 'Web', noLocalListing: 'Nebyl nalezen odpovídající místní záznam', nearbySearch: 'Hledat odborníky v okolí', askNext: 'Můžete se zeptat dál'
  },
  da: {
    evidenceGathered: 'Oplysninger samlet', detailedReport: 'Detaljeret rapport', adviser: 'GroundSurf-rådgiver', askDirectly: 'Spørg direkte', gathered: 'Jeg samlede de offentlige oplysninger.', askIntro: 'Hvad vil du gerne vide?', evidenceItems: 'Oplysninger', found: 'Det fandt jeg.', orientation: 'Et første overblik, før du begynder at stille spørgsmål.', itemsGathered: 'indsamlede oplysninger', detailedTrail: 'Den detaljerede rapport bevarer hele dokumentationssporet, metoden og kilderne.', openDetailed: 'Åbn detaljeret rapport', askAnything: 'Spørg om hvad som helst.', promptsHint: 'Dette er forslag, ikke en menu. Du kan også spørge med dine egne ord.', where: 'Hvor den ligger', ground: 'Undergrund', water: 'Vand', planning: 'Planlægning', established: 'Fastlagt', mapped: 'Kortlagt', open: 'Åbent', place: 'Stedet', area: 'Areal', parcel: 'Matrikel', official: 'Officiel', notConfirmed: 'Ikke bekræftet', evidenceMap: 'Kort over oplysninger', evidenceItem: 'oplysning', evidenceItemsPlural: 'oplysninger', noMatching: 'Ingen passende registrering fundet', behindAnswer: 'Oplysninger bag dette svar', goDeeper: 'Undersøg nærmere', landRecord: 'Oplysningerne kan samles i en komplet ejendomsoversigt.', keepRecord: 'Bevar screening, kilder og åbne spørgsmål samlet, så dokumentationssporet ikke går tabt.', sources: 'Kilder', searchAnything: 'Spørg om denne grund…', looking: 'Gennemgår de samlede oplysninger…', stillOpen: 'Stadig åbent', whatNext: 'Hvad kan bringe sagen videre?', localHelp: 'Lokal hjælp', website: 'Websted', noLocalListing: 'Ingen passende lokal registrering fundet', nearbySearch: 'Søg efter fagfolk i nærheden', askNext: 'Du kan spørge videre'
  },
  nl: {
    evidenceGathered: 'Gegevens verzameld', detailedReport: 'Gedetailleerd rapport', adviser: 'GroundSurf-adviseur', askDirectly: 'Direct vragen', gathered: 'Ik heb de openbare gegevens verzameld.', askIntro: 'Wat wil je weten?', evidenceItems: 'Gegevens', found: 'Dit heb ik gevonden.', orientation: 'Een eerste oriëntatie voordat je vragen gaat stellen.', itemsGathered: 'gegevens verzameld', detailedTrail: 'Het gedetailleerde rapport bewaart de volledige bewijsketen, methode en bronnen.', openDetailed: 'Gedetailleerd rapport openen', askAnything: 'Vraag nu wat je wilt.', promptsHint: 'Dit zijn voorbeelden, geen menu. Je kunt ook je eigen woorden gebruiken.', where: 'Waar het ligt', ground: 'Ondergrond', water: 'Water', planning: 'Planologie', established: 'Vastgesteld', mapped: 'In kaart gebracht', open: 'Open', place: 'De locatie', area: 'Oppervlakte', parcel: 'Perceel', official: 'Officieel', notConfirmed: 'Niet bevestigd', evidenceMap: 'Gegevenskaart', evidenceItem: 'gegeven', evidenceItemsPlural: 'gegevens', noMatching: 'Geen passend record gevonden', behindAnswer: 'Gegevens achter dit antwoord', goDeeper: 'Verder onderzoeken', landRecord: 'De gegevens kunnen een volledig perceeloverzicht vormen.', keepRecord: 'Bewaar de volledige screening, bronnen en open vragen samen zodat de bewijsketen intact blijft.', sources: 'Bronnen', searchAnything: 'Vraag iets over dit terrein…', looking: 'Ik bekijk de verzamelde gegevens…', stillOpen: 'Nog open', whatNext: 'Wat helpt om verder te komen?', localHelp: 'Lokale hulp', website: 'Website', noLocalListing: 'Geen passende lokale vermelding gevonden', nearbySearch: 'Professionals in de buurt zoeken', askNext: 'Je kunt verder vragen'
  },
  hr: {
    evidenceGathered: 'Dokazi prikupljeni', detailedReport: 'Detaljno izvješće', adviser: 'GroundSurf savjetnik', askDirectly: 'Pitajte izravno', gathered: 'Prikupio sam javno dostupne dokaze.', askIntro: 'Što želite saznati?', evidenceItems: 'Dokazi', found: 'Evo što sam pronašao.', orientation: 'Prvi pregled prije postavljanja pitanja.', itemsGathered: 'prikupljenih dokaza', detailedTrail: 'Detaljno izvješće čuva potpun trag dokaza, metodologiju i izvore.', openDetailed: 'Otvori detaljno izvješće', askAnything: 'Sada pitajte bilo što.', promptsHint: 'Ovo su prijedlozi, a ne izbornik. Možete pitati i vlastitim riječima.', where: 'Gdje se nalazi', ground: 'Podzemlje', water: 'Voda', planning: 'Planiranje', established: 'Utvrđeno', mapped: 'Kartirano', open: 'Otvoreno', place: 'Lokacija', area: 'Površina', parcel: 'Čestica', official: 'Službeno', notConfirmed: 'Nije potvrđeno', evidenceMap: 'Karta dokaza', evidenceItem: 'dokaz', evidenceItemsPlural: 'dokazi', noMatching: 'Nije pronađen odgovarajući zapis', behindAnswer: 'Dokazi iza ovog odgovora', goDeeper: 'Provjeri detaljnije', landRecord: 'Od dokaza može nastati potpuni zapis zemljišta.', keepRecord: 'Sačuvajte provjeru, izvore i otvorena pitanja zajedno kako se ne bi izgubio trag dokaza.', sources: 'Izvori', searchAnything: 'Pitajte o ovom zemljištu…', looking: 'Pregledavam prikupljene dokaze…', stillOpen: 'Još otvoreno', whatNext: 'Što bi pomoglo za sljedeći korak?', localHelp: 'Lokalna pomoć', website: 'Web-stranica', noLocalListing: 'Nije pronađen odgovarajući lokalni zapis', nearbySearch: 'Potražite stručnjake u blizini', askNext: 'Možete pitati dalje'
  },
  es: { evidenceGathered: 'Datos recopilados', detailedReport: 'Informe detallado', adviser: 'Asesor de GroundSurf', askDirectly: 'Preguntar directamente', gathered: 'He recopilado los datos públicos.', askIntro: '¿Qué te gustaría saber?', evidenceItems: 'Elementos de evidencia', found: 'Esto es lo que he encontrado.', orientation: 'Una primera orientación antes de empezar a preguntar.', itemsGathered: 'elementos de evidencia recopilados', detailedTrail: 'El informe detallado conserva toda la trazabilidad de la evidencia, la metodología y las fuentes.', openDetailed: 'Abrir informe detallado', askAnything: 'Ahora puedes preguntar lo que quieras.', promptsHint: 'Son sugerencias, no un menú. También puedes preguntar con tus propias palabras.', where: 'Dónde está', ground: 'Subsuelo', water: 'Agua', planning: 'Planificación', established: 'Establecido', mapped: 'Mapeado', open: 'Abierto', place: 'El lugar', area: 'Superficie', parcel: 'Parcela', official: 'Oficial', notConfirmed: 'No confirmado', evidenceMap: 'Mapa de evidencias', evidenceItem: 'elemento de evidencia', evidenceItemsPlural: 'elementos de evidencia', noMatching: 'No se encontró un registro coincidente', behindAnswer: 'Evidencia detrás de esta respuesta', goDeeper: 'Profundizar', landRecord: 'Las evidencias pueden convertirse en un registro completo del terreno.', keepRecord: 'Conserva juntos el análisis, las fuentes y las preguntas abiertas para no perder la trazabilidad.', sources: 'Fuentes', searchAnything: 'Pregunta sobre este terreno…', looking: 'Revisando las evidencias…', stillOpen: 'Sigue abierto', whatNext: '¿Qué ayudaría a avanzar?', localHelp: 'Ayuda local', website: 'Sitio web', noLocalListing: 'No se encontró una referencia local adecuada', nearbySearch: 'Buscar profesionales cercanos', askNext: 'Puedes preguntar a continuación'
  },
  fr: { evidenceGathered: 'Données recueillies', detailedReport: 'Rapport détaillé', adviser: 'Conseiller GroundSurf', askDirectly: 'Poser une question', gathered: 'J’ai rassemblé les données publiques.', askIntro: 'Que souhaitez-vous savoir ?', evidenceItems: 'Éléments de données', found: 'Voici ce que j’ai trouvé.', orientation: 'Un premier aperçu avant de commencer à poser des questions.', itemsGathered: 'éléments de données recueillis', detailedTrail: 'Le rapport détaillé conserve la traçabilité complète des données, la méthodologie et les sources.', openDetailed: 'Ouvrir le rapport détaillé', askAnything: 'Vous pouvez maintenant tout demander.', promptsHint: 'Ce sont des suggestions, pas un menu. Vous pouvez aussi poser votre question avec vos propres mots.', where: 'Où il se trouve', ground: 'Sous-sol', water: 'Eau', planning: 'Urbanisme', established: 'Établi', mapped: 'Cartographié', open: 'Ouvert', place: 'Le lieu', area: 'Surface', parcel: 'Parcelle', official: 'Officiel', notConfirmed: 'Non confirmé', evidenceMap: 'Carte des données', evidenceItem: 'élément de donnée', evidenceItemsPlural: 'éléments de données', noMatching: 'Aucun enregistrement correspondant', behindAnswer: 'Données derrière cette réponse', goDeeper: 'Approfondir', landRecord: 'Les données peuvent devenir un dossier complet du terrain.', keepRecord: 'Conservez ensemble l’analyse, les sources et les questions ouvertes afin de garder toute la traçabilité.', sources: 'Sources', searchAnything: 'Posez une question sur ce terrain…', looking: 'Je consulte les données…', stillOpen: 'Encore ouvert', whatNext: 'Qu’est-ce qui permettrait d’aller plus loin ?', localHelp: 'Aide locale', website: 'Site web', noLocalListing: 'Aucune référence locale correspondante trouvée', nearbySearch: 'Rechercher des professionnels à proximité', askNext: 'Vous pouvez poser la question suivante'
  },
  no: { evidenceGathered: 'Data samlet', detailedReport: 'Detaljert rapport', adviser: 'GroundSurf-rådgiver', askDirectly: 'Spør direkte', gathered: 'Jeg samlet de offentlige dataene.', askIntro: 'Hva vil du vite?', evidenceItems: 'Datagrunnlag', found: 'Dette fant jeg.', orientation: 'En første orientering før du begynner å stille spørsmål.', itemsGathered: 'innsamlede dataelementer', detailedTrail: 'Den detaljerte rapporten bevarer hele dokumentasjonssporet, metoden og kildene.', openDetailed: 'Åpne detaljert rapport', askAnything: 'Spør om hva du vil.', promptsHint: 'Dette er forslag, ikke en meny. Du kan også spørre med egne ord.', where: 'Hvor den ligger', ground: 'Grunnforhold', water: 'Vann', planning: 'Planlegging', established: 'Fastslått', mapped: 'Kartlagt', open: 'Åpent', place: 'Stedet', area: 'Areal', parcel: 'Eiendom', official: 'Offisiell', notConfirmed: 'Ikke bekreftet', evidenceMap: 'Dokumentasjonskart', evidenceItem: 'dataelement', evidenceItemsPlural: 'dataelementer', noMatching: 'Ingen samsvarende registrering funnet', behindAnswer: 'Dokumentasjon bak dette svaret', goDeeper: 'Undersøk mer', landRecord: 'Dataene kan bli til en komplett oversikt over eiendommen.', keepRecord: 'Bevar gjennomgangen, kildene og de åpne spørsmålene samlet slik at dokumentasjonssporet ikke går tapt.', sources: 'Kilder', searchAnything: 'Spør om denne eiendommen…', looking: 'Går gjennom dokumentasjonen…', stillOpen: 'Fortsatt åpent', whatNext: 'Hva kan hjelpe oss videre?', localHelp: 'Lokal hjelp', website: 'Nettsted', noLocalListing: 'Ingen passende lokal registrering funnet', nearbySearch: 'Søk etter fagfolk i nærheten', askNext: 'Du kan spørre videre'
  },
  fi: { evidenceGathered: 'Tiedot kerätty', detailedReport: 'Yksityiskohtainen raportti', adviser: 'GroundSurf-neuvoja', askDirectly: 'Kysy suoraan', gathered: 'Kokosin julkiset tiedot.', askIntro: 'Mitä haluaisit tietää?', evidenceItems: 'Tietoelementit', found: 'Tässä on, mitä löysin.', orientation: 'Ensimmäinen yleiskuva ennen kysymysten esittämistä.', itemsGathered: 'tietoelementtiä kerätty', detailedTrail: 'Yksityiskohtainen raportti säilyttää täydellisen tietopolun, menetelmän ja lähteet.', openDetailed: 'Avaa yksityiskohtainen raportti', askAnything: 'Kysy nyt mitä tahansa.', promptsHint: 'Nämä ovat ehdotuksia, eivät valikko. Voit kysyä myös omin sanoin.', where: 'Missä se sijaitsee', ground: 'Maaperä', water: 'Vesi', planning: 'Kaavoitus', established: 'Vahvistettu', mapped: 'Kartoitettu', open: 'Avoin', place: 'Sijainti', area: 'Pinta-ala', parcel: 'Kiinteistö', official: 'Virallinen', notConfirmed: 'Ei vahvistettu', evidenceMap: 'Tietokartta', evidenceItem: 'tietoelementti', evidenceItemsPlural: 'tietoelementtiä', noMatching: 'Sopivaa tietuetta ei löytynyt', behindAnswer: 'Tämän vastauksen taustalla olevat tiedot', goDeeper: 'Tutki tarkemmin', landRecord: 'Tiedoista voi muodostaa täydellisen kiinteistötietueen.', keepRecord: 'Säilytä koko selvitys, lähteet ja avoimet kysymykset yhdessä, jotta tietopolku säilyy.', sources: 'Lähteet', searchAnything: 'Kysy tästä maa-alueesta…', looking: 'Käyn tietoja läpi…', stillOpen: 'Vielä avoinna', whatNext: 'Mikä auttaisi etenemään?', localHelp: 'Paikallinen apu', website: 'Verkkosivusto', noLocalListing: 'Sopivaa paikallista kohdetta ei löytynyt', nearbySearch: 'Hae asiantuntijoita lähistöltä', askNext: 'Voit kysyä seuraavaksi'
  },
  sv: { evidenceGathered: 'Uppgifter samlade', detailedReport: 'Detaljerad rapport', adviser: 'GroundSurf-rådgivare', askDirectly: 'Fråga direkt', gathered: 'Jag samlade de offentliga uppgifterna.', askIntro: 'Vad vill du veta?', evidenceItems: 'Uppgifter', found: 'Det här hittade jag.', orientation: 'En första överblick innan du börjar ställa frågor.', itemsGathered: 'uppgifter samlade', detailedTrail: 'Den detaljerade rapporten bevarar hela informationsspåret, metoden och källorna.', openDetailed: 'Öppna detaljerad rapport', askAnything: 'Fråga om vad du vill.', promptsHint: 'Det här är förslag, inte en meny. Du kan också fråga med egna ord.', where: 'Var den ligger', ground: 'Markförhållanden', water: 'Vatten', planning: 'Planering', established: 'Fastställt', mapped: 'Kartlagt', open: 'Öppet', place: 'Platsen', area: 'Areal', parcel: 'Fastighet', official: 'Officiell', notConfirmed: 'Inte bekräftat', evidenceMap: 'Informationskarta', evidenceItem: 'uppgift', evidenceItemsPlural: 'uppgifter', noMatching: 'Ingen matchande registrering hittades', behindAnswer: 'Underlaget bakom svaret', goDeeper: 'Fördjupa', landRecord: 'Uppgifterna kan bli en fullständig fastighetsöversikt.', keepRecord: 'Bevara hela granskningen, källorna och de öppna frågorna tillsammans så att informationsspåret inte går förlorat.', sources: 'Källor', searchAnything: 'Fråga om denna mark…', looking: 'Jag går igenom uppgifterna…', stillOpen: 'Fortfarande öppet', whatNext: 'Vad skulle hjälpa oss vidare?', localHelp: 'Lokal hjälp', website: 'Webbplats', noLocalListing: 'Ingen lämplig lokal post hittades', nearbySearch: 'Sök efter yrkespersoner i närheten', askNext: 'Du kan fråga vidare'
  },
  pl: {
    evidenceGathered: 'Dane zebrane', detailedReport: 'Szczegółowy raport', adviser: 'Doradca GroundSurf', askDirectly: 'Zapytaj bezpośrednio',
    gathered: 'Zebrałem publiczne dane.', askIntro: 'Czego chcesz się dowiedzieć?', evidenceItems: 'Elementy dowodowe',
    found: 'Oto, co znaleźliśmy.', orientation: 'Pierwsze rozeznanie przed zadaniem pytań.',
    itemsGathered: 'elementów dowodowych zebrano', detailedTrail: 'Szczegółowy raport zachowuje pełną ścieżkę dowodową, metodologię i rejestr źródeł.',
    openDetailed: 'Otwórz szczegółowy raport', askAnything: 'Zapytaj o cokolwiek.', promptsHint: 'To są przykładowe pytania, nie menu. Możesz też zapytać własnymi słowami.',
    where: 'Gdzie się znajduje', ground: 'Podłoże', water: 'Woda', planning: 'Planowanie',
    established: 'Ustalone', mapped: 'Zmapowane', open: 'Otwarte',
    place: 'Miejsce', area: 'Powierzchnia', parcel: 'Działka', official: 'Oficjalne', notConfirmed: 'Niepotwierdzone',
    evidenceMap: 'Mapa dowodów', evidenceItem: 'element dowodowy', evidenceItemsPlural: 'elementy dowodowe', noMatching: 'Nie znaleziono pasującego rekordu',
    behindAnswer: 'Dowody stojące za tą odpowiedzią', goDeeper: 'Sprawdź dokładniej', landRecord: 'Z dowodów może powstać pełny zapis działki.',
    keepRecord: 'Zachowaj pełną analizę, źródła i otwarte pytania razem, zamiast drukować raport i tracić ścieżkę dowodową.',
    sources: 'Źródła', searchAnything: 'Zapytaj o tę działkę…', looking: 'Sprawdzam zebrane dowody…',
    stillOpen: 'Nadal otwarte', whatNext: 'Co pomoże zrobić kolejny krok?', localHelp: 'Pomoc lokalna',
    website: 'Strona internetowa', noLocalListing: 'Nie znaleziono lokalnego wpisu', nearbySearch: 'Znajdź specjalistów w pobliżu',
    askNext: 'Możesz zapytać dalej'
  }
} as const;

type AppUiCopyKey = keyof typeof APP_UI_COPY.en;

function appUiCopy(language: string, key: AppUiCopyKey): string {
  const locale = String(language || '').toLowerCase().split('-')[0];
  const selected = locale === 'de' ? 'de' : locale === 'pl' ? 'pl' : locale === 'cs' ? 'cs' : locale === 'da' ? 'da' : locale === 'nl' ? 'nl' : locale === 'hr' ? 'hr' : locale === 'es' ? 'es' : locale === 'fr' ? 'fr' : locale === 'no' ? 'no' : locale === 'fi' ? 'fi' : locale === 'sv' ? 'sv' : 'en';
  return APP_UI_COPY[selected][key];
}

function findingSummary(report: SiteReport, language: string) {
  const data = report.report_data;
  const ground = data.ground_context;
  const locale = String(language || '').toLowerCase().split('-')[0];
  const isGerman = locale === 'de';
  const isPolish = locale === 'pl';
  const summaryCopy = {
    cs: { parcel: 'Oficiální parcela identifikována', parcelOpen: 'Oficiální parcela nepotvrzena', ground: 'Dostupné regionální informace o podloží', water: 'Vodní poměry jsou částečně otevřené', planning: 'Plánovací informace vyžadují místní potvrzení', where: 'Kde se nachází', groundLabel: 'Podloží', waterLabel: 'Voda', planningLabel: 'Plánování' },
    da: { parcel: 'Officiel matrikel identificeret', parcelOpen: 'Officiel matrikel ikke bekræftet', ground: 'Regionale oplysninger om undergrunden er tilgængelige', water: 'Vandforholdene er delvist åbne', planning: 'Planoplysninger kræver lokal bekræftelse', where: 'Hvor den ligger', groundLabel: 'Undergrund', waterLabel: 'Vand', planningLabel: 'Planlægning' },
    nl: { parcel: 'Officieel perceel geïdentificeerd', parcelOpen: 'Officieel perceel niet bevestigd', ground: 'Regionale informatie over de ondergrond beschikbaar', water: 'Watercondities zijn gedeeltelijk onbekend', planning: 'Planologische informatie moet lokaal worden bevestigd', where: 'Waar het ligt', groundLabel: 'Ondergrond', waterLabel: 'Water', planningLabel: 'Planologie' },
    hr: { parcel: 'Službena katastarska čestica identificirana', parcelOpen: 'Službena katastarska čestica nije potvrđena', ground: 'Dostupne su regionalne informacije o podzemlju', water: 'Stanje voda je djelomično otvoreno', planning: 'Informacije o planiranju zahtijevaju lokalnu potvrdu', where: 'Gdje se nalazi', groundLabel: 'Podzemlje', waterLabel: 'Voda', planningLabel: 'Planiranje' },
    es: { parcel: 'Parcela oficial identificada', parcelOpen: 'Parcela oficial no confirmada', ground: 'Hay información regional disponible sobre el subsuelo', water: 'Las condiciones del agua están parcialmente abiertas', planning: 'La información de planificación requiere confirmación local', where: 'Dónde está', groundLabel: 'Subsuelo', waterLabel: 'Agua', planningLabel: 'Planificación' },
    fr: { parcel: 'Parcelle officielle identifiée', parcelOpen: 'Parcelle officielle non confirmée', ground: 'Des informations régionales sur le sous-sol sont disponibles', water: 'Les conditions hydriques restent partiellement ouvertes', planning: 'Les informations d’urbanisme doivent être confirmées localement', where: 'Où il se trouve', groundLabel: 'Sous-sol', waterLabel: 'Eau', planningLabel: 'Urbanisme' },
    no: { parcel: 'Offisiell eiendom identifisert', parcelOpen: 'Offisiell eiendom ikke bekreftet', ground: 'Regionale opplysninger om grunnforhold er tilgjengelige', water: 'Vannforholdene er delvis åpne', planning: 'Planopplysninger må bekreftes lokalt', where: 'Hvor den ligger', groundLabel: 'Grunnforhold', waterLabel: 'Vann', planningLabel: 'Planlegging' },
    fi: { parcel: 'Virallinen kiinteistö tunnistettu', parcelOpen: 'Virallista kiinteistöä ei ole vahvistettu', ground: 'Alueellisesta maaperästä on saatavilla tietoa', water: 'Vesiolosuhteet ovat osittain avoimia', planning: 'Kaavoitustiedot on vahvistettava paikallisesti', where: 'Missä se sijaitsee', groundLabel: 'Maaperä', waterLabel: 'Vesi', planningLabel: 'Kaavoitus' },
    sv: { parcel: 'Officiell fastighet identifierad', parcelOpen: 'Officiell fastighet inte bekräftad', ground: 'Regional information om markförhållanden finns tillgänglig', water: 'Vattenförhållandena är delvis öppna', planning: 'Planeringsuppgifter behöver bekräftas lokalt', where: 'Var den ligger', groundLabel: 'Markförhållanden', waterLabel: 'Vatten', planningLabel: 'Planering' }
  }[locale as 'cs' | 'da' | 'nl' | 'hr' | 'es' | 'fr' | 'no' | 'fi' | 'sv'] || null;
  const ukMappedOutline = report.country_code === 'GB' && Array.isArray(report.mapped_geometry) && report.mapped_geometry.length >= 3;
  const parcel = report.country_code === 'GB'
    ? (ukMappedOutline ? 'HMLR registered-property outline identified' : 'HMLR registered-property outline not confirmed')
    : report.is_official_parcel
      ? (isGerman ? 'Amtliches Flurstück identifiziert' : isPolish ? 'Oficjalna działka została zidentyfikowana' : summaryCopy?.parcel || 'Official parcel identified')
      : (isGerman ? 'Amtliches Flurstück nicht bestätigt' : isPolish ? 'Oficjalna działka nie została potwierdzona' : summaryCopy?.parcelOpen || 'Official parcel not confirmed');
  const groundText = ground?.summary
    || data.geosurvey_context?.geological_unit_name
    || (isGerman ? 'Regionale Informationen zum Untergrund verfügbar' : isPolish ? 'Dostępne są regionalne informacje o podłożu' : summaryCopy?.ground || 'Regional ground information available');
  const waterText = data.flooding_risk?.summary
    || data.technical_parameters?.groundwater_notice
    || (isGerman ? 'Wasserverhältnisse teilweise offen' : isPolish ? 'Warunki wodne są częściowo nieznane' : summaryCopy?.water || 'Water conditions are partly open');
  const planningText = data.zoning_and_land_use?.summary
    || (isGerman ? 'Planungsinformationen müssen vor Ort bestätigt werden' : isPolish ? 'Informacje planistyczne wymagają potwierdzenia' : summaryCopy?.planning || 'Planning information needs local confirmation');
  return [
    { label: isGerman ? 'Wo es liegt' : isPolish ? 'Gdzie się znajduje' : summaryCopy?.where || 'Where it is', value: parcel, tone: report.is_official_parcel || (report.country_code === 'GB' && ukMappedOutline) ? 'mapped' : 'open' },
    { label: isGerman ? 'Untergrund' : isPolish ? 'Podłoże' : summaryCopy?.groundLabel || 'Ground', value: groundText, tone: ground ? 'mapped' : 'open' },
    { label: isGerman ? 'Wasser' : isPolish ? 'Woda' : summaryCopy?.waterLabel || 'Water', value: waterText, tone: data.flooding_risk?.summary ? 'mapped' : 'open' },
    { label: isGerman ? 'Planung' : isPolish ? 'Planowanie' : summaryCopy?.planningLabel || 'Planning', value: planningText, tone: data.zoning_and_land_use?.summary ? 'mapped' : 'open' }
  ];
}

function evidenceRecords(report: SiteReport) {
  return Array.isArray(report.report_data?.evidence_registry)
    ? report.report_data.evidence_registry
    : [];
}

function categoryMatch(report: SiteReport, terms: readonly string[]) {
  return evidenceRecords(report).filter((record) => {
    const haystack = [
      record.category, record.claim, record.sourceName, record.id
    ].join(' ').toLowerCase();
    return terms.some((term) => haystack.includes(term));
  });
}

function statusLabel(status: string, language = 'en') {
  const locale = String(language || '').toLowerCase().split('-')[0];
  if (locale === 'pl') {
    if (status === 'VERIFIED') return 'Ustalone';
    if (status === 'MODELLED') return 'Zmapowane / modelowane';
    return 'Nadal otwarte';
  }
  if (locale === 'de') {
    if (status === 'VERIFIED') return 'Bestätigt';
    if (status === 'MODELLED') return 'Kartiert / modelliert';
    return 'Noch offen';
  }
  if (locale === 'cs') {
    if (status === 'VERIFIED') return 'Potvrzeno';
    if (status === 'MODELLED') return 'Zmapováno / modelováno';
    return 'Stále otevřené';
  }
  if (locale === 'da') {
    if (status === 'VERIFIED') return 'Fastlagt';
    if (status === 'MODELLED') return 'Kortlagt / modelleret';
    return 'Stadig åbent';
  }
  if (locale === 'nl') {
    if (status === 'VERIFIED') return 'Vastgesteld';
    if (status === 'MODELLED') return 'In kaart gebracht / gemodelleerd';
    return 'Nog open';
  }
  if (locale === 'hr') {
    if (status === 'VERIFIED') return 'Utvrđeno';
    if (status === 'MODELLED') return 'Kartirano / modelirano';
    return 'Još otvoreno';
  }
  if (locale === 'es') {
    if (status === 'VERIFIED') return 'Establecido';
    if (status === 'MODELLED') return 'Mapeado / modelado';
    return 'Sigue abierto';
  }
  if (locale === 'fr') {
    if (status === 'VERIFIED') return 'Établi';
    if (status === 'MODELLED') return 'Cartographié / modélisé';
    return 'Encore ouvert';
  }
  if (locale === 'no') {
    if (status === 'VERIFIED') return 'Fastslått';
    if (status === 'MODELLED') return 'Kartlagt / modellert';
    return 'Fortsatt åpent';
  }
  if (locale === 'fi') {
    if (status === 'VERIFIED') return 'Vahvistettu';
    if (status === 'MODELLED') return 'Kartoitettu / mallinnettu';
    return 'Vielä avoin';
  }
  if (locale === 'sv') {
    if (status === 'VERIFIED') return 'Fastställt';
    if (status === 'MODELLED') return 'Kartlagt / modellerat';
    return 'Fortfarande öppet';
  }
  if (status === 'VERIFIED') return 'Established';
  if (status === 'MODELLED') return 'Mapped / modelled';
  return 'Still open';
}

export const GroundSurfApp: React.FC = () => {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    try {
      const stored = localStorage.getItem('groundsurf_theme');
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
      return 'system';
    }
  });
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  ));
  const isDarkTheme = themePreference === 'dark' || (themePreference === 'system' && systemTheme === 'dark');

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light');
    media.addEventListener?.('change', handleChange);
    return () => media.removeEventListener?.('change', handleChange);
  }, []);

  React.useEffect(() => {
    document.documentElement.dataset.groundsurfTheme = isDarkTheme ? 'dark' : 'light';
    try {
      localStorage.setItem('groundsurf_theme', themePreference);
    } catch {}
  }, [isDarkTheme, themePreference]);

  const toggleTheme = () => {
    const next = themePreference === 'system'
      ? (systemTheme === 'dark' ? 'light' : 'dark')
      : 'system';
    setThemePreference(next);
  };

  const defaultCountry = EUROPEAN_COUNTRIES.find((c) => c.code === 'DE') || EUROPEAN_COUNTRIES[0];
  const [countryCode, setCountryCode] = useState(defaultCountry.code);
  const [language, setLanguage] = useState(normalizeReportLanguage(defaultCountry.language, defaultCountry.code));
  const [shape, setShape] = useState<BoundaryShape | null>(null);
  const [area, setArea] = useState(1000);
  const [report, setReport] = useState<SiteReport | null>(null);
  const [isGathering, setIsGathering] = useState(false);
  const [isFindingParcel, setIsFindingParcel] = useState(false);
  const [officialParcel, setOfficialParcel] = useState<{ parcelId?: string; areaM2?: number } | null>(null);
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [asking, setAsking] = useState(false);
  const languageWasManuallySelected = React.useRef(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    const reportId = new URLSearchParams(window.location.search).get('report_id');
    if (!reportId) return;
    apiFetch('/api/reports/' + encodeURIComponent(reportId))
      .then((res) => res.ok ? res.json() : null)
      .then((saved) => {
        if (!saved?.report_data) return;
        const savedCountry = EUROPEAN_COUNTRIES.find((c) => c.code === String(saved.country_code || '').toUpperCase());
        if (savedCountry) setCountryCode(savedCountry.code);
        setLanguage(normalizeReportLanguage(saved.language || savedCountry?.language || 'en', savedCountry?.code || countryCode));
        setReport(saved);
      })
      .catch(() => {});
  }, []);

  const currentCountry = EUROPEAN_COUNTRIES.find((c) => c.code === countryCode) || defaultCountry;
  const availableLanguages = getAvailableReportLanguages(countryCode, currentCountry.language);
  const copy = (key: GroundSurfCopyKey) => groundSurfCopy(language, key);
  const themeControlLabel = themePreference === 'system'
    ? (isDarkTheme ? copy('themeUseLight') : copy('themeUseDark'))
    : copy('themeSystem');
  const isComplete = Boolean(shape && (
    shape.type === 'circle' ? shape.center :
    shape.type === 'rectangle' ? (shape.corners?.length || 0) >= 2 :
    (shape.points?.length || 0) >= 3
  ));
  const circleRadius = Math.sqrt((area || 1000) / Math.PI);

  const coverage = useMemo(() => {
    if (!report) return [];
    const locale = String(language || '').toLowerCase().split('-')[0];
    return COVERAGE.map(([key, englishLabel, germanLabel, polishLabel, terms]) => ({
      key,
      label: locale === 'de' ? germanLabel : locale === 'pl' ? polishLabel : englishLabel,
      count: categoryMatch(report, terms).length
    }));
  }, [report, language]);

  const handleCountryDetected = (detectedCode: string) => {
    const nextCountry = EUROPEAN_COUNTRIES.find((country) => country.code === String(detectedCode || '').toUpperCase());
    if (!nextCountry) return;
    setCountryCode(nextCountry.code);
    setShape(null);
    setOfficialParcel(null);
    if (!languageWasManuallySelected.current) {
      setLanguage(getDefaultReportLanguageForCountry(nextCountry.code, nextCountry.language));
    } else {
      setLanguage((current) => normalizeReportLanguage(current, nextCountry.code));
    }
  };

  const ask = async (text: string) => {
    const cleaned = text.trim();
    if (!cleaned || !report || asking) return;
    setQuestion('');
    setError('');
    setAsking(true);
    setChat((prev) => [...prev, { question: cleaned }]);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let response = await apiFetch('/api/ai/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify({ report, question: cleaned, language })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'The land adviser could not answer right now.');
      }
      const answer = await response.json();
      answer.actions = Array.isArray(answer?.actions) ? answer.actions : [];
      const localCategories = Array.isArray(answer?.actions)
        ? [...new Set(answer.actions
            .filter((action: any) => action?.kind === 'local_professional' && action?.professionalCategory)
            .map((action: any) => action.professionalCategory as string))]
        : [];
      if (localCategories.length > 0) {
        const lookups = await Promise.all(localCategories.map(async (category) => {
          const helpUrl = '/api/local-help?lat=' + encodeURIComponent(report.latitude) +
            '&lng=' + encodeURIComponent(report.longitude) +
            '&category=' + encodeURIComponent(String(category));
          const helpResponse = await apiFetch(helpUrl).catch(() => null);
          if (!helpResponse?.ok) return [];
          const help = await helpResponse.json().catch(() => null);
          return Array.isArray(help?.businesses) ? help.businesses : [];
        }));
        answer.localBusinesses = lookups.flat().filter((business: any, index: number, all: any[]) =>
          all.findIndex((item: any) => item.name === business.name && item.category === business.category) === index
        ).slice(0, 8);
      }
      setChat((prev) => {
        const next = [...prev];
        next[next.length - 1] = { question: cleaned, answer };
        return next;
      });
    } catch (err: any) {
      const message = err?.message || 'The land adviser could not answer right now.';
      setChat((prev) => {
        const next = [...prev];
        next[next.length - 1] = { question: cleaned, error: message };
        return next;
      });
    } finally {
      setAsking(false);
    }
  };

  const gatherEvidence = async () => {
    if (!shape || !isComplete) return;
    setError('');
    setIsGathering(true);
    try {
      const center = getBoundaryCenter(shape) || currentCountry.defaultCenter;
      const response = await apiFetch('/api/analyze-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shape,
          areaSize: Math.round(area),
          country: currentCountry.name,
          countryCode: currentCountry.code,
          language,
          currency: currentCountry.currency,
          officialParcel: officialParcel || undefined
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'GroundSurf could not gather the evidence.');
      }
      const payload = await response.json();
      const nextReport: SiteReport = payload?.report_data ? {
        ...payload,
        selected_boundary: shape
      } : {
        id: 'ground_' + Math.random().toString(36).slice(2, 9),
        created_at: new Date().toISOString(),
        location_name: payload.location_name || center[0].toFixed(5) + ', ' + center[1].toFixed(5),
        country: currentCountry.name,
        country_code: currentCountry.code,
        language,
        latitude: center[0],
        longitude: center[1],
        area_size: Math.round(area),
        boundary: shape,
        report_data: payload
      };
      setReport(nextReport);
      try {
        localStorage.setItem('groundsurf_report_' + nextReport.id, JSON.stringify(nextReport));
        const saved = localStorage.getItem('saved_site_reports');
        const reports = saved ? JSON.parse(saved) : [];
        const updated = [nextReport, ...(Array.isArray(reports) ? reports.filter((item: any) => item?.id !== nextReport.id) : [])].slice(0, 20);
        localStorage.setItem('saved_site_reports', JSON.stringify(updated));
      } catch {}
      apiFetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextReport)
      }).catch(() => {});
    } catch (err: any) {
      setError(err?.message || 'GroundSurf could not gather the evidence.');
    } finally {
      setIsGathering(false);
    }
  };

  const answer = chat.length ? chat[chat.length - 1].answer : null;
  const last = chat.length ? chat[chat.length - 1] : null;

  if (!report) {
    return (
      <div className="min-h-screen bg-[#f5f7f4] text-slate-900 transition-colors duration-300 dark:bg-[#121713] dark:text-slate-100">
        <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-700/80 dark:bg-[#18201b]/90">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-900 text-white">
                <Layers3 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-black tracking-tight">GroundSurf</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Get to know the land.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-300/80 bg-white/90 text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-white hover:text-slate-950 dark:border-white/15 dark:bg-white/10 dark:text-slate-200 dark:hover:border-white/25 dark:hover:bg-white/15 dark:hover:text-white"
              title={themeControlLabel}
              aria-label={themeControlLabel}
            >
              {isDarkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-7 lg:py-9">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
              <Sparkles className="h-3.5 w-3.5" />
              {copy('badge')}
            </div>
            <h1 className="text-4xl font-black tracking-[-0.03em] text-slate-950 sm:text-5xl lg:text-[3.25rem] dark:text-slate-100">
              {copy('heroTitle')}
              <span className="block text-slate-500 dark:text-slate-400">{copy('heroSubTitle')}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              {copy('heroText')}
            </p>
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-[1.6fr_0.72fr]">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm transition-colors sm:p-5 dark:border-slate-700/80 dark:bg-[#1a201c]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-100">{copy('whereTitle')}</div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy('whereHint')}</div>
                </div>
                  <div className="hidden items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 sm:flex dark:bg-[#232b26] dark:text-slate-400">
                  <Search className="h-3.5 w-3.5" /> {copy('addressFlow')}
                </div>
              </div>
              <MapPicker
                mode="polygon"
                shape={shape}
                onChange={(next) => {
                  setShape(next);
                  if (next) {
                    const calculated = calculateBoundaryArea(next, area);
                    if (calculated > 0) setArea(calculated);
                  }
                }}
                circleRadius={circleRadius}
                onClear={() => { setShape(null); setOfficialParcel(null); }}
                defaultCenter={currentCountry.defaultCenter}
                defaultZoom={currentCountry.defaultZoom}
                language={language}
                countryCode={countryCode}
                onCountryDetected={handleCountryDetected}
                onOfficialParcelSelected={setOfficialParcel}
                onParcelLookupStateChange={setIsFindingParcel}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm transition-colors dark:bg-[#232b26] dark:text-slate-200">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {isFindingParcel ? copy('findingParcel') :
                    officialParcel ? copy('officialParcel') :
                    isComplete ? copy('landReady') : copy('chooseLand')}
                </div>
                {isComplete && <span className="font-black text-slate-800 dark:text-slate-100">{Math.round(area).toLocaleString()} m²</span>}
              </div>
            </section>

            <section className="flex flex-col justify-between rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
              <div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-bold uppercase tracking-[0.16em] text-white/45">{copy('promiseLabel')}</div>
                </div>
                <div className="mt-5 text-2xl font-black leading-tight">
                  {copy('promiseMain')}
                  <span className="mt-2 block text-white/55">{copy('promiseQuestion')}</span>
                </div>
                <div className="mt-6 space-y-3 text-sm leading-6 text-white/70">
                  <div className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />{copy('evidenceFirst')}</div>
                  <div className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />{copy('unknownsVisible')}</div>
                  <div className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />{copy('sourceTrail')}</div>
                </div>
                <div className="mt-9 flex justify-center">
                  <label className="flex w-full max-w-sm flex-col gap-2.5 rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5 text-sm font-bold text-white shadow-sm">
                    <span className="flex items-center gap-2 text-base font-black tracking-tight text-white">
                      <Globe2 className="h-5 w-5 text-white/75" />
                      <span>{copy('menuLanguage')}</span>
                    </span>
                    <select
                      value={language}
                      onChange={(e) => { languageWasManuallySelected.current = true; setLanguage(normalizeReportLanguage(e.target.value, countryCode)); }}
                      className="w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2.5 text-base font-black text-white outline-none focus:border-white/50 focus:ring-2 focus:ring-white/20"
                      aria-label={copy('menuLanguage')}
                    >
                      {availableLanguages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              <div className="mt-8">
                {error && <div className="mb-3 rounded-2xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}
                <button onClick={gatherEvidence} disabled={!isComplete || isGathering} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-black text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30">
                  {isGathering ? <><Loader2 className="h-4 w-4 animate-spin" /> {copy('gatheringEvidence')}</> : <>{copy('gatherButton')} <ArrowRight className="h-4 w-4" /></>}
                </button>
                <div className="mt-3 text-center text-xs text-white/40">{copy('screeningNote')}</div>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  const relevantEvidence = answer?.evidenceIds?.length
    ? evidenceRecords(report).filter((item) => answer.evidenceIds.includes(item.id))
    : [];
  const relevantSources = Array.isArray(report.report_data?.data_sources)
    ? report.report_data.data_sources.filter((item) => !answer || answer.sourceIds.includes(item.name) || answer.sourceIds.includes(item.url || ''))
    : [];

  return (
    <div className="min-h-screen bg-[#f5f7f4] text-slate-900 transition-colors duration-300 dark:bg-[#121713] dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/92 backdrop-blur dark:border-slate-700/80 dark:bg-[#18201b]/92">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => { setReport(null); setChat([]); setError(''); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-black tracking-tight">GroundSurf</div>
                <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 sm:inline">{appUiCopy(language, 'evidenceGathered')}</span>
              </div>
              <div className="truncate text-sm text-slate-500">{report.location_name} · {Math.round(report.area_size).toLocaleString()} m²</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-300/80 bg-white/90 text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-white hover:text-slate-950 dark:border-white/15 dark:bg-white/10 dark:text-slate-200 dark:hover:border-white/25 dark:hover:bg-white/15 dark:hover:text-white"
              title={themeControlLabel}
              aria-label={themeControlLabel}
            >
              {isDarkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <a href={window.location.origin + '/report?report_id=' + encodeURIComponent(report.id)} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-slate-800">
              <FileText className="h-3.5 w-3.5" /> <span>{appUiCopy(language, 'detailedReport')}</span>
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-7">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
          <section className="min-h-[650px] rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="rounded-t-[2rem] bg-slate-950 px-5 py-5 text-white sm:px-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-white/50">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-300" /> {appUiCopy(language, 'adviser')}
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tracking-wide text-white/70">{appUiCopy(language, 'askDirectly')}</span>
                  </div>
                  <h1 className="mt-3 text-3xl font-black tracking-[-0.025em] sm:text-4xl">
                    {appUiCopy(language, 'gathered')}
                  </h1>
                  <p className="mt-2 text-base leading-7 text-white/65">
                    {report.location_name}. {appUiCopy(language, 'askIntro')}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3 text-right ring-1 ring-inset ring-white/10">
                  <div className="text-xs font-black uppercase tracking-wide text-white/45">{appUiCopy(language, 'evidenceItems')}</div>
                  <div className="mt-1 text-2xl font-black text-white">{evidenceRecords(report).length}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-4 sm:p-5">
              {chat.length === 0 && (
                <>
                  <div className="rounded-[1.5rem] border border-slate-200 bg-[#fafcf9] p-5 sm:p-6">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-slate-900">{appUiCopy(language, 'found')}</div>
                        <div className="mt-1 text-sm leading-5 text-slate-500">{appUiCopy(language, 'orientation')}</div>
                      </div>
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{evidenceRecords(report).length} {appUiCopy(language, 'itemsGathered')}</div>
                    </div>
                    {report.report_data.summary && (
                      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">{report.report_data.summary}</p>
                    )}
                    {report.report_data.country_support?.notice && (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-5 text-slate-600">
                        <span className="font-black text-slate-800">{report.report_data.country_support.label}</span> · {report.report_data.country_support.notice}
                      </div>
                    )}
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {findingSummary(report, language).map((item) => (
                        <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-black uppercase tracking-wide text-slate-400">{item.label}</div>
                            <span className={
                              item.tone === 'established' ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-black uppercase text-emerald-700' :
                              item.tone === 'mapped' ? 'rounded-full bg-sky-50 px-2 py-0.5 text-xs font-black uppercase text-sky-700' :
                              'rounded-full bg-amber-50 px-2 py-0.5 text-xs font-black uppercase text-amber-700'
                            }>
                              {item.tone === 'established' ? appUiCopy(language, 'established') : item.tone === 'mapped' ? appUiCopy(language, 'mapped') : appUiCopy(language, 'open')}
                            </span>
                          </div>
                          <div className="mt-2 text-sm font-semibold leading-5 text-slate-700">{item.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-slate-500">{appUiCopy(language, 'detailedTrail')}</div>
                      <a href={window.location.origin + '/report?report_id=' + encodeURIComponent(report.id)} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-slate-800">
                        <FileText className="h-3.5 w-3.5" /> {appUiCopy(language, 'openDetailed')}
                      </a>
                    </div>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); ask(question); }} className="sticky top-20 z-20 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/30">
                <div className="mb-2 px-3 text-sm font-black text-slate-700">{appUiCopy(language, 'askAnything')}</div>
                <div className="flex items-end gap-2">
                  <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={1} onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(question); }
                  }} placeholder={appUiCopy(language, 'searchAnything')} aria-label={appUiCopy(language, 'searchAnything')} className="min-h-[52px] flex-1 resize-none bg-transparent px-3 py-3 text-base outline-none placeholder:text-slate-400" />
                  <button disabled={!question.trim() || asking} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white disabled:opacity-30">
                    {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              </form>

              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 sm:p-6">
                    <div className="text-sm font-black text-slate-900">{appUiCopy(language, 'askAnything')}</div>
                    <div className="mt-1 text-sm leading-5 text-slate-500">{appUiCopy(language, 'promptsHint')}</div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {starterQuestions(language).map((item) => (
                        <button key={item} onClick={() => ask(item)} className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-950">
                          <span>{item}</span><ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:text-slate-700" />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {chat.map((turn, index) => (
                <div key={index} className="space-y-3">
                  <div className="ml-auto max-w-2xl rounded-3xl rounded-br-md bg-slate-950 px-5 py-4 text-sm leading-6 text-white shadow-sm">{turn.question}</div>
                  <div className="max-w-3xl rounded-3xl rounded-bl-md border border-slate-200 bg-white px-5 py-5 shadow-sm">
                    {turn.error ? (
                      <div className="text-sm text-red-700">{turn.error}</div>
                    ) : !turn.answer ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {appUiCopy(language, 'looking')}</div>
                    ) : (
                      <>
                        <div className="flex gap-3">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-900 text-white"><Sparkles className="h-3.5 w-3.5" /></div>
                          <div className="text-[15px] leading-7 text-slate-700 whitespace-pre-line">{turn.answer.answer}</div>
                        </div>
                        {turn.answer.actions.length > 0 && (
                          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700"><Target className="h-3.5 w-3.5" /> {appUiCopy(language, 'whatNext')}</div>
                            <div className="mt-3 space-y-2">
                              {turn.answer.actions.map((action, i) => (
                                <div key={i} className="rounded-xl bg-white p-3">
                                  <div className="flex items-start gap-3">
                                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 text-xs font-black">{action.kind === 'local_professional' ? 'P' : action.kind === 'field_investigation' ? 'F' : 'S'}</span>
                                    <div>
                                      <div className="text-sm font-black text-slate-800">{action.title}</div>
                                      <div className="mt-1 text-xs leading-5 text-slate-500">{action.reason}</div>
                                      {action.professionalCategory && <div className="mt-1 text-xs font-bold capitalize text-slate-400">{String(language || '').toLowerCase().startsWith('pl') ? 'Przydatny lokalny specjalista' : String(language || '').toLowerCase().startsWith('de') ? 'Geeignete Fachkraft vor Ort' : 'Useful local professional'}: {action.professionalCategory}</div>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {turn.answer.unknowns.length > 0 && (
                          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-amber-800"><CircleHelp className="h-3.5 w-3.5" /> {appUiCopy(language, 'stillOpen')}</div>
                            <div className="mt-2 space-y-2 text-sm leading-5 text-amber-900">{turn.answer.unknowns.map((item, i) => <div key={i}>{item}</div>)}</div>
                          </div>
                        )}
                        {turn.answer.localBusinesses && turn.answer.localBusinesses.length > 0 && (
                          <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-sky-800"><Phone className="h-3.5 w-3.5" /> {appUiCopy(language, 'localHelp')}</div>
                            <div className="mt-1 text-xs leading-5 text-sky-900/70">{String(language || '').toLowerCase().startsWith('pl') ? 'Usługi znalezione w OpenStreetMap w pobliżu. To wstępna orientacja, a nie pełny katalog.' : String(language || '').toLowerCase().startsWith('de') ? 'OpenStreetMap-Dienste in der Nähe. Dies ist eine erste Orientierung, kein vollständiges Verzeichnis.' : 'Nearby services found through OpenStreetMap. This is a first orientation, not a complete directory.'}</div>
                            <div className="mt-3 space-y-2">
                              {turn.answer.localBusinesses.map((business, i) => (
                                <div key={i} className="rounded-xl bg-white p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-black text-slate-800">{business.name}</div>
                                      <div className="mt-0.5 text-xs capitalize text-slate-400">{business.category} · {Math.round(business.distanceM).toLocaleString()} m {String(language || '').toLowerCase().startsWith('pl') ? 'stąd' : String(language || '').toLowerCase().startsWith('de') ? 'entfernt' : 'away'}</div>
                                    </div>
                                    {business.phone && <a href={'tel:' + business.phone} className="shrink-0 text-xs font-bold text-sky-700">{business.phone}</a>}
                                  </div>
                                  {business.address && <div className="mt-1 text-xs text-slate-500">{business.address}</div>}
                                  {business.website && <a href={business.website} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-sky-700">{appUiCopy(language, 'website')} <SquareArrowOutUpRight className="h-3 w-3" /></a>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {turn.answer.localBusinesses && turn.answer.localBusinesses.length === 0 && (
                          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-sm font-black uppercase tracking-wide text-slate-500">{appUiCopy(language, 'noLocalListing')}</div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">{String(language || '').toLowerCase().startsWith('pl') ? 'Możesz nadal wyszukać specjalistów w pobliżu. Pusty katalog nie oznacza, że nie ma odpowiedniej usługi.' : String(language || '').toLowerCase().startsWith('de') ? 'Du kannst weiterhin nach Fachleuten in der Nähe suchen. Ein leeres Verzeichnis bedeutet nicht, dass es keinen passenden Dienst gibt.' : 'You can still search for professionals nearby. An empty directory does not mean that no suitable service exists.'}</div>
                            <a
                              href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('geotechnical engineer surveyor architect environmental consultant near ' + report.latitude + ',' + report.longitude)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-xs font-black text-slate-700"
                            >
                              {appUiCopy(language, 'nearbySearch')} <SquareArrowOutUpRight className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                        {turn.answer.nextQuestions.length > 0 && (
                          <div className="mt-5">
                            <div className="text-xs font-black uppercase tracking-wide text-slate-400">{appUiCopy(language, 'askNext')}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {turn.answer.nextQuestions.map((item, i) => <button key={i} onClick={() => ask(item)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:text-slate-950">{item}</button>)}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              <form onSubmit={(e) => { e.preventDefault(); ask(question); }} className="sticky bottom-3 rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/40">
                <div className="flex items-end gap-2">
                  <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={1} onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(question); }
                  }} placeholder={appUiCopy(language, 'searchAnything')} className="min-h-[52px] flex-1 resize-none bg-transparent px-3 py-3 text-base outline-none placeholder:text-slate-400" />
                  <button disabled={!question.trim() || asking} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white disabled:opacity-30">
                    {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              </form>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-black"><Map className="h-4 w-4 text-slate-400" /> {appUiCopy(language, 'place')}</div>
              </div>
              <MapPreview
                lat={report.latitude}
                lng={report.longitude}
                areaSize={report.area_size}
                boundary={report.boundary}
                officialGeometry={report.official_geometry}
                mappedGeometry={report.mapped_geometry}
                countryCode={report.country_code}
                language={report.language}
              />
              <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100">
                <div className="p-4"><div className="text-xs font-black uppercase tracking-wide text-slate-400">{appUiCopy(language, 'area')}</div><div className="mt-1 text-sm font-black">{Math.round(report.area_size).toLocaleString()} m²</div></div>
                <div className="p-4"><div className="text-xs font-black uppercase tracking-wide text-slate-400">{appUiCopy(language, 'parcel')}</div><div className="mt-1 truncate text-sm font-black">{report.is_official_parcel ? appUiCopy(language, 'official') : appUiCopy(language, 'notConfirmed')}</div></div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-black"><Target className="h-4 w-4 text-slate-400" /> {appUiCopy(language, 'evidenceMap')}</div>
              <div className="mt-4 space-y-2">
                {coverage.map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-3">
                    <div><div className="text-sm font-bold text-slate-800">{item.label}</div><div className="mt-0.5 text-xs text-slate-400">{item.count ? item.count + ' ' + (item.count === 1 ? appUiCopy(language, 'evidenceItem') : appUiCopy(language, 'evidenceItemsPlural')) : appUiCopy(language, 'noMatching')}</div></div>
                    <span className={"h-2.5 w-2.5 rounded-full " + (item.count ? "bg-emerald-500" : "bg-slate-300")} />
                  </div>
                ))}
              </div>
            </section>

            {relevantEvidence.length > 0 && (
              <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-black"><ShieldCheck className="h-4 w-4 text-slate-400" /> {String(language || '').toLowerCase().startsWith('pl') ? 'Dowody stojące za tą odpowiedzią' : String(language || '').toLowerCase().startsWith('de') ? 'Belege hinter dieser Antwort' : 'Evidence behind this answer'}</div>
                <div className="mt-4 space-y-2">
                  {relevantEvidence.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-100 p-3">
                      <div className="flex items-start justify-between gap-2"><div className="text-sm font-bold text-slate-800">{item.sourceName}</div><span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-black uppercase text-slate-400">{statusLabel(item.status, language)}</span></div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{item.claim}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-[2rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-white/40">{appUiCopy(language, 'goDeeper')}</div>
              <div className="mt-3 text-lg font-black">{appUiCopy(language, 'landRecord')}</div>
              <p className="mt-2 text-sm leading-5 text-white/60">{appUiCopy(language, 'keepRecord')}</p>
              <a href={window.location.origin + '/report?report_id=' + encodeURIComponent(report.id)} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white hover:text-white/80">
                {appUiCopy(language, 'openDetailed')} <SquareArrowOutUpRight className="h-3.5 w-3.5" />
              </a>
            </section>

            {last?.error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{last.error}</div>}
            {relevantSources.length > 0 && (
              <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-black">{appUiCopy(language, 'sources')}</div>
                <div className="mt-3 space-y-2">
                  {relevantSources.slice(0, 5).map((source, index) => (
                    <a key={index} href={source.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-950">
                      <span className="truncate">{source.name}</span><SquareArrowOutUpRight className="ml-2 h-3.5 w-3.5 shrink-0" />
                    </a>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>
      <FloatingSupportLandSurf language={report.language} destination="groundsurf" />
    </div>
  );
};
