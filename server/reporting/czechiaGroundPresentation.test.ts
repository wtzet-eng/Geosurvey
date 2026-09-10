import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCzechiaGroundPresentation } from './czechiaGroundPresentation';

const canonical: any = {
  countryCode: 'CZ',
  evidenceRecords: [
    {
      id: 'cz-cgs-engineering-geology', status: 'VERIFIED', sourceName: 'Czech Geological Survey (ČGS)',
      value: { code: 'F', name: 'rajón fluviálních sedimentů', characterization: 'proměnlivé zrnitostní složení', typicalRocks: 'štěrky, písky a hlíny', scale: '1:50,000' }
    },
    {
      id: 'cz-cgs-hydrogeology', status: 'VERIFIED', sourceName: 'Czech Geological Survey (ČGS)',
      value: { unit: 'kvartérní fluviální sedimenty', rock: 'štěrky a písky', transmissivity: 'vysoká', description: 'průlinový kolektor', scale: '1:50,000' }
    },
    {
      id: 'cz-cgs-borehole-context', status: 'VERIFIED', sourceName: 'Czech Geological Survey (ČGS)',
      value: { searchRadiusM: 5000, nearestDistanceM: 240, boreholes: [{ identifier: 'V-1' }, { identifier: 'V-2' }], hydrogeologicalBoreholes: [{ identifier: 'V-2' }] }
    },
    {
      id: 'cz-cgs-slope-deformation-site', status: 'VERIFIED', sourceName: 'Czech Geological Survey (ČGS)', value: { count: 1 }
    }
  ]
};

test('Czechia reader presentation exposes engineering geology, hydrogeology, boreholes and mapped deformation with one investigation boundary', () => {
  const result = renderCzechiaGroundPresentation(canonical, 'en');
  assert.ok(result);
  assert.match(result!.narrative, /engineering-geological zoning/i);
  assert.match(result!.narrative, /transmissivity/i);
  assert.match(result!.narrative, /2 nearby records/i);
  assert.match(result!.narrative, /nearest approximately 240 m/i);
  assert.match(result!.narrative, /slope-deformation/i);
  assert.match(result!.narrative, /do not establish parcel stratigraphy/i);
  assert.equal(result!.engineeringGeology?.code, 'F');
  assert.equal(result!.hydrogeology?.transmissivity, 'vysoká');
  assert.equal(result!.boreholes?.hydrogeologicalCount, 1);
  assert.equal(result!.slopeDeformation?.count, 1);
});

test('Czechia ground presentation is localized without changing source scientific names', () => {
  const de = renderCzechiaGroundPresentation(canonical, 'de');
  const pl = renderCzechiaGroundPresentation(canonical, 'pl');
  assert.match(de!.narrative, /Ingenieurgeologische Zonierung/i);
  assert.match(pl!.narrative, /inżyniersko-geologiczna/i);
  assert.match(de!.narrative, /rajón fluviálních sedimentů/);
  assert.match(pl!.narrative, /rajón fluviálních sedimentů/);
});

test('Czechia presentation does not render for another country', () => {
  assert.equal(renderCzechiaGroundPresentation({ ...canonical, countryCode: 'SK' }, 'en'), null);
});
