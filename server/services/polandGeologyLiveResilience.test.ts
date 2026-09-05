import assert from 'node:assert/strict';
import test from 'node:test';
import { clearOperationalMetadata } from '../sources/resolver';
import { enrichGeologyFromPgi, queryPolandGeologicalMaps } from './pgiSiteEvidenceService';

const opaqueCapabilities = `<?xml version="1.0"?>
<WMS_Capabilities><Capability><Request><GetCapabilities/><GetMap/><GetFeatureInfo/></Request><Layer>
  <Layer queryable="1"><Name>1</Name><Title>Arkusze mapy</Title></Layer>
  <Layer queryable="1"><Name>2</Name><Title>Granice administracyjne</Title></Layer>
  <Layer queryable="1"><Name>3</Name><Title>Symbole pomocnicze</Title></Layer>
  <Layer queryable="1"><Name>4</Name><Title>Opis mapy</Title></Layer>
  <Layer queryable="1"><Name>5</Name><Title>Jednostki pomocnicze</Title></Layer>
  <Layer queryable="1"><Name>6</Name><Title>Inne obiekty</Title></Layer>
  <Layer queryable="1"><Name>17</Name><Title>Litologia, jednostki geologiczne i geneza utworów</Title></Layer>
</Layer></Capability></WMS_Capabilities>`;

test('Polish geology ranks informative layer titles even when WMS layer names are opaque and sends complete GetFeatureInfo parameters', async () => {
  clearOperationalMetadata();
  const queriedLayers: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('GetCapabilities')) return new Response(opaqueCapabilities, { status: 200, headers: { 'content-type': 'application/xml' } });
    if (url.includes('GetFeatureInfo')) {
      const params = new URL(url).searchParams;
      const layer = params.get('QUERY_LAYERS') || '';
      queriedLayers.push(layer);
      const completeMapContext = params.has('STYLES') && params.get('FORMAT') === 'image/png' && params.get('TRANSPARENT') === 'TRUE';
      if (layer === '17' && completeMapContext) {
        return new Response(JSON.stringify({ features: [{ properties: { jednostka: 'Osady czwartorzędowe', litologia: 'piaski i żwiry', geneza: 'wodnolodowcowa', wiek: 'Plejstocen' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ features: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;

  const evidence = await queryPolandGeologicalMaps(52.2, 21.1, fetcher);
  const detailed = evidence.find(item => item.id === 'pgi-smgp-50k-site');
  assert.equal(detailed?.status, 'VERIFIED');
  assert.equal(((detailed?.value as any)?.queriedLayers || [])[0], '17');
  assert.ok(queriedLayers.includes('17'));

  const report: any = {};
  enrichGeologyFromPgi(report, evidence);
  assert.equal(report.geosurvey_context.geological_unit_name, 'Osady czwartorzędowe');
  assert.equal(report.geosurvey_context.lithology_type, 'piaski i żwiry');
  assert.equal(report.geosurvey_context.genetic_origin, 'wodnolodowcowa');
  assert.equal(report.geosurvey_context.geological_period_era, 'Plejstocen');
  assert.equal(report.geosurvey_context.evidence_level, 'VERIFIED');
});
