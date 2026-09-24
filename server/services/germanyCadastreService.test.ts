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
  assert.equal(inferred.parcel?.parcelId, 'Flurstück 44');
});

test('Germany cadastral lookup does not confuse another German state with no data', async () => {
  const result = await queryGermanyCadastre(53.5, 13.9, 'Sachsen', async () => new Response('', { status: 200 }) as Response);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, 'STATE_NOT_AUTOMATED');
  assert.equal(result.evidence[0].status, 'REQUIRES_VERIFICATION');
});
