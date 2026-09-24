import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { AlertTriangle, BrainCircuit, CheckCircle2, CreditCard, Loader2, LogIn, LogOut, RefreshCw, ShieldCheck, Sparkles, X } from 'lucide-react';
import { SiteReport } from '../types';
import { getCurrentFirebaseIdToken, isFirebaseAuthConfigured, signInWithGoogle, signOutCurrentUser, subscribeToAuthState } from '../lib/firebaseAuth';
import { getActionText } from '../utils/actionI18n';
import { FloatingSupportLandSurf } from './SupportLandSurf';

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
  keyConsiderations: Array<{ title: string; concern: string; evidenceBasis: string; verifyNext: string; priority: 'high' | 'medium' | 'standard' }>;
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

export const aiPanelCopy = (language: string) => language.toLowerCase().startsWith('de') ? {
  brand:'LandSurf KI-Interpretation', title:'Gesammelte Evidenz interpretieren', description:'Das Modell erhält ausschließlich das strukturierte Evidenzpaket von LandSurf. Es darf keine fehlenden Grundstücksdaten erfinden oder Beobachtungen aus der Umgebung in Bemessungswerte umwandeln.', close:'Schließen', serverKey:'Modellschlüssel auf dem Server', notEvidence:'KI-Interpretation ≠ neue Evidenz', signedIn:'Angemeldet', authenticatedUser:'Authentifizierter Benutzer', signOut:'Abmelden', signInTitle:'Anmelden, um das Modell zu verwenden', publicEvidence:'Die öffentlichen Evidenzdaten bleiben auch ohne Konto verfügbar.', signingIn:'Anmeldung läuft…', signInGoogle:'Mit Google anmelden', noCredits:'Keine KI-Credits mehr verfügbar', credits:'Credits für KI-Interpretationen', creditExplain:'Der Evidenzbericht bleibt verfügbar. Für jede erfolgreich abgeschlossene KI-Interpretation wird ein Credit verwendet. Credit-Pakete sind Einmalkäufe; der Gesamtpreis und gegebenenfalls anfallende Steuern werden beim Bezahlen angezeigt.', buy:'Preis anzeigen und kaufen', paidNotConfigured:'Bezahlte Credit-Pakete sind noch nicht konfiguriert.', refresh:'Credits aktualisieren', sandbox:'Paddle-Sandboxmodus — es wird kein echtes Geld belastet.', whatAi:'Was die KI-Interpretation macht', whatAiText:'Sie fasst direkte Beobachtungen zusammen, erläutert deren mögliche Bedeutung für eine vorläufige Due Diligence, benennt Einschränkungen und erstellt eine priorisierte Liste der nächsten Prüfungen. Sie kann weder die Bebaubarkeit noch Eigentum, Grenzen, Grundwassertiefe, Tragfähigkeit oder eine Gründungslösung bestätigen.', interpreting:'Evidenz wird interpretiert…', interpret:'Diese Evidenz interpretieren', completed:'Interpretation abgeschlossen', confidence:'Konfidenz', observations:'Direkte Beobachtungen', interpretation:'Interpretation', limitations:'Einschränkungen', verifyNext:'Als Nächstes zu prüfen', runAgain:'Erneut ausführen', none:'Keine Angaben.', free:'kostenlos', purchased:'gekaufte KI-Credits verbleibend', creditUnit:'KI-Credits', high:'Hoch', medium:'Mittel', standard:'Standard', low:'Niedrig'
} : language.toLowerCase().startsWith('da') ? {
  brand:'LandSurf AI-fortolkning', title:'Fortolk det indsamlede evidensgrundlag', description:'Modellen modtager kun LandSurfs strukturerede evidenspakke. Den må ikke opfinde manglende oplysninger om grunden eller gøre nærliggende observationer til projekteringsværdier.', close:'Luk', serverKey:'Modelnøgle på serversiden', notEvidence:'AI-fortolkning ≠ ny evidens', signedIn:'Logget ind', authenticatedUser:'Godkendt bruger', signOut:'Log ud', signInTitle:'Log ind for at bruge modellen', publicEvidence:'Det offentlige evidensgrundlag er fortsat tilgængeligt uden en konto.', signingIn:'Logger ind…', signInGoogle:'Log ind med Google', noCredits:'Ingen AI-kreditter tilbage', credits:'AI-kreditter til fortolkning', creditExplain:'Evidensrapporten er fortsat tilgængelig. Der bruges én kredit pr. vellykket AI-fortolkning. Kreditpakker er engangskøb; den fulde pris og eventuelle skatter vises ved betaling.', buy:'Se pris og køb', paidNotConfigured:'Betalte kreditpakker er endnu ikke konfigureret.', refresh:'Opdatér kreditter', sandbox:'Paddle-sandkassetilstand — der trækkes ingen rigtige penge.', whatAi:'Det gør AI-fortolkningen', whatAiText:'Opsummerer direkte observationer, forklarer hvad de kan betyde for den indledende due diligence, fremhæver begrænsninger og laver en prioriteret liste over næste verifikationer. Den kan ikke certificere byggeret, juridisk ejerskab, grænser, grundvandsdybde, bæreevne eller en funderingsløsning.', interpreting:'Fortolker evidensen…', interpret:'Fortolk evidensen', completed:'Fortolkning gennemført', confidence:'Sikkerhed', observations:'Direkte observationer', interpretation:'Fortolkning', limitations:'Begrænsninger', verifyNext:'Det skal verificeres næste gang', runAgain:'Kør igen', none:'Ingen oplysninger.', free:'gratis', purchased:'købte AI-kreditter tilbage', creditUnit:'AI-kreditter', high:'Høj', medium:'Mellem', standard:'Standard', low:'Lav'
} : language.toLowerCase().startsWith('es') ? {
  brand:'Interpretación de IA de LandSurf', title:'Interpretar la evidencia recopilada', description:'El modelo recibe únicamente el paquete de evidencias estructuradas de LandSurf. No puede inventar datos que falten sobre la parcela ni convertir observaciones cercanas en valores de diseño.', close:'Cerrar', serverKey:'Clave del modelo en el servidor', notEvidence:'La interpretación de IA ≠ evidencia nueva', signedIn:'Sesión iniciada', authenticatedUser:'Usuario autenticado', signOut:'Cerrar sesión', signInTitle:'Inicie sesión para usar el modelo', publicEvidence:'La evidencia pública sigue disponible sin una cuenta.', signingIn:'Iniciando sesión…', signInGoogle:'Iniciar sesión con Google', noCredits:'No quedan créditos de IA', credits:'Créditos de interpretación con IA', creditExplain:'El informe de evidencias sigue disponible. Se utiliza un crédito por cada interpretación de IA completada correctamente. Los paquetes de créditos son compras únicas; el precio total y los impuestos aplicables se muestran al pagar.', buy:'Ver precio y comprar', paidNotConfigured:'Los paquetes de créditos de pago aún no están configurados.', refresh:'Actualizar créditos', sandbox:'Modo sandbox de Paddle — no se cobra dinero real.', whatAi:'Qué hará la interpretación de IA', whatAiText:'Resume las observaciones directas, explica qué pueden significar para una due diligence preliminar, identifica las limitaciones y genera una lista priorizada de verificaciones siguientes. No puede certificar la edificabilidad, la titularidad legal, los límites, la profundidad del agua subterránea, la capacidad portante ni una solución de cimentación.', interpreting:'Interpretando la evidencia…', interpret:'Interpretar esta evidencia', completed:'Interpretación completada', confidence:'Confianza', observations:'Observaciones directas', interpretation:'Interpretación', limitations:'Limitaciones', verifyNext:'Qué verificar a continuación', runAgain:'Volver a ejecutar', none:'No se informó de datos.', free:'gratis', purchased:'créditos de IA comprados restantes', creditUnit:'créditos de IA', high:'Alta', medium:'Media', standard:'Estándar', low:'Baja'
} : language.toLowerCase().startsWith('sk') ? {
  brand:'Interpretácia AI LandSurf', title:'Interpretovať zhromaždené dôkazy', description:'Model dostáva iba štruktúrovaný balík dôkazov LandSurf. Nesmie si vymýšľať chýbajúce údaje o parcele ani meniť okolité pozorovania na návrhové hodnoty.', close:'Zavrieť', serverKey:'Kľúč modelu na strane servera', notEvidence:'Interpretácia AI ≠ nový dôkaz', signedIn:'Prihlásený používateľ', authenticatedUser:'Overený používateľ', signOut:'Odhlásiť sa', signInTitle:'Prihláste sa, aby ste mohli použiť model', publicEvidence:'Verejné dôkazy zostávajú dostupné aj bez účtu.', signingIn:'Prihlasovanie…', signInGoogle:'Prihlásiť sa cez Google', noCredits:'Nezostávajú žiadne kredity AI', credits:'Kredity na interpretáciu AI', creditExplain:'Správa o dôkazoch zostáva dostupná. Za každú úspešnú interpretáciu AI sa použije jeden kredit. Balíky kreditov sú jednorazové nákupy; celková cena a prípadné dane sa zobrazia pri platbe.', buy:'Zobraziť cenu a kúpiť', paidNotConfigured:'Platené balíky kreditov ešte nie sú nakonfigurované.', refresh:'Obnoviť kredity', sandbox:'Testovací režim Paddle — neúčtujú sa skutočné peniaze.', whatAi:'Čo urobí interpretácia AI', whatAiText:'Zhrnie priame pozorovania, vysvetlí ich možný význam pre predbežnú due diligence, upozorní na obmedzenia a vytvorí prioritný zoznam ďalších overení. Nemôže potvrdiť zastavateľnosť, právny titul, hranice, hĺbku podzemnej vody, únosnosť ani spôsob založenia.', interpreting:'Interpretujú sa dôkazy…', interpret:'Interpretovať tieto dôkazy', completed:'Interpretácia dokončená', confidence:'Miera istoty', observations:'Priame pozorovania', interpretation:'Interpretácia', limitations:'Obmedzenia', verifyNext:'Čo treba overiť ďalej', runAgain:'Spustiť znova', none:'Neboli uvedené žiadne údaje.', free:'zadarmo', purchased:'zostávajúcich kúpených kreditov AI', creditUnit:'kredity AI', high:'Vysoká', medium:'Stredná', standard:'Štandardná', low:'Nízka'
} : language.toLowerCase().startsWith('sv') ? {
  brand:'LandSurf AI-tolkning', title:'Tolka det insamlade underlaget', description:'Modellen får endast LandSurfs strukturerade evidenspaket. Den får inte hitta på uppgifter som saknas om tomten eller göra närliggande observationer till projekteringsvärden.', close:'Stäng', serverKey:'Modellnyckel på serversidan', notEvidence:'AI-tolkning ≠ nytt underlag', signedIn:'Inloggad', authenticatedUser:'Autentiserad användare', signOut:'Logga ut', signInTitle:'Logga in för att använda modellen', publicEvidence:'Det offentliga evidensunderlaget är fortsatt tillgängligt utan konto.', signingIn:'Loggar in…', signInGoogle:'Logga in med Google', noCredits:'Inga AI-krediter kvar', credits:'AI-krediter för tolkning', creditExplain:'Evidensrapporten är fortsatt tillgänglig. En kredit används per lyckad AI-tolkning. Kreditpaket är engångsköp; fullständigt pris och eventuella skatter visas i kassan.', buy:'Se pris och köp', paidNotConfigured:'Betalda kreditpaket är ännu inte konfigurerade.', refresh:'Uppdatera krediter', sandbox:'Paddle-sandlådeläge — inga riktiga pengar debiteras.', whatAi:'Det här gör AI-tolkningen', whatAiText:'Sammanfattar direkta observationer, förklarar vad de kan betyda för en preliminär due diligence, identifierar begränsningar och skapar en prioriterad lista över nästa verifieringar. Den kan inte certifiera byggrätt, juridisk äganderätt, gränser, grundvattennivå, bärförmåga eller grundläggningslösning.', interpreting:'Tolkar underlaget…', interpret:'Tolka underlaget', completed:'Tolkningen är klar', confidence:'Konfidens', observations:'Direkta observationer', interpretation:'Tolkning', limitations:'Begränsningar', verifyNext:'Det här bör verifieras härnäst', runAgain:'Kör igen', none:'Inga uppgifter.', free:'gratis', purchased:'köpta AI-krediter kvar', creditUnit:'AI-krediter', high:'Hög', medium:'Medel', standard:'Standard', low:'Låg'
} : language.toLowerCase().startsWith('hr') ? {
  brand:'LandSurf AI interpretacija', title:'Protumačite prikupljene dokaze', description:'Model prima samo strukturirani paket dokaza LandSurfa. Ne smije izmišljati nedostajuće podatke o parceli niti obližnja opažanja pretvarati u projektne vrijednosti.', close:'Zatvori', serverKey:'Ključ modela na poslužitelju', notEvidence:'AI interpretacija ≠ novi dokaz', signedIn:'Prijavljeni ste', authenticatedUser:'Autentificirani korisnik', signOut:'Odjava', signInTitle:'Prijavite se za korištenje modela', publicEvidence:'Javno dostupni dokazi ostaju dostupni i bez računa.', signingIn:'Prijava u tijeku…', signInGoogle:'Prijava putem Googlea', noCredits:'Nema preostalih AI kredita', credits:'AI krediti za interpretaciju', creditExplain:'Izvještaj s dokazima ostaje dostupan. Za svaku uspješno dovršenu AI interpretaciju koristi se jedan kredit. Paketi kredita kupuju se jednokratno; ukupna cijena i porezi prikazani su pri naplati.', buy:'Prikaži cijenu i kupi', paidNotConfigured:'Plaćeni paketi kredita još nisu konfigurirani.', refresh:'Osvježi kredite', sandbox:'Paddle sandbox način rada — ne naplaćuje se stvarni novac.', whatAi:'Što će AI napraviti', whatAiText:'Sažet će izravna opažanja, objasniti što ona mogu značiti za preliminarni due diligence, navesti ograničenja i izraditi prioritetni popis sljedećih provjera. Ne može potvrditi gradivost, pravni naslov, granice, dubinu podzemne vode, nosivost ni rješenje temeljenja.', interpreting:'Tumačenje dokaza…', interpret:'Protumači ove dokaze', completed:'Interpretacija dovršena', confidence:'Pouzdanost', observations:'Izravna opažanja', interpretation:'Interpretacija', limitations:'Ograničenja', verifyNext:'Što provjeriti dalje', runAgain:'Pokreni ponovno', none:'Nema navedenih podataka.', free:'besplatno', purchased:'preostalih kupljenih AI kredita', creditUnit:'AI kredita', high:'Visoka', medium:'Srednja', standard:'Standardna', low:'Niska'
} : {
  brand:'LandSurf AI interpretation', title:'Interpret the collected evidence', description:"The model receives LandSurf's structured evidence package only. It is not allowed to invent missing parcel facts or turn nearby observations into design values.", close:'Close', serverKey:'Server-side model key', notEvidence:'AI interpretation ≠ new evidence', signedIn:'Signed in', authenticatedUser:'Authenticated user', signOut:'Sign out', signInTitle:'Sign in to use the model', publicEvidence:'The public evidence remains available without an account.', signingIn:'Signing in…', signInGoogle:'Sign in with Google', noCredits:'No AI credits remaining', credits:'AI interpretation credits', creditExplain:'The evidence report remains available. One credit is used per successful AI interpretation. Credit packs are a one-time purchase; the full price and taxes are shown in checkout.', buy:'View price & buy', paidNotConfigured:'Paid credit packs are not configured yet.', refresh:'Refresh credits', sandbox:'Paddle sandbox mode — no real money is charged.', whatAi:'What the AI will do', whatAiText:'Summarize direct observations, explain what they may mean for preliminary due diligence, identify limitations, and produce a prioritized verification list. It cannot certify buildability, legal title, boundaries, groundwater depth, bearing capacity, or a foundation solution.', interpreting:'Interpreting evidence…', interpret:'Interpret this evidence', completed:'Interpretation completed', confidence:'Confidence', observations:'Direct observations', interpretation:'Interpretation', limitations:'Limitations', verifyNext:'What to verify next', runAgain:'Run again', none:'None reported.', free:'free', purchased:'purchased AI credits remaining', creditUnit:'AI credits', high:'High', medium:'Medium', standard:'Standard', low:'Low'
};
const priorityLabel = (priority: string, copy: ReturnType<typeof aiPanelCopy>) => priority === 'high' ? copy.high : priority === 'medium' ? copy.medium : copy.standard;
const confidenceLabel = (confidence: string, copy: ReturnType<typeof aiPanelCopy>) => confidence === 'high' ? copy.high : confidence === 'medium' ? copy.medium : copy.low;
const developmentCopy = (language: string) => {
  const l = language.toLowerCase();
  if (l.startsWith('pl')) return { keyConsiderations: 'Kluczowe kwestie dla zagospodarowania', basedOnEvidence: 'Podstawa w dowodach', checkNext: 'Co sprawdzić dalej' };
  if (l.startsWith('de')) return { keyConsiderations: 'Wichtige Entwicklungshinweise', basedOnEvidence: 'Grundlage der Evidenz', checkNext: 'Nächster Prüfschritt' };
  if (l.startsWith('fr')) return { keyConsiderations: 'Points clés pour le développement', basedOnEvidence: 'Fondement des données', checkNext: 'À vérifier ensuite' };
  if (l.startsWith('nl')) return { keyConsiderations: 'Belangrijke ontwikkelingspunten', basedOnEvidence: 'Onderbouwing', checkNext: 'Volgende controle' };
  if (l.startsWith('es')) return { keyConsiderations: 'Consideraciones clave para el desarrollo', basedOnEvidence: 'Base de evidencia', checkNext: 'Qué comprobar después' };
  if (l.startsWith('hr')) return { keyConsiderations: 'Ključna pitanja za razvoj', basedOnEvidence: 'Osnova u dokazima', checkNext: 'Što provjeriti dalje' };
  return { keyConsiderations: 'Key development considerations', basedOnEvidence: 'Evidence basis', checkNext: 'Check next' };
};
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

  const devCopy = developmentCopy(report.language);
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
  const ui=aiPanelCopy(report.language);
  const canRun = status.available && (!status.authRequired || Boolean(user)) && !(entitlement?.enabled && entitlement.paywallRequired);
  const allowanceLabel = entitlement?.enabled
    ? `${entitlement.freeRemaining} ${ui.free} + ${entitlement.purchasedCredits} ${ui.purchased}`
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
    <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] -translate-x-1/2 px-0 print:hidden sm:left-auto sm:right-4 sm:w-auto sm:translate-x-0">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
        {launcher('inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-indigo-950/10 hover:bg-indigo-700 sm:min-w-56')}
        <FloatingSupportLandSurf language={report.language} />
      </div>
    </div>

    {isOpen && <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm p-3 sm:p-6 print:hidden" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700"><BrainCircuit className="h-5 w-5" /></div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-indigo-600">{ui.brand}</div>
              <h2 className="mt-0.5 text-lg font-black text-slate-950">{ui.title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{ui.description}</p>
            </div>
          </div>
          <button type="button" onClick={() => setIsOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label={ui.close}><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{status.provider} · {status.model}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" />{ui.serverKey}</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">{ui.notEvidence}</span>
            {allowanceLabel && <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">{allowanceLabel}</span>}
          </div>

          {status.authRequired && !status.authConfigured && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Sign-in is not configured on the server yet.</strong> Add the Firebase web API key before enabling AI interpretation publicly.</div>}
          {status.authRequired && status.authConfigured && !isFirebaseAuthConfigured && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Firebase client configuration is missing.</strong> The deployment needs the VITE_FIREBASE_* values before users can sign in.</div>}

          {status.authRequired && status.authConfigured && isFirebaseAuthConfigured && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {user ? <div className="flex flex-wrap items-center justify-between gap-3">
              <div><div className="text-xs font-bold text-slate-900">{ui.signedIn}</div><div className="text-xs text-slate-500">{user.email || user.displayName || ui.authenticatedUser}</div></div>
              <button type="button" onClick={() => signOutCurrentUser()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><LogOut className="h-3.5 w-3.5" />{ui.signOut}</button>
            </div> : <div className="flex flex-wrap items-center justify-between gap-3">
              <div><div className="text-xs font-bold text-slate-900">{ui.signInTitle}</div><div className="text-xs text-slate-500">{ui.publicEvidence}</div></div>
              <button type="button" onClick={signIn} disabled={isSigningIn} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{isSigningIn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}{isSigningIn ? ui.signingIn : ui.signInGoogle}</button>
            </div>}
          </div>}

          {entitlement?.enabled && (billing?.configured || entitlement.paywallRequired) && <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-700"><CreditCard className="h-5 w-5" /></div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-slate-950">{entitlement.paywallRequired ? ui.noCredits : ui.credits}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{ui.creditExplain}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {billing?.configured ? <button type="button" onClick={buyCredits} disabled={isBilling} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{isBilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}{ui.buy} {billing.creditPackSize} {ui.creditUnit}</button> : <span className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-violet-800">{ui.paidNotConfigured}</span>}
                  <button type="button" onClick={refreshEntitlement} disabled={isBilling} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-800"><RefreshCw className="h-3.5 w-3.5" />{ui.refresh}</button>
                </div>
                {billing?.environment === 'sandbox' && <p className="mt-3 text-[11px] font-semibold text-violet-700">{ui.sandbox}</p>}
              </div>
            </div>
          </div>}

          {!result && !(entitlement?.enabled && entitlement.paywallRequired) && <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5">
            <h3 className="text-sm font-bold text-slate-950">{ui.whatAi}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{ui.whatAiText}</p>
            <button type="button" onClick={runInterpretation} disabled={!canRun || isRunning} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isRunning ? ui.interpreting : ui.interpret}
            </button>
          </div>}

          {billingMessage && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{billingMessage}</div>}
          {error && <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

          {result && <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-emerald-900"><CheckCircle2 className="h-4 w-4" />{ui.completed}</div><div className="mt-1 text-xs text-emerald-800">{ui.confidence}: {confidenceLabel(result.overallConfidence,ui)} · {result.provider} / {result.model}</div></div>
            {result.keyConsiderations.length > 0 && <section className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-widest text-amber-700">{devCopy.keyConsiderations}</div><h3 className="mt-0.5 text-base font-black text-slate-950">{devCopy.keyConsiderations}</h3></div><AlertTriangle className="h-5 w-5 text-amber-600" /></div><div className="mt-4 space-y-3">{result.keyConsiderations.map((item,index)=><div key={item.title + '-' + index} className="rounded-2xl border border-amber-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="text-sm font-black text-slate-950">{item.title}</div><span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">{priorityLabel(item.priority,ui)}</span></div><p className="mt-2 text-sm leading-relaxed text-slate-700">{item.concern}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{devCopy.basedOnEvidence}</div><div className="mt-1 text-xs leading-relaxed text-slate-600">{item.evidenceBasis}</div></div><div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{devCopy.checkNext}</div><div className="mt-1 text-xs leading-relaxed text-slate-600">{item.verifyNext}</div></div></div></div>)}</div></section>}
            <ResultList title={ui.observations} items={result.observations} emptyText={ui.none} />
            <ResultList title={ui.interpretation} items={result.interpretation} emptyText={ui.none} />
            <ResultList title={ui.limitations} items={result.limitations} emptyText={ui.none} />
            <section className="rounded-2xl border border-slate-200 p-4"><h3 className="text-sm font-bold text-slate-950">{ui.verifyNext}</h3><div className="mt-3 space-y-2">{result.verificationRequired.map((item, index) => <div key={`${item.topic}-${index}`} className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><div className="text-sm font-semibold text-slate-900">{item.topic}</div><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">{priorityLabel(item.priority,ui)}</span></div><div className="mt-1 text-xs leading-relaxed text-slate-600">{item.reason}</div></div>)}</div></section>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">{result.disclaimer}</div>
            <button type="button" onClick={runInterpretation} disabled={isRunning || Boolean(entitlement?.paywallRequired)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{ui.runAgain}</button>
          </div>}
        </div>
      </div>
    </div>}
  </>;
};

const ResultList: React.FC<{ title: string; items: string[]; emptyText: string }> = ({ title, items, emptyText }) => <section className="rounded-2xl border border-slate-200 p-4"><h3 className="text-sm font-bold text-slate-950">{title}</h3>{items.length ? <ul className="mt-3 space-y-2">{items.map((item, index) => <li key={`${title}-${index}`} className="flex gap-2 text-sm leading-relaxed text-slate-600"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />{item}</li>)}</ul> : <div className="mt-2 text-xs text-slate-400">{emptyText}</div>}</section>;