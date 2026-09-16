import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFrEsFiLocalizedReport } from './frEsFiLocalizedReport';

function canonicalFixture(countryCode: string, countryName: string): any {
  return {
    countryCode, countryName,
    support: { countryCode, maturity: 'LIMITED', capabilities: { nationalCadastre: false, nationalGeology: countryCode === 'FR', nationalBoreholes: countryCode === 'FR', nationalHydrogeology: false, nationalFlood: false, nationalPlanning: false, nationalValuation: true, nationalRadon: false, nationalMining: false } },
    authorities: { cadastre: 'Official cadastre', geology: 'National geological survey', flood: 'Flood authority', planning: 'Planning authority', valuation: 'National land valuation source' },
    geology: { unitName: countryCode === 'FR' ? 'Calcaires jurassiques' : null, lithology: null, geologicalAge: null, groundwaterRegime: null, status: countryCode === 'FR' ? 'VERIFIED' : 'REQUIRES_VERIFICATION', sourceName: countryCode === 'FR' ? 'BRGM' : 'National geological survey', sourceUrl: '', reasonCode: countryCode === 'FR' ? undefined : 'NOT_SUPPORTED_FOR_COUNTRY' },
    groundContext: { mapped: null, soilVariability: null, status: 'REQUIRES_VERIFICATION', reasonCode: 'INSUFFICIENT_EVIDENCE' },
    terrain: { elevationM: 123, minElevationM: 120, maxElevationM: 126, localReliefM: 6, slopeDegrees: 3.2, slopePercent: 5.6, aspectCode: 'S', status: 'MODELLED' },
    hazards: { landslide: { classification: 'LOW', status: 'MODELLED', sourceName: 'Screening model' }, seismic: { classification: 'Low to Very Low', pga: '<0.05g', status: 'MODELLED', sourceName: 'ESHM20' }, radon: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'National source', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' }, mining: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'National source', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' } },
    flood: { classification: null, status: 'REQUIRES_VERIFICATION', distanceToWaterwayM: 250, sourceName: 'Flood authority', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    soil: { texture: 'Sandy loam', bearingCapacity: null, sandPct: 55, siltPct: 30, clayPct: 15, ph: 6.5, status: 'MODELLED', sourceName: 'ISRIC SoilGrids', sourceUrl: 'https://soilgrids.org' },
    planning: { status: 'REQUIRES_VERIFICATION', instrumentName: 'Official planning instrument', authorityName: 'Planning authority', sourceName: 'Planning authority', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    infrastructure: { roadName: 'Main road', roadType: 'residential', distanceM: 18, directAccess: false, status: 'MODELLED', sourceName: 'OpenStreetMap' },
    utilities: [{ utilityCode: 'WATER', mapped: true, distanceM: 30, status: 'MODELLED', sourceName: 'OpenStreetMap' }],
    environment: { protectedAreaName: null, distanceM: null, status: 'MODELLED', sourceName: 'OpenStreetMap' },
    valuation: { min: 80000, max: 120000, median: 100000, currency: 'EUR', status: 'MODELLED', comparableCount: 4, sourceName: 'National land valuation source' },
    evidenceScore: { totalScore: 61 },
    sourceRecords: [{ name: 'ISRIC SoilGrids', url: 'https://soilgrids.org', type: 'Soil model', status: 'MODELLED' }],
    evidenceRecords: [{ id: `country-support-${countryCode}`, category: 'Country support', claim: 'raw English support', status: 'REQUIRES_VERIFICATION', sourceName: 'GeoSurvey support matrix', sourceUrl: '', datasetDate: '2026-09-13', spatialRelationship: countryCode, calculationMethod: 'support check', confidence: 'High', limitation: 'raw', value: { reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' } }]
  };
}

for (const [language, code, name, expected] of [
  ['fr', 'FR', 'France', /valeur du terrain|terrain uniquement/i],
  ['es', 'ES', 'Spain', /valor del suelo|solo valor del suelo/i],
  ['fi', 'FI', 'Finland', /maan arvo|vain maan arvo/i]
] as const) {
  test(`${language} renderer produces localized evidence-first land-only report`, () => {
    const report = renderFrEsFiLocalizedReport(canonicalFixture(code, name), language);
    assert.equal(report.language, language);
    assert.match(report.legalDisclaimers.join(' '), expected);
    assert.equal(report.sections.market_and_comparables.evidence_level, 'MODELLED');
    assert.doesNotMatch(report.legalDisclaimers.join(' '), /buildings, structures and other improvements are excluded/i);
  });
}

test('Spanish report preserves source findings and does not call an unavailable environmental query clear', () => {
  const canonical = canonicalFixture('ES', 'Spain');
  canonical.environment = { protectedAreaName: null, distanceM: null, status: 'REQUIRES_VERIFICATION', sourceName: 'OpenStreetMap Overpass', reasonCode: 'SOURCE_UNAVAILABLE' };
  canonical.evidenceRecords.push(
    { id: 'environmental-natura2000', category: 'Environmental & Conservation', claim: 'Environmental spatial query unavailable; no overlap was inferred.', status: 'REQUIRES_VERIFICATION', sourceName: 'OpenStreetMap Overpass', value: { reasonCode: 'SOURCE_UNAVAILABLE' } },
    { id: 'direct-geology', category: 'Geological evidence', claim: 'Mapped sandstone at the site centre.', status: 'VERIFIED', sourceName: 'National geology' }
  );
  const report = renderFrEsFiLocalizedReport(canonical, 'es');
  assert.match(report.sections.environmental_factors.summary, /no est[aá] disponible|no se pudo alcanzar/i);
  assert.doesNotMatch(report.sections.environmental_factors.summary, /No se cartografi[oó] ninguna/);
  assert.match(report.evidenceRegistry.find(item => item.id === 'direct-geology')!.claim, /Mapped sandstone/);
  const environmentRecord = report.evidenceRegistry.find(item => item.id === 'environmental-natura2000')!;
  assert.equal(environmentRecord.sourceName, 'OpenStreetMap Overpass');
  assert.match(environmentRecord.claim, /no est[aá] disponible|no se pudo alcanzar/i);
});
