import React from 'react';
import { EvidenceLevel } from '../types';
import { CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';

interface EvidenceBadgeProps {
  level?: EvidenceLevel | string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const EvidenceBadge: React.FC<EvidenceBadgeProps> = ({
  level = 'MODELLED',
  size = 'md',
  showLabel = true
}) => {
  const norm = String(level).toUpperCase();

  if (norm === 'VERIFIED') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded-md border bg-emerald-50 text-emerald-800 border-emerald-300 ${
          size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
        }`}
        title="Directly verified from official cadastre, high-res DEM, or authoritative government registry"
      >
        <CheckCircle className={size === 'sm' ? 'h-2.5 w-2.5 text-emerald-600' : 'h-3.5 w-3.5 text-emerald-600'} />
        {showLabel && <span>Verified Data</span>}
      </span>
    );
  }

  if (norm === 'REQUIRES_VERIFICATION') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded-md border bg-rose-50 text-rose-800 border-rose-300 ${
          size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
        }`}
        title="Must be verified on-site or through official municipal/expert certificates"
      >
        <AlertTriangle className={size === 'sm' ? 'h-2.5 w-2.5 text-rose-600' : 'h-3.5 w-3.5 text-rose-600'} />
        {showLabel && <span>Requires Verification</span>}
      </span>
    );
  }

  // Default: MODELLED
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-md border bg-amber-50 text-amber-900 border-amber-300 ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
      }`}
      title="Modelled from regional surveys, proximity vectors, or statistical estimates"
    >
      <AlertCircle className={size === 'sm' ? 'h-2.5 w-2.5 text-amber-600' : 'h-3.5 w-3.5 text-amber-600'} />
      {showLabel && <span>Modelled / Regional</span>}
    </span>
  );
};
