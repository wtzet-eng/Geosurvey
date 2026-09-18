import React, { useState } from 'react';
import { SiteReport } from '../types';
import { buyerSummary, decisionIntroCopy, findingsCopy } from '../i18n/reportFindings';
import { localizeAspect } from '../i18n/aspectI18n';
import { MapPreview } from './MapPreview';
import { EmbedModal } from './EmbedModal';
import { GoogleDriveModal } from './GoogleDriveModal';
import { ArrowLeft, Check, Code, Copy, Database, FileText, HardDrive, Landmark, MapPin, Printer, ShieldAlert } from 'lucide-react';

interface Props { report: SiteReport; onBack?: () => void; }

const status = (value: unknown) => {
  const code = String(value || '').toUpperCase();
  if (code === 'VERIFIED') return 'Verifisert';
  if (code === 'MODELLED') return 'Modellert';
  return 'Må verifiseres';
};

const present = (value: unknown, fallback = 'ikke tilgjengelig') => value === null || value === undefined || value === '' || Number.isNaN(value) ? fallback : String(value);
export const localizeNorwegianAspect = (value: unknown) => localizeAspect(value, 'no', 'ikke tilgjengelig');

const Section: React.FC<{ number: string; title: string; section?: any; children?: React.ReactNode }> = ({ number, title, section, children }) => (
  <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
    <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
      <div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Del {number}</div><h2 className="text-base sm:text-lg font-bold text-slate-950">{title}</h2></div>
      <span className="text-[10px] font-bold rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">{status(section?.evidence_level)}</span>
    </div>
    <div className="p-6 space-y-4">
      {section?.summary && <div className="text-sm leading-relaxed text-slate-700 font-medium">{section.summary}</div>}
      {section?.detail && <div className="text-xs sm:text-sm leading-relaxed text-slate-600 whitespace-pre-line">{section.detail}</div>}
      {children}
      {section?.limitation_notice && <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900"><strong>Begrensning:</strong> {section.limitation_notice}</div>}
      {section?.source_cited && <div className="text-[11px] text-slate-400 flex items-center gap-1.5"><Database className="h-3.5 w-3.5" />Kilde brukt i analysen: {section.source_cited}</div>}
    </div>
  </section>
);

const Metric: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{label}</div><div className="mt-1 text-sm sm:text-base font-bold text-slate-900 break-words">{value}</div></div>;

export const ReportViewNorwegian: React.FC<Props> = ({ report, onBack }) => {
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
  const noCadastre = data.norway_cadastre?.parcel || {};
  const planningConfirmed=data.zoning_and_land_use?.evidence_level==='VERIFIED';
  const floodConfirmed=data.flooding_risk?.evidence_level==='VERIFIED';
  const buyer=buyerSummary({slope:tech.slope_degrees, risks, planningConfirmed, floodConfirmed},'no');
  const opening=decisionIntroCopy('no');
  const findings=findingsCopy('no');
  const hasParcel=Boolean(tech.cadastral_parcel_id && present(tech.cadastral_parcel_id)!=='ikke tilgjengelig');
  const geologyName=data.geosurvey_context?.geological_unit_name;
  const hasMappedEvidence=Boolean(hasParcel || geologyName);
  const highlights=[geologyName?`${findings.mapped}: ${geologyName}`:null,typeof tech.slope_degrees==='number'?`${findings.terrain}: ${tech.slope_degrees}°`:null,hasParcel?`${findings.parcel}: ${tech.cadastral_parcel_id}`:null].filter(Boolean) as string[];
  const plainSummary=`${opening.first} ${hasMappedEvidence?opening.evidence:opening.limited} ${planningConfirmed&&floodConfirmed?opening.clear:opening.next}`;

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  return <div className="min-h-screen bg-slate-100/70 text-slate-900 pb-20">
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 shadow-sm">
      <div className="mx-auto max-w-5xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold shrink-0"><ArrowLeft className="h-3.5 w-3.5" />Tilbake</button>}
          <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0"><Landmark className="h-4 w-4" /></div>
          <div className="min-w-0"><div className="font-bold text-sm truncate">LandSurf</div><div className="text-[10px] text-slate-500 truncate">Foreløpig tomtevurdering · dokumentasjon først</div></div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => setIsDriveOpen(true)} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold"><HardDrive className="h-3.5 w-3.5" />Drive</button>
          <button type="button" onClick={() => setIsEmbedOpen(true)} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold"><Code className="h-3.5 w-3.5" />Bygg inn</button>
          <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold">{copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Kopiert' : 'Del'}</button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold"><Printer className="h-3.5 w-3.5" /><span className="hidden sm:inline">PDF</span></button>
        </div>
      </div>
    </header>
    <EmbedModal isOpen={isEmbedOpen} onClose={() => setIsEmbedOpen(false)} report={report} defaultCountry={report.country_code} defaultLanguage={report.language} />
    <GoogleDriveModal isOpen={isDriveOpen} onClose={() => setIsDriveOpen(false)} report={report} />

    <main className="mx-auto max-w-5xl px-4 pt-6 space-y-6">
      <section className="rounded-3xl bg-slate-950 text-white p-6 sm:p-8 shadow-lg">
        <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-widest"><FileText className="h-4 w-4" />1. Sammendrag</div>
        <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">{planningConfirmed&&floodConfirmed?opening.complete:opening.verdict}</h1>
        <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-3xl">{plainSummary}</p>
        <div className="mt-6 grid md:grid-cols-2 gap-5">
          <div><h2 className="text-sm font-semibold text-white">{buyer.copy.positive}</h2><p className="mt-2 text-xs text-slate-400">{buyer.copy.suitabilityNote}</p>{buyer.positives.length?<ul className="mt-2 space-y-2 text-sm text-slate-300">{buyer.positives.map((text,index)=><li key={index}>{text}</li>)}</ul>:<p className="mt-2 text-sm text-slate-300">{buyer.copy.noPositive}</p>}</div>
          <div><h2 className="text-sm font-semibold text-white">{buyer.copy.concerns}</h2>{buyer.concerns.length?<ul className="mt-2 space-y-2 text-sm text-amber-200">{buyer.concerns.map((text,index)=><li key={index}>{text}</li>)}</ul>:<p className="mt-2 text-sm text-slate-300">{buyer.copy.noConcern}</p>}</div>
          <div className="md:col-span-2 border-t border-white/10 pt-4"><h2 className="text-sm font-semibold text-white">{buyer.copy.checks}</h2><ul className="mt-2 space-y-1 text-sm text-slate-300">{buyer.checks.map((text,index)=><li key={index}>{text}</li>)}</ul></div>
        </div>
      </section>
      {highlights.length>0&&<section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><h2 className="text-lg font-semibold">{findings.findings}</h2><ul className="mt-3 space-y-2 text-sm">{highlights.map((item,index)=><li key={index}>{item}</li>)}</ul><p className="mt-3 text-xs text-slate-600">{findings.limits}</p></section>}
      {checklist.length>0&&<section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><h2 className="text-lg font-semibold">{opening.nextTitle}</h2><p className="mt-1 text-sm text-slate-600">{opening.nextLead}</p><ol className="mt-4 space-y-4 list-decimal pl-5">{checklist.slice(0,3).map((item:any,index:number)=><li key={index} className="pl-1 text-sm"><h3 className="font-semibold">{item.topic}</h3><p className="mt-1 text-slate-600 leading-relaxed">{item.reason}</p>{item.recommendedAuthorityOrExpert&&<p className="mt-1 text-xs text-slate-500">Aktuell myndighet / fagperson: {item.recommendedAuthorityOrExpert}</p>}</li>)}</ol></section>}

      <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center"><MapPin className="h-5 w-5" /></div><div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">2. Sted og tomt</div><h2 className="text-lg font-bold">Sted og eiendomsregister</h2></div></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Sted" value={report.location_name} />
          <Metric label="Koordinater" value={`${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`} />
          <Metric label="Valgt areal" value={`${report.area_size.toLocaleString('nb-NO')} m²`} />
          <Metric label="Matrikkelenhet" value={present(tech.cadastral_parcel_id)} />
          <Metric label="Kommunenummer" value={present(noCadastre.municipalityCode)} />
          <Metric label="Grov stedfestingsklasse" value={present(noCadastre.accuracyClass)} />
          <Metric label="Høyde" value={tech.elevation_amsl !== null && tech.elevation_amsl !== undefined ? `${tech.elevation_amsl} moh.` : 'ikke tilgjengelig'} />
          <Metric label="Helning" value={tech.slope_degrees !== null && tech.slope_degrees !== undefined ? `${tech.slope_degrees}° (${present(tech.slope_percent)} %)` : 'ikke tilgjengelig'} />
          <Metric label="Helningsretning" value={localizeNorwegianAspect(tech.aspect_direction)} />
        </div>
        <MapPreview lat={report.latitude} lng={report.longitude} areaSize={report.area_size} boundary={report.boundary} />
        <div className="text-[11px] text-slate-500">Kartverkets åpne eiendomsgeometri brukes som registerkontekst, ikke som sertifisert juridisk grense. Eierskap, hjemmel, servitutter, heftelser og nødvendig grensepresisjon må verifiseres separat.</div>
      </section>

      <Section number="3" title="Grunnforhold og fundamentering" section={data.soil_and_ground} />
      <Section number="4" title="Geologiske farer" section={data.geohazard_risk}>
        {risks.length > 0 && <div className="grid sm:grid-cols-2 gap-3">{risks.map((item: any, index: number) => <div key={`${item.category}-${index}`} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div className="font-bold text-sm">{item.category}</div><span className="text-[10px] font-bold text-slate-500">{status(item.evidence_level)}</span></div><div className="mt-1 text-sm text-slate-700">{present(item.level)}</div>{item.detail && <div className="mt-2 text-xs text-slate-500">{item.detail}</div>}</div>)}</div>}
      </Section>
      <Section number="5" title="Flom og hydrologi" section={data.flooding_risk} />
      <Section number="6" title="Arealplan og arealbruk" section={data.zoning_and_land_use} />
      <Section number="7" title="Bygge- og myndighetskrav" section={data.building_regulations} />
      <Section number="8" title="Miljøforhold" section={data.environmental_factors} />
      <Section number="9" title="Infrastruktur og adkomst" section={data.infrastructure_and_access} />
      <Section number="10" title="Tomtemarked og verdi" section={data.market_and_comparables} />

      {utilities.length > 0 && <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-4"><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">11. Teknisk infrastruktur</div><h2 className="text-lg font-bold">Oversikt over tjenester</h2><div className="grid sm:grid-cols-2 gap-3">{utilities.map((item: any, index: number) => <div key={`${item.utility}-${index}`} className="rounded-2xl border border-slate-200 p-4"><div className="font-bold text-sm">{item.utility}</div><div className="text-xs text-slate-600 mt-1">{item.status}</div><div className="text-[10px] text-slate-400 mt-2">{status(item.evidence_level)}</div></div>)}</div></section>}

      <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3"><ShieldAlert className="h-5 w-5 text-amber-600" /><div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">12. Anbefalt kontroll</div><h2 className="text-lg font-bold">Anbefalte undersøkelser og verifikasjoner</h2></div></div>
        {checklist.length ? checklist.map((item: any, index: number) => <div key={`${item.topic}-${index}`} className="rounded-2xl border border-slate-200 p-4"><div className="font-bold text-sm">{item.topic}</div><div className="text-xs text-slate-600 mt-1">{item.reason}</div>{item.recommendedAuthorityOrExpert && <div className="text-[11px] text-slate-400 mt-2">Aktuell myndighet / fagperson: {item.recommendedAuthorityOrExpert}</div>}</div>) : <div className="text-sm text-slate-500">Ingen strukturert kontrolliste ble returnert. Se begrensningene og dokumentasjonshullene ovenfor.</div>}
      </section>

      <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3"><Database className="h-5 w-5 text-indigo-600" /><div><div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">13. Dokumentasjonsregister</div><h2 className="text-lg font-bold">Dokumentasjon og kilder</h2></div></div>
        {evidence.map((item: any, index: number) => <details key={`${item.id}-${index}`} className="rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer list-none"><div className="flex items-start justify-between gap-3"><div><div className="font-bold text-sm">{item.category}</div><div className="text-xs text-slate-500 mt-1">{item.claim}</div></div><span className="text-[10px] font-bold text-slate-500 shrink-0">{status(item.status)}</span></div></summary><div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-2"><div><strong>Kilde:</strong> {item.sourceName}</div>{item.spatialRelationship && <div><strong>Romlig forhold:</strong> {item.spatialRelationship}</div>}{item.calculationMethod && <div><strong>Metode:</strong> {item.calculationMethod}</div>}{item.limitation && <div><strong>Begrensning:</strong> {item.limitation}</div>}</div></details>)}
        {sources.length > 0 && <div className="pt-3 border-t border-slate-100"><div className="font-bold text-sm mb-2">Kilder i rapporten</div><div className="space-y-2">{sources.map((source: any, index: number) => <div key={`${source.name}-${index}`} className="text-xs text-slate-600"><strong>{source.name}</strong>{source.verification_status ? ` · ${source.verification_status}` : ''}</div>)}</div></div>}
      </section>

      <section className="rounded-3xl bg-amber-50 border border-amber-200 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm"><ShieldAlert className="h-5 w-5" />Viktige begrensninger</div>
        <div className="mt-3 space-y-2">{legal.length ? legal.map((item: string, index: number) => <p key={index} className="text-xs text-amber-900/80 leading-relaxed">{item}</p>) : <p className="text-xs text-amber-900/80">LandSurf er et innledende screeningverktøy og erstatter ikke offentlige dokumenter, fagundersøkelser, juridisk rådgivning eller takst.</p>}</div>
      </section>
    </main>
  </div>;
};