import test from 'node:test';
import assert from 'node:assert/strict';
import { clearOperationalMetadata } from '../sources/resolver';
import { getCountrySupport } from '../../src/data/countrySupport';
import { enrichGeologyFromBrgm, queryFranceSiteEvidence } from './franceSiteEvidenceService';

const geologyCapabilities = `<?xml version="1.0"?>
<WMS_Capabilities><Capability><Request><GetMap/><GetFeatureInfo/></Request>
<Layer><Name>GEOSERVICES_GEOLOGIE</Name>
  <Layer><Name>SCAN_H_RELIEF_GEOL50</Name></Layer>
  <Layer><Name>LITHO_1M_SIMPLIFIEE</Name></Layer>
  <Layer><Name>BSS_TOTAL_AVEC_LABEL</Name></Layer>
</Layer></Capability></WMS_Capabilities>`;

const riskCapabilities = `<?xml version="1.0"?>
<WMS_Capabilities><Capability><Request><GetMap/><GetFeatureInfo/></Request>
<Layer><Name>GEOSERVICES_RISQUES</Name><Layer><Name>ALEARG</Name></Layer></Layer>
</Capability></WMS_Capabilities>`;

const bssCapabilities = `<?xml version="1.0"?>
<WFS_Capabilities><FeatureTypeList><FeatureType><Name>BSS_TOTAL_AVEC_LABEL</Name></FeatureType></FeatureTypeList></WFS_Capabilities>`;

const bssFeatures = `<?xml version="1.0"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:brgm="urn:brgm">
  <gml:featureMember><brgm:BSS_TOTAL_AVEC_LABEL><brgm:CODE_BSS>BSS001</brgm:CODE_BSS><brgm:NATURE>Forage</brgm:NATURE><brgm:PROFONDEUR>18 m</brgm:PROFONDEUR><gml:Point><gml:coordinates>2.3525,48.8568</gml:coordinates></gml:Point></brgm:BSS_TOTAL_AVEC_LABEL></gml:featureMember>
  <gml:featureMember><brgm:BSS_TOTAL_AVEC_LABEL><brgm:CODE_BSS>BSS002</brgm:CODE_BSS><brgm:NATURE>Sondage</brgm:NATURE><gml:Point><gml:coordinates>2.3600,48.8600</gml:coordinates></gml:Point></brgm:BSS_TOTAL_AVEC_LABEL></gml:featureMember>
</wfs:FeatureCollection>`;

function response(body: string, type = 'application/xml', status = 200) {
  return new Response(body, { status, headers: { 'content-type': type } });
}

function successfulFetcher(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('https://geoservices.brgm.fr/geologie') && /SERVICE=WMS.*REQUEST=GetCapabilities/i.test(url)) return response(geologyCapabilities);
    if (url.startsWith('https://geoservices.brgm.fr/risques') && /SERVICE=WMS.*REQUEST=GetCapabilities/i.test(url)) return response(riskCapabilities);
    if (url.startsWith('https://geoservices.brgm.fr/geologie') && /SERVICE=WFS.*REQUEST=GetCapabilities/i.test(url)) return response(bssCapabilities);
    if (url.startsWith('https://geoservices.brgm.fr/geologie') && /SERVICE=WFS.*REQUEST=GetFeature/i.test(url)) return response(bssFeatures, 'application/gml+xml');
    if (url.includes('QUERY_LAYERS=SCAN_H_RELIEF_GEOL50')) return response(JSON.stringify({ features: [{ properties: { FORMATION: 'Alluvions récentes', LITHOLOGIE: 'sables et graviers', AGE: 'Holocène' } }] }), 'application/json');
    if (url.includes('QUERY_LAYERS=ALEARG')) return response(JSON.stringify({ features: [{ properties: { CLASSE: 'Moyen' } }] }), 'application/json');
    return response('', 'text/plain', 404);
  }) as typeof fetch;
}

test('France country pack activates geology and borehole capability without pretending full national coverage', () => {
  const support = getCountrySupport('FR');
  assert.equal(support.maturity, 'LIMITED');
  assert.equal(support.capabilities.nationalGeology, true);
  assert.equal(support.capabilities.nationalBoreholes, true);
  assert.equal(support.capabilities.nationalCadastre, false);
  assert.equal(support.capabilities.nationalPlanning, false);
  assert.equal(support.capabilities.nationalValuation, false);
});

test('France evidence prefers BRGM detailed geology, keeps BSS as vicinity context, and retains shrink-swell screening', async () => {
  clearOperationalMetadata();
  const items = await queryFranceSiteEvidence(48.8566, 2.3522, successfulFetcher());
  const geology = items.find(item => item.id === 'fr-brgm-geology-site');
  const bss = items.find(item => item.id === 'fr-brgm-bss-context');
  const clay = items.find(item => item.id === 'fr-brgm-shrink-swell-site');

  assert.ok(geology);
  assert.equal(geology?.status, 'VERIFIED');
  assert.equal((geology?.value as any).queriedLayer, 'SCAN_H_RELIEF_GEOL50');
  assert.equal((geology?.value as any).unit, 'Alluvions récentes');
  assert.equal((geology?.value as any).lithology, 'sables et graviers');
  assert.equal((geology?.value as any).age, 'Holocène');
  assert.equal((geology?.value as any).evidenceTier, 1);

  assert.ok(bss);
  assert.equal(bss?.status, 'VERIFIED');
  assert.equal(bss?.spatialScope, 'VICINITY');
  assert.equal((bss?.value as any).observationCount, 2);
  assert.equal((bss?.value as any).nearestRecordId, 'BSS001');
  assert.match(bss?.limitation || '', /do not prove the strata/i);

  assert.ok(clay);
  assert.equal(clay?.status, 'VERIFIED');
  assert.equal((clay?.value as any).descriptor, 'Moyen');
  assert.match(clay?.limitation || '', /not proof of the parcel soil profile/i);

  const report: any = {};
  enrichGeologyFromBrgm(report, items);
  assert.equal(report.geosurvey_context.geological_unit_name, 'Alluvions récentes');
  assert.equal(report.geosurvey_context.lithology_type, 'sables et graviers');
  assert.equal(report.geosurvey_context.geological_period_era, 'Holocène');
  assert.equal(report.geosurvey_context.evidence_level, 'VERIFIED');
  assert.equal(report.geosurvey_context.fr_bss_context.observationCount, 2);
  assert.equal(report.geosurvey_context.fr_shrink_swell_context.descriptor, 'Moyen');
});

test('nearby BSS evidence never manufactures a geological unit when the mapped geology query has no usable attributes', async () => {
  clearOperationalMetadata();
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('https://geoservices.brgm.fr/geologie') && /SERVICE=WMS.*REQUEST=GetCapabilities/i.test(url)) return response(geologyCapabilities);
    if (url.startsWith('https://geoservices.brgm.fr/risques') && /SERVICE=WMS.*REQUEST=GetCapabilities/i.test(url)) return response(riskCapabilities);
    if (url.startsWith('https://geoservices.brgm.fr/geologie') && /SERVICE=WFS.*REQUEST=GetCapabilities/i.test(url)) return response(bssCapabilities);
    if (url.startsWith('https://geoservices.brgm.fr/geologie') && /SERVICE=WFS.*REQUEST=GetFeature/i.test(url)) return response(bssFeatures, 'application/gml+xml');
    if (url.includes('QUERY_LAYERS=ALEARG')) return response(JSON.stringify({ features: [{ properties: { CLASSE: 'Faible' } }] }), 'application/json');
    if (/REQUEST=GetFeatureInfo/i.test(url)) return response(JSON.stringify({ features: [] }), 'application/json');
    return response('', 'text/plain', 404);
  }) as typeof fetch;

  const items = await queryFranceSiteEvidence(48.8566, 2.3522, fetcher);
  assert.ok(items.some(item => item.id === 'fr-brgm-geology-no-data' && item.reasonCode === 'NO_DATA'));
  assert.ok(items.some(item => item.id === 'fr-brgm-bss-context'));
  const report: any = {};
  enrichGeologyFromBrgm(report, items);
  assert.equal(report.geosurvey_context.geological_unit_name, null);
  assert.equal(report.geosurvey_context.lithology_type, null);
  assert.equal(report.geosurvey_context.evidence_level, 'REQUIRES_VERIFICATION');
  assert.equal(report.geosurvey_context.fr_bss_context.observationCount, 2);
});
