import React from 'react';
import { ReportViewEvidenceV2 } from './ReportViewEvidenceV2';
import { ReportViewSlovak } from './ReportViewSlovak';
import { ReportViewCzech } from './ReportViewCzech';
import { ReportViewNorwegian } from './ReportViewNorwegian';
import { ReportViewSwedish } from './ReportViewSwedish';
import { ReportViewDanish } from './ReportViewDanish';
import { AIInterpretationPanel } from './AIInterpretationPanel';
import { SiteReport } from '../types';

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

  return <>
    {reportView}
    <AIInterpretationPanel report={report} />
    <section className="mx-auto mb-8 mt-4 w-full max-w-5xl px-4 sm:px-6" aria-label="Support SurveyLand">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Support SurveyLand</h2>
        <p className="mx-auto mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
          If this report was useful, you can support the continued development of SurveyLand.
          Support is voluntary and does not provide extra access or services.
        </p>
        <a
          href="https://ko-fi.com/surveyland"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Support on Ko-fi
        </a>
        <p className="mt-3 text-xs text-slate-500">Every supporter receives a personal thank-you.</p>
      </div>
    </section>
  </>;
};
