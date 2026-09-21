/** Common INSPIRE Cadastral Parcels registry. Keep source lineage explicit. */
export type InspireCadastreSourceLevel = 'INSPIRE_DERIVED' | 'NATIONAL_OFFICIAL' | 'LOCAL_OFFICIAL' | 'SUPPLEMENTARY';

export interface InspireCadastralSource {
  countryCode: string;
  countryName: string;
  serviceUrl?: string;
  discoveryUrl?: string;
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
  },
  BE: { countryCode: 'BE', countryName: 'Belgium', featureType: 'cp:CadastralParcel', provider: 'National cadastral authority', underlyingSystem: 'National cadastral data', sourceLevel: 'INSPIRE_DERIVED', discoveryUrl: 'https://eurogeographics.org/activities/ome2-progress/open-maps-for-europe-2-highlights/', coverageNote: 'INSPIRE cadastral coverage is listed by the EuroGeographics Open Cadastral Map; national service still requires connection and live verification.', status: 'DISCOVERED' },
  HR: { countryCode: 'HR', countryName: 'Croatia', featureType: 'cp:CadastralParcel', provider: 'National cadastral authority', underlyingSystem: 'National cadastral data', sourceLevel: 'INSPIRE_DERIVED', discoveryUrl: 'https://eurogeographics.org/activities/ome2-progress/open-maps-for-europe-2-highlights/', coverageNote: 'INSPIRE cadastral coverage is listed by the EuroGeographics Open Cadastral Map; national service still requires connection and live verification.', status: 'DISCOVERED' },
  DK: { countryCode: 'DK', countryName: 'Denmark', featureType: 'cp:CadastralParcel', provider: 'National cadastral authority', underlyingSystem: 'National cadastral data', sourceLevel: 'INSPIRE_DERIVED', discoveryUrl: 'https://eurogeographics.org/activities/ome2-progress/open-maps-for-europe-2-highlights/', coverageNote: 'INSPIRE cadastral coverage is listed by the EuroGeographics Open Cadastral Map; national service still requires connection and live verification.', status: 'DISCOVERED' },
  EE: { countryCode: 'EE', countryName: 'Estonia', featureType: 'cp:CadastralParcel', provider: 'National cadastral authority', underlyingSystem: 'National cadastral data', sourceLevel: 'INSPIRE_DERIVED', discoveryUrl: 'https://eurogeographics.org/activities/ome2-progress/open-maps-for-europe-2-highlights/', coverageNote: 'INSPIRE cadastral coverage is listed by the EuroGeographics Open Cadastral Map; national service still requires connection and live verification.', status: 'DISCOVERED' },
  GR: { countryCode: 'GR', countryName: 'Greece', featureType: 'cp:CadastralParcel', provider: 'Hellenic Cadastre', underlyingSystem: 'National cadastral data', sourceLevel: 'INSPIRE_DERIVED', discoveryUrl: 'https://eurogeographics.org/activities/ome2-progress/open-maps-for-europe-2-highlights/', coverageNote: 'INSPIRE cadastral coverage is listed by the EuroGeographics Open Cadastral Map; national service still requires connection and live verification.', status: 'DISCOVERED' },
  IE: { countryCode: 'IE', countryName: 'Ireland', featureType: 'cp:CadastralParcel', provider: 'National cadastral authority', underlyingSystem: 'National cadastral data', sourceLevel: 'INSPIRE_DERIVED', discoveryUrl: 'https://eurogeographics.org/activities/ome2-progress/open-maps-for-europe-2-highlights/', coverageNote: 'INSPIRE cadastral coverage is listed by the EuroGeographics Open Cadastral Map; national service still requires connection and live verification.', status: 'DISCOVERED' },
  LV: { countryCode: 'LV', countryName: 'Latvia', featureType: 'cp:CadastralParcel', provider: 'National cadastral authority', underlyingSystem: 'National cadastral data', sourceLevel: 'INSPIRE_DERIVED', discoveryUrl: 'https://eurogeographics.org/activities/ome2-progress/open-maps-for-europe-2-highlights/', coverageNote: 'INSPIRE cadastral coverage is listed by the EuroGeographics Open Cadastral Map; national service still requires connection and live verification.', status: 'DISCOVERED' },
  LU: { countryCode: 'LU', countryName: 'Luxembourg', featureType: 'cp:CadastralParcel', provider: 'National cadastral authority', underlyingSystem: 'National cadastral data', sourceLevel: 'INSPIRE_DERIVED', discoveryUrl: 'https://eurogeographics.org/activities/ome2-progress/open-maps-for-europe-2-highlights/', coverageNote: 'INSPIRE cadastral coverage is listed by the EuroGeographics Open Cadastral Map; national service still requires connection and live verification.', status: 'DISCOVERED' },
  NL: { countryCode: 'NL', countryName: 'Netherlands', featureType: 'cp:CadastralParcel', provider: 'Kadaster', underlyingSystem: 'National cadastral data', sourceLevel: 'INSPIRE_DERIVED', discoveryUrl: 'https://eurogeographics.org/activities/ome2-progress/open-maps-for-europe-2-highlights/', coverageNote: 'INSPIRE cadastral coverage is listed by the EuroGeographics Open Cadastral Map; national service still requires connection and live verification.', status: 'DISCOVERED' },
  SK: { countryCode: 'SK', countryName: 'Slovakia', featureType: 'cp:CadastralParcel', provider: 'National cadastral authority', underlyingSystem: 'National cadastral data', sourceLevel: 'INSPIRE_DERIVED', discoveryUrl: 'https://eurogeographics.org/activities/ome2-progress/open-maps-for-europe-2-highlights/', coverageNote: 'INSPIRE cadastral coverage is listed by the EuroGeographics Open Cadastral Map; national service still requires connection and live verification.', status: 'DISCOVERED' },
  SI: { countryCode: 'SI', countryName: 'Slovenia', featureType: 'cp:CadastralParcel', provider: 'National cadastral authority', underlyingSystem: 'National cadastral data', sourceLevel: 'INSPIRE_DERIVED', discoveryUrl: 'https://eurogeographics.org/activities/ome2-progress/open-maps-for-europe-2-highlights/', coverageNote: 'INSPIRE cadastral coverage is listed by the EuroGeographics Open Cadastral Map; national service still requires connection and live verification.', status: 'DISCOVERED' },
  ES: { countryCode: 'ES', countryName: 'Spain', featureType: 'cp:CadastralParcel', provider: 'Dirección General del Catastro', underlyingSystem: 'National cadastral data', sourceLevel: 'INSPIRE_DERIVED', discoveryUrl: 'https://eurogeographics.org/activities/ome2-progress/open-maps-for-europe-2-highlights/', coverageNote: 'INSPIRE cadastral coverage is listed by the EuroGeographics Open Cadastral Map; national service still requires connection and live verification.', status: 'DISCOVERED' },
  CH: { countryCode: 'CH', countryName: 'Switzerland', featureType: 'cp:CadastralParcel', provider: 'National cadastral authority', underlyingSystem: 'National cadastral data', sourceLevel: 'INSPIRE_DERIVED', discoveryUrl: 'https://eurogeographics.org/activities/ome2-progress/open-maps-for-europe-2-highlights/', coverageNote: 'INSPIRE-style cadastral coverage is listed by the EuroGeographics Open Cadastral Map; national service still requires connection and live verification.', status: 'DISCOVERED' }
};

export function getInspireCadastralSource(countryCode: string): InspireCadastralSource | null {
  return INSPIRE_CADASTRAL_SOURCES[(countryCode || '').toUpperCase()] || null;
}

export function getInspireCadastralSources(): InspireCadastralSource[] {
  return Object.values(INSPIRE_CADASTRAL_SOURCES);
}
