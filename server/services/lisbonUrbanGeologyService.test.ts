import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enrichLisbonUrbanEvidence,
  queryLisbonUrbanGeology
} from './lisbonUrbanGeologyService';

const response = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const pointFeature = (attributes: any, x = -9.1390, y = 38.7224) => ({
  attributes,
  geometry: { x, y }
});

const polygonFeature = (attributes: any) => ({
  attributes,
  geometry: {
    rings: [[
      [-9.20, 38.70],
      [-9.05, 38.70],
      [-9.05, 38.75],
      [-9.20, 38.75],
      [-9.20, 38.70]
    ]]
  }
});

function lisbonFetcher(url: string): Response {
  if (url.includes('FeatureServer/21')) {
    return response({
      features: [polygonFeature({
        NOME: 'Formação das Areolas de Estefânia (MII)',
        IDADE0: 'Cenozóico',
        IDADE1: 'Neogénico',
        IDADE2: 'Miocénico',
        IDADE3: 'Burdigaliano',
        COD_SIG: 'MEs'
      })]
    });
  }
  if (url.includes('MapServer/16')) {
    return response({
      features: [polygonFeature({
        UNID_GEOTECNICA: 'B',
        GEOLOGIA: 'Areolas de Estefânia',
        COD_SIG: 'B1'
      })]
    });
  }
  if (url.includes('FeatureServer/5')) {
    return response({
      features: [polygonFeature({
        CLASSE_SOLO: 'BC',
        SMAX: 1.48,
        COD_SIG: '178'
      })]
    });
  }
  if (url.includes('MapServer/3')) {
    return response({
      features: [polygonFeature({
        CLASSENOME: 'Moderada',
        ART_RPDM: 'RPDM'
      })]
    });
  }

  if (url.includes('MapServer/13')) {
    return response({
      features: [pointFeature({
        REFERENCIA: 'GEO-001',
        RELATORIO: 12,
        EMPRESA: 'Test Geotecnia'
      })]
    });
  }
  if (url.includes('MapServer/14')) {
    return response({
      features: [pointFeature({
        REL_SONDAGEM: 'GEO-001',
        PROFUNDIDADE: '5 - 10'
      }, -9.1380, 38.7228)]
    });
  }
  if (url.includes('MapServer/15')) {
    return response({
      features: [pointFeature({
        REL_SONDAGEM: 'GEO-001',
        PROFUNDIDADE: '1 - 5'
      }, -9.1383, 38.7221)]
    });
  }
  if (url.includes('MapServer/10')) {
    return response({
      features: [pointFeature({
        Referencia: 'GW-001',
        PROFUNDIDADE: '3 - 6'
      }, -9.1385, 38.7220)]
    });
  }
  return response({ features: [] });
}

test('Lisbon urban geology pack returns city-scale construction context', async () => {
  const result = await queryLisbonUrbanGeology(
    38.7223,
    -9.1393,
    async (url) => lisbonFetcher(url)
  );
  assert.equal(result.applicable, true);
  const ids = result.evidence.map(item => item.id);
  assert.ok(ids.includes('pt-lisbon-geology-10k'));
  assert.ok(ids.includes('pt-lisbon-geotechnical-unit'));
  assert.ok(ids.includes('pt-lisbon-ec8-soil'));
  assert.ok(ids.includes('pt-lisbon-slope-movement-susceptibility'));
  assert.ok(ids.includes('pt-lisbon-geotechnical-boreholes'));

  assert.ok(ids.includes('pt-lisbon-alluvium-depth'));
  assert.ok(ids.includes('pt-lisbon-fill-depth'));
  assert.ok(ids.includes('pt-lisbon-groundwater-depth'));
  const ec8 = result.evidence.find(item => item.id === 'pt-lisbon-ec8-soil')!;
  assert.equal((ec8.value as any).soilClass, 'BC');
  assert.equal((ec8.value as any).smax, 1.48);
});

test('Lisbon urban query is skipped outside the approximate municipal envelope', async () => {
  let called = false;
  const result = await queryLisbonUrbanGeology(
    37.03,
    -7.96,
    async () => {
      called = true;
      return response({});
    }
  );
  assert.equal(result.applicable, false);
  assert.equal(result.evidence.length, 0);
  assert.equal(called, false);
});

test('Lisbon urban enrichment promotes the municipal 1:10,000 geology to report context', () => {
  const report: any = {
    geosurvey_context: {
      geological_unit_name: 'National fallback',
      geological_period_era: 'National age'
    }
  };
  const evidence: any[] = [{
    id: 'pt-lisbon-geology-10k',
    category: 'Urban geology',
    claim: 'Mapped Lisbon formation',
    status: 'VERIFIED',
    sourceName: 'Câmara Municipal de Lisboa',
    sourceUrl: 'https://example.test/lisbon',
    datasetDate: '2026-09-30',
    spatialRelationship: 'site',
    calculationMethod: 'fixture',
    confidence: 'High',
    value: {
      formation: 'Formação das Areolas de Estefânia (MII)',
      geologicalAge: 'Cenozóico → Neogénico → Miocénico → Burdigaliano'
    },
    limitation: 'fixture'
  }, {
    id: 'pt-lisbon-geotechnical-unit',
    category: 'Urban geotechnics',
    claim: 'unit B',
    status: 'VERIFIED',
    sourceName: 'Câmara Municipal de Lisboa',
    sourceUrl: 'https://example.test/lisbon',
    datasetDate: '2026-09-30',
    spatialRelationship: 'site',
    calculationMethod: 'fixture',
    confidence: 'High',
    value: { unit: 'B' },
    limitation: 'fixture'
  }];
  enrichLisbonUrbanEvidence(report, evidence);
  assert.equal(report.geosurvey_context.geological_unit_name, 'Formação das Areolas de Estefânia (MII)');
  assert.equal(report.geosurvey_context.urban_geotechnical_unit, 'B');
  assert.equal(report.geosurvey_context.urban_evidence_level, 'VERIFIED');
});
