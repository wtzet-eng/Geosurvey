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
import { getCurrentFirebaseIdToken, signInWithGoogle, subscribeToAuthState } from './lib/firebaseAuth';

type ChatTurn = {
  question: string;
  answer?: {
    answer: string;
    evidenceIds: string[];
    unknowns: string[];
    nextQuestions: string[];
    sourceIds: string[];
    localBusinesses?: Array<{ name: string; category: string; distanceM: number; website?: string; phone?: string; address?: string; source: string }>;
  };
  error?: string;
};

const COVERAGE = [
  ['cadastre', 'Where is it?', ['cadastre', 'parcel', 'boundary']],
  ['ground', 'What is beneath it?', ['geology', 'soil', 'ground', 'borehole']],
  ['water', 'How does water behave?', ['water', 'flood', 'hydro', 'groundwater']],
  ['history', 'What happened here before?', ['history', 'environment', 'contamination', 'land use']],
  ['planning', 'What could affect development?', ['planning', 'zoning', 'building']],
  ['access', 'What is around it?', ['infrastructure', 'access', 'amenity', 'utility']]
] as const;

const starterQuestions = [
  'Could this land flood?',
  'What is underneath it?',
  'Can I build here?',
  'Could there be contamination?',
  'What are the biggest unknowns?',
  'What should I check before buying?'
];

const languageOptions = [
  ['en', 'English'],
  ['de', 'Deutsch'],
  ['nl', 'Nederlands'],
  ['fr', 'Français'],
  ['es', 'Español']
] as const;

function findingSummary(report: SiteReport) {
  const data = report.report_data;
  const ground = data.ground_context;
  const parcel = report.is_official_parcel
    ? 'Official parcel identified'
    : 'Official parcel not confirmed';
  const groundText = ground?.summary
    || data.geosurvey_context?.geological_unit_name
    || 'Regional ground information available';
  const waterText = data.flooding_risk?.summary
    || data.technical_parameters?.groundwater_notice
    || 'Water conditions are partly open';
  const planningText = data.zoning_and_land_use?.summary
    || 'Planning information needs local confirmation';
  return [
    { label: 'Where it is', value: parcel, tone: report.is_official_parcel ? 'established' : 'open' },
    { label: 'Ground', value: groundText, tone: ground ? 'mapped' : 'open' },
    { label: 'Water', value: waterText, tone: data.flooding_risk?.summary ? 'mapped' : 'open' },
    { label: 'Planning', value: planningText, tone: data.zoning_and_land_use?.summary ? 'mapped' : 'open' }
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
  const [authUser, setAuthUser] = useState<any | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => subscribeToAuthState(setAuthUser), []);

  React.useEffect(() => {
    const reportId = new URLSearchParams(window.location.search).get('report_id');
    if (!reportId) return;
    apiFetch('/api/reports/' + encodeURIComponent(reportId))
      .then((res) => res.ok ? res.json() : null)
      .then((saved) => { if (saved?.report_data) setReport(saved); })
      .catch(() => {});
  }, []);

  const currentCountry = EUROPEAN_COUNTRIES.find((c) => c.code === countryCode) || defaultCountry;
  const availableLanguages = getAvailableReportLanguages(countryCode, currentCountry.language);
  const isComplete = Boolean(shape && (
    shape.type === 'circle' ? shape.center :
    shape.type === 'rectangle' ? (shape.corners?.length || 0) >= 2 :
    (shape.points?.length || 0) >= 3
  ));
  const circleRadius = Math.sqrt((area || 1000) / Math.PI);

  const coverage = useMemo(() => {
    if (!report) return [];
    return COVERAGE.map(([key, label, terms]) => ({
      key,
      label,
      count: categoryMatch(report, terms).length
    }));
  }, [report]);

  const ask = async (text: string) => {
    const cleaned = text.trim();
    if (!cleaned || !report || asking) return;
    setQuestion('');
    setError('');
    setAsking(true);
    setChat((prev) => [...prev, { question: cleaned }]);
    try {
      let token = await getCurrentFirebaseIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      let response = await apiFetch('/api/ai/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify({ report, question: cleaned })
      });
      if (response.status === 401 && !authUser) {
        throw new Error('Please sign in to ask the land adviser.');
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'The land adviser could not answer right now.');
      }
      const answer = await response.json();
      const needsLocalHelp = /who can help|professional|engineer|surveyor|architect|planner|planning|contamin|geotechn|site investigation/i.test(cleaned);
      if (needsLocalHelp) {
        const helpUrl = '/api/local-help?lat=' + encodeURIComponent(report.latitude) +
          '&lng=' + encodeURIComponent(report.longitude) +
          '&q=' + encodeURIComponent(cleaned);
        const helpResponse = await apiFetch(helpUrl).catch(() => null);
        if (helpResponse?.ok) {
          const help = await helpResponse.json().catch(() => null);
          if (Array.isArray(help?.businesses)) answer.localBusinesses = help.businesses;
        }
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
                <div className="text-[11px] text-slate-500">Get to know the land.</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Globe2 className="h-3.5 w-3.5" />
              <select value={language} onChange={(e) => setLanguage(normalizeReportLanguage(e.target.value, countryCode))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-semibold text-slate-700">
                {availableLanguages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
              <select value={countryCode} onChange={(e) => {
                const next = EUROPEAN_COUNTRIES.find((c) => c.code === e.target.value) || defaultCountry;
                setCountryCode(next.code);
                setLanguage(normalizeReportLanguage(next.language, next.code));
                setShape(null);
                setOfficialParcel(null);
              }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-semibold text-slate-700">
                {[...EUROPEAN_COUNTRIES]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-10 lg:py-14">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Public evidence, gathered in one place
            </div>
            <h1 className="text-4xl font-black tracking-[-0.03em] text-slate-950 sm:text-6xl">
              First, I gather the evidence.
              <span className="block text-slate-500">Then you decide what to ask.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">
              GroundSurf searches the public evidence available for this land — cadastral records, ground, water, planning, environment and local context — and turns it into something you can explore.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.45fr_0.8fr]">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-900">Where shall we look?</div>
                  <div className="mt-1 text-xs text-slate-500">Search an address, or use the map to choose the land.</div>
                </div>
                <div className="hidden items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500 sm:flex">
                  <Search className="h-3.5 w-3.5" /> Address → parcel → evidence
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
                onOfficialParcelSelected={setOfficialParcel}
                onParcelLookupStateChange={setIsFindingParcel}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {isFindingParcel ? 'Finding the official parcel…' :
                    officialParcel ? 'Official parcel identified.' :
                    isComplete ? 'Land selected and ready.' : 'Choose the land on the map.'}
                </div>
                {isComplete && <span className="font-black text-slate-800">{Math.round(area).toLocaleString()} m²</span>}
              </div>
            </section>

            <section className="flex flex-col justify-between rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">The promise</div>
                <div className="mt-5 text-2xl font-black leading-tight">
                  I gather the public evidence I can find.
                  <span className="mt-2 block text-white/55">What would you like to know?</span>
                </div>
                <div className="mt-6 space-y-3 text-sm leading-6 text-white/70">
                  <div className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />Evidence before explanation.</div>
                  <div className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />Unknowns stay visible.</div>
                  <div className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />Every answer can lead back to its source.</div>
                </div>
              </div>
              <div className="mt-8">
                {error && <div className="mb-3 rounded-2xl border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-100">{error}</div>}
                <button onClick={gatherEvidence} disabled={!isComplete || isGathering} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-black text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30">
                  {isGathering ? <><Loader2 className="h-4 w-4 animate-spin" /> Gathering public evidence…</> : <>Gather the evidence <ArrowRight className="h-4 w-4" /></>}
                </button>
                <div className="mt-3 text-center text-[11px] text-white/40">This is screening evidence, not a legal or engineering certification.</div>
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
                <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 sm:inline">Evidence gathered</span>
              </div>
              <div className="truncate text-xs text-slate-500">{report.location_name} · {Math.round(report.area_size).toLocaleString()} m²</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={window.location.origin + '/report?report_id=' + encodeURIComponent(report.id)} className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-950 sm:flex">
              <FileText className="h-3.5 w-3.5" /> Detailed report
            </a>
            {!authUser && (
              <button onClick={async () => {
                setAuthBusy(true);
                try { await signInWithGoogle(); } catch (e) { setError('Google sign-in could not be completed.'); } finally { setAuthBusy(false); }
              }} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                {authBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Sign in for adviser
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-7">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
          <section className="min-h-[650px] rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    <Sparkles className="h-3.5 w-3.5" /> GroundSurf adviser
                  </div>
                  <h1 className="mt-3 text-3xl font-black tracking-[-0.025em] text-slate-950 sm:text-4xl">
                    I gathered the public evidence.
                  </h1>
                  <p className="mt-2 text-base leading-7 text-slate-600">
                    {report.location_name}. Now the interface gets out of your way.
                    <span className="font-semibold text-slate-900"> What would you like to know?</span>
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                  <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Evidence items</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">{evidenceRecords(report).length}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-4 sm:p-5">
              {chat.length === 0 && (
                <>
                  <div className="rounded-[1.5rem] border border-slate-200 bg-[#fafcf9] p-5 sm:p-6">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-slate-900">Here’s what I found.</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">A first orientation before you start asking questions.</div>
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{evidenceRecords(report).length} evidence items gathered</div>
                    </div>
                    {report.report_data.summary && (
                      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">{report.report_data.summary}</p>
                    )}
                    {report.report_data.country_support?.notice && (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
                        <span className="font-black text-slate-800">{report.report_data.country_support.label}</span> · {report.report_data.country_support.notice}
                      </div>
                    )}
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {findingSummary(report).map((item) => (
                        <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{item.label}</div>
                            <span className={
                              item.tone === 'established' ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700' :
                              item.tone === 'mapped' ? 'rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-black uppercase text-sky-700' :
                              'rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700'
                            }>
                              {item.tone === 'established' ? 'Established' : item.tone === 'mapped' ? 'Mapped' : 'Open'}
                            </span>
                          </div>
                          <div className="mt-2 text-sm font-semibold leading-5 text-slate-700">{item.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-500">The detailed report keeps the full evidence trail, methodology and source record.</div>
                      <a href={window.location.origin + '/report?report_id=' + encodeURIComponent(report.id)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-950">
                        <FileText className="h-3.5 w-3.5" /> Open detailed report
                      </a>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 sm:p-6">
                    <div className="text-sm font-black text-slate-900">Now ask anything.</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">These are prompts, not a menu. Ask in your own words too.</div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {starterQuestions.map((item) => (
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
                      <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Looking through the evidence…</div>
                    ) : (
                      <>
                        <div className="flex gap-3">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-900 text-white"><Sparkles className="h-3.5 w-3.5" /></div>
                          <div className="text-[15px] leading-7 text-slate-700 whitespace-pre-line">{turn.answer.answer}</div>
                        </div>
                        {turn.answer.unknowns.length > 0 && (
                          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-amber-800"><CircleHelp className="h-3.5 w-3.5" /> Still open</div>
                            <div className="mt-2 space-y-2 text-xs leading-5 text-amber-900">{turn.answer.unknowns.map((item, i) => <div key={i}>{item}</div>)}</div>
                          </div>
                        )}
                        {turn.answer.localBusinesses && turn.answer.localBusinesses.length > 0 && (
                          <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-sky-800"><Phone className="h-3.5 w-3.5" /> Local help</div>
                            <div className="mt-1 text-[11px] leading-5 text-sky-900/70">Nearby services found in OpenStreetMap. This is a useful starting list, not a complete directory.</div>
                            <div className="mt-3 space-y-2">
                              {turn.answer.localBusinesses.map((business, i) => (
                                <div key={i} className="rounded-xl bg-white p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-xs font-black text-slate-800">{business.name}</div>
                                      <div className="mt-0.5 text-[10px] capitalize text-slate-400">{business.category} · {Math.round(business.distanceM).toLocaleString()} m away</div>
                                    </div>
                                    {business.phone && <a href={'tel:' + business.phone} className="shrink-0 text-[10px] font-bold text-sky-700">{business.phone}</a>}
                                  </div>
                                  {business.address && <div className="mt-1 text-[10px] text-slate-500">{business.address}</div>}
                                  {business.website && <a href={business.website} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-sky-700">Website <SquareArrowOutUpRight className="h-3 w-3" /></a>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {turn.answer.localBusinesses && turn.answer.localBusinesses.length === 0 && (
                          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-xs font-black uppercase tracking-wide text-slate-500">No mapped local listing found</div>
                            <div className="mt-1 text-[11px] leading-5 text-slate-500">You can still search nearby professionals. GroundSurf does not treat an empty directory as evidence that no service exists.</div>
                            <a
                              href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('geotechnical engineer surveyor architect environmental consultant near ' + report.latitude + ',' + report.longitude)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-slate-700"
                            >
                              Search nearby professionals <SquareArrowOutUpRight className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                        {turn.answer.nextQuestions.length > 0 && (
                          <div className="mt-5">
                            <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">You could ask next</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {turn.answer.nextQuestions.map((item, i) => <button key={i} onClick={() => ask(item)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950">{item}</button>)}
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
                  }} placeholder="Ask anything about this land…" className="min-h-[46px] flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-slate-400" />
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
                <div className="flex items-center gap-2 text-sm font-black"><Map className="h-4 w-4 text-slate-400" /> The place</div>
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
                <div className="p-4"><div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Area</div><div className="mt-1 text-sm font-black">{Math.round(report.area_size).toLocaleString()} m²</div></div>
                <div className="p-4"><div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Parcel</div><div className="mt-1 truncate text-sm font-black">{report.is_official_parcel ? 'Official' : 'Not confirmed'}</div></div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-black"><Target className="h-4 w-4 text-slate-400" /> Evidence map</div>
              <div className="mt-4 space-y-2">
                {coverage.map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-3">
                    <div><div className="text-xs font-bold text-slate-800">{item.label}</div><div className="mt-0.5 text-[10px] text-slate-400">{item.count ? item.count + ' evidence item' + (item.count === 1 ? '' : 's') : 'No matching record found'}</div></div>
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
                      <div className="flex items-start justify-between gap-2"><div className="text-xs font-bold text-slate-800">{item.sourceName}</div><span className="rounded-full bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase text-slate-400">{statusLabel(item.status)}</span></div>
                      <div className="mt-1 text-[11px] leading-5 text-slate-500">{item.claim}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-[2rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Go deeper</div>
              <div className="mt-3 text-lg font-black">The evidence can become a land record.</div>
              <p className="mt-2 text-xs leading-5 text-white/60">Keep the full screening report, sources and open questions together instead of printing a report and losing the trail.</p>
              <a href={window.location.origin + '/report?report_id=' + encodeURIComponent(report.id)} className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-white hover:text-white/80">
                Open detailed report <SquareArrowOutUpRight className="h-3.5 w-3.5" />
              </a>
            </section>

            {last?.error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">{last.error}</div>}
            {relevantSources.length > 0 && (
              <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-black">Sources</div>
                <div className="mt-3 space-y-2">
                  {relevantSources.slice(0, 5).map((source, index) => (
                    <a key={index} href={source.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-950">
                      <span className="truncate">{source.name}</span><SquareArrowOutUpRight className="ml-2 h-3.5 w-3.5 shrink-0" />
                    </a>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};
