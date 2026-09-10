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
  planningInstrumentName: string;
  standardSetbackRule: string;
  baseValuationPerSqm: number;
  valuationDataSource: string;
}

const NO_GENERIC_VALUE = 'No generic land-price fallback — calibrated country-specific land evidence required';

export const COUNTRY_ADAPTERS: Record<string, CountryAdapterProfile> = {
  PL: {
    countryCode: 'PL', countryName: 'Poland', currency: 'PLN', symbol: 'zł',
    cadastreAuthority: 'Główny Urząd Geodezji i Kartografii (GUGiK / EGiB)', cadastrePortalUrl: 'https://geoportal.gov.pl',
    geologyAuthority: 'Państwowy Instytut Geologiczny – PIB (PIG-PIB / CBDG / SMGP)', geologyPortalUrl: 'https://geolog.pgi.gov.pl',
    floodAuthority: 'Państwowe Gospodarstwo Wodne Wody Polskie (Hydroportal ISOK)', floodPortalUrl: 'https://wody.isok.gov.pl',
    planningInstrumentName: 'Miejscowy Plan Zagospodarowania Przestrzennego (MPZP) / Decyzja WZ',
    standardSetbackRule: '4.0 m (ściany z oknami/drzwiami) / 3.0 m (ściany ślepe) od granicy działki',
    baseValuationPerSqm: 188,
    valuationDataSource: 'RCN (GUGiK-derived) / Cenatorium transaction benchmarks — city → voivodeship → national fallback'
  },
  DE: {
    countryCode: 'DE', countryName: 'Germany', currency: 'EUR', symbol: '€',
    cadastreAuthority: 'Amtliches Liegenschaftskatasterinformationssystem (ALKIS®)', cadastrePortalUrl: 'https://adv-online.de',
    geologyAuthority: 'Bundesanstalt für Geowissenschaften und Rohstoffe (BGR / SGD)', geologyPortalUrl: 'https://bgr.bund.de',
    floodAuthority: 'Länderübergreifendes Hochwasserportal (LHP) / Geoportal.de', floodPortalUrl: 'https://hochwasserzentralen.de',
    planningInstrumentName: 'Bebauungsplan (B-Plan) / Zulässigkeit nach § 34 BauGB', standardSetbackRule: 'Mindestens 3.00 m Abstandsfläche (§ 6 Musterbauordnung)',
    baseValuationPerSqm: 272, valuationDataSource: 'Destatis / Regionaldatenbank Kaufwerte für baureifes Land 2025 — city → Bundesland → national fallback'
  },
  FR: {
    countryCode: 'FR', countryName: 'France', currency: 'EUR', symbol: '€',
    cadastreAuthority: "Institut National de l'Information Géographique et Forestière (IGN / Cadastre.gouv.fr)", cadastrePortalUrl: 'https://cadastre.gouv.fr',
    geologyAuthority: 'Bureau de Recherches Géologiques et Minières (BRGM / InfoTerre)', geologyPortalUrl: 'https://infoterre.brgm.fr',
    floodAuthority: 'Ministère de la Transition Écologique (Géorisques / Vigicrues)', floodPortalUrl: 'https://georisques.gouv.fr',
    planningInstrumentName: "Plan Local d'Urbanisme (PLU/PLUi) / Règlement National (RNU)", standardSetbackRule: 'Minimum 3.0 m des limites séparatives (ou 4.0 m selon PLU)',
    baseValuationPerSqm: 0, valuationDataSource: 'Cerema DVF+ open-data (DGFiP terrain-à-bâtir / bare-land signals; no generic national fallback)'
  },
  GB: {
    countryCode: 'GB', countryName: 'United Kingdom', currency: 'GBP', symbol: '£',
    cadastreAuthority: 'HM Land Registry / Ordnance Survey (OS MasterMap)', cadastrePortalUrl: 'https://use-land-property-data.service.gov.uk/datasets/inspire',
    geologyAuthority: 'British Geological Survey (BGS / GeoIndex 1:50 000)', geologyPortalUrl: 'https://mapapps2.bgs.ac.uk/geoindex/home.html',
    floodAuthority: 'Environment Agency / Natural Resources Wales (Flood Map for Planning)', floodPortalUrl: 'https://environment.data.gov.uk/dataset/04532375-a198-476e-985e-0579a0a11b47',
    planningInstrumentName: 'Local Development Framework (LDF) / Planning Permission (NPPF)', standardSetbackRule: 'No fixed statutory setback; evaluated under Residential Design Guides',
    baseValuationPerSqm: 0, valuationDataSource: 'MHCLG Land value estimates for policy appraisal 2023 — England local-authority benchmark; no UK-wide fallback'
  },
  SK: {
    countryCode: 'SK', countryName: 'Slovakia', currency: 'EUR', symbol: '€',
    cadastreAuthority: 'Úrad geodézie, kartografie a katastra Slovenskej republiky (ÚGKK SR / ESKN)', cadastrePortalUrl: 'https://kataster.skgeodesy.sk/eskn-portal/',
    geologyAuthority: 'Štátny geologický ústav Dionýza Štúra (ŠGÚDŠ / GeoIS)', geologyPortalUrl: 'https://www.geology.sk/maps-and-data/geoportal-sguds/',
    floodAuthority: 'Slovenský vodohospodársky podnik (SVP) / MŽP SR', floodPortalUrl: 'https://mpompr.svp.sk/',
    planningInstrumentName: 'Územný plán obce/mesta (ÚPN) / záväzné územnoplánovacie stanovisko', standardSetbackRule: 'Determined by the applicable zoning plan and Slovak building rules; requires local authority confirmation',
    baseValuationPerSqm: 69, valuationDataSource: 'ZoznamRealit.SK / 2026 Slovak residential-building-plot asking benchmarks — city → kraj → national fallback'
  },
  CZ: {
    countryCode: 'CZ', countryName: 'Czechia', currency: 'CZK', symbol: 'Kč',
    cadastreAuthority: 'Český úřad zeměměřický a katastrální (ČÚZK / KN / RÚIAN)', cadastrePortalUrl: 'https://cuzk.gov.cz/',
    geologyAuthority: 'Czech Geological Survey (ČGS)', geologyPortalUrl: 'https://cgs.gov.cz/en/maps-and-data/web-services',
    floodAuthority: 'Czech Hydrometeorological Institute (ČHMÚ) / competent water authorities', floodPortalUrl: 'https://www.chmi.cz/',
    planningInstrumentName: 'Územní plán / územně plánovací dokumentace',
    standardSetbackRule: 'Applicable planning and building-control rules require confirmation by the competent municipal/building authority',
    baseValuationPerSqm: 0, valuationDataSource: NO_GENERIC_VALUE
  },
  ES: {
    countryCode: 'ES', countryName: 'Spain', currency: 'EUR', symbol: '€',
    cadastreAuthority: 'Sede Electrónica del Catastro (Dirección General del Catastro)', cadastrePortalUrl: 'https://sedecatastro.gob.es',
    geologyAuthority: 'Instituto Geológico y Minero de España (IGME-CSIC / MAGNA50)', geologyPortalUrl: 'https://igme.es',
    floodAuthority: 'Sistema Nacional de Cartografía de Zonas Inundables (SNCZI - MITECO)', floodPortalUrl: 'https://sig.mapama.gob.es/snczi',
    planningInstrumentName: 'Plan General de Ordenación Urbana (PGOU) / Plan Parcial', standardSetbackRule: 'Locally regulated by municipal planning/building rules; requires confirmation',
    baseValuationPerSqm: 0, valuationDataSource: 'MIVAU Precio Medio del Suelo — registered urban/developable-land statistics; province → autonomous community/national fallback'
  },
  AT: {
    countryCode: 'AT', countryName: 'Austria', currency: 'EUR', symbol: '€',
    cadastreAuthority: 'Bundesamt für Eich- und Vermessungswesen (BEV - Kataster)', cadastrePortalUrl: 'https://bev.gv.at',
    geologyAuthority: 'GeoSphere Austria (Geologische Bundesanstalt)', geologyPortalUrl: 'https://geosphere.at',
    floodAuthority: 'HORA - Hochwasserrisikozonierung Austria (BML)', floodPortalUrl: 'https://hora.gv.at',
    planningInstrumentName: 'Flächenwidmungsplan (FlaWi) / Bebauungsplan', standardSetbackRule: 'Landesbauordnungen; local verification required',
    baseValuationPerSqm: 0, valuationDataSource: 'Statistik Austria Baugrundstückspreise 2025 — official buildable-plot benchmark; national fallback pending finer automated geography'
  },
  FI: {
    countryCode: 'FI', countryName: 'Finland', currency: 'EUR', symbol: '€',
    cadastreAuthority: 'National Land Survey of Finland (Maanmittauslaitos)', cadastrePortalUrl: 'https://www.maanmittauslaitos.fi/en',
    geologyAuthority: 'Geological Survey of Finland (GTK)', geologyPortalUrl: 'https://www.gtk.fi/en/',
    floodAuthority: 'Finnish Environment Institute (SYKE) / Flood Centre', floodPortalUrl: 'https://www.vesi.fi/en/floods/',
    planningInstrumentName: 'Local detailed plan (asemakaava) / master plan (yleiskaava)', standardSetbackRule: 'Municipal plan and building-control rules; requires local confirmation',
    baseValuationPerSqm: 0, valuationDataSource: 'Statistics Finland real-estate prices — single-family house plots; metro/national statistical hierarchy'
  },
  IE: {
    countryCode: 'IE', countryName: 'Ireland', currency: 'EUR', symbol: '€',
    cadastreAuthority: 'Tailte Éireann / Land Registry', cadastrePortalUrl: 'https://www.tailte.ie/',
    geologyAuthority: 'Geological Survey Ireland', geologyPortalUrl: 'https://www.gsi.ie/',
    floodAuthority: 'Office of Public Works (OPW) Flood Maps', floodPortalUrl: 'https://www.floodinfo.ie/',
    planningInstrumentName: 'County/City Development Plan and Local Area Plan', standardSetbackRule: 'Determined by the relevant development plan and planning authority',
    baseValuationPerSqm: 0, valuationDataSource: 'CSO Residentially Zoned Land Prices — county → national transaction benchmark fallback'
  },
  IT: {
    countryCode: 'IT', countryName: 'Italy', currency: 'EUR', symbol: '€',
    cadastreAuthority: 'Agenzia delle Entrate - Catasto Edilizio Urbano e Terreni', cadastrePortalUrl: 'https://agenziaentrate.gov.it',
    geologyAuthority: "ISPRA - Servizio Geologico d'Italia (Progetto CARG 1:50 000)", geologyPortalUrl: 'https://isprambiente.gov.it',
    floodAuthority: 'ISPRA IdroGEO - Piattaforma Nazionale Dissesto Idrogeologico', floodPortalUrl: 'https://idrogeo.isprambiente.it',
    planningInstrumentName: 'Piano di Governo del Territorio (PGT) / Piano Regolatore Generale (PRG)', standardSetbackRule: 'Local planning/building rules require verification',
    baseValuationPerSqm: 0, valuationDataSource: NO_GENERIC_VALUE
  },
  CH: {
    countryCode: 'CH', countryName: 'Switzerland', currency: 'CHF', symbol: 'CHF',
    cadastreAuthority: 'Eidgenössische Vermessungsdirektion (Swisstopo / Cadastre.ch)', cadastrePortalUrl: 'https://cadastre.ch',
    geologyAuthority: 'Swisstopo - Landesgeologie (GeoCover 1:25 000)', geologyPortalUrl: 'https://swisstopo.admin.ch',
    floodAuthority: 'Bundesamt für Umwelt (BAFU Gefahrenkarten)', floodPortalUrl: 'https://bafu.admin.ch',
    planningInstrumentName: 'ÖREB-Kataster / cantonal and communal zoning', standardSetbackRule: 'Cantonal/communal rules require verification',
    baseValuationPerSqm: 0, valuationDataSource: NO_GENERIC_VALUE
  },
  NL: {
    countryCode: 'NL', countryName: 'Netherlands', currency: 'EUR', symbol: '€',
    cadastreAuthority: 'Kadaster Nederland (Basisregistratie Kadaster BRK / PDOK)', cadastrePortalUrl: 'https://pdok.nl',
    geologyAuthority: 'TNO Geologische Dienst Nederland (DINOloket / GeoTOP 3D)', geologyPortalUrl: 'https://dinoloket.nl',
    floodAuthority: 'Rijkswaterstaat (Watermanagement Centrum Nederland)', floodPortalUrl: 'https://rijkswaterstaat.nl',
    planningInstrumentName: 'Omgevingsplan (Omgevingswet)', standardSetbackRule: 'Municipal omgevingsplan; requires verification',
    baseValuationPerSqm: 0, valuationDataSource: NO_GENERIC_VALUE
  },
  SE: {
    countryCode: 'SE', countryName: 'Sweden', currency: 'SEK', symbol: 'kr',
    cadastreAuthority: 'Lantmäteriet (Fastighetsregistret / Fastighetsindelning Direkt)', cadastrePortalUrl: 'https://geotorget.lantmateriet.se/geodataprodukter/fastighetsindelning-direkt-api',
    geologyAuthority: 'Sveriges geologiska undersökning (SGU)', geologyPortalUrl: 'https://apps.sgu.se/kartvisare/',
    floodAuthority: 'Myndigheten för samhällsskydd och beredskap (MSB)', floodPortalUrl: 'https://gisapp.msb.se/apps/oversvamningsportal/',
    planningInstrumentName: 'Detaljplan / översiktsplan enligt plan- och bygglagen',
    standardSetbackRule: 'Determined by the applicable detailed plan and building-permit rules; requires municipal verification',
    baseValuationPerSqm: 0, valuationDataSource: NO_GENERIC_VALUE
  },
  NO: {
    countryCode: 'NO', countryName: 'Norway', currency: 'NOK', symbol: 'kr',
    cadastreAuthority: 'Kartverket (Matrikkelen / Grunnboken)', cadastrePortalUrl: 'https://kartverket.no/api-og-data/eiendomsdata/tilgang-til-apne-eiendomsdata',
    geologyAuthority: 'Norges geologiske undersøkelse (NGU / NADAG)', geologyPortalUrl: 'https://www.ngu.no/geologiske-kart/karttjenester',
    floodAuthority: 'Norges vassdrags- og energidirektorat (NVE)', floodPortalUrl: 'https://www.nve.no/karttjenester',
    planningInstrumentName: 'Kommuneplanens arealdel / reguleringsplan',
    standardSetbackRule: 'Determined by the applicable municipal plan and building-control rules; requires municipal confirmation',
    baseValuationPerSqm: 0,
    valuationDataSource: NO_GENERIC_VALUE
  },
  EU: {
    countryCode: 'EU', countryName: 'Europe', currency: 'EUR', symbol: '€',
    cadastreAuthority: 'National cadastral authority / INSPIRE cadastral parcels', cadastrePortalUrl: 'https://inspire.ec.europa.eu/',
    geologyAuthority: 'EuroGeoSurveys / European Geological Data Infrastructure (EGDI)', geologyPortalUrl: 'https://www.europe-geology.eu',
    floodAuthority: 'Copernicus Emergency Management Service / national flood authority', floodPortalUrl: 'https://emergency.copernicus.eu/',
    planningInstrumentName: 'Local municipal planning instrument', standardSetbackRule: 'Locally regulated; requires municipal planning/building-control confirmation',
    baseValuationPerSqm: 0, valuationDataSource: NO_GENERIC_VALUE
  }
};

const NAMES: Record<string, { name: string; currency: string; symbol: string }> = {
  BE:{name:'Belgium',currency:'EUR',symbol:'€'}, SE:{name:'Sweden',currency:'SEK',symbol:'kr'}, PT:{name:'Portugal',currency:'EUR',symbol:'€'}, DK:{name:'Denmark',currency:'DKK',symbol:'kr'}, HU:{name:'Hungary',currency:'HUF',symbol:'Ft'}, RO:{name:'Romania',currency:'RON',symbol:'lei'}, HR:{name:'Croatia',currency:'EUR',symbol:'€'}, GR:{name:'Greece',currency:'EUR',symbol:'€'}, EE:{name:'Estonia',currency:'EUR',symbol:'€'}, LV:{name:'Latvia',currency:'EUR',symbol:'€'}, LT:{name:'Lithuania',currency:'EUR',symbol:'€'}, LU:{name:'Luxembourg',currency:'EUR',symbol:'€'}, CY:{name:'Cyprus',currency:'EUR',symbol:'€'}, MT:{name:'Malta',currency:'EUR',symbol:'€'}, SI:{name:'Slovenia',currency:'EUR',symbol:'€'}, BG:{name:'Bulgaria',currency:'BGN',symbol:'лв'}, NO:{name:'Norway',currency:'NOK',symbol:'kr'}, IS:{name:'Iceland',currency:'ISK',symbol:'kr'}
};

export function getCountryProfile(countryCode: string): CountryAdapterProfile {
  const code = (countryCode || 'PL').toUpperCase();
  if (COUNTRY_ADAPTERS[code]) return COUNTRY_ADAPTERS[code];
  const meta = NAMES[code];
  if (!meta) return COUNTRY_ADAPTERS.EU;
  return {
    ...COUNTRY_ADAPTERS.EU,
    countryCode: code,
    countryName: meta.name,
    currency: meta.currency,
    symbol: meta.symbol,
    valuationDataSource: NO_GENERIC_VALUE,
    baseValuationPerSqm: 0
  };
}
