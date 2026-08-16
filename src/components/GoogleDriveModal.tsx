import React from 'react';
import { HardDrive, X } from 'lucide-react';
import { SiteReport } from '../types';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  report?: SiteReport | null;
}

/**
 * Temporary lightweight Google Drive panel.
 *
 * ReportView still references this component. Keeping the component here avoids
 * breaking the production build while the Drive integration is being rebuilt
 * independently of the analysis API.
 */
export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Google Drive</h3>
              <p className="text-[11px] text-slate-500">Cloud report storage</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
            Google Drive sync is temporarily unavailable while the report and analysis infrastructure is being upgraded. Your report itself is unaffected.
          </div>
        </div>
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl text-xs">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
