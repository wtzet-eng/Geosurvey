import React from 'react';
import { EvidenceLevel } from '../types';

interface EvidenceBadgeProps {
  level?: EvidenceLevel | string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  language?: string;
}

const StatusDot: React.FC<{ className: string; size: 'sm' | 'md' | 'lg' }> = ({ className, size }) => (
  <span
    aria-hidden="true"
    className={`inline-block shrink-0 rounded-full ${className} ${size === 'sm' ? 'h-2 w-2' : size === 'lg' ? 'h-3 w-3' : 'h-2.5 w-2.5'}`}
  />
);

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
  const titles = language === 'pl'
    ? { verified: 'Bezpośrednio potwierdzone w urzędowym rejestrze', modelled: 'Model regionalny lub szacunek statystyczny', requires: 'Wymaga potwierdzenia terenowego lub urzędowego' }
    : language === 'de'
      ? { verified: 'Direkt durch ein amtliches Register bestätigt', modelled: 'Regionalmodell oder statistische Schätzung', requires: 'Standortbezogene oder amtliche Bestätigung erforderlich' }
      : { verified: 'Directly verified from an authoritative registry', modelled: 'Modelled from regional evidence or statistical estimates', requires: 'Requires on-site or authoritative verification' };
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';

  if (norm === 'VERIFIED') {
    return (
      <span className={`inline-flex items-center gap-1 font-semibold rounded-md border bg-emerald-50 text-emerald-800 border-emerald-300 ${padding}`} title={titles.verified}>
        <StatusDot size={size} className="bg-emerald-600" />
        {showLabel && <span>{labels.verified}</span>}
      </span>
    );
  }

  if (norm === 'REQUIRES_VERIFICATION') {
    return (
      <span className={`inline-flex items-center gap-1 font-semibold rounded-md border bg-rose-50 text-rose-800 border-rose-300 ${padding}`} title={titles.requires}>
        <StatusDot size={size} className="bg-rose-600" />
        {showLabel && <span>{labels.requires}</span>}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 font-semibold rounded-md border bg-amber-50 text-amber-900 border-amber-300 ${padding}`} title={titles.modelled}>
      <StatusDot size={size} className="bg-amber-600" />
      {showLabel && <span>{labels.modelled}</span>}
    </span>
  );
};
