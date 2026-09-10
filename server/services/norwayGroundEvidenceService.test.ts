import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichNorwayGroundEvidence, queryNorwayGroundEvidence } from './norwayGroundEvidenceService';

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

test('NGU acquisition keeps mapped deposits, NADAG, marine clay and radon as separate evidence', async () => {
  const fetcher: typeof fetch = async (input: any) => {
    const url = String(input);
    if (url.includes('/losmassedetaljert/')) return jsonResponse({ features: [{ properties: { løsmassetypeNavn: 'Hav- og fjordavsetning', løsmassetypeBesk: 'Finkornige marine avsetninger', infiltrasjonPotensialNavn: 'Lite egnet', grunnvannPotensialNavn: 'Begrenset', oppdateringsdato: '2025-10-01' } }] });
    if (url.includes('/grunnundersokelser_utvidet/')) return jsonResponse({ features: [{ geometry: { type: 'Point', coordinates: [10.746, 59.916] }, properties: { lokalid: 'bh-1', boreNr: 'BH-1', borlengdeTilBerg: 8.2, kvikkleirePåvisning: 'IkkeVurdert', opphav: 'Test owner', oppdateringsdato: '2026-01-02' } }] });
    if (url.includes('/muligmarinleire/')) return jsonResponse({ features: [{ properties: { muligMarinLeire: 'stor', muligMarinLeireNavn: 'Områder der det ofte kan finnes marin leire', losmassetypeNavn: 'Hav- og fjordavsetning', datauttaksdato: '07.06.2026 10.00.00' } }] });
    if (url.includes('/radonaktsomhet/')) return jsonResponse({ features: [{ properties: { aktsomhetGrad: 'Moderat til lav', aktsomhetGradNavn: 'Moderat til lav aktsomhet', datauttaksdato: '05.11.2025 11.00.00' } }] });
    throw new Error(`Unexpected URL: ${url}`);
  };

  const items = await queryNorwayGroundEvidence(59.915, 10.745, fetcher);
  assert.equal(items.length, 4);
  assert.equal(items.find(item => item.id === 'no-ngu-loose-mass-detailed')?.status, 'VERIFIED');
  assert.equal(items.find(item => item.id === 'no-ngu-nadag-borehole-context')?.status, 'VERIFIED');
  assert.equal(items.find(item => item.id === 'no-ngu-marine-clay')?.status, 'VERIFIED');
  assert.equal(items.find(item => item.id === 'no-ngu-radon-awareness')?.status, 'VERIFIED');
  assert.match(String(items.find(item => item.id === 'no-ngu-marine-clay')?.claim), /marin leire/i);

  const report: any = {
    geosurvey_context: {},
    soil: { groundwaterRegime: 'unknown' },
    terrain: { geohazards: { radonPotential: { status: 'REQUIRES_VERIFICATION', classification: 'Not available', sourceName: 'generic' } } }
  };
  enrichNorwayGroundEvidence(report, items);
  assert.equal(report.geosurvey_context.geological_unit_name, 'Hav- og fjordavsetning');
  assert.equal(report.geosurvey_context.evidence_level, 'VERIFIED');
  assert.equal(report.terrain.geohazards.radonPotential.status, 'VERIFIED');
  assert.equal(report.terrain.geohazards.radonPotential.classification, 'Moderat til lav aktsomhet');
});

test('NGU evidence fails closed when an endpoint is unavailable', async () => {
  const fetcher: typeof fetch = async (input: any) => {
    const url = String(input);
    if (url.includes('/losmassedetaljert/')) return new Response('fail', { status: 503 });
    return jsonResponse({ features: [] });
  };
  const items = await queryNorwayGroundEvidence(60, 10, fetcher);
  const deposits = items.find(item => item.id === 'no-ngu-loose-mass-unavailable');
  assert.equal(deposits?.status, 'REQUIRES_VERIFICATION');
  assert.equal((deposits?.value as any)?.reasonCode, 'SOURCE_UNAVAILABLE');
  assert.ok(items.every(item => item.status === 'REQUIRES_VERIFICATION'));
});
