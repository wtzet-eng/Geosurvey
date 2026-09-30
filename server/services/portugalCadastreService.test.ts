import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPortugalCadastreToReport, queryPortugalCadastre } from './portugalCadastreService';

const fixture = {
  type: 'FeatureCollection',
  features: [{
    id: 'CP.12345',
    geometry: { type: 'Polygon', coordinates: [[[-7.9630,37.0300],[-7.9615,37.0300],[-7.9615,37.0312],[-7.9630,37.0300]]] },
    properties: {
      'inspire:label': '12345',
      'cp:nationalCadastralReference': '06070123450000',
      'cp:areaValue': 412.5,
      'inspire:inspireId': 'pt.12345'
    }
  }]
};
const response = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('Portugal DGT INSPIRE cadastral service selects a published parcel and preserves geometry', async () => {
  const fetcher = async () => response(fixture);
  const result = await queryPortugalCadastre(37.0306, -7.9622, fetcher as any);
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, '12345');
  assert.equal(result.parcel?.nationalCadastralReference, '06070123450000');
  assert.equal(result.parcel?.areaM2, 412.5);
  assert.ok((result.geometryPoints?.length || 0) >= 3);

  const report: any = { parcel: { status: 'REQUIRES_VERIFICATION' }, evidenceRegistry: [] };
  applyPortugalCadastreToReport(report, result, 500);
  assert.equal(report.parcel.parcelId, '12345');
  assert.equal(report.parcel.officialAreaM2, 412.5);
  assert.equal(report.parcel.isOfficialGeometry, true);
  assert.equal(report.evidenceRegistry.some((item: any) => item.id === 'pt-dgt-cadastre'), true);
});

test('Portugal cadastral source failure is verification-needed, not absence', async () => {
  const fetcher = async () => response({}, 503);
  const result = await queryPortugalCadastre(38.7223, -9.1393, fetcher as any);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, 'SOURCE_UNAVAILABLE');
  assert.equal(result.evidence[0].status, 'REQUIRES_VERIFICATION');
});
