import test from 'node:test';
import assert from 'node:assert/strict';
import { getCountryProfile } from '../adapters/countries';
import { createCanonicalReport } from './canonicalReport';
import { renderCroatiaGroundPresentation } from './croatiaGroundPresentation';

function report(unit: string, lithology: string, age: string): any {
  return {
    countryCode: 'HR', language: 'en',
    parcel: { status: 'REQUIRES_VERIFICATION', countryCode: 'HR', isOfficialGeometry: false, areaCalculatedM2: 1000, cadastralSource: 'DGU', datasetDate: '2026-09-22', limitation: 'fixture' },
    terrain: {
      elevationAmsl: 100, minElevationAmsl: 99, maxElevationAmsl: 101, elevationDifferenceM: 2,
      averageSlopePercent: 2, averageSlopeDegrees: 1.1, slopeCategory: 'Flat', aspectDirection: 'South',
      floodInundationRisk: { status: 'VERIFIED', level: 'Low', description: 'fixture', sourceName: 'Hrvatske vode', limitation: 'fixture' },
      geohazards: {
        landslideSusceptibility: { status: 'MODELLED', level: 'Low', description: 'fixture', sourceName: 'terrain' },
        seismicRisk: { status: 'MODELLED', zone: 'Low', pgaG: '<0.05g', sourceName: 'EU' },
        radonPotential: { status: 'REQUIRES_VERIFICATION', classification: 'Not available', sourceName: 'JRC' },
        miningSubsidence: { status: 'REQUIRES_VERIFICATION', classification: 'Not available', sourceName: 'Mining' }
      }
    },
    soil: { status: 'REQUIRES_VERIFICATION', geologicalUnit: unit, lithologyType: lithology, stratigraphicPeriod: age, usdaTextureClass: null, topsoilSandPct: NaN, topsoilSiltPct: NaN, topsoilClayPct: NaN, meanBulkDensityGcm3: NaN, meanPhH2O: NaN, meanOrganicCarbonPct: NaN, estimatedWaterTableDepthM: 'Not available', groundwaterNotice: 'fixture', estimatedBearingCapacityKpa: 'Not available', effectiveFrictionAngleDeg: NaN, cohesionKpa: NaN, hydraulicConductivityMs: 'Not available', drainageClass: 'Not available', frostSusceptibilityClass: 'Not available', topsoilStrippingDepthCm: 0, groundwaterRegime: 'Not available', isMeasuredBoreholeData: false, sourceName: 'SoilGrids', sourceUrl: 'https://soilgrids.org', datasetVersion: '2.0', limitation: 'fixture', stratigraphyLayers: [] },
    planning: { status: 'REQUIRES_VERIFICATION', authorityName: 'ISPU', sourceName: 'ISPU', limitation: 'fixture' },
    infrastructure: { roadAccess: { status: 'MODELLED', nearestRoadType: 'residential', estimatedDistanceM: 20, directAccessVerified: false, isPaved: true, sourceName: 'OSM' }, utilities: [], amenities: [], surroundingBuildingsCount: 0, surroundingLanduse: [] },
    environment: { landscapeParkOverlay: false, waterProtectionZone: false, status: 'MODELLED', sourceName: 'OSM', limitation: 'fixture' },
    valuation: { status: 'REQUIRES_VERIFICATION', indicativeMinPrice: NaN, indicativeMaxPrice: NaN, indicativeMedianPrice: NaN, indicativePricePerSqm: NaN, currency: 'EUR', methodology: 'none', comparableEvidenceCount: 0, marketTrendDescription: '', priceDrivers: [], uncertaintyRating: 'High', disclaimer: 'fixture' },
    evidenceScore: { totalScore: 50, ratingClass: 'Moderate Evidence (50-74)', verifiedCount: 1, modelledCount: 2, unverifiedCount: 5, breakdown: { cadastreAndGeometry: { score: 0, max: 20, rationale: 'fixture' }, terrainAndElevation: { score: 10, max: 20, rationale: 'fixture' }, geologyAndGroundwater: { score: 12, max: 20, rationale: 'fixture' }, infrastructureAndAccess: { score: 8, max: 15, rationale: 'fixture' }, environmentalAndFlood: { score: 8, max: 15, rationale: 'fixture' }, planningAndMarket: { score: 0, max: 10, rationale: 'fixture' } }, summaryExplanation: 'fixture' },
    evidenceRegistry: [], verificationChecklist: [], executiveSummary: 'fixture', dataSourcesCited: [], statutoryDisclaimers: [],
    geosurvey_context: { geological_unit_name: unit, lithology_type: lithology, geological_period_era: age, evidence_level: 'VERIFIED', source_name: 'Croatian Geological Survey (Hrvatski geološki institut) — INSPIRE Geological Map 1:300,000', source_url: 'https://transformiraj.nipp.hr/ows/services/org.2.abf7ddc6-7578-4070-a9db-c291a42e55c6_wfs' }
  };
}

test('Croatia ground presentation distinguishes sedimentary material and points to thickness, condition and groundwater checks', () => {
  const canonical = createCanonicalReport(report('Holocene — sedimentary material', 'sedimentary material', 'Holocene'), getCountryProfile('HR'));
  const en = renderCroatiaGroundPresentation(canonical, 'en');
  assert.ok(en);
  assert.match(en!.narrative, /sedimentary material/i);
  assert.match(en!.narrative, /thickness and condition/i);
  assert.match(en!.narrative, /groundwater/i);
  assert.match(en!.narrative, /site-specific ground investigation/i);
  assert.match(en!.geohazardNarrative, /not a landslide, flood or foundation classification/i);
});

test('Croatia ground presentation treats limestone cautiously and does not assert karst', () => {
  const canonical = createCanonicalReport(report('Cenomanian — limestone', 'limestone', 'Cenomanian'), getCountryProfile('HR'));
  const en = renderCroatiaGroundPresentation(canonical, 'en');
  assert.ok(en);
  assert.match(en!.narrative, /limestone/i);
  assert.match(en!.narrative, /fracturing/i);
  assert.match(en!.narrative, /cavities\/karst/i);
  assert.match(en!.narrative, /should only be assessed/i);
  assert.doesNotMatch(en!.narrative, /the site is karst/i);
});

test('Croatia ground presentation localizes core investigation wording', () => {
  const canonical = createCanonicalReport(report('Eocene — clastic sedimentary rock', 'clastic sedimentary rock', 'Eocene'), getCountryProfile('HR'));
  const de = renderCroatiaGroundPresentation(canonical, 'de');
  const pl = renderCroatiaGroundPresentation(canonical, 'pl');
  assert.ok(de && pl);
  assert.match(de!.narrative, /klastisches Sedimentgestein/i);
  assert.match(de!.narrative, /standortbezogene Untersuchung/i);
  assert.match(pl!.narrative, /klastyczne skały osadowe/i);
  assert.match(pl!.narrative, /badaniu dla lokalizacji/i);
});

test('Croatia ground presentation does not render for another country', () => {
  const canonical = createCanonicalReport({ ...report('Holocene — sedimentary material', 'sedimentary material', 'Holocene'), countryCode: 'DE', geosurvey_context: { geological_unit_name: 'Holocene', lithology_type: 'sedimentary material', geological_period_era: 'Holocene', evidence_level: 'VERIFIED', source_name: 'HGI' } }, getCountryProfile('DE'));
  assert.equal(renderCroatiaGroundPresentation(canonical, 'en'), null);
});
