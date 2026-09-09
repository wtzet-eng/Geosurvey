export type PolandValuationTier = 'city' | 'voivodeship' | 'national';

export interface PolandValuationBenchmark {
  tier: PolandValuationTier;
  benchmarkPricePerSqm: number;
  lowFactor: number;
  highFactor: number;
  label: string;
  sourceName: string;
  datasetDate: string;
  sourceUrl: string;
}

const CITY_BENCHMARKS: Record<string, number> = {
  warszawa: 1009,
  gdansk: 841,
  krakow: 778,
  wroclaw: 543,
  poznan: 516,
  olsztyn: 472,
  lodz: 466,
  lublin: 425
};

const VOIVODESHIP_BENCHMARKS: Record<string, number> = {
  dolnoslaskie: 141,
  lodzkie: 134,
  lubelskie: 122,
  mazowieckie: 162,
  malopolskie: 203,
  warminsko_mazurskie: 126,
  pomorskie: 171,
  wielkopolskie: 173
};

const CENATORIUM_SOURCE = 'Cenatorium transaction-price report (Bankier.pl / Puls Biznesu), Q1 2026';
const CENATORIUM_URL = 'https://www.bankier.pl/wiadomosc/Ceny-transakcyjne-dzialek-budowlanych-I-kw-2026-Raport-9149669.html';
const NATIONAL_SOURCE = 'RCN transaction aggregate (GUGiK-derived), 12 months to 31 July 2026';
const NATIONAL_URL = 'https://dzialkopedia.pl/poradnik/ceny-dzialek-budowlanych';
const NATIONAL_TRANSACTION_BENCHMARK = 188;

function normalize(value?: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[ł]/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—-]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^wojewodztwo_?/, '')
    .replace(/^woj_?/, '')
    .replace(/^_|_$/g, '');
}

function resolveCityKey(value?: string): string | undefined {
  const normalized = normalize(value);
  return Object.keys(CITY_BENCHMARKS).find(key => normalized === key || normalized.endsWith(`_${key}`));
}

/**
 * Selects an explicit Polish building-land transaction benchmark.
 *
 * This is deliberately a hierarchy, not a multiplier stack:
 * city benchmark -> voivodeship benchmark -> national transaction fallback.
 * The returned uncertainty band widens as spatial specificity decreases.
 */
export function resolvePolandValuationBenchmark(
  municipality?: string,
  voivodeship?: string
): PolandValuationBenchmark {
  const cityKey = resolveCityKey(municipality);
  const cityPrice = cityKey ? CITY_BENCHMARKS[cityKey] : undefined;
  if (cityPrice) {
    return {
      tier: 'city',
      benchmarkPricePerSqm: cityPrice,
      lowFactor: 0.70,
      highFactor: 1.35,
      label: `${municipality || cityKey} city transaction benchmark`,
      sourceName: CENATORIUM_SOURCE,
      datasetDate: '2026-Q1',
      sourceUrl: CENATORIUM_URL
    };
  }

  const regionKey = normalize(voivodeship);
  const regionalPrice = VOIVODESHIP_BENCHMARKS[regionKey];
  if (regionalPrice) {
    return {
      tier: 'voivodeship',
      benchmarkPricePerSqm: regionalPrice,
      lowFactor: 0.60,
      highFactor: 1.50,
      label: `${voivodeship || regionKey} voivodeship transaction benchmark`,
      sourceName: CENATORIUM_SOURCE,
      datasetDate: '2026-Q1',
      sourceUrl: CENATORIUM_URL
    };
  }

  return {
    tier: 'national',
    benchmarkPricePerSqm: NATIONAL_TRANSACTION_BENCHMARK,
    lowFactor: 0.50,
    highFactor: 1.70,
    label: 'Poland national building-land transaction fallback',
    sourceName: NATIONAL_SOURCE,
    datasetDate: '12 months ending 2026-07-31',
    sourceUrl: NATIONAL_URL
  };
}
