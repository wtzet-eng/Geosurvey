import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichGermanyMvGroundEvidence, queryGermanyMvGroundEvidence, toGermanyMvNative } from './germanyMvEvidenceService';

const xmlResponse = (body: string) => new Response(body, { status: 200, headers: { 'Content-Type': 'text/xml' } });

const fixture = (geology = true, boreholes = true) => `<?xml version="1.0"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:ms="http://mapserver.gis.umn.edu/mapserver" xmlns:qgs="http://www.qgis.org/gml">
${geology ? `<gml:featureMember><ms:t7_gk50_so><ms:msGeometry><gml:Polygon srsName="EPSG:5650"><gml:exterior><gml:LinearRing><gml:posList>33432500 5928000 33433500 5928000 33433500 5928700 33432500 5928700 33432500 5928000</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></ms:msGeometry><ms:STRAT_1>Test Pleistocene unit</ms:STRAT_1><ms:PETH_1>sand</ms:PETH_1><ms:PETN_1>Pleistocene</ms:PETN_1><ms:GENESE_1>glaciofluvial</ms:GENESE_1></ms:t7_gk50_so></gml:featureMember>` : ''}
${boreholes ? `<gml:featureMember><qgs:bohrdaten><qgs:geometry><gml:Point srsName="EPSG:5650"><gml:pos>33433000 5928350</gml:pos></gml:Point></qgs:geometry><qgs:LONGNAME>Test borehole</qgs:LONGNAME><qgs:BO_IDENT>123</qgs:BO_IDENT><qgs:ZCOORDE>42</qgs:ZCOORDE><qgs:ZCOORDB>55</qgs:ZCOORDB><qgs:BRGZWECK>Altlastenerkundung</qgs:BRGZWECK><qgs:YRFROMNAME>2007</qgs:YRFROMNAME><qgs:STRAT_EH>Quartär, Pleistozän</qgs:STRAT_EH><qgs:DATSICHERH>nein</qgs:DATSICHERH><qgs:SVB>ja</qgs:SVB><qgs:SVZ_URL>https://example.test/log</qgs:SVZ_URL></qgs:bohrdaten></gml:featureMember>` : ''}
</wfs:FeatureCollection>`;

test('EPSG:5650 conversion uses the M-V zone-prefixed easting', () => {
  const [x, y] = toGermanyMvNative(53.505096, 13.996122);
  assert.ok(x > 33_400_000 && x < 33_500_000);
  assert.ok(y > 5_900_000 && y < 6_000_000);
});

test('M-V ground evidence combines geology, boreholes, mapped depth and groundwater-surface elevation', async () => {
  let calls = 0;
  const [x, y] = toGermanyMvNative(53.5, 13.996);
  const dynamicsFixture = `<?xml version="1.0"?>\n<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:ms="http://mapserver.gis.umn.edu/mapserver">\n<gml:featureMember><ms:t7_dynamik><ms:msGeometry><gml:LineString srsName="EPSG:5650"><gml:posList>${x + 100} ${y - 200} ${x + 100} ${y + 200}</gml:posList></gml:LineString></ms:msGeometry><ms:GW_LAGE>17</ms:GW_LAGE></ms:t7_dynamik></gml:featureMember>\n<gml:featureMember><ms:t7_dynamik><ms:msGeometry><gml:LineString srsName="EPSG:5650"><gml:posList>${x + 20} ${y - 200} ${x + 20} ${y + 200}</gml:posList></gml:LineString></ms:msGeometry><ms:GW_LAGE>18</ms:GW_LAGE></ms:t7_dynamik></gml:featureMember>\n</wfs:FeatureCollection>`;
  const fetcher: typeof fetch = async (input: any) => {
    calls += 1;
    const url = String(input);
    if (url.includes('mv_a7_hydrogeologie_wms.php')) return xmlResponse("GetFeatureInfo results:\n\nLayer 't7_flurabstand'\n  Feature 8950:\n    LEGENDE = 'A13'\n    FLURABSTAN = '>5 - 10 m'\n");
    if (url.includes('mv_a7_hydrogeologie_wfs.php')) return xmlResponse(dynamicsFixture);
    return xmlResponse(fixture(url.includes('geol_karten'), url.includes('gg_lbds')));
  };
  const result = await queryGermanyMvGroundEvidence(53.500, 13.996, 'Mecklenburg-Vorpommern', fetcher, 16);
  assert.equal(calls, 4);
  assert.equal(result.geologyFound, true);
  assert.equal(result.boreholeCount, 1);
  const geology = result.evidence.find(item => item.id === 'de-mv-geology-gk50');
  const boreholes = result.evidence.find(item => item.id === 'de-mv-boreholes-lbds');
  const groundwater = result.evidence.find(item => item.id === 'de-mv-groundwater-depth');
  const groundwaterDynamics = result.evidence.find(item => item.id === 'de-mv-groundwater-dynamics');
  assert.equal(geology?.status, 'VERIFIED');
  assert.equal(boreholes?.status, 'VERIFIED');
  assert.equal(groundwater?.status, 'VERIFIED');
  assert.equal((groundwater?.value as any)?.depthClass, '>5 - 10 m');
  assert.equal(groundwaterDynamics?.status, 'MODELLED');
  assert.equal((groundwaterDynamics?.value as any)?.riskLevel, 'High');
  assert.ok((groundwaterDynamics?.value as any)?.estimatedDepthBelowGroundM < 0);
  assert.ok((groundwaterDynamics?.value as any)?.estimatedGroundwaterElevationM > 17);
  assert.ok((groundwaterDynamics?.value as any)?.estimatedGroundwaterElevationM < 18);
  assert.match(geology?.claim || '', /Test Pleistocene unit/);
  assert.match(boreholes?.claim || '', /Altlastenerkundung/);
  assert.equal((boreholes?.value as any)?.nearest?.[0]?.endDepthM, 42);
  assert.equal((boreholes?.value as any)?.nearest?.[0]?.logAvailable, 'ja');
  const report: any = { evidenceRegistry: [], geosurvey_context: {}, evidenceScore: { breakdown: { geologyAndGroundwater: { score: 0, max: 20, rationale: '' } } } };
  enrichGermanyMvGroundEvidence(report, result);
  assert.equal(report.geosurvey_context.lithology_type, 'sand');
  assert.equal(report.geosurvey_context.evidence_level, 'VERIFIED');
  assert.equal(report.evidenceScore.breakdown.geologyAndGroundwater.score, 18);
});

test('M-V unavailable services fail closed without inventing geology or borehole absence', async () => {
  const fetcher: typeof fetch = async () => new Response('down', { status: 503 });
  const result = await queryGermanyMvGroundEvidence(53.5, 14, 'Mecklenburg-Vorpommern', fetcher, 16);
  assert.equal(result.geologyFound, false);
  assert.equal(result.boreholeCount, 0);
  assert.ok(result.evidence.every(item => item.status === 'REQUIRES_VERIFICATION'));
  assert.ok(result.evidence.every(item => ['SOURCE_UNAVAILABLE'].includes((item.value as any)?.reasonCode)));
});
