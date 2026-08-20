/**
 * Country Adapters Registry & Knowledge Base for National Geospatial & Planning Jurisdictions
 */

export interface CountryAdapterProfile {
  countryCode: string;
  countryName: string;
  currency: string;
  symbol: string;
  cadastreAuthority: string;
  cadastrePortalUrl: string;
  geologyAuthority: string;
  geologyPortalUrl: string;
  floodAuthority: string;
  floodPortalUrl: string;
  planningInstrumentName: string; // e.g. "MPZP (Miejscowy Plan Zagospodarowania)", "B-Plan / §34 BauGB", "PLU (Plan Local d'Urbanisme)"
  standardSetbackRule: string;
  baseValuationPerSqm: number; // Regional baseline
  valuationDataSource: string;
}

export const COUNTRY_ADAPTERS: Record<string, CountryAdapterProfile> = {
  PL: {
    countryCode: 'PL',
    countryName: 'Poland',
    currency: 'PLN',
    symbol: 'zł',
    cadastreAuthority: 'Główny Urząd Geodezji i Kartografii (GUGiK / EGiB)',
    cadastrePortalUrl: 'https://geoportal.gov.pl',
    geologyAuthority: 'Państwowy Instytut Geologiczny – PIB (PIG-PIB / CBDG / SMGP)',
    geologyPortalUrl: 'https://geolog.pgi.gov.pl',
    floodAuthority: 'Państwowe Gospodarstwo Wodne Wody Polskie (Hydroportal ISOK)',
    floodPortalUrl: 'https://wody.isok.gov.pl',
    planningInstrumentName: 'Miejscowy Plan Zagospodarowania Przestrzennego (MPZP) / Decyzja WZ',
    standardSetbackRule: '4.0 m (ściany z oknami/drzwiami) / 3.0 m (ściany ślepe) od granicy działki',
    baseValuationPerSqm: 420,
    valuationDataSource: 'Rejestr Cen Nieruchomości (RCiWN) / Modele Statystyczne PKO/NBP'
  },
  DE: {
    countryCode: 'DE',
    countryName: 'Germany',
    currency: 'EUR',
    symbol: '€',
    cadastreAuthority: 'Amtliches Liegenschaftskatasterinformationssystem (ALKIS®)',
    cadastrePortalUrl: 'https://adv-online.de',
    geologyAuthority: 'Bundesanstalt für Geowissenschaften und Rohstoffe (BGR / SGD)',
    geologyPortalUrl: 'https://bgr.bund.de',
    floodAuthority: 'Länderübergreifendes Hochwasserportal (LHP) / Geoportal.de',
    floodPortalUrl: 'https://hochwasserzentralen.de',
    planningInstrumentName: 'Bebauungsplan (B-Plan) / Zulässigkeit nach § 34 BauGB',
    standardSetbackRule: 'Mindestens 3.00 m Abstandsfläche (§ 6 Musterbauordnung)',
    baseValuationPerSqm: 175,
    valuationDataSource: 'Bodenrichtwertinformationssystem Deutschland (BORIS-D)'
  },
  FR: {
    countryCode: 'FR',
    countryName: 'France',
    currency: 'EUR',
    symbol: '€',
    cadastreAuthority: 'Institut National de l\'Information Géographique et Forestière (IGN / Cadastre.gouv.fr)',
    cadastrePortalUrl: 'https://cadastre.gouv.fr',
    geologyAuthority: 'Bureau de Recherches Géologiques et Minières (BRGM / InfoTerre)',
    geologyPortalUrl: 'https://infoterre.brgm.fr',
    floodAuthority: 'Ministère de la Transition Écologique (Géorisques / Vigicrues)',
    floodPortalUrl: 'https://georisques.gouv.fr',
    planningInstrumentName: 'Plan Local d\'Urbanisme (PLU/PLUi) / Règlement National (RNU)',
    standardSetbackRule: 'Minimum 3.0 m des limites séparatives (ou 4.0 m selon PLU)',
    baseValuationPerSqm: 205,
    valuationDataSource: 'Demandes de Valeurs Foncières (DVF / Etalab)'
  },
  GB: {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    currency: 'GBP',
    symbol: '£',
    cadastreAuthority: 'HM Land Registry / Ordnance Survey (OS MasterMap)',
    cadastrePortalUrl: 'https://use-land-property-data.service.gov.uk/datasets/inspire',
    geologyAuthority: 'British Geological Survey (BGS / GeoIndex 1:50 000)',
    geologyPortalUrl: 'https://mapapps2.bgs.ac.uk/geoindex/home.html',
    floodAuthority: 'Environment Agency / Natural Resources Wales (Flood Map for Planning)',
    floodPortalUrl: 'https://environment.data.gov.uk/dataset/04532375-a198-476e-985e-0579a0a11b47',
    planningInstrumentName: 'Local Development Framework (LDF) / Planning Permission (NPPF)',
    standardSetbackRule: 'No fixed statutory setback; evaluated under Residential Design Guides',
    baseValuationPerSqm: 195,
    valuationDataSource: 'HM Land Registry Price Paid Data / ONS Housing Statistics'
  },
  ES: {
    countryCode: 'ES',
    countryName: 'Spain',
    currency: 'EUR',
    symbol: '€',
    cadastreAuthority: 'Sede Electrónica del Catastro (Dirección General del Catastro)',
    cadastrePortalUrl: 'https://sedecatastro.gob.es',
    geologyAuthority: 'Instituto Geológico y Minero de España (IGME-CSIC / MAGNA50)',
    geologyPortalUrl: 'https://igme.es',
    floodAuthority: 'Sistema Nacional de Cartografía de Zonas Inundables (SNCZI - MITECO)',
    floodPortalUrl: 'https://sig.mapama.gob.es/snczi',
    planningInstrumentName: 'Plan General de Ordenación Urbana (PGOU) / Plan Parcial',
    standardSetbackRule: 'Mínimo 3.00 m a linderos según Ordenanza Municipal de Edificación',
    baseValuationPerSqm: 155,
    valuationDataSource: 'Colegio de Registradores / Ministerio de Transportes (MITMA)'
  },
  IT: {
    countryCode: 'IT',
    countryName: 'Italy',
    currency: 'EUR',
    symbol: '€',
    cadastreAuthority: 'Agenzia delle Entrate - Catasto Edilizio Urbano e Terreni',
    cadastrePortalUrl: 'https://agenziaentrate.gov.it',
    geologyAuthority: 'ISPRA - Servizio Geologico d\'Italia (Progetto CARG 1:50 000)',
    geologyPortalUrl: 'https://isprambiente.gov.it',
    floodAuthority: 'ISPRA IdroGEO - Piattaforma Nazionale Dissesto Idrogeologico',
    floodPortalUrl: 'https://idrogeo.isprambiente.it',
    planningInstrumentName: 'Piano di Governo del Territorio (PGT) / Piano Regolatore Generale (PRG)',
    standardSetbackRule: 'Distanza minima di 5.00 m tra pareti finestrate (Art. 9 D.M. 1444/1968)',
    baseValuationPerSqm: 165,
    valuationDataSource: 'Osservatorio del Mercato Immobiliare (OMI - Agenzia Entrate)'
  },
  CH: {
    countryCode: 'CH',
    countryName: 'Switzerland',
    currency: 'CHF',
    symbol: 'CHF',
    cadastreAuthority: 'Eidgenössische Vermessungsdirektion (Swisstopo / Cadastre.ch)',
    cadastrePortalUrl: 'https://cadastre.ch',
    geologyAuthority: 'Swisstopo - Landesgeologie (GeoCover 1:25 000)',
    geologyPortalUrl: 'https://swisstopo.admin.ch',
    floodAuthority: 'Bundesamt für Umwelt (BAFU Gefahrenkarten)',
    floodPortalUrl: 'https://bafu.admin.ch',
    planningInstrumentName: 'Öffentlich-rechtliche Eigentumsbeschränkungen (ÖREB-Kataster)',
    standardSetbackRule: 'Kantonal geregelt (Grenzabstand in der Regel mind. 4.0 m)',
    baseValuationPerSqm: 420,
    valuationDataSource: 'Kantonale Bodenbewertungsstellen / Wüest Partner Indizes'
  },
  NL: {
    countryCode: 'NL',
    countryName: 'Netherlands',
    currency: 'EUR',
    symbol: '€',
    cadastreAuthority: 'Kadaster Nederland (Basisregistratie Kadaster BRK / PDOK)',
    cadastrePortalUrl: 'https://pdok.nl',
    geologyAuthority: 'TNO Geologische Dienst Nederland (DINOloket / GeoTOP 3D)',
    geologyPortalUrl: 'https://dinoloket.nl',
    floodAuthority: 'Rijkswaterstaat (Watermanagement Centrum Nederland)',
    floodPortalUrl: 'https://rijkswaterstaat.nl',
    planningInstrumentName: 'Omgevingsplan (Omgevingswet) / Bestemmingsplan (Ruimtelijkeplannen)',
    standardSetbackRule: 'Bepaald in het gemeentelijk omgevingsplan (standaard 2.5–3.0 m)',
    baseValuationPerSqm: 260,
    valuationDataSource: 'Kadaster Vastgoeddashboard / CBS Woningcijfers'
  },
  AT: {
    countryCode: 'AT',
    countryName: 'Austria',
    currency: 'EUR',
    symbol: '€',
    cadastreAuthority: 'Bundesamt für Eich- und Vermessungswesen (BEV - Kataster)',
    cadastrePortalUrl: 'https://bev.gv.at',
    geologyAuthority: 'GeoSphere Austria (Geologische Bundesanstalt)',
    geologyPortalUrl: 'https://geosphere.at',
    floodAuthority: 'HORA - Hochwasserrisikozonierung Austria (BML)',
    floodPortalUrl: 'https://hora.gv.at',
    planningInstrumentName: 'Flächenwidmungsplan (FlaWi) / Bebauungsplan',
    standardSetbackRule: 'Landesbauordnungen (Bauwich typisch 3.0 m bzw. halbe Gebäudehöhe)',
    baseValuationPerSqm: 210,
    valuationDataSource: 'Grundbuch / Statistik Austria Immobilienpreisspiegel'
  },
  EU: {
    countryCode: 'EU',
    countryName: 'Europe',
    currency: 'EUR',
    symbol: '€',
    cadastreAuthority: 'National cadastral authority / INSPIRE cadastral parcels',
    cadastrePortalUrl: 'https://inspire.ec.europa.eu/',
    geologyAuthority: 'EuroGeoSurveys / European Geological Data Infrastructure (EGDI)',
    geologyPortalUrl: 'https://www.europe-geology.eu',
    floodAuthority: 'Copernicus Emergency Management Service / national flood authority',
    floodPortalUrl: 'https://emergency.copernicus.eu/',
    planningInstrumentName: 'Local municipal planning instrument',
    standardSetbackRule: 'Locally regulated; requires municipal planning/building-control confirmation',
    baseValuationPerSqm: 160,
    valuationDataSource: 'National transaction registers / Eurostat regional statistics'
  },
};

export function getCountryProfile(countryCode: string): CountryAdapterProfile {
  const code = (countryCode || 'PL').toUpperCase();
  return COUNTRY_ADAPTERS[code] || COUNTRY_ADAPTERS.EU;
}
