import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { AlertTriangle, BrainCircuit, CheckCircle2, CreditCard, Loader2, LogIn, LogOut, RefreshCw, ShieldCheck, Sparkles, X } from 'lucide-react';
import { SiteReport } from '../types';
import { getCurrentFirebaseIdToken, isFirebaseAuthConfigured, signInWithGoogle, signOutCurrentUser, subscribeToAuthState } from '../lib/firebaseAuth';
import { getActionText } from '../utils/actionI18n';

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

interface AiEntitlement {
  enabled: boolean;
  freeLimit: number;
  freeUsed: number;
  freeRemaining: number;
  purchasedCredits: number;
  totalRemaining: number;
  paywallRequired: boolean;
}

interface BillingState {
  provider: 'paddle';
  configured: boolean;
  environment: 'sandbox' | 'production';
  creditPackSize: number;
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
  entitlement?: AiEntitlement;
}

declare global {
  interface Window {
    Paddle?: any;
  }
}

let paddleScriptPromise: Promise<void> | null = null;
let paddleInitializedToken = '';
let paddleCompletionHandler: ((transactionId: string) => void) | null = null;

const loadPaddle = () => {
  if (window.Paddle) return Promise.resolve();
  if (paddleScriptPromise) return paddleScriptPromise;
  paddleScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { paddleScriptPromise = null; script.remove(); reject(new Error('Could not load Paddle Checkout.')); };
    document.head.appendChild(script);
  });
  return paddleScriptPromise;
};

const initializePaddle = async (token: string, environment: 'sandbox' | 'production') => {
  await loadPaddle();
  if (!window.Paddle) throw new Error('Paddle Checkout did not initialize.');
  if (paddleInitializedToken === token) return;
  if (environment === 'sandbox') window.Paddle.Environment.set('sandbox');
  window.Paddle.Initialize({
    token,
    eventCallback: (event: any) => {
      if (event?.name === 'checkout.completed') {
        const transactionId = event?.data?.transaction_id;
        if (typeof transactionId === 'string' && transactionId) paddleCompletionHandler?.(transactionId);
      }
    }
  });
  paddleInitializedToken = token;
};

const priorityLabel = (priority: string) => priority === 'high' ? 'High' : priority === 'medium' ? 'Medium' : 'Standard';
const PENDING_TRANSACTION_KEY = 'surveyland_pending_paddle_transaction';

export const AIInterpretationPanel: React.FC<Props> = ({ report }) => {
  const userIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isBilling, setIsBilling] = useState(false);
  const [error, setError] = useState('');
  const [billingMessage, setBillingMessage] = useState('');
  const [result, setResult] = useState<AiInterpretation | null>(null);
  const [entitlement, setEntitlement] = useState<AiEntitlement | null>(null);
  const [billing, setBilling] = useState<BillingState | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/ai/status')
      .then(async response => response.ok ? response.json() : null)
      .then(value => { if (active && value) setStatus(value); })
      .catch(() => undefined);
    const unsubscribe = subscribeToAuthState(nextUser => {
      if (active) {
        userIdRef.current = nextUser?.uid || null;
        setUser(nextUser);
        setEntitlement(null); setBilling(null); setBillingMessage(''); setError(''); setIsBilling(false);
      }
    });
    return () => { active = false; userIdRef.current = null; paddleCompletionHandler = null; unsubscribe(); };
  }, []);

  useEffect(() => {
    setResult(null);
    setError('');
    setBillingMessage('');
  }, [report.id]);

  const pendingKey = () => user && billing ? `${PENDING_TRANSACTION_KEY}:${user.uid}:${billing.environment}` : null;
  const authenticatedRequest = async (action: 'entitlement' | 'create_checkout' | 'confirm_purchase', extras: Record<string, unknown> = {}) => {
    const uid = userIdRef.current;
    const token = await getCurrentFirebaseIdToken();
    if (!uid || !token || userIdRef.current !== uid) throw new Error('Please sign in to manage AI credits.');
    const route = action === 'entitlement' ? 'status' : action === 'create_checkout' ? 'checkout' : 'confirm';
    const response = await fetch(`/api/billing/${route}`, {
      method: action === 'entitlement' ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(action !== 'entitlement' ? { body: JSON.stringify(action === 'confirm_purchase' ? { transactionId: extras.transactionId } : {}) } : {})
    });
    const payload = await response.json().catch(() => ({}));
    if (userIdRef.current !== uid) throw new Error('The signed-in account changed.');
    if (!response.ok) throw new Error(payload.error || 'AI account request failed.');
    if (payload.entitlement) setEntitlement(payload.entitlement);
    if (payload.billing) setBilling(payload.billing);
    return payload;
  };

  const refreshEntitlement = async () => {
    if (!user || !status?.authRequired) return;
    try {
      const payload = await authenticatedRequest('entitlement');
      if (payload.kind === 'entitlement') setBillingMessage('');
      let pending: string | null = null;
      try { const key = pendingKey(); if (key) pending = localStorage.getItem(key); } catch { /* optional browser recovery */ }
      if (pending) await confirmPurchase(pending);
    } catch (err: any) {
      setError(err?.message || 'Could not load AI allowance.');
    }
  };

  useEffect(() => {
    if (!user || !status?.authConfigured || !status.authRequired) {
      setEntitlement(null);
      setBilling(null);
      return;
    }
    refreshEntitlement();
  }, [user?.uid, status?.authConfigured, status?.authRequired]);

  const confirmPurchase = async (transactionId: string): Promise<void> => {
    const uid = userIdRef.current;
    if (!transactionId || !uid) return;
    const key = pendingKey();
    setIsBilling(true);
    try {
      const payload = await authenticatedRequest('confirm_purchase', { transactionId });
      if (payload.kind === 'purchase_confirmed') {
        try { if (key) localStorage.removeItem(key); } catch { /* server receipt is authoritative */ }
        setBillingMessage(payload.duplicate ? 'These AI credits are already in your account.' : 'AI credits added to your account.');
      } else {
        setBillingMessage('Purchase is not confirmed yet. If you completed payment, refresh credits shortly.');
      }
    } catch (err: any) {
      if (userIdRef.current === uid) setBillingMessage(err?.message || 'Credit confirmation is still pending.');
    } finally {
      if (userIdRef.current === uid) setIsBilling(false);
    }
  };

  useEffect(() => {
    const key = pendingKey();
    if (!key) return;
    try { const pending = localStorage.getItem(key); if (pending) confirmPurchase(pending); } catch { /* optional browser recovery */ }
    return () => { paddleCompletionHandler = null; };
  }, [user?.uid, billing?.environment]);

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
    setBillingMessage('');
    setIsRunning(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let token = '';
      if (status.authRequired) {
        token = await getCurrentFirebaseIdToken() || '';
        if (!token) throw new Error('Please sign in before using AI interpretation.');
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch('/api/ai/interpret', {
        method: 'POST',
        headers,
        body: JSON.stringify({ report: token ? { ...report, __surveyland_token: token } : report })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'AI interpretation failed.');
      if (payload.entitlement) setEntitlement(payload.entitlement);
      if (payload.billing) setBilling(payload.billing);
      if (payload.kind === 'quota_exhausted') {
        setResult(null);
        return;
      }
      setResult(payload);
    } catch (err: any) {
      setError(err?.message || 'AI interpretation failed.');
    } finally {
      setIsRunning(false);
    }
  };

  const buyCredits = async () => {
    setError('');
    setBillingMessage('');
    setIsBilling(true);
    try {
      const payload = await authenticatedRequest('create_checkout');
      if (payload.kind !== 'checkout' || !payload.transactionId || !payload.clientToken) {
        if (payload.error) throw new Error(payload.error);
        return;
      }
      const uid = userIdRef.current;
      try { if (uid) localStorage.setItem(`${PENDING_TRANSACTION_KEY}:${uid}:${payload.environment}`, payload.transactionId); } catch { /* webhook fulfillment does not depend on browser storage */ }
      paddleCompletionHandler = transactionId => { if (userIdRef.current === uid) void confirmPurchase(transactionId); };
      await initializePaddle(payload.clientToken, payload.environment);
      window.Paddle?.Checkout.open({ transactionId: payload.transactionId });
    } catch (err: any) {
      setError(err?.message || 'Could not open Paddle Checkout.');
    } finally {
      setIsBilling(false);
    }
  };

  const actionText = getActionText(report.language);
  const canRun = status.available && (!status.authRequired || Boolean(user)) && !(entitlement?.enabled && entitlement.paywallRequired);
  const allowanceLabel = entitlement?.enabled
    ? `${entitlement.freeRemaining} free + ${entitlement.purchasedCredits} purchased AI credits remaining`
    : null;

  const launcher = (className: string) => (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className={className}
      aria-label={actionText.interpretAria}
    >
      <Sparkles className="h-4 w-4" />
      <span>{actionText.interpretWithAi}</span>
    </button>
  );

  return <>
    <div className="mx-auto w-full max-w-5xl px-4 pt-4 2xl:hidden print:hidden">
      <div className="flex justify-end">
        {launcher('inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-950/10 hover:bg-indigo-700')}
      </div>
    </div>
    <div className="fixed bottom-5 right-5 z-40 hidden w-52 2xl:block print:hidden">
      {launcher('inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-indigo-950/20 hover:bg-indigo-700')}
    </div>

    {isOpen && <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm p-3 sm:p-6 print:hidden" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700"><BrainCircuit className="h-5 w-5" /></div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-indigo-600">LandSurf AI interpretation</div>
              <h2 className="mt-0.5 text-lg font-black text-slate-950">Interpret the collected evidence</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">The model receives LandSurf's structured evidence package only. It is not allowed to invent missing parcel facts or turn nearby observations into design values.</p>
            </div>
          </div>
          <button type="button" onClick={() => setIsOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{status.provider} · {status.model}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" />Server-side model key</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">AI interpretation ≠ new evidence</span>
            {allowanceLabel && <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">{allowanceLabel}</span>}
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

          {entitlement?.enabled && (billing?.configured || entitlement.paywallRequired) && <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-700"><CreditCard className="h-5 w-5" /></div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-slate-950">{entitlement.paywallRequired ? 'No AI credits remaining' : 'AI interpretation credits'}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">The evidence report remains available. One credit is used per successful AI interpretation. Credit packs are a one-time purchase; the full price and taxes are shown in checkout.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {billing?.configured ? <button type="button" onClick={buyCredits} disabled={isBilling} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{isBilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}View price & buy {billing.creditPackSize} AI credits</button> : <span className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-violet-800">Paid credit packs are not configured yet.</span>}
                  <button type="button" onClick={refreshEntitlement} disabled={isBilling} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-800"><RefreshCw className="h-3.5 w-3.5" />Refresh credits</button>
                </div>
                {billing?.environment === 'sandbox' && <p className="mt-3 text-[11px] font-semibold text-violet-700">Paddle sandbox mode — no real money is charged.</p>}
              </div>
            </div>
          </div>}

          {!result && !(entitlement?.enabled && entitlement.paywallRequired) && <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5">
            <h3 className="text-sm font-bold text-slate-950">What the AI will do</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Summarize direct observations, explain what they may mean for preliminary due diligence, identify limitations, and produce a prioritized verification list. It cannot certify buildability, legal title, boundaries, groundwater depth, bearing capacity, or a foundation solution.</p>
            <button type="button" onClick={runInterpretation} disabled={!canRun || isRunning} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isRunning ? 'Interpreting evidence…' : 'Interpret this evidence'}
            </button>
          </div>}

          {billingMessage && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{billingMessage}</div>}
          {error && <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

          {result && <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-emerald-900"><CheckCircle2 className="h-4 w-4" />Interpretation completed</div><div className="mt-1 text-xs text-emerald-800">Confidence: {result.overallConfidence} · {result.provider} / {result.model}</div></div>
            <ResultList title="Direct observations" items={result.observations} />
            <ResultList title="Interpretation" items={result.interpretation} />
            <ResultList title="Limitations" items={result.limitations} />
            <section className="rounded-2xl border border-slate-200 p-4"><h3 className="text-sm font-bold text-slate-950">What to verify next</h3><div className="mt-3 space-y-2">{result.verificationRequired.map((item, index) => <div key={`${item.topic}-${index}`} className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><div className="text-sm font-semibold text-slate-900">{item.topic}</div><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">{priorityLabel(item.priority)}</span></div><div className="mt-1 text-xs leading-relaxed text-slate-600">{item.reason}</div></div>)}</div></section>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">{result.disclaimer}</div>
            <button type="button" onClick={runInterpretation} disabled={isRunning || Boolean(entitlement?.paywallRequired)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Run again</button>
          </div>}
        </div>
      </div>
    </div>}
  </>;
};

const ResultList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => <section className="rounded-2xl border border-slate-200 p-4"><h3 className="text-sm font-bold text-slate-950">{title}</h3>{items.length ? <ul className="mt-3 space-y-2">{items.map((item, index) => <li key={`${title}-${index}`} className="flex gap-2 text-sm leading-relaxed text-slate-600"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />{item}</li>)}</ul> : <div className="mt-2 text-xs text-slate-400">None reported.</div>}</section>;