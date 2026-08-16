import React, { useState } from 'react';
import { EvidenceItem } from '../types';
import { EvidenceBadge } from './EvidenceBadge';
import { Database, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface EvidenceRegistryTableProps {
  items?: EvidenceItem[];
}

export const EvidenceRegistryTable: React.FC<EvidenceRegistryTableProps> = ({ items = [] }) => {
  const [filter, setFilter] = useState<'ALL' | 'VERIFIED' | 'MODELLED' | 'REQUIRES_VERIFICATION'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!items || items.length === 0) return null;

  const filteredItems = filter === 'ALL' ? items : items.filter(i => i.status === filter);

  return (
    <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Evidence Audit Registry (Claim → Source → Method → Limitation)</h3>
            <p className="text-xs text-slate-500">Every technical parameter mapped to its provenance and epistemic limitation</p>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
              filter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('VERIFIED')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
              filter === 'VERIFIED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            Verified ({items.filter(i => i.status === 'VERIFIED').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('MODELLED')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
              filter === 'MODELLED' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-800 hover:bg-amber-50'
            }`}
          >
            Modelled ({items.filter(i => i.status === 'MODELLED').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('REQUIRES_VERIFICATION')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
              filter === 'REQUIRES_VERIFICATION' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-800 hover:bg-rose-50'
            }`}
          >
            Unverified ({items.filter(i => i.status === 'REQUIRES_VERIFICATION').length})
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {filteredItems.map(item => {
          const isExpanded = expandedId === item.id;
          return (
            <div
              key={item.id}
              className="bg-slate-50/80 rounded-2xl border border-slate-200/70 p-4 transition hover:border-indigo-300"
            >
              <div
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{item.category}</span>
                    <EvidenceBadge level={item.status} size="sm" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">{item.claim}</h4>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  <div className="text-right text-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Source</span>
                    <span className="font-semibold text-slate-700">{item.sourceName.slice(0, 32)}...</span>
                  </div>
                  <button
                    type="button"
                    className="p-1 text-slate-400 hover:text-slate-700 transition"
                    aria-label="Toggle details"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 pt-3 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200/60">
                    <span className="font-bold text-slate-700 block">Authoritative Source & Date</span>
                    <p className="text-slate-600">{item.sourceName} ({item.datasetDate})</p>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold pt-1"
                      >
                        <span>Access Portal / Viewer</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200/60">
                    <span className="font-bold text-slate-700 block">Spatial Relationship</span>
                    <p className="text-slate-600">{item.spatialRelationship}</p>
                  </div>

                  <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200/60">
                    <span className="font-bold text-slate-700 block">Calculation / Ingestion Method</span>
                    <p className="text-slate-600">{item.calculationMethod}</p>
                    <span className="text-[11px] text-slate-400">Confidence Level: <strong className="text-slate-700">{item.confidence}</strong></span>
                  </div>

                  <div className="space-y-1 bg-rose-50/60 p-3 rounded-xl border border-rose-200/60">
                    <span className="font-bold text-rose-900 block">Known Limitation & Caveat</span>
                    <p className="text-rose-800 font-medium">{item.limitation}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
