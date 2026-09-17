import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { AlertTriangle, BrainCircuit, CheckCircle2, GitCompareArrows, Loader2, LogIn, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { SiteReport } from '../types';
import { getCurrentFirebaseIdToken, isFirebaseAuthConfigured, signInWithGoogle, subscribeToAuthState } from '../lib/firebaseAuth';

interface Props { isOpen: boolean; onClose: () => void; reports: SiteReport[]; }
interface AiStatus { providerConfigured: boolean; available: boolean; provider: 'mistral' | 'ollama'; model: string; authRequired: boolean; authConfigured: boolean; }
interface ComparisonResult {
  provider: string; model: string; generatedAt: string; summary: string; intendedUse: string | null;
  sites: Array<{ reportId: string; label: string; fitSummary: string; strengths: string[]; concerns: string[]; unknowns: string[] }>;
  tradeoffs: string[]; verificationPriorities: Array<{ topic: string; siteIds: string[]; reason: string; priority: string }>;
  decisionGuidance: string; overallConfidence: string; disclaimer: string;
}

export const SiteComparisonModal: React.FC<Props> = ({ isOpen, onClose, reports }) => {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [intendedUse, setIntendedUse] = useState('');
  const [running, setRunning] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ComparisonResult | null>(null);

  useEffect(() => {
    fetch('/api/ai/status').then(r => r.ok ? r.json() : null).then(v => v && setStatus(v)).catch(() => undefined);
    return subscribeToAuthState(setUser);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(current => {
      const valid = current.filter(id => reports.some(r => r.id === id)).slice(0, 4);
      return valid.length >= 2 ? valid : reports.slice(0, Math.min(2, reports.length)).map(r => r.id);
    });
    setResult(null); setError('');
  }, [isOpen, reports]);

  const selectedReports = useMemo(() => selected.map(id => reports.find(report => report.id === id)).filter((report): report is SiteReport => Boolean(report)), [selected, reports]);
  const labels = useMemo(() => Object.fromEntries(reports.map(report => [report.id, report.location_name])), [reports]);

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setResult(null); setError('');
    setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 4 ? [...current, id] : current);
  };

  const signIn = async () => {
    setError(''); setSigningIn(true);
    try { await signInWithGoogle(); } catch (err: any) { setError(err?.message || 'Sign-in failed.'); } finally { setSigningIn(false); }
  };

  const compare = async () => {
    if (selectedReports.length < 2 || selectedReports.length > 4) return;
    setError(''); setResult(null); setRunning(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (status?.authRequired) {
        const token = await getCurrentFirebaseIdToken();
        if (!token) throw new Error('Please sign in before using AI comparison.');
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch('/api/ai/compare', { method: 'POST', headers, body: JSON.stringify({ reports: selectedReports, intendedUse: intendedUse.trim() || null }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'AI comparison failed.');
      if (payload.kind === 'quota_exhausted') throw new Error('No AI credits remain. Open a site report and use “Interpret with AI” to view or add credits.');
      setResult(payload);
    } catch (err: any) { setError(err?.message || 'AI comparison failed.'); } finally { setRunning(false); }
  };

  const canRun = Boolean(status?.available) && selectedReports.length >= 2 && selectedReports.length <= 4 && (!status?.authRequired || Boolean(user));

  return <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm p-3 sm:p-6 print:hidden" role="dialog" aria-modal="true">
    <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700"><GitCompareArrows className="h-5 w-5" /></div><div>
          <div className="text-xs font-bold uppercase tracking-widest text-indigo-600">LandSurf — Site Due Diligence</div>
          <h2 className="mt-0.5 text-lg font-black text-slate-950">Compare sites with AI</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">Compare 2–4 saved reports. AI receives only the structured LandSurf evidence and your optional intended-use scenario.</p>
        </div></div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5">
        {!status?.providerConfigured && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">AI comparison is not configured on this deployment yet.</div>}
        <div className="flex flex-wrap gap-2 text-[11px]"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" />Evidence-first comparison</span><span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">AI comparison ≠ new evidence</span>{status && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{status.provider} · {status.model}</span>}</div>

        <section className="rounded-3xl border border-slate-200 p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-slate-950">1. Choose sites</h3><p className="mt-1 text-xs text-slate-500">Select at least two and at most four completed reports.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{selected.length}/4</span></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">{reports.map(report => { const checked = selected.includes(report.id); return <button key={report.id} type="button" onClick={() => toggle(report.id)} className={`text-left rounded-2xl border p-3 transition ${checked ? 'border-indigo-300 bg-indigo-50/70' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}><div className="flex items-start gap-3"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>{checked && <CheckCircle2 className="h-3.5 w-3.5" />}</span><div className="min-w-0"><div className="text-xs font-bold text-slate-900 truncate">{report.location_name}</div><div className="mt-1 text-[11px] text-slate-500">{report.country} · {Math.round(report.area_size).toLocaleString()} m² · {new Date(report.created_at).toLocaleDateString()}</div></div></div></button>; })}</div>
          {reports.length < 2 && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Save at least two site reports before comparing them.</div>}
        </section>

        <section className="rounded-3xl border border-slate-200 p-5"><h3 className="text-sm font-black text-slate-950">2. What will the land be used for? <span className="font-medium text-slate-400">Optional</span></h3><p className="mt-1 text-xs text-slate-500">Examples: single-family house, small warehouse, solar installation, agricultural use. This changes the questions AI emphasizes; it does not establish permitted use.</p><textarea value={intendedUse} onChange={e => { setIntendedUse(e.target.value.slice(0, 1000)); setResult(null); }} placeholder="e.g. A detached house with a garden" rows={3} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100" /></section>

        {status?.authRequired && status.authConfigured && isFirebaseAuthConfigured && !user && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div><div className="text-xs font-bold text-slate-900">Sign in to compare with AI</div><div className="text-xs text-slate-500">Your saved evidence reports remain available without AI.</div></div><button type="button" onClick={signIn} disabled={signingIn} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{signingIn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}{signingIn ? 'Signing in…' : 'Sign in with Google'}</button></div>}
        {status?.authRequired && (!status.authConfigured || !isFirebaseAuthConfigured) && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">AI sign-in is not fully configured on this deployment yet.</div>}

        {!result && <button type="button" onClick={compare} disabled={!canRun || running} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{running ? 'Comparing evidence…' : 'Compare selected sites with AI'}</button>}
        {error && <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

        {result && <div className="space-y-4"><div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5"><div className="flex items-center gap-2 text-sm font-black text-indigo-950"><BrainCircuit className="h-4 w-4" />Comparison summary</div><p className="mt-2 text-sm leading-relaxed text-slate-700">{result.summary}</p>{result.intendedUse && <div className="mt-3 text-xs font-semibold text-indigo-800">Scenario: {result.intendedUse}</div>}</div>
          <div className="grid gap-4 lg:grid-cols-2">{result.sites.map(site => <section key={site.reportId} className="rounded-3xl border border-slate-200 p-5"><div className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">{labels[site.reportId] || site.label}</div><p className="mt-2 text-sm font-semibold leading-relaxed text-slate-900">{site.fitSummary}</p><MiniList title="Evidence in its favour" items={site.strengths} /><MiniList title="Concerns" items={site.concerns} /><MiniList title="Still unknown" items={site.unknowns} /></section>)}</div>
          <ResultList title="Key trade-offs" items={result.tradeoffs} />
          <section className="rounded-3xl border border-slate-200 p-5"><h3 className="text-sm font-black text-slate-950">What to verify next</h3><div className="mt-3 space-y-2">{result.verificationPriorities.map((item, index) => <div key={`${item.topic}-${index}`} className="rounded-2xl bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-900">{item.topic}</span><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">{item.priority}</span></div><p className="mt-1 text-xs leading-relaxed text-slate-600">{item.reason}</p>{item.siteIds.length > 0 && <p className="mt-1 text-[11px] text-slate-400">Sites: {item.siteIds.map(id => labels[id] || id).join(' · ')}</p>}</div>)}</div></section>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"><h3 className="text-sm font-black text-emerald-950">Decision guidance</h3><p className="mt-2 text-sm leading-relaxed text-emerald-900">{result.decisionGuidance}</p><p className="mt-2 text-[11px] font-semibold text-emerald-800">Overall comparison confidence: {result.overallConfidence}</p></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">{result.disclaimer}</div><button type="button" onClick={compare} disabled={running} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Run comparison again</button>
        </div>}
      </div>
    </div>
  </div>;
};

const MiniList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => <div className="mt-4"><h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h4>{items.length ? <ul className="mt-2 space-y-1.5">{items.map((item, index) => <li key={index} className="flex gap-2 text-xs leading-relaxed text-slate-600"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />{item}</li>)}</ul> : <p className="mt-1 text-xs text-slate-400">None identified from the supplied evidence.</p>}</div>;
const ResultList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => <section className="rounded-3xl border border-slate-200 p-5"><h3 className="text-sm font-black text-slate-950">{title}</h3><ul className="mt-3 space-y-2">{items.map((item, index) => <li key={index} className="flex gap-2 text-sm leading-relaxed text-slate-600"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />{item}</li>)}</ul></section>;
