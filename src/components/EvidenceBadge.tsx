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

const copies: Record<string, { labels: { verified: string; modelled: string; requires: string }; titles: { verified: string; modelled: string; requires: string } }> = {
  en: {
    labels: { verified: 'Verified Data', modelled: 'Modelled / Regional', requires: 'To be confirmed' },
    titles: { verified: 'Directly verified from an authoritative registry', modelled: 'Modelled from regional evidence or statistical estimates', requires: 'Requires on-site or authoritative verification' }
  },
  pl: {
    labels: { verified: 'Dane zweryfikowane', modelled: 'Modelowane / regionalne', requires: 'Wymaga weryfikacji' },
    titles: { verified: 'Bezpośrednio potwierdzone w urzędowym rejestrze', modelled: 'Model regionalny lub szacunek statystyczny', requires: 'Wymaga potwierdzenia terenowego lub urzędowego' }
  },
  de: {
    labels: { verified: 'Verifizierte Daten', modelled: 'Modelliert / regional', requires: 'Prüfung erforderlich' },
    titles: { verified: 'Direkt durch ein amtliches Register bestätigt', modelled: 'Regionalmodell oder statistische Schätzung', requires: 'Standortbezogene oder amtliche Bestätigung erforderlich' }
  },
  fr: {
    labels: { verified: 'Données vérifiées', modelled: 'Modélisé / régional', requires: 'Vérification requise' },
    titles: { verified: 'Vérifié directement dans une source officielle', modelled: 'Modélisé à partir de données régionales ou d’estimations statistiques', requires: 'Une vérification sur site ou officielle est requise' }
  },
  es: {
    labels: { verified: 'Datos verificados', modelled: 'Modelado / regional', requires: 'Requiere verificación' },
    titles: { verified: 'Verificado directamente en una fuente oficial', modelled: 'Modelado a partir de evidencia regional o estimaciones estadísticas', requires: 'Requiere verificación sobre el terreno o por una fuente oficial' }
  },
  fi: {
    labels: { verified: 'Vahvistettu tieto', modelled: 'Mallinnettu / alueellinen', requires: 'Vaatii tarkistuksen' },
    titles: { verified: 'Vahvistettu suoraan virallisesta rekisteristä', modelled: 'Mallinnettu alueellisesta aineistosta tai tilastollisesta arviosta', requires: 'Vaatii kohdekohtaisen tai viranomaisvahvistuksen' }
  }
};

export const EvidenceBadge: React.FC<EvidenceBadgeProps> = ({
  level = 'MODELLED',
  size = 'md',
  showLabel = true,
  language = 'en'
}) => {
  const norm = String(level).toUpperCase();
  const copy = copies[language] || copies.en;
  const { labels, titles } = copy;
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
      <span className={`inline-flex items-center gap-1 font-normal rounded-md border bg-slate-50 text-slate-600 border-slate-200 ${padding}`} title={titles.requires}>
        <StatusDot size={size} className="bg-slate-400" />
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
