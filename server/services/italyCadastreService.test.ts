import { test } from 'node:test';
import assert from 'node:assert/strict';
import { queryItalyCadastre } from './italyCadastreService';

test('queryItalyCadastre extracts cadastral identifiers from an Agenzia delle Entrate WMS feature-info response', async () => {
    const html = `
      <table>
        <tr><th>InspireId localId</th><td>IT.AGE.PLA.G273_0033A0.673</td></tr>
        <tr><th>Codice Comune</th><td>G273</td></tr>
        <tr><th>Foglio</th><td>33</td></tr>
        <tr><th>Particella</th><td>673</td></tr>
      </table>`;
    const fetcher = async () => new Response(html, { status: 200 });
    const result = await queryItalyCadastre(41.9, 12.5, fetcher as typeof fetch);
    assert.equal(result.success, true);
    assert.equal(result.parcel?.parcelId, '673');
    assert.equal(result.parcel?.nationalCadastralReference, 'G273 / 33 / 673');
    assert.equal(result.evidence[0].status, 'VERIFIED');
});

test('queryItalyCadastre does not turn an empty feature-info response into a false parcel absence claim', async () => {
    const fetcher = async () => new Response('<html><body>no feature</body></html>', { status: 200 });
    const result = await queryItalyCadastre(41.9, 12.5, fetcher as typeof fetch);
    assert.equal(result.success, false);
    assert.equal(result.reasonCode, 'NO_DATA');
    assert.equal(result.evidence[0].status, 'REQUIRES_VERIFICATION');
  });
