import test from 'node:test';
import assert from 'node:assert/strict';
import type { VerifiedSiteReport } from '../types';
import {
  CROATIA_HGI_GEOLOGY_WFS,
  enrichCroatiaNationalEvidence,
  queryCroatiaNationalEvidence
} from './croatiaNationalEvidenceService';

const response = (text: string, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => text
}) as Response;

const featureXml = (inside: boolean) => `<?xml version="1.0"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:ge="http://inspire.ec.europa.eu/schemas/ge-core/4.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:xlink="http://www.w3.org/1999/xlink">
  <wfs:member><ge:MappedFeature gml:id="MappedFeature_GeologicUnit1">
    <ge:shape><gml:Surface srsName="EPSG:4326"><gml:patches><gml:PolygonPatch><gml:exterior><gml:LinearRing><gml:posList>${inside ? '15.981 45.814 15.983 45.814 15.983 45.816 15.981 45.816 15.981 45.814' : '16.10 45.80 16.11 45.80 16.11 45.81 16.10 45.81 16.10 45.80'}</gml:posList></gml:LinearRing></gml:exterior></gml:PolygonPatch></gml:patches></gml:Surface></ge:shape>
    <ge:specification xlink:href="${CROATIA_HGI_GEOLOGY_WFS}?SERVICE=WFS&amp;REQUEST=GetFeature&amp;ID=GeologicUnit_1#GeologicUnit_1"/>
  </ge:MappedFeature></wfs:member>
</wfs:FeatureCollection>`;

const unitXml = `<ge:GeologicUnit xmlns:ge="http://inspire.ec.europa.eu/schemas/ge-core/4.0" xmlns:xlink="http://www.w3.org/1999/xlink" gml:id="GeologicUnit_1"><ge:name xsi:nil="true"/><ge:geologicHistory xlink:href="${CROATIA_HGI_GEOLOGY_WFS}?SERVICE=WFS&amp;REQUEST=GetFeature&amp;ID=GeologicEvent_1#GeologicEvent_1"/><ge:composition><ge:CompositionPart><ge:material xlink:href="http://resource.geosciml.org/classifier/cgi/lithology/sedimentary_material"/></ge:CompositionPart></ge:composition></ge:GeologicUnit>`;
const eventXml = `<ge:GeologicEvent xmlns:ge="http://inspire.ec.europa.eu/schemas/ge-core/4.0" xmlns:xlink="http://www.w3.org/1999/xlink"><ge:olderNamedAge xlink:href="http://inspire.ec.europa.eu/codelist/GeochronologicEraValue/holocene"/><ge:youngerNamedAge xlink:href="http://inspire.ec.europa.eu/codelist/GeochronologicEraValue/holocene"/></ge:GeologicEvent>`;

function mockFetch(featureText: string, failed = false): typeof fetch {
  return (async (url: string | URL | Request) => {
    const value = String(url);
    if (failed) return null as unknown as Response;
    if (value.includes('GeologicUnit_1')) return response(unitXml);
    if (value.includes('GeologicEvent_1')) return response(eventXml);
    return response(featureText);
  }) as typeof fetch;
}
test('Croatia HGI geology resolves the exact containing polygon and linked geological event', async () => {
  const items = await queryCroatiaNationalEvidence(45.815, 15.982, mockFetch(featureXml(true)));
  assert.equal(items.length, 1);
  assert.equal(items[0].status, 'VERIFIED');
  assert.equal(items[0].id, 'hr-hgi-geology-site');
  assert.match(String(items[0].claim), /Holocene/);
  assert.match(String(items[0].claim), /sedimentary material/);
  assert.equal((items[0].value as any).scale, '1:300,000');
  assert.equal((items[0].value as any).geologicalAge, 'Holocene');
});

test('Croatia HGI geology does not accept a nearby polygon that misses the exact coordinate', async () => {
  const items = await queryCroatiaNationalEvidence(45.815, 15.982, mockFetch(featureXml(false)));
  assert.equal(items[0].status, 'REQUIRES_VERIFICATION');
  assert.equal((items[0] as any).reasonCode, 'NO_DATA');
});

test('Croatia HGI geology fails closed when the official service is unavailable', async () => {
  const items = await queryCroatiaNationalEvidence(45.815, 15.982, mockFetch('', true));
  assert.equal(items[0].status, 'REQUIRES_VERIFICATION');
  assert.equal((items[0] as any).reasonCode, 'SOURCE_UNAVAILABLE');
});
test('Croatia HGI enrichment exposes mapped geology in the canonical report context without inventing design values', async () => {
  const items = await queryCroatiaNationalEvidence(45.815, 15.982, mockFetch(featureXml(true)));
  const report: any = {
    geosurvey_context: {},
    soil: { geologicalUnit: 'fallback', lithologyType: 'fallback', stratigraphicPeriod: 'fallback' }
  } as unknown as VerifiedSiteReport;
  enrichCroatiaNationalEvidence(report, items);
  assert.equal(report.geosurvey_context.evidence_level, 'VERIFIED');
  assert.match(report.geosurvey_context.geological_unit_name, /Holocene/);
  assert.equal(report.geosurvey_context.lithology_type, 'sedimentary material');
  assert.equal(report.geosurvey_context.geological_period_era, 'Holocene');
  assert.equal(report.soil.geologicalUnit, report.geosurvey_context.geological_unit_name);
});
