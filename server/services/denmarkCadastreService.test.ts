import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDenmarkCadastreToReport, queryDenmarkCadastre } from './denmarkCadastreService';

const okGml = (body: string) => ({ ok: true, text: async () => body }) as any;

const parcelGml = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:mat="http://data.gov.dk/schemas/matrikel/1" xmlns:gml="http://www.opengis.net/gml/3.2" numberMatched="1" numberReturned="1">
  <wfs:member>
    <mat:Jordstykke_Gaeldende gml:id="parcel-1">
      <mat:id.lokalId>1057394</mat:id.lokalId>
      <mat:registreringFra>2026-09-12T08:00:00+02:00</mat:registreringFra>
      <mat:samletFastEjendomLokalId>7494309</mat:samletFastEjendomLokalId>
      <mat:arealberegningsmetode>Areal beregnet efter opmåling - o</mat:arealberegningsmetode>
      <mat:faelleslod>false</mat:faelleslod>
      <mat:matrikelnummer>12a</mat:matrikelnummer>
      <mat:ejerlavskode>2000176</mat:ejerlavskode>
      <mat:kommunekode>0101</mat:kommunekode>
      <mat:registreretAreal uom="m2">845</mat:registreretAreal>
      <mat:geometri>
        <gml:Polygon srsName="urn:ogc:def:crs:EPSG::25832">
          <gml:exterior><gml:LinearRing>
            <gml:posList srsDimension="2" count="5">723250 6172742 723450 6172742 723450 6172942 723250 6172942 723250 6172742</gml:posList>
          </gml:LinearRing></gml:exterior>
        </gml:Polygon>
      </mat:geometri>
    </mat:Jordstykke_Gaeldende>
  </wfs:member>
</wfs:FeatureCollection>`;

test('Matriklen2 parcel query preserves registered area and official registry geometry with legal-boundary caveat', async () => {
  const fetcher: any = async (url: string) => {
    assert.match(url, /wfs\.datafordeler\.dk\/MATRIKLEN2\/MatGaeldendeOgForeloebigWFS/);
    assert.match(url, /apikey=test-key/);
    assert.match(url, /typeNames=mat%3AJordstykke_Gaeldende/);
    assert.match(url, /version=2\.0\.0/i);
    assert.match(url, /bbox=/);
    assert.match(url, /25832/);
    return okGml(parcelGml);
  };

  const result = await queryDenmarkCadastre(55.65, 12.55, fetcher, 'test-key');
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, '2000176 12a');
  assert.equal(result.parcel?.registeredAreaM2, 845);
  assert.equal(result.parcel?.municipalityCode, '0101');
  assert.equal(result.parcel?.bfeNumber, 7494309);
  assert.equal(result.parcel?.registryGeometryPoints?.length, 5);
  assert.doesNotMatch(result.sourceUrl, /test-key/);
  assert.match(result.sourceUrl, /datafordeler\.dk\/dataoversigt\/matriklen/i);
  assert.match(result.sourceName, /Matriklen2/);

  const report: any = { evidenceRegistry: [], parcel: {}, evidenceScore: { breakdown: { cadastreAndGeometry: { score: 0 } } } };
  applyDenmarkCadastreToReport(report, result, 900);
  assert.equal(report.parcel.isOfficialGeometry, true);
  assert.equal(report.parcel.officialAreaM2, 845);
  assert.match(report.parcel.limitation, /ikke i sig selv.*grænseafsætning/i);
});

test('Datafordeler cadastre fails closed when API key is absent', async () => {
  let called = false;
  const fetcher: any = async () => { called = true; return okGml(parcelGml); };
  const result = await queryDenmarkCadastre(55.65, 12.55, fetcher, '');
  assert.equal(called, false);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, 'SOURCE_UNAVAILABLE');
  assert.equal(result.evidence[0].status, 'REQUIRES_VERIFICATION');
  assert.match(result.evidence[0].claim, /DATAFORDELER_API_KEY/);
});

test('Datafordeler source failures fail closed', async () => {
  const fetcher: any = async () => ({ ok: false, text: async () => '' });
  const result = await queryDenmarkCadastre(55.65, 12.55, fetcher, 'test-key');
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, 'SOURCE_UNAVAILABLE');
  assert.equal(result.evidence[0].status, 'REQUIRES_VERIFICATION');
});

test('entity-style response without parcel geometry fails closed instead of claiming official geometry', async () => {
  const gml = `<?xml version="1.0"?><wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:mat="http://data.gov.dk/schemas/matrikel/1"><wfs:member><mat:Jordstykke_Gaeldende><mat:id.lokalId>1</mat:id.lokalId><mat:matrikelnummer>12a</mat:matrikelnummer><mat:ejerlavskode>2000176</mat:ejerlavskode><mat:registreretAreal>845</mat:registreretAreal></mat:Jordstykke_Gaeldende></wfs:member></wfs:FeatureCollection>`;
  const result = await queryDenmarkCadastre(55.65, 12.55, async () => okGml(gml), 'test-key');
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, 'MALFORMED_DATA');
  assert.equal(result.evidence[0].status, 'REQUIRES_VERIFICATION');
});

[executed on device: toma (e8359509-e325-4515-b2ff-2da47ff811ad)]