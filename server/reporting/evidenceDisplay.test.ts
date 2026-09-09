import test from 'node:test';
import assert from 'node:assert/strict';
import { applySiteSpecificCountryEvidence, buildEvidenceDisplayRecords, enrichValuationPresentation } from './evidenceDisplay';

const scientificRecord: any = {
  id: 'es-land-valuation', category: 'Land market valuation',
  claim: 'Madrid official urban-land benchmark: approximately 250 €/m².', status: 'MODELLED',
  sourceName: 'MIVAU · Precio Medio del Suelo', sourceUrl: 'https://example.test/spain', datasetDate: '2026-Q1',
  spatialRelationship: 'Madrid province', calculationMethod: 'Official registered land-price statistic normalized to €/m²',
  confidence: 'Medium', limitation: 'Not direct parcel comparables.',
  value: { countryCode: 'ES', scope: 'PROVINCE', benchmarkPricePerSqm: 250, evidenceKind: 'OFFICIAL_TRANSACTION' }
};

test('country-specific evidence retains the scientific claim, method, limitation and structured value', () => {
  const localized: any = [{ ...scientificRecord, category: 'Scientific evidence', claim: 'Evidence record for Scientific evidence.', spatialRelationship: 'Generic spatial text', calculationMethod: 'Generic method', limitation: 'Generic limitation' }];
  const result = buildEvidenceDisplayRecords([scientificRecord], localized);
  assert.equal(result[0].category, 'Land market valuation');
  assert.match(result[0].claim, /250 €\/m²/);
  assert.match(result[0].calculationMethod, /registered land-price statistic/i);
  assert.equal(result[0].limitation, 'Not direct parcel comparables.');
  assert.equal((result[0].value as any).scope, 'PROVINCE');
});

test('localized support notices remain localized rather than being replaced by canonical English text', () => {
  const canonical: any = [{ ...scientificRecord, id: 'country-support-planning', claim: 'English canonical support notice' }];
  const localized: any = [{ ...canonical[0], claim: 'Prüfung erforderlich', category: 'Länderabdeckung' }];
  const result = buildEvidenceDisplayRecords(canonical, localized);
  assert.equal(result[0].claim, 'Prüfung erforderlich');
  assert.equal(result[0].category, 'Länderabdeckung');
});

test('market presentation exposes the actual benchmark provenance rather than repeating the value range', () => {
  const canonical: any = { valuation: { min: 100000, max: 200000, sourceName: scientificRecord.sourceName }, evidenceRecords: [scientificRecord] };
  const presentation: any = { sections: { market_and_comparables: { summary: '100,000–200,000 EUR', detail: 'generic', source_cited: 'generic' } }, valuationMethodology: 'range only' };
  enrichValuationPresentation(canonical, presentation);
  assert.match(presentation.sections.market_and_comparables.detail, /Madrid official urban-land benchmark/i);
  assert.match(presentation.sections.market_and_comparables.detail, /Not direct parcel comparables/i);
  assert.match(presentation.sections.market_and_comparables.source_cited, /2026-Q1/);
  assert.match(presentation.valuationMethodology, /registered land-price statistic/i);
});

test('verified England flood and BGS mining evidence can display without changing UK-wide capability flags', () => {
  const canonical: any = {
    countryCode: 'GB',
    support: { capabilities: { nationalFlood: false, nationalMining: false } },
    flood: { classification: null, status: 'REQUIRES_VERIFICATION', distanceToWaterwayM: null, sourceName: 'Environment Agency', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' },
    hazards: { mining: { classification: null, status: 'REQUIRES_VERIFICATION', sourceName: 'BGS', reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY' } },
    evidenceRecords: []
  };
  const rawReport: any = { evidenceRegistry: [
    { ...scientificRecord, id: 'uk-ea-flood-site', status: 'VERIFIED', sourceName: 'Environment Agency', value: { level: 'High', zone: 'Flood Zone 3' } },
    { ...scientificRecord, id: 'uk-geosure-non-coal-mining', status: 'VERIFIED', sourceName: 'British Geological Survey (BGS)', value: { rating: 'Moderate' } }
  ] };
  const result = applySiteSpecificCountryEvidence(canonical, rawReport);
  assert.equal(result.support.capabilities.nationalFlood, false);
  assert.equal(result.support.capabilities.nationalMining, false);
  assert.equal(result.flood.classification, 'HIGH');
  assert.equal(result.flood.status, 'VERIFIED');
  assert.equal(result.hazards.mining.classification, 'Moderate');
  assert.equal(result.hazards.mining.status, 'VERIFIED');
  assert.ok(result.evidenceRecords.some((record: any) => record.id === 'uk-ea-flood-site'));
  assert.ok(result.evidenceRecords.some((record: any) => record.id === 'uk-geosure-non-coal-mining'));
});
