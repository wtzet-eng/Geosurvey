import assert from 'node:assert/strict';
import test from 'node:test';
import { clearOperationalMetadata } from '../sources/resolver';
import { enrichGeologyFromPgi, queryPolandGeologicalMaps, queryPolandSiteEvidence } from './pgiSiteEvidenceService';

const capabilities = (layer: string) => `<?xml version="1.0"?><WMS_Capabilities><Capability><Request><GetCapabilities/><GetMap/><GetFeatureInfo/></Request><Layer><Layer><Name>${layer}</Name></Layer></Layer></Capability></WMS_Capabilities>`;

test('live Polish geological maps use resolver metadata and approved regional fallback', async () => {
  clearOperationalMetadata();
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('mgp200k_a') && url.includes('GetCapabilities')) return new Response('', { status: 503 });
    if (url.includes('GetCapabilities')) return new Response(capabilities(url.includes('mgp500k_2022') ? 'MGP500' : 'GEOLOGY'), { status: 200, headers: { 'content-type': 'application/xml' } });
    if (url.includes('GetFeatureInfo')) return new Response(JSON.stringify({ features: [{ properties: { unit: 'Jednostka testowa' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response('', { status: 404 });
  }) as typeof fetch;
  const evidence = await queryPolandGeologicalMaps(52, 21, fetcher);
  const regional = evidence.find(item => item.id === 'pgi-mgp-regional-site');
  assert.equal(regional?.status, 'VERIFIED');
  assert.equal(regional?.resolverProvenance?.endpointId, 'pl-mgp-500k-2022-wms');
  assert.equal(regional?.resolverProvenance?.evidenceTier, 3);
  assert.equal(regional?.resolverProvenance?.resolverStatus, 'FALLBACK_ACTIVE');
});

test('successful PGI query with no feature is NO_DATA rather than geological absence', async () => {
  clearOperationalMetadata();
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('GetCapabilities')) return new Response(capabilities('GEOLOGY'), { status: 200 });
    if (url.includes('GetFeatureInfo')) return new Response(JSON.stringify({ features: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response('', { status: 404 });
  }) as typeof fetch;
  const evidence = await queryPolandGeologicalMaps(52, 21, fetcher);
  assert.ok(evidence.every(item => item.status === 'REQUIRES_VERIFICATION'));
  assert.ok(evidence.every(item => item.reasonCode === 'NO_DATA'));
  assert.ok(evidence.every(item => /does not establish geological absence|does not establish geological/i.test(item.limitation)));
});

test('PGI enrichment never promotes placeholder geology to VERIFIED', () => {
  const report: any = {
    geosurvey_context: {
      geological_unit_name: 'Not available — requires validated PGI-PIB map evidence',
      lithology_type: 'Not available — requires validated PGI-PIB map evidence',
      geological_period_era: 'Not available — requires validated PGI-PIB map evidence',
      evidence_level: 'REQUIRES_VERIFICATION'
    }
  };
  const evidence: any[] = [{
    id: 'pgi-smgp-50k-site',
    category: 'Detailed Geological Map of Poland (SMGP)',
    claim: 'Map feature returned without usable geological properties.',
    status: 'VERIFIED',
    sourceName: 'Państwowy Instytut Geologiczny – PIB',
    sourceUrl: 'https://geolog.pgi.gov.pl',
    datasetDate: '2026-08-24',
    spatialRelationship: 'Exact site centre queried',
    calculationMethod: 'Test fixture',
    confidence: 'Medium',
    value: { featureInfo: { features: [{ properties: { unrelated: 'context only' } }] } },
    limitation: 'Test fixture'
  }];
  enrichGeologyFromPgi(report, evidence);
  assert.equal(report.geosurvey_context.geological_unit_name, null);
  assert.equal(report.geosurvey_context.lithology_type, null);
  assert.equal(report.geosurvey_context.geological_period_era, null);
  assert.equal(report.geosurvey_context.evidence_level, 'REQUIRES_VERIFICATION');
  assert.equal(report.geosurvey_context.pgi_evidence_status, 'REQUIRES_VERIFICATION');
});

test('malformed HTTP 200 WMS capabilities fail closed as MALFORMED_DATA', async () => {
  clearOperationalMetadata();
  const malformedCapabilities = '<?xml version="1.0"?><WMS_Capabilities><Capability><Request><GetCapabilities/></Request><Layer><Layer><Name>GEOLOGY</Name></Layer></Layer></Capability></WMS_Capabilities>';
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('GetCapabilities')) return new Response(malformedCapabilities, { status: 200, headers: { 'content-type': 'application/xml' } });
    return new Response('', { status: 404 });
  }) as typeof fetch;
  const evidence = await queryPolandGeologicalMaps(52, 21, fetcher);
  assert.ok(evidence.every(item => item.status === 'REQUIRES_VERIFICATION'));
  assert.ok(evidence.every(item => item.reasonCode === 'MALFORMED_DATA'));
  assert.ok(evidence.every(item => (item.value as { resolverStatus?: string } | null)?.resolverStatus === 'SCHEMA_CHANGED'));
  assert.ok(evidence.every(item => item.reasonCode !== 'NO_DATA'));
  assert.ok(evidence.every(item => !/geological unit is absent|no geology exists/i.test(`${item.claim} ${item.limitation}`)));
});

test('all approved Polish routes unavailable stays REQUIRES_VERIFICATION', async () => {
  clearOperationalMetadata();
  const fetcher = (async () => new Response('', { status: 503 })) as typeof fetch;
  const evidence = await queryPolandSiteEvidence(52, 21, fetcher);
  assert.ok(evidence.length >= 5);
  assert.ok(evidence.every(item => item.status === 'REQUIRES_VERIFICATION'));
  assert.ok(evidence.every(item => item.reasonCode === 'SOURCE_UNAVAILABLE'));
  assert.ok(evidence.every(item => !/geological unit is absent|no geology exists/i.test(item.claim)));
});
