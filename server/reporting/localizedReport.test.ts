import assert from 'node:assert/strict';
import test from 'node:test';
import { getCountryProfile } from '../adapters/countries';
import { COUNTRY_ADAPTERS } from '../adapters/countries';
import { VerifiedSiteReport } from '../types';
import { createCanonicalReport } from './canonicalReport';
import { renderLocalizedReport } from './localizedReport';

function fixture(countryCode: 'PL' | 'GB' | 'DE', geologicalUnit = 'German Basin'): VerifiedSiteReport {
  const profile = getCountryProfile(countryCode);
  return {
    id: `fixture-${countryCode}`, generatedAt: '2026-08-20T00:00:00.000Z', countryCode, language: 'en',
    parcel: { status: 'REQUIRES_VERIFICATION', parcelId: 'TECH-123', countryCode, isOfficialGeometry: false, areaCalculatedM2: 1000, cadastralSource: profile.cadastreAuthority, datasetDate: '2026-08-20', limitation: 'fixture' },
    terrain: {
      elevationAmsl: 125, minElevationAmsl: 120, maxElevationAmsl: 130, elevationDifferenceM: 10, averageSlopePercent: 3.5, averageSlopeDegrees: 2, slopeCategory: 'Gentle (2-5°)', aspectDirection: 'North-East',
      floodInundationRisk: { status: 'MODELLED', level: 'Low', distanceToWaterwayM: 220, statutoryZoneStatus: 'Unconfirmed', description: 'fixture', sourceName: profile.floodAuthority, limitation: 'fixture' },
      geohazards: {
        landslideSusceptibility: { status: 'MODELLED', level: 'Low', description: 'fixture', sourceName: profile.geologyAuthority },
        seismicRisk: { status: 'MODELLED', zone: 'Zone A', pgaG: '0.05g', sourceName: 'ESHM20' },
        radonPotential: { status: 'REQUIRES_VERIFICATION', classification: 'Not available', sourceName: 'JRC' },
        miningSubsidence: { status: 'REQUIRES_VERIFICATION', classification: 'Not available', sourceName: profile.geologyAuthority }
      }
    },
    soil: { status: 'MODELLED', geologicalUnit, lithologyType: 'Mercia Mudstone Group', stratigraphicPeriod: 'Triassic', usdaTextureClass: 'Loam', topsoilSandPct: 40, topsoilSiltPct: 40, topsoilClayPct: 20, subsoilSandPct: 35, subsoilSiltPct: 40, subsoilClayPct: 25, meanBulkDensityGcm3: 1.4, meanPhH2O: 6.8, meanOrganicCarbonPct: 2, estimatedWaterTableDepthM: 'Not measured', groundwaterNotice: 'fixture', estimatedBearingCapacityKpa: '180–220 kPa', effectiveFrictionAngleDeg: 28, cohesionKpa: 10, hydraulicConductivityMs: '1e-5 m/s', drainageClass: 'Moderate', frostSusceptibilityClass: 'F2', topsoilStrippingDepthCm: 30, groundwaterRegime: 'Sherwood Sandstone aquifer', isMeasuredBoreholeData: false, sourceName: 'SoilGrids 2.0', sourceUrl: 'https://soilgrids.org', datasetVersion: '2.0', limitation: 'fixture', stratigraphyLayers: [] },
    planning: { status: 'REQUIRES_VERIFICATION', hasLocalPlan: 'Unknown / Requires Municipal Confirmation', planDesignation: profile.planningInstrumentName, permittedUseCategory: 'Unknown', maxFar: 'Unknown', maxCoveragePct: 'Unknown', minBiologicallyActivePct: 'Unknown', maxBuildingHeightM: 'Unknown', setbackRules: profile.standardSetbackRule, authorityName: `${profile.countryName} Planning Authority`, documentRequired: 'Official certificate', sourceName: `${profile.countryName} Planning Authority`, limitation: 'fixture' },
    infrastructure: { roadAccess: { status: 'MODELLED', nearestRoadType: 'residential', nearestRoadName: 'Evidence Road', estimatedDistanceM: 18, directAccessVerified: false, isPaved: true, sourceName: 'OpenStreetMap' }, utilities: [], amenities: [], surroundingBuildingsCount: 2, surroundingLanduse: ['residential'] },
    environment: { natura2000Intersect: false, distanceToNatura2000M: 800, nearestProtectedAreaName: 'Fixture Reserve', landscapeParkOverlay: false, waterProtectionZone: false, status: 'MODELLED', sourceName: 'EEA Natura 2000', limitation: 'fixture' },
    valuation: { status: 'MODELLED', indicativeMinPrice: 100000, indicativeMaxPrice: 140000, indicativeMedianPrice: 120000, indicativePricePerSqm: 120, currency: profile.currency, methodology: 'fixture', comparableEvidenceCount: 0, marketTrendDescription: 'fixture', priceDrivers: [], uncertaintyRating: 'High', disclaimer: 'fixture' },
    evidenceScore: { totalScore: 52, ratingClass: 'Moderate Evidence (50-74)', breakdown: { cadastreAndGeometry: { score: 6, max: 20, rationale: 'fixture' }, terrainAndElevation: { score: 14, max: 20, rationale: 'fixture' }, geologyAndGroundwater: { score: 14, max: 20, rationale: 'fixture' }, infrastructureAndAccess: { score: 12, max: 15, rationale: 'fixture' }, environmentalAndFlood: { score: 2, max: 15, rationale: 'fixture' }, planningAndMarket: { score: 4, max: 10, rationale: 'fixture' } }, verifiedCount: 0, modelledCount: 5, unverifiedCount: 3, summaryExplanation: 'fixture' },
    evidenceRegistry: [{ id: 'geology', category: 'Geology & Soil Mechanics', claim: `Source evidence identifies ${geologicalUnit}`, status: 'MODELLED', sourceName: profile.geologyAuthority, sourceUrl: profile.geologyPortalUrl, datasetDate: '2026-08-20', spatialRelationship: 'fixture', calculationMethod: 'fixture', confidence: 'Medium', limitation: 'fixture', value: { geologicalUnit } }],
    verificationChecklist: [], executiveSummary: 'unused language-coupled engine prose',
    dataSourcesCited: [{ name: profile.geologyAuthority, organization: profile.geologyAuthority, url: profile.geologyPortalUrl, type: 'Geological Survey', status: 'MODELLED' }], statutoryDisclaimers: []
  };
}

test('country and language are independent across PL, GB and DE', () => {
  for (const country of ['PL', 'GB', 'DE'] as const) {
    const profile = getCountryProfile(country);
    const canonical = createCanonicalReport(fixture(country), profile);
    const before = structuredClone(canonical);
    for (const language of ['en', 'de', 'pl']) {
      const rendered = renderLocalizedReport(canonical, language);
      assert.equal(rendered.language, language);
      assert.equal(canonical.countryCode, country);
      assert.equal(canonical.authorities.geology, profile.geologyAuthority);
      assert.deepEqual(canonical, before, `${country} canonical evidence changed while rendering ${language}`);
    }
  }
});

test('every configured country adapter renders all supported report languages without changing evidence', () => {
  for (const [countryCode, profile] of Object.entries(COUNTRY_ADAPTERS)) {
    if (countryCode === 'EU') continue;
    const canonical = createCanonicalReport(fixture((['PL', 'GB', 'DE'].includes(countryCode) ? countryCode : 'DE') as 'PL' | 'GB' | 'DE'), profile);
    canonical.countryCode = countryCode;
    canonical.countryName = profile.countryName;
    const snapshot = structuredClone(canonical);
    for (const language of ['en', 'de', 'pl']) {
      const rendered = renderLocalizedReport(canonical, language);
      assert.equal(rendered.language, language);
      assert.equal(rendered.sections.geohazard_risk.source_cited, profile.geologyAuthority);
      assert.deepEqual(canonical, snapshot);
    }
  }
});

test('German Basin proper name survives English, German and Polish rendering', () => {
  const canonical = createCanonicalReport(fixture('GB', 'German Basin'), getCountryProfile('GB'));
  const expectedNarrative = { en: 'According to', de: 'Nach Angaben', pl: 'Według danych' };
  for (const language of ['en', 'de', 'pl'] as const) {
    const rendered = renderLocalizedReport(canonical, language);
    const geology = rendered.sections.geohazard_risk;
    assert.match(`${geology.summary} ${geology.detail}`, /German Basin/);
    assert.match(`${geology.summary} ${geology.detail}`, new RegExp(expectedNarrative[language]));
    assert.equal(canonical.geology.unitName, 'German Basin');
    assert.equal(canonical.geology.sourceName, 'British Geological Survey (BGS / GeoIndex 1:50 000)');
  }
});

test('Polish reader-facing prose has no known English leakage and preserves source identifiers', () => {
  const canonical = createCanonicalReport(fixture('PL', 'Niecka Mazowiecka'), getCountryProfile('PL'));
  const rendered = renderLocalizedReport(canonical, 'pl');
  const prose = JSON.stringify({ summary: rendered.summary, sections: Object.values(rendered.sections).map(section => ({ summary: section.summary, detail: section.detail, limitation: section.limitation_notice })), checklist: rendered.verificationChecklist.map(item => ({ topic: item.topic, reason: item.reason })), evidence: rendered.evidenceRegistry.map(item => ({ category: item.category, claim: item.claim, spatialRelationship: item.spatialRelationship, calculationMethod: item.calculationMethod, limitation: item.limitation })), disclaimers: rendered.legalDisclaimers, valuation: rendered.valuationMethodology });
  for (const phrase of ['Requires verification', 'Modelled', 'Interpretation boundary', 'No structured hazard records', 'Source cited by analysis', 'Calculation method', 'Known limitation', 'Groundwater', 'Planning confirmation', 'Indicative statistical model']) assert.doesNotMatch(prose, new RegExp(phrase, 'i'));
  assert.equal(canonical.geology.unitName, 'Niecka Mazowiecka');
  assert.equal(canonical.geology.sourceName, 'Państwowy Instytut Geologiczny – PIB (PIG-PIB / CBDG / SMGP)');
  assert.equal(canonical.geology.sourceUrl, 'https://geolog.pgi.gov.pl');
  assert.equal(canonical.evidenceRecords[0].value.geologicalUnit, 'Niecka Mazowiecka');
});

test('landslide presentation never contains flood narrative', () => {
  const canonical = createCanonicalReport(fixture('GB'), getCountryProfile('GB'));
  for (const language of ['en', 'de', 'pl'] as const) {
    const rendered = renderLocalizedReport(canonical, language);
    const landslide = rendered.riskMatrix.find(item => ['Landslide', 'Hangrutschung', 'Osuwiska'].includes(item.category));
    assert.ok(landslide);
    assert.doesNotMatch(landslide.detail, /flood|Hochwasser|powodzi/i);
    assert.match(landslide.detail, /landslide|Hangrutsch|osuwisk/i);
  }
});

test('Polish presentation differentiates unavailable reasons and localizes composite risk text', () => {
  const canonical = createCanonicalReport(fixture('PL', 'Niecka Mazowiecka'), getCountryProfile('PL'));
  canonical.geology.unitName = null;
  canonical.geology.reasonCode = 'NO_DATA';
  canonical.soil.texture = null;
  canonical.soil.reasonCode = 'SOURCE_UNAVAILABLE';
  canonical.hazards.seismic.classification = 'Eurocode 8 Zone 0–1 (Low to Very Low)';
  const rendered = renderLocalizedReport(canonical, 'pl');
  assert.match(rendered.unavailableReasons.geology, /nie zwróciło obiektu/i);
  assert.match(rendered.unavailableReasons.soilTexture, /czasowo niedostępne/i);
  assert.notEqual(rendered.unavailableReasons.geology, rendered.unavailableReasons.soilTexture);
  assert.match(rendered.riskMatrix[1].level, /Niskie do bardzo niskiego/);
  assert.doesNotMatch(rendered.riskMatrix[1].level, /Low|Very Low/);
});

test('canonical report never promotes SoilGrids values to engineering design parameters', () => {
  const canonical = createCanonicalReport(fixture('PL'), getCountryProfile('PL'));
  assert.equal(canonical.soil.bearingCapacity, null);
  const rendered = renderLocalizedReport(canonical, 'pl');
  assert.match(rendered.unavailableReasons.engineeringParameter, /niewystarczające/i);
  assert.doesNotMatch(JSON.stringify(rendered.technicalNarrative), /180.?220\s*kPa|friction|cohesion/i);
});

test('utility presentation is localized from structured canonical facts', () => {
  const canonical = createCanonicalReport(fixture('PL'), getCountryProfile('PL'));
  canonical.utilities = [{ utilityCode: 'ELECTRICITY', mapped: false, distanceM: null, status: 'REQUIRES_VERIFICATION', sourceName: 'OpenStreetMap', reasonCode: 'AUTHORITATIVE_DATA_REQUIRED' }];
  const pl = renderLocalizedReport(canonical, 'pl').utilitiesChecklist[0];
  const de = renderLocalizedReport(canonical, 'de').utilitiesChecklist[0];
  const en = renderLocalizedReport(canonical, 'en').utilitiesChecklist[0];
  assert.equal(pl.utility, 'Energia elektryczna');
  assert.equal(de.utility, 'Strom');
  assert.equal(en.utility, 'Electricity');
  assert.match(pl.status, /właściwy organ/i);
});
