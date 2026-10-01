import assert from 'node:assert/strict';
import { queryUkraineCadastre, applyUkraineCadastreToReport } from './ukraineCadastreService';

const fixture = { cadnum: '3224985101:01:003:0356', area: '0.3613', category: 'Землі сільськогосподарського призначення', purpose: 'Для ведення особистого селянського господарства', geom: { type: 'Polygon', coordinates: [[[30.0,50.0],[30.1,50.0],[30.1,50.1],[30.0,50.1],[30.0,50.0]]] } };

const fetcher = async () => new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } });

const result = await queryUkraineCadastre(50.05, 30.05, fetcher as any);
assert.equal(result.success, true);
assert.equal(result.parcel?.parcelId, fixture.cadnum);
assert.equal(result.parcel?.areaM2, 3613);
assert.equal(result.parcel?.geometryPoints?.length, 5);

const report: any = { parcel: { areaCalculatedM2: 3600 }, evidenceRegistry: [] };
applyUkraineCadastreToReport(report, result, 3600);
assert.equal(report.parcel.status, 'VERIFIED');
assert.equal(report.parcel.officialAreaM2, 3613);
assert.equal(report.parcel.isOfficialGeometry, true);
assert.equal(report.evidenceRegistry.length, 1);
