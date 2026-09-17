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
    <section className="mt-6 w-full bg-[#496931] px-4 py-8 sm:px-6" aria-label="Support LandSurf">
      <div className="mx-auto max-w-5xl text-center text-white">
        <h2 className="text-base font-semibold text-white">Support LandSurf</h2>
        <p className="mx-auto mt-1 max-w-xl text-sm leading-relaxed text-white/85">
          If this report was useful, you can support the continued development of LandSurf.
          Support is voluntary and does not provide extra access or services.
        </p>
        <a
          href="https://ko-fi.com/surveyland"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#496931] transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#496931]"
        >
          Thank you for support
        </a>
        <p className="mt-3 text-xs text-white/75">Every supporter receives a personal thank-you.</p>
      </div>
    </section>
  </>;
};
