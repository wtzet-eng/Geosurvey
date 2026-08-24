import test from 'node:test';
import assert from 'node:assert/strict';
import { getCountryProfile } from '../adapters/countries';
import { getCountrySupport } from '../../src/data/countrySupport';
import { createCanonicalReport } from './canonicalReport';
import { renderLocalizedReport } from './localizedReport';

function rawReport(countryCode: string): any {
  return {
    countryCode,
    language: 'en',
    parcel: {
      status: 'REQUIRES_VERIFICATION',
      parcelId: 'FAKE-PARCEL',
      countryCode,
      isOfficialGeometry: false,
      areaCalculatedM2: 1000,
      officialAreaM2: 999,
      cadastralSource: 'Configured national cadastre',
      datasetDate: '2026-08-24',
      limitation: 'fixture'
    },
    terrain: {
      elevationAmsl: 120,
      minElevationAmsl: 118,
      maxElevationAmsl: 122,
      elevationDifferenceM: 4,
      averageSlopePercent: 2,
      averageSlopeDegrees: 1.2,
      slopeCategory: 'Flat (0-2°)',
      aspectDirection: 'South',
      floodInundationRisk: { status: 'MODELLED', level: 'Low', distanceToWaterwayM: 300, statutoryZoneStatus: 'configured', description: 'configured flood conclusion', sourceName: 'Configured national flood authority', limitation: 'fixture' },
      geohazards: {
        landslideSusceptibility: { status: 'MODELLED', level: 'Low', description: 'terrain context', sourceName: 'Terrain model' },
        seismicRisk: { status: 'MODELLED', zone: 'Eurocode 8 Zone 0–1 (Low to Very Low)', pgaG: '< 0.05g', sourceName: 'European seismic context' },
        radonPotential: { status: 'MODELLED', classification: 'Low', sourceName: 'Configured radon source' },
        miningSubsidence: { status: 'MODELLED', classification: 'No mining risk', sourceName: 'Configured mining source' }
      }
    },
    soil: {
      status: 'MODELLED', geologicalUnit: 'Synthetic national unit', lithologyType: 'Synthetic lithology', stratigraphicPeriod: 'Synthetic age',
      usdaTextureClass: 'Sandy loam', topsoilSandPct: 60, topsoilSiltPct: 25, topsoilClayPct: 15,
      subsoilSandPct: 55, subsoilSiltPct: 30, subsoilClayPct: 15, meanBulkDensityGcm3: 1.4, meanPhH2O: 6.5, meanOrganicCarbonPct: 2,
      estimatedWaterTableDepthM: 'Synthetic 2m', groundwaterNotice: 'fixture', estimatedBearingCapacityKpa: '250', effectiveFrictionAngleDeg: 35, cohesionKpa: 10,
      hydraulicConductivityMs: '1e-5', drainageClass: 'Good', frostSusceptibilityClass: 'Low', topsoilStrippingDepthCm: 30,
      groundwaterRegime: 'Synthetic groundwater regime', isMeasuredBoreholeData: false, sourceName: 'ISRIC SoilGrids', sourceUrl: 'https://soilgrids.org', datasetVersion: 'fixture', limitation: 'pedological only', stratigraphyLayers: []
    },
    planning: { status: 'MODELLED', hasLocalPlan: true, planDesignation: 'Synthetic zoning', permittedUseCategory: 'Residential', maxFar: '1.0', maxCoveragePct: '40%', minBiologicallyActivePct: '30%', maxBuildingHeightM: '9', setbackRules: '3.0 m', authorityName: 'Configured planning authority', documentRequired: 'Official plan', sourceName: 'Configured planning model', limitation: 'fixture' },
    infrastructure: { roadAccess: { status: 'MODELLED', nearestRoadType: 'residential', nearestRoadName: 'Test Road', estimatedDistanceM: 20, directAccessVerified: false, isPaved: true, sourceName: 'OpenStreetMap' }, utilities: [], amenities: [], surroundingBuildingsCount: 3, surroundingLanduse: ['residential'] },
    environment: { landscapeParkOverlay: false, waterProtectionZone: false, status: 'MODELLED', sourceName: 'OpenStreetMap', limitation: 'cross-border context' },
    valuation: { status: 'MODELLED', indicativeMinPrice: 123000, indicativeMaxPrice: 456000, indicativeMedianPrice: 250000, indicativePricePerSqm: 250, currency: 'EUR', methodology: 'Configured baseValuationPerSqm model', comparableEvidenceCount: 0, marketTrendDescription: 'Synthetic valuation', priceDrivers: [], uncertaintyRating: 'High', disclaimer: 'fixture' },
    evidenceScore: {
      totalScore: 61, ratingClass: 'Moderate Evidence (50-74)', verifiedCount: 0, modelledCount: 5, unverifiedCount: 1,
      breakdown: {
        cadastreAndGeometry: { score: 6, max: 20, rationale: 'unverified cadastre' },
        terrainAndElevation: { score: 14, max: 20, rationale: 'terrain' },
        geologyAndGroundwater: { score: 14, max: 20, rationale: 'SoilGrids' },
        infrastructureAndAccess: { score: 12, max: 15, rationale: 'OSM' },
        environmentalAndFlood: { score: 11, max: 15, rationale: 'OSM context' },
        planningAndMarket: { score: 4, max: 10, rationale: 'configured valuation' }
      },
      summaryExplanation: 'fixture'
    },
    evidenceRegistry: [
      { id: 'cadastre-spatial-index', category: 'Cadastre & Identification', claim: 'Synthetic parcel conclusion', status: 'REQUIRES_VERIFICATION', sourceName: 'Configured cadastre', datasetDate: '2026-08-24', spatialRelationship: 'fixture', calculationMethod: 'fixture', confidence: 'Medium', limitation: 'fixture' },
      { id: 'terrain-elevation-slope', category: 'Terrain & Topography', claim: 'Terrain evidence', status: 'MODELLED', sourceName: 'Copernicus DEM', datasetDate: '2026-08-24', spatialRelationship: 'fixture', calculationMethod: 'fixture', confidence: 'Medium', limitation: 'fixture' },
      { id: 'soilgrids-profile', category: 'Soil', claim: 'Pedological evidence', status: 'MODELLED', sourceName: 'ISRIC SoilGrids', datasetDate: '2026-08-24', spatialRelationship: 'fixture', calculationMethod: 'fixture', confidence: 'Medium', limitation: 'fixture' },
      { id: 'valuation-indicative-model', category: 'Market Valuation & Economics', claim: 'Synthetic valuation 123000–456000', status: 'MODELLED', sourceName: 'Configured valuation', datasetDate: '2026-08-24', spatialRelationship: 'fixture', calculationMethod: 'fixture', confidence: 'Low', limitation: 'fixture' },
      { id: 'flood-proximity-check', category: 'Hydrology & Flooding', claim: 'Open water 300m away', status: 'MODELLED', sourceName: 'Configured national flood authority', sourceUrl: 'https://example.test/flood', datasetDate: '2026-08-24', spatialRelationship: 'fixture', calculationMethod: 'fixture', confidence: 'Medium', limitation: 'fixture' }
    ],
    verificationChecklist: [],
    executiveSummary: 'Synthetic valuation 123000–456000 EUR; setback 3.0 m',
    dataSourcesCited: [
      { name: 'Configured cadastre', organization: 'fixture', url: 'https://example.test/cadastre', type: 'Official National Cadastre', status: 'REQUIRES_VERIFICATION' },
      { name: 'Copernicus DEM', organization: 'fixture', url: 'https://example.test/dem', type: 'Elevation DEM', status: 'MODELLED' },
      { name: 'ISRIC SoilGrids', organization: 'fixture', url: 'https://soilgrids.org', type: 'Scientific Soil Database', status: 'MODELLED' },
      { name: 'Configured national geology', organization: 'fixture', url: 'https://example.test/geology', type: 'Geological Survey', status: 'MODELLED' },
      { name: 'Configured national flood', organization: 'fixture', url: 'https://example.test/flood', type: 'Hydrological Registry', status: 'MODELLED' },
      { name: 'OpenStreetMap', organization: 'fixture', url: 'https://openstreetmap.org', type: 'Spatial Overpass', status: 'MODELLED' },
      { name: 'Configured valuation', organization: 'fixture', url: 'https://example.test/value', type: 'Statistical Market Benchmark', status: 'MODELLED' }
    ],
    statutoryDisclaimers: []
  };
}

test('country support maturity is explicit and unknown countries fail closed', () => {
  const pl = getCountrySupport('PL');
  const gb = getCountrySupport('GB');
  assert.equal(pl.maturity, 'SUPPORTED');
  assert.equal(pl.capabilities.nationalCadastre, true);
  assert.equal(pl.capabilities.nationalGeology, true);
  assert.equal(gb.maturity, 'SUPPORTED');
  assert.equal(gb.capabilities.nationalGeology, true);
  assert.equal(gb.capabilities.nationalCadastre, false);
  for (const code of ['DE', 'FR', 'ES', 'IT', 'NL', 'CH', 'AT', 'EU', 'XX']) {
    const support = getCountrySupport(code);
    assert.equal(support.maturity, 'LIMITED');
    assert.ok(Object.values(support.capabilities).every(value => value === false));
  }
});

test('limited country canonical report withholds national conclusions but retains cross-border evidence and adjusts denominator', () => {
  const canonical = createCanonicalReport(rawReport('DE'), getCountryProfile('DE'));
  assert.equal(canonical.support.maturity, 'LIMITED');
  assert.equal(canonical.geology.unitName, null);
  assert.equal(canonical.geology.reasonCode, 'NOT_SUPPORTED_FOR_COUNTRY');
  assert.equal(canonical.flood.classification, null);
  assert.equal(canonical.flood.reasonCode, 'NOT_SUPPORTED_FOR_COUNTRY');
  assert.equal(canonical.planning.reasonCode, 'NOT_SUPPORTED_FOR_COUNTRY');
  assert.equal(canonical.valuation.min, null);
  assert.equal(canonical.valuation.max, null);
  assert.equal(canonical.valuation.reasonCode, 'NOT_SUPPORTED_FOR_COUNTRY');
  assert.equal(canonical.soil.texture, 'Sandy loam');
  assert.equal(canonical.terrain.elevationM, 120);
  assert.equal(canonical.infrastructure.sourceName, 'OpenStreetMap');
  assert.equal(canonical.evidenceScore.breakdown.cadastreAndGeometry.max, 0);
  assert.equal(canonical.evidenceScore.breakdown.planningAndMarket.max, 0);
  assert.ok(canonical.evidenceScore.totalScore > 0);
  assert.ok(canonical.evidenceRecords.some(record => record.id === 'terrain-elevation-slope'));
  assert.ok(canonical.evidenceRecords.some(record => record.id === 'soilgrids-profile'));
  assert.ok(canonical.evidenceRecords.some(record => record.id === 'flood-proximity-check' && record.sourceName === 'OpenStreetMap hydrology'));
  assert.ok(!canonical.evidenceRecords.some(record => record.id === 'valuation-indicative-model'));
  assert.ok(!canonical.sourceRecords.some(source => source.type === 'Official National Cadastre' || source.type === 'Geological Survey' || source.type === 'Hydrological Registry' || source.type === 'Statistical Market Benchmark'));
});

test('limited coverage and withheld valuation are localized without zero or undefined ranges', () => {
  const canonical = createCanonicalReport(rawReport('DE'), getCountryProfile('DE'));
  for (const language of ['en', 'de', 'pl']) {
    const rendered = renderLocalizedReport(canonical, language);
    assert.equal(rendered.countrySupport.maturity, 'LIMITED');
    assert.ok(rendered.countrySupport.notice.length > 30);
    assert.match(rendered.sections.market_and_comparables.limitation_notice || '', /not supported|nicht unterstützt|nie jest obsługiwane/i);
    const text = JSON.stringify(rendered);
    assert.doesNotMatch(text, /123000|456000|250\s*EUR|0\s*[–-]\s*0|undefined/);
    assert.doesNotMatch(text, /3\.0\s*m/);
  }
});
