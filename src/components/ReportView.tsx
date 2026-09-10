import React from 'react';
import { ReportViewEvidenceV2 } from './ReportViewEvidenceV2';
import { ReportViewSlovak } from './ReportViewSlovak';
import { ReportViewCzech } from './ReportViewCzech';
import { ReportViewNorwegian } from './ReportViewNorwegian';
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
  if (language.startsWith('sk')) return <ReportViewSlovak report={report} onBack={onBack} />;
  if (language.startsWith('cs')) return <ReportViewCzech report={report} onBack={onBack} />;
  if (language.startsWith('no') || language.startsWith('nb')) return <ReportViewNorwegian report={report} onBack={onBack} />;
  return <ReportViewEvidenceV2 report={report} onBack={onBack} />;
};
