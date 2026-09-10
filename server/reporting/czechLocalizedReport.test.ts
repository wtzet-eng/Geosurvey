import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCzechLocalizedReport } from './czechLocalizedReport';

function canonicalFixture(): any {
  return {
    countryCode: 'CZ', countryName: 'Czechia',
    support: { countryCode: 'CZ', maturity: 'LIMITED', capabilities: { nationalCadastre: true, nationalGeology: true, nationalBoreholes: true, nationalHydrogeology: true, nationalFlood: false, nationalPlanning: false, nationalValuation: false, nationalRadon: true, nationalMining: true } },
    authorities: { cadastre: 'ČÚZK / KN / RÚIAN', geology: 'Česká geologická služba (ČGS)', flood: 'ČHMÚ', planning: 'Obecní / stavební úřad', valuation: 'Bez podporovaného automatického zdroje' },
    geology: { unitName: 'kvartérní fluviální sedimenty', lithology: 'štěrky, písky a hlíny', geologicalAge: 'kvartér', groundwaterRegime: 'průlinové prostředí', status: 'VERIFIED', sourceName: 'Česká geologická služba (ČGS)', sourceUrl: 'https://cgs.gov.cz/' },
    groundContext: { mapped: null, soilVariability: null, status: 'REQUIRES_VERIFICATION', reasonCode: 'INSUFFICIENT_EVIDENCE' },
    terrain: { elevationM: 198, minElevationM: 196, maxElevationM: 201, localReliefM: 5, slopeDegrees: 1.6, slopePercent: 2.8, aspectCode: 'E', status: 'MODELLED' },
    hazards: {
      landslide: { classification: 'LOW', status: 'VERIFIED', sourceName: 'ČGS' },
      seismic: { classification: 'Low to Very Low', pga: '<0.05g', status: 'MODELLED', sourceName: 'ESHM20' },
      radon: { classification: 'Moderate', status: 'VERIFIED', sourceName: 'ČGS' },
      mining: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'ČGS', reasonCode: 'NO_DATA' }
    },
    flood: { classification: null, status: 'REQUIRES_VERIFICATION', distanceToWaterwayM: 300, sourceName: 'ČHMÚ', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    soil: { texture: 'Sandy loam', bearingCapacity: null, sandPct: 60, siltPct: 25, clayPct: 15, ph: 6.6, status: 'MODELLED', sourceName: 'ISRIC SoilGrids', sourceUrl: 'https://soilgrids.org' },
    planning: { status: 'REQUIRES_VERIFICATION', instrumentName: 'Územní plán / územně plánovací dokumentace', authorityName: 'Obecní / stavební úřad', sourceName: 'Územní plánování', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    infrastructure: { roadName: 'Hlavní', roadType: 'residential', distanceM: 20, directAccess: false, status: 'MODELLED', sourceName: 'OpenStreetMap' },
    utilities: [{ utilityCode: 'WATER', mapped: true, distanceM: 25, status: 'MODELLED', sourceName: 'OpenStreetMap' }],
    environment: { protectedAreaName: null, distanceM: null, status: 'MODELLED', sourceName: 'OpenStreetMap' },
    valuation: { min: null, max: null, median: null, currency: 'CZK', status: 'REQUIRES_VERIFICATION', comparableCount: 0, sourceName: 'No supported national acquisition', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    evidenceScore: { totalScore: 71 },
    sourceRecords: [{ name: 'Česká geologická služba (ČGS)', url: 'https://cgs.gov.cz/', type: 'Geological Survey', status: 'VERIFIED' }],
    evidenceRecords: [
      { id: 'cz-cgs-engineering-geology', category: 'Engineering-geological zoning', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'Česká geologická služba (ČGS)', sourceUrl: 'https://cgs.gov.cz/', datasetDate: '2026-09-10', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'High', limitation: 'raw', value: { code: 'F', name: 'rajón fluviálních sedimentů', characterization: 'proměnlivé zrnitostní složení', typicalRocks: 'štěrky, písky a hlíny', scale: '1:50,000' } },
      { id: 'cz-cgs-hydrogeology', category: 'Hydrogeological context', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'Česká geologická služba (ČGS)', sourceUrl: 'https://cgs.gov.cz/', datasetDate: '2026-09-10', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'High', limitation: 'raw', value: { unit: 'kvartérní fluviální sedimenty', rock: 'štěrky a písky', transmissivity: 'vysoká', description: 'průlinový kolektor', scale: '1:50,000' } },
      { id: 'cz-cgs-borehole-context', category: 'Nearby boreholes', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'Česká geologická služba (ČGS)', sourceUrl: 'https://cgs.gov.cz/', datasetDate: '2026-09-10', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'Medium', limitation: 'raw', value: { searchRadiusM: 5000, nearestDistanceM: 280, boreholes: [{ id: 'A' }], hydrogeologicalBoreholes: [{ id: 'A' }] } },
      { id: 'cz-cuzk-ruian-parcel', category: 'Cadastre & identification', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'ČÚZK — RÚIAN', sourceUrl: 'https://cuzk.gov.cz/', datasetDate: '2026-09-10', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'High', limitation: 'raw', value: { parcelNumber: '123/4', areaM2: 987, landType: 'zastavěná plocha a nádvoří', landUse: 'jiná plocha', cadastralAreaName: 'Staré Město' } },
      { id: 'cz-cuzk-ruian-buildings', category: 'Registered buildings', claim: 'raw English claim', status: 'VERIFIED', sourceName: 'ČÚZK — RÚIAN', sourceUrl: 'https://cuzk.gov.cz/', datasetDate: '2026-09-10', spatialRelationship: 'raw', calculationMethod: 'raw', confidence: 'High', limitation: 'raw', value: { buildingCount: 1, buildings: [{ use: 'objekt k bydlení', floorCount: 2, floorAreaM2: 180, builtUpAreaM2: 105 }] } }
    ]
  };
}

test('Czechia renders a complete Czech report with Czech national evidence narrative', () => {
  const report = renderCzechLocalizedReport(canonicalFixture());
  assert.equal(report.language, 'cs');
  assert.equal(report.titles.executive_summary, 'Souhrnné hodnocení');
  assert.match(report.summary, /Česku/);
  assert.match(report.sections.soil_and_ground.detail, /inženýrskogeologické rajonování/i);
  assert.match(report.sections.soil_and_ground.detail, /Registr vrtů ČGS/i);
  assert.match(report.sections.building_regulations.detail, /ČÚZK RÚIAN/i);
  assert.match(report.sections.building_regulations.detail, /budovy zůstávají z odhadu hodnoty pozemku vyloučeny/i);
  assert.match(report.summary, /Automatická hodnota pozemku se neuvádí/i);
  assert.equal(report.utilitiesChecklist[0].utility, 'Pitná voda');
  assert.equal(report.dataSources[0].verification_status, 'Ověřeno');
});

test('Czech renderer does not fall back to English reader-facing labels', () => {
  const report = renderCzechLocalizedReport(canonicalFixture());
  assert.equal(report.riskMatrix[0].category, 'Sesuvy');
  assert.equal(report.riskMatrix[0].level, 'Nízké');
  assert.match(report.riskMatrix[1].level, /nízké/i);
  assert.match(report.unavailableReasons.planning, /vybranou zemi|oficiálním zdroji/i);
  const serialized = JSON.stringify({ summary: report.summary, titles: report.titles, unavailableReasons: report.unavailableReasons, sections: report.sections, riskMatrix: report.riskMatrix, verificationChecklist: report.verificationChecklist, legalDisclaimers: report.legalDisclaimers });
  assert.doesNotMatch(serialized, /Executive Summary|Requires verification|Recommended Investigations|Mining subsidence|Indicative statistical value|Country coverage/);
});
