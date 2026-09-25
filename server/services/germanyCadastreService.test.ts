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
  const result = await queryGermanyCadastre(53.5, 13.9, 'Bayern', async () => new Response('', { status: 200 }) as Response);
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

const berlinXml = `<?xml version="1.0"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:alkis_flurstuecke="alkis_flurstuecke">
<wfs:member><alkis_flurstuecke:flurstuecke gml:id="DEBE00YY12B00050">
<uuid>DEBE00YY12B00050</uuid><bezeich>AX_Flurstueck</bezeich><afl>532.0</afl><fsko>11000192100498____</fsko><zae>498</zae><gmk>0001</gmk>
<geometry><gml:Polygon><gml:exterior><gml:LinearRing><gml:posList>13.38995 52.52034 13.38994 52.52036 13.38961 52.52033 13.38970 52.52015 13.38995 52.52034</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></geometry>
</alkis_flurstuecke:flurstuecke></wfs:member></wfs:FeatureCollection>`;

test('Germany cadastral adapter resolves Berlin ALKIS field mappings and geometry', async () => {
  const result = await queryGermanyCadastre(52.52025, 13.38980, 'Berlin', async () => new Response(berlinXml, { status: 200 }));
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, 'Flurstück 498');
  assert.equal(result.parcel?.officialAreaM2, 532);
  assert.equal(result.parcel?.nationalCadastralReference, '11000192100498____');
  assert.equal(result.parcel?.stateCode, 'DE-BE');
  assert.equal(result.viewLayer, 'flurstuecke');
  assert.equal(result.viewStyle, 'alkis_flurstuecke');
});

const bremenXml = `<?xml version="1.0"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:app="http://www.deegree.org/app">
<wfs:member><app:flurstuecke gml:id="DEHB01ALs0001uQkFL">
<oid>DEHB01ALs0001uQkFL</oid><idflurst>DEHB01ALs0001uQk</idflurst><flaeche>3368.0</flaeche><flstkennz>044072072000130005__</flstkennz><flstnrzae>13</flstnrzae><flstnrnen>5</flstnrnen><land>Bremen</land>
<geometry><gml:Polygon><gml:exterior><gml:LinearRing><gml:posList>8.749515 53.087378 8.749870 53.087655 8.750224 53.087370 8.750666 53.087015 8.750305 53.086734 8.749515 53.087378</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></geometry>
</app:flurstuecke></wfs:member></wfs:FeatureCollection>`;

test('Germany cadastral adapter resolves Bremen ALKIS field mappings and geometry', async () => {
  const result = await queryGermanyCadastre(53.08720, 8.75000, 'Bremen', async () => new Response(bremenXml, { status: 200 }));
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, 'Flurstück 13/5');
  assert.equal(result.parcel?.officialAreaM2, 3368);
  assert.equal(result.parcel?.nationalCadastralReference, '044072072000130005__');
  assert.equal(result.parcel?.stateCode, 'DE-HB');
  assert.equal(result.viewLayer, 'cp_cadastralparcel');
  assert.equal(result.viewStyle, 'cp_cadastralparcel');
});

test('Germany cadastral profiles route every currently activated INSPIRE state service', async () => {
  const states = [
    ['Baden-Württemberg', 'DE-BW'], ['Brandenburg', 'DE-BB'], ['Hamburg', 'DE-HH'], ['Hessen', 'DE-HE'],
    ['Niedersachsen', 'DE-NI'], ['Nordrhein-Westfalen', 'DE-NW'], ['Sachsen', 'DE-SN'], ['Saarland', 'DE-SL'],
    ['Sachsen-Anhalt', 'DE-ST'], ['Schleswig-Holstein', 'DE-SH'], ['Mecklenburg-Vorpommern', 'DE-MV']
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

const thuringiaXml = `<?xml version="1.0"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:ave="http://repository.gdi-de.org/schemas/adv/produkt/alkis-vereinfacht/2.0">
<wfs:member><ave:Flurstueck gml:id="th-test"><ave:flstkennz>160101054000570004__</ave:flstkennz><ave:flstnrzae>57</ave:flstnrzae><ave:flstnrnen>4</ave:flstnrnen><ave:flaeche>40000</ave:flaeche><ave:geometrie><gml:MultiSurface><gml:surfaceMember><gml:Polygon><gml:exterior><gml:LinearRing><gml:posList>642277 5649895 642677 5649895 642677 5650295 642277 5650295 642277 5649895</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></gml:surfaceMember></gml:MultiSurface></ave:geometrie></ave:Flurstueck></wfs:member></wfs:FeatureCollection>`;

test('Germany cadastral adapter converts Thuringia UTM geometry to WGS84', async () => {
  const result = await queryGermanyCadastre(50.9848, 11.0299, 'Thüringen', async () => new Response(thuringiaXml, { status: 200 }));
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, 'Flurstück 57/4');
  assert.equal(result.parcel?.officialAreaM2, 40000);
  assert.equal(result.parcel?.stateCode, 'DE-TH');
  assert.equal(result.parcel?.geometryPoints.length, 5);
  assert.ok(Math.abs((result.parcel?.geometryPoints[0]?.[0] || 0) - 50.983) < 0.02);
  assert.ok(Math.abs((result.parcel?.geometryPoints[0]?.[1] || 0) - 11.027) < 0.02);
  assert.equal(result.viewServiceUrl, 'https://www.geoproxy.geoportal-th.de/geoproxy/services/INSPIREcp');
});

test('Germany cadastral adapter uses EPSG:4258 routing for Saxony and Saarland', async () => {
  for (const [state, stateCode] of [['Sachsen', 'DE-SN'], ['Saarland', 'DE-SL']] as const) {
    let requestedUrl = '';
    const result = await queryGermanyCadastre(53.505043, 13.996212, state, async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(xml, { status: 200 });
    });
    assert.equal(result.success, true, state);
    assert.equal(result.parcel?.stateCode, stateCode, state);
    assert.match(requestedUrl, /srsName=EPSG%3A4258/);
  }
});
