import test from 'node:test';
import assert from 'node:assert/strict';
import { EUROPEAN_COUNTRIES } from '../../src/data/countries';
import { getCountrySupport } from '../../src/data/countrySupport';
import { getCountryProfile } from '../adapters/countries';

const CALIBRATED = new Set(['PL', 'DE', 'FR', 'GB', 'SK', 'AT', 'ES', 'FI', 'IE']);

test('every European selector country resolves to its own profile rather than the generic Europe identity', () => {
  for (const country of EUROPEAN_COUNTRIES) {
    const profile = getCountryProfile(country.code);
    assert.equal(profile.countryCode, country.code, country.code);
    assert.equal(profile.countryName, country.name, country.code);
    assert.equal(profile.currency, country.currency, country.code);
  }
});

test('uncalibrated European countries cannot inherit a generic land-price baseline', () => {
  for (const country of EUROPEAN_COUNTRIES) {
    if (CALIBRATED.has(country.code)) continue;
    const profile = getCountryProfile(country.code);
    const support = getCountrySupport(country.code);
    assert.equal(profile.baseValuationPerSqm, 0, `${country.code} must not carry a placeholder €/m² baseline`);
    assert.equal(support.capabilities.nationalValuation, false, `${country.code} valuation must fail closed until calibrated`);
    assert.match(profile.valuationDataSource, /No generic land-price fallback/i, country.code);
  }
});

test('generic Europe fallback itself contains no €/m² value', () => {
  const profile = getCountryProfile('EU');
  assert.equal(profile.baseValuationPerSqm, 0);
  assert.match(profile.valuationDataSource, /No generic land-price fallback/i);
});
