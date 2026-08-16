import { Country, ReportLanguage } from '../types';

export const EUROPEAN_COUNTRIES: Country[] = [
  { code: 'PL', name: 'Poland', language: 'pl', currency: 'PLN', defaultCenter: [51.9194, 19.1451], defaultZoom: 6 },
  { code: 'DE', name: 'Germany', language: 'de', currency: 'EUR', defaultCenter: [51.1657, 10.4515], defaultZoom: 6 },
  { code: 'FR', name: 'France', language: 'fr', currency: 'EUR', defaultCenter: [46.2276, 2.2137], defaultZoom: 6 },
  { code: 'IT', name: 'Italy', language: 'it', currency: 'EUR', defaultCenter: [41.8719, 12.5674], defaultZoom: 6 },
  { code: 'ES', name: 'Spain', language: 'es', currency: 'EUR', defaultCenter: [40.4637, -3.7492], defaultZoom: 6 },
  { code: 'NL', name: 'Netherlands', language: 'nl', currency: 'EUR', defaultCenter: [52.1326, 5.2913], defaultZoom: 7 },
  { code: 'BE', name: 'Belgium', language: 'nl', currency: 'EUR', defaultCenter: [50.5039, 4.4699], defaultZoom: 8 },
  { code: 'AT', name: 'Austria', language: 'de', currency: 'EUR', defaultCenter: [47.5162, 14.5501], defaultZoom: 7 },
  { code: 'SE', name: 'Sweden', language: 'sv', currency: 'SEK', defaultCenter: [60.1282, 18.6435], defaultZoom: 5 },
  { code: 'IE', name: 'Ireland', language: 'en', currency: 'EUR', defaultCenter: [53.1424, -7.6921], defaultZoom: 7 },
  { code: 'FI', name: 'Finland', language: 'fi', currency: 'EUR', defaultCenter: [61.9241, 25.7482], defaultZoom: 5 },
  { code: 'PT', name: 'Portugal', language: 'pt', currency: 'EUR', defaultCenter: [39.3999, -8.2245], defaultZoom: 7 },
  { code: 'DK', name: 'Denmark', language: 'da', currency: 'DKK', defaultCenter: [56.2639, 9.5018], defaultZoom: 7 },
  { code: 'CZ', name: 'Czechia', language: 'cs', currency: 'CZK', defaultCenter: [49.8175, 15.473], defaultZoom: 7 },
  { code: 'HU', name: 'Hungary', language: 'hu', currency: 'HUF', defaultCenter: [47.1625, 19.5033], defaultZoom: 7 },
  { code: 'RO', name: 'Romania', language: 'ro', currency: 'RON', defaultCenter: [45.9432, 24.9668], defaultZoom: 6 },
  { code: 'SK', name: 'Slovakia', language: 'sk', currency: 'EUR', defaultCenter: [48.669, 19.699], defaultZoom: 7 },
  { code: 'HR', name: 'Croatia', language: 'hr', currency: 'EUR', defaultCenter: [45.1, 15.2], defaultZoom: 7 },
  { code: 'GR', name: 'Greece', language: 'el', currency: 'EUR', defaultCenter: [39.0742, 21.8243], defaultZoom: 6 },
  { code: 'EE', name: 'Estonia', language: 'et', currency: 'EUR', defaultCenter: [58.5953, 25.0136], defaultZoom: 7 },
  { code: 'LV', name: 'Latvia', language: 'lv', currency: 'EUR', defaultCenter: [56.8796, 24.6032], defaultZoom: 7 },
  { code: 'LT', name: 'Lithuania', language: 'lt', currency: 'EUR', defaultCenter: [55.1694, 23.8813], defaultZoom: 7 },
  { code: 'LU', name: 'Luxembourg', language: 'fr', currency: 'EUR', defaultCenter: [49.8153, 6.1296], defaultZoom: 9 },
  { code: 'CY', name: 'Cyprus', language: 'el', currency: 'EUR', defaultCenter: [35.1264, 33.4299], defaultZoom: 8 },
  { code: 'MT', name: 'Malta', language: 'mt', currency: 'EUR', defaultCenter: [35.9375, 14.3754], defaultZoom: 10 },
  { code: 'SI', name: 'Slovenia', language: 'sl', currency: 'EUR', defaultCenter: [46.1512, 14.9955], defaultZoom: 8 },
  { code: 'BG', name: 'Bulgaria', language: 'bg', currency: 'BGN', defaultCenter: [42.7339, 25.4858], defaultZoom: 7 },
  { code: 'NO', name: 'Norway', language: 'no', currency: 'NOK', defaultCenter: [60.472, 8.4689], defaultZoom: 5 },
  { code: 'CH', name: 'Switzerland', language: 'de', currency: 'CHF', defaultCenter: [46.8182, 8.2275], defaultZoom: 8 },
  { code: 'GB', name: 'United Kingdom', language: 'en', currency: 'GBP', defaultCenter: [55.3781, -3.436], defaultZoom: 6 },
  { code: 'IS', name: 'Iceland', language: 'is', currency: 'ISK', defaultCenter: [64.9631, -19.0208], defaultZoom: 6 }
];

export const REPORT_LANGUAGES: ReportLanguage[] = [
  { code: 'pl', label: 'Polski (Polish)' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch (German)' },
  { code: 'fr', label: 'Français (French)' },
  { code: 'es', label: 'Español (Spanish)' },
  { code: 'it', label: 'Italiano (Italian)' },
  { code: 'nl', label: 'Nederlands (Dutch)' },
  { code: 'sv', label: 'Svenska (Swedish)' },
  { code: 'da', label: 'Dansk (Danish)' },
  { code: 'fi', label: 'Suomi (Finnish)' },
  { code: 'hu', label: 'Magyar (Hungarian)' },
  { code: 'cs', label: 'Čeština (Czech)' },
  { code: 'ro', label: 'Română (Romanian)' },
  { code: 'el', label: 'Ελληνικά (Greek)' },
  { code: 'pt', label: 'Português (Portuguese)' },
  { code: 'hr', label: 'Hrvatski (Croatian)' },
  { code: 'sk', label: 'Slovenčina (Slovak)' },
  { code: 'sl', label: 'Slovenščina (Slovenian)' },
  { code: 'et', label: 'Eesti (Estonian)' },
  { code: 'lv', label: 'Latviešu (Latvian)' },
  { code: 'lt', label: 'Lietuvių (Lithuanian)' },
  { code: 'no', label: 'Norsk (Norwegian)' }
];

export interface GeoSurveyProfile {
  authorityName: string;
  acronym: string;
  mapViewerUrl: string;
  description: string;
  datasets: string[];
}

export const NATIONAL_GEOSURVEYS: Record<string, GeoSurveyProfile> = {
  PL: {
    authorityName: 'Państwowy Instytut Geologiczny – Państwowy Instytut Badawczy',
    acronym: 'PIG-PIB / CBDG / SOPO',
    mapViewerUrl: 'http://geologia.pgi.gov.pl',
    description: 'Szczegółowa Mapa Geologiczna Polski (SMGP 1:50 000), System Osłony Przeciwosuwiskowej SOPO oraz Krajowy Bank Danych Hydrogeologicznych',
    datasets: ['SMGP 1:50 000 (Lithology)', 'SOPO Landslide Hazard Registry', 'CBDG Hydrogeology & Aquifers', 'GUGiK EGiB & ULDK']
  },
  DE: {
    authorityName: 'Bundesanstalt für Geowissenschaften und Rohstoffe & Landesämter (LBEG / LfU)',
    acronym: 'BGR / Geoportal.de',
    mapViewerUrl: 'https://geoportal.bgr.de',
    description: 'Geologische Übersichtskarte 1:200 000 (GÜK200) & Bodenübersichtskarte (BÜK200)',
    datasets: ['BGR GÜK200', 'BÜK200 Soil Profiles', 'ALKIS Cadastral Register', 'BfG Flood Hazard Zones']
  },
  FR: {
    authorityName: 'Bureau de Recherches Géologiques et Minières',
    acronym: 'BRGM / Géoportail',
    mapViewerUrl: 'https://www.geoportail.gouv.fr',
    description: 'Carte géologique harmonisée de la France (1/50 000) et base nationale Argiles (Retrait-Gonflement)',
    datasets: ['BRGM Carte géologique 1/50 000', 'InfoTerre BSS Boreholes', 'Géorisques RGA Argiles', 'Cadastre IGN']
  },
  ES: {
    authorityName: 'Instituto Geológico y Minero de España (CSIC)',
    acronym: 'IGME-CSIC',
    mapViewerUrl: 'https://info.igme.es/visorweb/',
    description: 'Mapa Geológico de España (MAGNA 50 1:50.000) y Mapa Hidrogeológico',
    datasets: ['MAGNA 50 1:50.000', 'Catastro Inmobiliario Sede', 'MITECO Flood Zones (SNCZI)', 'IGN SIOSE']
  },
  IT: {
    authorityName: 'ISPRA – Servizio Geologico d\'Italia',
    acronym: 'ISPRA / CARG',
    mapViewerUrl: 'https://sgi2.isprambiente.it/geoviewer2/',
    description: 'Progetto CARG Foglio 1:50.000 e Piattaforma IdroGEO (Frane e alluvioni)',
    datasets: ['ISPRA CARG 1:50.000', 'IFFI Frane (Landslides)', 'Catasto Agenzia delle Entrate', 'PAI IdroGEO']
  },
  NL: {
    authorityName: 'TNO – Geologische Dienst Nederland',
    acronym: 'TNO / DINOloket / BRO',
    mapViewerUrl: 'https://www.dinoloket.nl',
    description: 'Basisregistratie Ondergrond (BRO), GeoTOP 3D subsurface model, REGIS II hydrogeology',
    datasets: ['BRO 3D Subsurface Model', 'GeoTOP Lithology', 'Kadaster BRK', 'Rijkswaterstaat Waterinfo']
  },
  GB: {
    authorityName: 'British Geological Survey',
    acronym: 'BGS / GeoIndex',
    mapViewerUrl: 'https://mapapps2.bgs.ac.uk/geoindex/home.html',
    description: 'BGS Geology 50k (DiGMapGB-50) & National Ground Stability Geohazard dataset',
    datasets: ['BGS DiGMapGB-50', 'BGS GeoSure Hazards', 'HM Land Registry INSPIRE', 'EA Flood Map for Planning']
  }
};

export function getGeoSurveyByCountry(countryCode: string): GeoSurveyProfile {
  const code = (countryCode || 'PL').toUpperCase();
  if (NATIONAL_GEOSURVEYS[code]) {
    return NATIONAL_GEOSURVEYS[code];
  }
  return {
    authorityName: `European Geological Surveys Directory (${code}) / EuroGeoSurveys EGDI`,
    acronym: 'EuroGeoSurveys / EGDI',
    mapViewerUrl: 'https://europe-geology.eu',
    description: 'European Geological Data Infrastructure (EGDI 1:50 000 / 1:250 000 harmonize series)',
    datasets: ['EuroGeoSurveys 1:250k', 'Copernicus DEM 30m', 'OpenStreetMap Infrastructure', 'National Cadastre Portal']
  };
}
