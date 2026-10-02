import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { queryRomaniaCadastre, romaniaGroundEvidence } from './romaniaGroundEvidenceService';

describe('romaniaGroundEvidenceService', () => {
  it('extracts an ANCPI parcel polygon containing the point', async () => {
    const data = {
      features: [{
        attributes: { nationalCadastralRef: 'RO-123', areaValue: 512.4, NR_CARTE_FUNCIARA: 9876 },
        geometry: { rings: [[[25,45],[25.001,45],[25.001,45.001],[25,45.001],[25,45]]] }
      }]
    };
    const fetcher = async () => new Response(JSON.stringify(data), { status: 200 });
    const result = await queryRomaniaCadastre(45.0005, 25.0005, fetcher as any);
    assert.equal(result.success, true);
    assert.equal(result.parcel?.parcelId, 'RO-123');
    assert.equal(result.parcel?.officialAreaM2, 512.4);
    assert.equal(result.parcel?.geometryPoints?.length, 5);
  });

  it('includes national geology, hydrogeology, flood and urban-geology context', () => {
    const ids = romaniaGroundEvidence().map(e => e.id);
    assert.equal(ids.includes('ro-igr-geology'), true);
    assert.equal(ids.includes('ro-igr-hydrogeology'), true);
    assert.equal(ids.includes('ro-flood-risk'), true);
    assert.equal(ids.includes('ro-urban-geology'), true);
  });
});
