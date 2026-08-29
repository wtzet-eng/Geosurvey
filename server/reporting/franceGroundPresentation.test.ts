import test from 'node:test';
import assert from 'node:assert/strict';
import { getCountryProfile } from '../adapters/countries';
import { createCanonicalReport } from './canonicalReport';
import { renderFranceGroundPresentation } from './franceGroundPresentation';

function franceReport(): any {
  return {
    countryCode: 'FR',
    language: 'en',
    parcel: { status: 'REQUIRES_VERIFICATION', countryCode: 'FR', isOfficialGeometry: false, areaCalculatedM2: 1000, cadastralSource: 'IGN', datasetDate: '2026-08-29', limitation: 'fixture' },
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
    soil: { status: 'MODELLED', geologicalUnit: 'Alluvions récentes', lithologyType: 'sables et graviers', stratigraphicPeriod: 'Holocène', usdaTextureClass: 'Sandy loam', topsoilSandPct: 60, topsoilSiltPct: 25, topsoilClayPct: 15, subsoilSandPct: 55, subsoilSiltPct: 30, subsoilClayPct: 15, meanBulkDensityGcm3: 1.4, meanPhH2O: 6.5, meanOrganicCarbonPct: 2, estimatedWaterTableDepthM: 'Not measured', groundwaterNotice: 'fixture', estimatedBearingCapacityKpa: 'Not available', effectiveFrictionAngleDeg: NaN, cohesionKpa: NaN, hydraulicConductivityMs: 'Not available', drainageClass: 'Not available', frostSusceptibilityClass: 'Not available', topsoilStrippingDepthCm: 0, groundwaterRegime: 'Not available', isMeasuredBoreholeData: false, sourceName: 'SoilGrids', sourceUrl: 'https://soilgrids.org', datasetVersion: '2.0', limitation: 'fixture', stratigraphyLayers: [] },
    planning: { status: 'REQUIRES_VERIFICATION', hasLocalPlan: false, planDesignation: 'PLU / PLUi', permittedUseCategory: 'Unknown', maxFar: 'Unknown', maxCoveragePct: 'Unknown', minBiologicallyActivePct: 'Unknown', maxBuildingHeightM: 'Unknown', setbackRules: 'Unknown', authorityName: 'Commune', documentRequired: 'Official plan', sourceName: 'GPU', limitation: 'fixture' },
    infrastructure: { roadAccess: { status: 'MODELLED', nearestRoadType: 'residential', estimatedDistanceM: 20, directAccessVerified: false, isPaved: true, sourceName: 'OpenStreetMap' }, utilities: [], amenities: [], surroundingBuildingsCount: 0, surroundingLanduse: [] },
    environment: { landscapeParkOverlay: false, waterProtectionZone: false, status: 'MODELLED', sourceName: 'OSM', limitation: 'fixture' },
    valuation: { status: 'MODELLED', indicativeMinPrice: 100000, indicativeMaxPrice: 150000, indicativeMedianPrice: 125000, indicativePricePerSqm: 125, currency: 'EUR', methodology: 'fixture', comparableEvidenceCount: 0, marketTrendDescription: 'fixture', priceDrivers: [], uncertaintyRating: 'High', disclaimer: 'fixture' },
    evidenceScore: { totalScore: 50, ratingClass: 'Moderate Evidence (50-74)', verifiedCount: 3, modelledCount: 3, unverifiedCount: 2, breakdown: { cadastreAndGeometry: { score: 0, max: 20, rationale: 'fixture' }, terrainAndElevation: { score: 10, max: 20, rationale: 'fixture' }, geologyAndGroundwater: { score: 18, max: 20, rationale: 'fixture' }, infrastructureAndAccess: { score: 8, max: 15, rationale: 'fixture' }, environmentalAndFlood: { score: 8, max: 15, rationale: 'fixture' }, planningAndMarket: { score: 0, max: 10, rationale: 'fixture' } }, summaryExplanation: 'fixture' },
    evidenceRegistry: [
      { id: 'fr-brgm-geology-site', category: 'BRGM Geological Map', claim: 'mapped geology', status: 'VERIFIED', sourceName: 'Bureau de Recherches Géologiques et Minières (BRGM)', sourceUrl: 'https://geoservices.brgm.fr/geologie', datasetDate: '2026-08-29', spatialRelationship: 'SITE', calculationMethod: 'WMS', confidence: 'High', limitation: 'fixture', value: { unit: 'Alluvions récentes', lithology: 'sables et graviers', age: 'Holocène' } },
      { id: 'fr-brgm-bss-context', category: 'BRGM Banque du Sous-Sol (BSS)', claim: '2 nearby records', status: 'VERIFIED', sourceName: 'Bureau de Recherches Géologiques et Minières (BRGM)', sourceUrl: 'https://geoservices.brgm.fr/geologie', datasetDate: '2026-08-29', spatialRelationship: 'VICINITY', calculationMethod: 'WFS', confidence: 'Medium', limitation: 'context only', value: { observationCount: 2, nearestDistanceKm: 0.42, nearestRecordId: 'BSS001' } },
      { id: 'fr-brgm-shrink-swell-site', category: 'Shrink-swell clay screening', claim: 'Moyen', status: 'VERIFIED', sourceName: 'Bureau de Recherches Géologiques et Minières (BRGM) / Géorisques', sourceUrl: 'https://geoservices.brgm.fr/risques', datasetDate: '2026-08-29', spatialRelationship: 'SITE', calculationMethod: 'WMS', confidence: 'High', limitation: 'screening only', value: { descriptor: 'Moyen' } }
    ],
    verificationChecklist: [], executiveSummary: 'fixture', dataSourcesCited: [], statutoryDisclaimers: [],
    geosurvey_context: { geological_unit_name: 'Alluvions récentes', lithology_type: 'sables et graviers', geological_period_era: 'Holocène', evidence_level: 'VERIFIED' }
  };
}

test('France reader presentation exposes successful BSS and shrink-swell evidence with one investigation boundary', () => {
  const canonical = createCanonicalReport(franceReport(), getCountryProfile('FR'));
  const en = renderFranceGroundPresentation(canonical, 'en');
  assert.ok(en);
  assert.match(en!.narrative, /2 nearby contextual records/i);
  assert.match(en!.narrative, /0\.42 km/i);
  assert.match(en!.narrative, /BSS001/i);
  assert.match(en!.narrative, /shrink–swell clay screening.*Moyen/i);
  assert.match(en!.narrative, /preliminary screening context only/i);
  assert.equal(en!.bss?.observationCount, 2);
  assert.equal(en!.shrinkSwell?.descriptor, 'Moyen');
});

test('France reader presentation is localized and does not expose unavailable optional-source noise', () => {
  const report = franceReport();
  report.evidenceRegistry.push({ id: 'fr-brgm-bss-unavailable', category: 'BSS', claim: 'failed', status: 'REQUIRES_VERIFICATION', sourceName: 'BRGM', datasetDate: '2026-08-29', spatialRelationship: 'VICINITY', calculationMethod: 'WFS', confidence: 'Low', limitation: 'failed', value: { reasonCode: 'SOURCE_UNAVAILABLE' } });
  const canonical = createCanonicalReport(report, getCountryProfile('FR'));
  const de = renderFranceGroundPresentation(canonical, 'de');
  const pl = renderFranceGroundPresentation(canonical, 'pl');
  assert.ok(de && pl);
  assert.match(de!.narrative, /Datensätze in der Umgebung/i);
  assert.match(pl!.narrative, /kontekstowe rekord/i);
  assert.doesNotMatch(`${de!.narrative} ${pl!.narrative}`, /failed|unavailable|source unavailable/i);
});
