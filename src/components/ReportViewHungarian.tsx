import React from 'react';
import { ArrowLeft, Database, ExternalLink, MapPin } from 'lucide-react';
import { SiteReport, EvidenceItem, SectionAnalysis } from '../types';

const H = {
  summary: 'Összefoglaló',
  known: 'Amit tudunk',
  suggests: 'Mit jelezhetnek az adatok?',
  unknown: 'Amit még nem tudunk',
  confirm: 'Amit meg kell erősíteni',
  site: 'Helyszín és telek',
  geology: 'Földtani információ',
  ground: 'Talaj és alapozási körülmények',
  hazards: 'Földtani veszélyek',
  flood: 'Árvíz és vízháztartás',
  planning: 'Tervezés és beépíthetőség',
  environment: 'Környezet',
  access: 'Megközelítés',
  market: 'Telekérték és piaci környezet',
  investigations: 'Javasolt vizsgálatok',
  sources: 'Források',
  disclaimer: 'Fontos korlátok',
  back: 'Vissza',
  coordinate: 'Koordináták',
  area: 'Terület',
  parcel: 'Helyrajzi azonosító',
  officialArea: 'Hivatalos terület',
  elevation: 'Tengerszint feletti magasság',
  slope: 'Lejtés',
  noData: 'Nincs adat',
  verified: 'Ellenőrzött',
  modelled: 'Modellezett',
  needsVerification: 'Ellenőrzés szükséges',
  source: 'Forrás',
  limitation: 'Korlát',
  priority: 'Prioritás'
};

function present(value: unknown): string {
  if (value === undefined || value === null || value === '') return H.noData;
  return String(value);
}

function level(value: unknown): string {
  const code = String(value || '').toUpperCase();
  if (code === 'VERIFIED') return H.verified;
  if (code === 'MODELLED') return H.modelled;
  return H.needsVerification;
}

const Section: React.FC<{title:string; section?:SectionAnalysis}> = ({title, section}) => {
  if (!section) return null;
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{level(section.evidence_level)}</span>
      </div>
      {section.summary && <p className="mt-3 text-sm leading-relaxed text-slate-700">{section.summary}</p>}
      {section.detail && <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-slate-600">{section.detail}</p>}
      {section.limitation_notice && <p className="mt-3 border-l-2 border-slate-200 pl-3 text-xs leading-relaxed text-slate-500"><strong>{H.limitation}:</strong> {section.limitation_notice}</p>}
      {section.source_cited && <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-400"><Database className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{section.source_cited}</p>}
    </section>
  );
};

const EvidenceCard: React.FC<{item:EvidenceItem}> = ({item}) => (
  <article className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
    <div className="flex items-start justify-between gap-3">
      <h3 className="text-sm font-bold text-slate-900">{present(item.category)}</h3>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{level(item.status)}</span>
    </div>
    <p className="mt-2 text-sm leading-relaxed text-slate-700">{present(item.claim)}</p>
    {item.sourceName && <p className="mt-2 text-[11px] text-slate-400">{H.source}: {item.sourceName}</p>}
    {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 underline underline-offset-2">{item.sourceUrl.replace(/^https?:\/\//,'').split('/')[0]} <ExternalLink className="h-3 w-3"/></a>}
    {item.limitation && <p className="mt-2 text-[11px] leading-relaxed text-slate-500"><strong>{H.limitation}:</strong> {item.limitation}</p>}
  </article>
);

export const ReportViewHungarian: React.FC<{report: SiteReport; onBack?: () => void}> = ({report,onBack}) => {
  const d:any = report.report_data || {};
  const context:any = d.geosurvey_context || {};
  const evidence: EvidenceItem[] = Array.isArray(d.evidence_registry) ? d.evidence_registry : [];
  const checks = Array.isArray(d.verification_checklist) ? d.verification_checklist : [];
  const sources = Array.isArray(d.data_sources) ? d.data_sources : [];
  const known = [
    d.soil_and_ground?.summary,
    d.flooding_risk?.summary,
    d.geohazard_risk?.summary,
    context.geological_unit_name ? `A HUGEO 1:100 000 földtani térképe a helyszínen a „${context.geological_unit_name}” megnevezést adja.` : null,
    context.hu_borehole_count ? `A kiválasztott hely környezetében ${context.hu_borehole_count} hivatalos HUGEO fúrási rekordot találtunk a 3 km-es szűrésben.` : null
  ].filter(Boolean).slice(0,5);
  const unknowns = [
    d.unavailable_reasons?.engineeringParameter,
    d.unavailable_reasons?.groundwater,
    d.unavailable_reasons?.planning,
    d.unavailable_reasons?.valuation,
    'A nyilvános magyar INSPIRE kataszteri WFS jelenleg nem országos parcelaszintű szolgáltatás; a lefedettséget az adott településen külön kell ellenőrizni.'
  ].filter(Boolean).slice(0,6);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"><ArrowLeft className="h-4 w-4"/>{H.back}</button>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">GroundSurf · Magyarország</div>
        </div>

        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <MapPin className="mt-1 h-5 w-5 text-indigo-600"/>
            <div>
              <h1 className="text-xl font-bold text-slate-950">{present(report.location_name || d.location_name)}</h1>
              <p className="mt-1 text-sm text-slate-500">{H.coordinate}: {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label={H.parcel} value={d.canonical_evidence?.parcel?.parcelId || d.canonical_evidence?.parcel?.cadastralParcel || report.is_official_parcel ? 'Azonosítva' : H.noData}/>
            <Metric label={H.area} value={report.area_size ? `${Math.round(report.area_size).toLocaleString('hu-HU')} m²` : H.noData}/>
            <Metric label={H.officialArea} value={report.official_area_m2 ? `${Math.round(report.official_area_m2).toLocaleString('hu-HU')} m²` : H.noData}/>
            <Metric label={H.elevation} value={d.geosurvey_context?.elevation_m != null ? `${d.geosurvey_context.elevation_m} m` : H.noData}/>
            <Metric label={H.slope} value={d.technical_parameters?.slope_degrees != null ? `${d.technical_parameters.slope_degrees}°` : H.noData}/>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-950">{H.summary}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{present(d.summary)}</p>
        </section>

        {known.length > 0 && <section className="space-y-3"><h2 className="text-lg font-bold text-slate-950">{H.known}</h2>{known.map((item:string,i:number)=><div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700">{item}</div>)}</section>}

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title={H.geology} section={d.soil_and_ground}/>
          <Section title={H.hazards} section={d.geohazard_risk}/>
          <Section title={H.flood} section={d.flooding_risk}/>
          <Section title={H.planning} section={d.zoning_and_land_use}/>
          <Section title={H.environment} section={d.environmental_factors}/>
          <Section title={H.access} section={d.infrastructure_and_access}/>
          <Section title={H.market} section={d.market_and_comparables}/>
          <Section title={H.investigations} section={d.development_cost_outlook}/>
        </div>

        {unknowns.length > 0 && <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-base font-bold text-slate-950">{H.unknown}</h2><div className="mt-3 space-y-2">{unknowns.map((item:string,i:number)=><p key={i} className="border-l-2 border-slate-200 pl-3 text-sm leading-relaxed text-slate-600">{item}</p>)}</div></section>}

        {checks.length > 0 && <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-base font-bold text-slate-950">{H.confirm}</h2><div className="mt-3 space-y-3">{checks.map((item:any,i:number)=><div key={i} className="rounded-2xl border border-slate-200 p-4"><div className="text-sm font-semibold text-slate-900">{present(item.topic || item.title)}</div><div className="mt-1 text-xs leading-relaxed text-slate-600">{present(item.reason)}</div>{item.priority && <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{H.priority}: {present(item.priority)}</div>}</div>)}</div></section>}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-950">{H.sources}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{evidence.slice(0,20).map((item,i)=><EvidenceCard item={item} key={item.id || i}/>)}</div>
          {sources.length > 0 && <div className="mt-4 text-xs text-slate-500">{sources.slice(0,10).map((s:any)=><div key={s.name || Math.random()} className="py-1">{present(s.name)}</div>)}</div>}
        </section>

        {Array.isArray(d.legal_disclaimers) && d.legal_disclaimers.length > 0 && <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-base font-bold text-slate-950">{H.disclaimer}</h2><div className="mt-3 space-y-2">{d.legal_disclaimers.map((item:string,i:number)=><p key={i} className="text-xs leading-relaxed text-slate-600">{item}</p>)}</div></section>}
      </div>
    </div>
  );
};

const Metric: React.FC<{label:string; value:React.ReactNode}> = ({label,value}) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
    <div className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</div>
  </div>
);
