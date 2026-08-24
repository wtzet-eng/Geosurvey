import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLocalizedReport } from './localizedReport';
import { CanonicalReport } from './canonicalReport';
import { getCountrySupport } from '../../src/data/countrySupport';

const base = (countryCode: 'PL' | 'GB'): CanonicalReport => ({
  countryCode,
  countryName: countryCode === 'PL' ? 'Poland' : 'United Kingdom',
  support: getCountrySupport(countryCode),
  authorities: { cadastre: 'Cadastre', geology: 'Geology authority', flood: 'Flood authority', planning: 'Planning', valuation: 'Valuation' },
  geology: {
    unitName: countryCode === 'PL' ? 'Piaski wodnolodowcowe' : 'Unknown Formation',
    lithology: countryCode === 'PL' ? 'piaski' : 'sandstone',
    geologicalAge: countryCode === 'PL' ? 'Pleistocene' : 'Jurassic',
    groundwaterRegime: null,
    status: 'MODELLED',
    sourceName: countryCode === 'PL' ? 'PGI-PIB' : 'BGS',
    sourceUrl: 'https://example.test/geology'
  },
  terrain: { elevationM: 100, slopeDegrees: 2, slopePercent: 3.5, aspectCode: null, status: 'MODELLED' },
  hazards: {
    landslide: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'source' },
    seismic: { classification: null, pga: null, status: 'REQUIRES_VERIFICATION', sourceName: 'source' },
    radon: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'source' },
    mining: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'source' }
  },
  flood: { classification: null, status: 'REQUIRES_VERIFICATION', distanceToWaterwayM: null, sourceName: 'source' },
  soil: { texture: 'sand', bearingCapacity: null, sandPct: null, siltPct: null, clayPct: null, ph: null, status: 'MODELLED', sourceName: 'SoilGrids', sourceUrl: null },
  planning: { status: 'REQUIRES_VERIFICATION', instrumentName: 'instrument', authorityName: 'authority', sourceName: 'source', reasonCode: 'AUTHORITATIVE_DATA_REQUIRED' },
  infrastructure: { roadName: null, roadType: null, distanceM: null, directAccess: false, status: 'REQUIRES_VERIFICATION', sourceName: 'source' },
  environment: { protectedAreaName: null, distanceM: null, status: 'REQUIRES_VERIFICATION', sourceName: 'source' },
  valuation: { min: 0, max: 0, median: 0, currency: 'EUR', status: 'MODELLED', comparableCount: 0, sourceName: 'source' },
  evidenceScore: { totalScore: 0 } as CanonicalReport['evidenceScore'],
  sourceRecords: [],
  evidenceRecords: []
});

test('Polish live report exposes genesis-aware indicative orientation and not-for-design disclaimer', () => {
  const rendered = renderLocalizedReport(base('PL'), 'pl');
  assert.match(rendered.sections.geohazard_risk.detail, /Piaski wodnolodowcowe/i);
  assert.match(rendered.sections.soil_and_ground.detail, /Orientacyjna ocena geotechniczna: Zmienne \/ zależne od warunków/i);
  assert.match(rendered.sections.soil_and_ground.detail, /nie może być używana do projektowania/i);
});

test('UK live report does not receive the Polish indicative orientation block', () => {
  const rendered = renderLocalizedReport(base('GB'), 'en');
  assert.doesNotMatch(rendered.sections.soil_and_ground.detail, /Indicative geotechnical orientation/i);
});