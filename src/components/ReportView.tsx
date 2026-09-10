import React from 'react';
import { ReportViewEvidenceV2 } from './ReportViewEvidenceV2';
import { ReportViewSlovak } from './ReportViewSlovak';
import { SiteReport } from '../types';

interface ReportViewProps {
  report: SiteReport;
  onBack?: () => void;
}

/**
 * Report prose is rendered by the server presentation layer. This component
 * deliberately performs no DOM mutation or translation of scientific values.
 */
export const ReportView: React.FC<ReportViewProps> = ({ report, onBack }) => (
  report.language?.toLowerCase().startsWith('sk')
    ? <ReportViewSlovak report={report} onBack={onBack} />
    : <ReportViewEvidenceV2 report={report} onBack={onBack} />
);
