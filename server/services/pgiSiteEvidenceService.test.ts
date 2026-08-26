import assert from 'node:assert/strict';
import test from 'node:test';
import { clearOperationalMetadata } from '../sources/resolver';
import { enrichGeologyFromPgi, queryPolandGeologicalMaps, queryPolandSiteEvidence } from './pgiSiteEvidenceService';
import { SpatialSamplePoint } from './groundContextService';

const capabilities = (layer: string) => `<?xml version="1.0"?><WMS_Capabilities><Capability><Request><GetCapabilities/><GetMap/><GetFeatureInfo/></Request><Layer><Layer><Name>${layer}</Name></Layer></Layer></Capability></WMS_Capabilities>`;
const multiCapabilities = (layers: string[]) => `<?xml version="1.0"?><WMS_Capabilities><Capability><Request><GetCapabilities/><GetMap/><GetFeatureInfo/></Request><Layer>${layers.map(layer => `<Layer><Name>${layer}</Name></Layer>`).join('')}</Layer></Capability></WMS_Capabilities>`;

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

test('PGI FeatureInfo falls back from JSON to GML and preserves geological properties', async () => {
  clearOperationalMetadata();
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('GetCapabilities')) return new Response(capabilities('GEOLOGY'), { status: 200, headers: { 'content-type': 'application/xml' } });
    if (url.includes('GetFeatureInfo')) {
      const format = new URL(url).searchParams.get('INFO_FORMAT');
      if (format === 'application/json') return new Response('unsupported format', { status: 400 });
      if (format === 'application/vnd.ogc.gml') {
        return new Response('<msGMLOutput><GEOLOGY_layer><GEOLOGY_feature><FIELDS jednostka="Osady czwartorzędowe" litologia="Piaski i żwiry" wiek="Plejstocen" /></GEOLOGY_feature></GEOLOGY_layer></msGMLOutput>', { status: 200, headers: { 'content-type': 'application/vnd.ogc.gml' } });
      }
      return new Response('', { status: 406 });
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;
  const evidence = await queryPolandGeologicalMaps(52, 21, fetcher);
  const report: any = {};
  enrichGeologyFromPgi(report, evidence);
  assert.equal(report.geosurvey_context.geological_unit_name, 'Osady czwartorzędowe');
  assert.equal(report.geosurvey_context.lithology_type, 'Piaski i żwiry');
  assert.equal(report.geosurvey_context.geological_period_era, 'Plejstocen');
  assert.equal(report.geosurvey_context.evidence_level, 'VERIFIED');
});

test('PGI site query mines multiple relevant WMS layers instead of trusting one arbitrary layer', async () => {
  clearOperationalMetadata();
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('GetCapabilities')) return new Response(multiCapabilities(['GEOLOGY_UNIT', 'LITOLOGIA', 'LEGEND']), { status: 200, headers: { 'content-type': 'application/xml' } });
    if (url.includes('GetFeatureInfo')) {
      const layer = new URL(url).searchParams.get('QUERY_LAYERS');
      const properties = layer === 'GEOLOGY_UNIT' ? { jednostka: 'Q1' } : layer === 'LITOLOGIA' ? { litologia: 'piasek drobny' } : {};
      return new Response(JSON.stringify({ features: Object.keys(properties).length ? [{ properties }] : [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;
  const evidence = await queryPolandGeologicalMaps(52, 21, fetcher);
  const detailed = evidence.find(item => item.id === 'pgi-smgp-50k-site');
  const queriedLayers = (detailed?.value as any)?.queriedLayers || [];
  const properties = (detailed?.value as any)?.featureInfo?.features?.map((feature: any) => feature.properties) || [];
  assert.ok(queriedLayers.includes('GEOLOGY_UNIT'));
  assert.ok(queriedLayers.includes('LITOLOGIA'));
  assert.ok(properties.some((props: any) => props.jednostka === 'Q1'));
  assert.ok(properties.some((props: any) => props.litologia === 'piasek drobny'));
});

test('PGI enrichment fuses complementary fields according to field-specific source hierarchy', () => {
  const base = {
    status: 'VERIFIED' as const,
    sourceName: 'Państwowy Instytut Geologiczny – PIB',
    sourceUrl: 'https://example.test/wms',
    datasetDate: '2026-08-26',
    spatialRelationship: 'Exact site centre queried',
    calculationMethod: 'Test fixture',
    confidence: 'Medium' as const,
    spatialScope: 'SITE' as const,
    limitation: 'Mapped evidence only.'
  };
  const evidence: any[] = [
    { ...base, id: 'pgi-smgp-50k-site', category: 'Detailed Geological Map of Poland (SMGP)', value: { scale: '1:50,000', featureInfo: { features: [{ properties: { jednostka: 'Osady wodnolodowcowe' } }] } } },
    { ...base, id: 'pgi-mlp-50k-site', category: 'Lithogenetic Map of Poland (MLP)', value: { scale: '1:50,000', featureInfo: { features: [{ properties: { litologia: 'piaski i żwiry', geneza: 'wodnolodowcowa' } }] } } },
    { ...base, id: 'pgi-mgp-regional-site', category: 'Geological Map of Poland (MGP)', value: { scale: '1:200,000', featureInfo: { features: [{ properties: { jednostka: 'Regionalna jednostka', wiek: 'Plejstocen' } }] } } }
  ];
  const report: any = {};
  enrichGeologyFromPgi(report, evidence);
  assert.equal(report.geosurvey_context.geological_unit_name, 'Osady wodnolodowcowe');
  assert.equal(report.geosurvey_context.lithology_type, 'piaski i żwiry');
  assert.equal(report.geosurvey_context.geological_period_era, 'Plejstocen');
  assert.equal(report.geosurvey_context.genetic_origin, 'wodnolodowcowa');
  assert.equal(report.geosurvey_context.pgi_field_sources.unit.category, 'Detailed Geological Map of Poland (SMGP)');
  assert.equal(report.geosurvey_context.pgi_field_sources.lithology.category, 'Lithogenetic Map of Poland (MLP)');
  assert.equal(report.geosurvey_context.pgi_field_sources.period.category, 'Geological Map of Poland (MGP)');
  assert.equal(report.geosurvey_context.pgi_sources.length, 3);
});

test('ground variability uses one primary map family rather than treating map-product disagreement as spatial variability', () => {
  const base = {
    status: 'VERIFIED' as const,
    sourceName: 'Państwowy Instytut Geologiczny – PIB', sourceUrl: 'x', datasetDate: '2026-08-26', calculationMethod: 'fixture', confidence: 'Medium' as const, limitation: 'fixture'
  };
  const evidence: any[] = [
    { ...base, id: 'pgi-smgp-50k-site', category: 'Detailed Geological Map of Poland (SMGP)', spatialScope: 'SITE', spatialRelationship: 'site', value: { scale: '1:50,000', samplePoint: { id: 'site-centroid' }, featureInfo: { features: [{ properties: { jednostka: 'Piaski' } }] } } },
    { ...base, id: 'pgi-smgp-50k-vicinity-east', category: 'Detailed Geological Map of Poland (SMGP)', spatialScope: 'VICINITY', spatialRelationship: 'vicinity', value: { scale: '1:50,000', samplePoint: { id: 'vicinity-east' }, featureInfo: { features: [{ properties: { jednostka: 'Piaski' } }] } } },
    { ...base, id: 'pgi-mlp-50k-site', category: 'Lithogenetic Map of Poland (MLP)', spatialScope: 'SITE', spatialRelationship: 'site', value: { scale: '1:50,000', samplePoint: { id: 'site-centroid' }, featureInfo: { features: [{ properties: { jednostka: 'Osady rzeczne' } }] } } }
  ];
  const report: any = {};
  enrichGeologyFromPgi(report, evidence);
  assert.equal(report.ground_context.sampleCount, 2);
  assert.equal(report.ground_context.distinctMappedUnits.length, 1);
  assert.equal(report.ground_context.variabilityClass, 'LOW');
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
    spatialScope: 'SITE',
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

test('nearby PGI feature remains contextual when the site-centre query has no feature', async () => {
  clearOperationalMetadata();
  const samples: SpatialSamplePoint[] = [
    { id: 'site-centroid', lat: 52, lng: 21, scope: 'SITE', label: 'Site centroid' },
    { id: 'vicinity-east', lat: 52, lng: 21.01, scope: 'VICINITY', label: 'east vicinity sample' }
  ];
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('GetCapabilities')) return new Response(capabilities('GEOLOGY'), { status: 200, headers: { 'content-type': 'application/xml' } });
    if (url.includes('GetFeatureInfo')) {
      const bbox = new URL(url).searchParams.get('BBOX')?.split(',').map(Number) || [];
      const queryLng = bbox.length === 4 ? (bbox[0] + bbox[2]) / 2 : 21;
      const feature = Math.abs(queryLng - 21.01) < 0.002 ? [{ properties: { unit: 'Alluvial deposits', lithology: 'peat and silt' } }] : [];
      return new Response(JSON.stringify({ features: feature }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;
  const evidence = await queryPolandGeologicalMaps(52, 21, fetcher, samples);
  const site = evidence.find(item => item.id === 'pgi-smgp-50k-site');
  const nearby = evidence.find(item => item.id === 'pgi-smgp-50k-vicinity-east');
  assert.equal(site?.status, 'REQUIRES_VERIFICATION');
  assert.equal(site?.reasonCode, 'NO_DATA');
  assert.equal(nearby?.status, 'VERIFIED');
  assert.equal(nearby?.spatialScope, 'VICINITY');
  const report: any = {};
  enrichGeologyFromPgi(report, evidence);
  assert.equal(report.geosurvey_context, undefined);
  assert.equal(report.ground_context.sampleCount, 1);
  assert.equal(report.ground_context.vicinitySampleCount, 1);
  assert.equal(report.ground_context.variabilityClass, 'INSUFFICIENT_EVIDENCE');
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
