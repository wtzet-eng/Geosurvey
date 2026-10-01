import { queryItalyCadastre } from './italyCadastreService';

describe('queryItalyCadastre', () => {
  it('extracts cadastral identifiers from an Agenzia delle Entrate WMS feature-info response', async () => {
    const html = `
      <table>
        <tr><th>InspireId localId</th><td>IT.AGE.PLA.G273_0033A0.673</td></tr>
        <tr><th>Codice Comune</th><td>G273</td></tr>
        <tr><th>Foglio</th><td>33</td></tr>
        <tr><th>Particella</th><td>673</td></tr>
      </table>`;
    const fetcher = async () => new Response(html, { status: 200 });
    const result = await queryItalyCadastre(41.9, 12.5, fetcher as typeof fetch);
    expect(result.success).toBe(true);
    expect(result.parcel?.parcelId).toBe('33 / 673');
    expect(result.parcel?.nationalCadastralReference).toBe('G273 / 33 / 673');
    expect(result.evidence[0].status).toBe('VERIFIED');
  });

  it('does not turn an empty feature-info response into a false parcel absence claim', async () => {
    const fetcher = async () => new Response('<html><body>no feature</body></html>', { status: 200 });
    const result = await queryItalyCadastre(41.9, 12.5, fetcher as typeof fetch);
    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe('NO_DATA');
    expect(result.evidence[0].status).toBe('REQUIRES_VERIFICATION');
  });
});
