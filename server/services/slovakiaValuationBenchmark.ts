export type SlovakiaValuationTier = 'city' | 'region' | 'national';

export interface SlovakiaValuationBenchmark {
  tier: SlovakiaValuationTier;
  benchmarkPricePerSqm: number;
  lowFactor: number;
  highFactor: number;
  label: string;
  sourceName: string;
  datasetDate: string;
  sourceUrl: string;
  evidenceKind: 'ASKING_PRICE';
}

export interface SlovakiaLandValueInput {
  areaM2: number;
  slopeDegrees?: number | null;
  roadDistanceM?: number | null;
  directRoadAccess?: boolean | null;
  municipality?: string;
  region?: string;
}

export interface SlovakiaLandValueResult {
  benchmark: SlovakiaValuationBenchmark;
  locationMultiplier: 1;
  terrainMultiplier: number;
  roadMultiplier: number;
  sizeMultiplier: number;
  unitMedianPrice: number;
  unitMinPrice: number;
  unitMaxPrice: number;
  totalMedian: number;
  totalMin: number;
  totalMax: number;
}

interface CityBenchmarkDefinition {
  pricePerSqm: number;
  sourceUrl: string;
}

/**
 * ZoznamRealit.SK rolling residential-plot ("pozemky - bývanie") asking-price
 * series observed during the 2026-09 benchmark refresh. These are advertised
 * prices, not completed cadastral transactions.
 */
const CITY_BENCHMARKS: Record<string, CityBenchmarkDefinition> = {
  bratislava: {
    pricePerSqm: 312,
    sourceUrl: 'https://www.zoznamrealit.sk/predaj/pozemky/pozemky-byvanie/bratislava/cena'
  },
  trnava: {
    pricePerSqm: 112,
    sourceUrl: 'https://www.zoznamrealit.sk/predaj/pozemky/pozemky-byvanie/trnava/cena'
  },
  trencin: {
    pricePerSqm: 90,
    sourceUrl: 'https://www.zoznamrealit.sk/predaj/pozemky/pozemky-byvanie/trencin/cena'
  },
  nitra: {
    pricePerSqm: 74,
    sourceUrl: 'https://www.zoznamrealit.sk/predaj/pozemky/pozemky-byvanie/nitra/cena'
  },
  zilina: {
    pricePerSqm: 102,
    sourceUrl: 'https://www.zoznamrealit.sk/predaj/pozemky/pozemky-byvanie/zilina/cena'
  },
  banska_bystrica: {
    pricePerSqm: 143,
    sourceUrl: 'https://www.zoznamrealit.sk/predaj/pozemky/pozemky-byvanie/banska-bystrica/cena'
  },
  presov: {
    pricePerSqm: 69,
    sourceUrl: 'https://www.zoznamrealit.sk/predaj/pozemky/pozemky-byvanie/presov/cena'
  },
  kosice: {
    pricePerSqm: 113,
    sourceUrl: 'https://www.zoznamrealit.sk/predaj/pozemky/pozemky-byvanie/kosice/cena'
  }
};

/**
 * Midpoints of published February-May 2026 regional residential/building-plot
 * asking-price ranges. The wider uncertainty factors below acknowledge that
 * these are secondary market summaries and that within-region dispersion is
 * substantial.
 */
const REGION_BENCHMARKS: Record<string, number> = {
  bratislavsky: 180,     // published range 150-210 €/m²
  trnavsky: 84,          // 60-107 €/m²
  nitriansky: 48,        // 25-70 €/m²
  trenciansky: 45,       // 25-65 €/m²
  zilinsky: 65,          // 40-90 €/m²
  banskobystricky: 61,   // 30-92 €/m²
  kosicky: 58,           // 45-70 €/m²
  presovsky: 43          // 25-60 €/m²
};

const CITY_SOURCE = 'ZoznamRealit.SK / Združenie realitných kancelárií Slovenska (ZRKS) residential-plot asking-price series';
const REGIONAL_SOURCE = 'Reality v kocke 2026 residential/building-plot asking-price synthesis (ZoznamRealit and Slovak listing sources)';
const REGIONAL_URL = 'https://www.realityvkocke.sk/aktualne-ceny-pozemkov-a-domov-na-slovensku-prehlad-realitneho-trhu-2026/';
const NATIONAL_ASKING_BENCHMARK = 69;

function normalize(value?: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—-]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^samospravny_?/, '')
    .replace(/^kraj_?/, '')
    .replace(/^_|_$/g, '');
}

function resolveCityKey(value?: string): string | undefined {
  const normalized = normalize(value);
  return Object.keys(CITY_BENCHMARKS).find(key => normalized === key || normalized.endsWith(`_${key}`));
}

function resolveRegionKey(value?: string): string | undefined {
  const normalized = normalize(value)
    .replace(/_samospravny_kraj$/, '')
    .replace(/_kraj$/, '');
  return Object.keys(REGION_BENCHMARKS).find(key => normalized === key || normalized.startsWith(`${key}_`));
}

/**
 * Selects a Slovak residential/building-land asking-price screening benchmark.
 *
 * Hierarchy mirrors the Polish valuation architecture, but evidence quality
 * deliberately does not: city -> kraj -> national. These are advertised
 * residential/building-plot prices, not completed-sale cadastral evidence.
 */
export function resolveSlovakiaValuationBenchmark(
  municipality?: string,
  region?: string
): SlovakiaValuationBenchmark {
  const cityKey = resolveCityKey(municipality);
  const city = cityKey ? CITY_BENCHMARKS[cityKey] : undefined;
  if (city) {
    return {
      tier: 'city',
      benchmarkPricePerSqm: city.pricePerSqm,
      lowFactor: 0.60,
      highFactor: 1.45,
      label: `${municipality || cityKey} residential-plot asking benchmark`,
      sourceName: CITY_SOURCE,
      datasetDate: '2026-09 benchmark refresh',
      sourceUrl: city.sourceUrl,
      evidenceKind: 'ASKING_PRICE'
    };
  }

  const regionKey = resolveRegionKey(region);
  const regionalPrice = regionKey ? REGION_BENCHMARKS[regionKey] : undefined;
  if (regionalPrice) {
    return {
      tier: 'region',
      benchmarkPricePerSqm: regionalPrice,
      lowFactor: 0.50,
      highFactor: 1.60,
      label: `${region || regionKey} regional residential/building-plot asking benchmark`,
      sourceName: REGIONAL_SOURCE,
      datasetDate: '2026-05-27 (Feb-May 2026 asking-price synthesis)',
      sourceUrl: REGIONAL_URL,
      evidenceKind: 'ASKING_PRICE'
    };
  }

  return {
    tier: 'national',
    benchmarkPricePerSqm: NATIONAL_ASKING_BENCHMARK,
    lowFactor: 0.45,
    highFactor: 1.70,
    label: 'Slovakia national residential/building-plot asking fallback',
    sourceName: REGIONAL_SOURCE,
    datasetDate: '2026-05-27 (May 2026 national asking-price level)',
    sourceUrl: REGIONAL_URL,
    evidenceKind: 'ASKING_PRICE'
  };
}

/** Applies the existing GeoSurvey parcel-size, road and terrain screening adjustments. */
export function calculateSlovakiaLandValue(input: SlovakiaLandValueInput): SlovakiaLandValueResult {
  const benchmark = resolveSlovakiaValuationBenchmark(input.municipality, input.region);
  const terrainMultiplier = typeof input.slopeDegrees === 'number' && Number.isFinite(input.slopeDegrees) && input.slopeDegrees > 10 ? 0.88 : 1;
  const roadMultiplier = input.directRoadAccess === false
    && typeof input.roadDistanceM === 'number'
    && Number.isFinite(input.roadDistanceM)
    && input.roadDistanceM > 50
    ? 0.82
    : 1;
  const sizeMultiplier = input.areaM2 > 2500 ? 0.90 : input.areaM2 < 750 ? 1.10 : 1;
  const unitMedianPrice = Math.round(benchmark.benchmarkPricePerSqm * terrainMultiplier * roadMultiplier * sizeMultiplier);
  const unitMinPrice = Math.round(unitMedianPrice * benchmark.lowFactor);
  const unitMaxPrice = Math.round(unitMedianPrice * benchmark.highFactor);

  return {
    benchmark,
    locationMultiplier: 1,
    terrainMultiplier,
    roadMultiplier,
    sizeMultiplier,
    unitMedianPrice,
    unitMinPrice,
    unitMaxPrice,
    totalMedian: Math.round(input.areaM2 * unitMedianPrice),
    totalMin: Math.round(input.areaM2 * unitMinPrice),
    totalMax: Math.round(input.areaM2 * unitMaxPrice)
  };
}
