import React from 'react';
import { EvidenceLevel } from '../types';
import { CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';

interface EvidenceBadgeProps {
  level?: EvidenceLevel | string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  language?: string;
}

export const EvidenceBadge: React.FC<EvidenceBadgeProps> = ({
  level = 'MODELLED',
  size = 'md',
  showLabel = true,
  language = 'en'
}) => {
  const norm = String(level).toUpperCase();
  const labels = language === 'pl'
    ? { verified: 'Dane zweryfikowane', modelled: 'Modelowane / regionalne', requires: 'Wymaga weryfikacji' }
    : language === 'de'
      ? { verified: 'Verifizierte Daten', modelled: 'Modelliert / regional', requires: 'Prüfung erforderlich' }
      : { verified: 'Verified Data', modelled: 'Modelled / Regional', requires: 'Requires Verification' };
  const titles = language === 'pl' ? { verified: 'Bezpośrednio potwierdzone w urzędowym rejestrze', modelled: 'Model regionalny lub szacunek statystyczny', requires: 'Wymaga potwierdzenia terenowego lub urzędowego' } : language === 'de' ? { verified: 'Direkt durch ein amtliches Register bestätigt', modelled: 'Regionalmodell oder statistische Schätzung', requires: 'Standortbezogene oder amtliche Bestätigung erforderlich' } : { verified: 'Directly verified from an authoritative registry', modelled: 'Modelled from regional evidence or statistical estimates', requires: 'Requires on-site or authoritative verification' };

  if (norm === 'VERIFIED') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded-md border bg-emerald-50 text-emerald-800 border-emerald-300 ${
          size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
        }`}
        title={titles.verified}
      >
        <CheckCircle className={size === 'sm' ? 'h-2.5 w-2.5 text-emerald-600' : 'h-3.5 w-3.5 text-emerald-600'} />
        {showLabel && <span>{labels.verified}</span>}
      </span>
    );
  }

  if (norm === 'REQUIRES_VERIFICATION') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded-md border bg-rose-50 text-rose-800 border-rose-300 ${
          size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
        }`}
        title={titles.requires}
      >
        <AlertTriangle className={size === 'sm' ? 'h-2.5 w-2.5 text-rose-600' : 'h-3.5 w-3.5 text-rose-600'} />
        {showLabel && <span>{labels.requires}</span>}
      </span>
    );
  }

  // Default: MODELLED
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-md border bg-amber-50 text-amber-900 border-amber-300 ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
      }`}
      title={titles.modelled}
    >
      <AlertCircle className={size === 'sm' ? 'h-2.5 w-2.5 text-amber-600' : 'h-3.5 w-3.5 text-amber-600'} />
      {showLabel && <span>{labels.modelled}</span>}
    </span>
  );
};
