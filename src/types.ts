export type BoundaryType = 'circle' | 'rectangle' | 'polygon';

export interface BoundaryShape {
  type: BoundaryType;
  center?: [number, number];
  radius?: number; // in meters
  corners?: [number, number][];
  points?: [number, number][];
}

export interface Country {
  code: string;
  name: string;
  language: string;
  currency: string;
  defaultCenter: [number, number];
  defaultZoom?: number;
}

export interface ReportLanguage {
  code: string;
  label: string;
}

export type EvidenceLevel = 'VERIFIED' | 'MODELLED' | 'REQUIRES_VERIFICATION';

export interface EvidenceItem {
  id: string;
  category: string;
  claim: string;
  status: EvidenceLevel;
  sourceName: string;
  sourceUrl?: string;
  datasetDate: string;
  spatialRelationship: string;
  calculationMethod: string;
  confidence: 'High' | 'Medium' | 'Low';
  limitation: string;
  value?: any;
}

export interface EvidenceQualityScore {
  totalScore: number; // 0 - 100
  ratingClass: 'Robust Evidence (75-100)' | 'Moderate Evidence (50-74)' | 'Preliminary / Low Evidence (<50)';
  breakdown: {
    cadastreAndGeometry: { score: number; max: number; rationale: string };
    terrainAndElevation: { score: number; max: number; rationale: string };
    geologyAndGroundwater: { score: number; max: number; rationale: string };
    infrastructureAndAccess: { score: number; max: number; rationale: string };
    environmentalAndFlood: { score: number; max: number; rationale: string };
    planningAndMarket: { score: number; max: number; rationale: string };
  };
  verifiedCount: number;
  modelledCount: number;
  unverifiedCount: number;
  summaryExplanation: string;
}

export interface VerificationRequirement {
  topic: string;
  reason: string;
  recommendedAuthorityOrExpert: string;
  priority: 'High' | 'Medium' | 'Standard';
}

export interface SectionAnalysis {
  summary: string;
  detail: string;
  evidence_level?: EvidenceLevel;
  source_cited?: string;
  limitation_notice?: string;
}

export interface DataSource {
  name: string;
  url?: string;
  authority?: string;
  verification_status?: 'VERIFIED' | 'MODELLED' | 'REQUIRES_VERIFICATION' | 'Official Cadastre' | 'Hydro Register' | 'Geological Survey' | string;
}

export interface SiteValueEstimate {
  min: number | null;
  max: number | null;
  median?: number | null;
  currency: string;
  basis: string;
  evidence_level?: EvidenceLevel;
  uncertainty_rating?: 'High' | 'Moderate' | 'Low';
}

export interface SoilStratigraphyLayer {
  depth_range: string;
  soil_type: string;
  bearing_capacity: string;
  description: string;
  color_hex?: string;
  sand_pct?: number;
  silt_pct?: number;
  clay_pct?: number;
  bulk_density?: number;
  ph?: number;
  soc?: number;
}

export interface SoilMetrics {
  usda_texture: string | null;
  topsoil_sand_pct: number | null;
  topsoil_silt_pct: number | null;
  topsoil_clay_pct: number | null;
  subsoil_sand_pct: number | null;
  subsoil_silt_pct: number | null;
  subsoil_clay_pct: number | null;
  mean_bulk_density: number | null;
  mean_ph: number | null;
  mean_soc: number | null;
  bearing_capacity_kpa: string | null;
  friction_angle_deg: number | null;
  cohesion_kpa: number | null;
  hydraulic_conductivity: string | null;
  drainage_class: string | null;
  frost_class: string;
  topsoil_stripping_cm: number | null;
  source_name: string;
}

export interface AmenityItem {
  type: string;
  name: string;
  distance_m: number;
  category: 'transit' | 'education' | 'daily_needs' | 'healthcare' | 'civic' | string;
}

export interface UtilityCheckItem {
  utility: string;
  status: string;
  evidence_level?: EvidenceLevel;
  provider_type?: string;
  distance_m?: number;
  mapped_in_dataset?: boolean;
  limitation?: string;
}

export interface RiskEvaluationItem {
  category: string;
  level: 'Low' | 'Negligible' | 'Moderate' | 'High' | string;
  evidence_level?: EvidenceLevel;
  detail: string;
}

export interface TechnicalParameters {
  cadastral_id_format?: string | null;
  cadastral_parcel_id?: string | null;
  cadastral_teryt?: string | null;
  cadastral_commune?: string | null;
  cadastral_county?: string | null;
  cadastral_voivodeship?: string | null;
  cadastre_evidence_level?: EvidenceLevel;
  is_official_parcel?: boolean;
  official_area_m2?: number | null;
  elevation_amsl?: number | null;
  min_elevation_amsl?: number | null;
  max_elevation_amsl?: number | null;
  local_relief_m?: number | null;
  slope_degrees?: number | null;
  slope_percent?: number | null;
  slope_category?: string;
  aspect_direction?: string | null;
  zoning_code?: string;
  zoning_name?: string;
  max_far?: string;
  max_building_coverage_pct?: string;
  min_biologically_active_pct?: string;
  max_height_m?: string;
  max_storeys?: string;
  roof_pitch_requirements?: string;
  setback_m?: string | null;
  utility_status?: string;
  groundwater_depth_m?: string;
  groundwater_notice?: string;
  frost_depth_m?: string;
  radon_index?: string | null;
  soil_bearing_capacity_kpa?: string | null;
}

export interface ValuationMetrics {
  price_per_sqm_min?: number | null;
  price_per_sqm_max?: number | null;
  price_per_sqm_median?: number | null;
  annual_growth_pct?: string;
  feasibility_rating?: string;
  geohazard_risk_score?: string;
  permitting_timeline_months?: string;
  max_buildable_area_sqm?: number;
  soil_bearing_capacity_kpa?: string;
  comparable_evidence_count?: number;
}

export interface EuropeanSurveyContext {
  survey_authority: string;
  geological_unit_name: string | null;
  lithology_type: string | null;
  geological_period_era?: string | null;
  stratigraphic_scale?: string;
  borehole_density_class?: string;
  seismic_hazard_zone?: string | null;
  radon_class?: string | null;
  groundwater_regime?: string | null;
  official_portal_url?: string;
  evidence_level?: EvidenceLevel;
}

export interface CountrySupportPresentation {
  maturity: 'SUPPORTED' | 'LIMITED';
  label: string;
  notice: string;
  capabilities: Record<string, boolean>;
}

export interface GroundContextPresentation {
  title: string;
  evidence_level: EvidenceLevel;
  variability_code: 'LOW' | 'MODERATE' | 'HIGH' | 'INSUFFICIENT_EVIDENCE';
  variability_label: string;
  summary: string;
  mapped_units_label: string;
  mapped_units: string[];
  material_indicators_label: string;
  material_indicators: string[];
  transition_indicated: boolean;
  sample_label: string;
  sample_count: number;
  site_sample_count: number;
  parcel_sample_count: number;
  vicinity_sample_count: number;
  soil_model_summary: string;
  soil_model_sample_count: number;
  soil_sand_range: [number, number] | null;
  soil_silt_range: [number, number] | null;
  soil_clay_range: [number, number] | null;
  investigation_focus: string;
  limitation: string;
  source_name: string | null;
  source_scale: string | null;
  terrain_min_elevation_m: number | null;
  terrain_max_elevation_m: number | null;
  terrain_local_relief_m: number | null;
}

export interface ReportData {
  site_value_estimate: SiteValueEstimate;
  confidence_level: 'High' | 'Medium' | 'Low' | string;
  evidence_score?: EvidenceQualityScore;
  country_support?: CountrySupportPresentation;
  ground_context?: GroundContextPresentation;
  canonical_evidence?: unknown;
  evidence_registry?: EvidenceItem[];
  verification_checklist?: VerificationRequirement[];
  summary: string;
  titles: Record<string, string>;
  unavailable_reasons?: Partial<Record<'geology' | 'soilTexture' | 'engineeringParameter' | 'groundwater' | 'planning' | 'valuation' | 'sourceUnavailable' | 'noFeature', string>>;
  geosurvey_context?: EuropeanSurveyContext;
  valuation_metrics?: ValuationMetrics;
  technical_parameters?: TechnicalParameters;
  stratigraphy?: SoilStratigraphyLayer[];
  soil_metrics?: SoilMetrics;
  amenity_index?: AmenityItem[];
  surrounding_buildings_count?: number;
  surrounding_landuse?: string[];
  utilities_checklist?: UtilityCheckItem[];
  risk_matrix?: RiskEvaluationItem[];
  soil_and_ground: SectionAnalysis;
  geohazard_risk: SectionAnalysis;
  flooding_risk: SectionAnalysis;
  zoning_and_land_use: SectionAnalysis;
  building_regulations: SectionAnalysis;
  environmental_factors: SectionAnalysis;
  infrastructure_and_access: SectionAnalysis;
  market_and_comparables: SectionAnalysis;
  development_cost_outlook: SectionAnalysis;
  key_risks: string[];
  opportunities: string[];
  data_sources: DataSource[];
  legal_disclaimers: string[];
  location_name?: string;
  language?: string;
  official_geometry?: [number, number][];
  is_official_parcel?: boolean;
  official_area_m2?: number;
}

export interface SiteReport {
  id: string;
  created_at: string;
  location_name: string;
  country: string;
  country_code: string;
  language: string;
  latitude: number;
  longitude: number;
  area_size: number;
  boundary: BoundaryShape;
  official_geometry?: [number, number][] | null;
  is_official_parcel?: boolean;
  official_area_m2?: number | null;
  report_data: ReportData;
}
