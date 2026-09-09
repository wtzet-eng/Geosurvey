export type GermanyValuationTier = 'CITY' | 'STATE' | 'NATIONAL';

export interface GermanyValuationBenchmark {
  tier: GermanyValuationTier;
  label: string;
  benchmarkPricePerSqm: number;
  lowFactor: number;
  highFactor: number;
  sourceName: string;
  sourceUrl: string;
  datasetDate: string;
}

export interface GermanyLandValueResult {
  benchmark: GermanyValuationBenchmark;
  unitMedianPrice: number;
  unitMinPrice: number;
  unitMaxPrice: number;
  totalMedian: number;
  totalMin: number;
  totalMax: number;
}

const DESTATIS_STATE_SOURCE = 'Statistisches Bundesamt (Destatis), GENESIS 61511-0050 — Kaufwerte für baureifes Land';
const DESTATIS_STATE_URL = 'https://genesis.destatis.de/datenbank/online/statistic/61511/table/61511-0050';
const DESTATIS_NATIONAL_SOURCE = 'Statistisches Bundesamt (Destatis), GENESIS 61511-0010 — Kaufwerte für baureifes Land';
const DESTATIS_NATIONAL_URL = 'https://genesis.destatis.de/datenbank/online/statistic/61511/table/61511-0010';
const REGIONAL_SOURCE = 'Statistische Ämter des Bundes und der Länder, Regionaldatenbank 61511-01-03-4 — Kaufwerte für baureifes Land';
const REGIONAL_URL = 'https://www.regionalstatistik.de/genesis/online/';
const HESSEN_SOURCE = 'Hessisches Statistisches Landesamt — Kaufwerte für Bauland';
const HESSEN_URL = 'https://statistik.hessen.de/';

const normalize = (value: string | undefined): string => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const CITY_VALUES: Record<string, GermanyValuationBenchmark> = {
  munchen: { tier: 'CITY', label: 'Munich city 2025 transaction benchmark', benchmarkPricePerSqm: 3455.08, lowFactor: 0.60, highFactor: 1.45, sourceName: REGIONAL_SOURCE, sourceUrl: REGIONAL_URL, datasetDate: '2025' },
  munich: { tier: 'CITY', label: 'Munich city 2025 transaction benchmark', benchmarkPricePerSqm: 3455.08, lowFactor: 0.60, highFactor: 1.45, sourceName: REGIONAL_SOURCE, sourceUrl: REGIONAL_URL, datasetDate: '2025' },
  koln: { tier: 'CITY', label: 'Cologne city 2025 transaction benchmark', benchmarkPricePerSqm: 1675.24, lowFactor: 0.60, highFactor: 1.45, sourceName: REGIONAL_SOURCE, sourceUrl: REGIONAL_URL, datasetDate: '2025' },
  cologne: { tier: 'CITY', label: 'Cologne city 2025 transaction benchmark', benchmarkPricePerSqm: 1675.24, lowFactor: 0.60, highFactor: 1.45, sourceName: REGIONAL_SOURCE, sourceUrl: REGIONAL_URL, datasetDate: '2025' },
  berlin: { tier: 'CITY', label: 'Berlin 2025 state/city transaction benchmark', benchmarkPricePerSqm: 756.46, lowFactor: 0.60, highFactor: 1.50, sourceName: DESTATIS_STATE_SOURCE, sourceUrl: DESTATIS_STATE_URL, datasetDate: '2025' },
  hamburg: { tier: 'CITY', label: 'Hamburg 2025 state/city transaction benchmark', benchmarkPricePerSqm: 1082.69, lowFactor: 0.60, highFactor: 1.50, sourceName: DESTATIS_STATE_SOURCE, sourceUrl: DESTATIS_STATE_URL, datasetDate: '2025' },
  bremen: { tier: 'CITY', label: 'Bremen 2025 state/city transaction benchmark', benchmarkPricePerSqm: 197.44, lowFactor: 0.55, highFactor: 1.70, sourceName: DESTATIS_STATE_SOURCE, sourceUrl: DESTATIS_STATE_URL, datasetDate: '2025' },
  'frankfurt am main': { tier: 'CITY', label: 'Frankfurt am Main 2024 city transaction benchmark', benchmarkPricePerSqm: 1699.17, lowFactor: 0.50, highFactor: 1.65, sourceName: HESSEN_SOURCE, sourceUrl: HESSEN_URL, datasetDate: '2024' },
  frankfurt: { tier: 'CITY', label: 'Frankfurt am Main 2024 city transaction benchmark', benchmarkPricePerSqm: 1699.17, lowFactor: 0.50, highFactor: 1.65, sourceName: HESSEN_SOURCE, sourceUrl: HESSEN_URL, datasetDate: '2024' }
};

const STATE_VALUES: Record<string, number> = {
  'baden wurttemberg': 337.92,
  'baden wuerttemberg': 337.92,
  bavaria: 428.46,
  bayern: 428.46,
  berlin: 756.46,
  brandenburg: 158.51,
  bremen: 197.44,
  hamburg: 1082.69,
  hesse: 267.96,
  hessen: 267.96,
  'lower saxony': 147.31,
  niedersachsen: 147.31,
  'mecklenburg western pomerania': 111.40,
  'mecklenburg vorpommern': 111.40,
  'north rhine westphalia': 296.64,
  'nordrhein westfalen': 296.64,
  'rhineland palatinate': 173.60,
  'rheinland pfalz': 173.60,
  saarland: 135.02,
  saxony: 125.57,
  sachsen: 125.57,
  'saxony anhalt': 72.98,
  'sachsen anhalt': 72.98,
  'schleswig holstein': 125.37,
  thuringia: 78.56,
  thuringen: 78.56
};

export function resolveGermanyValuationBenchmark(municipality?: string, state?: string): GermanyValuationBenchmark {
  const cityKey = normalize(municipality).replace(/^(stadt|city of)\s+/, '');
  const city = CITY_VALUES[cityKey];
  if (city) return city;

  const stateKey = normalize(state);
  const stateValue = STATE_VALUES[stateKey];
  if (stateValue !== undefined) {
    return {
      tier: 'STATE',
      label: `${state || 'German state'} 2025 transaction benchmark`,
      benchmarkPricePerSqm: stateValue,
      lowFactor: 0.30,
      highFactor: 4.00,
      sourceName: DESTATIS_STATE_SOURCE,
      sourceUrl: DESTATIS_STATE_URL,
      datasetDate: '2025'
    };
  }

  return {
    tier: 'NATIONAL',
    label: 'Germany 2025 national transaction benchmark',
    benchmarkPricePerSqm: 271.86,
    lowFactor: 0.25,
    highFactor: 5.00,
    sourceName: DESTATIS_NATIONAL_SOURCE,
    sourceUrl: DESTATIS_NATIONAL_URL,
    datasetDate: '2025'
  };
}

export function calculateGermanyLandValue(input: {
  areaM2: number;
  slopeDegrees?: number | null;
  roadDistanceM?: number | null;
  directRoadAccess?: boolean;
  municipality?: string;
  state?: string;
}): GermanyLandValueResult {
  const benchmark = resolveGermanyValuationBenchmark(input.municipality, input.state);
  let adjustment = 1;
  if (typeof input.slopeDegrees === 'number' && Number.isFinite(input.slopeDegrees) && input.slopeDegrees > 10) adjustment *= 0.88;
  if (typeof input.roadDistanceM === 'number' && Number.isFinite(input.roadDistanceM) && !input.directRoadAccess && input.roadDistanceM > 50) adjustment *= 0.82;
  adjustment *= input.areaM2 > 2500 ? 0.90 : input.areaM2 < 750 ? 1.10 : 1.0;

  const unitMedianPrice = Math.max(1, Math.round(benchmark.benchmarkPricePerSqm * adjustment));
  const unitMinPrice = Math.max(1, Math.round(unitMedianPrice * benchmark.lowFactor));
  const unitMaxPrice = Math.max(unitMinPrice, Math.round(unitMedianPrice * benchmark.highFactor));
  return {
    benchmark,
    unitMedianPrice,
    unitMinPrice,
    unitMaxPrice,
    totalMedian: Math.round(unitMedianPrice * input.areaM2),
    totalMin: Math.round(unitMinPrice * input.areaM2),
    totalMax: Math.round(unitMaxPrice * input.areaM2)
  };
}
