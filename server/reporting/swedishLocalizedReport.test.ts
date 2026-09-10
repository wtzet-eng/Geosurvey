import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSwedishLocalizedReport } from './swedishLocalizedReport';

function canonicalFixture(): any {
  return {
    countryCode: 'SE', countryName: 'Sweden',
    support: { countryCode: 'SE', maturity: 'LIMITED', capabilities: { nationalCadastre: false, nationalGeology: true, nationalBoreholes: true, nationalHydrogeology: true, nationalFlood: false, nationalPlanning: false, nationalValuation: false, nationalRadon: false, nationalMining: false } },
    authorities: { cadastre: 'Lantmäteriet', geology: 'Sveriges geologiska undersökning (SGU)', flood: 'Myndigheten för samhällsskydd och beredskap (MSB)', planning: 'Kommunen', valuation: 'Ingen stödd automatisk källa' },
    geology: { unitName: 'Svekokarelska orogenen', lithology: 'Granit', geologicalAge: null, groundwaterRegime: null, status: 'VERIFIED', sourceName: 'Sveriges geologiska undersökning (SGU)', sourceUrl: 'https://api.sgu.se/oppnadata/' },
    groundContext: { mapped: null, soilVariability: null, status: 'REQUIRES_VERIFICATION', reasonCode: 'INSUFFICIENT_EVIDENCE' },
    terrain: { elevationM: 28, minElevationM: 25, maxElevationM: 31, localReliefM: 6, slopeDegrees: 2.1, slopePercent: 3.7, aspectCode: 'SW', status: 'MODELLED' },
    hazards: {
      landslide: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'National source not automated' },
      seismic: { classification: 'Low to Very Low', pga: '<0.05g', status: 'MODELLED', sourceName: 'ESHM20' },
      radon: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'National source not automated', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
      mining: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'National source not automated', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' }
    },
    flood: { classification: null, status: 'REQUIRES_VERIFICATION', distanceToWaterwayM: 420, sourceName: 'MSB', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    soil: { texture: 'Sandy loam', bearingCapacity: null, sandPct: 58, siltPct: 27, clayPct: 15, ph: 6.4, status: 'MODELLED', sourceName: 'ISRIC SoilGrids', sourceUrl: 'https://soilgrids.org', reasonCode: undefined },
    planning: { status: 'REQUIRES_VERIFICATION', instrumentName: 'Detaljplan / översiktsplan enligt plan- och bygglagen', authorityName: 'Kommunen', sourceName: 'Kommunal planering', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    infrastructure: { roadName: 'Testvägen', roadType: 'residential', distanceM: 18, directAccess: false, status: 'MODELLED', sourceName: 'OpenStreetMap' },
    utilities: [{ utilityCode: 'WATER', mapped: true, distanceM: 30, status: 'MODELLED', sourceName: 'OpenStreetMap' }],
    environment: { protectedAreaName: null, distanceM: null, status: 'MODELLED', sourceName: 'OpenStreetMap' },
    valuation: { min: null, max: null, median: null, currency: 'SEK', status: 'REQUIRES_VERIFICATION', comparableCount: 0, sourceName: 'No supported national acquisition', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    evidenceScore: { totalScore: 69 },
    sourceRecords: [{ name: 'Sveriges geologiska undersökning (SGU)', url: 'https://api.sgu.se/oppnadata/', type: 'Geological Survey', status: 'VERIFIED' }],
    evidenceRecords: [
      { id: 'se-sgu-surface-geology', category: 'Mapped superficial geology', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'SGU — Jordarter 1:25 000–1:100 000', sourceUrl: 'https://api.sgu.se/', datasetDate: '2026-09-10', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'High', limitation: 'raw', value: { deposit: 'Glacial lera', scale: '1:25 000–1:100 000' } },
      { id: 'se-sgu-bedrock', category: 'Mapped bedrock geology', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'SGU — Berggrund 1:50 000–1:250 000', sourceUrl: 'https://api.sgu.se/', datasetDate: '2026-09-10', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'High', limitation: 'raw', value: { unit: 'Svekokarelska orogenen', rock: 'Granit', scale: '1:50k' } },
      { id: 'se-sgu-well-context', category: 'Nearby wells', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'SGU — Brunnsarkivet', sourceUrl: 'https://api.sgu.se/', datasetDate: '2026-09-10', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'High', limitation: 'raw', value: { count: 4, nearestDistanceM: 175 } },
      { id: 'se-sgu-groundwater-stations', category: 'Observed groundwater network', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'SGU — Grundvattennivåer, observerade', sourceUrl: 'https://api.sgu.se/', datasetDate: '2026-09-10', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'High', limitation: 'raw', value: { count: 2, nearestDistanceM: 2100 } }
    ]
  };
}

test('Sweden renders a complete Swedish report with SGU national evidence narrative', () => {
  const report = renderSwedishLocalizedReport(canonicalFixture());
  assert.equal(report.language, 'sv');
  assert.equal(report.titles.executive_summary, 'Sammanfattning');
  assert.match(report.summary, /Sverige/);
  assert.match(report.sections.soil_and_ground.detail, /SGU jordarter/i);
  assert.match(report.sections.soil_and_ground.detail, /SGU berggrund/i);
  assert.match(report.sections.soil_and_ground.detail, /Brunnsarkivet/i);
  assert.match(report.sections.soil_and_ground.detail, /observerade grundvattennivåer/i);
  assert.match(report.summary, /Automatiskt tomtmarknadsvärde visas inte/i);
  assert.equal(report.utilitiesChecklist[0].utility, 'Vatten');
  assert.equal(report.dataSources[0].verification_status, 'Verifierad');
  assert.match(report.sections.market_and_comparables.detail, /Byggnader.*exkluderade/i);
});

test('Swedish renderer does not turn nearby SGU observations into parcel groundwater or design values', () => {
  const report = renderSwedishLocalizedReport(canonicalFixture());
  assert.equal(report.technicalNarrative.groundwater_depth_m, 'inte tillgängligt');
  assert.match(report.technicalNarrative.groundwater_notice, /får inte tolkas som tomtens grundvattennivå/i);
  assert.match(report.sections.soil_and_ground.limitation_notice, /ersätter inte en geoteknisk undersökning/i);
  assert.match(report.sections.building_regulations.summary, /hämtas inte automatiskt/i);
  assert.equal(report.countrySupport.capabilities.nationalCadastre, false);
  assert.equal(report.countrySupport.capabilities.nationalValuation, false);
});

test('Swedish renderer keeps core reader-facing labels Swedish', () => {
  const report = renderSwedishLocalizedReport(canonicalFixture());
  assert.equal(report.riskMatrix[0].category, 'Ras och skred');
  assert.match(report.riskMatrix[1].level, /låg/i);
  const serialized = JSON.stringify({ summary: report.summary, titles: report.titles, unavailableReasons: report.unavailableReasons, sections: report.sections, riskMatrix: report.riskMatrix, verificationChecklist: report.verificationChecklist, legalDisclaimers: report.legalDisclaimers });
  assert.doesNotMatch(serialized, /Executive Summary|Requires verification|Recommended Investigations|Mining subsidence|Indicative statistical value|Country coverage|Nearby wells are context only/);
});
