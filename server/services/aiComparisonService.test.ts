import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiComparisonPackage, compareSitesWithAi, validateAiComparison } from './aiComparisonService';

const makeReport = (id: string, label: string, score: number) => ({
  id, language: 'en', location_name: label, country: 'Ireland', country_code: 'IE', latitude: 53.3, longitude: -6.2,
  area_size: 1200, boundary: { type: 'circle', center: [53.3, -6.2], radius: 20 },
  report_data: {
    evidence_score: { totalScore: score, verifiedCount: 2, modelledCount: 1, unverifiedCount: 2 },
    evidence_registry: [{ id: `${id}-geology`, category: 'Geology', claim: 'Mapped geology returned.', status: 'VERIFIED', sourceName: 'GSI', sourceUrl: 'https://www.gsi.ie/', datasetDate: '2026-09-17', spatialRelationship: 'site overlap', calculationMethod: 'map query', confidence: 'High', limitation: 'Screening evidence only.' }],
    verification_checklist: [{ topic: 'Planning', reason: 'Planning permission not established.', priority: 'High' }],
    site_value_estimate: { min: null, max: null, median: null, currency: 'EUR', basis: 'Unavailable' },
    data_sources: [{ name: 'GSI', url: 'https://www.gsi.ie/' }]
  }
});

const reports = [makeReport('site-a', 'Site A', 80), makeReport('site-b', 'Site B', 45)];
const validComparison = {
  summary: 'The reports show different strengths and unresolved checks.', intendedUse: 'Detached house',
  sites: [
    { reportId: 'site-a', label: 'Site A', fitSummary: 'Mapped evidence is useful, but planning remains unverified.', strengths: ['Verified mapped geology.'], concerns: [], unknowns: ['Planning permission.'] },
    { reportId: 'site-b', label: 'Site B', fitSummary: 'Evidence is thinner and planning remains unverified.', strengths: ['Mapped geology.'], concerns: [], unknowns: ['Planning permission.'] }
  ],
  tradeoffs: ['Site A has stronger evidence coverage, but that is not itself proof of better site quality.'],
  verificationPriorities: [{ topic: 'Planning', siteIds: ['site-a', 'site-b'], reason: 'Permitted development is not established.', priority: 'high' }],
  decisionGuidance: 'No final preference is defensible until planning is checked.', overallConfidence: 'medium',
  disclaimer: 'Preliminary AI comparison of supplied evidence only.'
};

test('comparison package accepts 2–4 reports, strips raw geometry and treats intended use as a scenario', () => {
  const pkg: any = buildAiComparisonPackage(reports, ' Detached house ');
  assert.equal(pkg.intendedUse, 'Detached house');
  assert.match(pkg.intendedUseNotice, /not evidence/i);
  assert.equal(pkg.sites.length, 2);
  assert.equal(pkg.sites[0].site.reportId, 'site-a');
  assert.equal((pkg.sites[0] as any).boundary, undefined);
  assert.throws(() => buildAiComparisonPackage([reports[0]], ''), /2 and 4/i);
  assert.throws(() => buildAiComparisonPackage([reports[0], reports[0]], ''), /unique report IDs/i);
});

test('comparison validator preserves report identity and fails on invented site references', () => {
  const result = validateAiComparison(validComparison, ['site-a', 'site-b']);
  assert.equal(result.sites[0].reportId, 'site-a');
  assert.throws(() => validateAiComparison({ ...validComparison, sites: [{ ...validComparison.sites[0], reportId: 'invented' }, validComparison.sites[1]] }, ['site-a', 'site-b']), /invalid site reference/i);
});

test('Mistral comparison uses evidence-first guardrails and optional intended use without scoring sites', async () => {
  let request: any;
  const fetcher: any = async (_url: string, init: any) => {
    request = JSON.parse(init.body);
    return { ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(validComparison) } }] }) };
  };
  const result = await compareSitesWithAi(reports, 'Detached house', { fetcher, env: { MISTRAL_API_KEY: 'secret' } as NodeJS.ProcessEnv });
  const prompt = request.messages[0].content;
  assert.match(prompt, /Evidence coverage is not site quality/i);
  assert.match(prompt, /Do not create a numeric score/i);
  assert.match(request.messages[1].content, /Detached house/);
  assert.equal(result.provider, 'mistral');
  assert.equal(result.sites.length, 2);
});
