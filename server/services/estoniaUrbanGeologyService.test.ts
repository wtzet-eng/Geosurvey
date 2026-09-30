import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichEstoniaUrbanEvidence, queryEstoniaUrbanGeology } from './estoniaUrbanGeologyService';

function response(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/xml' } });
}

const surveyXml = `<?xml version="1.0"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:maaamet="maaamet">
  <gml:featureMember><maaamet:EHITUSGEOLOOGIA_ALA_LIIK fid="survey.42">
    <maaamet:ID>42</maaamet:ID><maaamet:VIIT>https://www.maaamet.ee/egf/index.php?lht=aru&amp;id=42</maaamet:VIIT>
    <maaamet:NIMI>Test geotechnical study Tallinn</maaamet:NIMI><maaamet:AASTA>2020</maaamet:AASTA>
    <maaamet:LIIK_TXT>geotehniline uuring</maaamet:LIIK_TXT><maaamet:STAADIUM_TXT>eelprojekt</maaamet:STAADIUM_TXT>
    <maaamet:MAX_SYGAV>18.5</maaamet:MAX_SYGAV><maaamet:ORIG_AADRESS>Tallinn, Test 1</maaamet:ORIG_AADRESS>
    <maaamet:GEOM_ALA><gml:Polygon srsName="EPSG:3301"><gml:outerBoundaryIs><gml:LinearRing>
      <gml:coordinates>551300,6585450 551500,6585450 551500,6585700 551300,6585700 551300,6585450</gml:coordinates>
    </gml:LinearRing></gml:outerBoundaryIs></gml:Polygon></maaamet:GEOM_ALA>
  </maaamet:EHITUSGEOLOOGIA_ALA_LIIK></gml:featureMember>
</wfs:FeatureCollection>`;

const parnuRiskXml = `<?xml version="1.0"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:ms="http://mapserver.gis.umn.edu/mapserver">
  <gml:featureMember><ms:ehgeol_lihkeoht_2024 fid="risk.10"><ms:id>10</ms:id><ms:klass>savi_potents</ms:klass><ms:pinnas>savi</ms:pinnas>
    <ms:msGeometry><gml:Polygon srsName="EPSG:3301"><gml:outerBoundaryIs><gml:LinearRing>
      <gml:coordinates>528900,6471600 529300,6471600 529300,6472050 528900,6472050 528900,6471600</gml:coordinates>
    </gml:LinearRing></gml:outerBoundaryIs></gml:Polygon></ms:msGeometry>
  </ms:ehgeol_lihkeoht_2024></gml:featureMember>
</wfs:FeatureCollection>`;

const tartuWaterXml = `<?xml version="1.0"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:ms="http://mapserver.gis.umn.edu/mapserver">
  <gml:featureMember><ms:veetase_kuni_1_75_m fid="water.1"><ms:ID>2454</ms:ID>
    <ms:msGeometry><gml:Polygon srsName="EPSG:3301"><gml:outerBoundaryIs><gml:LinearRing>
      <gml:coordinates>659300,6473700 659900,6473700 659900,6474400 659300,6474400 659300,6473700</gml:coordinates>
    </gml:LinearRing></gml:outerBoundaryIs></gml:Polygon></ms:msGeometry>
  </ms:veetase_kuni_1_75_m></gml:featureMember>
</wfs:FeatureCollection>`;

test('Estonia building-geology query returns nearby construction survey evidence', async () => {
  const result = await queryEstoniaUrbanGeology(59.405, 24.905, async () => response(surveyXml));
  const item = result.evidence.find(e => e.id === 'ee-egt-building-geology-surveys');
  assert.ok(item);
  assert.equal(item.status, 'VERIFIED');
  assert.equal((item.value as any).recordCount, 1);
  assert.equal((item.value as any).examples[0].type, 'geotehniline uuring');
  assert.equal((item.value as any).examples[0].maxDepthM, 18.5);
  assert.equal((item.value as any).examples[0].containsSite, true);
});

test('Pärnu specialist landslide layer is only reported on actual polygon overlap', async () => {
  const result = await queryEstoniaUrbanGeology(58.3859, 24.4971, async url => {
    if (String(url).includes('ehgeol_lihkeoht_2024')) return response(parnuRiskXml);
    return response('<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs"/>');
  });
  const item = result.evidence.find(e => e.id === 'ee-parnu-2024-landslide-risk');
  assert.ok(item);
  assert.equal(item.status, 'VERIFIED');
  assert.deepEqual((item.value as any).classes, ['potential clay-slide area']);
});

test('Tartu water-level-rise model remains explicitly modelled', async () => {
  const result = await queryEstoniaUrbanGeology(58.3776, 26.729, async url => {
    if (String(url).includes('veetase_kuni_1_75_m')) return response(tartuWaterXml);
    return response('<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs"/>');
  });
  const item = result.evidence.find(e => e.id === 'ee-tartu-water-level-rise-1-75m');
  assert.ok(item);
  assert.equal(item.status, 'MODELLED');
  assert.equal((item.value as any).modelledRiseM, 1.75);
});

test('absence of building-geology records does not become a negative finding', async () => {
  const result = await queryEstoniaUrbanGeology(59.405, 24.905, async () => response('<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs"/>'));
  const item = result.evidence.find(e => e.id === 'ee-egt-building-geology-open');
  assert.ok(item);
  assert.equal(item.status, 'REQUIRES_VERIFICATION');
  assert.match(item.limitation, /not evidence/i);
});

test('urban evidence is added to report context without replacing national context', () => {
  const report: any = { geosurvey_context: { geological_unit_name: 'National fallback' } };
  const evidence: any[] = [{
    id: 'ee-egt-building-geology-surveys', category: 'Urban geology & ground investigations', claim: 'survey', status: 'VERIFIED',
    sourceName: 'Maa- ja Ruumiamet / EGT', sourceUrl: 'https://xgis.maaamet.ee', datasetDate: '2024-12-10',
    spatialRelationship: 'site', calculationMethod: 'fixture', confidence: 'Medium', limitation: 'fixture',
    value: { recordCount: 3, nearestDistanceM: 120, asOf: '2024-12-10', examples: [{ name: 'Example' }] }
  }];
  enrichEstoniaUrbanEvidence(report, evidence);
  assert.equal(report.geosurvey_context.geological_unit_name, 'National fallback');
  assert.equal(report.geosurvey_context.urban_building_geology_survey_count, 3);
  assert.equal(report.geosurvey_context.urban_building_geology_nearest_distance_m, 120);
  assert.equal(report.geosurvey_context.urban_evidence_level, 'VERIFIED');
});
