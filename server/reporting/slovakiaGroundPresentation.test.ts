import test from 'node:test';
import assert from 'node:assert/strict';
import { CanonicalReport } from './canonicalReport';
import { renderSlovakiaGroundPresentation } from './slovakiaGroundPresentation';

function canonicalSlovakia(): CanonicalReport {
  return {
    countryCode: 'SK',
    evidenceRecords: [
      {
        id: 'sk-sguds-engineering-geology-50k', category: 'Engineering-geological zoning', claim: 'fixture', status: 'VERIFIED',
        sourceName: 'ŠGÚDŠ', sourceUrl: 'https://ags.geology.sk/igr50', datasetDate: '2026-09-09', spatialRelationship: 'site polygon', calculationMethod: 'fixture', confidence: 'High', limitation: 'screening only',
        value: { zone: 'Rajón riečnych náplavov', formation: 'fluviálne sedimenty', scale: '1:50,000' }
      },
      {
        id: 'sk-sguds-hydrogeology', category: 'Hydrogeological context', claim: 'fixture', status: 'VERIFIED',
        sourceName: 'ŠGÚDŠ', sourceUrl: 'https://ags.geology.sk/hg50', datasetDate: '2026-09-09', spatialRelationship: 'site polygon', calculationMethod: 'fixture', confidence: 'Medium', limitation: 'screening only',
        value: { lithology: 'štrky a piesky', permeability: 'medzizrnová', hydrogeologicalFunction: 'kolektor' }
      },
      {
        id: 'sk-sguds-borehole-context', category: 'Borehole / investigation context', claim: 'fixture', status: 'VERIFIED',
        sourceName: 'ŠGÚDŠ', sourceUrl: 'https://ags.geology.sk/vrty', datasetDate: '2026-09-09', spatialRelationship: '5 km', calculationMethod: 'fixture', confidence: 'Medium', limitation: 'vicinity only',
        value: { searchRadiusM: 5000, engineeringBoreholes: [{ distanceM: 420 }], hydrogeologicalBoreholes: [{ distanceM: 710 }, { distanceM: null }] }
      }
    ]
  } as unknown as CanonicalReport;
}

test('Slovak national ground evidence is visible in reader-facing presentation', () => {
  const rendered = renderSlovakiaGroundPresentation(canonicalSlovakia(), 'en');
  assert.ok(rendered);
  assert.match(rendered!.narrative, /Rajón riečnych náplavov/);
  assert.match(rendered!.narrative, /štrky a piesky/);
  assert.match(rendered!.narrative, /1 engineering\/multipurpose and 2 hydrogeological/);
  assert.match(rendered!.narrative, /nearest approximately 420 m/);
  assert.match(rendered!.narrative, /do not establish parcel stratigraphy/i);
  assert.equal(rendered!.engineeringGeology?.scale, '1:50,000');
  assert.equal(rendered!.boreholes?.nearestDistanceM, 420);
});

test('Slovak ground presentation remains country-specific and localized', () => {
  assert.equal(renderSlovakiaGroundPresentation({ countryCode: 'FR', evidenceRecords: [] } as unknown as CanonicalReport, 'en'), null);
  const german = renderSlovakiaGroundPresentation(canonicalSlovakia(), 'de');
  assert.match(german!.narrative, /Ingenieurgeologische Zonierung/);
  assert.match(german!.narrative, /Grundwasserstand/);
});
