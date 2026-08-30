import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Sparkles,
  Loader2,
  Circle,
  Square,
  Pentagon,
  Building2,
  Globe2,
  Sliders,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

import { BoundaryShape, BoundaryType, SiteReport } from './types';
import { EUROPEAN_COUNTRIES, REPORT_LANGUAGES } from './data/countries';
import { calculateBoundaryArea, getBoundaryCenter } from './utils/geo';
import { getBrowserLanguage, getFrontPageI18n } from './utils/i18nTitle';
import { MapPicker } from './components/MapPicker';
import { Header } from './components/Header';
import { ReportView } from './components/ReportView';
import { SavedReportsModal } from './components/SavedReportsModal';
import { EmbedModal } from './components/EmbedModal';
import { GoogleDriveModal } from './components/GoogleDriveModal';

const SUPPORTED_REPORT_LANGUAGE_CODES = new Set(['en', 'de', 'pl']);
const SUPPORTED_REPORT_LANGUAGES = REPORT_LANGUAGES.filter((language) => SUPPORTED_REPORT_LANGUAGE_CODES.has(language.code));
const normalizeReportLanguage = (language: string) => SUPPORTED_REPORT_LANGUAGE_CODES.has(language) ? language : 'en';

export default function App() {
  const [mode, setMode] = useState<BoundaryType>('polygon');
  const [shape, setShape] = useState<BoundaryShape | null>(null);
  const [areaSize, setAreaSize] = useState<number>(1000);
  const [countryCode, setCountryCode] = useState<string>('DE');
  const [languageCode, setLanguageCode] = useState<string>(() => normalizeReportLanguage(getBrowserLanguage()));
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [activeReport, setActiveReport] = useState<SiteReport | null>(null);
  const [savedReports, setSavedReports] = useState<SiteReport[]>([]);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);
  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isEmbeddedView, setIsEmbeddedView] = useState(false);
  const [hideHeaderInEmbed, setHideHeaderInEmbed] = useState(false);
  const [isAutoFitMode, setIsAutoFitMode] = useState(false);

  const currentCountry = EUROPEAN_COUNTRIES.find((c) => c.code === countryCode) || EUROPEAN_COUNTRIES[0];
  const fp = getFrontPageI18n(languageCode);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const isEmbed = params.get('embed') === 'true' || params.get('embed') === '1';
      if (isEmbed) setIsEmbeddedView(true);
      if (params.get('header') === '0' || params.get('noheader') === '1') setHideHeaderInEmbed(true);
      if (params.get('autofit') === '1' || params.get('autofit') === 'true' || params.get('compact') === '1') setIsAutoFitMode(true);
      const modeParam = params.get('mode');
      if (modeParam === 'circle' || modeParam === 'rectangle' || modeParam === 'polygon') setMode(modeParam);
      const cCode = params.get('country');
      if (cCode) {
        const found = EUROPEAN_COUNTRIES.find((c) => c.code.toLowerCase() === cCode.toLowerCase());
        if (found) setCountryCode(found.code);
      }
      const lCode = params.get('lang');
      if (lCode) {
        const foundLang = SUPPORTED_REPORT_LANGUAGES.find((l) => l.code.toLowerCase() === lCode.toLowerCase());
        if (foundLang) setLanguageCode(foundLang.code);
      }
      const areaParam = params.get('area');
      if (areaParam && !isNaN(Number(areaParam))) setAreaSize(Math.max(50, Number(areaParam)));
      const repId = params.get('report_id');
      if (repId) {
        fetch(`/api/reports/${repId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((rep) => { if (rep) setActiveReport(rep); })
          .catch(() => {});
      }
    } catch (e) {
      console.warn('Error reading URL search params:', e);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const postHeightToParent = () => {
      try {
        const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight);
        window.parent.postMessage({ type: 'geosurvey:resize', height: docHeight, reportActive: Boolean(activeReport) }, '*');
      } catch (e) {}
    };
    postHeightToParent();
    const ro = new ResizeObserver(() => postHeightToParent());
    ro.observe(document.body);
    const timer = setTimeout(postHeightToParent, 600);
    return () => { ro.disconnect(); clearTimeout(timer); };
  }, [activeReport, isEmbeddedView, isAnalyzing, shape]);

  useEffect(() => {
    try {
      const local = localStorage.getItem('saved_site_reports');
      if (local) setSavedReports(JSON.parse(local));
    } catch (e) {
      console.warn('Could not read saved reports from localStorage');
    }
    fetch('/api/reports')
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data) && data.length > 0) setSavedReports(data); })
      .catch(() => {});
  }, []);

  const saveReportToStore = (report: SiteReport) => {
    const updated = [report, ...savedReports.filter((r) => r.id !== report.id)];
    setSavedReports(updated);
    try {
      localStorage.setItem('saved_site_reports', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage save failed');
    }
    fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) }).catch(() => {});
  };

  const handleDeleteReport = (id: string) => {
    const updated = savedReports.filter((r) => r.id !== id);
    setSavedReports(updated);
    try { localStorage.setItem('saved_site_reports', JSON.stringify(updated)); } catch (e) {}
  };

  // Country and report language are independent. Changing country must never
  // silently replace the report language selected by the user.
  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode);
    setShape(null);
  };

  const handleShapeChange = (newShape: BoundaryShape | null) => {
    setShape(newShape);
    if (newShape) {
      const calculatedArea = calculateBoundaryArea(newShape, areaSize);
      if (calculatedArea > 0) setAreaSize(calculatedArea);
    }
  };

  const circleRadius = Math.sqrt((areaSize || 1000) / Math.PI);
  const isBoundaryComplete = Boolean(shape && (shape.type === 'circle' ? Boolean(shape.center) : shape.type === 'rectangle' ? (shape.corners?.length || 0) >= 2 : (shape.points?.length || 0) >= 3));

  const handleAnalyzeSite = async () => {
    setErrorMessage('');
    if (!isBoundaryComplete || !shape) {
      setErrorMessage('Please draw a site boundary on the map first.');
      return;
    }
    setIsAnalyzing(true);
    try {
      const center = getBoundaryCenter(shape) || currentCountry.defaultCenter;
      const res = await fetch('/api/analyze-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shape, areaSize: Math.round(areaSize), country: currentCountry.name, countryCode: currentCountry.code, language: languageCode, currency: currentCountry.currency }),
      });
      if (!res.ok) throw new Error('Failed to analyze site. Please try again.');
      const reportPayload = await res.json();
      const newReport: SiteReport = reportPayload?.report_data ? {
        ...reportPayload,
        country: reportPayload.country || currentCountry.name,
        country_code: reportPayload.country_code || currentCountry.code,
        language: reportPayload.language || languageCode,
        latitude: Number(reportPayload.latitude ?? center[0]),
        longitude: Number(reportPayload.longitude ?? center[1]),
        area_size: Number(reportPayload.area_size ?? Math.round(areaSize)),
        boundary: reportPayload.boundary || shape,
      } : {
        id: 'rep_' + Math.random().toString(36).substring(2, 9),
        created_at: new Date().toISOString(),
        location_name: reportPayload.location_name || `${center[0].toFixed(4)}, ${center[1].toFixed(4)}`,
        country: currentCountry.name,
        country_code: currentCountry.code,
        language: languageCode,
        latitude: center[0], longitude: center[1], area_size: Math.round(areaSize), boundary: shape, report_data: reportPayload,
      };
      saveReportToStore(newReport);
      setActiveReport(newReport);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while generating the report.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (activeReport) return <ReportView report={activeReport} onBack={() => setActiveReport(null)} />;

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 pb-16">
      {!hideHeaderInEmbed && <Header onOpenSaved={() => setIsSavedModalOpen(true)} onOpenEmbed={() => setIsEmbedModalOpen(true)} onOpenDrive={() => setIsDriveModalOpen(true)} savedCount={savedReports.length} />}
      <main className="mx-auto max-w-6xl px-4 space-y-8 py-6 sm:py-10">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold"><Sparkles className="h-3.5 w-3.5" /><span>{fp.badge}</span></div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">{fp.heroTitle}</h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">{fp.heroSub}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><MapPin className="h-4 w-4 text-primary" /><span>{fp.step1}</span></div>
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                <button type="button" onClick={() => { setMode('polygon'); setShape(null); }} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${mode === 'polygon' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}><Pentagon className="h-3.5 w-3.5" /><span>{fp.modePoly}</span></button>
                <button type="button" onClick={() => { setMode('rectangle'); setShape(null); }} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${mode === 'rectangle' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}><Square className="h-3.5 w-3.5" /><span>{fp.modeRect}</span></button>
                <button type="button" onClick={() => { setMode('circle'); setShape(null); }} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${mode === 'circle' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}><Circle className="h-3.5 w-3.5" /><span>{fp.modeCircle}</span></button>
              </div>
            </div>
            <MapPicker mode={mode} shape={shape} onChange={handleShapeChange} circleRadius={circleRadius} onClear={() => setShape(null)} defaultCenter={currentCountry.defaultCenter} defaultZoom={currentCountry.defaultZoom} />
            <div className="text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2">
              {isBoundaryComplete ? <div className="flex items-center gap-1.5 text-slate-900 font-medium"><span className="h-2 w-2 rounded-full bg-emerald-500" /><span>Boundary set · approx <strong className="text-primary font-bold">{Math.round(areaSize).toLocaleString()} m²</strong></span>{shape?.type === 'circle' && <span className="text-slate-400 text-[11px]">(adjust area input to resize)</span>}</div> : <span className="text-slate-500">{mode === 'circle' && 'Click the map to place the circle center.'}{mode === 'rectangle' && 'Click two opposite corners on the map to draw the rectangle.'}{mode === 'polygon' && 'Click sequential points on the map to draw a custom polygon boundary.'}</span>}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-3"><Sliders className="h-4 w-4 text-primary" /><span>{fp.step2}</span></div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between"><span>{fp.areaLbl}</span>{shape?.type !== 'circle' && isBoundaryComplete && <span className="text-[11px] text-slate-400 font-normal">(auto-calculated from boundary)</span>}</label>
                <input type="number" min={50} max={500000} value={Math.round(areaSize)} onChange={(e) => setAreaSize(Number(e.target.value))} disabled={shape?.type !== 'circle' && isBoundaryComplete} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-75 transition" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1"><Globe2 className="h-3.5 w-3.5 text-slate-400" /><span>{fp.countryLbl}</span></label>
                <select value={countryCode} onChange={(e) => handleCountryChange(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition">
                  {EUROPEAN_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.currency})</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700"><span>{fp.langLbl}</span></label>
                <select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition">
                  {SUPPORTED_REPORT_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
              {errorMessage && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2 border border-red-200/60"><AlertCircle className="h-4 w-4 shrink-0 text-red-500" /><span>{errorMessage}</span></div>}
            </div>

            <div className="space-y-3 pt-2">
              <button type="button" onClick={handleAnalyzeSite} disabled={isAnalyzing || !isBoundaryComplete} className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition">
                {isAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Gathering governmental data…</span></> : <><Building2 className="h-4 w-4" /><span>{fp.btnGen}</span><ChevronRight className="h-4 w-4 ml-auto" /></>}
              </button>
              <p className="text-center text-[11px] text-slate-400">Country and report language are selected independently.</p>
            </div>
          </div>
        </div>
      </main>

      <SavedReportsModal isOpen={isSavedModalOpen} onClose={() => setIsSavedModalOpen(false)} reports={savedReports} onSelectReport={(rep) => { setActiveReport(rep); setIsSavedModalOpen(false); }} onDeleteReport={handleDeleteReport} />
      <GoogleDriveModal isOpen={isDriveModalOpen} onClose={() => setIsDriveModalOpen(false)} report={activeReport} />
      <EmbedModal isOpen={isEmbedModalOpen} onClose={() => setIsEmbedModalOpen(false)} defaultCountry={countryCode} defaultLanguage={languageCode} />
    </div>
  );
}
