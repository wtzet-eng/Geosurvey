import test from 'node:test';
import assert from 'node:assert/strict';
import { queryGermanyCadastre } from './germanyCadastreService';

const xml = `<?xml version="1.0"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2">
<wfs:member><CadastralParcel xmlns="http://inspire.ec.europa.eu/schemas/cp/4.0">
<areaValue uom="m2">423.0</areaValue><label>44</label>
<nationalCadastralReference>13425302700044______</nationalCadastralReference>
<geometry><gml:Polygon><gml:exterior><gml:LinearRing>
<gml:posList>53.5048 13.9960 53.5048 13.9965 53.5053 13.9965 53.5053 13.9960 53.5048 13.9960</gml:posList>
</gml:LinearRing></gml:exterior></gml:Polygon></geometry>
</CadastralParcel></wfs:member></wfs:FeatureCollection>`;

test('Germany cadastral lookup resolves a Mecklenburg-Vorpommern parcel from official WFS evidence', async () => {
  const fetcher = async () => new Response(xml, { status: 200 });
  const result = await queryGermanyCadastre(53.505043, 13.996212, 'Mecklenburg-Vorpommern', fetcher as typeof fetch);
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, 'Flurstück 44');
  assert.equal(result.parcel?.officialAreaM2, 423);
  assert.equal(result.parcel?.nationalCadastralReference, '13425302700044______');
  assert.equal(result.parcel?.geometryPoints.length, 5);
  assert.equal(result.evidence[0].status, 'VERIFIED');
  const inferred = await queryGermanyCadastre(53.505043, 13.996212, null, fetcher as typeof fetch);
  assert.equal(inferred.success, false);
  assert.equal(inferred.reasonCode, 'STATE_NOT_AUTOMATED');
});

test('Germany cadastral lookup routes North Rhine-Westphalia to the official NRW INSPIRE WFS', async () => {
  let requestedUrl = '';
  const fetcher = async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(xml, { status: 200 });
  };
  const result = await queryGermanyCadastre(53.505043, 13.996212, 'Nordrhein-Westfalen', fetcher as typeof fetch);
  assert.equal(result.success, true);
  assert.equal(result.parcel?.state, 'Nordrhein-Westfalen');
  assert.equal(result.parcel?.stateCode, 'DE-NW');
  assert.equal(result.evidence[0].id, 'de-nw-alkis-cadastre');
  assert.match(requestedUrl, /www\.wfs\.nrw\.de\/geobasis\/wfs_nw_inspire-flurstuecke_alkis/);
});

test('Germany cadastral lookup does not confuse another German state with no data', async () => {
  const result = await queryGermanyCadastre(53.5, 13.9, 'Sachsen', async () => new Response('', { status: 200 }) as Response);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, 'STATE_NOT_AUTOMATED');
  assert.equal(result.evidence[0].status, 'REQUIRES_VERIFICATION');
});

const prefixedXml = `<?xml version="1.0"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:cp="http://inspire.ec.europa.eu/schemas/cp/4.0">
<wfs:member><cp:CadastralParcel gml:id="test-prefixed">
<cp:areaValue uom="m2">121</cp:areaValue><cp:label>18/6</cp:label>
<cp:nationalCadastralReference>08146000000018000600</cp:nationalCadastralReference>
<cp:geometry><gml:Polygon><gml:exterior><gml:LinearRing>
<gml:posList>9.183811 48.774252 9.183669 48.774307 9.183602 48.774228 9.183811 48.774252</gml:posList>
</gml:LinearRing></gml:exterior></gml:Polygon></cp:geometry>
</cp:CadastralParcel></wfs:member></wfs:FeatureCollection>`;

test('Germany cadastral parser accepts prefixed INSPIRE properties and lon-lat geometry', async () => {
  const fetcher = async () => new Response(prefixedXml, { status: 200 });
  const result = await queryGermanyCadastre(48.77426, 9.18370, 'Baden-Württemberg', fetcher as typeof fetch);
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, 'Flurstück 18/6');
  assert.equal(result.parcel?.officialAreaM2, 121);
  assert.equal(result.parcel?.nationalCadastralReference, '08146000000018000600');
  assert.equal(result.parcel?.geometryPoints[0][0], 48.774252);
  assert.equal(result.parcel?.geometryPoints[0][1], 9.183811);
  assert.equal(result.viewLayer, 'alkis:CP.CadastralParcel');
  assert.equal(result.viewStyle, 'cadastralparcel');
});

const curvedRingXml = `<?xml version="1.0"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:cp="http://inspire.ec.europa.eu/schemas/cp/4.0">
<wfs:member><cp:CadastralParcel gml:id="test-curved">
<cp:areaValue uom="m2">300</cp:areaValue><cp:label>42</cp:label>
<cp:nationalCadastralReference>020101___00042______</cp:nationalCadastralReference>
<cp:geometry><gml:Surface><gml:patches><gml:PolygonPatch><gml:exterior><gml:Ring>
<gml:curveMember><gml:Curve><gml:segments><gml:LineStringSegment><gml:posList>8.6000 50.0000 8.6010 50.0000</gml:posList></gml:LineStringSegment></gml:segments></gml:Curve></gml:curveMember>
<gml:curveMember><gml:Curve><gml:segments><gml:LineStringSegment><gml:posList>8.6010 50.0000 8.6010 50.0010</gml:posList></gml:LineStringSegment></gml:segments></gml:Curve></gml:curveMember>
<gml:curveMember><gml:Curve><gml:segments><gml:LineStringSegment><gml:posList>8.6010 50.0010 8.6000 50.0010 8.6000 50.0000</gml:posList></gml:LineStringSegment></gml:segments></gml:Curve></gml:curveMember>
</gml:Ring></gml:exterior></gml:PolygonPatch></gml:patches></gml:Surface></cp:geometry>
</cp:CadastralParcel></wfs:member></wfs:FeatureCollection>`;

test('Germany cadastral parser accepts curved INSPIRE parcel rings', async () => {
  const fetcher = async () => new Response(curvedRingXml, { status: 200 });
  const result = await queryGermanyCadastre(50.0005, 8.6005, 'Hessen', fetcher as typeof fetch);
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, 'Flurstück 42');
  assert.equal(result.parcel?.geometryPoints.length, 5);
});

test('Germany cadastral profiles route every currently activated open state service', async () => {
  const states = [
    ['Baden-Württemberg', 'DE-BW'], ['Brandenburg', 'DE-BB'], ['Hamburg', 'DE-HH'], ['Hessen', 'DE-HE'],
    ['Niedersachsen', 'DE-NI'], ['Nordrhein-Westfalen', 'DE-NW'], ['Sachsen-Anhalt', 'DE-ST'],
    ['Schleswig-Holstein', 'DE-SH'], ['Mecklenburg-Vorpommern', 'DE-MV']
  ] as const;
  for (const [state, stateCode] of states) {
    let requestedUrl = '';
    const result = await queryGermanyCadastre(53.505043, 13.996212, state, async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(xml, { status: 200 });
    });
    assert.equal(result.success, true, state);
    assert.equal(result.parcel?.stateCode, stateCode, state);
    assert.ok(requestedUrl.includes('service=WFS'), state);
  }
});
