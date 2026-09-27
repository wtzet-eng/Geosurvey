import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, FileText, Globe2,
  Layers3, Loader2, Map, Search, ShieldCheck, Sparkles, Phone,
  SquareArrowOutUpRight, Target
} from 'lucide-react';
import { MapPicker } from './components/MapPicker';
import { MapPreview } from './components/MapPreview';
import { SiteReport, BoundaryShape } from './types';
import { EUROPEAN_COUNTRIES } from './data/countries';
import { calculateBoundaryArea, getBoundaryCenter } from './utils/geo';
import { getAvailableReportLanguages, normalizeReportLanguage } from './utils/reportLanguageOptions';
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
  ['cadastre', 'Where is it?', 'Wo ist es?', ['cadastre', 'parcel', 'boundary']],
  ['ground', 'What is beneath it?', 'Was befindet sich darunter?', ['geology', 'soil', 'ground', 'borehole']],
  ['water', 'How does water behave?', 'Wie verhält sich das Wasser?', ['water', 'flood', 'hydro', 'groundwater']],
  ['history', 'What happened here before?', 'Was geschah hier früher?', ['history', 'environment', 'contamination', 'land use']],
  ['planning', 'What could affect development?', 'Was könnte die Entwicklung beeinflussen?', ['planning', 'zoning', 'building']],
  ['access', 'What is around it?', 'Was befindet sich in der Umgebung?', ['infrastructure', 'access', 'amenity', 'utility']]
] as const;

const STARTER_QUESTIONS = {
  en: ['Could this land flood?', 'What is underneath it?', 'Can I build here?', 'Could there be contamination?', 'What are the biggest unknowns?', 'What should I check before buying?'],
  de: ['Könnte dieses Grundstück überflutet werden?', 'Was befindet sich unter dem Grundstück?', 'Kann ich hier bauen?', 'Könnte es Altlasten oder Verunreinigungen geben?', 'Was sind die größten offenen Fragen?', 'Was sollte ich vor dem Kauf prüfen?']
} as const;

function starterQuestions(language: string): readonly string[] {
  return String(language || '').toLowerCase().startsWith('de') ? STARTER_QUESTIONS.de : STARTER_QUESTIONS.en;
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
    gatheringEvidence: 'Öffentliche Daten werden gesammelt…'
  }
} as const;

type GroundSurfCopyKey = keyof typeof GROUND_SURF_COPY.en;

function groundSurfCopy(language: string, key: GroundSurfCopyKey): string {
  const locale = String(language || '').toLowerCase().startsWith('de') ? 'de' : 'en';
  return GROUND_SURF_COPY[locale][key];
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
  }
} as const;

type AppUiCopyKey = keyof typeof APP_UI_COPY.en;

function appUiCopy(language: string, key: AppUiCopyKey): string {
  const locale = String(language || '').toLowerCase().startsWith('de') ? 'de' : 'en';
  return APP_UI_COPY[locale][key];
}

function findingSummary(report: SiteReport, language: string) {
  const data = report.report_data;
  const ground = data.ground_context;
  const locale = String(language || '').toLowerCase().startsWith('de');
  const parcel = report.is_official_parcel
    ? (locale ? 'Amtliches Flurstück identifiziert' : 'Official parcel identified')
    : (locale ? 'Amtliches Flurstück nicht bestätigt' : 'Official parcel not confirmed');
  const groundText = ground?.summary
    || data.geosurvey_context?.geological_unit_name
    || (locale ? 'Regionale Informationen zum Untergrund verfügbar' : 'Regional ground information available');
  const waterText = data.flooding_risk?.summary
    || data.technical_parameters?.groundwater_notice
    || (locale ? 'Wasserverhältnisse teilweise offen' : 'Water conditions are partly open');
  const planningText = data.zoning_and_land_use?.summary
    || (locale ? 'Planungsinformationen müssen vor Ort bestätigt werden' : 'Planning information needs local confirmation');
  return [
    { label: locale ? 'Wo es liegt' : 'Where it is', value: parcel, tone: report.is_official_parcel ? 'established' : 'open' },
    { label: locale ? 'Untergrund' : 'Ground', value: groundText, tone: ground ? 'mapped' : 'open' },
    { label: locale ? 'Wasser' : 'Water', value: waterText, tone: data.flooding_risk?.summary ? 'mapped' : 'open' },
    { label: locale ? 'Planung' : 'Planning', value: planningText, tone: data.zoning_and_land_use?.summary ? 'mapped' : 'open' }
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

function statusLabel(status: string) {
  if (status === 'VERIFIED') return 'Established';
  if (status === 'MODELLED') return 'Mapped / modelled';
  return 'Still open';
}

export const GroundSurfApp: React.FC = () => {
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
  const isComplete = Boolean(shape && (
    shape.type === 'circle' ? shape.center :
    shape.type === 'rectangle' ? (shape.corners?.length || 0) >= 2 :
    (shape.points?.length || 0) >= 3
  ));
  const circleRadius = Math.sqrt((area || 1000) / Math.PI);

  const coverage = useMemo(() => {
    if (!report) return [];
    return COVERAGE.map(([key, englishLabel, germanLabel, terms]) => ({
      key,
      label: String(language || '').toLowerCase().startsWith('de') ? germanLabel : englishLabel,
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
      setLanguage(normalizeReportLanguage(nextCountry.language, nextCountry.code));
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
        body: JSON.stringify({ report, question: cleaned })
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
      <div className="min-h-screen bg-[#f5f7f4] text-slate-900">
        <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-900 text-white">
                <Layers3 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-black tracking-tight">GroundSurf</div>
                <div className="text-xs text-slate-500">Get to know the land.</div>
              </div>
            </div>
            <div className="h-9 w-9" aria-hidden="true" />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-7 lg:py-9">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-600 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              {copy('badge')}
            </div>
            <h1 className="text-4xl font-black tracking-[-0.03em] text-slate-950 sm:text-5xl lg:text-[3.25rem]">
              {copy('heroTitle')}
              <span className="block text-slate-500">{copy('heroSubTitle')}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">
              {copy('heroText')}
            </p>
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-[1.6fr_0.72fr]">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-900">{copy('whereTitle')}</div>
                  <div className="mt-1 text-sm text-slate-500">{copy('whereHint')}</div>
                </div>
                  <div className="hidden items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 sm:flex">
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
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {isFindingParcel ? copy('findingParcel') :
                    officialParcel ? copy('officialParcel') :
                    isComplete ? copy('landReady') : copy('chooseLand')}
                </div>
                {isComplete && <span className="font-black text-slate-800">{Math.round(area).toLocaleString()} m²</span>}
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
    <div className="min-h-screen bg-[#f5f7f4] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/92 backdrop-blur">
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
                                      {action.professionalCategory && <div className="mt-1 text-xs font-bold capitalize text-slate-400">Useful local professional: {action.professionalCategory}</div>}
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
                            <div className="mt-1 text-xs leading-5 text-sky-900/70">OpenStreetMap-Dienste in der Nähe. Dies ist eine erste Orientierung, kein vollständiges Verzeichnis.</div>
                            <div className="mt-3 space-y-2">
                              {turn.answer.localBusinesses.map((business, i) => (
                                <div key={i} className="rounded-xl bg-white p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-black text-slate-800">{business.name}</div>
                                      <div className="mt-0.5 text-xs capitalize text-slate-400">{business.category} · {Math.round(business.distanceM).toLocaleString()} m away</div>
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
                            <div className="mt-1 text-xs leading-5 text-slate-500">Du kannst weiterhin nach Fachleuten in der Nähe suchen. Ein leeres Verzeichnis bedeutet nicht, dass es keinen passenden Dienst gibt.</div>
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
                <div className="flex items-center gap-2 text-sm font-black"><ShieldCheck className="h-4 w-4 text-slate-400" /> Evidence behind this answer</div>
                <div className="mt-4 space-y-2">
                  {relevantEvidence.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-100 p-3">
                      <div className="flex items-start justify-between gap-2"><div className="text-sm font-bold text-slate-800">{item.sourceName}</div><span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-black uppercase text-slate-400">{statusLabel(item.status)}</span></div>
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
