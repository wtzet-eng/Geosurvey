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

const reportShellCopy = (language: string) => {
  const code = language.toLowerCase().split('-')[0] === 'nb' ? 'no' : language.toLowerCase().split('-')[0];
  const copy: Record<string, { report: string; ask: string }> = {
    en: { report: 'Detailed evidence report', ask: 'Ask GroundSurf about this land' },
    de: { report: 'Detaillierter Evidenzbericht', ask: 'GroundSurf zu diesem Grundstück fragen' },
    pl: { report: 'Szczegółowy raport dowodowy', ask: 'Zapytaj GroundSurf o ten teren' },
    nl: { report: 'Gedetailleerd bewijsrapport', ask: 'Vraag GroundSurf over dit terrein' },
    fr: { report: 'Rapport détaillé des éléments de preuve', ask: 'Interroger GroundSurf sur ce terrain' },
    es: { report: 'Informe detallado de evidencias', ask: 'Preguntar a GroundSurf sobre este terreno' },
    fi: { report: 'Yksityiskohtainen evidenssiraportti', ask: 'Kysy GroundSurfilta tästä maa-alueesta' },
    hr: { report: 'Detaljno izvješće o dokazima', ask: 'Pitajte GroundSurf o ovom zemljištu' },
    cs: { report: 'Podrobný report důkazů', ask: 'Zeptat se GroundSurfu na tento pozemek' },
    sk: { report: 'Podrobný report dôkazov', ask: 'Opýtať sa GroundSurf na tento pozemok' },
    da: { report: 'Detaljeret evidensrapport', ask: 'Zeptejte se GroundSurf na tento pozemek' },
    sv: { report: 'Detaljerad evidensrapport', ask: 'Fråga GroundSurf om denna mark' },
    no: { report: 'Detaljert evidensrapport', ask: 'Spør GroundSurf om denne tomten' },
    pt: { report: 'Relatório detalhado de evidências', ask: 'Pergunte ao GroundSurf sobre este terreno' },
    et: { report: 'Üksikasjalik tõendite aruanne', ask: 'Küsi GroundSurfilt selle maa kohta' },
    lv: { report: 'Detalizēts pierādījumu pārskats', ask: 'Jautājiet GroundSurf par šo zemi' },
    lt: { report: 'Išsamių įrodymų ataskaita', ask: 'Klauskite GroundSurf apie šį sklypą' }
  };
  return copy[code] || copy.en;
};

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
  const shellCopy = reportShellCopy(language);
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
        <div className="text-xs font-semibold text-slate-500">{shellCopy.report}</div>
        <a href={window.location.origin + '/?report_id=' + encodeURIComponent(report.id)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
          <MessageCircle className="h-3.5 w-3.5" /> {shellCopy.ask}
        </a>
      </div>
      <div className="order-1 w-full">{reportView}</div>
      <div className="order-2 w-full">
        <AIInterpretationPanel report={report} supportDestination="groundsurf" />
      </div>
      <div className="order-3 w-full">
        <SupportLandSurf language={report.language} />
      </div>
    </div>
  );
};