import React, { useState } from 'react';
import { SiteReport } from '../types';
import { MapPreview } from './MapPreview';
import { EmbedModal } from './EmbedModal';
import { GoogleDriveModal } from './GoogleDriveModal';
import { ArrowLeft, Check, Code, Copy, Database, FileText, HardDrive, Landmark, MapPin, Printer, ShieldAlert } from 'lucide-react';

interface Props { report: SiteReport; onBack?: () => void; }

const status = (value: unknown) => {
  const code = String(value || '').toUpperCase();
  if (code === 'VERIFIED') return 'Ověřeno';
  if (code === 'MODELLED') return 'Modelováno';
  return 'Vyžaduje ověření';
};

const present = (value: unknown, fallback = 'údaj není k dispozici') => value === null || value === undefined || value === '' || Number.isNaN(value) ? fallback : String(value);

const aspect = (value: unknown) => {
  const raw = present(value);
  const directions: Record<string, string> = {
    N: 'Sever', NE: 'Severovýchod', E: 'Východ', SE: 'Jihovýchod',
    S: 'Jih', SW: 'Jihozápad', W: 'Západ', NW: 'Severozápad'
  };
  return directions[raw] || raw;
};

const Section: React.FC<{ number: string; title: string; section?: any; children?: React.ReactNode }> = ({ number, title, section, children }) => (
  <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
    <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
      <div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Část {number}</div><h2 className="text-base sm:text-lg font-bold text-slate-950">{title}</h2></div>
      <span className="text-[10px] font-bold rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">{status(section?.evidence_level)}</span>
    </div>
    <div className="p-6 space-y-4">
      {section?.summary && <div className="text-sm leading-relaxed text-slate-700 font-medium">{section.summary}</div>}
      {section?.detail && <div className="text-xs sm:text-sm leading-relaxed text-slate-600 whitespace-pre-line">{section.detail}</div>}
      {children}
      {section?.limitation_notice && <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900"><strong>Omezení:</strong> {section.limitation_notice}</div>}
      {section?.source_cited && <div className="text-[11px] text-slate-400 flex items-center gap-1.5"><Database className="h-3.5 w-3.5" />Zdroj použitý v analýze: {section.source_cited}</div>}
    </div>
  </section>
);

const Metric: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{label}</div><div className="mt-1 text-sm sm:text-base font-bold text-slate-900 break-words">{value}</div></div>;

export const ReportViewCzech: React.FC<Props> = ({ report, onBack }) => {
  const [copied, setCopied] = useState(false);
  const [isEmbedOpen, setIsEmbedOpen] = useState(false);
  const [isDriveOpen, setIsDriveOpen] = useState(false);
  const data: any = report.report_data || {};
  const tech = data.technical_parameters || {};
  const risks = data.risk_matrix || [];
  const evidence = data.evidence_registry || [];
  const checklist = data.verification_checklist || [];
  const sources = data.data_sources || [];
  const legal = data.legal_disclaimers || [];
  const utilities = data.utilities_checklist || [];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return <div className="min-h-screen bg-slate-100/70 text-slate-900 pb-20">
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 shadow-sm">
      <div className="mx-auto max-w-5xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold shrink-0"><ArrowLeft className="h-3.5 w-3.5" />Zpět</button>}
          <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0"><Landmark className="h-4 w-4" /></div>
          <div className="min-w-0"><div className="font-bold text-sm truncate">GeoSurvey</div><div className="text-[10px] text-slate-500 truncate">Předběžné posouzení lokality · důkazy na prvním místě</div></div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => setIsDriveOpen(true)} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold"><HardDrive className="h-3.5 w-3.5" />Drive</button>
          <button type="button" onClick={() => setIsEmbedOpen(true)} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold"><Code className="h-3.5 w-3.5" />Vložit</button>
          <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold">{copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Zkopírováno' : 'Sdílet'}</button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold"><Printer className="h-3.5 w-3.5" /><span className="hidden sm:inline">PDF</span></button>
        </div>
      </div>
    </header>
    <EmbedModal isOpen={isEmbedOpen} onClose={() => setIsEmbedOpen(false)} report={report} defaultCountry={report.country_code} defaultLanguage={report.language} />
    <GoogleDriveModal isOpen={isDriveOpen} onClose={() => setIsDriveOpen(false)} report={report} />

    <main className="mx-auto max-w-5xl px-4 pt-6 space-y-6">
      <section className="rounded-3xl bg-slate-950 text-white p-6 sm:p-8 shadow-lg">
        <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-widest"><FileText className="h-4 w-4" />1. Souhrnné hodnocení</div>
        <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">Předběžné posouzení lokality</h1>
        <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-3xl">{data.summary || 'Posouzení vychází z údajů, které se pro tuto lokalitu podařilo získat. Původ a omezení údajů jsou uvedeny v registru důkazů.'}</p>
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Skóre důkazů" value={data.evidence_score ? `${data.evidence_score.totalScore}/100` : 'nehodnoceno'} />
          <Metric label="Ověřeno" value={data.evidence_score?.verifiedCount ?? 0} />
          <Metric label="Modelováno" value={data.evidence_score?.modelledCount ?? 0} />
          <Metric label="K ověření" value={data.evidence_score?.unverifiedCount ?? 0} />
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center"><MapPin className="h-5 w-5" /></div><div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">2. Lokalita a parcela</div><h2 className="text-lg font-bold">Lokalita a parcela</h2></div></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Lokalita" value={report.location_name} />
          <Metric label="Souřadnice" value={`${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`} />
          <Metric label="Plocha" value={`${report.area_size.toLocaleString('cs-CZ')} m²`} />
          <Metric label="Katastrální parcela" value={present(tech.cadastral_parcel_id)} />
          <Metric label="Úřední výměra" value={tech.official_area_m2 ? `${tech.official_area_m2} m²` : 'údaj není k dispozici'} />
          <Metric label="Nadmořská výška" value={tech.elevation_amsl !== null && tech.elevation_amsl !== undefined ? `${tech.elevation_amsl} m n. m.` : 'údaj není k dispozici'} />
          <Metric label="Sklon" value={tech.slope_degrees !== null && tech.slope_degrees !== undefined ? `${tech.slope_degrees}° (${present(tech.slope_percent)} %)` : 'údaj není k dispozici'} />
          <Metric label="Orientace svahu" value={aspect(tech.aspect_direction)} />
        </div>
        <MapPreview lat={report.latitude} lng={report.longitude} areaSize={report.area_size} boundary={report.boundary} />
        <div className="text-[11px] text-slate-500">Geometrie parcely je prostorový podklad. Vlastnictví, právní titul, věcná břemena a další zatížení je nutné ověřit v příslušných registrech.</div>
      </section>

      <Section number="3" title="Podloží a základové podmínky" section={data.soil_and_ground} />
      <Section number="4" title="Geologická rizika" section={data.geohazard_risk}>
        {risks.length > 0 && <div className="grid sm:grid-cols-2 gap-3">{risks.map((item: any, index: number) => <div key={`${item.category}-${index}`} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div className="font-bold text-sm">{item.category}</div><span className="text-[10px] font-bold text-slate-500">{status(item.evidence_level)}</span></div><div className="mt-1 text-sm text-slate-700">{present(item.level)}</div>{item.detail && <div className="mt-2 text-xs text-slate-500">{item.detail}</div>}</div>)}</div>}
      </Section>
      <Section number="5" title="Povodně a hydrologie" section={data.flooding_risk} />
      <Section number="6" title="Územní plánování a využití území" section={data.zoning_and_land_use} />
      <Section number="7" title="Stavební a regulační požadavky" section={data.building_regulations} />
      <Section number="8" title="Životní prostředí" section={data.environmental_factors} />
      <Section number="9" title="Infrastruktura a přístup" section={data.infrastructure_and_access} />
      <Section number="10" title="Trh a hodnota pozemku" section={data.market_and_comparables} />

      {utilities.length > 0 && <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">11. Technická infrastruktura</div>
        <h2 className="text-lg font-bold">Přehled sítí</h2>
        <div className="grid sm:grid-cols-2 gap-3">{utilities.map((item: any, index: number) => <div key={`${item.utility}-${index}`} className="rounded-2xl border border-slate-200 p-4"><div className="font-bold text-sm">{item.utility}</div><div className="text-xs text-slate-600 mt-1">{item.status}</div><div className="text-[10px] text-slate-400 mt-2">{status(item.evidence_level)}</div></div>)}</div>
      </section>}

      <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3"><ShieldAlert className="h-5 w-5 text-amber-600" /><div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">12. Doporučená ověření</div><h2 className="text-lg font-bold">Doporučené průzkumy a kontroly</h2></div></div>
        {checklist.length ? checklist.map((item: any, index: number) => <div key={`${item.topic}-${index}`} className="rounded-2xl border border-slate-200 p-4"><div className="font-bold text-sm">{item.topic}</div><div className="text-xs text-slate-600 mt-1">{item.reason}</div>{item.recommendedAuthorityOrExpert && <div className="text-[11px] text-slate-400 mt-2">Doporučený úřad / odborník: {item.recommendedAuthorityOrExpert}</div>}</div>) : <div className="text-sm text-slate-500">Nebyl vrácen strukturovaný seznam kontrol. Projděte omezení a mezery v důkazech uvedené výše.</div>}
      </section>

      <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3"><Database className="h-5 w-5 text-indigo-600" /><div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">13. Registr důkazů</div><h2 className="text-lg font-bold">Registr důkazů a zdrojů</h2></div></div>
        {evidence.map((item: any, index: number) => <details key={`${item.id}-${index}`} className="rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer list-none"><div className="flex items-start justify-between gap-3"><div><div className="font-bold text-sm">{item.category}</div><div className="text-xs text-slate-500 mt-1">{item.claim}</div></div><span className="text-[10px] font-bold text-slate-500 shrink-0">{status(item.status)}</span></div></summary><div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-2"><div><strong>Zdroj:</strong> {item.sourceName}</div>{item.spatialRelationship && <div><strong>Prostorový vztah:</strong> {item.spatialRelationship}</div>}{item.calculationMethod && <div><strong>Metoda:</strong> {item.calculationMethod}</div>}{item.limitation && <div><strong>Omezení:</strong> {item.limitation}</div>}</div></details>)}
        {sources.length > 0 && <div className="pt-3 border-t border-slate-100"><div className="font-bold text-sm mb-2">Zdroje v reportu</div><div className="space-y-2">{sources.map((source: any, index: number) => <div key={`${source.name}-${index}`} className="text-xs text-slate-600"><strong>{source.name}</strong>{source.verification_status ? ` · ${source.verification_status}` : ''}</div>)}</div></div>}
      </section>

      <section className="rounded-3xl bg-amber-50 border border-amber-200 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm"><ShieldAlert className="h-5 w-5" />Důležitá omezení</div>
        <div className="mt-3 space-y-2">{legal.length ? legal.map((item: string, index: number) => <p key={index} className="text-xs text-amber-900/80 leading-relaxed">{item}</p>) : <p className="text-xs text-amber-900/80">GeoSurvey je předběžný screeningový nástroj a nenahrazuje úřední dokument, odborný průzkum, právní stanovisko ani znalecké ocenění.</p>}</div>
      </section>
    </main>
  </div>;
};
