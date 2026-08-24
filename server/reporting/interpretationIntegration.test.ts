import assert from 'node:assert/strict';
import test from 'node:test';
import { renderLocalizedReport } from './localizedReport';
import { getCountrySupport } from '../../src/data/countrySupport';

const canonical = {
  countryCode: 'GB', countryName: 'United Kingdom', support: getCountrySupport('GB'),
  authorities: { cadastre: 'HM Land Registry', geology: 'British Geological Survey', flood: 'Environment Agency', planning: 'Local Planning Authority', valuation: 'HM Land Registry' },
  geology: { unitName: 'Mercia Mudstone Group', lithology: 'Mudstone', geologicalAge: 'Triassic', groundwaterRegime: null, status: 'VERIFIED', sourceName: 'British Geological Survey', sourceUrl: 'https://map.bgs.ac.uk/' },
  terrain: { elevationM: 100, slopeDegrees: 2, slopePercent: 3.5, aspectCode: 'N', status: 'MODELLED' },
  hazards: { landslide: { classification: 'LOW', status: 'MODELLED', sourceName: 'BGS' }, seismic: { classification: 'Low', pga: '<0.05g', status: 'MODELLED', sourceName: 'ESHM20' }, radon: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'JRC', reasonCode: 'SOURCE_UNAVAILABLE' }, mining: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'BGS', reasonCode: 'SOURCE_UNAVAILABLE' } },
  flood: { classification: 'LOW', status: 'MODELLED', distanceToWaterwayM: 300, sourceName: 'Environment Agency' },
  soil: { texture: 'Loam', bearingCapacity: null, sandPct: 40, siltPct: 40, clayPct: 20, ph: 7, status: 'MODELLED', sourceName: 'SoilGrids', sourceUrl: 'https://soilgrids.org' },
  planning: { status: 'REQUIRES_VERIFICATION', instrumentName: 'Local Plan', authorityName: 'Local Planning Authority', sourceName: 'Local Planning Authority', reasonCode: 'AUTHORITATIVE_DATA_REQUIRED' },
  infrastructure: { roadName: 'Test Road', roadType: 'residential', distanceM: 20, directAccess: false, status: 'MODELLED', sourceName: 'OpenStreetMap' },
  environment: { protectedAreaName: null, distanceM: null, status: 'MODELLED', sourceName: 'JNCC' },
  valuation: { min: 100000, max: 150000, median: 125000, currency: 'GBP', status: 'MODELLED', comparableCount: 0, sourceName: 'HM Land Registry' },
  evidenceScore: { totalScore: 60 }, sourceRecords: [], evidenceRecords: []
} as any;

test('GB Mercia Mudstone report includes cited published regional interpretation without changing evidence', () => {
  const before = structuredClone(canonical);
  const rendered = renderLocalizedReport(canonical, 'en');
  const geology = rendered.sections.geohazard_risk;
  assert.match(geology.detail, /published regional interpretation/i);
  assert.match(geology.detail, /weathering/i);
  assert.match(geology.source_cited || '', /RR\/01\/02/);
  assert.match(geology.source_cited || '', /British Geological Survey/i);
  assert.deepEqual(canonical, before);
});

test('unknown GB geological unit does not invent a literature interpretation', () => {
  const unknown = structuredClone(canonical);
  unknown.geology.unitName = 'Unknown Formation';
  const rendered = renderLocalizedReport(unknown, 'en');
  assert.doesNotMatch(rendered.sections.geohazard_risk.detail, /published regional interpretation/i);
  assert.equal(rendered.sections.geohazard_risk.source_cited, 'British Geological Survey');
});