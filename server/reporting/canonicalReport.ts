import { CountryAdapterProfile } from '../adapters/countries';
import { EvidenceItem, EvidenceLevel, VerifiedSiteReport } from '../types';
import { CountrySupportProfile, getCountrySupport } from '../../src/data/countrySupport';
import { GroundContextSummary, PedologicalVariabilitySummary } from '../services/groundContextService';

export type ReportLanguage = 'en' | 'de' | 'pl';
export type AvailabilityReason = 'NO_DATA' | 'SOURCE_UNAVAILABLE' | 'MALFORMED_DATA' | 'PARAMETER_NOT_PROVIDED' | 'INSUFFICIENT_EVIDENCE' | 'NOT_SUPPORTED_FOR_COUNTRY' | 'AUTHORITATIVE_DATA_REQUIRED';
export type RiskClassification = 'NEGLIGIBLE' | 'LOW' | 'MODERATE' | 'HIGH' | null;

type RawBreakdown = VerifiedSiteReport['evidenceScore']['breakdown'];
export type CanonicalEvidenceScore = Omit<VerifiedSiteReport['evidenceScore'], 'breakdown'> & {
  breakdown: { [K in keyof RawBreakdown]: { score: number; max: number; rationale: string } };
};

export interface CanonicalGeologyEvidence {
  unitName: string | null;
  lithology: string | null;
  geologicalAge: string | null;
  geneticOrigin?: string | null;
  groundwaterRegime: string | null;
  status: EvidenceLevel;
  sourceName: string;
  sourceUrl: string;
  reasonCode?: AvailabilityReason;
}

export interface CanonicalGroundContext {
  mapped: GroundContextSummary | null;
  soilVariability: PedologicalVariabilitySummary | null;
  status: EvidenceLevel;
  reasonCode?: AvailabilityReason;
}

export interface CanonicalReport {
  countryCode: string;
  countryName: string;
  support: CountrySupportProfile;
  authorities: {
    cadastre: string;
    geology: string;
    flood: string;
    planning: string;
    valuation: string;
  };
  geology: CanonicalGeologyEvidence;
  groundContext?: CanonicalGroundContext;
  terrain: {
    elevationM: number | null;
    minElevationM?: number | null;
    maxElevationM?: number | null;
    localReliefM?: number | null;
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
  valuation: { min: number | null; max: number | null; median: number | null; currency: string; status: EvidenceLevel; comparableCount: number; sourceName: string; reasonCode?: AvailabilityReason };
  evidenceScore: CanonicalEvidenceScore;
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

const hasModelledValuation = (report: VerifiedSiteReport, support: CountrySupportProfile): boolean =>
  support.maturity === 'SUPPORTED'
  && report.valuation?.status === 'MODELLED'
  && finite(report.valuation.indicativeMinPrice) !== null
  && finite(report.valuation.indicativeMaxPrice) !== null;

function supportRecord(id: string, claim: string, sourceName: string, sourceUrl?: string): EvidenceItem {
  return {
    id,
    category: 'Country support & verification',
    claim,
    status: 'REQUIRES_VERIFICATION',
    sourceName,
    sourceUrl,
    datasetDate: new Date().toISOString().slice(0, 10),
    spatialRelationship: 'Selected country capability',
    calculationMethod: 'Country-support capability gate; no national source query executed',
    confidence: 'High',
    limitation: 'This is a capability statement, not evidence that the underlying feature, condition, right or hazard is absent.',
    value: { reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' satisfies AvailabilityReason }
  };
}

function visibleEvidenceRecords(report: VerifiedSiteReport, profile: CountryAdapterProfile, support: CountrySupportProfile): EvidenceItem[] {
  const c = support.capabilities;
  const modelledValuationAvailable = hasModelledValuation(report, support);
  const filtered = report.evidenceRegistry.flatMap(record => {
    const text = `${record.id} ${record.category}`.toLowerCase();
    if (!c.nationalCadastre && /cadastre|cadastr|parcel/.test(text)) return [];
    if (!c.nationalPlanning && /planning|zoning|mpzp|bebau/.test(text)) return [];
    if (!c.nationalValuation && /valuation|market valuation|econom/.test(text) && !(modelledValuationAvailable && record.id === 'valuation-indicative-model')) return [];
    if (!c.nationalRadon && /radon/.test(text)) return [];
    if (!c.nationalMining && /mining|mine|górnic|gornic/.test(text)) return [];
    if (!c.nationalGeology && !/soilgrids|soil/.test(text) && /geolog|lithogen|borehole|hydrogeolog/.test(text)) return [];
    if (modelledValuationAvailable && record.id === 'valuation-indicative-model') {
      return [{
        ...record,
        sourceName: 'GeoSurvey indicative valuation model',
        sourceUrl: undefined,
        limitation: 'Indicative model only. No direct comparable deeds or live national valuation records were queried; an authoritative valuation requires appropriate market evidence and a qualified valuer.'
      }];
    }
    if (record.id === 'flood-proximity-check' && !c.nationalFlood) {
      return [{
        ...record,
        category: 'Cross-border hydrology context',
        sourceName: 'OpenStreetMap hydrology',
        sourceUrl: 'https://www.openstreetmap.org/',
        limitation: 'OpenStreetMap water-feature proximity is contextual screening only. No national statutory flood dataset was queried.'
      }];
    }
    return [record];
  });

  const notices: EvidenceItem[] = [];
  if (!c.nationalCadastre) notices.push(supportRecord('country-support-cadastre', 'Automated national cadastre acquisition is not implemented for this country.', profile.cadastreAuthority, profile.cadastrePortalUrl));
  if (!c.nationalGeology || !c.nationalBoreholes || !c.nationalHydrogeology) notices.push(supportRecord('country-support-geoscience', 'One or more national geology, borehole or hydrogeology integrations are not implemented for this country.', profile.geologyAuthority, profile.geologyPortalUrl));
  if (!c.nationalFlood || !c.nationalRadon || !c.nationalMining) notices.push(supportRecord('country-support-hazards', 'One or more national flood, radon or mining-hazard integrations are not implemented for this country.', profile.floodAuthority, profile.floodPortalUrl));
  if (!c.nationalPlanning) notices.push(supportRecord('country-support-planning', 'Automated binding planning acquisition is not implemented; the named planning instrument is verification guidance only.', profile.planningInstrumentName));
  if (!c.nationalValuation && !modelledValuationAvailable) notices.push(supportRecord('country-support-valuation', 'No implemented national transaction or valuation acquisition supports an automated site value conclusion.', profile.valuationDataSource));
  return [...filtered, ...notices];
}

function visibleSourceRecords(report: VerifiedSiteReport, support: CountrySupportProfile): VerifiedSiteReport['dataSourcesCited'] {
  const c = support.capabilities;
  return report.dataSourcesCited.filter(source => {
    if (source.type === 'Official National Cadastre') return c.nationalCadastre;
    if (source.type === 'Geological Survey') return c.nationalGeology;
    if (source.type === 'Hydrological Registry') return c.nationalFlood;
    if (source.type === 'Statistical Market Benchmark') return c.nationalValuation;
    return true;
  });
}

function supportAwareEvidenceScore(report: VerifiedSiteReport, support: CountrySupportProfile, evidenceRecords: EvidenceItem[], geologyVerified: boolean): CanonicalEvidenceScore {
  const raw = report.evidenceScore.breakdown;
  const c = support.capabilities;
  const breakdown: CanonicalEvidenceScore['breakdown'] = {
    cadastreAndGeometry: c.nationalCadastre
      ? { ...raw.cadastreAndGeometry, max: 20 }
      : { score: 0, max: 0, rationale: 'National cadastral acquisition is outside current automated coverage for this country and is excluded from the score denominator.' },
    terrainAndElevation: { ...raw.terrainAndElevation, max: 20 },
    geologyAndGroundwater: { ...raw.geologyAndGroundwater, score: geologyVerified ? Math.max(raw.geologyAndGroundwater.score, 18) : raw.geologyAndGroundwater.score, max: 20 },
    infrastructureAndAccess: { ...raw.infrastructureAndAccess, max: 15 },
    environmentalAndFlood: { ...raw.environmentalAndFlood, max: 15, rationale: c.nationalFlood ? raw.environmentalAndFlood.rationale : 'Cross-border environmental and hydrology context only; unsupported national flood mapping is excluded from the evidence claim.' },
    planningAndMarket: c.nationalPlanning || c.nationalValuation
      ? { ...raw.planningAndMarket, max: 10 }
      : { score: 0, max: 0, rationale: hasModelledValuation(report, support)
        ? 'National planning and valuation acquisition are outside current automated coverage. The indicative valuation model may be shown separately but is not scored as national evidence.'
        : 'Planning and valuation are outside current automated national coverage and are excluded from the score denominator.' }
  };
  const entries = Object.values(breakdown);
  const earned = entries.reduce((sum, item) => sum + item.score, 0);
  const applicableMax = entries.reduce((sum, item) => sum + item.max, 0);
  let totalScore = applicableMax > 0 ? Math.round((earned / applicableMax) * 100) : 0;
  let cappingApplied: string | undefined;
  if (c.nationalCadastre && report.evidenceScore.cappingApplied && totalScore > 65) {
    totalScore = 65;
    cappingApplied = report.evidenceScore.cappingApplied;
  }
  const ratingClass: CanonicalEvidenceScore['ratingClass'] = totalScore >= 75 ? 'Robust Evidence (75-100)' : totalScore >= 50 ? 'Moderate Evidence (50-74)' : 'Preliminary / Low Evidence (<50)';
  const verifiedCount = evidenceRecords.filter(record => record.status === 'VERIFIED').length;
  const modelledCount = evidenceRecords.filter(record => record.status === 'MODELLED').length;
  const unverifiedCount = evidenceRecords.filter(record => record.status === 'REQUIRES_VERIFICATION').length;
  return {
    totalScore,
    ratingClass,
    cappingApplied,
    breakdown,
    verifiedCount,
    modelledCount,
    unverifiedCount,
    summaryExplanation: `Coverage-adjusted score: ${earned}/${applicableMax} applicable evidence points, normalized to ${totalScore}/100. Unsupported national capabilities are excluded from the denominator rather than treated as failed evidence.`
  };
}

/** Builds the immutable, language-neutral evidence snapshot used by every presentation. */
export function createCanonicalReport(report: VerifiedSiteReport, profile: CountryAdapterProfile): CanonicalReport {
  const support = getCountrySupport(report.countryCode);
  const c = support.capabilities;
  const modelledValuationAvailable = hasModelledValuation(report, support);
  const extended = report as VerifiedSiteReport & {
    geosurvey_context?: Record<string, unknown>;
    ground_context?: GroundContextSummary;
    soil_variability?: PedologicalVariabilitySummary;
  };
  const context = extended.geosurvey_context || {};
  const mappedContext = extended.ground_context?.sampleCount ? extended.ground_context : null;
  const soilVariability = extended.soil_variability?.validSampleCount ? extended.soil_variability : null;
  const hasSpatialContext = Boolean((mappedContext && mappedContext.sampleCount >= 2) || (soilVariability && soilVariability.validSampleCount >= 2));
  const terrainAvailable = finite(report.terrain.elevationAmsl) !== null && finite(report.terrain.averageSlopeDegrees) !== null;
  const soilAvailable = report.soil.status !== 'REQUIRES_VERIFICATION' && scientific(report.soil.usdaTextureClass) !== null;
  const rawGeologyUnit = scientific(context.geological_unit_name) || scientific(report.soil.geologicalUnit);
  const geologyUnit = c.nationalGeology ? rawGeologyUnit : null;
  const geologyStatus: EvidenceLevel = c.nationalGeology ? ((context.evidence_level as EvidenceLevel) || report.soil.status) : 'REQUIRES_VERIFICATION';
  const geologyReason: AvailabilityReason | undefined = c.nationalGeology ? (geologyUnit ? undefined : evidenceReason(report, /pgi-(?:smgp|mgp|mlp|engineering)|bgs|geolog/i) || 'SOURCE_UNAVAILABLE') : 'NOT_SUPPORTED_FOR_COUNTRY';
  const soilTexture = scientific(report.soil.usdaTextureClass);
  const records = visibleEvidenceRecords(report, profile, support);
  const score = supportAwareEvidenceScore(report, support, records, Boolean(geologyUnit && geologyStatus === 'VERIFIED'));
  return {
    countryCode: report.countryCode,
    countryName: profile.countryName,
    support,
    authorities: { cadastre: profile.cadastreAuthority, geology: profile.geologyAuthority, flood: profile.floodAuthority, planning: profile.planningInstrumentName, valuation: profile.valuationDataSource },
    geology: {
      unitName: geologyUnit,
      lithology: c.nationalGeology ? scientific(context.lithology_type) || scientific(report.soil.lithologyType) : null,
      geologicalAge: c.nationalGeology ? scientific(context.geological_period_era) || scientific(report.soil.stratigraphicPeriod) : null,
      geneticOrigin: c.nationalGeology ? scientific(context.genetic_origin) : null,
      groundwaterRegime: c.nationalHydrogeology ? scientific(report.soil.groundwaterRegime) : null,
      status: geologyStatus,
      sourceName: profile.geologyAuthority,
      sourceUrl: profile.geologyPortalUrl,
      reasonCode: geologyReason
    },
    groundContext: mappedContext || soilVariability ? {
      mapped: mappedContext,
      soilVariability,
      status: hasSpatialContext ? 'MODELLED' : 'REQUIRES_VERIFICATION',
      reasonCode: hasSpatialContext ? undefined : 'INSUFFICIENT_EVIDENCE'
    } : undefined,
    terrain: {
      elevationM: finite(report.terrain.elevationAmsl),
      minElevationM: finite(report.terrain.minElevationAmsl),
      maxElevationM: finite(report.terrain.maxElevationAmsl),
      localReliefM: finite(report.terrain.elevationDifferenceM),
      slopeDegrees: finite(report.terrain.averageSlopeDegrees),
      slopePercent: finite(report.terrain.averageSlopePercent),
      aspectCode: scientific(report.terrain.aspectDirection),
      status: terrainAvailable ? 'MODELLED' : 'REQUIRES_VERIFICATION',
      reasonCode: terrainAvailable ? undefined : 'SOURCE_UNAVAILABLE'
    },
    hazards: {
      landslide: { classification: riskCode(report.terrain.geohazards.landslideSusceptibility.level), status: report.terrain.geohazards.landslideSusceptibility.status, sourceName: report.terrain.geohazards.landslideSusceptibility.sourceName },
      seismic: { classification: scientific(report.terrain.geohazards.seismicRisk.zone), pga: scientific(report.terrain.geohazards.seismicRisk.pgaG), status: report.terrain.geohazards.seismicRisk.status, sourceName: report.terrain.geohazards.seismicRisk.sourceName },
      radon: c.nationalRadon ? { classification: scientific(report.terrain.geohazards.radonPotential.classification), status: report.terrain.geohazards.radonPotential.status, sourceName: report.terrain.geohazards.radonPotential.sourceName } : { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: report.terrain.geohazards.radonPotential.sourceName, reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
      mining: c.nationalMining ? { classification: scientific(report.terrain.geohazards.miningSubsidence.classification), status: report.terrain.geohazards.miningSubsidence.status, sourceName: report.terrain.geohazards.miningSubsidence.sourceName } : { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: report.terrain.geohazards.miningSubsidence.sourceName, reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' }
    },
    flood: c.nationalFlood
      ? { classification: riskCode(report.terrain.floodInundationRisk.level), status: report.terrain.floodInundationRisk.status, distanceToWaterwayM: finite(report.terrain.floodInundationRisk.distanceToWaterwayM), sourceName: report.terrain.floodInundationRisk.sourceName, reasonCode: riskCode(report.terrain.floodInundationRisk.level) ? undefined : 'SOURCE_UNAVAILABLE' }
      : { classification: null, status: 'REQUIRES_VERIFICATION', distanceToWaterwayM: finite(report.terrain.floodInundationRisk.distanceToWaterwayM), sourceName: profile.floodAuthority, reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    soil: { texture: soilTexture, bearingCapacity: null, sandPct: finite(report.soil.topsoilSandPct), siltPct: finite(report.soil.topsoilSiltPct), clayPct: finite(report.soil.topsoilClayPct), ph: finite(report.soil.meanPhH2O), status: report.soil.status, sourceName: report.soil.sourceName, sourceUrl: report.soil.sourceUrl || null, reasonCode: soilAvailable ? undefined : evidenceReason(report, /soilgrids|soil/i) || 'SOURCE_UNAVAILABLE' },
    planning: { status: 'REQUIRES_VERIFICATION', instrumentName: profile.planningInstrumentName, authorityName: report.planning.authorityName, sourceName: report.planning.sourceName, reasonCode: c.nationalPlanning ? 'AUTHORITATIVE_DATA_REQUIRED' : 'NOT_SUPPORTED_FOR_COUNTRY' },
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
    valuation: c.nationalValuation
      ? { min: finite(report.valuation.indicativeMinPrice), max: finite(report.valuation.indicativeMaxPrice), median: finite(report.valuation.indicativeMedianPrice), currency: report.valuation.currency, status: report.valuation.status, comparableCount: report.valuation.comparableEvidenceCount, sourceName: profile.valuationDataSource }
      : modelledValuationAvailable
      ? { min: finite(report.valuation.indicativeMinPrice), max: finite(report.valuation.indicativeMaxPrice), median: finite(report.valuation.indicativeMedianPrice), currency: report.valuation.currency || profile.currency, status: 'MODELLED', comparableCount: report.valuation.comparableEvidenceCount, sourceName: 'GeoSurvey indicative valuation model' }
      : { min: null, max: null, median: null, currency: report.valuation.currency || profile.currency, status: 'REQUIRES_VERIFICATION', comparableCount: 0, sourceName: profile.valuationDataSource, reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    evidenceScore: score,
    sourceRecords: visibleSourceRecords(report, support),
    evidenceRecords: records
  };
}

export function normalizeReportLanguage(language: string): ReportLanguage {
  return language === 'pl' || language === 'de' ? language : 'en';
}