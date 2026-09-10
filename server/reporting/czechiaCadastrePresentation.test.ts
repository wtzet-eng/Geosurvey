import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCzechiaCadastrePresentation } from './czechiaCadastrePresentation';

const canonical = (): any => ({
  countryCode: 'CZ',
  evidenceRecords: [
    {
      id: 'cz-cuzk-ruian-parcel', status: 'VERIFIED', sourceName: 'Český úřad zeměměřický a katastrální (ČÚZK) — RÚIAN',
      value: { parcelNumber: '123/4', areaM2: 987, landType: 'zastavěná plocha a nádvoří', landUse: 'jiná plocha', cadastralAreaName: 'Staré Město' }
    },
    {
      id: 'cz-cuzk-ruian-buildings', status: 'VERIFIED', sourceName: 'Český úřad zeměměřický a katastrální (ČÚZK) — RÚIAN',
      value: { buildingCount: 1, buildings: [{ id: '987654321', use: 'objekt k bydlení', floorCount: 4, floorAreaM2: 460, builtUpAreaM2: 155 }] }
    }
  ]
});

test('Czech cadastral presentation exposes registered parcel and building facts without turning them into value or planning conclusions', () => {
  const result = renderCzechiaCadastrePresentation(canonical(), 'en');
  assert.ok(result);
  assert.match(result!.narrative, /parcel 123\/4/i);
  assert.match(result!.narrative, /registered area 987 m²/i);
  assert.match(result!.narrative, /1 registered building object/i);
  assert.match(result!.narrative, /floor area 460 m²/i);
  assert.match(result!.narrative, /does not establish ownership/i);
  assert.match(result!.narrative, /not a structural survey/i);
  assert.match(result!.narrative, /buildings remain excluded from the land-value estimate/i);
});

test('Czech cadastral presentation localizes explanatory prose while preserving Czech registry values', () => {
  const de = renderCzechiaCadastrePresentation(canonical(), 'de');
  const pl = renderCzechiaCadastrePresentation(canonical(), 'pl');
  assert.match(de!.narrative, /ČÚZK-RÚIAN-Katasterkontext/);
  assert.match(pl!.narrative, /Kontekst katastralny ČÚZK RÚIAN/);
  assert.match(de!.narrative, /zastavěná plocha a nádvoří/);
  assert.match(pl!.narrative, /objekt k bydlení/);
});

test('Czech zero-building diagnostic is not rendered as a claim that the parcel is undeveloped', () => {
  const fixture: any = canonical();
  fixture.evidenceRecords = fixture.evidenceRecords.filter((record: any) => record.id !== 'cz-cuzk-ruian-buildings');
  fixture.evidenceRecords.push({ id: 'cz-cuzk-ruian-buildings-no-data', status: 'REQUIRES_VERIFICATION', sourceName: 'ČÚZK', value: { reasonCode: 'NO_DATA' } });
  const result = renderCzechiaCadastrePresentation(fixture, 'en');
  assert.ok(result);
  assert.doesNotMatch(result!.narrative, /undeveloped|vacant/i);
  assert.equal(result!.buildings, undefined);
});
