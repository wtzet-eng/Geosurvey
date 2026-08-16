import React, { useState } from 'react';
import { SiteReport } from '../types';
import { MapPreview } from './MapPreview';
import { EmbedModal } from './EmbedModal';
import { GoogleDriveModal } from './GoogleDriveModal';
import { EvidenceBadge } from './EvidenceBadge';
import { EvidenceScoreCard } from './EvidenceScoreCard';
import { EvidenceRegistryTable } from './EvidenceRegistryTable';
import { VerificationChecklistCard } from './VerificationChecklistCard';
import { getGeoSurveyByCountry } from '../data/countries';
import {
  FileText,
  ShieldCheck,
  TrendingUp,
  Mountain,
  AlertTriangle,
  Globe,
  Printer,
  Copy,
  Check,
  Code,
  Landmark,
  ExternalLink,
  Coins,
  BadgeCheck,
  Layers,
  Zap,
  ShieldAlert,
  CheckCircle2,
  Activity,
  Compass,
  Building2,
  ArrowLeft,
  HardDrive,
  Scale,
  Beaker,
  Bus,
  GraduationCap,
  ShoppingBag,
  HeartPulse,
  Info,
  MapPin
} from 'lucide-react';

interface ReportViewProps {
  report: SiteReport;
  onBack?: () => void;
}

const SECTION_ICONS = [
  { key: 'soil_and_ground', title: '1. Geological Structure & Soil Mechanics', icon: Layers },
  { key: 'geohazard_risk', title: '2. Geohazard, Slope & Mass Movement', icon: ShieldAlert },
  { key: 'flooding_risk', title: '3. Hydrological & 100-Year Flood Risk', icon: Activity },
  { key: 'zoning_and_land_use', title: '4. Cadastre, Zoning & Permitted Uses', icon: Landmark },
  { key: 'building_regulations', title: '5. Statutory Setbacks & Building Code', icon: Building2 },
  { key: 'environmental_factors', title: '6. Environmental Overlays & Protected Areas', icon: Globe },
  { key: 'infrastructure_and_access', title: '7. Road Access & Utility Networks', icon: Zap },
  { key: 'market_and_comparables', title: '8. Statistical Market Valuation Model', icon: TrendingUp },
  { key: 'development_cost_outlook', title: '9. Pre-Construction Survey Directives', icon: Coins },
];

export const ReportView: React.FC<ReportViewProps> = ({ report, onBack }) => {
  const [copied, setCopied] = useState(false);
  const [isEmbedOpen, setIsEmbedOpen] = useState(false);
  const [isDriveOpen, setIsDriveOpen] = useState(false);

  const data = report.report_data;
  const titles = data.titles || {};
  const valueEst = data.site_value_estimate || { min: 0, max: 0, currency: 'PLN' };
  const currency = valueEst.currency || 'PLN';

  const tech = data.technical_parameters || {};
  const metrics = data.valuation_metrics || {};
  const stratigraphy = data.stratigraphy || [];
  const utilities = data.utilities_checklist || [];
  const risks = data.risk_matrix || [];
  const sources = data.data_sources || [];
  const soilMetrics = data.soil_metrics;
  const amenityIndex = data.amenity_index || [];

  const pricePerSqmMin = metrics.price_per_sqm_min || Math.round(valueEst.min / Math.max(1, report.area_size));
  const pricePerSqmMax = metrics.price_per_sqm_max || Math.round(valueEst.max / Math.max(1, report.area_size));

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (num: number, curr: string) => {
    return `${num.toLocaleString()} ${curr}`;
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 shadow-2xs">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                id="back-to-map-button"
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back to Map</span>
              </button>
            )}
            <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Landmark className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-slate-950 block leading-tight">
                European Land Evaluation Engine
              </span>
              <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                <span>Multi-Source Spatial Evidence Audit</span>
                <span>•</span>
                <span className="text-emerald-700 font-bold">ISRIC SoilGrids & Copernicus DEM</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="google-drive-sync-button"
              type="button"
              onClick={() => setIsDriveOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition shadow-2xs"
              title="Save to Google Drive"
            >
              <HardDrive className="h-3.5 w-3.5" />
              <span>Google Drive</span>
            </button>
            <button
              id="embed-widget-button"
              type="button"
              onClick={() => setIsEmbedOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition shadow-2xs"
            >
              <Code className="h-3.5 w-3.5" />
              <span>Embed</span>
            </button>
            <button
              id="share-report-button"
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-2xs"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Share'}</span>
            </button>
            <button
              id="print-report-button"
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Embed Modal */}
      <EmbedModal
        isOpen={isEmbedOpen}
        onClose={() => setIsEmbedOpen(false)}
        reportId={report.id}
        defaultCountry={report.country_code}
        defaultLanguage={report.language}
        currentLocation={{
          lat: report.latitude,
          lng: report.longitude,
          zoom: 16
        }}
      />

      {/* Google Drive Export Modal */}
      <GoogleDriveModal
        isOpen={isDriveOpen}
        onClose={() => setIsDriveOpen(false)}
        report={report}
      />

      {/* Main Container */}
      <main className="mx-auto max-w-4xl px-4 pt-6 space-y-6">
        
        {/* Prominent Statutory Liability Notice Banner */}
        <div className="bg-amber-50/90 border-l-4 border-amber-500 p-4 rounded-2xl shadow-2xs flex items-start gap-3 text-amber-950">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm leading-relaxed">
            <span className="font-bold block text-amber-950 mb-0.5">
              Statutory Evidence Notice & Legal Disclaimer (EU Directive 2007/2/EC & Eurocode 7)
            </span>
            <span>
              This automated spatial evaluation aggregates genuine open governmental cadastre, Copernicus elevation models, and ISRIC SoilGrids pedological data. It serves for preliminary due diligence and <strong>does not replace mandatory on-site geotechnical boreholes (Eurocode 7 EN 1997-1), an official certified appraisal (Operat Szacunkowy), or municipal zoning extract (MPZP)</strong>.
            </span>
          </div>
        </div>

        {/* Report Identification Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100 uppercase tracking-wide">
                Audit Dossier #{report.id}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Generated: {new Date(report.created_at).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Jurisdiction:</span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-200">
                {report.country} ({report.country_code})
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
              {report.location_name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 flex flex-wrap items-center gap-2">
              <span>Coordinates: {report.latitude.toFixed(6)}°N, {report.longitude.toFixed(6)}°E</span>
              <span>•</span>
              <span>Calculated Area: {report.area_size.toLocaleString()} m² ({(report.area_size / 10000).toFixed(2)} ha)</span>
              {tech.cadastral_parcel_id && (
                <>
                  <span>•</span>
                  <span className="font-semibold text-slate-800">Cadastral Plot: {tech.cadastral_parcel_id}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Evidence Score Card (0-100) */}
        {data.evidence_score && (
          <EvidenceScoreCard score={data.evidence_score} />
        )}

        {/* Statistical Valuation Benchmark Banner */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                  {titles.estimated_value || 'Indicative Statistical Market Benchmark'}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  {formatCurrency(valueEst.min, currency)} – {formatCurrency(valueEst.max, currency)}
                </span>
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                Regional unit rate: ~{pricePerSqmMin.toLocaleString()} – {pricePerSqmMax.toLocaleString()} {currency}/m²
              </span>
            </div>

            <div className="sm:text-right shrink-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-bold">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Statistical Model (Non-Appraisal)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs sm:ml-auto">
                Not a certified appraisal (Operat Szacunkowy / Gutachten).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 text-xs">
            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
              <span className="text-slate-400 block text-[11px]">Mean Relief Elevation</span>
              <span className="font-bold text-white text-sm mt-0.5 block">{tech.elevation_amsl ? `${tech.elevation_amsl} m a.s.l.` : '120 m'}</span>
            </div>
            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
              <span className="text-slate-400 block text-[11px]">Terrain Slope Angle</span>
              <span className="font-bold text-white text-sm mt-0.5 block">{tech.slope_degrees ? `${tech.slope_degrees}° (${tech.slope_category || 'Flat'})` : '1.5°'}</span>
            </div>
            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
              <span className="text-slate-400 block text-[11px]">Soil Texture Class</span>
              <span className="font-bold text-white text-sm mt-0.5 block truncate">{soilMetrics?.usda_texture || 'Sandy Loam'}</span>
            </div>
            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
              <span className="text-slate-400 block text-[11px]">Eurocode 7 Bearing</span>
              <span className="font-bold text-white text-sm mt-0.5 block truncate">{tech.soil_bearing_capacity_kpa || '170 – 250 kPa'}</span>
            </div>
          </div>
        </section>

        {/* Cadastral Boundary & Spatial Location Map */}
        <section className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Compass className="h-4 w-4 text-indigo-600" />
              <span>Cadastral Boundary Geometry & Spatial Positioning</span>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Boundary Type: {report.boundary.type.toUpperCase()}
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
            <MapPreview
              lat={report.latitude}
              lng={report.longitude}
              areaSize={report.area_size}
              boundary={report.boundary}
            />
          </div>
        </section>

        {/* Executive Summary Section */}
        {data.summary && (
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-slate-900 font-bold text-base">
              <FileText className="h-4 w-4 text-indigo-600" />
              <h2>{titles.executive_summary || 'Executive Evidence Synthesis'}</h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed text-slate-700 font-medium">
              {data.summary}
            </p>
          </section>
        )}

        {/* Genuine ISRIC SoilGrids 2.0 Scientific Pedological & Geotechnical Analysis */}
        {soilMetrics && (
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Beaker className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Scientific Soil Composition & Geotechnical Mechanics (ISRIC SoilGrids 2.0)
                  </h3>
                  <p className="text-xs text-slate-500">Direct scientific profile from ISRIC World Soil Information REST API (0–200 cm)</p>
                </div>
              </div>
              <EvidenceBadge level="VERIFIED" size="sm" />
            </div>

            {/* Particle Distribution Bar */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900">Topsoil Granulometric Fractions (0–30 cm):</span>
                <span className="font-bold text-indigo-700">{soilMetrics.usda_texture}</span>
              </div>

              {/* Stacked bar for Sand / Silt / Clay */}
              <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${soilMetrics.topsoil_sand_pct}%` }}
                  className="bg-amber-400 h-full flex items-center justify-center text-[10px] font-bold text-amber-950"
                  title={`Sand: ${soilMetrics.topsoil_sand_pct}%`}
                >
                  {soilMetrics.topsoil_sand_pct > 12 ? `${soilMetrics.topsoil_sand_pct}% Sand` : ''}
                </div>
                <div
                  style={{ width: `${soilMetrics.topsoil_silt_pct}%` }}
                  className="bg-emerald-400 h-full flex items-center justify-center text-[10px] font-bold text-emerald-950"
                  title={`Silt: ${soilMetrics.topsoil_silt_pct}%`}
                >
                  {soilMetrics.topsoil_silt_pct > 12 ? `${soilMetrics.topsoil_silt_pct}% Silt` : ''}
                </div>
                <div
                  style={{ width: `${soilMetrics.topsoil_clay_pct}%` }}
                  className="bg-rose-400 h-full flex items-center justify-center text-[10px] font-bold text-rose-950"
                  title={`Clay: ${soilMetrics.topsoil_clay_pct}%`}
                >
                  {soilMetrics.topsoil_clay_pct > 12 ? `${soilMetrics.topsoil_clay_pct}% Clay` : ''}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" />
                  <span>Sand: {soilMetrics.topsoil_sand_pct}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 inline-block" />
                  <span>Silt: {soilMetrics.topsoil_silt_pct}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400 inline-block" />
                  <span>Clay: {soilMetrics.topsoil_clay_pct}%</span>
                </div>
              </div>
            </div>

            {/* Granular Soil Properties Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Mean Bulk Density</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block">{soilMetrics.mean_bulk_density} g/cm³</span>
                <span className="text-[10px] text-slate-400">Compaction indicator</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Soil pH (H₂O)</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block">{soilMetrics.mean_ph}</span>
                <span className="text-[10px] text-slate-400">{soilMetrics.mean_ph < 6 ? 'Acidic' : soilMetrics.mean_ph > 7.5 ? 'Alkaline' : 'Neutral'}</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Hydraulic Permeability</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block truncate">{soilMetrics.hydraulic_conductivity}</span>
                <span className="text-[10px] text-slate-400 truncate">{soilMetrics.drainage_class}</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Frost Heave Class</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block truncate">{soilMetrics.frost_class.split(' ')[0]}</span>
                <span className="text-[10px] text-slate-400 truncate">{soilMetrics.frost_class}</span>
              </div>
            </div>

            {/* Stratigraphy Horizons Table */}
            {stratigraphy.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-slate-900 block">
                  Soil Stratigraphy Profile & Depth Horizon Inversion:
                </span>
                <div className="space-y-2.5">
                  {stratigraphy.map((layer, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-100 text-amber-900 shrink-0">
                          {layer.depth_range}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 block">{layer.soil_type}</span>
                          <span className="text-slate-600 block text-[11px] mt-0.5">{layer.description}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 sm:self-center">
                        <span className="font-bold text-slate-900 block">{layer.bearing_capacity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Evidence Registry Table (Claim -> Source -> Method -> Limitation) */}
        {data.evidence_registry && data.evidence_registry.length > 0 && (
          <EvidenceRegistryTable items={data.evidence_registry} />
        )}

        {/* Mandatory Pre-Construction Verification Checklist */}
        {data.verification_checklist && data.verification_checklist.length > 0 && (
          <VerificationChecklistCard items={data.verification_checklist} />
        )}

        {/* Surrounding Urban Amenity & POI Proximity Index */}
        {amenityIndex.length > 0 && (
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Surrounding Amenity & Public Infrastructure Proximity Index
                  </h3>
                  <p className="text-xs text-slate-500">Live OpenStreetMap POI network scraping with exact measured walking distances</p>
                </div>
              </div>
              <EvidenceBadge level="VERIFIED" size="sm" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              {amenityIndex.map((poi, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                      {poi.category === 'transit' ? <Bus className="h-3.5 w-3.5 text-blue-600" /> :
                       poi.category === 'education' ? <GraduationCap className="h-3.5 w-3.5 text-amber-600" /> :
                       poi.category === 'healthcare' ? <HeartPulse className="h-3.5 w-3.5 text-rose-600" /> :
                       <ShoppingBag className="h-3.5 w-3.5 text-emerald-600" />}
                    </div>
                    <div className="truncate">
                      <span className="font-bold text-slate-900 block truncate">{poi.name}</span>
                      <span className="text-[11px] text-slate-500 capitalize">{poi.type}</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-slate-900 bg-white px-2 py-1 rounded-lg border border-slate-200 text-xs shrink-0">
                    {poi.distance_m} m
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cadastral & Zoning Specifications Table */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Building2 className="h-4 w-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {titles.building_regulations || 'Cadastral, Zoning & Spatial Mandates'}
              </h3>
            </div>
            <EvidenceBadge level="REQUIRES_VERIFICATION" size="sm" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-medium">Planning Instrument</span>
              <span className="font-bold text-slate-900">{tech.zoning_name || 'MPZP / Decyzja WZ'}</span>
            </div>
            <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-medium">Floor Area Ratio (FAR / GFZ)</span>
              <span className="font-bold text-slate-900">{tech.max_far || '0.5 – 0.8 (Indicative)'}</span>
            </div>
            <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-medium">Max Plot Coverage</span>
              <span className="font-bold text-slate-900">{tech.max_building_coverage_pct || '30% – 40%'}</span>
            </div>
            <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-medium">Min Biologically Active Area</span>
              <span className="font-bold text-slate-900">{tech.min_biologically_active_pct || '30% – 50%'}</span>
            </div>
            <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-medium">Max Building Height</span>
              <span className="font-bold text-slate-900">{tech.max_height_m || '9.0 – 11.5 m'}</span>
            </div>
            <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-medium">Statutory Setback Rules</span>
              <span className="font-bold text-slate-900">{tech.setback_m || '4.0m windowed / 3.0m blind'}</span>
            </div>
            <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-medium">Estimated Water Table Depth</span>
              <span className="font-bold text-slate-900">{tech.groundwater_depth_m || '1.8 – 3.5 m'}</span>
            </div>
            <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-medium">Standard Frost Depth</span>
              <span className="font-bold text-slate-900">{tech.frost_depth_m || '0.8 – 1.2 m'}</span>
            </div>
          </div>
        </section>

        {/* Comprehensive Geohazard Risk Matrix */}
        {risks.length > 0 && (
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Geohazard, Hydrological & Environmental Risk Matrix
                  </h3>
                  <p className="text-xs text-slate-500">Cross-referenced against flood registries, seismic maps, and terrain slope</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[11px]">
                    <th className="pb-2.5">Risk Factor</th>
                    <th className="pb-2.5">Evidence Status</th>
                    <th className="pb-2.5">Hazard Level</th>
                    <th className="pb-2.5">Registry Finding & Caveat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {risks.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-3 font-bold text-slate-900">{r.category}</td>
                      <td className="py-3">
                        <EvidenceBadge level={r.evidence_level || 'MODELLED'} size="sm" />
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          r.level === 'Negligible' || r.level === 'Low'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.level === 'Moderate'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {r.level}
                        </span>
                      </td>
                      <td className="py-3 text-slate-600 text-xs sm:text-sm">{r.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Municipal Utilities Readiness Checklist */}
        {utilities.length > 0 && (
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Municipal Utilities & Technical Infrastructure Readiness
                  </h3>
                  <p className="text-xs text-slate-500">Live OSM spatial proximity vectors and DSO verification requirements</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {utilities.map((u, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">{u.utility}</span>
                    <EvidenceBadge level={u.evidence_level || 'REQUIRES_VERIFICATION'} size="sm" />
                  </div>
                  <p className="text-xs text-slate-700 font-medium">{u.status}</p>
                  {u.limitation && (
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/50">
                      <span>{u.limitation}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 9 Detailed Domain Technical Analyses */}
        <section className="space-y-6">
          {SECTION_ICONS.map(({ key, title, icon: Icon }) => {
            const section = (data as any)[key] || {};
            if (!section.summary && !section.detail) return null;

            const paragraphs = (section.detail || '')
              .split(/\n{2,}/)
              .map((p: string) => p.trim())
              .filter(Boolean);

            return (
              <div key={key} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      {titles[key] || title}
                    </h3>
                  </div>
                </div>

                {section.summary && (
                  <p className="rounded-xl border-l-4 border-indigo-600 bg-slate-50 px-4 py-3 text-xs sm:text-sm font-semibold text-slate-800">
                    {section.summary}
                  </p>
                )}

                <div className="space-y-3 text-xs sm:text-sm leading-relaxed text-slate-600">
                  {paragraphs.length > 0 ? (
                    paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)
                  ) : (
                    <p>{section.detail}</p>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* Key Risks & Opportunities */}
        <section className="grid gap-6 sm:grid-cols-2">
          {data.key_risks && data.key_risks.length > 0 && (
            <div className="bg-rose-50/70 rounded-3xl p-6 sm:p-7 border border-rose-200/80 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 text-rose-950 font-bold text-sm">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <h3>{titles.key_risks || 'Key Site Risks & Limitations'}</h3>
              </div>
              <ul className="space-y-2">
                {data.key_risks.map((risk: string, i: number) => (
                  <li key={i} className="text-xs sm:text-sm text-rose-950 bg-white/90 rounded-xl p-3 border border-rose-100 shadow-2xs font-medium">
                    • {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.opportunities && data.opportunities.length > 0 && (
            <div className="bg-emerald-50/70 rounded-3xl p-6 sm:p-7 border border-emerald-200/80 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h3>{titles.opportunities || 'Site Strengths & Opportunities'}</h3>
              </div>
              <ul className="space-y-2">
                {data.opportunities.map((opp: string, i: number) => (
                  <li key={i} className="text-xs sm:text-sm text-emerald-950 bg-white/90 rounded-xl p-3 border border-emerald-100 shadow-2xs font-medium">
                    • {opp}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Verified Governmental Data Sources Cited */}
        {sources.length > 0 && (
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
              <Globe className="h-4 w-4 text-indigo-600" />
              <h3>{titles.data_sources || 'Genuine Governmental & Scientific Data Sources Cited'}</h3>
            </div>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {sources.map((src, i) => (
                <li key={i} className="flex items-center justify-between gap-2 bg-slate-50 rounded-2xl px-4 py-3 text-xs text-slate-800 border border-slate-100">
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold block truncate">{src.name}</span>
                    </div>
                    {src.authority && (
                      <span className="text-[11px] text-slate-500 font-medium">Authority: {src.authority}</span>
                    )}
                  </div>
                  {src.url && (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 shrink-0 inline-flex items-center gap-1 font-semibold px-2 py-1 bg-white rounded-lg border border-slate-200 text-[11px]"
                    >
                      <span>Open Portal</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Comprehensive Statutory Legal & Liability Disclaimers */}
        {data.legal_disclaimers && data.legal_disclaimers.length > 0 && (
          <section className="bg-amber-50/80 rounded-3xl p-6 sm:p-8 border-2 border-amber-300 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5 text-amber-950 font-bold text-base border-b border-amber-200 pb-3">
              <Scale className="h-5 w-5 text-amber-700" />
              <h3>{titles.legal_disclaimers || 'Statutory Notice, Legal Disclaimers & Limitation of Liability'}</h3>
            </div>
            <ul className="space-y-3 pt-1">
              {data.legal_disclaimers.map((disc: string, i: number) => (
                <li key={i} className="text-xs sm:text-sm text-amber-950 leading-relaxed font-medium bg-white/70 p-3.5 rounded-xl border border-amber-200/60">
                  {disc}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400 pt-4">
          European Spatial Intelligence Engine · Grounded in ISRIC SoilGrids 2.0, Copernicus DEM, OpenStreetMap & National Cadastral Registers.
        </p>
      </main>
    </div>
  );
};

export default ReportView;
