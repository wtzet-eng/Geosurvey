import assert from 'node:assert/strict';
import test from 'node:test';
import { clearOperationalMetadata } from '../sources/resolver';
import { queryPolandBuildingGroundContext, queryPolandDocumentationPoints } from './pgiSiteEvidenceService';
import { SpatialSamplePoint } from './groundContextService';

const capabilities = (layers: string[]) => `<?xml version="1.0"?><WMS_Capabilities><Capability><Request><GetCapabilities/><GetMap/><GetFeatureInfo/></Request><Layer>${layers.map(layer => `<Layer><Name>${layer}</Name></Layer>`).join('')}</Layer></Capability></WMS_Capabilities>`;

test('MGśP building-ground context falls back to WMS 1.1.1 and remains screening evidence only', async () => {
  clearOperationalMetadata();
  const fetcher = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.searchParams.get('REQUEST') === 'GetCapabilities') {
      if (url.searchParams.get('VERSION') === '1.3.0') return new Response('unsupported version', { status: 400 });
      return new Response(capabilities(['WARUNKI_PODLOZA_BUDOWLANEGO']), { status: 200, headers: { 'content-type': 'application/xml' } });
    }
    if (url.searchParams.get('REQUEST') === 'GetFeatureInfo') {
      if (url.searchParams.get('VERSION') === '1.3.0') return new Response('unsupported version', { status: 400 });
      return new Response('warunki: korzystne\nopis: grunty niespoiste i spoiste o zróżnicowanych warunkach', { status: 200, headers: { 'content-type': 'text/plain' } });
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;

  const [evidence] = await queryPolandBuildingGroundContext(52, 21, fetcher);
  assert.equal(evidence.status, 'VERIFIED');
  assert.equal(evidence.spatialScope, 'SITE');
  assert.match(String((evidence.value as any).descriptor), /korzystne/i);
  assert.equal((evidence.value as any).scale, '1:50,000');
  assert.match(evidence.limitation, /not a parcel-specific geotechnical classification/i);
  assert.doesNotMatch(evidence.claim, /bearing capacity|foundation recommendation|settlement/i);
});

test('SMGP documentation and CBDG research points are returned as contextual observations, not parcel strata', async () => {
  clearOperationalMetadata();
  const samples: SpatialSamplePoint[] = [
    { id: 'site-centroid', lat: 52, lng: 21, scope: 'SITE', label: 'Site centroid' },
    { id: 'vicinity-east', lat: 52, lng: 21.01, scope: 'VICINITY', label: 'East vicinity' }
  ];
  const fetcher = (async (input: string | URL | Request) => {
    const raw = String(input);
    const url = new URL(raw);
    if (url.searchParams.get('REQUEST') === 'GetCapabilities') {
      const layers = raw.includes('smgp_pktdok') ? ['PUNKTY_DOKUMENTACYJNE'] : raw.includes('analizy_pkt_bad') ? ['PUNKTY_BADAWCZE'] : ['OTHER'];
      return new Response(capabilities(layers), { status: 200, headers: { 'content-type': 'application/xml' } });
    }
    if (url.searchParams.get('REQUEST') === 'GetFeatureInfo') {
      const layer = url.searchParams.get('QUERY_LAYERS') || '';
      const properties = layer.includes('DOKUMENT')
        ? { typ: 'sonda mechaniczna', litologia: 'piaski i żwiry', profil: 'profil przypowierzchniowy' }
        : { rodzaj: 'punkt badawczy', opis: 'obserwacja geologiczna', wiek: 'czwartorzęd' };
      return new Response(JSON.stringify({ features: [{ properties }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;

  const evidence = await queryPolandDocumentationPoints(52, 21, fetcher, samples);
  assert.equal(evidence.length, 2);
  assert.ok(evidence.every(item => item.status === 'VERIFIED'));
  assert.ok(evidence.every(item => item.spatialScope === 'VICINITY'));
  assert.ok(evidence.every(item => Number((item.value as any).observationCount) >= 1));
  assert.ok(evidence.some(item => /SMGP documentation/i.test(item.category)));
  assert.ok(evidence.some(item => /CBDG research/i.test(item.category)));
  assert.ok(evidence.every(item => /do not establish a continuous geological profile beneath the parcel/i.test(item.limitation)));
});
