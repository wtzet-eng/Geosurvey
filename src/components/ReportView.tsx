import React, { useState } from 'react';
import { SiteReport, EvidenceLevel } from '../types';
import { MapPreview } from './MapPreview';
import { EmbedModal } from './EmbedModal';
import { EvidenceBadge } from './EvidenceBadge';
import { EvidenceScoreCard } from './EvidenceScoreCard';
import { EvidenceRegistryTable } from './EvidenceRegistryTable';
import { VerificationChecklistCard } from './VerificationChecklistCard';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Beaker,
  Building2,
  Check,
  CheckCircle2,
  Code,
  Coins,
  Compass,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Info,
  Landmark,
  Layers,
  MapPin,
  Printer,
  Scale,
  ShieldAlert,
  TrendingUp,
  Zap
} from 'lucide-react';

interface ReportViewProps {
  report: SiteReport;
  onBack?: () => void;
}

const SECTION_ICONS = [
  { key: 'soil_and_ground', title: 'Geology, Soil & Ground Conditions', icon: Layers },
  { key: 'geohazard_risk', title: 'Geohazard, Slope & Ground Stability', icon: ShieldAlert },
  { key: 'flooding_risk', title: 'Flood & Hydrological Risk', icon: TrendingUp },
  { key: 'zoning_and_land_use', title: 'Planning, Zoning & Permitted Uses', icon: Landmark },
  { key: 'building_regulations', title: 'Building Parameters & Development Rules', icon: Building2 },
  { key: 'environmental_factors', title: 'Environmental Constraints', icon: Globe },
  { key: 'infrastructure_and_access', title: 'Access, Roads & Utilities', icon: Zap },
  { key: 'market_and_comparables', title: 'Market & Comparable Evidence', icon: TrendingUp },
  { key: 'development_cost_outlook', title: 'Development Cost & Pre-Construction Outlook', icon: Coins }
];

const evidenceLabel = (level?: EvidenceLevel) => {
  if (level === 'VERIFIED') return 'Verified evidence';
  if (level === 'MODELLED') return 'Modelled / indicative';
  return 'Requires verification';
};

export const ReportView: React.FC<ReportViewProps> = ({ report, onBack }) => {
  const [copied, setCopied] = useState(false);
  const [isEmbedOpen, setIsEmbedOpen] = useState(false);

  const data = report.report_data;
  const titles = data.titles || {};
  const valueEst = data.site_value_estimate || { min: 0, max: 0, currency: 'EUR' };
  const currency = valueEst.currency || 'EUR';
  const tech = data.technical_parameters || {};
  const metrics = data.valuation_metrics || {};
  const soilMetrics = data.soil_metrics;
  const risks = data.risk_matrix || [];
  const utilities = data.utilities_checklist || [];
  const amenities = data.amenity_index || [];
  const sources = data.data_sources || [];
  const stratigraphy = data.stratigraphy || [];

  const pricePerSqmMin = metrics.price_per_sqm_min ?? Math.round(valueEst.min / Math.max(1, report.area_size));
  const pricePerSqmMax = metrics.price_per_sqm_max ?? Math.round(valueEst.max / Math.max(1, report.area_size));
  const evidence = data.evidence_score;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handlePrint = () => window.print();

  const formatCurrency = (value: number, curr: string) => `${value.toLocaleString()} ${curr}`;

  const riskCount = risks.filter(r => r.level === 'High').length;
  const verificationCount = data.verification_checklist?.length || 0;
  const verifiedCount = evidence?.verifiedCount || 0;
  const areaHa = report.area_size / 10000;

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 pb-16 print:bg-white">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 print:hidden">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button type="button" onClick={onBack} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-xl shrink-0">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back to Map</span>
              </button>
            )}
            <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0">
              <Landmark className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-sm tracking-tight block truncate">European Land Evaluation Engine</span>
              <span className="text-[10px] text-slate-500 block truncate">Land investment & spatial due-diligence dossier</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setIsEmbedOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl">
              <Code className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Embed</span>
            </button>
            <button type="button" onClick={handleCopyLink} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
            </button>
            <button type="button" onClick={handlePrint} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-xl">
              <Printer className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Export PDF</span>
            </button>
          </div>
        </div>
      </header>

      <EmbedModal
        isOpen={isEmbedOpen}
        onClose={() => setIsEmbedOpen(false)}
        reportId={report.id}
        defaultCountry={report.country_code}
        defaultLanguage={report.language}
        currentLocation={{ lat: report.latitude, lng: report.longitude, zoom: 16 }}
      />

      <main className="mx-auto max-w-5xl px-4 pt-6 space-y-6">
        <section className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded-lg border border-indigo-100 uppercase tracking-wide">Land Due-Diligence Dossier</span>
                <span className="text-xs text-slate-500">#{report.id}</span>
              </div>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200">{report.country} · {report.country_code}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950">{report.location_name}</h1>
            <p className="mt-2 text-sm text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
              <span>{report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}</span>
              <span>•</span>
              <span>{report.area_size.toLocaleString()} m² · {areaHa.toFixed(2)} ha</span>
              {tech.cadastral_parcel_id && <><span>•</span><span className="font-semibold text-slate-700">Parcel {tech.cadastral_parcel_id}</span></>}
            </p>
          </div>
        </section>

        <section className="bg-amber-50 border border-amber-200 rounded-3xl p-4 sm:p-5 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm leading-relaxed text-amber-950">
            <strong className="block mb-1">Preliminary due diligence — not a legal, planning, engineering or certified valuation opinion.</strong>
            This report combines spatial datasets and analytical models to help a prospective buyer, seller, developer or land company decide what deserves further investigation. Official cadastral, planning, environmental, utility, geotechnical and valuation documents remain authoritative.
          </div>
        </section>

        <section className="bg-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-indigo-300">Investment snapshot</div>
              <h2 className="text-2xl sm:text-3xl font-extrabold mt-1">What should a land buyer notice first?</h2>
              <p className="text-sm text-slate-300 mt-2 max-w-2xl">A commercial first-read of the evidence, development potential, valuation signal and remaining diligence work.</p>
            </div>
            {evidence && <div className="text-left lg:text-right"><div className="text-4xl font-black">{evidence.totalScore}<span className="text-lg text-slate-400">/100</span></div><div className="text-xs text-slate-400">Evidence quality score</div></div>}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <span className="text-[11px] text-slate-400 block">Indicative land value</span>
              <strong className="text-lg block mt-1">{formatCurrency(valueEst.min, currency)} – {formatCurrency(valueEst.max, currency)}</strong>
              <span className="text-[10px] text-slate-500">Non-certified benchmark</span>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <span className="text-[11px] text-slate-400 block">Unit value</span>
              <strong className="text-lg block mt-1">{pricePerSqmMin.toLocaleString()} – {pricePerSqmMax.toLocaleString()}</strong>
              <span className="text-[10px] text-slate-500">{currency}/m²</span>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <span className="text-[11px] text-slate-400 block">High-risk findings</span>
              <strong className="text-lg block mt-1">{riskCount}</strong>
              <span className="text-[10px] text-slate-500">from current risk matrix</span>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <span className="text-[11px] text-slate-400 block">Diligence actions</span>
              <strong className="text-lg block mt-1">{verificationCount}</strong>
              <span className="text-[10px] text-slate-500">items requiring follow-up</span>
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs lg:col-span-2">
            <div className="flex items-center gap-2 mb-3"><FileText className="h-4 w-4 text-indigo-600" /><h2 className="font-bold">Investment conclusion</h2></div>
            <p className="text-sm leading-relaxed text-slate-700">{data.summary || 'The available evidence provides a preliminary picture of this site. The strongest investment decision will depend on confirming planning rights, legal access, utilities, environmental constraints and the valuation basis.'}</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4"><div className="flex items-center gap-2 font-bold text-emerald-900 text-sm"><CheckCircle2 className="h-4 w-4" />Potential strengths</div><ul className="mt-2 space-y-1.5 text-xs text-emerald-950">{(data.opportunities || ['Review the site-specific development and market evidence.']).slice(0,4).map((x,i)=><li key={i}>• {x}</li>)}</ul></div>
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4"><div className="flex items-center gap-2 font-bold text-rose-900 text-sm"><AlertTriangle className="h-4 w-4" />Watch-outs</div><ul className="mt-2 space-y-1.5 text-xs text-rose-950">{(data.key_risks || ['Confirm planning status, legal access and site constraints before acquisition.']).slice(0,4).map((x,i)=><li key={i}>• {x}</li>)}</ul></div>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3"><BadgeCheck className="h-4 w-4 text-indigo-600" /><h2 className="font-bold">Evidence at a glance</h2></div>
            {evidence ? <><div className="text-3xl font-black text-slate-950">{evidence.totalScore}<span className="text-sm text-slate-400">/100</span></div><p className="text-xs text-slate-500 mt-1">{evidence.ratingClass}</p><div className="grid grid-cols-3 gap-2 mt-4 text-center"><div className="bg-emerald-50 rounded-xl p-2"><b className="block text-emerald-800">{evidence.verifiedCount}</b><span className="text-[10px] text-emerald-700">verified</span></div><div className="bg-indigo-50 rounded-xl p-2"><b className="block text-indigo-800">{evidence.modelledCount}</b><span className="text-[10px] text-indigo-700">modelled</span></div><div className="bg-amber-50 rounded-xl p-2"><b className="block text-amber-800">{evidence.unverifiedCount}</b><span className="text-[10px] text-amber-700">to verify</span></div></div></> : <p className="text-sm text-slate-600">No consolidated evidence score is available for this report.</p>}
          </div>
        </section>

        <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4"><div className="flex items-center gap-2 font-bold"><Compass className="h-4 w-4 text-indigo-600" />Site location & parcel geometry</div><span className="text-xs text-slate-500">{report.boundary.type}</span></div>
          <div className="h-64 sm:h-80 rounded-2xl overflow-hidden border border-slate-200"><MapPreview lat={report.latitude} lng={report.longitude} areaSize={report.area_size} boundary={report.boundary} /></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
            <div className="bg-slate-50 rounded-xl p-3"><span className="text-slate-500 block">Area</span><b>{report.area_size.toLocaleString()} m²</b></div>
            <div className="bg-slate-50 rounded-xl p-3"><span className="text-slate-500 block">Elevation</span><b>{tech.elevation_amsl != null ? `${tech.elevation_amsl} m` : 'Not available'}</b></div>
            <div className="bg-slate-50 rounded-xl p-3"><span className="text-slate-500 block">Slope</span><b>{tech.slope_degrees != null ? `${tech.slope_degrees}°` : 'Not available'}</b></div>
            <div className="bg-slate-50 rounded-xl p-3"><span className="text-slate-500 block">Cadastre</span><b>{tech.cadastral_parcel_id || 'Requires verification'}</b></div>
          </div>
        </section>

        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div><div className="flex items-center gap-2"><Coins className="h-4 w-4 text-indigo-600" /><span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Valuation signal</span></div><h2 className="text-xl font-extrabold mt-1">{formatCurrency(valueEst.min, currency)} – {formatCurrency(valueEst.max, currency)}</h2></div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold"><AlertTriangle className="h-3.5 w-3.5" />Non-certified statistical benchmark</span>
          </div>
          <div className="grid sm:grid-cols-4 gap-3 mt-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl"><span className="text-slate-500 block">Indicative €/m² or local unit</span><b>{pricePerSqmMin.toLocaleString()} – {pricePerSqmMax.toLocaleString()} {currency}/m²</b></div>
            <div className="bg-slate-50 p-3 rounded-xl"><span className="text-slate-500 block">Valuation confidence</span><b>{data.confidence_level || 'Not stated'}</b></div>
            <div className="bg-slate-50 p-3 rounded-xl"><span className="text-slate-500 block">Comparable evidence</span><b>{metrics.comparable_evidence_count ?? 'Not stated'}</b></div>
            <div className="bg-slate-50 p-3 rounded-xl"><span className="text-slate-500 block">Feasibility</span><b>{metrics.feasibility_rating || 'Not stated'}</b></div>
          </div>
          <p className="text-xs text-slate-500 mt-4">Use this as a screening signal, not as a certified appraisal. A professional valuation should reflect the exact planning status, legal rights, comparable transactions, site constraints and intended use.</p>
        </section>

        {soilMetrics && <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4"><div className="flex items-center gap-2"><Beaker className="h-4 w-4 text-amber-600" /><h2 className="font-bold">Soil & ground conditions</h2></div><EvidenceBadge level="VERIFIED" size="sm" /></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl"><span className="text-slate-500 block">Texture</span><b>{soilMetrics.usda_texture}</b></div>
            <div className="bg-slate-50 p-3 rounded-xl"><span className="text-slate-500 block">Bulk density</span><b>{soilMetrics.mean_bulk_density} g/cm³</b></div>
            <div className="bg-slate-50 p-3 rounded-xl"><span className="text-slate-500 block">pH</span><b>{soilMetrics.mean_ph}</b></div>
            <div className="bg-slate-50 p-3 rounded-xl"><span className="text-slate-500 block">Bearing capacity</span><b>{soilMetrics.bearing_capacity_kpa}</b></div>
          </div>
          {stratigraphy.length > 0 && <div className="mt-4 space-y-2">{stratigraphy.map((layer,i)=><div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex flex-wrap gap-3 justify-between"><span className="font-mono font-bold">{layer.depth_range}</span><span className="font-semibold">{layer.soil_type}</span><span className="text-slate-600">{layer.description}</span><span className="font-bold">{layer.bearing_capacity}</span></div>)}</div>}
        </section>}

        {amenities.length > 0 && <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs"><div className="flex items-center gap-2 mb-4"><MapPin className="h-4 w-4 text-emerald-600" /><h2 className="font-bold">Location advantages & nearby amenities</h2></div><div className="grid sm:grid-cols-2 gap-2">{amenities.map((a,i)=><div key={i} className="p-3 bg-slate-50 rounded-xl flex justify-between text-xs"><span><b>{a.name}</b><span className="text-slate-500 block">{a.type}</span></span><b>{a.distance_m} m</b></div>)}</div></section>}

        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-indigo-600" /><h2 className="font-bold">Development potential</h2></div><EvidenceBadge level="REQUIRES_VERIFICATION" size="sm" /></div>
          <div className="grid sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="p-3 bg-slate-50 rounded-xl flex justify-between"><span className="text-slate-500">Planning instrument</span><b>{tech.zoning_name || 'Not confirmed'}</b></div>
            <div className="p-3 bg-slate-50 rounded-xl flex justify-between"><span className="text-slate-500">FAR / GFZ</span><b>{tech.max_far || 'Not confirmed'}</b></div>
            <div className="p-3 bg-slate-50 rounded-xl flex justify-between"><span className="text-slate-500">Maximum coverage</span><b>{tech.max_building_coverage_pct || 'Not confirmed'}</b></div>
            <div className="p-3 bg-slate-50 rounded-xl flex justify-between"><span className="text-slate-500">Active area minimum</span><b>{tech.min_biologically_active_pct || 'Not confirmed'}</b></div>
            <div className="p-3 bg-slate-50 rounded-xl flex justify-between"><span className="text-slate-500">Maximum height</span><b>{tech.max_height_m || 'Not confirmed'}</b></div>
            <div className="p-3 bg-slate-50 rounded-xl flex justify-between"><span className="text-slate-500">Setbacks</span><b>{tech.setback_m || 'Not confirmed'}</b></div>
            <div className="p-3 bg-slate-50 rounded-xl flex justify-between"><span className="text-slate-500">Utilities</span><b>{tech.utility_status || 'Requires confirmation'}</b></div>
            <div className="p-3 bg-slate-50 rounded-xl flex justify-between"><span className="text-slate-500">Groundwater</span><b>{tech.groundwater_depth_m || 'Not confirmed'}</b></div>
          </div>
        </section>

        {risks.length > 0 && <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs"><div className="flex items-center gap-2 mb-4"><ShieldAlert className="h-4 w-4 text-rose-600" /><h2 className="font-bold">Risk dashboard</h2></div><div className="grid gap-2">{risks.map((r,i)=><div key={i} className="p-3 rounded-xl border border-slate-100 bg-slate-50 grid sm:grid-cols-[1fr_auto_2fr] gap-2 items-start text-xs"><b>{r.category}</b><span className={`px-2 py-0.5 rounded-full font-bold w-fit ${r.level === 'High' ? 'bg-rose-100 text-rose-800' : r.level === 'Moderate' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{r.level}</span><span className="text-slate-600">{r.detail}</span></div>)}</div></section>}

        {utilities.length > 0 && <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs"><div className="flex items-center gap-2 mb-4"><Zap className="h-4 w-4 text-blue-600" /><h2 className="font-bold">Utilities & infrastructure readiness</h2></div><div className="grid sm:grid-cols-2 gap-3">{utilities.map((u,i)=><div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><div className="flex justify-between gap-2"><b className="text-sm">{u.utility}</b><EvidenceBadge level={u.evidence_level || 'REQUIRES_VERIFICATION'} size="sm" /></div><p className="text-xs text-slate-700 mt-2">{u.status}</p>{u.limitation && <p className="text-[11px] text-slate-500 mt-2">{u.limitation}</p>}</div>)}</div></section>}

        {data.evidence_registry && data.evidence_registry.length > 0 && <EvidenceRegistryTable items={data.evidence_registry} />}
        {data.verification_checklist && data.verification_checklist.length > 0 && <VerificationChecklistCard items={data.verification_checklist} />}
        {evidence && <EvidenceScoreCard score={evidence} />}

        <section className="space-y-4">
          {SECTION_ICONS.map(({key,title,icon:Icon})=>{
            const section = (data as any)[key] || {};
            if (!section.summary && !section.detail) return null;
            return <div key={key} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-4"><div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center"><Icon className="h-4 w-4" /></div><h2 className="font-bold">{titles[key] || title}</h2></div>
              {section.summary && <p className="border-l-4 border-indigo-600 bg-slate-50 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800">{section.summary}</p>}
              {section.detail && <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">{String(section.detail).split(/\n{2,}/).filter(Boolean).map((p:string,i:number)=><p key={i}>{p}</p>)}</div>}
              {section.evidence_level && <div className="mt-4"><EvidenceBadge level={section.evidence_level} size="sm" /></div>}
            </div>;
          })}
        </section>

        {sources.length > 0 && <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs"><div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4"><Globe className="h-4 w-4 text-indigo-600" /><h2 className="font-bold">Sources & evidence portals</h2></div><div className="grid sm:grid-cols-2 gap-2">{sources.map((s,i)=><div key={i} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between gap-3 text-xs"><span><b className="block">{s.name}</b>{s.authority && <span className="text-slate-500">{s.authority}</span>}</span>{s.url && <a href={s.url} target="_blank" rel="noreferrer" className="text-indigo-600 font-semibold shrink-0">Open <ExternalLink className="h-3 w-3 inline" /></a>}</div>)}</div></section>}

        {data.legal_disclaimers && data.legal_disclaimers.length > 0 && <section className="bg-amber-50 rounded-3xl p-6 sm:p-8 border-2 border-amber-300"><div className="flex items-center gap-2 border-b border-amber-200 pb-3 mb-4 text-amber-950"><Scale className="h-5 w-5 text-amber-700" /><h2 className="font-bold">Legal notices & limitations</h2></div><ul className="space-y-2">{data.legal_disclaimers.map((d,i)=><li key={i} className="bg-white/70 rounded-xl border border-amber-200 p-3 text-xs sm:text-sm text-amber-950">{d}</li>)}</ul></section>}

        <section className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white">
          <div className="flex items-center gap-2"><Info className="h-4 w-4 text-indigo-300" /><h2 className="font-bold">Buyer / seller next steps</h2></div>
          <div className="grid sm:grid-cols-3 gap-3 mt-4 text-xs sm:text-sm">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4"><b>1. Confirm rights</b><p className="text-slate-300 mt-1">Obtain authoritative planning, cadastral and access documents.</p></div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4"><b>2. Confirm constraints</b><p className="text-slate-300 mt-1">Verify utilities, flood, environmental and geotechnical conditions.</p></div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4"><b>3. Price the opportunity</b><p className="text-slate-300 mt-1">Compare the benchmark with verified comparables and the intended development scenario.</p></div>
          </div>
        </section>

        <p className="text-center text-xs text-slate-400 pt-2">European Land Evaluation Engine · Preliminary spatial intelligence for land acquisition and disposition decisions · Generated {new Date(report.created_at).toLocaleString()}</p>
      </main>
    </div>
  );
};

export default ReportView;
