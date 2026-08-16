import React, { useState } from 'react';
import { EvidenceQualityScore } from '../types';
import { ShieldCheck, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

interface EvidenceScoreCardProps {
  score?: EvidenceQualityScore;
}

export const EvidenceScoreCard: React.FC<EvidenceScoreCardProps> = ({ score }) => {
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

  return (
    <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Evidence Quality & Reliability Score</h3>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
                {score.ratingClass}
              </span>
            </div>
            <p className="text-xs text-slate-500">Transparent data certainty model across 6 key evaluation disciplines</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-3xl font-black text-slate-950 font-mono tracking-tight">
              {total}<span className="text-lg font-bold text-slate-400">/100</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Calculated Quality</span>
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
          <span>0 (Unverified Hypothesis)</span>
          <span>50 (Regional Model)</span>
          <span>100 (Direct On-Site Cadastre & Borehole Survey)</span>
        </div>
      </div>

      {/* Counts quick pills */}
      <div className="grid grid-cols-3 gap-2.5 pt-1">
        <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <div>
            <div className="text-xs font-bold text-emerald-950">{score.verifiedCount} Verified Data Points</div>
            <div className="text-[10px] text-emerald-700">Official cadastral / DEM</div>
          </div>
        </div>

        <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <div>
            <div className="text-xs font-bold text-amber-950">{score.modelledCount} Regional Models</div>
            <div className="text-[10px] text-amber-700">Geological / Hydrological</div>
          </div>
        </div>

        <div className="p-3 bg-rose-50/70 border border-rose-200/60 rounded-xl flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <div>
            <div className="text-xs font-bold text-rose-950">{score.unverifiedCount} Require Verification</div>
            <div className="text-[10px] text-rose-700">On-site geotechnical / MPZP</div>
          </div>
        </div>
      </div>

      {/* Summary explanation */}
      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium bg-slate-50 rounded-xl p-3.5 border border-slate-100">
        {score.summaryExplanation}
      </p>

      {/* Breakdown toggle */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between py-2 text-xs font-bold text-indigo-700 hover:text-indigo-900 transition"
        >
          <span>{expanded ? 'Hide Score Category Details' : 'View Scoring Breakdown by Discipline'}</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && b && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                <span>Cadastre & Legal Boundary</span>
                <span className="font-mono text-indigo-700">{b.cadastreAndGeometry.score} / {b.cadastreAndGeometry.max} pts</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">{b.cadastreAndGeometry.rationale}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                <span>Terrain & Elevation DEM</span>
                <span className="font-mono text-indigo-700">{b.terrainAndElevation.score} / {b.terrainAndElevation.max} pts</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">{b.terrainAndElevation.rationale}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                <span>Geology & Groundwater</span>
                <span className="font-mono text-indigo-700">{b.geologyAndGroundwater.score} / {b.geologyAndGroundwater.max} pts</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">{b.geologyAndGroundwater.rationale}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                <span>Infrastructure & Access</span>
                <span className="font-mono text-indigo-700">{b.infrastructureAndAccess.score} / {b.infrastructureAndAccess.max} pts</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">{b.infrastructureAndAccess.rationale}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                <span>Hydrology & Flood Risk</span>
                <span className="font-mono text-indigo-700">{b.environmentalAndFlood.score} / {b.environmentalAndFlood.max} pts</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">{b.environmentalAndFlood.rationale}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                <span>Planning & Valuation</span>
                <span className="font-mono text-indigo-700">{b.planningAndMarket.score} / {b.planningAndMarket.max} pts</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">{b.planningAndMarket.rationale}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
