import assert from 'node:assert/strict';
import test from 'node:test';
import { getCountrySupport } from '../../src/data/countrySupport';
import { CanonicalReport } from './canonicalReport';
import { renderLocalizedReport } from './localizedReport';

const baseEvidence = {
  status: 'VERIFIED' as const,
  sourceName: 'Państwowy Instytut Geologiczny – PIB',
  sourceUrl: 'https://example.test/wms',
  datasetDate: '2026-08-26',
  spatialRelationship: 'context',
  calculationMethod: 'fixture',
  confidence: 'Medium' as const,
  limitation: 'fixture'
};

function canonicalFixture(): CanonicalReport {
  return {
    countryCode: 'PL',
    countryName: 'Poland',
    support: getCountrySupport('PL'),
    authorities: { cadastre: 'GUGiK', geology: 'PIG-PIB', flood: 'Wody Polskie', planning: 'MPZP', valuation: 'GUS' },
    geology: { unitName: 'Piaski i żwiry', lithology: 'piaski', geologicalAge: 'Czwartorzęd', groundwaterRegime: null, status: 'VERIFIED', sourceName: 'PIG-PIB', sourceUrl: 'https://geolog.pgi.gov.pl' },
    terrain: { elevationM: 100, minElevationM: 98, maxElevationM: 103, localReliefM: 5, slopeDegrees: 1.5, slopePercent: 2.6, aspectCode: 'NE', status: 'MODELLED' },
    hazards: {
      landslide: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'PIG-PIB' },
      seismic: { classification: null, pga: null, status: 'MODELLED', sourceName: 'ESHM20' },
      radon: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'PIG-PIB' },
      mining: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'PIG-PIB' }
    },
    flood: { classification: null, status: 'REQUIRES_VERIFICATION', distanceToWaterwayM: null, sourceName: 'Wody Polskie', reasonCode: 'AUTHORITATIVE_DATA_REQUIRED' },
    soil: { texture: null, bearingCapacity: null, sandPct: null, siltPct: null, clayPct: null, ph: null, status: 'REQUIRES_VERIFICATION', sourceName: 'SoilGrids', sourceUrl: 'https://soilgrids.org', reasonCode: 'SOURCE_UNAVAILABLE' },
    planning: { status: 'REQUIRES_VERIFICATION', instrumentName: 'MPZP', authorityName: 'Gmina', sourceName: 'Gmina', reasonCode: 'AUTHORITATIVE_DATA_REQUIRED' },
    infrastructure: { roadName: null, roadType: null, distanceM: null, directAccess: false, status: 'MODELLED', sourceName: 'OpenStreetMap' },
    environment: { protectedAreaName: null, distanceM: null, status: 'MODELLED', sourceName: 'GDOŚ' },
    valuation: { min: null, max: null, median: null, currency: 'PLN', status: 'REQUIRES_VERIFICATION', comparableCount: 0, sourceName: 'GUS', reasonCode: 'AUTHORITATIVE_DATA_REQUIRED' },
    evidenceScore: {
      totalScore: 50, ratingClass: 'Moderate Evidence (50-74)',
      breakdown: {
        cadastreAndGeometry: { score: 10, max: 20, rationale: 'fixture' }, terrainAndElevation: { score: 15, max: 20, rationale: 'fixture' }, geologyAndGroundwater: { score: 15, max: 20, rationale: 'fixture' }, infrastructureAndAccess: { score: 5, max: 15, rationale: 'fixture' }, environmentalAndFlood: { score: 5, max: 15, rationale: 'fixture' }, planningAndMarket: { score: 0, max: 10, rationale: 'fixture' }
      }, verifiedCount: 3, modelledCount: 2, unverifiedCount: 2, summaryExplanation: 'fixture'
    },
    sourceRecords: [],
    evidenceRecords: [
      { ...baseEvidence, id: 'pgi-mgsp-building-ground-site', category: 'MGśP building-ground conditions', claim: 'raw', value: { descriptor: 'warunki korzystne; grunty niespoiste', scale: '1:50,000' } },
      { ...baseEvidence, id: 'pgi-smgp-documentation-points-context', category: 'SMGP documentation points', claim: 'raw', value: { observationCount: 2, observations: [{ descriptor: 'sonda mechaniczna · piaski i żwiry' }, { descriptor: 'wkop · glina piaszczysta' }] } },
      { ...baseEvidence, id: 'pgi-cbdg-research-points-context', category: 'CBDG research points', claim: 'raw', value: { observationCount: 1, observations: [{ descriptor: 'obserwacja geologiczna · czwartorzęd' }] } },
      { ...baseEvidence, id: 'pgi-mgsp-building-ground-unavailable', category: 'MGśP building-ground conditions', claim: 'raw failure', status: 'REQUIRES_VERIFICATION', value: { reasonCode: 'SOURCE_UNAVAILABLE' as const } }
    ]
  };
}

test('Polish ground section presents successful MGśP and documentation context with one investigation boundary', () => {
  const rendered = renderLocalizedReport(canonicalFixture(), 'pl');
  const detail = rendered.sections.soil_and_ground.detail;
  assert.match(detail, /Kartowany kontekst warunków podłoża MGśP: warunki korzystne; grunty niespoiste/i);
  assert.match(detail, /Punkty dokumentacyjne SMGP: zwrócono 2 kontekstowe obserwacje/i);
  assert.match(detail, /Punkty badawcze CBDG: zwrócono 1 kontekstowe obserwacje/i);
  assert.match(detail, /warunki pod działką potwierdzają dopiero badania terenowe i dokumentacja źródłowa/i);
  assert.doesNotMatch(detail, /The required source|Building-ground conditions|Requires verification/i);
});

test('reader evidence register keeps successful optional context and omits its unavailable diagnostic records', () => {
  const rendered = renderLocalizedReport(canonicalFixture(), 'pl');
  const ids = rendered.evidenceRegistry.map(item => item.id);
  assert.ok(ids.includes('pgi-mgsp-building-ground-site'));
  assert.ok(ids.includes('pgi-smgp-documentation-points-context'));
  assert.ok(ids.includes('pgi-cbdg-research-points-context'));
  assert.equal(ids.includes('pgi-mgsp-building-ground-unavailable'), false);
  const mgsp = rendered.evidenceRegistry.find(item => item.id === 'pgi-mgsp-building-ground-site');
  assert.equal(mgsp?.category, 'Warunki podłoża budowlanego (MGśP)');
  assert.match(mgsp?.claim || '', /warunki korzystne/i);
});
