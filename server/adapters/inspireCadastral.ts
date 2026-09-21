/** Common INSPIRE Cadastral Parcels registry. Keep source lineage explicit. */
export type InspireCadastreSourceLevel = 'INSPIRE_DERIVED' | 'NATIONAL_OFFICIAL' | 'LOCAL_OFFICIAL' | 'SUPPLEMENTARY';

export interface InspireCadastralSource {
  countryCode: string;
  countryName: string;
  serviceUrl: string;
  featureType: string;
  provider: string;
  underlyingSystem: string;
  sourceLevel: InspireCadastreSourceLevel;
  coverageNote: string;
  status: 'CONNECTED' | 'DISCOVERED' | 'NOT_YET_CONNECTED';
}

export const INSPIRE_CADASTRAL_SOURCES: Record<string, InspireCadastralSource> = {
  CZ: {
    countryCode: 'CZ',
    countryName: 'Czechia',
    serviceUrl: 'https://services.cuzk.gov.cz/wfs/inspire-CP-wfs.asp',
    featureType: 'cp:CadastralParcel',
    provider: 'Český úřad zeměměřický a katastrální (ČÚZK)',
    underlyingSystem: 'Information System of the Cadastre of Real Estates (ISKN)',
    sourceLevel: 'INSPIRE_DERIVED',
    coverageNote: 'CP parcel polygons are published for cadastral units with a digital cadastral map; ČÚZK reports 99.52% of Czech territory as of 2026-09-21.',
    status: 'CONNECTED'
  },
  PL: {
    countryCode: 'PL',
    countryName: 'Poland',
    serviceUrl: 'https://uldk.gugik.gov.pl/',
    featureType: 'EGiB / ULDK',
    provider: 'Główny Urząd Geodezji i Kartografii (GUGiK)',
    underlyingSystem: 'EGiB cadastral data',
    sourceLevel: 'NATIONAL_OFFICIAL',
    coverageNote: 'National official access layer; local EGiB agreement has been confirmed for the Warsaw control parcel.',
    status: 'CONNECTED'
  }
};

export function getInspireCadastralSource(countryCode: string): InspireCadastralSource | null {
  return INSPIRE_CADASTRAL_SOURCES[(countryCode || '').toUpperCase()] || null;
}

export function getInspireCadastralSources(): InspireCadastralSource[] {
  return Object.values(INSPIRE_CADASTRAL_SOURCES);
}
