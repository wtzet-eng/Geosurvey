import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFinlandCadastreToReport, queryFinlandCadastre } from './finlandCadastreService';

const fixture = {
  type: 'FeatureCollection',
  features: [{
    id: 'FI_CP_CADASTRALPARCEL_1',
    geometry: { type: 'Polygon', coordinates: [[[24.932,60.168],[24.934,60.169],[24.932,60.170],[24.932,60.168]]] },
    properties: {
      label: '91-4-9901-0',
      nationalCadastralReference: '09100499010000',
      beginLifespanVersion: '2023-01-01T00:00:00Z',
      inspireId: { localId: '1' }
    }
  }]
};

const response = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('Finland INSPIRE cadastral service selects a parcel and returns its polygon', async () => {
  const fetcher = async () => response(fixture);
  const result = await queryFinlandCadastre(60.169, 24.9325, fetcher as any);
  assert.equal(result.success, true);
  assert.equal(result.parcel?.parcelId, '91-4-9901-0');
  assert.equal(result.parcel?.nationalCadastralReference, '09100499010000');
  assert.ok((result.geometryPoints?.length || 0) >= 3);

  const report: any = { parcel: { status: 'REQUIRES_VERIFICATION' }, evidenceRegistry: [{ id: 'cadastre-spatial-index' }] };
  applyFinlandCadastreToReport(report, result, 900);
  assert.equal(report.parcel.parcelId, '91-4-9901-0');
  assert.equal(report.parcel.isOfficialGeometry, true);
  assert.equal(report.evidenceRegistry.some((item: any) => item.id === 'fi-nls-cadastre'), true);
});
