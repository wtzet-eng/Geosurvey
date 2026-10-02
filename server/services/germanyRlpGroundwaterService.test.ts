import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enrichGermanyRlpGroundwater,
  queryGermanyRlpGroundwater
} from './germanyRlpGroundwaterService';

function xmlResponse(xml: string): Response {
  return new Response(xml, { status: 200, headers: { 'content-type': 'text/xml' } });
}test('Rheinland-Pfalz adapter interpolates GWO-RLP contours and enriches the report', async () => {
  const xml = `
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:ms="http://mapserver.gis.umn.edu/mapserver">
<gml:featureMember><ms:GwGleichen><ms:msGeometry><gml:LineString><gml:posList>441000 5537000 451000 5537000</gml:posList></gml:LineString></ms:msGeometry><ms:OBJECTID>1</ms:OBJECTID><ms:ISO_TYP>2</ms:ISO_TYP><ms:ISOLINIE>92</ms:ISOLINIE></ms:GwGleichen></gml:featureMember>
<gml:featureMember><ms:GwGleichen><ms:msGeometry><gml:LineString><gml:posList>441000 5537500 451000 5537500</gml:posList></gml:LineString></ms:msGeometry><ms:OBJECTID>2</ms:OBJECTID><ms:ISO_TYP>2</ms:ISO_TYP><ms:ISOLINIE>94</ms:ISOLINIE></ms:GwGleichen></gml:featureMember>
</wfs:FeatureCollection>`;
  const fetcher = async () => xmlResponse(xml);
  const result = await queryGermanyRlpGroundwater(50.0, 8.25, 'Rheinland-Pfalz', fetcher, 90);
  assert.equal(result.modelledGroundwaterFound, true);
  const item = result.evidence[0];
  assert.equal(item.status, 'MODELLED');
  assert.equal((item.value as any).intervalM, 2);

  const report: any = { evidenceRegistry: [], geosurvey_context: {}, soil: {} };
  enrichGermanyRlpGroundwater(report, result);
  assert.equal(report.geosurvey_context.rlp_groundwater_evidence_level, 'MODELLED');
  assert.equal(report.evidenceRegistry.length, 1);
  assert.match(report.soil.estimatedWaterTableDepthM, /Indicative groundwater/);
});test('Rheinland-Pfalz adapter ignores other German states', async () => {
  const result = await queryGermanyRlpGroundwater(
    53.5, 13.9, 'Mecklenburg-Vorpommern',
    async () => { throw new Error('fetch must not be called'); },
    16
  );
  assert.equal(result.evidence.length, 0);
  assert.equal(result.modelledGroundwaterFound, false);
});