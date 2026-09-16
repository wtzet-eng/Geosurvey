import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { queryNetherlandsCadastre, applyNetherlandsCadastreToReport } from './netherlandsCadastreService';

const square = [[[5.119,52.089],[5.121,52.089],[5.121,52.091],[5.119,52.091],[5.119,52.089]]];
const feature = (coordinates: number[][][] = square) => ({ type: 'Feature', properties: {
  kadastrale_gemeente_waarde: 'Utrecht', sectie: 'A', perceelnummer: 42,
  kadastrale_grootte_waarde: 512
}, geometry: { type: 'Polygon', coordinates } });
const mock = (features: any[]) => (async () => ({ ok: true, json: async () => ({ type: 'FeatureCollection', features }) })) as unknown as typeof fetch;

describe('Netherlands PDOK cadastre', () => {
  it('credits only a polygon containing the point and preserves boundary uncertainty', async () => {
    const result = await queryNetherlandsCadastre(52.09, 5.12, mock([feature()]));
    assert.equal(result.success, true);
    assert.equal(result.parcel?.parcelId, 'Utrecht A 42');
    assert.equal(result.parcel?.registeredAreaM2, 512);
    const report: any = { parcel: { isOfficialGeometry: false }, evidenceRegistry: [] };
    applyNetherlandsCadastreToReport(report, result, 600);
    assert.equal(report.parcel.isOfficialGeometry, false);
    assert.equal(report.parcel.officialAreaM2, 512);
    assert.equal(report.parcel.areaCalculatedM2, 600);
  });
  it('does not match a hole or a nearby polygon', async () => {
    const hole = [[5.1195,52.0895],[5.1205,52.0895],[5.1205,52.0905],[5.1195,52.0905],[5.1195,52.0895]];
    assert.equal((await queryNetherlandsCadastre(52.09, 5.12, mock([feature([square[0], hole])]))).reasonCode, 'NO_DATA');
    assert.equal((await queryNetherlandsCadastre(52.09, 5.12, mock([feature([[[5.13,52.09],[5.14,52.09],[5.14,52.10],[5.13,52.10],[5.13,52.09]]])]))).reasonCode, 'NO_DATA');
  });
  it('leaves ambiguous and failed responses unverified', async () => {
    assert.equal((await queryNetherlandsCadastre(52.09, 5.12, mock([feature(), feature()]))).reasonCode, 'AMBIGUOUS');
    const failed = await queryNetherlandsCadastre(52.09, 5.12, (async () => { throw new Error('offline'); }) as typeof fetch);
    assert.equal(failed.success, false);
    assert.equal(failed.evidence[0].status, 'REQUIRES_VERIFICATION');
  });
});
