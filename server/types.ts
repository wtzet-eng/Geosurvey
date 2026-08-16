export type EvidenceLevel = 'VERIFIED' | 'MODELLED' | 'REQUIRES_VERIFICATION';

export interface EvidenceItem {
  id: string;
  category: string;
  claim: string;
  status: EvidenceLevel;
  sourceName: string;
  sourceUrl?: string;
  datasetDate: string;
  spatialRelationship: string; // e.g., "Direct official parcel geometry (0 m)", "ISRIC 250m Spatial Model"
  calculationMethod: string; // e.g., "GUGiK ULDK spatial vector intersection", "Copernicus 9-point DEM Horn filter"
  confidence: 'High' | 'Medium' | 'Low';
  limitation: string;
  value?: any;
}

export interface CadastralParcelInfo {
  status: EvidenceLevel;
  parcelId?: string;
  teryt?: string;
  commune?: string;
  county?: string;
  voivodeship?: string;
  region?: string;
  countryCode: string;
  geometryWkt?: string;
  geometryPoints?: [number, number][]; // [lat, lng] array of official parcel boundary
  isOfficialGeometry: boolean;
  areaCalculatedM2: number;
  officialAreaM2?: number;
  cadastralSource: string;
  datasetDate: string;
  limitation: string;
}

export interface TerrainAnalysis {
  elevationAmsl: number; // m above sea level
  minElevationAmsl: number;
  maxElevationAmsl: number;
  elevationDifferenceM: number;
  averageSlopePercent: number; // %
  averageSlopeDegrees: number; // °
  slopeCategory: 'Flat (0-2°)' | 'Gentle (2-5°)' | 'Moderate (5-10°)' | 'Steep (10-20°)' | 'Very Steep (>20°)';
  aspectDirection: string; // e.g., "South-Facing (180°)"
  floodInundationRisk: {
    status: EvidenceLevel;
    level: 'Negligible' | 'Low' | 'Moderate' | 'High' | 'Proximity Indicator Only';
    distanceToWaterwayM?: number;
    waterwayName?: string;
    waterwayType?: string;
    statutoryZoneStatus: string;
    description: string;
    sourceName: string;
    limitation: string;
  };
  geohazards: {
    landslideSusceptibility: {
      status: EvidenceLevel;
      level: 'Negligible' | 'Low' | 'Moderate' | 'High';
      description: string;
      sourceName: string;
    };
    seismicRisk: {
      status: EvidenceLevel;
      zone: string;
      pgaG: string;
      sourceName: string;
    };
    radonPotential: {
      status: EvidenceLevel;
      classification: string;
      sourceName: string;
    };
    miningSubsidence: {
      status: EvidenceLevel;
      classification: string;
      sourceName: string;
    };
  };
}

export interface SoilAnalysis {
  status: EvidenceLevel;
  geologicalUnit: string;
  lithologyType: string;
  stratigraphicPeriod: string;
  usdaTextureClass: string;
  topsoilSandPct: number;
  topsoilSiltPct: number;
  topsoilClayPct: number;
  subsoilSandPct: number;
  subsoilSiltPct: number;
  subsoilClayPct: number;
  meanBulkDensityGcm3: number;
  meanPhH2O: number;
  meanOrganicCarbonPct: number;
  estimatedWaterTableDepthM: string;
  groundwaterNotice: string;
  estimatedBearingCapacityKpa: string;
  effectiveFrictionAngleDeg: number;
  cohesionKpa: number;
  hydraulicConductivityMs: string;
  drainageClass: string;
  frostSusceptibilityClass: string;
  topsoilStrippingDepthCm: number;
  groundwaterRegime: string;
  isMeasuredBoreholeData: boolean;
  boreholeId?: string;
  sourceName: string;
  sourceUrl?: string;
  datasetVersion: string;
  limitation: string;
  stratigraphyLayers: {
    depthRange: string;
    soilType: string;
    mechanicalStatus: string;
    description: string;
    sandPct?: number;
    siltPct?: number;
    clayPct?: number;
    bulkDensity?: number;
    ph?: number;
    soc?: number;
  }[];
}

export interface PlanningZoningAnalysis {
  status: EvidenceLevel;
  hasLocalPlan: boolean | 'Unknown / Requires Municipal Confirmation';
  planDesignation?: string;
  permittedUseCategory: string;
  maxFar: string;
  maxCoveragePct: string;
  minBiologicallyActivePct: string;
  maxBuildingHeightM: string;
  setbackRules: string;
  authorityName: string;
  documentRequired: string;
  sourceName: string;
  limitation: string;
}

export interface AmenityItem {
  type: string;
  name: string;
  distanceM: number;
  category: 'transit' | 'education' | 'daily_needs' | 'healthcare' | 'civic';
}

export interface InfrastructureAnalysis {
  roadAccess: {
    status: EvidenceLevel;
    nearestRoadType: string;
    nearestRoadName?: string;
    estimatedDistanceM: number;
    directAccessVerified: boolean;
    isPaved: boolean;
    surface?: string;
    maxSpeed?: string;
    lit?: boolean;
    sidewalk?: string;
    sourceName: string;
  };
  utilities: {
    utility: string;
    status: EvidenceLevel;
    availability: string;
    distanceM?: number;
    mappedInDataset: boolean;
    sourceName: string;
    limitation: string;
  }[];
  amenities: AmenityItem[];
  surroundingBuildingsCount: number;
  surroundingLanduse: string[];
}

export interface EnvironmentalAnalysis {
  natura2000Intersect: boolean;
  distanceToNatura2000M: number;
  nearestProtectedAreaName?: string;
  protectedAreaType?: string;
  landscapeParkOverlay: boolean;
  waterProtectionZone: boolean;
  status: EvidenceLevel;
  sourceName: string;
  limitation: string;
}

export interface ValuationAssessment {
  status: EvidenceLevel;
  indicativeMinPrice: number;
  indicativeMaxPrice: number;
  indicativeMedianPrice: number;
  indicativePricePerSqm: number;
  currency: string;
  methodology: string;
  comparableEvidenceCount: number;
  marketTrendDescription: string;
  priceDrivers: { factor: string; impact: string; weight: string }[];
  uncertaintyRating: 'High' | 'Moderate' | 'Low';
  disclaimer: string;
}

export interface EvidenceQualityScore {
  totalScore: number; // 0 - 100
  ratingClass: 'Robust Evidence (75-100)' | 'Moderate Evidence (50-74)' | 'Preliminary / Low Evidence (<50)';
  breakdown: {
    cadastreAndGeometry: { score: number; max: 20; rationale: string };
    terrainAndElevation: { score: number; max: 20; rationale: string };
    geologyAndGroundwater: { score: number; max: 20; rationale: string };
    infrastructureAndAccess: { score: number; max: 15; rationale: string };
    environmentalAndFlood: { score: number; max: 15; rationale: string };
    planningAndMarket: { score: number; max: 10; rationale: string };
  };
  verifiedCount: number;
  modelledCount: number;
  unverifiedCount: number;
  cappingApplied?: string;
  summaryExplanation: string;
}

export interface VerificationRequirement {
  topic: string;
  reason: string;
  recommendedAuthorityOrExpert: string;
  priority: 'High' | 'Medium' | 'Standard';
}

export interface VerifiedSiteReport {
  id: string;
  generatedAt: string;
  countryCode: string;
  language: string;
  parcel: CadastralParcelInfo;
  terrain: TerrainAnalysis;
  soil: SoilAnalysis;
  planning: PlanningZoningAnalysis;
  infrastructure: InfrastructureAnalysis;
  environment: EnvironmentalAnalysis;
  valuation: ValuationAssessment;
  evidenceScore: EvidenceQualityScore;
  evidenceRegistry: EvidenceItem[];
  verificationChecklist: VerificationRequirement[];
  executiveSummary: string;
  dataSourcesCited: {
    name: string;
    organization: string;
    url: string;
    type: 'Official National Cadastre' | 'Geological Survey' | 'Elevation DEM' | 'Hydrological Registry' | 'Spatial Overpass' | 'Statistical Market Benchmark' | 'Scientific Soil Database';
    status: EvidenceLevel;
  }[];
  statutoryDisclaimers: string[];
}
