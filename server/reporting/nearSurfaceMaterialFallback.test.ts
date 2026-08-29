import test from 'node:test';
import assert from 'node:assert/strict';
import { CanonicalReport } from './canonicalReport';
import { renderLocalizedReport } from './localizedReport';
import { localizeSoilTexture, renderNearSurfaceMaterialFallback } from './nearSurfaceMaterial';

function canonicalWithoutMappedGeology(): CanonicalReport {
  return {
    countryCode: 'PL',
    countryName: 'Poland',
    support: {
      maturity: 'SUPPORTED',
      capabilities: {
        nationalCadastre: false,
        nationalGeology: true,
        nationalBoreholes: true,
        nationalHydrogeology: true,
        nationalFlood: false,
        nationalRadon: false,
        nationalMining: false,
        nationalPlanning: false,
        nationalValuation: false
      }
    } as CanonicalReport['support'],
    authorities: { cadastre: 'Geoportal', geology: 'PIG-PIB', flood: 'Wody Polskie', planning: 'MPZP', valuation: 'RCiWN' },
    geology: {
      unitName: null,
      lithology: null,
      geologicalAge: null,
      geneticOrigin: null,
      groundwaterRegime: null,
      status: 'REQUIRES_VERIFICATION',
      sourceName: 'PIG-PIB',
      sourceUrl: 'https://geologia.pgi.gov.pl/',
      reasonCode: 'NO_DATA'
    },
    terrain: { elevationM: 100, minElevationM: 99, maxElevationM: 101, localReliefM: 2, slopeDegrees: 1, slopePercent: 1.7, aspectCode: 'N', status: 'MODELLED' },
    hazards: {
      landslide: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'PIG-PIB' },
      seismic: { classification: 'Low', pga: '<0.05g', status: 'MODELLED', sourceName: 'European seismic context' },
      radon: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'Radon source', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
      mining: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'Mining source', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' }
    },
    flood: { classification: null, status: 'REQUIRES_VERIFICATION', distanceToWaterwayM: 400, sourceName: 'Wody Polskie', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    soil: {
      texture: 'Sandy loam',
      bearingCapacity: null,
      sandPct: 72,
      siltPct: 18,
      clayPct: 10,
      ph: 6.4,
      status: 'MODELLED',
      sourceName: 'ISRIC SoilGrids',
      sourceUrl: 'https://soilgrids.org/'
    },
    planning: { status: 'REQUIRES_VERIFICATION', instrumentName: 'MPZP', authorityName: 'Gmina', sourceName: 'Planning guidance', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    infrastructure: { roadName: 'Road', roadType: 'residential', distanceM: 20, directAccess: false, status: 'MODELLED', sourceName: 'OpenStreetMap' },
    utilities: [],
    environment: { protectedAreaName: null, distanceM: null, status: 'MODELLED', sourceName: 'OpenStreetMap' },
    valuation: { min: 500000, max: 700000, median: 600000, currency: 'PLN', status: 'MODELLED', comparableCount: 0, sourceName: 'GeoSurvey benchmark' },
    evidenceScore: {
      totalScore: 60,
      ratingClass: 'Moderate Evidence (50-74)',
      verifiedCount: 0,
      modelledCount: 3,
      unverifiedCount: 2,
      breakdown: {
        cadastreAndGeometry: { score: 0, max: 0, rationale: 'fixture' },
        terrainAndElevation: { score: 15, max: 20, rationale: 'fixture' },
        geologyAndGroundwater: { score: 5, max: 20, rationale: 'fixture' },
        infrastructureAndAccess: { score: 10, max: 15, rationale: 'fixture' },
        environmentalAndFlood: { score: 10, max: 15, rationale: 'fixture' },
        planningAndMarket: { score: 0, max: 0, rationale: 'fixture' }
      },
      summaryExplanation: 'fixture'
    },
    sourceRecords: [],
    evidenceRecords: []
  };
}

test('Polish report retains sandy near-surface evidence when mapped geology is unavailable', () => {
  const canonical = canonicalWithoutMappedGeology();
  const rendered = renderLocalizedReport(canonical, 'pl');
  const geology = rendered.sections.geohazard_risk;

  assert.match(geology.summary, /Jednostka geologiczna nie jest dostępna/i);
  assert.match(geology.detail, /Materiał przypowierzchniowy — model glebowy/i);
  assert.match(geology.detail, /glina piaszczysta/i);
  assert.match(geology.detail, /przewagę frakcji piaszczystej/i);
  assert.match(geology.detail, /piasek 72%/i);
  assert.match(geology.detail, /ISRIC SoilGrids/i);
  assert.match(geology.detail, /Nie potwierdza litologii geologicznej/i);
  assert.match(geology.source_cited || '', /PIG-PIB/);
  assert.match(geology.source_cited || '', /ISRIC SoilGrids/);
  assert.doesNotMatch(geology.summary, /piaski|piasek/i);
  assert.match(rendered.sections.soil_and_ground.summary, /glina piaszczysta/i);
});

test('near-surface fallback never replaces an available mapped geological unit', () => {
  const canonical = canonicalWithoutMappedGeology();
  canonical.geology.unitName = 'Piaski i żwiry wodnolodowcowe';
  canonical.geology.lithology = 'piaski i żwiry';
  canonical.geology.status = 'VERIFIED';
  canonical.geology.reasonCode = undefined;

  assert.equal(renderNearSurfaceMaterialFallback(canonical, 'pl'), null);
  const rendered = renderLocalizedReport(canonical, 'pl');
  assert.match(rendered.sections.geohazard_risk.summary, /Piaski i żwiry wodnolodowcowe/);
  assert.doesNotMatch(rendered.sections.geohazard_risk.detail, /Materiał przypowierzchniowy — model glebowy/i);
});

test('USDA texture classes are localized for reader-facing Polish soil text', () => {
  assert.equal(localizeSoilTexture('Sandy loam', 'pl'), 'glina piaszczysta');
  assert.equal(localizeSoilTexture('Loamy sand', 'pl'), 'piasek gliniasty');
  assert.equal(localizeSoilTexture('Clay', 'pl'), 'ił');
});