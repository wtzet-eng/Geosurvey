import type { EvidenceItem, VerifiedSiteReport } from '../types';
import type { CanonicalReport, RiskClassification } from './canonicalReport';

const LOCALISED_CONTEXT_IDS = new Set([
  'pgi-mgsp-building-ground-site', 'pgi-mgsp-building-ground-unavailable',
  'pgi-smgp-documentation-points-context', 'pgi-smgp-documentation-points-unavailable',
  'pgi-cbdg-research-points-context', 'pgi-cbdg-research-points-unavailable'
]);

function risk(value: unknown): RiskClassification {
  const normalized = String(value || '').toUpperCase();
  if (normalized.includes('NEGLIGIBLE')) return 'NEGLIGIBLE';
  if (normalized.includes('MODERATE') || normalized.includes('MEDIUM')) return 'MODERATE';
  if (normalized.includes('HIGH')) return 'HIGH';
  if (normalized.includes('LOW')) return 'LOW';
  return null;
}

/**
 * Country support notices and the three Polish site-context records have deliberate
 * localized prose. All other evidence keeps its source-specific scientific claim,
 * spatial relationship, ingestion method and limitation instead of being replaced
 * by generic presentation boilerplate.
 */
export function buildEvidenceDisplayRecords(canonicalRecords: EvidenceItem[], localizedRecords: EvidenceItem[]): EvidenceItem[] {
  const localizedById = new Map(localizedRecords.map(record => [record.id, record]));
  return canonicalRecords.map(record => {
    const localized = localizedById.get(record.id);
    if (!localized) return record;
    if (record.id.startsWith('country-support-') || LOCALISED_CONTEXT_IDS.has(record.id)) return localized;
    return {
      ...localized,
      category: record.category,
      claim: record.claim,
      sourceName: record.sourceName,
      sourceUrl: record.sourceUrl,
      datasetDate: record.datasetDate,
      spatialRelationship: record.spatialRelationship,
      calculationMethod: record.calculationMethod,
      limitation: record.limitation,
      value: record.value
    };
  });
}

function valuationRecord(canonical: CanonicalReport): EvidenceItem | null {
  const modelled = canonical.evidenceRecords.filter(record => record.status === 'MODELLED' && /valuation|land market|market valuation/i.test(`${record.id} ${record.category}`));
  return modelled.find(record => record.sourceName === canonical.valuation.sourceName)
    || modelled.find(record => record.id !== 'valuation-indicative-model')
    || modelled[0]
    || null;
}

/** Promote the actual country benchmark provenance into the main Market section. */
export function enrichValuationPresentation(canonical: CanonicalReport, presentation: any): void {
  if (canonical.valuation.min === null || canonical.valuation.max === null) return;
  const record = valuationRecord(canonical);
  if (!record || !presentation?.sections?.market_and_comparables) return;
  presentation.sections.market_and_comparables.detail = [record.claim, record.calculationMethod, record.limitation].filter(Boolean).join(' ');
  presentation.sections.market_and_comparables.source_cited = `${record.sourceName}${record.datasetDate ? ` · ${record.datasetDate}` : ''}`;
  presentation.valuationMethodology = record.calculationMethod || presentation.valuationMethodology;
}

function appendRecord(records: EvidenceItem[], raw: EvidenceItem | undefined): EvidenceItem[] {
  if (!raw || records.some(record => record.id === raw.id)) return records;
  return [...records, raw];
}

/**
 * GB capability flags remain UK-wide and conservative. This narrowly promotes
 * verified England-only flood evidence and verified BGS mining screening for the
 * selected coordinate without claiming equivalent national coverage in Scotland,
 * Wales or Northern Ireland.
 */
export function applySiteSpecificCountryEvidence(canonical: CanonicalReport, rawReport: VerifiedSiteReport): CanonicalReport {
  if (canonical.countryCode !== 'GB') return canonical;
  const flood = rawReport.evidenceRegistry.find(record => record.id === 'uk-ea-flood-site' && record.status === 'VERIFIED');
  const mining = rawReport.evidenceRegistry.find(record => record.id === 'uk-geosure-non-coal-mining' && record.status === 'VERIFIED');
  if (!flood && !mining) return canonical;

  let evidenceRecords = [...canonical.evidenceRecords];
  let nextFlood = canonical.flood;
  let nextMining = canonical.hazards.mining;

  if (flood) {
    const raw = (flood.value || {}) as Record<string, unknown>;
    const classification = risk(raw.level);
    if (classification) {
      nextFlood = {
        ...canonical.flood,
        classification,
        status: 'VERIFIED',
        sourceName: flood.sourceName,
        reasonCode: undefined
      };
    }
    evidenceRecords = appendRecord(evidenceRecords, flood);
  }

  if (mining) {
    const raw = (mining.value || {}) as Record<string, unknown>;
    const classification = typeof raw.rating === 'string' && raw.rating.trim() ? raw.rating.trim() : 'Mapped BGS mining-hazard context';
    nextMining = { classification, status: 'VERIFIED', sourceName: mining.sourceName };
    evidenceRecords = appendRecord(evidenceRecords, mining);
  }

  return {
    ...canonical,
    flood: nextFlood,
    hazards: { ...canonical.hazards, mining: nextMining },
    evidenceRecords
  };
}
