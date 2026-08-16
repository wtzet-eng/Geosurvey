import { DataSource } from '../types';

export interface GeoSurveyRegistry {
  countryCode: string;
  countryName: string;
  authorityName: string;
  acronym: string;
  officialPortalUrl: string;
  mapViewerUrl: string;
  cadastrePortalUrl: string;
  hazardPortalUrl: string;
  description: string;
  datasets: string[];
}

export const EUROPEAN_GEOSURVEYS: Record<string, GeoSurveyRegistry> = {
  PL: {
    countryCode: 'PL',
    countryName: 'Poland',
    authorityName: 'Państwowy Instytut Geologiczny – Państwowy Instytut Badawczy',
    acronym: 'PIG-PIB',
    officialPortalUrl: 'https://www.pgi.gov.pl',
    mapViewerUrl: 'https://geolog.pgi.gov.pl',
    cadastrePortalUrl: 'https://geoportal.gov.pl',
    hazardPortalUrl: 'https://osuwiska.pgi.gov.pl',
    description: 'PIG-PIB CBDG (Centralna Baza Danych Geologicznych) & SMGP (Szczegółowa Mapa Geologiczna Polski 1:50 000)',
    datasets: [
      'Szczegółowa Mapa Geologiczna Polski 1:50 000 (SMGP)',
      'Centralna Baza Danych Geologicznych (CBDG) – Rejestr Otworów Wiertniczych',
      'System Osłony Przeciwosuwiskowej (SOPO)',
      'Mapa Hydrogeologiczna Polski 1:50 000 (MHP) – Pierwszy Poziom Wodonośny',
      'Hydroportal ISOK – Mapy Zagrożenia i Ryzyka Powodziowego (Wody Polskie)',
      'Krajowy Rejestr Cen Nieruchomości (RCiWN / Geoportal.gov.pl)'
    ]
  },
  DE: {
    countryCode: 'DE',
    countryName: 'Germany',
    authorityName: 'Bundesanstalt für Geowissenschaften und Rohstoffe',
    acronym: 'BGR / SGD',
    officialPortalUrl: 'https://www.bgr.bund.de',
    mapViewerUrl: 'https://geoviewer.bgr.de',
    cadastrePortalUrl: 'https://www.bodenrichtwerte-boris.de',
    hazardPortalUrl: 'https://www.geoportal.de',
    description: 'BGR Geologische Übersichtskarte 1:250 000 (GÜK250) & BORIS-D Bodenrichtwerte',
    datasets: [
      'BGR Geologische Übersichtskarte von Deutschland 1:250 000 (GÜK250)',
      'BGR Hydrogeologische Übersichtskarte 1:250 000 (HÜK250)',
      'Bodenkundliche Übersichtskarte von Deutschland 1:200 000 (BÜK200)',
      'BORIS-D – Bodenrichtwertinformationssystem Deutschland',
      'GDI-DE – Geodateninfrastruktur Deutschland',
      'LUBW / LfU Hochwassergefahrenkarten (HQ100 / HQextrem)'
    ]
  },
  FR: {
    countryCode: 'FR',
    countryName: 'France',
    authorityName: 'Bureau de Recherches Géologiques et Minières',
    acronym: 'BRGM',
    officialPortalUrl: 'https://www.brgm.fr',
    mapViewerUrl: 'https://infoterre.brgm.fr',
    cadastrePortalUrl: 'https://www.cadastre.gouv.fr',
    hazardPortalUrl: 'https://www.georisques.gouv.fr',
    description: 'BRGM InfoTerre Carte géologique de la France 1:50 000 & Géorisques (RGA / Cavités)',
    datasets: [
      'BRGM Carte géologique de la France 1:50 000 (InfoTerre)',
      'Banque du Sous-Sol (BSS) – Sondages et forages géologiques',
      'Géorisques – Retrait-gonflement des argiles (RGA) & Cavités souterraines',
      'Géoportail de l\'Urbanisme (GPU – Plans Locaux d\'Urbanisme PLU/PLUi)',
      'Demandes de Valeurs Foncières (DVF / Etalab – Prix réels des parcelles)'
    ]
  },
  CH: {
    countryCode: 'CH',
    countryName: 'Switzerland',
    authorityName: 'Bundesamt für Landestopografie Swisstopo (Geologischer Landesatlas)',
    acronym: 'Swisstopo',
    officialPortalUrl: 'https://www.swisstopo.admin.ch',
    mapViewerUrl: 'https://map.geo.admin.ch/?layers=ch.swisstopo.geologie-geocover',
    cadastrePortalUrl: 'https://www.cadastre.ch',
    hazardPortalUrl: 'https://map.geo.admin.ch/?layers=ch.bafu.gefaehrdungskarte-oberflaechenabfluss',
    description: 'Swisstopo GeoCover Geologischer Atlas der Schweiz 1:25 000 & ÖREB-Kataster',
    datasets: [
      'Swisstopo GeoCover – Geologischer Vektor-Atlas 1:25 000',
      'ÖREB-Kataster (Öffentlich-rechtliche Eigentumsbeschränkungen)',
      'BAFU Gefährdungskarten (Oberflächenabfluss & Rutschungen)',
      'Hydrogeologische Karte der Schweiz 1:100 000'
    ]
  },
  AT: {
    countryCode: 'AT',
    countryName: 'Austria',
    authorityName: 'Geologische Bundesanstalt / GeoSphere Austria',
    acronym: 'GeoSphere Austria',
    officialPortalUrl: 'https://www.geosphere.at',
    mapViewerUrl: 'https://geosphere.at/karten-und-daten',
    cadastrePortalUrl: 'https://www.kataster.at',
    hazardPortalUrl: 'https://www.hora.gv.at',
    description: 'GeoSphere Austria Geologische Karte 1:50 000 & HORA Naturgefahrenübersicht',
    datasets: [
      'Geologische Karte der Republik Österreich 1:50 000',
      'HORA – Natural Hazard Overview & Risk Assessment',
      'Baugrund- und Hydrogeologiekataster Österreich',
      'DORIS / SAGIS / TIRIS Landes-Geodaten'
    ]
  },
  GB: {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    authorityName: 'British Geological Survey',
    acronym: 'BGS',
    officialPortalUrl: 'https://www.bgs.ac.uk',
    mapViewerUrl: 'https://mapapps2.bgs.ac.uk/geoindex/home.html',
    cadastrePortalUrl: 'https://www.gov.uk/search-property-information-service',
    hazardPortalUrl: 'https://check-long-term-flood-risk.service.gov.uk',
    description: 'BGS Geology 1:50 000 (GeoIndex) & Environment Agency Flood Data',
    datasets: [
      'BGS GeoIndex Onshore – 1:50 000 Bedrock & Superficial Geology',
      'BGS GeoSure – Ground Stability & Shrink-Swell Hazard Datasets',
      'BGS National Borehole Record Archive',
      'Environment Agency – Risk of Flooding from Rivers and Sea (RoFRS)',
      'HM Land Registry Price Paid Data (PPD)'
    ]
  },
  ES: {
    countryCode: 'ES',
    countryName: 'Spain',
    authorityName: 'Instituto Geológico y Minero de España',
    acronym: 'IGME-CSIC',
    officialPortalUrl: 'https://www.igme.es',
    mapViewerUrl: 'https://info.igme.es/cartografiadigital/geologica/magna50.aspx',
    cadastrePortalUrl: 'https://www.sedecatastro.gob.es',
    hazardPortalUrl: 'https://sig.mapama.gob.es/snczi',
    description: 'IGME MAGNA50 Mapa Geológico de España 1:50 000 & Sede Electrónica del Catastro',
    datasets: [
      'IGME MAGNA50 – Mapa Geológico de España 1:50 000',
      'SNCZI – Sistema Nacional de Cartografía de Zonas Inundables',
      'Sede Electrónica del Catastro (SEC) – Referencia Catastral',
      'Base de Datos de Deslizamientos de España'
    ]
  },
  IT: {
    countryCode: 'IT',
    countryName: 'Italy',
    authorityName: 'Istituto Superiore per la Protezione e la Ricerca Ambientale',
    acronym: 'ISPRA / Servizio Geologico d\'Italia',
    officialPortalUrl: 'https://www.isprambiente.gov.it',
    mapViewerUrl: 'https://sgi.isprambiente.it/geoportal',
    cadastrePortalUrl: 'https://www.agenziaentrate.gov.it',
    hazardPortalUrl: 'https://idrogeo.isprambiente.it',
    description: 'ISPRA Carta Geologica d\'Italia 1:50 000 (CARG) & IdroGEO Frane e Alluvioni',
    datasets: [
      'CARG – Progetto di Cartografia Geologica e Geotematica 1:50 000',
      'IdroGEO – Piattaforma Nazionale sul Dissesto Idrogeologico (Frane/Alluvioni)',
      'Carta delle Frane d\'Italia (Progetto IFFI)',
      'Agenzia delle Entrate – Osservatorio del Mercato Immobiliare (OMI)'
    ]
  },
  NL: {
    countryCode: 'NL',
    countryName: 'Netherlands',
    authorityName: 'TNO Geological Survey of the Netherlands',
    acronym: 'TNO / GDN',
    officialPortalUrl: 'https://www.tno.nl/nl/aandachtsgebieden/geologische-dienst-nederland',
    mapViewerUrl: 'https://www.dinoloket.nl',
    cadastrePortalUrl: 'https://www.kadaster.nl',
    hazardPortalUrl: 'https://www.overstroomik.nl',
    description: 'TNO DINOloket GeoTOP / REGIS II 3D Subsurface Model & Kadaster',
    datasets: [
      'DINOloket – Data en Informatie van de Nederlandse Ondergrond',
      'GeoTOP – 3D Voxel Model of Shallow Geology (0–50 m depth)',
      'REGIS II – Hydrogeological 3D Subsurface Model',
      'BRO (Basisregistratie Ondergrond) – Geotechnical CPT & Borehole registry',
      'Kadaster Basisregistratie Adressen en Gebouwen (BAG)'
    ]
  },
  BE: {
    countryCode: 'BE',
    countryName: 'Belgium',
    authorityName: 'Geological Survey of Belgium / DOV Vlaanderen / SPW Géologie',
    acronym: 'GSB / DOV',
    officialPortalUrl: 'https://www.dov.vlaanderen.be',
    mapViewerUrl: 'https://www.dov.vlaanderen.be/portaal',
    cadastrePortalUrl: 'https://finances.belgium.be/fr/particuliers/habitation/cadastre',
    hazardPortalUrl: 'https://geoportail.wallonie.be',
    description: 'DOV Vlaanderen & SPW Wallonie Carte géologique numérique 1:25 000',
    datasets: [
      'DOV Databank Ondergrond Vlaanderen (Sondages & Stratigraphie)',
      'SPW Géologie et Risques du sous-sol en Wallonie',
      'Cartographie de l\'Aléa d\'Inondation (Wallonie/Flandres)',
      'Cadastre fédéral SPF Finances'
    ]
  },
  EU: {
    countryCode: 'EU',
    countryName: 'European Union',
    authorityName: 'EuroGeoSurveys – The Geological Surveys of Europe',
    acronym: 'EuroGeoSurveys / EGDI',
    officialPortalUrl: 'https://www.eurogeosurveys.org',
    mapViewerUrl: 'https://www.europe-geology.eu',
    cadastrePortalUrl: 'https://eurodatacube.com',
    hazardPortalUrl: 'https://emergency.copernicus.eu',
    description: 'European Geological Data Infrastructure (EGDI 1:1,000,000 Pan-European Map)',
    datasets: [
      'EGDI Pan-European Geological Surface & Bedrock Map 1:1M',
      'European Flood Awareness System (EFAS / Copernicus EMS)',
      'European Environment Agency (EEA) Natura 2000 European Registry',
      'European Seismic Hazard Model (ESHM20 / SHARE - Eurocode 8)'
    ]
  }
};

export function getGeoSurveyByCountry(countryCode: string): GeoSurveyRegistry {
  const code = (countryCode || 'EU').toUpperCase();
  return EUROPEAN_GEOSURVEYS[code] || EUROPEAN_GEOSURVEYS['EU'];
}
