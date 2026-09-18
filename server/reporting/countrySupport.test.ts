import test from 'node:test';
import assert from 'node:assert/strict';
import { getCountryProfile } from '../adapters/countries';
import { getCountrySupport } from '../../src/data/countrySupport';
import { createCanonicalReport } from './canonicalReport';
import { renderLocalizedReport } from './localizedReport';

for (const language of ['en', 'de', 'pl']) {
  test(`Unavailable environment does not render a negative finding in ${language}`, () => {
    const raw = rawReport('DE');
    raw.environment.status = 'REQUIRES_VERIFICATION';
    const canonical = createCanonicalReport(raw, getCountryProfile('DE'));
    const failed = renderLocalizedReport(canonical, language).sections.environmental_factors;
    assert.doesNotMatch(failed.summary, /No protected-area|kein Schutzgebietsobjekt|nie zmapowano/);
    canonical.environment.status = 'MODELLED';
    canonical.environment.reasonCode = undefined;
    const empty = renderLocalizedReport(canonical, language).sections.environmental_factors;
    assert.match(empty.summary, /No protected-area|kein Schutzgebietsobjekt|nie zmapowano/);
    canonical.environment.protectedAreaName = 'Test protected area';
    assert.match(renderLocalizedReport(canonical, language).sections.environmental_factors.summary, /Test protected area/);
  });
}
test('Soil-only samples do not establish geological uniformity and contacts fit tasks', () => {
  const canonical = createCanonicalReport(rawReport('DE'), getCountryProfile('DE'));
  canonical.groundContext = { status: 'MODELLED', mapped: null, soilVariability: {
    validSampleCount: 4, variationObserved: false, sourceName: 'SoilGrids'
  } } as any;
  const result = renderLocalizedReport(canonical, 'de');
  assert.equal(result.groundContext.variability_code, 'INSUFFICIENT_EVIDENCE');
  assert.equal(result.groundContext.soil_model_sample_count, 4);
  assert.match(result.verificationChecklist[1].recommendedAuthorityOrExpert, /Geotechnisches/);
  assert.match(result.verificationChecklist[3].recommendedAuthorityOrExpert, /Versorgungsnetzbetreiber/);
});

test('country mismatch suppresses national valuation', () => {
  const raw = rawReport('DE');
  raw.countryLocationMismatch = true;
  const canonical = createCanonicalReport(raw, getCountryProfile('DE'));
  assert.equal(canonical.valuation.min, null);
  assert.equal(canonical.valuation.max, null);
  assert.equal(canonical.valuation.status, 'REQUIRES_VERIFICATION');
  assert.equal(canonical.evidenceRecords.some(item => item.id === 'valuation-indicative-model'), false);
});

test('unresolved coordinate country suppresses Austrian national valuation', () => {
  const raw = rawReport('AT');
  raw.countryLocationUnresolved = true;
  const canonical = createCanonicalReport(raw, getCountryProfile('AT'));
  assert.equal(canonical.valuation.min, null);
  assert.equal(canonical.valuation.max, null);
  assert.equal(canonical.valuation.status, 'REQUIRES_VERIFICATION');
  assert.equal(canonical.valuation.reasonCode, 'SOURCE_UNAVAILABLE');
  assert.equal(canonical.evidenceRecords.some(item => /valuation|market benchmark|price/i.test(`${item.id} ${item.category}`)), false);
  assert.equal(canonical.sourceRecords.some(item => item.type === 'Statistical Market Benchmark'), false);
});

test('country mismatch does not expose selected Austrian authority labels', () => {
  const raw = rawReport('AT');
  raw.countryLocationMismatch = true;
  const canonical = createCanonicalReport(raw, getCountryProfile('AT'));
  const selectedCountryLabels = JSON.stringify({
    authorities: canonical.authorities,
    geology: canonical.geology,
    flood: canonical.flood,
    planning: canonical.planning,
    valuation: canonical.valuation
  });
  assert.doesNotMatch(selectedCountryLabels, /GeoSphere Austria|HORA|Flächenwidmungsplan|Statistik Austria/i);
  assert.match(canonical.authorities.geology, /not queried/i);
  assert.match(canonical.planning.authorityName, /resolved site location/i);
});

test('Belgium preserves the exact verified regional geology source and withholds unsupported valuation', () => {
  const raw = rawReport('BE');
  raw.geosurvey_context = {
    geological_unit_name: 'Formatie van Lillo',
    lithology_type: 'fijn zand',
    geological_period_era: 'Neogeen',
    evidence_level: 'VERIFIED',
    source_name: 'Databank Ondergrond Vlaanderen (DOV) — Tertiair geologische kaart 1:50.000',
    source_url: 'https://www.dov.vlaanderen.be/'
  };
  const canonical = createCanonicalReport(raw, getCountryProfile('BE'));
  assert.equal(canonical.geology.unitName, 'Formatie van Lillo');
  assert.equal(canonical.geology.lithology, 'fijn zand');
  assert.match(canonical.geology.sourceName, /Databank Ondergrond Vlaanderen/);
  assert.equal(canonical.geology.sourceUrl, 'https://www.dov.vlaanderen.be/');
  assert.equal(canonical.valuation.min, null);
  assert.equal(canonical.valuation.max, null);
  assert.equal(canonical.valuation.reasonCode, 'NOT_SUPPORTED_FOR_COUNTRY');
  assert.equal(canonical.flood.classification, null);
  assert.equal(canonical.planning.reasonCode, 'NOT_SUPPORTED_FOR_COUNTRY');
});

function rawReport(countryCode: string): any {
  return {
    countryCode,
    language: 'en',
    parcel: {
      status: 'REQUIRES_VERIFICATION', parcelId: 'FAKE-PARCEL', countryCode, isOfficialGeometry: false,
      areaCalculatedM2: 1000, officialAreaM2: 1000, cadastralSource: 'Configured national cadastre', datasetDate: '2026-08-24', limitation: 'fixture'
    },
    terrain: {
      elevationAmsl: 120, minElevationAmsl: 118, maxElevationAmsl: 122, elevationDifferenceM: 4,
      averageSlopePercent: 2, averageSlopeDegrees: 1.2, slopeCategory: 'Flat (0-2°)', aspectDirection: 'South',
      floodInundationRisk: { status: 'MODELLED', level: 'Low', distanceToWaterwayM: 300, statutoryZoneStatus: 'configured', description: 'configured flood conclusion', sourceName: 'Configured national flood authority', limitation: 'fixture' },
      geohazards: {
        landslideSusceptibility: { status: 'MODELLED', level: 'Low', description: 'terrain context', sourceName: 'Terrain model' },
        seismicRisk: { status: 'MODELLED', zone: 'Eurocode 8 Zone 0–1 (Low to Very Low)', pgaG: '<0.05g', sourceName: 'European seismic context' },
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
    valuation: { status: 'MODELLED', indicativeMinPrice: 123000, indicativeMaxPrice: 456000, indicativeMedianPrice: 250000, indicativePricePerSqm: 250, currency: countryCode === 'PL' ? 'PLN' : 'EUR', methodology: 'Configured baseValuationPerSqm model', comparableEvidenceCount: 0, marketTrendDescription: 'Synthetic valuation', priceDrivers: [], uncertaintyRating: 'High', disclaimer: 'fixture' },
    evidenceScore: {
      totalScore: 61, ratingClass: 'Moderate Evidence (50-74)', verifiedCount: 0, modelledCount: 5, unverifiedCount: 1,
      breakdown: {
        cadastreAndGeometry: { score: 6, max: 20, rationale: 'unverified cadastre' }, terrainAndElevation: { score: 14, max: 20, rationale: 'terrain' },
        geologyAndGroundwater: { score: 14, max: 20, rationale: 'SoilGrids' }, infrastructureAndAccess: { score: 12, max: 15, rationale: 'OSM' },
        environmentalAndFlood: { score: 11, max: 15, rationale: 'OSM context' }, planningAndMarket: { score: 4, max: 10, rationale: 'configured valuation' }
      }, summaryExplanation: 'fixture'
    },
    evidenceRegistry: [
      { id: 'cadastre-spatial-index', category: 'Cadastre & Identification', claim: 'Synthetic parcel conclusion', status: 'REQUIRES_VERIFICATION', sourceName: 'Configured cadastre', datasetDate: '2026-08-24', spatialRelationship: 'fixture', calculationMethod: 'fixture', confidence: 'Medium', limitation: 'fixture' },
      { id: 'terrain-elevation-slope', category: 'Terrain & Topography', claim: 'Terrain evidence', status: 'MODELLED', sourceName: 'Copernicus DEM', datasetDate: '2026-08-24', spatialRelationship: 'fixture', calculationMethod: 'fixture', confidence: 'Medium', limitation: 'fixture' },
      { id: 'soilgrids-profile', category: 'Soil', claim: 'Pedological evidence', status: 'MODELLED', sourceName: 'ISRIC SoilGrids', datasetDate: '2026-08-24', spatialRelationship: 'fixture', calculationMethod: 'fixture', confidence: 'Medium', limitation: 'fixture' },
      { id: 'valuation-indicative-model', category: 'Market Valuation & Economics', claim: 'Synthetic valuation 123000–456000', status: 'MODELLED', sourceName: 'Configured valuation', datasetDate: '2026-08-24', spatialRelationship: 'fixture', calculationMethod: 'fixture', confidence: 'Low', limitation: 'fixture' },
      { id: 'flood-proximity-check', category: 'Hydrology & Flooding', claim: 'Open water 300m away', status: 'MODELLED', sourceName: 'Configured national flood authority', sourceUrl: 'https://example.test/flood', datasetDate: '2026-08-24', spatialRelationship: 'fixture', calculationMethod: 'fixture', confidence: 'Medium', limitation: 'fixture' }
    ],
    verificationChecklist: [], executiveSummary: 'Synthetic valuation 123000–456000 EUR; setback 3.0 m',
    dataSourcesCited: [
      { name: 'Configured cadastre', organization: 'fixture', url: 'https://example.test/cadastre', type: 'Official National Cadastre', status: 'REQUIRES_VERIFICATION' },
      { name: 'Copernicus DEM', organization: 'fixture', url: 'https://example.test/dem', type: 'Elevation DEM', status: 'MODELLED' },
      { name: 'ISRIC SoilGrids', organization: 'fixture', url: 'https://soilgrids.org', type: 'Scientific Soil Database', status: 'MODELLED' },
      { name: 'Configured national geology', organization: 'fixture', url: 'https://example.test/geology', type: 'Geological Survey', status: 'MODELLED' },
      { name: 'Configured national flood', organization: 'fixture', url: 'https://example.test/flood', type: 'Hydrological Registry', status: 'MODELLED' },
      { name: 'OpenStreetMap', organization: 'fixture', url: 'https://openstreetmap.org', type: 'Spatial Overpass', status: 'MODELLED' },
      { name: 'Configured valuation', organization: 'fixture', url: 'https://example.test/value', type: 'Statistical Market Benchmark', status: 'MODELLED' }
    ], statutoryDisclaimers: []
  };
}

function clearFranceValuation(report: any): void {
  report.valuation = { ...report.valuation, status: 'REQUIRES_VERIFICATION', indicativeMinPrice: NaN, indicativeMaxPrice: NaN, indicativeMedianPrice: NaN, indicativePricePerSqm: NaN, comparableEvidenceCount: 0, methodology: 'No sufficient live DVF+ buildable-land evidence' };
  report.evidenceRegistry = report.evidenceRegistry.filter((record: any) => record.id !== 'valuation-indicative-model');
  report.evidenceRegistry.push({ id: 'fr-dvf-land-valuation-no-data', category: 'Land market valuation', claim: 'Insufficient DVF+ buildable-land sample', status: 'REQUIRES_VERIFICATION', sourceName: 'Cerema DVF+', sourceUrl: 'https://www.data.gouv.fr/datasets/dvf-open-data', datasetDate: '2026-08-24', spatialRelationship: 'commune', calculationMethod: 'DVF+ buildable-land query', confidence: 'Low', limitation: 'No generic fallback', value: { reasonCode: 'NO_DATA' } });
  const marketSource = report.dataSourcesCited.find((source: any) => source.type === 'Statistical Market Benchmark');
  marketSource.name = 'Cerema DVF+ open-data'; marketSource.status = 'REQUIRES_VERIFICATION';
  report.evidenceScore.breakdown.planningAndMarket.score = 0;
}

test('country support maturity exposes calibrated valuation and validated Czech, Norway and Denmark capabilities', () => {
  const pl = getCountrySupport('PL'); const gb = getCountrySupport('GB'); const de = getCountrySupport('DE'); const fr = getCountrySupport('FR');
  assert.equal(pl.maturity, 'SUPPORTED'); assert.equal(pl.capabilities.nationalCadastre, true); assert.equal(pl.capabilities.nationalGeology, true);
  assert.equal(gb.maturity, 'SUPPORTED'); assert.equal(gb.capabilities.nationalGeology, true); assert.equal(gb.capabilities.nationalCadastre, false);
  assert.equal(de.maturity, 'LIMITED'); assert.equal(de.capabilities.nationalValuation, true); assert.equal(de.capabilities.nationalCadastre, false); assert.equal(de.capabilities.nationalPlanning, false);
  assert.equal(fr.maturity, 'LIMITED'); assert.equal(fr.capabilities.nationalGeology, true); assert.equal(fr.capabilities.nationalBoreholes, true); assert.equal(fr.capabilities.nationalValuation, true);
  for (const code of ['SK', 'AT', 'ES', 'FI']) {
    const support = getCountrySupport(code); assert.equal(support.maturity, 'LIMITED'); assert.equal(support.capabilities.nationalValuation, true); assert.equal(support.capabilities.nationalCadastre, false);
  }
  const ie = getCountrySupport('IE');
  assert.equal(ie.maturity, 'LIMITED'); assert.equal(ie.capabilities.nationalCadastre, true); assert.equal(ie.capabilities.nationalGeology, true);
  assert.equal(ie.capabilities.nationalBoreholes, true); assert.equal(ie.capabilities.nationalHydrogeology, true); assert.equal(ie.capabilities.nationalValuation, true); assert.equal(ie.capabilities.nationalRadon, true);
  assert.equal(ie.capabilities.nationalFlood, false); assert.equal(ie.capabilities.nationalPlanning, false); assert.equal(ie.capabilities.nationalMining, false);
  const cz = getCountrySupport('CZ');
  assert.equal(cz.maturity, 'LIMITED');
  assert.equal(cz.capabilities.nationalGeology, true); assert.equal(cz.capabilities.nationalBoreholes, true); assert.equal(cz.capabilities.nationalHydrogeology, true);
  assert.equal(cz.capabilities.nationalRadon, true); assert.equal(cz.capabilities.nationalMining, true);
  assert.equal(cz.capabilities.nationalCadastre, true); assert.equal(cz.capabilities.nationalFlood, false); assert.equal(cz.capabilities.nationalPlanning, false); assert.equal(cz.capabilities.nationalValuation, false);
  const se = getCountrySupport('SE');
  assert.equal(se.maturity, 'LIMITED');
  assert.equal(se.capabilities.nationalGeology, true); assert.equal(se.capabilities.nationalBoreholes, true); assert.equal(se.capabilities.nationalHydrogeology, true);
  assert.equal(se.capabilities.nationalCadastre, false); assert.equal(se.capabilities.nationalFlood, false); assert.equal(se.capabilities.nationalPlanning, false); assert.equal(se.capabilities.nationalValuation, false); assert.equal(se.capabilities.nationalRadon, false); assert.equal(se.capabilities.nationalMining, false);
  const no = getCountrySupport('NO');
  assert.equal(no.maturity, 'LIMITED');
  assert.equal(no.capabilities.nationalCadastre, true); assert.equal(no.capabilities.nationalGeology, true); assert.equal(no.capabilities.nationalBoreholes, true); assert.equal(no.capabilities.nationalRadon, true);
  assert.equal(no.capabilities.nationalHydrogeology, false); assert.equal(no.capabilities.nationalFlood, false); assert.equal(no.capabilities.nationalPlanning, false); assert.equal(no.capabilities.nationalValuation, false); assert.equal(no.capabilities.nationalMining, false);
  const dk = getCountrySupport('DK');
  assert.equal(dk.maturity, 'LIMITED');
  assert.equal(dk.capabilities.nationalCadastre, true); assert.equal(dk.capabilities.nationalGeology, true); assert.equal(dk.capabilities.nationalBoreholes, true); assert.equal(dk.capabilities.nationalHydrogeology, true); assert.equal(dk.capabilities.nationalPlanning, true);
  assert.equal(dk.capabilities.nationalFlood, false); assert.equal(dk.capabilities.nationalValuation, false); assert.equal(dk.capabilities.nationalRadon, false); assert.equal(dk.capabilities.nationalMining, false);
  const nl = getCountrySupport('NL');
  assert.equal(nl.maturity, 'LIMITED');
  assert.equal(nl.capabilities.nationalCadastre, true);
  assert.equal(nl.capabilities.nationalGeology, false);
  assert.equal(nl.capabilities.nationalMining, false);
  const lu = getCountrySupport('LU');
  assert.equal(lu.maturity, 'LIMITED');
  assert.equal(lu.capabilities.nationalCadastre, true); assert.equal(lu.capabilities.nationalGeology, true); assert.equal(lu.capabilities.nationalBoreholes, true);
  assert.equal(lu.capabilities.nationalHydrogeology, true); assert.equal(lu.capabilities.nationalFlood, true); assert.equal(lu.capabilities.nationalPlanning, true); assert.equal(lu.capabilities.nationalValuation, true);
  assert.equal(lu.capabilities.nationalRadon, false); assert.equal(lu.capabilities.nationalMining, false);
  const be = getCountrySupport('BE');
  assert.equal(be.maturity, 'LIMITED');
  assert.equal(be.capabilities.nationalCadastre, true); assert.equal(be.capabilities.nationalGeology, true); assert.equal(be.capabilities.nationalBoreholes, false);
  assert.equal(be.capabilities.nationalHydrogeology, false); assert.equal(be.capabilities.nationalFlood, false); assert.equal(be.capabilities.nationalPlanning, false); assert.equal(be.capabilities.nationalValuation, false);
  for (const code of ['IT', 'CH', 'PT', 'HU', 'RO', 'HR', 'GR', 'EE', 'LV', 'LT', 'CY', 'MT', 'SI', 'BG', 'IS', 'EU', 'XX']) {
    const support = getCountrySupport(code); assert.equal(support.maturity, 'LIMITED'); assert.ok(Object.values(support.capabilities).every(value => value === false), code);
  }
});

test('unsupported limited country still withholds national conclusions and valuation', () => {
  const canonical = createCanonicalReport(rawReport('IT'), getCountryProfile('IT'));
  assert.equal(canonical.support.maturity, 'LIMITED');
  assert.equal(canonical.geology.unitName, null); assert.equal(canonical.geology.reasonCode, 'NOT_SUPPORTED_FOR_COUNTRY');
  assert.equal(canonical.flood.classification, null); assert.equal(canonical.flood.reasonCode, 'NOT_SUPPORTED_FOR_COUNTRY');
  assert.equal(canonical.planning.reasonCode, 'NOT_SUPPORTED_FOR_COUNTRY');
  assert.equal(canonical.valuation.min, null); assert.equal(canonical.valuation.max, null); assert.equal(canonical.valuation.reasonCode, 'NOT_SUPPORTED_FOR_COUNTRY');
  assert.equal(canonical.evidenceScore.breakdown.cadastreAndGeometry.max, 0); assert.equal(canonical.evidenceScore.breakdown.planningAndMarket.max, 0);
  assert.ok(!canonical.evidenceRecords.some(record => record.id === 'valuation-indicative-model'));
  assert.ok(!canonical.sourceRecords.some(source => source.type === 'Statistical Market Benchmark'));
});

test('Germany replaces the old generic valuation with the 2025 state benchmark hierarchy', () => {
  const report = rawReport('DE'); report.parcel.commune = 'Potsdam'; report.parcel.voivodeship = 'Brandenburg';
  const canonical = createCanonicalReport(report, getCountryProfile('DE'));
  assert.equal(canonical.support.capabilities.nationalValuation, true); assert.equal(canonical.valuation.status, 'MODELLED');
  assert.equal(canonical.valuation.median, 159000); assert.equal(canonical.valuation.min, 48000); assert.equal(canonical.valuation.max, 636000);
  assert.match(canonical.valuation.sourceName, /Destatis/i); assert.doesNotMatch(canonical.valuation.sourceName, /175/);
  const valuationEvidence = canonical.evidenceRecords.find(record => record.id === 'valuation-indicative-model');
  assert.ok(valuationEvidence); assert.match(valuationEvidence?.claim || '', /German land-value benchmark/i); assert.match(valuationEvidence?.spatialRelationship || '', /STATE benchmark/i);
  assert.match(valuationEvidence?.limitation || '', /Buildings and other improvements are excluded/i); assert.doesNotMatch(valuationEvidence?.claim || '', /123000|456000/);
  const source = canonical.sourceRecords.find(record => record.type === 'Statistical Market Benchmark'); assert.ok(source); assert.match(source?.name || '', /Destatis/i);
  const rendered = renderLocalizedReport(canonical, 'de'); assert.match(rendered.sections.market_and_comparables.summary, /48.?000.*636.?000.*EUR/i); assert.doesNotMatch(JSON.stringify(rendered), /123000|456000/);
});

test('German city benchmark can override a much broader Bundesland average', () => {
  const report = rawReport('DE'); report.parcel.commune = 'München'; report.parcel.voivodeship = 'Bayern';
  const canonical = createCanonicalReport(report, getCountryProfile('DE'));
  assert.equal(canonical.valuation.median, 3455000); assert.match(canonical.valuation.sourceName, /Regionaldatenbank/i);
  const valuationEvidence = canonical.evidenceRecords.find(record => record.id === 'valuation-indicative-model'); assert.match(valuationEvidence?.spatialRelationship || '', /CITY benchmark/i);
});

test('partially integrated France exposes valuation capability but withholds value when DVF evidence is insufficient', () => {
  const report = rawReport('FR'); clearFranceValuation(report);
  report.geosurvey_context = { geological_unit_name: 'Alluvions récentes', lithology_type: 'sables et graviers', geological_period_era: 'Holocène', evidence_level: 'VERIFIED', source_name: 'Bureau de Recherches Géologiques et Minières (BRGM)', source_url: 'https://infoterre.brgm.fr/' };
  const canonical = createCanonicalReport(report, getCountryProfile('FR'));
  assert.equal(canonical.support.capabilities.nationalValuation, true); assert.equal(canonical.geology.unitName, 'Alluvions récentes'); assert.equal(canonical.geology.lithology, 'sables et graviers');
  assert.equal(canonical.valuation.min, null); assert.equal(canonical.valuation.max, null); assert.equal(canonical.valuation.status, 'REQUIRES_VERIFICATION'); assert.match(canonical.valuation.sourceName, /DVF\+/i);
  const rendered = renderLocalizedReport(canonical, 'en'); assert.doesNotMatch(JSON.stringify(rendered), /123000|456000|205\s*EUR/);
});

test('supported Poland keeps the existing regional modelled valuation', () => {
  const report = rawReport('PL'); const canonical = createCanonicalReport(report, getCountryProfile('PL'));
  assert.equal(canonical.support.capabilities.nationalValuation, false); assert.equal(canonical.valuation.status, 'MODELLED');
  assert.equal(canonical.valuation.min, 123000); assert.equal(canonical.valuation.max, 456000); assert.equal(canonical.valuation.median, 250000);
  assert.match(canonical.valuation.sourceName, /LandSurf/); assert.match(canonical.valuation.sourceName, /RCN/); assert.match(canonical.valuation.sourceName, /Cenatorium/); assert.match(canonical.valuation.sourceName, /188 PLN\/m²/);
  assert.doesNotMatch(canonical.valuation.sourceName, /420 PLN\/m²/);
  const valuationEvidence = canonical.evidenceRecords.find(record => record.id === 'valuation-indicative-model'); assert.ok(valuationEvidence); assert.equal(valuationEvidence?.sourceName, canonical.valuation.sourceName);
});

test('placeholder dash is never promoted to a verified geological unit', () => {
  const report = rawReport('SK');
  report.geosurvey_context = { geological_unit_name: 'Not available — national geological map not queried', lithology_type: '-', geological_period_era: 'Not established from open data', evidence_level: 'VERIFIED', source_name: 'ŠGÚDŠ' };
  report.soil.geologicalUnit = '-';
  report.soil.lithologyType = '-';
  report.soil.stratigraphicPeriod = '-';
  const canonical = createCanonicalReport(report, getCountryProfile('SK'));
  assert.equal(canonical.geology.unitName, null);
  assert.equal(canonical.geology.lithology, null);
  assert.equal(canonical.geology.geologicalAge, null);
});
