import React from 'react';
import { X, Building2, Calendar, MapPin, Trash2, ArrowRight } from 'lucide-react';
import { SiteReport } from '../types';

interface SavedReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: SiteReport[];
  onSelectReport: (report: SiteReport) => void;
  onDeleteReport: (id: string) => void;
}

export const SavedReportsModal: React.FC<SavedReportsModalProps> = ({
  isOpen,
  onClose,
  reports,
  onSelectReport,
  onDeleteReport,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white">
              <Building2 className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Saved Site Valuations</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/50 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Reports List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {reports.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Building2 className="mx-auto h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No saved reports yet</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Draw a site boundary and generate a valuation to save it here for quick access.
              </p>
            </div>
          ) : (
            reports.map((rep) => {
              const valEst = rep.report_data?.site_value_estimate;
              return (
                <div
                  key={rep.id}
                  className="group relative flex items-center justify-between gap-3 p-4 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/70 transition cursor-pointer"
                  onClick={() => {
                    onSelectReport(rep);
                    onClose();
                  }}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary px-2 py-0.5 bg-primary/10 rounded-md">
                        {rep.country}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(rep.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {rep.location_name}
                    </h3>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {rep.latitude.toFixed(4)}, {rep.longitude.toFixed(4)}
                      </span>
                      <span>•</span>
                      <span className="font-medium text-slate-700">{rep.area_size.toLocaleString()} m²</span>
                    </div>

                    {valEst && (
                      <p className="text-xs font-semibold text-slate-900 pt-0.5">
                        Est. Value: {valEst.currency} {valEst.min?.toLocaleString()} – {valEst.max?.toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteReport(rep.id);
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                      title="Delete report"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-900 transition" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
