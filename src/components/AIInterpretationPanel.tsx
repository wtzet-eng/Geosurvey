import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { AlertTriangle, BrainCircuit, CheckCircle2, Loader2, LogIn, LogOut, ShieldCheck, Sparkles, X } from 'lucide-react';
import { SiteReport } from '../types';
import { getCurrentFirebaseIdToken, isFirebaseAuthConfigured, signInWithGoogle, signOutCurrentUser, subscribeToAuthState } from '../lib/firebaseAuth';

interface Props {
  report: SiteReport;
}

interface AiStatus {
  providerConfigured: boolean;
  available: boolean;
  provider: 'mistral' | 'ollama';
  model: string;
  authRequired: boolean;
  authConfigured: boolean;
}

interface AiInterpretation {
  provider: 'mistral' | 'ollama';
  model: string;
  generatedAt: string;
  observations: string[];
  interpretation: string[];
  limitations: string[];
  verificationRequired: Array<{ topic: string; reason: string; priority: 'high' | 'medium' | 'standard' }>;
  overallConfidence: 'high' | 'medium' | 'low';
  disclaimer: string;
}

const priorityLabel = (priority: string) => priority === 'high' ? 'High' : priority === 'medium' ? 'Medium' : 'Standard';

export const AIInterpretationPanel: React.FC<Props> = ({ report }) => {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AiInterpretation | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/ai/status')
      .then(async response => response.ok ? response.json() : null)
      .then(value => { if (active && value) setStatus(value); })
      .catch(() => undefined);
    const unsubscribe = subscribeToAuthState(nextUser => { if (active) setUser(nextUser); });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    setResult(null);
    setError('');
  }, [report.id]);

  if (!status?.providerConfigured) return null;

  const signIn = async () => {
    setError('');
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const runInterpretation = async () => {
    setError('');
    setIsRunning(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (status.authRequired) {
        const token = await getCurrentFirebaseIdToken();
        if (!token) throw new Error('Please sign in before using AI interpretation.');
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch('/api/ai/interpret', {
        method: 'POST',
        headers,
        body: JSON.stringify({ report })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'AI interpretation failed.');
      setResult(payload);
    } catch (err: any) {
      setError(err?.message || 'AI interpretation failed.');
    } finally {
      setIsRunning(false);
    }
  };

  const canRun = status.available && (!status.authRequired || Boolean(user));

  return <>
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-indigo-950/20 hover:bg-indigo-700 print:hidden"
      aria-label="Interpret report evidence with AI"
    >
      <Sparkles className="h-4 w-4" />
      <span className="hidden sm:inline">Interpret with AI</span>
      <span className="sm:hidden">AI</span>
    </button>

    {isOpen && <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm p-3 sm:p-6 print:hidden" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700"><BrainCircuit className="h-5 w-5" /></div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-indigo-600">SurveyLand AI interpretation</div>
              <h2 className="mt-0.5 text-lg font-black text-slate-950">Interpret the collected evidence</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">The model receives SurveyLand's structured evidence package only. It is not allowed to invent missing parcel facts or turn nearby observations into design values.</p>
            </div>
          </div>
          <button type="button" onClick={() => setIsOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{status.provider} · {status.model}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" />Server-side model key</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">AI interpretation ≠ new evidence</span>
          </div>

          {status.authRequired && !status.authConfigured && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Sign-in is not configured on the server yet.</strong> Add the Firebase web API key before enabling AI interpretation publicly.</div>}
          {status.authRequired && status.authConfigured && !isFirebaseAuthConfigured && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Firebase client configuration is missing.</strong> The deployment needs the VITE_FIREBASE_* values before users can sign in.</div>}

          {status.authRequired && status.authConfigured && isFirebaseAuthConfigured && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {user ? <div className="flex flex-wrap items-center justify-between gap-3">
              <div><div className="text-xs font-bold text-slate-900">Signed in</div><div className="text-xs text-slate-500">{user.email || user.displayName || 'Authenticated user'}</div></div>
              <button type="button" onClick={() => signOutCurrentUser()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><LogOut className="h-3.5 w-3.5" />Sign out</button>
            </div> : <div className="flex flex-wrap items-center justify-between gap-3">
              <div><div className="text-xs font-bold text-slate-900">Sign in to use the model</div><div className="text-xs text-slate-500">The public evidence remains available without an account.</div></div>
              <button type="button" onClick={signIn} disabled={isSigningIn} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{isSigningIn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}{isSigningIn ? 'Signing in…' : 'Sign in with Google'}</button>
            </div>}
          </div>}

          {!result && <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5">
            <h3 className="text-sm font-bold text-slate-950">What the AI will do</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Summarize direct observations, explain what they may mean for preliminary due diligence, identify limitations, and produce a prioritized verification list. It cannot certify buildability, legal title, boundaries, groundwater depth, bearing capacity, or a foundation solution.</p>
            <button type="button" onClick={runInterpretation} disabled={!canRun || isRunning} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isRunning ? 'Interpreting evidence…' : 'Interpret this evidence'}
            </button>
          </div>}

          {error && <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

          {result && <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-emerald-900"><CheckCircle2 className="h-4 w-4" />Interpretation completed</div><div className="mt-1 text-xs text-emerald-800">Confidence: {result.overallConfidence} · {result.provider} / {result.model}</div></div>
            <ResultList title="Direct observations" items={result.observations} />
            <ResultList title="Interpretation" items={result.interpretation} />
            <ResultList title="Limitations" items={result.limitations} />
            <section className="rounded-2xl border border-slate-200 p-4"><h3 className="text-sm font-bold text-slate-950">What to verify next</h3><div className="mt-3 space-y-2">{result.verificationRequired.map((item, index) => <div key={`${item.topic}-${index}`} className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><div className="text-sm font-semibold text-slate-900">{item.topic}</div><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">{priorityLabel(item.priority)}</span></div><div className="mt-1 text-xs leading-relaxed text-slate-600">{item.reason}</div></div>)}</div></section>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">{result.disclaimer}</div>
            <button type="button" onClick={runInterpretation} disabled={isRunning} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Run again</button>
          </div>}
        </div>
      </div>
    </div>}
  </>;
};

const ResultList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => <section className="rounded-2xl border border-slate-200 p-4"><h3 className="text-sm font-bold text-slate-950">{title}</h3>{items.length ? <ul className="mt-3 space-y-2">{items.map((item, index) => <li key={`${title}-${index}`} className="flex gap-2 text-sm leading-relaxed text-slate-600"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />{item}</li>)}</ul> : <div className="mt-2 text-xs text-slate-400">None reported.</div>}</section>;
