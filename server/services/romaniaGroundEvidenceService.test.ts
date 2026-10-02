import { describe, expect, it } from 'vitest';
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
    expect(result.success).toBe(true);
    expect(result.parcel?.parcelId).toBe('RO-123');
    expect(result.parcel?.officialAreaM2).toBe(512.4);
    expect(result.parcel?.geometryPoints?.length).toBe(5);
  });

  it('includes national geology, hydrogeology, flood and urban-geology context', () => {
    const ids = romaniaGroundEvidence().map(e => e.id);
    expect(ids).toContain('ro-igr-geology');
    expect(ids).toContain('ro-igr-hydrogeology');
    expect(ids).toContain('ro-flood-risk');
    expect(ids).toContain('ro-urban-geology');
  });
});
