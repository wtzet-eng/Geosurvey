import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCroatiaCadastreToReport, parseCroatiaCadastreFeatureInfo } from './croatiaCadastreService';

test('Croatia DGU feature info parser extracts parcel identity', () => {
  const html = '<table><tr><td>fid</td><td>13623303</td><td>3</td><td>325139</td></tr></table>';
  assert.deepEqual(parseCroatiaCadastreFeatureInfo(html), { parcelId: '13623303', parcelNumber: '3', cadMunicipalityRegNum: '325139' });
});

test('Croatia DGU cadastre application records parcel number and registered area', () => {
  const report: any = { latitude: 45.812613, longitude: 15.830791, parcel: { status: 'REQUIRES_VERIFICATION', countryCode: 'HR', areaCalculatedM2: 996, isOfficialGeometry: false }, evidenceRegistry: [{ id: 'cadastre-spatial-index' }] };
  applyCroatiaCadastreToReport(report, { success: true, sourceName: 'DGU', sourceUrl: 'https://example.test', parcel: { parcelId: '13623303', parcelNumber: '3', cadMunicipalityRegNum: '325139', cadMunicipalityName: 'RAKITJE', officialAreaM2: 2952 } }, 996, 45.812613, 15.830791);
  assert.equal(report.parcel.status, 'VERIFIED');
  assert.equal(report.parcel.parcelId, '3');
  assert.equal(report.parcel.officialAreaM2, 2952);
  assert.equal(report.evidenceRegistry[0].id, 'hr-cadastre-parcel');
});
