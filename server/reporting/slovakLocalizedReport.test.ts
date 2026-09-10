import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSlovakLocalizedReport } from './slovakLocalizedReport';

function canonicalFixture(): any {
  return {
    countryCode: 'SK', countryName: 'Slovakia',
    support: { countryCode: 'SK', maturity: 'LIMITED', capabilities: { nationalCadastre: false, nationalGeology: true, nationalBoreholes: true, nationalHydrogeology: true, nationalFlood: false, nationalPlanning: false, nationalValuation: true, nationalRadon: false, nationalMining: false } },
    authorities: { cadastre: 'ÚGKK SR / ESKN', geology: 'ŠGÚDŠ', flood: 'SVP / MŽP SR', planning: 'Obec', valuation: 'Slovak land benchmark' },
    geology: { unitName: 'nivné sedimenty', lithology: 'hliny, piesky a štrky', geologicalAge: 'holocén', groundwaterRegime: 'medzizrnová priepustnosť', status: 'VERIFIED', sourceName: 'Štátny geologický ústav Dionýza Štúra (ŠGÚDŠ)', sourceUrl: 'https://www.geology.sk/' },
    groundContext: { mapped: null, soilVariability: null, status: 'REQUIRES_VERIFICATION', reasonCode: 'INSUFFICIENT_EVIDENCE' },
    terrain: { elevationM: 164, minElevationM: 162, maxElevationM: 166, localReliefM: 4, slopeDegrees: 2.2, slopePercent: 3.8, aspectCode: 'S', status: 'MODELLED' },
    hazards: {
      landslide: { classification: 'MODERATE', status: 'VERIFIED', sourceName: 'ŠGÚDŠ' },
      seismic: { classification: 'Low to Very Low', pga: '<0.05g', status: 'MODELLED', sourceName: 'ESHM20' },
      radon: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'National source', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
      mining: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'National source', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' }
    },
    flood: { classification: null, status: 'REQUIRES_VERIFICATION', distanceToWaterwayM: 250, sourceName: 'SVP / MŽP SR', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    soil: { texture: 'Sandy loam', bearingCapacity: null, sandPct: 60, siltPct: 25, clayPct: 15, ph: 6.5, status: 'MODELLED', sourceName: 'ISRIC SoilGrids', sourceUrl: 'https://soilgrids.org' },
    planning: { status: 'REQUIRES_VERIFICATION', instrumentName: 'Územný plán obce/mesta (ÚPN)', authorityName: 'Obec', sourceName: 'Územné plánovanie', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    infrastructure: { roadName: 'Hlavná', roadType: 'residential', distanceM: 18, directAccess: false, status: 'MODELLED', sourceName: 'OpenStreetMap' },
    utilities: [{ utilityCode: 'WATER', mapped: true, distanceM: 22, status: 'MODELLED', sourceName: 'OpenStreetMap' }],
    environment: { protectedAreaName: null, distanceM: null, status: 'MODELLED', sourceName: 'OpenStreetMap' },
    valuation: { min: 70000, max: 120000, median: 90000, currency: 'EUR', status: 'MODELLED', comparableCount: 0, sourceName: 'ZoznamRealit.SK' },
    evidenceScore: { totalScore: 68 },
    sourceRecords: [{ name: 'Štátny geologický ústav Dionýza Štúra (ŠGÚDŠ)', url: 'https://www.geology.sk/', type: 'Geological Survey', status: 'VERIFIED' }],
    evidenceRecords: [
      { id: 'sk-sguds-engineering-geology-50k', category: 'Engineering-geological zoning', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'Štátny geologický ústav Dionýza Štúra (ŠGÚDŠ)', sourceUrl: 'https://ags.geology.sk/', datasetDate: '2026-09-10', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'High', limitation: 'raw', value: { zone: 'F', formation: 'rajón fluviálnych sedimentov', scale: '1:50,000' } },
      { id: 'sk-sguds-hydrogeology', category: 'Hydrogeological context', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'Štátny geologický ústav Dionýza Štúra (ŠGÚDŠ)', sourceUrl: 'https://ags.geology.sk/', datasetDate: '2026-09-10', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'High', limitation: 'raw', value: { lithology: 'štrky a piesky', permeability: 'medzizrnová', hydrogeologicalFunction: 'kolektor' } },
      { id: 'sk-sguds-borehole-context', category: 'Nearby boreholes', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'Štátny geologický ústav Dionýza Štúra (ŠGÚDŠ)', sourceUrl: 'https://ags.geology.sk/', datasetDate: '2026-09-10', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'Medium', limitation: 'raw', value: { searchRadiusM: 5000, engineeringBoreholes: [{ distanceM: 240 }], hydrogeologicalBoreholes: [] } }
    ]
  };
}

test('Slovakia can render a complete Slovak report without relabelling scientific source names', () => {
  const report = renderSlovakLocalizedReport(canonicalFixture());
  assert.equal(report.language, 'sk');
  assert.equal(report.titles.executive_summary, 'Súhrnné hodnotenie');
  assert.match(report.summary, /Slovensku/);
  assert.match(report.sections.soil_and_ground.detail, /inžinierskogeologické rajónovanie/i);
  assert.match(report.sections.soil_and_ground.detail, /Register vrtov ŠGÚDŠ/i);
  assert.match(report.sections.market_and_comparables.summary, /Orientačná štatistická hodnota pozemku/i);
  assert.match(report.legalDisclaimers.join(' '), /nezahŕňa budovy/i);
  assert.equal(report.dataSources[0].authority, 'Štátny geologický ústav Dionýza Štúra (ŠGÚDŠ)');
  assert.equal(report.dataSources[0].verification_status, 'Overené');
  assert.equal(report.utilitiesChecklist[0].utility, 'Pitná voda');
});

test('Slovak renderer localizes risk and availability language rather than falling back to English', () => {
  const report = renderSlovakLocalizedReport(canonicalFixture());
  assert.equal(report.riskMatrix[0].category, 'Zosuvy');
  assert.equal(report.riskMatrix[0].level, 'Stredné');
  assert.match(report.riskMatrix[1].level, /nízke/i);
  assert.match(report.unavailableReasons.planning, /národná integrácia|príslušného orgánu/i);
  const serialized = JSON.stringify({ summary: report.summary, titles: report.titles, unavailableReasons: report.unavailableReasons, sections: report.sections, riskMatrix: report.riskMatrix, verificationChecklist: report.verificationChecklist, legalDisclaimers: report.legalDisclaimers });
  assert.doesNotMatch(serialized, /Executive summary|Requires verification|What to investigate|Mining subsidence|Indicative statistical value|Country coverage/);
});
