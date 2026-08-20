import React, { useState } from 'react';
import { EvidenceQualityScore } from '../types';
import { ShieldCheck, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

interface EvidenceScoreCardProps {
  score?: EvidenceQualityScore;
  language?: string;
}

export const EvidenceScoreCard: React.FC<EvidenceScoreCardProps> = ({ score, language = 'en' }) => {
  const [expanded, setExpanded] = useState(false);

  if (!score) return null;

  const total = score.totalScore || 75;
  const isHigh = total >= 75;
  const isMed = total >= 50 && total < 75;

  const colorClass = isHigh
    ? 'text-emerald-700 bg-emerald-50 border-emerald-300'
    : isMed
    ? 'text-amber-700 bg-amber-50 border-amber-300'
    : 'text-rose-700 bg-rose-50 border-rose-300';

  const barColor = isHigh ? 'bg-emerald-500' : isMed ? 'bg-amber-500' : 'bg-rose-500';

  const b = score.breakdown;
  const t = language === 'pl' ? { title: 'Wynik jakości i wiarygodności dowodów', subtitle: 'Przejrzysty model pewności danych w sześciu obszarach oceny', quality: 'Obliczona jakość', low: 'Hipoteza niezweryfikowana', regional: 'Model regionalny', direct: 'Bezpośrednie dane terenowe', verified: 'Zweryfikowane punkty danych', official: 'Kataster urzędowy / DEM', modelled: 'Modele regionalne', geo: 'Dane geologiczne / hydrologiczne', requires: 'Wymagają weryfikacji', onsite: 'Badania terenowe / plan miejscowy', hide: 'Ukryj szczegóły wyniku', show: 'Pokaż wynik według obszarów', categories: ['Kataster i granice prawne', 'Teren i model wysokościowy', 'Geologia i wody gruntowe', 'Infrastruktura i dostęp', 'Hydrologia i ryzyko powodziowe', 'Planowanie i wycena'], rationale: 'Wynik odzwierciedla dostępność i status dowodów w tej kategorii.', summary: 'Wynik jest obliczany wyłącznie na podstawie zarejestrowanego statusu i dostępności dowodów.', robust: 'Mocne dowody', moderate: 'Umiarkowane dowody', preliminary: 'Wstępne dowody' } : language === 'de' ? { title: 'Evidenzqualität und Zuverlässigkeitswert', subtitle: 'Transparentes Datengewissheitsmodell in sechs Bewertungsbereichen', quality: 'Berechnete Qualität', low: 'Unverifizierte Hypothese', regional: 'Regionalmodell', direct: 'Direkte Standortdaten', verified: 'Verifizierte Datenpunkte', official: 'Amtliches Kataster / DEM', modelled: 'Regionalmodelle', geo: 'Geologische / hydrologische Daten', requires: 'Prüfung erforderlich', onsite: 'Standortuntersuchung / Bauleitplanung', hide: 'Bewertungsdetails ausblenden', show: 'Bewertung nach Fachbereich anzeigen', categories: ['Kataster und Rechtsgrenze', 'Gelände und Höhenmodell', 'Geologie und Grundwasser', 'Infrastruktur und Zugang', 'Hydrologie und Hochwasserrisiko', 'Planung und Bewertung'], rationale: 'Der Wert spiegelt Verfügbarkeit und Evidenzstatus dieser Kategorie wider.', summary: 'Der Wert wird ausschließlich aus dem erfassten Status und der Verfügbarkeit der Evidenz berechnet.', robust: 'Robuste Evidenz', moderate: 'Mittlere Evidenz', preliminary: 'Vorläufige Evidenz' } : { title: 'Evidence Quality & Reliability Score', subtitle: 'Transparent data certainty model across six evaluation disciplines', quality: 'Calculated Quality', low: 'Unverified Hypothesis', regional: 'Regional Model', direct: 'Direct On-Site Evidence', verified: 'Verified Data Points', official: 'Official cadastre / DEM', modelled: 'Regional Models', geo: 'Geological / Hydrological', requires: 'Require Verification', onsite: 'On-site investigation / planning', hide: 'Hide Score Category Details', show: 'View Scoring Breakdown by Discipline', categories: ['Cadastre & Legal Boundary', 'Terrain & Elevation DEM', 'Geology & Groundwater', 'Infrastructure & Access', 'Hydrology & Flood Risk', 'Planning & Valuation'], rationale: 'The score reflects evidence availability and status for this category.', summary: 'The score is calculated only from recorded evidence availability and status.', robust: 'Robust Evidence', moderate: 'Moderate Evidence', preliminary: 'Preliminary Evidence' };
  const rating = total >= 75 ? t.robust : total >= 50 ? t.moderate : t.preliminary;

  return (
    <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">{t.title}</h3>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
                {rating}
              </span>
            </div>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-3xl font-black text-slate-950 font-mono tracking-tight">
              {total}<span className="text-lg font-bold text-slate-400">/100</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t.quality}</span>
          </div>
        </div>
      </div>

      {/* Progress meter */}
      <div className="space-y-1.5">
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 border border-slate-200/60">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${total}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] font-semibold text-slate-400">
          <span>0 ({t.low})</span>
          <span>50 ({t.regional})</span>
          <span>100 ({t.direct})</span>
        </div>
      </div>

      {/* Counts quick pills */}
      <div className="grid grid-cols-3 gap-2.5 pt-1">
        <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <div>
            <div className="text-xs font-bold text-emerald-950">{score.verifiedCount} {t.verified}</div>
            <div className="text-[10px] text-emerald-700">{t.official}</div>
          </div>
        </div>

        <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <div>
            <div className="text-xs font-bold text-amber-950">{score.modelledCount} {t.modelled}</div>
            <div className="text-[10px] text-amber-700">{t.geo}</div>
          </div>
        </div>

        <div className="p-3 bg-rose-50/70 border border-rose-200/60 rounded-xl flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <div>
            <div className="text-xs font-bold text-rose-950">{score.unverifiedCount} {t.requires}</div>
            <div className="text-[10px] text-rose-700">{t.onsite}</div>
          </div>
        </div>
      </div>

      {/* Summary explanation */}
      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium bg-slate-50 rounded-xl p-3.5 border border-slate-100">
        {t.summary}
      </p>

      {/* Breakdown toggle */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between py-2 text-xs font-bold text-indigo-700 hover:text-indigo-900 transition"
        >
          <span>{expanded ? t.hide : t.show}</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && b && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                <span>{t.categories[0]}</span>
                <span className="font-mono text-indigo-700">{b.cadastreAndGeometry.score} / {b.cadastreAndGeometry.max} pts</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">{t.rationale}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                <span>{t.categories[1]}</span>
                <span className="font-mono text-indigo-700">{b.terrainAndElevation.score} / {b.terrainAndElevation.max} pts</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">{t.rationale}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                <span>{t.categories[2]}</span>
                <span className="font-mono text-indigo-700">{b.geologyAndGroundwater.score} / {b.geologyAndGroundwater.max} pts</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">{t.rationale}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                <span>{t.categories[3]}</span>
                <span className="font-mono text-indigo-700">{b.infrastructureAndAccess.score} / {b.infrastructureAndAccess.max} pts</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">{t.rationale}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                <span>{t.categories[4]}</span>
                <span className="font-mono text-indigo-700">{b.environmentalAndFlood.score} / {b.environmentalAndFlood.max} pts</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">{t.rationale}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                <span>{t.categories[5]}</span>
                <span className="font-mono text-indigo-700">{b.planningAndMarket.score} / {b.planningAndMarket.max} pts</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">{t.rationale}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
