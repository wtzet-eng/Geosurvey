import test from 'node:test';
import assert from 'node:assert/strict';
import { getCountryProfile } from '../adapters/countries';
import { getCountrySupport } from '../../src/data/countrySupport';
import { createCanonicalReport } from './canonicalReport';

function rawSlovakiaReport(): any {
  return {
    countryCode: 'SK',
    language: 'en',
    parcel: {
      status: 'REQUIRES_VERIFICATION',
      countryCode: 'SK',
      isOfficialGeometry: false,
      areaCalculatedM2: 1000,
      commune: 'Nitra',
      voivodeship: 'Nitriansky kraj',
      cadastralSource: 'fixture',
      datasetDate: '2026-09-09',
      limitation: 'fixture'
    },
    terrain: {
      elevationAmsl: 150,
      minElevationAmsl: 149,
      maxElevationAmsl: 151,
      elevationDifferenceM: 2,
      averageSlopePercent: 2,
      averageSlopeDegrees: 1.2,
      aspectDirection: 'South',
      floodInundationRisk: { status: 'MODELLED', level: 'Low', distanceToWaterwayM: 300, sourceName: 'OSM hydrology' },
      geohazards: {
        landslideSusceptibility: { status: 'MODELLED', level: 'Low', sourceName: 'Terrain model' },
        seismicRisk: { status: 'MODELLED', zone: 'Low', pgaG: '<0.05g', sourceName: 'European seismic context' },
        radonPotential: { status: 'REQUIRES_VERIFICATION', classification: 'Not available', sourceName: 'Radon source' },
        miningSubsidence: { status: 'REQUIRES_VERIFICATION', classification: 'Not available', sourceName: 'Mining source' }
      }
    },
    soil: {
      status: 'MODELLED',
      geologicalUnit: 'Not available',
      lithologyType: 'Not available',
      stratigraphicPeriod: 'Not available',
      groundwaterRegime: 'Not available',
      usdaTextureClass: 'Sandy loam',
      topsoilSandPct: 60,
      topsoilSiltPct: 25,
      topsoilClayPct: 15,
      meanPhH2O: 6.5,
      sourceName: 'ISRIC SoilGrids',
      sourceUrl: 'https://soilgrids.org'
    },
    planning: { authorityName: 'Nitra', sourceName: 'Planning guidance' },
    infrastructure: {
      roadAccess: { nearestRoadName: 'Road', nearestRoadType: 'residential', estimatedDistanceM: 10, directAccessVerified: true, status: 'MODELLED', sourceName: 'OpenStreetMap' },
      utilities: []
    },
    environment: { status: 'MODELLED', sourceName: 'OpenStreetMap' },
    valuation: {
      status: 'MODELLED',
      indicativeMinPrice: 65000,
      indicativeMaxPrice: 100000,
      indicativeMedianPrice: 79350,
      indicativePricePerSqm: 79,
      currency: 'EUR',
      comparableEvidenceCount: 0,
      uncertaintyRating: 'High'
    },
    evidenceScore: {
      totalScore: 60,
      ratingClass: 'Moderate Evidence (50-74)',
      verifiedCount: 0,
      modelledCount: 4,
      unverifiedCount: 1,
      breakdown: {
        cadastreAndGeometry: { score: 6, max: 20, rationale: 'fixture' },
        terrainAndElevation: { score: 14, max: 20, rationale: 'fixture' },
        geologyAndGroundwater: { score: 14, max: 20, rationale: 'fixture' },
        infrastructureAndAccess: { score: 12, max: 15, rationale: 'fixture' },
        environmentalAndFlood: { score: 11, max: 15, rationale: 'fixture' },
        planningAndMarket: { score: 4, max: 10, rationale: 'fixture' }
      },
      summaryExplanation: 'fixture'
    },
    evidenceRegistry: [{
      id: 'valuation-indicative-model',
      category: 'Market Valuation & Economics',
      claim: 'Old generic raw valuation',
      status: 'MODELLED',
      sourceName: 'Configured valuation',
      datasetDate: '2026-09-09',
      spatialRelationship: 'fixture',
      calculationMethod: 'generic municipality uplift',
      confidence: 'Low',
      limitation: 'fixture'
    }],
    dataSourcesCited: [{
      name: 'Configured valuation',
      organization: 'fixture',
      url: 'https://example.test/value',
      type: 'Statistical Market Benchmark',
      status: 'MODELLED'
    }],
    verificationChecklist: []
  };
}

test('Slovakia is a limited country pack with national ground evidence and valuation', () => {
  const profile = getCountryProfile('SK');
  const support = getCountrySupport('SK');
  assert.equal(profile.countryName, 'Slovakia');
  assert.equal(profile.currency, 'EUR');
  assert.match(profile.cadastreAuthority, /ÚGKK/i);
  assert.match(profile.geologyAuthority, /Štátny geologický ústav/i);
  assert.equal(support.maturity, 'LIMITED');
  assert.equal(support.capabilities.nationalValuation, true);
  assert.equal(support.capabilities.nationalGeology, true);
  assert.equal(support.capabilities.nationalBoreholes, true);
  assert.equal(support.capabilities.nationalHydrogeology, true);
  assert.equal(support.capabilities.nationalCadastre, false);
  assert.equal(support.capabilities.nationalFlood, false);
  assert.equal(support.capabilities.nationalPlanning, false);
});

test('canonical Slovak report replaces generic raw value with city asking benchmark', () => {
  const canonical = createCanonicalReport(rawSlovakiaReport(), getCountryProfile('SK'));
  assert.equal(canonical.valuation.status, 'MODELLED');
  assert.equal(canonical.valuation.median, 74000);
  assert.equal(canonical.valuation.min, 44000);
  assert.equal(canonical.valuation.max, 107000);
  assert.equal(canonical.valuation.comparableCount, 0);
  assert.match(canonical.valuation.sourceName, /ZoznamRealit/i);

  const evidence = canonical.evidenceRecords.find(record => record.id === 'valuation-indicative-model');
  assert.ok(evidence);
  assert.match(evidence?.claim || '', /Slovak land asking-price benchmark/i);
  assert.match(evidence?.spatialRelationship || '', /CITY asking benchmark/i);
  assert.match(evidence?.calculationMethod || '', /no generic municipality uplift/i);
  assert.match(evidence?.limitation || '', /advertised residential\/building-plot prices, not completed cadastral sale prices/i);
  assert.match(evidence?.limitation || '', /Buildings and other improvements are excluded/i);
  assert.doesNotMatch(evidence?.claim || '', /79350/);

  const source = canonical.sourceRecords.find(record => record.type === 'Statistical Market Benchmark');
  assert.ok(source);
  assert.match(source?.name || '', /ZoznamRealit/i);
});
