import { CountryAdapterProfile } from '../adapters/countries';
import { EvidenceLevel, VerifiedSiteReport } from '../types';

export type ReportLanguage = 'en' | 'de' | 'pl';
export type AvailabilityReason = 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA' | 'PARAMETER_NOT_PROVIDED' | 'INSUFFICIENT_EVIDENCE' | 'NOT_SUPPORTED_FOR_COUNTRY' | 'AUTHORITATIVE_DATA_REQUIRED';
export type RiskClassification = 'NEGLIGIBLE' | 'LOW' | 'MODERATE' | 'HIGH' | null;

export interface CanonicalGeologyEvidence {
  unitName: string | null;
  lithology: string | null;
  geologicalAge: string | null;
  groundwaterRegime: string | null;
  status: EvidenceLevel;
  sourceName: string;
  sourceUrl: string;
  reasonCode?: AvailabilityReason;
}

export interface CanonicalReport {
  countryCode: string;
  countryName: string;
  authorities: {
    cadastre: string;
    geology: string;
    flood: string;
    planning: string;
    valuation: string;
  };
  geology: CanonicalGeologyEvidence;
  terrain: {
    elevationM: number | null;
    slopeDegrees: number | null;
    slopePercent: number | null;
    aspectCode: string | null;
    status: EvidenceLevel;
    reasonCode?: AvailabilityReason;
  };
  hazards: {
    landslide: { classification: RiskClassification; status: EvidenceLevel; sourceName: string };
    seismic: { classification: string | null; pga: string | null; status: EvidenceLevel; sourceName: string };
    radon: { classification: string | null; status: EvidenceLevel; sourceName: string; reasonCode?: AvailabilityReason };
    mining: { classification: string | null; status: EvidenceLevel; sourceName: string; reasonCode?: AvailabilityReason };
  };
  flood: { classification: RiskClassification; status: EvidenceLevel; distanceToWaterwayM: number | null; sourceName: string; reasonCode?: AvailabilityReason };
  soil: {
    texture: string | null;
    bearingCapacity: string | null;
    sandPct: number | null;
    siltPct: number | null;
    clayPct: number | null;
    ph: number | null;
    status: EvidenceLevel;
    sourceName: string;
    sourceUrl: string | null;
    reasonCode?: AvailabilityReason;
  };
  planning: { status: EvidenceLevel; instrumentName: string; authorityName: string; sourceName: string; reasonCode: AvailabilityReason };
  infrastructure: { roadName: string | null; roadType: string | null; distanceM: number | null; directAccess: boolean; status: EvidenceLevel; sourceName: string; reasonCode?: AvailabilityReason };
  utilities?: Array<{ utilityCode: 'ELECTRICITY' | 'WATER' | 'SEWER' | 'GAS' | 'TELECOM' | 'OTHER'; mapped: boolean; distanceM: number | null; status: EvidenceLevel; sourceName: string; reasonCode?: AvailabilityReason }>;
  environment: { protectedAreaName: string | null; distanceM: number | null; status: EvidenceLevel; sourceName: string; reasonCode?: AvailabilityReason };
  valuation: { min: number; max: number; median: number; currency: string; status: EvidenceLevel; comparableCount: number; sourceName: string };
  evidenceScore: VerifiedSiteReport['evidenceScore'];
  sourceRecords: VerifiedSiteReport['dataSourcesCited'];
  evidenceRecords: VerifiedSiteReport['evidenceRegistry'];
}

const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const scientific = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim() || /^(not available|not established|no mapped|unclassified)/i.test(value)) return null;
  return value;
};
const riskCode = (value: unknown): RiskClassification => {
  const normalized = String(value || '').toUpperCase();
  if (normalized.includes('NEGLIGIBLE')) return 'NEGLIGIBLE';
  if (normalized.includes('MODERATE')) return 'MODERATE';
  if (normalized.includes('HIGH')) return 'HIGH';
  if (normalized.includes('LOW')) return 'LOW';
  return null;
};

const evidenceReason = (report: VerifiedSiteReport, matcher: RegExp): AvailabilityReason | undefined => {
  const records = report.evidenceRegistry.filter(record => matcher.test(`${record.id} ${record.category}`));
  const reasons = records.map(record => (record.value as { reasonCode?: AvailabilityReason } | null)?.reasonCode).filter((reason): reason is AvailabilityReason => Boolean(reason));
  if (reasons.includes('MALFORMED_DATA')) return 'MALFORMED_DATA';
  if (reasons.includes('SOURCE_UNAVAILABLE')) return 'SOURCE_UNAVAILABLE';
  if (reasons.includes('NO_DATA')) return 'NO_DATA';
  return undefined;
};

/** Builds the immutable, language-neutral evidence snapshot used by every presentation. */
export function createCanonicalReport(report: VerifiedSiteReport, profile: CountryAdapterProfile): CanonicalReport {
  const context = (report as VerifiedSiteReport & { geosurvey_context?: Record<string, unknown> }).geosurvey_context || {};
  const terrainAvailable = finite(report.terrain.elevationAmsl) !== null && finite(report.terrain.averageSlopeDegrees) !== null;
  const soilAvailable = report.soil.status !== 'REQUIRES_VERIFICATION' && scientific(report.soil.usdaTextureClass) !== null;
  const geologyUnit = scientific(context.geological_unit_name) || scientific(report.soil.geologicalUnit);
  const soilTexture = scientific(report.soil.usdaTextureClass);
  return {
    countryCode: report.countryCode,
    countryName: profile.countryName,
    authorities: { cadastre: profile.cadastreAuthority, geology: profile.geologyAuthority, flood: profile.floodAuthority, planning: profile.planningInstrumentName, valuation: profile.valuationDataSource },
    geology: {
      unitName: geologyUnit,
      lithology: scientific(context.lithology_type) || scientific(report.soil.lithologyType),
      geologicalAge: scientific(context.geological_period_era) || scientific(report.soil.stratigraphicPeriod),
      groundwaterRegime: scientific(report.soil.groundwaterRegime),
      status: (context.evidence_level as EvidenceLevel) || report.soil.status,
      sourceName: profile.geologyAuthority,
      sourceUrl: profile.geologyPortalUrl,
      reasonCode: geologyUnit ? undefined : evidenceReason(report, /pgi-(?:smgp|mgp|mlp|engineering)|geolog/i) || 'SOURCE_UNAVAILABLE'
    },
    terrain: { elevationM: finite(report.terrain.elevationAmsl), slopeDegrees: finite(report.terrain.averageSlopeDegrees), slopePercent: finite(report.terrain.averageSlopePercent), aspectCode: scientific(report.terrain.aspectDirection), status: terrainAvailable ? 'MODELLED' : 'REQUIRES_VERIFICATION', reasonCode: terrainAvailable ? undefined : 'SOURCE_UNAVAILABLE' },
    hazards: {
      landslide: { classification: riskCode(report.terrain.geohazards.landslideSusceptibility.level), status: report.terrain.geohazards.landslideSusceptibility.status, sourceName: report.terrain.geohazards.landslideSusceptibility.sourceName },
      seismic: { classification: scientific(report.terrain.geohazards.seismicRisk.zone), pga: scientific(report.terrain.geohazards.seismicRisk.pgaG), status: report.terrain.geohazards.seismicRisk.status, sourceName: report.terrain.geohazards.seismicRisk.sourceName },
      radon: { classification: scientific(report.terrain.geohazards.radonPotential.classification), status: report.terrain.geohazards.radonPotential.status, sourceName: report.terrain.geohazards.radonPotential.sourceName, reasonCode: scientific(report.terrain.geohazards.radonPotential.classification) ? undefined : 'NOT_SUPPORTED_FOR_COUNTRY' },
      mining: { classification: scientific(report.terrain.geohazards.miningSubsidence.classification), status: report.terrain.geohazards.miningSubsidence.status, sourceName: report.terrain.geohazards.miningSubsidence.sourceName, reasonCode: scientific(report.terrain.geohazards.miningSubsidence.classification) ? undefined : 'NOT_SUPPORTED_FOR_COUNTRY' }
    },
    flood: { classification: riskCode(report.terrain.floodInundationRisk.level), status: report.terrain.floodInundationRisk.status, distanceToWaterwayM: finite(report.terrain.floodInundationRisk.distanceToWaterwayM), sourceName: report.terrain.floodInundationRisk.sourceName, reasonCode: riskCode(report.terrain.floodInundationRisk.level) ? undefined : 'SOURCE_UNAVAILABLE' },
    soil: { texture: soilTexture, bearingCapacity: null, sandPct: finite(report.soil.topsoilSandPct), siltPct: finite(report.soil.topsoilSiltPct), clayPct: finite(report.soil.topsoilClayPct), ph: finite(report.soil.meanPhH2O), status: report.soil.status, sourceName: report.soil.sourceName, sourceUrl: report.soil.sourceUrl || null, reasonCode: soilAvailable ? undefined : evidenceReason(report, /soilgrids|soil/i) || 'SOURCE_UNAVAILABLE' },
    planning: { status: report.planning.status, instrumentName: profile.planningInstrumentName, authorityName: report.planning.authorityName, sourceName: report.planning.sourceName, reasonCode: 'AUTHORITATIVE_DATA_REQUIRED' },
    infrastructure: { roadName: scientific(report.infrastructure.roadAccess.nearestRoadName), roadType: scientific(report.infrastructure.roadAccess.nearestRoadType), distanceM: finite(report.infrastructure.roadAccess.estimatedDistanceM), directAccess: report.infrastructure.roadAccess.directAccessVerified, status: report.infrastructure.roadAccess.status, sourceName: report.infrastructure.roadAccess.sourceName, reasonCode: finite(report.infrastructure.roadAccess.estimatedDistanceM) === null ? 'SOURCE_UNAVAILABLE' : undefined },
    utilities: report.infrastructure.utilities.map(item => ({
      utilityCode: /electric|power/i.test(item.utility) ? 'ELECTRICITY' : /water/i.test(item.utility) ? 'WATER' : /sewer/i.test(item.utility) ? 'SEWER' : /gas/i.test(item.utility) ? 'GAS' : /telecom|broadband/i.test(item.utility) ? 'TELECOM' : 'OTHER',
      mapped: item.mappedInDataset,
      distanceM: finite(item.distanceM),
      status: item.status,
      sourceName: item.sourceName,
      reasonCode: item.mappedInDataset ? undefined : 'AUTHORITATIVE_DATA_REQUIRED'
    })),
    environment: { protectedAreaName: scientific(report.environment.nearestProtectedAreaName), distanceM: finite(report.environment.distanceToNatura2000M), status: report.environment.status, sourceName: report.environment.sourceName, reasonCode: report.environment.status === 'REQUIRES_VERIFICATION' ? 'SOURCE_UNAVAILABLE' : undefined },
    valuation: { min: report.valuation.indicativeMinPrice, max: report.valuation.indicativeMaxPrice, median: report.valuation.indicativeMedianPrice, currency: report.valuation.currency, status: report.valuation.status, comparableCount: report.valuation.comparableEvidenceCount, sourceName: profile.valuationDataSource },
    evidenceScore: report.evidenceScore,
    sourceRecords: report.dataSourcesCited,
    evidenceRecords: report.evidenceRegistry
  };
}

export function normalizeReportLanguage(language: string): ReportLanguage {
  return language === 'pl' || language === 'de' ? language : 'en';
}
