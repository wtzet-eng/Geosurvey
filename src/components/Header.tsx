import React from 'react';
import { Building2, FolderKanban, Code2, HardDrive, GitCompareArrows, Sparkles } from 'lucide-react';
import { getActionText } from '../utils/actionI18n';

interface HeaderProps {
  onOpenSaved: () => void;
  onOpenEmbed: () => void;
  onOpenDrive?: () => void;
  onOpenCompare?: () => void;
  savedCount: number;
  language?: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSaved, onOpenEmbed, onOpenDrive, onOpenCompare, savedCount, language = 'en' }) => {
  const t = getActionText(language);
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
              LandSurf
            </p>
            <p className="text-[11px] text-slate-500 font-medium leading-tight">
              {t.brandSubtitle}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onOpenCompare && (
            <button
              type="button"
              onClick={onOpenCompare}
              disabled={savedCount < 2}
              className="flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white border border-indigo-600 disabled:border-slate-200 rounded-xl text-xs font-bold shadow-sm disabled:shadow-none transition"
              title={savedCount < 2 ? t.compareDisabledTitle : t.compareReadyTitle}
            >
              <GitCompareArrows className="h-4 w-4" />
              <span>{t.compare}</span>
              <Sparkles className="h-3 w-3" />
            </button>
          )}

          {onOpenDrive && (
            <button
              type="button"
              onClick={onOpenDrive}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100/80 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition"
              title={t.driveTitle}
            >
              <HardDrive className="h-4 w-4 text-blue-600" />
              <span className="hidden sm:inline">{t.drive}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenEmbed}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold transition"
            title={t.embedTitle}
          >
            <Code2 className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">{t.embed}</span>
            <span className="sm:hidden">&lt;/&gt;</span>
          </button>

          <button
            type="button"
            onClick={onOpenSaved}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <FolderKanban className="h-4 w-4 text-slate-500" />
            <span>{t.saved}</span>
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

