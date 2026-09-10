import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDutchLocalizedReport } from './dutchLocalizedReport';

function canonicalFixture(): any {
  return {
    countryCode: 'NL', countryName: 'Netherlands',
    support: { countryCode: 'NL', maturity: 'LIMITED', capabilities: { nationalCadastre: false, nationalGeology: false, nationalBoreholes: false, nationalHydrogeology: false, nationalFlood: false, nationalPlanning: false, nationalValuation: false, nationalRadon: false, nationalMining: false } },
    authorities: { cadastre: 'Kadaster / PDOK', geology: 'TNO-GDN / BRO', flood: 'Rijkswaterstaat / LIWO', planning: 'Gemeente / DSO', valuation: 'Geen ondersteunde automatische bron' },
    geology: { unitName: null, lithology: null, geologicalAge: null, groundwaterRegime: null, status: 'REQUIRES_VERIFICATION', sourceName: 'TNO-GDN / BRO', sourceUrl: 'https://www.dinoloket.nl', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    groundContext: { mapped: null, soilVariability: null, status: 'REQUIRES_VERIFICATION', reasonCode: 'INSUFFICIENT_EVIDENCE' },
    terrain: { elevationM: 2.4, minElevationM: 1.8, maxElevationM: 3.0, localReliefM: 1.2, slopeDegrees: 0.8, slopePercent: 1.4, aspectCode: 'W', status: 'MODELLED' },
    hazards: {
      landslide: { classification: 'LOW', status: 'MODELLED', sourceName: 'European screening model' },
      seismic: { classification: 'Low to Very Low', pga: '<0.05g', status: 'MODELLED', sourceName: 'ESHM20' },
      radon: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'National source', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
      mining: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'National source', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' }
    },
    flood: { classification: null, status: 'REQUIRES_VERIFICATION', distanceToWaterwayM: 300, sourceName: 'Rijkswaterstaat / LIWO', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    soil: { texture: 'Sandy loam', bearingCapacity: null, sandPct: 58, siltPct: 27, clayPct: 15, ph: 6.7, status: 'MODELLED', sourceName: 'ISRIC SoilGrids', sourceUrl: 'https://soilgrids.org' },
    planning: { status: 'REQUIRES_VERIFICATION', instrumentName: 'Omgevingsplan (Omgevingswet / DSO)', authorityName: 'Gemeente / DSO', sourceName: 'DSO', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    infrastructure: { roadName: 'Dorpsstraat', roadType: 'residential', distanceM: 16, directAccess: false, status: 'MODELLED', sourceName: 'OpenStreetMap' },
    utilities: [{ utilityCode: 'WATER', mapped: true, distanceM: 24, status: 'MODELLED', sourceName: 'OpenStreetMap' }],
    environment: { protectedAreaName: null, distanceM: null, status: 'MODELLED', sourceName: 'OpenStreetMap' },
    valuation: { min: null, max: null, median: null, currency: 'EUR', status: 'REQUIRES_VERIFICATION', comparableCount: 0, sourceName: 'No supported national acquisition', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    evidenceScore: { totalScore: 43 },
    sourceRecords: [{ name: 'ISRIC SoilGrids', url: 'https://soilgrids.org', type: 'Soil model', status: 'MODELLED' }],
    evidenceRecords: [
      { id: 'country-support-NL', category: 'Country support', claim: 'raw English support', status: 'REQUIRES_VERIFICATION', sourceName: 'GeoSurvey support matrix', sourceUrl: '', datasetDate: '2026-09-10', spatialRelationship: 'NL', calculationMethod: 'support check', confidence: 'High', limitation: 'raw', value: { reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' } },
      { id: 'soilgrids-site', category: 'Soil model', claim: 'raw English claim', status: 'MODELLED', sourceName: 'ISRIC SoilGrids', sourceUrl: 'https://soilgrids.org', datasetDate: '2026-09-10', spatialRelationship: 'site', calculationMethod: 'model query', confidence: 'Medium', limitation: 'modelled only', value: {} }
    ]
  };
}

test('Netherlands can render a complete Dutch report without inventing unsupported land value', () => {
  const report = renderDutchLocalizedReport(canonicalFixture());
  assert.equal(report.language, 'nl');
  assert.equal(report.titles.executive_summary, 'Samenvattende beoordeling');
  assert.match(report.summary, /Netherlands/);
  assert.match(report.summary, /geen automatische grondwaarde/i);
  assert.match(report.countrySupport.notice, /Kadaster\/PDOK/);
  assert.match(report.countrySupport.notice, /BRO\/DINOloket/);
  assert.match(report.sections.market_and_comparables.summary, /niet ondersteund|bevoegde|bron/i);
  assert.match(report.legalDisclaimers.join(' '), /grond.*Gebouwen.*bouwwerken.*verbeteringen/i);
  assert.equal(report.utilitiesChecklist[0].utility, 'Drinkwater');
  assert.equal(report.dataSources[0].verification_status, 'Gemodelleerd');
});

test('Dutch renderer localizes risk and availability language rather than falling back to English', () => {
  const report = renderDutchLocalizedReport(canonicalFixture());
  assert.equal(report.riskMatrix[0].category, 'Aardverschuivingen');
  assert.equal(report.riskMatrix[0].level, 'Laag');
  assert.match(report.riskMatrix[1].level, /laag/i);
  assert.match(report.unavailableReasons.planning, /geselecteerde land|officiële bron/i);
  const serialized = JSON.stringify({ summary: report.summary, titles: report.titles, unavailableReasons: report.unavailableReasons, sections: report.sections, riskMatrix: report.riskMatrix, verificationChecklist: report.verificationChecklist, legalDisclaimers: report.legalDisclaimers });
  assert.doesNotMatch(serialized, /Executive Summary|Requires verification|Recommended Investigations|Mining subsidence|Indicative statistical value|Country coverage/);
});
