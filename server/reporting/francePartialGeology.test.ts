import test from 'node:test';
import assert from 'node:assert/strict';
import { getCountryProfile } from '../adapters/countries';
import { createCanonicalReport } from './canonicalReport';

function reportWithMappedLithologyOnly(): any {
  return {
    countryCode: 'FR', language: 'en',
    parcel: { status: 'REQUIRES_VERIFICATION', countryCode: 'FR', isOfficialGeometry: false, areaCalculatedM2: 1000, cadastralSource: 'IGN', datasetDate: '2026-08-30', limitation: 'fixture' },
    terrain: {
      elevationAmsl: 100, minElevationAmsl: 99, maxElevationAmsl: 101, elevationDifferenceM: 2, averageSlopePercent: 2, averageSlopeDegrees: 1.1, slopeCategory: 'Flat', aspectDirection: 'South',
      floodInundationRisk: { status: 'MODELLED', level: 'Low', description: 'fixture', sourceName: 'OSM', limitation: 'fixture' },
      geohazards: {
        landslideSusceptibility: { status: 'MODELLED', level: 'Low', description: 'fixture', sourceName: 'terrain' },
        seismicRisk: { status: 'MODELLED', zone: 'Low', pgaG: '<0.05g', sourceName: 'ESHM20' },
        radonPotential: { status: 'REQUIRES_VERIFICATION', classification: 'Not available', sourceName: 'JRC' },
        miningSubsidence: { status: 'REQUIRES_VERIFICATION', classification: 'Not available', sourceName: 'BRGM' }
      }
    },
    soil: { status: 'MODELLED', geologicalUnit: 'Not available', lithologyType: 'Not available', stratigraphicPeriod: 'Not available', usdaTextureClass: 'Sandy loam', topsoilSandPct: 60, topsoilSiltPct: 25, topsoilClayPct: 15, subsoilSandPct: 55, subsoilSiltPct: 30, subsoilClayPct: 15, meanBulkDensityGcm3: 1.4, meanPhH2O: 6.5, meanOrganicCarbonPct: 2, estimatedWaterTableDepthM: 'Not measured', groundwaterNotice: 'fixture', estimatedBearingCapacityKpa: 'Not available', effectiveFrictionAngleDeg: NaN, cohesionKpa: NaN, hydraulicConductivityMs: 'Not available', drainageClass: 'Not available', frostSusceptibilityClass: 'Not available', topsoilStrippingDepthCm: 0, groundwaterRegime: 'Not available', isMeasuredBoreholeData: false, sourceName: 'SoilGrids', sourceUrl: 'https://soilgrids.org', datasetVersion: '2.0', limitation: 'fixture', stratigraphyLayers: [] },
    planning: { status: 'REQUIRES_VERIFICATION', hasLocalPlan: false, planDesignation: 'PLU / PLUi', permittedUseCategory: 'Unknown', maxFar: 'Unknown', maxCoveragePct: 'Unknown', minBiologicallyActivePct: 'Unknown', maxBuildingHeightM: 'Unknown', setbackRules: 'Unknown', authorityName: 'Commune', documentRequired: 'Official plan', sourceName: 'GPU', limitation: 'fixture' },
    infrastructure: { roadAccess: { status: 'MODELLED', nearestRoadType: 'residential', estimatedDistanceM: 20, directAccessVerified: false, isPaved: true, sourceName: 'OpenStreetMap' }, utilities: [], amenities: [], surroundingBuildingsCount: 0, surroundingLanduse: [] },
    environment: { landscapeParkOverlay: false, waterProtectionZone: false, status: 'MODELLED', sourceName: 'OSM', limitation: 'fixture' },
    valuation: { status: 'REQUIRES_VERIFICATION', indicativeMinPrice: NaN, indicativeMaxPrice: NaN, indicativeMedianPrice: NaN, indicativePricePerSqm: NaN, currency: 'EUR', methodology: 'fixture', comparableEvidenceCount: 0, marketTrendDescription: 'fixture', priceDrivers: [], uncertaintyRating: 'High', disclaimer: 'fixture' },
    evidenceScore: { totalScore: 25, ratingClass: 'Preliminary / Low Evidence (<50)', verifiedCount: 1, modelledCount: 3, unverifiedCount: 2, breakdown: { cadastreAndGeometry: { score: 0, max: 20, rationale: 'fixture' }, terrainAndElevation: { score: 10, max: 20, rationale: 'fixture' }, geologyAndGroundwater: { score: 0, max: 20, rationale: 'fixture' }, infrastructureAndAccess: { score: 8, max: 15, rationale: 'fixture' }, environmentalAndFlood: { score: 8, max: 15, rationale: 'fixture' }, planningAndMarket: { score: 0, max: 10, rationale: 'fixture' } }, summaryExplanation: 'fixture' },
    evidenceRegistry: [{ id: 'fr-brgm-geology-site', category: 'BRGM Geological Map', claim: 'national lithology', status: 'VERIFIED', sourceName: 'Bureau de Recherches Géologiques et Minières (BRGM)', sourceUrl: 'https://geoservices.brgm.fr/geologie', datasetDate: '2026-08-30', spatialRelationship: 'SITE', calculationMethod: 'WFS', confidence: 'Medium', limitation: '1:1M fallback', value: { unit: null, lithology: 'Sables, graviers et alluvions', scale: '1:1,000,000', evidenceTier: 3 } }],
    verificationChecklist: [], executiveSummary: 'fixture', dataSourcesCited: [], statutoryDisclaimers: [],
    geosurvey_context: { geological_unit_name: null, lithology_type: 'Sables, graviers et alluvions', geological_period_era: null, genetic_origin: null, evidence_level: 'VERIFIED', evidence_tier: 3, source_scale: '1:1,000,000' }
  };
}

test('official BRGM lithology remains verified geology even when no formal geological unit is returned', () => {
  const canonical = createCanonicalReport(reportWithMappedLithologyOnly(), getCountryProfile('FR'));
  assert.equal(canonical.geology.unitName, null);
  assert.equal(canonical.geology.lithology, 'Sables, graviers et alluvions');
  assert.equal(canonical.geology.status, 'VERIFIED');
  assert.equal(canonical.geology.reasonCode, undefined);
  assert.ok(canonical.evidenceScore.breakdown.geologyAndGroundwater.score >= 18);
});
