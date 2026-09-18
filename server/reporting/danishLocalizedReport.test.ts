import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDanishLocalizedReport } from './danishLocalizedReport';

function canonicalFixture(): any {
  return {
    countryCode: 'DK', countryName: 'Denmark',
    support: { countryCode: 'DK', maturity: 'LIMITED', capabilities: { nationalCadastre: true, nationalGeology: false, nationalBoreholes: true, nationalHydrogeology: true, nationalFlood: false, nationalPlanning: true, nationalValuation: false, nationalRadon: false, nationalMining: false } },
    authorities: { cadastre: 'Klimadatastyrelsen / Datafordeleren — Matriklen2', geology: 'GEUS / Jupiter', flood: 'Relevant dansk/kommunal myndighed', planning: 'Københavns Kommune', valuation: 'Ingen understøttet automatisk kilde' },
    geology: { unitName: null, lithology: null, geologicalAge: null, groundwaterRegime: null, status: 'REQUIRES_VERIFICATION', sourceName: 'GEUS', sourceUrl: 'https://data.geus.dk/geusmap/', reasonCode: 'PARAMETER_NOT_PROVIDED' },
    groundContext: { mapped: null, soilVariability: null, status: 'REQUIRES_VERIFICATION', reasonCode: 'INSUFFICIENT_EVIDENCE' },
    terrain: { elevationM: 12, minElevationM: 10, maxElevationM: 14, localReliefM: 4, slopeDegrees: 1.8, slopePercent: 3.1, aspectCode: 'E', status: 'MODELLED' },
    hazards: {
      landslide: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'National source not automated' },
      seismic: { classification: 'Low to Very Low', pga: '<0.05g', status: 'MODELLED', sourceName: 'ESHM20' },
      radon: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'National source not automated', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
      mining: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'National source not automated', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' }
    },
    flood: { classification: null, status: 'REQUIRES_VERIFICATION', distanceToWaterwayM: 260, sourceName: 'Official verification required', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    soil: { texture: 'Sandy loam', bearingCapacity: null, sandPct: 58, siltPct: 27, clayPct: 15, ph: 6.4, status: 'MODELLED', sourceName: 'ISRIC SoilGrids', sourceUrl: 'https://soilgrids.org', reasonCode: undefined },
    planning: { status: 'VERIFIED', instrumentName: 'Lokalplan / kommuneplanramme', authorityName: 'Københavns Kommune', sourceName: 'Plandata.dk', reasonCode: 'AUTHORITATIVE_DATA_REQUIRED' },
    infrastructure: { roadName: 'Testvej', roadType: 'residential', distanceM: 14, directAccess: false, status: 'MODELLED', sourceName: 'OpenStreetMap' },
    utilities: [{ utilityCode: 'WATER', mapped: true, distanceM: 25, status: 'MODELLED', sourceName: 'OpenStreetMap' }],
    environment: { protectedAreaName: null, distanceM: null, status: 'MODELLED', sourceName: 'OpenStreetMap' },
    valuation: { min: null, max: null, median: null, currency: 'DKK', status: 'REQUIRES_VERIFICATION', comparableCount: 0, sourceName: 'No supported national acquisition', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    evidenceScore: { totalScore: 74 },
    sourceRecords: [{ name: 'GEUS', url: 'https://data.geus.dk/geusmap/', type: 'Geological Survey', status: 'VERIFIED' }],
    evidenceRecords: [
      { id: 'terrain-elevation-slope', category: 'Terrain & Topography', claim: 'raw English terrain claim', status: 'MODELLED', sourceName: 'Copernicus DEM', sourceUrl: 'https://example.test/dem', datasetDate: '2026-09-13', spatialRelationship: 'site', calculationMethod: 'model', confidence: 'Medium', limitation: 'screening only' },
      { id: 'dk-datafordeler-cadastre', category: 'Cadastre', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'Datafordeleren — Matriklen2', sourceUrl: 'https://datafordeler.dk/', datasetDate: '2026-09-13', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'High', limitation: 'raw', value: { parcelId: '2000176 12a', registeredAreaM2: 845 } },
      { id: 'dk-jupiter-boreholes', category: 'Nearby boreholes', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'GEUS Jupiter', sourceUrl: 'https://data.geus.dk/', datasetDate: '2026-09-13', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'High', limitation: 'raw', value: { count: 4, nearestDistanceM: 120 } },
      { id: 'dk-jupiter-groundwater', category: 'Groundwater observations', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'GEUS Jupiter', sourceUrl: 'https://data.geus.dk/', datasetDate: '2026-09-13', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'High', limitation: 'raw', value: { count: 2, nearestDistanceM: 850 } },
      { id: 'dk-plandata-localplan', category: 'Planning', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'Plandata.dk', sourceUrl: 'https://geoserver.plandata.dk/', datasetDate: '2024-06-01', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'High', limitation: 'raw', value: { count: 1, plans: [{ planNumber: 'LP-42', name: 'Boligområde ved Testvej', municipality: 'København' }] } }
    ]
  };
}

test('Denmark renders Danish national evidence without English core report leakage', () => {
  const report = renderDanishLocalizedReport(canonicalFixture());
  assert.equal(report.language, 'da');
  assert.equal(report.titles.executive_summary, 'Sammenfatning');
  assert.match(report.summary, /Danmark/);
  assert.match(report.sections.soil_and_ground.detail, /Jupiter/i);
  assert.doesNotMatch(report.sections.soil_and_ground.detail, /GEUS Jordartskort:/i);
  assert.match(report.countrySupport.notice, /Jordartskort.*ikke automatiseret/i);
  assert.match(report.sections.zoning_and_land_use.summary, /Plandata\.dk/i);
  assert.match(report.sections.market_and_comparables.detail, /Bygninger.*udelukket/i);
  assert.equal(report.utilitiesChecklist[0].utility, 'Vand');
  assert.equal(report.dataSources[0].verification_status, 'Verificeret');
  const serialized = JSON.stringify({ summary: report.summary, titles: report.titles, sections: report.sections, riskMatrix: report.riskMatrix, verificationChecklist: report.verificationChecklist });
  assert.doesNotMatch(serialized, /Executive Summary|Requires verification|Nearby boreholes|Indicative statistical value|Country coverage/);
});

test('Denmark does not turn Jupiter observations into parcel groundwater or design values', () => {
  const report = renderDanishLocalizedReport(canonicalFixture());
  assert.equal(report.technicalNarrative.groundwater_depth_m, 'ikke tilgængelig');
  assert.match(report.technicalNarrative.groundwater_notice, /må ikke fortolkes som grundvandstanden/i);
  assert.match(report.sections.soil_and_ground.limitation_notice, /erstatter ikke en geoteknisk undersøgelse/i);
  assert.equal(report.countrySupport.capabilities.nationalCadastre, true);
  assert.equal(report.countrySupport.capabilities.nationalPlanning, true);
  assert.equal(report.countrySupport.capabilities.nationalValuation, false);
});

test('Denmark keeps automatic valuation off and explicitly excludes buildings', () => {
  const report = renderDanishLocalizedReport(canonicalFixture());
  assert.match(report.summary, /Automatisk jordværdi vises ikke/i);
  assert.match(report.valuationMethodology, /Automatisk jordværdi vises ikke/i);
  assert.ok(report.legalDisclaimers.some((item: string) => /Bygninger.*udelukket/i.test(item)));
});


test('Denmark localizes standard evidence records and routes professional checks correctly', () => {
  const fixture = canonicalFixture();
  fixture.planning.authorityName = 'Horsens Kommune Municipal Planning Department (Wydział Architektury / Urbanistyki)';
  const report = renderDanishLocalizedReport(fixture);
  const terrain = report.evidenceRegistry.find((item: any) => item.id === 'terrain-elevation-slope');
  assert.equal(terrain?.category, 'Terræn og topografi');
  assert.match(terrain?.claim || '', /Terrænmodellen/i);
  assert.doesNotMatch(JSON.stringify(report.verificationChecklist), /Wydział Architektury|Urbanistyki/i);
  assert.match(report.verificationChecklist.find((item: any) => /Geoteknisk/i.test(item.topic))?.recommendedAuthorityOrExpert || '', /Geoteknisk rådgiver|ingeniørgeolog/i);
  assert.match(report.verificationChecklist.find((item: any) => /Forsyning/i.test(item.topic))?.recommendedAuthorityOrExpert || '', /forsyningsselskaber|netejere/i);
});

test('Denmark unavailable road and environment do not render false negative findings', () => {
  const fixture = canonicalFixture();
  fixture.infrastructure = { ...fixture.infrastructure, roadName: null, roadType: null, distanceM: null, status: 'REQUIRES_VERIFICATION', reasonCode: 'SOURCE_UNAVAILABLE' };
  fixture.environment = { ...fixture.environment, status: 'REQUIRES_VERIFICATION', reasonCode: 'SOURCE_UNAVAILABLE' };
  const report = renderDanishLocalizedReport(fixture);
  assert.doesNotMatch(report.sections.infrastructure_and_access.summary, /ikke tilgængelig m/i);
  assert.match(report.sections.infrastructure_and_access.summary, /utilgængelig|kunne ikke nås/i);
  assert.doesNotMatch(report.sections.environmental_factors.summary, /ikke identificeret et beskyttet område/i);
});

[executed on device: toma (e8359509-e325-4515-b2ff-2da47ff811ad)]