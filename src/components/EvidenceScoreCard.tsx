import { coverageCopy } from '../i18n/reportFindings';
import React, { useState } from 'react';
import { EvidenceQualityScore } from '../types';
import { ShieldCheck, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

interface EvidenceScoreCardProps {
  score?: EvidenceQualityScore;
  language?: string;
}

type ScoreCopy = {
  title: string; subtitle: string; quality: string; low: string; regional: string; direct: string;
  verified: string; official: string; modelled: string; geo: string; requires: string; onsite: string;
  hide: string; show: string; categories: string[]; rationale: string; summary: string;
  robust: string; moderate: string; preliminary: string;
};

const copies: Record<string, ScoreCopy> = {
  en: { title: 'Evidence Quality & Reliability Score', subtitle: 'Transparent data certainty model across six evaluation disciplines', quality: 'Calculated Quality', low: 'Unverified Hypothesis', regional: 'Regional Model', direct: 'Direct On-Site Evidence', verified: 'Verified Data Points', official: 'Official cadastre / DEM', modelled: 'Regional Models', geo: 'Geological / Hydrological', requires: 'Require Verification', onsite: 'On-site investigation / planning', hide: 'Hide Score Category Details', show: 'View Scoring Breakdown by Discipline', categories: ['Cadastre & Legal Boundary', 'Terrain & Elevation DEM', 'Geology & Groundwater', 'Infrastructure & Access', 'Hydrology & Flood Risk', 'Planning & Valuation'], rationale: 'The score reflects evidence availability and status for this category.', summary: 'The score is calculated only from recorded evidence availability and status.', robust: 'Robust Evidence', moderate: 'Moderate Evidence', preliminary: 'Preliminary Evidence' },
  pl: { title: 'Wynik jakości i wiarygodności dowodów', subtitle: 'Przejrzysty model pewności danych w sześciu obszarach oceny', quality: 'Obliczona jakość', low: 'Hipoteza niezweryfikowana', regional: 'Model regionalny', direct: 'Bezpośrednie dane terenowe', verified: 'Zweryfikowane punkty danych', official: 'Kataster urzędowy / DEM', modelled: 'Modele regionalne', geo: 'Dane geologiczne / hydrologiczne', requires: 'Wymagają weryfikacji', onsite: 'Badania terenowe / plan miejscowy', hide: 'Ukryj szczegóły wyniku', show: 'Pokaż wynik według obszarów', categories: ['Kataster i granice prawne', 'Teren i model wysokościowy', 'Geologia i wody gruntowe', 'Infrastruktura i dostęp', 'Hydrologia i ryzyko powodziowe', 'Planowanie i wycena'], rationale: 'Wynik odzwierciedla dostępność i status dowodów w tej kategorii.', summary: 'Wynik jest obliczany wyłącznie na podstawie zarejestrowanego statusu i dostępności dowodów.', robust: 'Mocne dowody', moderate: 'Umiarkowane dowody', preliminary: 'Wstępne dowody' },
  de: { title: 'Evidenzqualität und Zuverlässigkeitswert', subtitle: 'Transparentes Datengewissheitsmodell in sechs Bewertungsbereichen', quality: 'Berechnete Qualität', low: 'Unverifizierte Hypothese', regional: 'Regionalmodell', direct: 'Direkte Standortdaten', verified: 'Verifizierte Datenpunkte', official: 'Amtliches Kataster / DEM', modelled: 'Regionalmodelle', geo: 'Geologische / hydrologische Daten', requires: 'Prüfung erforderlich', onsite: 'Standortuntersuchung / Bauleitplanung', hide: 'Bewertungsdetails ausblenden', show: 'Bewertung nach Fachbereich anzeigen', categories: ['Kataster und Rechtsgrenze', 'Gelände und Höhenmodell', 'Geologie und Grundwasser', 'Infrastruktur und Zugang', 'Hydrologie und Hochwasserrisiko', 'Planung und Bewertung'], rationale: 'Der Wert spiegelt Verfügbarkeit und Evidenzstatus dieser Kategorie wider.', summary: 'Der Wert wird ausschließlich aus dem erfassten Status und der Verfügbarkeit der Evidenz berechnet.', robust: 'Robuste Evidenz', moderate: 'Mittlere Evidenz', preliminary: 'Vorläufige Evidenz' },
  fr: { title: 'Qualité et fiabilité des preuves', subtitle: 'Modèle transparent de certitude des données dans six domaines d’évaluation', quality: 'Qualité calculée', low: 'Hypothèse non vérifiée', regional: 'Modèle régional', direct: 'Preuve directe sur site', verified: 'Données vérifiées', official: 'Cadastre officiel / MNT', modelled: 'Modèles régionaux', geo: 'Géologie / hydrologie', requires: 'À vérifier', onsite: 'Investigation du site / urbanisme', hide: 'Masquer le détail du score', show: 'Afficher le score par domaine', categories: ['Cadastre et limites juridiques', 'Terrain et modèle altimétrique', 'Géologie et eaux souterraines', 'Infrastructure et accès', 'Hydrologie et risque d’inondation', 'Urbanisme et valeur foncière'], rationale: 'Le score reflète la disponibilité et le statut des preuves dans cette catégorie.', summary: 'Le score est calculé uniquement à partir de la disponibilité et du statut enregistrés des preuves.', robust: 'Preuves robustes', moderate: 'Preuves modérées', preliminary: 'Preuves préliminaires' },
  es: { title: 'Calidad y fiabilidad de la evidencia', subtitle: 'Modelo transparente de certeza de datos en seis ámbitos de evaluación', quality: 'Calidad calculada', low: 'Hipótesis no verificada', regional: 'Modelo regional', direct: 'Evidencia directa in situ', verified: 'Datos verificados', official: 'Catastro oficial / MDE', modelled: 'Modelos regionales', geo: 'Geología / hidrología', requires: 'Requiere verificación', onsite: 'Investigación in situ / planeamiento', hide: 'Ocultar detalle de la puntuación', show: 'Ver puntuación por ámbito', categories: ['Catastro y límite jurídico', 'Terreno y modelo de elevación', 'Geología y aguas subterráneas', 'Infraestructura y acceso', 'Hidrología y riesgo de inundación', 'Planeamiento y valoración'], rationale: 'La puntuación refleja la disponibilidad y el estado de la evidencia en esta categoría.', summary: 'La puntuación se calcula únicamente a partir de la disponibilidad y el estado registrados de la evidencia.', robust: 'Evidencia sólida', moderate: 'Evidencia moderada', preliminary: 'Evidencia preliminar' },
  fi: { title: 'Näytön laatu ja luotettavuus', subtitle: 'Läpinäkyvä tietovarmuuden malli kuudella arviointialueella', quality: 'Laskettu laatu', low: 'Vahvistamaton oletus', regional: 'Alueellinen malli', direct: 'Suora kohdekohtainen näyttö', verified: 'Vahvistetut tiedot', official: 'Virallinen kiinteistörekisteri / korkeusmalli', modelled: 'Alueelliset mallit', geo: 'Geologia / hydrologia', requires: 'Vaatii tarkistuksen', onsite: 'Kohdetutkimus / kaavoitus', hide: 'Piilota pisteytyksen tiedot', show: 'Näytä pisteytys osa-alueittain', categories: ['Kiinteistörekisteri ja oikeudellinen raja', 'Maasto ja korkeusmalli', 'Geologia ja pohjavesi', 'Infrastruktuuri ja kulkuyhteys', 'Hydrologia ja tulvariski', 'Kaavoitus ja maan arvo'], rationale: 'Pisteytys kuvastaa tämän luokan näytön saatavuutta ja tilaa.', summary: 'Pisteytys lasketaan vain rekisteröidyn näytön saatavuuden ja tilan perusteella.', robust: 'Vahva näyttö', moderate: 'Kohtalainen näyttö', preliminary: 'Alustava näyttö' }
};

export const EvidenceScoreCard: React.FC<EvidenceScoreCardProps> = ({ score, language = 'en' }) => {
  const [expanded, setExpanded] = useState(false);

  if (!score) return null;

  const total = Number.isFinite(score.totalScore) ? Math.max(0, Math.min(100, score.totalScore)) : 0;
  const copy = coverageCopy(language);
  const barColor = 'bg-indigo-500';
  const b = score.breakdown;
  const t = copies[language] || copies.en;

  return (
    <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">{copy.coverage}</h3>

            </div>
            <p className="text-xs text-slate-500">{copy.note}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xl font-semibold text-slate-950 font-mono tracking-tight">{total}<span className="text-lg font-bold text-slate-400">/100</span></div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{copy.index}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 border border-slate-200/60">
          <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${total}%` }} />
        </div>
        <div className="flex justify-between text-[11px] font-semibold text-slate-400">
          <span>0</span><span>50</span><span>100</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 pt-1">
        <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <div><div className="text-xs font-bold text-emerald-950">{score.verifiedCount} {t.verified}</div><div className="text-[10px] text-emerald-700">{t.official}</div></div>
        </div>
        <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <div><div className="text-xs font-bold text-amber-950">{score.modelledCount} {t.modelled}</div><div className="text-[10px] text-amber-700">{t.geo}</div></div>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-slate-500 shrink-0" />
          <div><div className="text-xs font-bold text-slate-700">{score.unverifiedCount} {t.requires}</div><div className="text-[10px] text-slate-500">{t.onsite}</div></div>
        </div>
      </div>

      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium bg-slate-50 rounded-xl p-3.5 border border-slate-100">{t.summary}</p>

      <div className="pt-1">
        <button type="button" onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between py-2 text-xs font-bold text-indigo-700 hover:text-indigo-900 transition">
          <span>{expanded ? t.hide : t.show}</span>{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && b && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            {[
              b.cadastreAndGeometry,
              b.terrainAndElevation,
              b.geologyAndGroundwater,
              b.infrastructureAndAccess,
              b.environmentalAndFlood,
              b.planningAndMarket
            ].map((item, index) => (
              <div key={t.categories[index]} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                  <span>{t.categories[index]}</span>
                  <span className="font-mono text-indigo-700">{item.score} / {item.max} pts</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">{t.rationale}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
