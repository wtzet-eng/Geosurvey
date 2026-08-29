import test from 'node:test';
import assert from 'node:assert/strict';
import { getCountryProfile } from '../adapters/countries';
import { createCanonicalReport } from './canonicalReport';
import { renderLocalizedReport } from './localizedReport';

function polishModelledValuationReport(): any {
  return {
    countryCode: 'PL',
    language: 'pl',
    terrain: {
      elevationAmsl: 100,
      minElevationAmsl: 99,
      maxElevationAmsl: 101,
      elevationDifferenceM: 2,
      averageSlopePercent: 1,
      averageSlopeDegrees: 0.6,
      aspectDirection: 'North',
      floodInundationRisk: { status: 'MODELLED', level: 'Low', distanceToWaterwayM: 500, sourceName: 'OpenStreetMap hydrology' },
      geohazards: {
        landslideSusceptibility: { status: 'MODELLED', level: 'Low', sourceName: 'Terrain model' },
        seismicRisk: { status: 'MODELLED', zone: 'Low', pgaG: '<0.05g', sourceName: 'European seismic context' },
        radonPotential: { status: 'REQUIRES_VERIFICATION', classification: 'Not available', sourceName: 'Radon source' },
        miningSubsidence: { status: 'REQUIRES_VERIFICATION', classification: 'Not available', sourceName: 'Mining source' }
      }
    },
    soil: {
      status: 'MODELLED',
      geologicalUnit: 'Test unit',
      lithologyType: 'Test lithology',
      stratigraphicPeriod: 'Quaternary',
      groundwaterRegime: 'Not established',
      usdaTextureClass: 'Sandy loam',
      topsoilSandPct: 60,
      topsoilSiltPct: 25,
      topsoilClayPct: 15,
      meanPhH2O: 6.5,
      sourceName: 'ISRIC SoilGrids',
      sourceUrl: 'https://soilgrids.org'
    },
    planning: { authorityName: 'Municipality', sourceName: 'Planning guidance' },
    infrastructure: {
      roadAccess: { nearestRoadName: 'Road', nearestRoadType: 'residential', estimatedDistanceM: 20, directAccessVerified: false, status: 'MODELLED', sourceName: 'OpenStreetMap' },
      utilities: []
    },
    environment: { status: 'MODELLED', sourceName: 'OpenStreetMap' },
    valuation: {
      status: 'MODELLED',
      indicativeMinPrice: 533325,
      indicativeMaxPrice: 792603,
      indicativeMedianPrice: 649836,
      indicativePricePerSqm: 420,
      currency: 'PLN',
      comparableEvidenceCount: 0
    },
    evidenceScore: {
      totalScore: 60,
      ratingClass: 'Moderate Evidence (50-74)',
      verifiedCount: 0,
      modelledCount: 4,
      unverifiedCount: 0,
      breakdown: {
        cadastreAndGeometry: { score: 0, max: 20, rationale: 'fixture' },
        terrainAndElevation: { score: 15, max: 20, rationale: 'fixture' },
        geologyAndGroundwater: { score: 15, max: 20, rationale: 'fixture' },
        infrastructureAndAccess: { score: 10, max: 15, rationale: 'fixture' },
        environmentalAndFlood: { score: 10, max: 15, rationale: 'fixture' },
        planningAndMarket: { score: 0, max: 10, rationale: 'fixture' }
      },
      summaryExplanation: 'fixture'
    },
    evidenceRegistry: [{
      id: 'valuation-indicative-model',
      category: 'Market Valuation & Economics',
      claim: 'Indicative modelled valuation',
      status: 'MODELLED',
      sourceName: 'Configured valuation',
      datasetDate: '2026-08-29',
      spatialRelationship: 'Regional benchmark',
      calculationMethod: 'Configured baseline model',
      confidence: 'Low',
      limitation: 'fixture'
    }],
    dataSourcesCited: [],
    verificationChecklist: []
  };
}

test('Polish modelled valuation exposes benchmark provenance without claiming live transaction evidence', () => {
  const profile = getCountryProfile('PL');
  const canonical = createCanonicalReport(polishModelledValuationReport(), profile);

  assert.equal(canonical.support.capabilities.nationalValuation, false);
  assert.equal(canonical.valuation.status, 'MODELLED');
  assert.equal(canonical.valuation.comparableCount, 0);
  assert.match(canonical.valuation.sourceName, /GeoSurvey/);
  assert.match(canonical.valuation.sourceName, /RCiWN/);
  assert.match(canonical.valuation.sourceName, /PKO\/NBP/);
  assert.match(canonical.valuation.sourceName, /420 PLN\/m²/);

  const evidence = canonical.evidenceRecords.find(record => record.id === 'valuation-indicative-model');
  assert.ok(evidence);
  assert.equal(evidence?.sourceName, canonical.valuation.sourceName);
  assert.match(evidence?.limitation || '', /benchmark references for the configured regional baseline/i);
  assert.match(evidence?.limitation || '', /no direct comparable deeds or live national valuation records were queried/i);

  const rendered = renderLocalizedReport(canonical, 'pl');
  assert.equal(rendered.sections.market_and_comparables.source_cited, canonical.valuation.sourceName);
  assert.match(rendered.sections.market_and_comparables.source_cited || '', /RCiWN/);
  assert.match(rendered.sections.market_and_comparables.source_cited || '', /420 PLN\/m²/);
  assert.equal(canonical.valuation.comparableCount, 0);
});
