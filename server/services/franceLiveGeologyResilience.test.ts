import test from 'node:test';
import assert from 'node:assert/strict';
import { clearOperationalMetadata } from '../sources/resolver';
import { enrichGeologyFromBrgm, queryFranceSiteEvidence } from './franceSiteEvidenceService';

const liveLikeGeologyCapabilities = `<?xml version="1.0"?>
<WMS_Capabilities><Capability><Request><GetMap/><GetFeatureInfo/></Request><Layer><Name>GEOSERVICES_GEOLOGIE</Name>
  <Layer><Name>SCAN_H_RELIEF_GEOL50_PERIMETRE</Name></Layer>
  <Layer><Name>SCAN_H_RELIEF_GEOL50_SCAN</Name></Layer>
  <Layer><Name>SCAN_H_GEOL50_PERIMETRE</Name></Layer>
  <Layer><Name>SCAN_F_GEOL50_CATALOG</Name></Layer>
  <Layer><Name>GUADELOUPE_GEOL50</Name></Layer>
  <Layer><Name>MARTINIQUE_GEOL50</Name></Layer>
  <Layer><Name>SCAN_H_RELIEF_GEOL50</Name></Layer>
  <Layer><Name>SCAN_D_GEOL50</Name></Layer>
  <Layer><Name>SCAN_F_GEOL250</Name></Layer>
  <Layer><Name>LITHO_1M_SIMPLIFIEE</Name></Layer>
  <Layer><Name>BSS_TOTAL_AVEC_LABEL</Name></Layer>
</Layer></Capability></WMS_Capabilities>`;

const wfsCapabilities = `<?xml version="1.0"?>
<WFS_Capabilities><FeatureTypeList>
  <FeatureType><Name>brgm:LITHO_1M_SIMPLIFIEE</Name></FeatureType>
  <FeatureType><Name>brgm:BSS_TOTAL_AVEC_LABEL</Name></FeatureType>
</FeatureTypeList></WFS_Capabilities>`;

const lithologyFeature = `<?xml version="1.0"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:brgm="urn:brgm">
  <gml:featureMember><brgm:LITHO_1M_SIMPLIFIEE>
    <brgm:LITHOLOGIE>Calcaires voisins</brgm:LITHOLOGIE>
    <brgm:DESCRIPTION>Polygone voisin dans l'enveloppe de recherche</brgm:DESCRIPTION>
    <gml:Polygon><gml:outerBoundaryIs><gml:LinearRing><gml:coordinates>2.3524,48.8562 2.3527,48.8562 2.3527,48.8565 2.3524,48.8565 2.3524,48.8562</gml:coordinates></gml:LinearRing></gml:outerBoundaryIs></gml:Polygon>
  </brgm:LITHO_1M_SIMPLIFIEE></gml:featureMember>
  <gml:featureMember><brgm:LITHO_1M_SIMPLIFIEE>
    <brgm:LITHOLOGIE>Sables, graviers et alluvions</brgm:LITHOLOGIE>
    <brgm:DESCRIPTION>Dépôts détritiques meubles</brgm:DESCRIPTION>
    <gml:Polygon><gml:outerBoundaryIs><gml:LinearRing><gml:coordinates>2.35,48.85 2.36,48.85 2.36,48.86 2.35,48.86 2.35,48.85</gml:coordinates></gml:LinearRing></gml:outerBoundaryIs></gml:Polygon>
  </brgm:LITHO_1M_SIMPLIFIEE></gml:featureMember>
</wfs:FeatureCollection>`;

const emptyFeatures = `<?xml version="1.0"?><wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs"/>`;
const riskCapabilities = `<?xml version="1.0"?><WMS_Capabilities><Capability><Request><GetMap/><GetFeatureInfo/></Request><Layer><Name>GEOSERVICES_RISQUES</Name><Layer><Name>ALEARG</Name></Layer></Layer></Capability></WMS_Capabilities>`;

function response(body: string, type = 'application/xml', status = 200) {
  return new Response(body, { status, headers: { 'content-type': type } });
}

test('France live-like BRGM inventory reaches WFS lithology fallback and keeps only the polygon containing the site point', async () => {
  clearOperationalMetadata();
  const requested: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    if (url.startsWith('https://geoservices.brgm.fr/geologie') && /SERVICE=WMS.*REQUEST=GetCapabilities/i.test(url)) return response(liveLikeGeologyCapabilities);
    if (url.startsWith('https://geoservices.brgm.fr/risques') && /SERVICE=WMS.*REQUEST=GetCapabilities/i.test(url)) return response(riskCapabilities);
    if (url.startsWith('https://geoservices.brgm.fr/geologie') && /SERVICE=WFS.*REQUEST=GetCapabilities/i.test(url)) return response(wfsCapabilities);
    if (/SERVICE=WFS/i.test(url) && /REQUEST=GetFeature/i.test(url) && /TYPENAME=(?:brgm%3A|brgm:)?LITHO_1M_SIMPLIFIEE/i.test(url)) return response(lithologyFeature, 'application/gml+xml');
    if (/SERVICE=WFS/i.test(url) && /REQUEST=GetFeature/i.test(url)) return response(emptyFeatures, 'application/gml+xml');
    if (/REQUEST=GetFeatureInfo/i.test(url)) return response(JSON.stringify({ features: [] }), 'application/json');
    return response('', 'text/plain', 404);
  }) as typeof fetch;

  const items = await queryFranceSiteEvidence(48.8566, 2.3522, fetcher);
  const geology = items.find(item => item.id === 'fr-brgm-geology-site');
  assert.ok(geology);
  assert.equal(geology?.status, 'VERIFIED');
  assert.equal(geology?.spatialScope, 'SITE');
  assert.equal((geology?.value as any).acquisitionMode, 'WFS');
  assert.equal((geology?.value as any).queriedLayer, 'LITHO_1M_SIMPLIFIEE');
  assert.equal((geology?.value as any).scale, '1:1,000,000');
  assert.equal((geology?.value as any).evidenceTier, 3);
  assert.equal((geology?.value as any).unit, null);
  assert.equal((geology?.value as any).lithology, 'Sables, graviers et alluvions');
  assert.notEqual((geology?.value as any).lithology, 'Calcaires voisins');
  assert.match(geology?.calculationMethod || '', /point-in-polygon/i);
  assert.match(geology?.limitation || '', /not a 1:50,000 geological formation map/i);

  const report: any = {};
  enrichGeologyFromBrgm(report, items);
  assert.equal(report.geosurvey_context.geological_unit_name, null);
  assert.equal(report.geosurvey_context.lithology_type, 'Sables, graviers et alluvions');
  assert.equal(report.geosurvey_context.evidence_level, 'VERIFIED');
  assert.equal(report.geosurvey_context.source_scale, '1:1,000,000');

  const featureInfoUrls = requested.filter(url => /REQUEST=GetFeatureInfo/i.test(url));
  assert.ok(featureInfoUrls.every(url => !/PERIMETRE|CATALOG|GUADELOUPE|MARTINIQUE/i.test(url)), 'catalogue/perimeter/overseas layers must not consume geology query attempts');
});
