import React from 'react';
import { MessageCircle } from 'lucide-react';
import { ReportViewEvidenceV2 } from './ReportViewEvidenceV2';
import { ReportViewSlovak } from './ReportViewSlovak';
import { ReportViewCzech } from './ReportViewCzech';
import { ReportViewNorwegian } from './ReportViewNorwegian';
import { ReportViewSwedish } from './ReportViewSwedish';
import { ReportViewDanish } from './ReportViewDanish';
import { AIInterpretationPanel } from './AIInterpretationPanel';
import { SiteReport } from '../types';
import { SupportLandSurf } from './SupportLandSurf';

interface ReportViewProps {
  report: SiteReport;
  onBack?: () => void;
}

/**
 * Report prose is rendered by the server presentation layer. This component
 * deliberately performs no DOM mutation or translation of scientific values.
 */
export const ReportView: React.FC<ReportViewProps> = ({ report, onBack }) => {
  const language = report.language?.toLowerCase() || 'en';
  const reportView = language.startsWith('sk')
    ? <ReportViewSlovak report={report} onBack={onBack} />
    : language.startsWith('cs')
      ? <ReportViewCzech report={report} onBack={onBack} />
      : language.startsWith('no') || language.startsWith('nb')
        ? <ReportViewNorwegian report={report} onBack={onBack} />
        : language.startsWith('sv')
          ? <ReportViewSwedish report={report} onBack={onBack} />
          : language.startsWith('da')
            ? <ReportViewDanish report={report} onBack={onBack} />
            : <ReportViewEvidenceV2 report={report} onBack={onBack} />;

  return (
    <div className="flex w-full flex-col">
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur">
        <div className="text-xs font-semibold text-slate-500">Detailed evidence report</div>
        <a href={window.location.origin + '/groundsurf?report_id=' + encodeURIComponent(report.id)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
          <MessageCircle className="h-3.5 w-3.5" /> Ask GroundSurf about this land
        </a>
      </div>
      <div className="order-1 w-full">{reportView}</div>
      <div className="order-2 w-full">
        <AIInterpretationPanel report={report} />
      </div>
      <div className="order-3 w-full">
        <SupportLandSurf language={report.language} />
      </div>
    </div>
  );
};