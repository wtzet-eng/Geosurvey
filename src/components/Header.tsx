import React from 'react';
import { Building2, FolderKanban, Code2, HardDrive } from 'lucide-react';

interface HeaderProps {
  onOpenSaved: () => void;
  onOpenEmbed: () => void;
  onOpenDrive?: () => void;
  savedCount: number;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSaved, onOpenEmbed, onOpenDrive, savedCount }) => {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">
              Geo Survey
            </p>
            <p className="text-[11px] text-slate-500 font-medium leading-tight">
              AI building-site valuation · EU
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onOpenDrive && (
            <button
              type="button"
              onClick={onOpenDrive}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100/80 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition"
              title="Manage reports in Google Drive"
            >
              <HardDrive className="h-4 w-4 text-blue-600" />
              <span className="hidden sm:inline">Google Drive</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenEmbed}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold transition"
            title="Get embed code for your website"
          >
            <Code2 className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Embed Widget</span>
            <span className="sm:hidden">&lt;/&gt;</span>
          </button>

          <button
            type="button"
            onClick={onOpenSaved}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <FolderKanban className="h-4 w-4 text-slate-500" />
            <span>Saved</span>
            {savedCount > 0 && (
              <span className="px-1.5 py-0.2 bg-primary text-white rounded-full text-[10px] font-bold">
                {savedCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

