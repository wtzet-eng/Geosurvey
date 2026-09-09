import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichGeologyFromBgs, UkSiteEvidence } from './ukSiteEvidenceService';

const base = (overrides: Partial<UkSiteEvidence>): UkSiteEvidence => ({
  id: 'fixture', category: 'fixture', claim: 'fixture', status: 'VERIFIED', sourceName: 'British Geological Survey (BGS)', sourceUrl: 'https://map.bgs.ac.uk/', datasetDate: '2026-09-09', spatialRelationship: 'site', calculationMethod: 'fixture', confidence: 'High', value: {}, limitation: 'screening only', ...overrides
});

test('UK structured BGS geology, hydrogeology and borehole context populate report fields consumed by canonical reporting', () => {
  const report: any = {
    geosurvey_context: { geological_unit_name: null, lithology_type: null, geological_period_era: null, groundwater_regime: null },
    soil: { groundwaterRegime: 'Not established' },
    terrain: {
      floodInundationRisk: { status: 'MODELLED', level: 'Low', sourceName: 'OpenStreetMap hydrology' },
      geohazards: {
        landslideSusceptibility: { status: 'MODELLED', level: 'Low', sourceName: 'Terrain model' },
        miningSubsidence: { status: 'REQUIRES_VERIFICATION', classification: 'Not available', sourceName: 'Generic' }
      }
    },
    parcel: { areaCalculatedM2: 1000 },
    infrastructure: { roadAccess: { estimatedDistanceM: 10, directAccessVerified: true } },
    valuation: {},
    evidenceRegistry: []
  };

  const items: UkSiteEvidence[] = [
    base({ id: 'uk-bgs-geology-site', category: 'BGS Geological Map (DiGMapGB)', value: { unitName: 'WARWICKSHIRE GROUP', lithology: 'MUDSTONE, SILTSTONE AND SANDSTONE', geologicalAge: 'CARBONIFEROUS', superficialDeposit: 'ALLUVIUM', superficialLithology: 'CLAY, SILT, SAND AND GRAVEL', scale: '1:50 000' } }),
    base({ id: 'uk-bgs-hydrogeology-site', category: 'Hydrogeology', value: { descriptor: 'Mercia Mudstone; low productivity aquifer; fracture flow', scale: '1:625,000' } }),
    base({ id: 'uk-bgs-boreholes-site', category: 'Boreholes', value: { count: 3, nearestDistanceKm: 0.42, nearestRecordId: 'BH-123' } }),
    base({ id: 'uk-ea-flood-site', category: 'Flood Risk', sourceName: 'Environment Agency', value: { level: 'Moderate', zone: 'Flood Zone 2' } })
  ];

  enrichGeologyFromBgs(report, items);
  assert.equal(report.geosurvey_context.geological_unit_name, 'WARWICKSHIRE GROUP');
  assert.equal(report.geosurvey_context.lithology_type, 'MUDSTONE, SILTSTONE AND SANDSTONE');
  assert.equal(report.geosurvey_context.geological_period_era, 'CARBONIFEROUS');
  assert.match(report.geosurvey_context.groundwater_regime, /low productivity aquifer/i);
  assert.match(report.soil.groundwaterRegime, /fracture flow/i);
  assert.equal(report.geosurvey_context.bgs_borehole_count, 3);
  assert.equal(report.geosurvey_context.bgs_nearest_borehole_distance_km, 0.42);
  assert.equal(report.terrain.floodInundationRisk.status, 'VERIFIED');
  assert.equal(report.terrain.floodInundationRisk.level, 'Moderate');
  assert.match(report.terrain.floodInundationRisk.sourceName, /Environment Agency/i);
});

test('UK BGS enrichment does not invent engineering design parameters', () => {
  const report: any = {
    geosurvey_context: {},
    soil: { estimatedBearingCapacityKpa: undefined, effectiveFrictionAngleDeg: undefined, cohesionKpa: undefined },
    terrain: { floodInundationRisk: {}, geohazards: { landslideSusceptibility: {}, miningSubsidence: {} } },
    parcel: { areaCalculatedM2: 1000 }, infrastructure: { roadAccess: {} }, valuation: {}, evidenceRegistry: []
  };
  enrichGeologyFromBgs(report, [base({ id: 'uk-bgs-geology-site', category: 'BGS Geological Map (DiGMapGB)', value: { unitName: 'TEST FORMATION', lithology: 'MUDSTONE', geologicalAge: 'JURASSIC' } })]);
  assert.equal(report.soil.estimatedBearingCapacityKpa, undefined);
  assert.equal(report.soil.effectiveFrictionAngleDeg, undefined);
  assert.equal(report.soil.cohesionKpa, undefined);
});
