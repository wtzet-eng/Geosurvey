import React from 'react';
import { VerificationRequirement } from '../types';
import { ClipboardCheck, UserCheck } from 'lucide-react';

interface VerificationChecklistCardProps {
  items?: VerificationRequirement[];
}

export const VerificationChecklistCard: React.FC<VerificationChecklistCardProps> = ({ items = [] }) => {
  if (!items || items.length === 0) return null;

  return (
    <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="h-10 w-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">Mandatory Pre-Construction Verification Checklist</h3>
          <p className="text-xs text-slate-500">Statutory and geotechnical steps required before finalizing building designs</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((req, idx) => {
          const isHigh = req.priority === 'High';
          return (
            <div
              key={idx}
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                isHigh ? 'bg-amber-50/40 border-amber-200/80' : 'bg-slate-50 border-slate-200/70'
              }`}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                      isHigh
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-blue-100 text-blue-800 border-blue-200'
                    }`}
                  >
                    {req.priority} Priority
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">{req.topic}</h4>
                </div>

                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                  {req.reason}
                </p>
              </div>

              <div className="sm:max-w-xs shrink-0 bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-900">
                  <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Authority / Expert</span>
                </div>
                <p className="text-xs text-slate-600 font-medium">{req.recommendedAuthorityOrExpert}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
