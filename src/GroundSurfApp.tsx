import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, FileText, Globe2,
  Layers3, Loader2, Map, Search, ShieldCheck, Sparkles, Phone,
  SquareArrowOutUpRight, Sun, Moon, Target, Send, AlertCircle, MapPin,
  Pentagon, Square, Circle, ExternalLink
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
  const selected = locale === 'de' ? 'de' : locale === 'pl' ? 'pl' : locale === 'cs' ? 'cs' : locale === 'da' ? 'da' : locale === 'nl' ? 'nl' : locale === 'hr' ? 'hr' : locale === 'es' ? 'es' : locale === 'fr' ? 'fr' : locale === 'no' ? 'no' : locale === 'fi' ? 'fi' : locale === 'sv' ? 'sv' : 'en';
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

export function GroundSurfApp() {
  const [countryCode, setCountryCode] = useState<string>('DE');
  const [language, setLanguage] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const urlLang = new URLSearchParams(window.location.search).get('lang');
      if (urlLang) return normalizeReportLanguage(urlLang, 'DE');
    }
    return getDefaultReportLanguageForCountry('DE', 'de');
  });
  const [mode, setMode] = useState<'polygon' | 'rectangle' | 'circle'>('polygon');
  const [shape, setShape] = useState<BoundaryShape | null>(null);
  const [officialParcel, setOfficialParcel] = useState<{ parcelId?: string; areaM2?: number; geometry?: [number, number][] } | null>(null);
  const [isFindingParcel, setIsFindingParcel] = useState(false);
  const [areaSize, setAreaSize] = useState<number>(1000);
  const [report, setReport] = useState<SiteReport | null>(null);
  const [isGathering, setIsGathering] = useState(false);
  const [gatherError, setGatherError] = useState<string | null>(null);

  // Chat / interaction state
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  const currentCountry = useMemo(() => {
    return EUROPEAN_COUNTRIES.find(c => c.code === countryCode) || EUROPEAN_COUNTRIES[0];
  }, [countryCode]);

  const availableLanguages = useMemo(() => {
    return getAvailableReportLanguages(countryCode, currentCountry.language);
  }, [countryCode, currentCountry.language]);

  const circleRadius = Math.sqrt((areaSize || 1000) / Math.PI);
  const isBoundaryComplete = Boolean(
    shape && (
      shape.type === 'circle' ? Boolean(shape.center) :
      shape.type === 'rectangle' ? (shape.corners?.length || 0) >= 2 :
      (shape.points?.length || 0) >= 3
    )
  );

  const handleShapeChange = (newShape: BoundaryShape | null) => {
    setShape(newShape);
    if (newShape) {
      const calculated = calculateBoundaryArea(newShape, areaSize);
      if (calculated > 0) setAreaSize(calculated);
    }
  };

  const handleCountryDetected = (code: string) => {
    const nextCountry = EUROPEAN_COUNTRIES.find(c => c.code === code.toUpperCase());
    if (nextCountry) {
      setCountryCode(nextCountry.code);
      setLanguage(getDefaultReportLanguageForCountry(nextCountry.code, nextCountry.language));
      setShape(null);
      setOfficialParcel(null);
    }
  };

  const handleGatherEvidence = async () => {
    if (!shape || !isBoundaryComplete || isGathering) return;
    setIsGathering(true);
    setGatherError(null);
    try {
      const center = getBoundaryCenter(shape) || currentCountry.defaultCenter;
      const res = await apiFetch('/api/analyze-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shape,
          areaSize: Math.round(areaSize),
          country: currentCountry.name,
          countryCode: currentCountry.code,
          language,
          currency: currentCountry.currency,
          officialParcel: officialParcel || undefined
        })
      });
      if (!res.ok) {
        throw new Error('Failed to gather public evidence. Please try again.');
      }
      const payload = await res.json();
      const newReport: SiteReport = payload?.report_data ? {
        ...payload,
        country: payload.country || currentCountry.name,
        country_code: payload.country_code || currentCountry.code,
        language: payload.language || language,
        latitude: Number(payload.latitude ?? center[0]),
        longitude: Number(payload.longitude ?? center[1]),
        area_size: Number(payload.area_size ?? Math.round(areaSize)),
        boundary: payload.boundary || shape,
        selected_boundary: shape
      } : {
        id: 'rep_' + Math.random().toString(36).substring(2, 9),
        created_at: new Date().toISOString(),
        location_name: payload.location_name || `${center[0].toFixed(4)}, ${center[1].toFixed(4)}`,
        country: currentCountry.name,
        country_code: currentCountry.code,
        language,
        latitude: center[0],
        longitude: center[1],
        area_size: Math.round(areaSize),
        boundary: shape,
        report_data: payload
      };

      try {
        localStorage.setItem('groundsurf_report_' + newReport.id, JSON.stringify(newReport));
        const saved = JSON.parse(localStorage.getItem('saved_site_reports') || '[]');
        localStorage.setItem('saved_site_reports', JSON.stringify([newReport, ...saved.filter((r: any) => r.id !== newReport.id)]));
      } catch {}

      setReport(newReport);
    } catch (err: any) {
      setGatherError(err.message || 'Error gathering evidence. Please try again.');
    } finally {
      setIsGathering(false);
    }
  };

  const handleAsk = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || isAsking || !report) return;
    setQuestionInput('');
    setIsAsking(true);

    const newTurn: ChatTurn = { question: q };
    setChatTurns(prev => [...prev, newTurn]);

    try {
      const res = await apiFetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report,
          question: q,
          language
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'The adviser could not process this question.');
      }

      let localBiz: any[] = [];
      const hasLocalProf = Array.isArray(data.actions) && data.actions.some((a: any) => a.kind === 'local_professional');
      const lat = report.latitude;
      const lng = report.longitude;
      if (hasLocalProf && typeof lat === 'number' && typeof lng === 'number') {
        try {
          const actionWithCat = data.actions.find((a: any) => a.professionalCategory);
          const category = actionWithCat?.professionalCategory || 'surveyor';
          const helpRes = await apiFetch(`/api/local-help?lat=${lat}&lng=${lng}&category=${encodeURIComponent(category)}`);
          if (helpRes.ok) {
            const helpData = await helpRes.json();
            if (Array.isArray(helpData.businesses)) {
              localBiz = helpData.businesses.slice(0, 3);
            }
          }
        } catch {}
      }

      setChatTurns(prev => {
        const copy = [...prev];
        if (copy.length > 0) {
          copy[copy.length - 1] = {
            question: q,
            answer: {
              ...data,
              localBusinesses: localBiz.length > 0 ? localBiz : undefined
            }
          };
        }
        return copy;
      });
    } catch (err: any) {
      setChatTurns(prev => {
        const copy = [...prev];
        if (copy.length > 0) {
          copy[copy.length - 1] = {
            question: q,
            error: err.message || 'Adviser request failed.'
          };
        }
        return copy;
      });
    } finally {
      setIsAsking(false);
    }
  };

  const openDetailedReport = () => {
    if (!report) return;
    try {
      localStorage.setItem('groundsurf_report_' + report.id, JSON.stringify(report));
    } catch {}
    window.location.href = `/report?report_id=${encodeURIComponent(report.id)}`;
  };

  const evidenceRegistry = (report?.report_data as any)?.evidenceRegistry || (report as any)?.evidenceRegistry || [];
  const evidenceCount = evidenceRegistry.length;

  const topicStatuses = useMemo(() => {
    if (!report) return [];
    return COVERAGE.map(([key, enLabel, deLabel, plLabel, keywords]) => {
      const records = evidenceRegistry.filter((rec: any) => {
        const text = `${rec.id || ''} ${rec.category || ''} ${rec.title || ''} ${rec.description || ''}`.toLowerCase();
        return (keywords as readonly string[]).some((kw: string) => text.includes(kw));
      });
      let status: 'established' | 'mapped' | 'open' = 'open';
      if (records.some((r: any) => r.status === 'VERIFIED')) status = 'established';
      else if (records.some((r: any) => r.status === 'MODELLED' || r.status === 'CONTRIBUTORY' || r.status === 'ESTIMATED')) status = 'mapped';

      const label = language === 'de' ? deLabel : language === 'pl' ? plLabel : enLabel;
      return { key, label, status, count: records.length };
    });
  }, [report, evidenceRegistry, language]);

  const center = useMemo(() => {
    if (!report) return currentCountry.defaultCenter;
    return [report.latitude, report.longitude] as [number, number];
  }, [report, currentCountry]);

  // If no report yet: Landing / Land selection view
  if (!report) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm">
                <Layers3 className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900">GroundSurf</span>
              <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {groundSurfCopy(language, 'badge')}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-2.5 py-1.5 border border-slate-200 text-xs font-medium text-slate-700">
                <Globe2 className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-transparent border-none focus:outline-none cursor-pointer text-slate-800 font-semibold"
                >
                  {availableLanguages.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>

              <a
                href="/report"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition"
              >
                {appUiCopy(language, 'detailedReport')}
              </a>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 w-full">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
              {groundSurfCopy(language, 'heroTitle')}{' '}
              <span className="text-slate-500">{groundSurfCopy(language, 'heroSubTitle')}</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              {groundSurfCopy(language, 'heroText')}
            </p>
          </div>

          {/* Map Selection Card */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  {groundSurfCopy(language, 'whereTitle')}
                </h2>
                <p className="text-xs text-slate-500">{groundSurfCopy(language, 'whereHint')}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {groundSurfCopy(language, 'addressFlow')}
                </span>
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => { setMode('polygon'); setShape(null); }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${mode === 'polygon' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <Pentagon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('rectangle'); setShape(null); }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${mode === 'rectangle' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <Square className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('circle'); setShape(null); }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${mode === 'circle' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <Circle className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <MapPicker
              mode={mode}
              shape={shape}
              onChange={handleShapeChange}
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

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-600 flex items-center gap-2">
                {isFindingParcel ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {groundSurfCopy(language, 'findingParcel')}
                  </span>
                ) : officialParcel ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    {groundSurfCopy(language, 'officialParcel')}{officialParcel.parcelId ? ` (${officialParcel.parcelId})` : ''}
                  </span>
                ) : isBoundaryComplete ? (
                  <span className="text-slate-800 font-medium">
                    {groundSurfCopy(language, 'landReady')} • <strong className="font-bold">{Math.round(areaSize).toLocaleString()} m²</strong>
                  </span>
                ) : (
                  <span>{groundSurfCopy(language, 'chooseLand')}</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleGatherEvidence}
                  disabled={!isBoundaryComplete || isGathering}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2 shadow-sm transition"
                >
                  {isGathering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{groundSurfCopy(language, 'gatheringEvidence')}</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>{groundSurfCopy(language, 'gatherButton')}</span>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {gatherError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{gatherError}</span>
              </div>
            )}
          </div>

          {/* The Promise Section */}
          <div className="grid sm:grid-cols-3 gap-4 pt-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h3 className="font-bold text-sm text-slate-900">{groundSurfCopy(language, 'evidenceFirst')}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{groundSurfCopy(language, 'promiseMain')}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h3 className="font-bold text-sm text-slate-900">{groundSurfCopy(language, 'unknownsVisible')}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{groundSurfCopy(language, 'promiseQuestion')}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h3 className="font-bold text-sm text-slate-900">{groundSurfCopy(language, 'sourceTrail')}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{groundSurfCopy(language, 'screeningNote')}</p>
            </div>
          </div>
        </main>

        <FloatingSupportLandSurf language={language} />
      </div>
    );
  }

  // If report has been gathered: Interactive Adviser & Evidence Explorer
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setReport(null); setChatTurns([]); }}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
              title="Back to land search"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                  {report.location_name}
                </span>
                {report.parcel?.parcelId && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {report.parcel.parcelId}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {report.area_size.toLocaleString()} m² • {evidenceCount} {appUiCopy(language, 'itemsGathered')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openDetailedReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{appUiCopy(language, 'openDetailed')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Two-Column View */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full grid lg:grid-cols-[1fr_1.4fr] gap-6 items-start">
        {/* Left Column: Land & Evidence Map */}
        <div className="space-y-6">
          {/* Map Preview Card */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm space-y-3">
            <div className="h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-100">
              <MapPreview
                lat={center[0]}
                lng={center[1]}
                areaSize={report.area_size}
                boundary={report.boundary}
                officialGeometry={report.official_geometry}
                countryCode={report.country_code}
                language={language}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-medium uppercase">{appUiCopy(language, 'place')}</span>
                <span className="font-semibold text-slate-800 truncate block">{report.location_name}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-medium uppercase">{appUiCopy(language, 'area')}</span>
                <span className="font-semibold text-slate-800">{report.area_size.toLocaleString()} m²</span>
              </div>
            </div>
          </div>

          {/* Evidence Coverage Grid */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                {appUiCopy(language, 'evidenceMap')}
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {evidenceCount} {appUiCopy(language, 'evidenceItemsPlural')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {topicStatuses.map((topic) => (
                <div key={topic.key} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-800 leading-tight">{topic.label}</span>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      topic.status === 'established'
                        ? 'bg-emerald-100 text-emerald-800'
                        : topic.status === 'mapped'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {topic.status === 'established' ? appUiCopy(language, 'established') :
                       topic.status === 'mapped' ? appUiCopy(language, 'mapped') :
                       appUiCopy(language, 'open')}
                    </span>
                    <span className="text-[10px] text-slate-400">{topic.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Land Record Callout */}
          <div className="bg-emerald-950 text-white rounded-3xl p-5 space-y-3 shadow-sm">
            <h3 className="font-bold text-sm text-emerald-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              {appUiCopy(language, 'landRecord')}
            </h3>
            <p className="text-xs text-emerald-200/80 leading-relaxed">
              {appUiCopy(language, 'keepRecord')}
            </p>
            <button
              type="button"
              onClick={openDetailedReport}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <span>{appUiCopy(language, 'openDetailed')}</span>
              <SquareArrowOutUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column: GroundSurf Adviser Conversation */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 flex flex-col min-h-[500px] space-y-5">
          {/* Welcome / Intro */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>{appUiCopy(language, 'adviser')}</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {appUiCopy(language, 'gathered')}{' '}{appUiCopy(language, 'askIntro')}
            </p>
          </div>

          {/* Starter Questions (Prompts) */}
          {chatTurns.length === 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{appUiCopy(language, 'askAnything')}</span>
                <span>{appUiCopy(language, 'promptsHint')}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {starterQuestions(language).map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAsk(q)}
                    disabled={isAsking}
                    className="text-left text-xs font-medium px-3 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-200 border border-slate-200 transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation Thread */}
          <div className="flex-1 space-y-4 overflow-y-auto">
            {chatTurns.map((turn, idx) => (
              <div key={idx} className="space-y-3">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="bg-slate-900 text-white rounded-2xl rounded-tr-xs px-4 py-2.5 max-w-[85%] text-xs sm:text-sm font-medium">
                    {turn.question}
                  </div>
                </div>

                {/* Adviser answer */}
                {turn.answer ? (
                  <div className="bg-slate-50 rounded-2xl rounded-tl-xs p-4 border border-slate-200/80 space-y-3 max-w-[95%]">
                    <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line font-normal">
                      {turn.answer.answer}
                    </p>

                    {/* Behind the answer: Evidence chips */}
                    {turn.answer.evidenceIds.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-700 block">
                          {appUiCopy(language, 'behindAnswer')}:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {turn.answer.evidenceIds.map((eid, eIdx) => (
                            <span key={eIdx} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                              {eid}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unknowns remaining */}
                    {turn.answer.unknowns.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/60 space-y-1">
                        <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                          <CircleHelp className="w-3.5 h-3.5 text-amber-700" />
                          {appUiCopy(language, 'stillOpen')}:
                        </span>
                        <ul className="list-disc list-inside text-xs text-amber-800 space-y-0.5">
                          {turn.answer.unknowns.map((unk, uIdx) => (
                            <li key={uIdx}>{unk}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Actions / What next */}
                    {turn.answer.actions.length > 0 && (
                      <div className="pt-2 space-y-2">
                        <span className="text-[11px] font-bold text-slate-700 block">
                          {appUiCopy(language, 'whatNext')}:
                        </span>
                        <div className="grid gap-1.5">
                          {turn.answer.actions.map((act, aIdx) => (
                            <div key={aIdx} className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs space-y-0.5">
                              <span className="font-bold text-slate-900 block">{act.title}</span>
                              <span className="text-slate-600 block">{act.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Local help / professionals */}
                    {turn.answer.localBusinesses && turn.answer.localBusinesses.length > 0 && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/60 space-y-2">
                        <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-emerald-700" />
                          {appUiCopy(language, 'localHelp')}:
                        </span>
                        <div className="grid gap-1.5">
                          {turn.answer.localBusinesses.map((biz, bIdx) => (
                            <div key={bIdx} className="p-2 rounded-lg bg-white border border-emerald-200 text-xs flex items-center justify-between">
                              <div>
                                <span className="font-semibold text-slate-900 block">{biz.name}</span>
                                <span className="text-[10px] text-slate-500">{biz.category} • {biz.distanceM}m</span>
                              </div>
                              {biz.phone && (
                                <a href={`tel:${biz.phone}`} className="text-emerald-700 font-bold hover:underline">
                                  {biz.phone}
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Next questions suggestions */}
                    {turn.answer.nextQuestions.length > 0 && (
                      <div className="pt-2 space-y-1.5">
                        <span className="text-[10px] font-semibold text-slate-500 block">
                          {appUiCopy(language, 'askNext')}:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {turn.answer.nextQuestions.map((nxt, nIdx) => (
                            <button
                              key={nIdx}
                              type="button"
                              onClick={() => handleAsk(nxt)}
                              disabled={isAsking}
                              className="text-left text-xs font-medium px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 transition text-slate-800"
                            >
                              {nxt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : turn.error ? (
                  <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">
                    {turn.error}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-500 p-3 bg-slate-50 rounded-2xl">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>{appUiCopy(language, 'looking')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Ask Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(questionInput);
            }}
            className="pt-2 border-t border-slate-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder={appUiCopy(language, 'searchAnything')}
              disabled={isAsking}
              className="flex-1 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
            />
            <button
              type="submit"
              disabled={!questionInput.trim() || isAsking}
              className="p-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 transition shrink-0"
              title="Send question"
            >
              {isAsking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </main>

      <FloatingSupportLandSurf language={language} />
    </div>
  );
}
