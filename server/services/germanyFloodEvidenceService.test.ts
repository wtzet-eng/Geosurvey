import test from 'node:test';
import assert from 'node:assert/strict';
import { queryGermanyFloodEvidence } from './germanyFloodEvidenceService';

const feature = (tClass: number) => ({ attributes: { T_class: tClass } });

test('returns verified medium and low flood evidence for Mecklenburg-Vorpommern', async () => {
  const fetcher = async (input: RequestInfo | URL) => new Response(JSON.stringify({ features: [feature(String(input).includes('/RWMe/') ? 13 : 14)] }), { status: 200, headers: { 'content-type': 'application/json' } });
  const evidence = await queryGermanyFloodEvidence(53.5, 14.0, 'Mecklenburg-Vorpommern', fetcher as any);
  assert.equal(evidence.find(item => item.id === 'de-mv-flood-medium')?.status, 'VERIFIED');
  assert.equal(evidence.find(item => item.id === 'de-mv-flood-medium')?.value?.waterDepthClass, '>1–2 m');
  assert.equal(evidence.find(item => item.id === 'de-mv-flood-low')?.status, 'VERIFIED');
});

test('does not infer absence when the integrated state layer returns no feature', async () => {
  const fetcher = async () => new Response(JSON.stringify({ features: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  const evidence = await queryGermanyFloodEvidence(53.5, 14.0, 'Mecklenburg-Vorpommern', fetcher as any);
  assert.equal(evidence.find(item => item.id === 'de-mv-flood-medium-open')?.status, 'REQUIRES_VERIFICATION');
  assert.equal(evidence.find(item => item.id === 'de-mv-flood-low-open')?.status, 'REQUIRES_VERIFICATION');
});