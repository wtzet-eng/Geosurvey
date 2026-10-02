import express from 'express';
import { createBillingRouter } from './server/services/billingRoutes';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { randomUUID } from 'crypto';
import { runGeospatialAnalysisPipeline } from './server/engine/evidenceEngine';
import { fetchPolandCadastralParcel } from './server/adapters/poland';
import { getCountryProfile } from './server/adapters/countries';
import { enrichGeologyFromPgi, queryPolandSiteEvidence } from './server/services/pgiSiteEvidenceService';
import { queryPolandHydroAndHazards } from './server/services/pgiSupplementEvidenceService';
import { queryUKSiteEvidence, enrichGeologyFromBgs } from './server/services/ukSiteEvidenceService';
import { queryUKCadastre } from './server/services/ukCadastreService';
import { queryScotlandCadastre } from './server/services/scotlandCadastreService';
import { getNorthernIrelandLandRegistryEvidence } from './server/services/northernIrelandLandRegistryService';
import { enrichGeologyFromBrgm, queryFranceSiteEvidence } from './server/services/franceSiteEvidenceService';
import { enrichFranceGroundwater, queryFranceGroundwater } from './server/services/franceGroundwaterService';
import { enrichSlovakiaGroundEvidence, querySlovakiaGroundEvidence } from './server/services/slovakiaGroundEvidenceService';
import { enrichCzechiaGroundEvidence, queryCzechiaGroundEvidence } from './server/services/czechiaGroundEvidenceService';
import { applyCzechiaCadastreToReport, queryCzechiaCadastre } from './server/services/czechiaCadastreService';
import { queryCzechiaInspireCadastre } from './server/services/czechiaInspireCadastreService';
import { enrichSwedenGroundEvidence, querySwedenGroundEvidence } from './server/services/swedenGroundEvidenceService';
import { applyNorwayCadastreToReport, queryNorwayCadastre } from './server/services/norwayCadastreService';
import { applyNetherlandsCadastreToReport, queryNetherlandsCadastre } from './server/services/netherlandsCadastreService';
import { enrichNetherlandsGroundEvidence, queryNetherlandsGroundEvidence } from './server/services/netherlandsGroundEvidenceService';
import { enrichNorwayGroundEvidence, queryNorwayGroundEvidence } from './server/services/norwayGroundEvidenceService';
import { applyDenmarkCadastreToReport, queryDenmarkCadastre } from './server/services/denmarkCadastreService';
import { enrichDenmarkGroundEvidence, queryDenmarkGroundEvidence } from './server/services/denmarkGroundEvidenceService';
import { applyIrelandCadastreToReport, queryIrelandCadastre } from './server/services/irelandCadastreService';
import { enrichIrelandNationalEvidence, queryIrelandNationalEvidence } from './server/services/irelandNationalEvidenceService';
import { applyLuxembourgCadastreToReport, queryLuxembourgCadastre } from './server/services/luxembourgCadastreService';
import { applyGermanyCadastreToReport, queryGermanyCadastre } from './server/services/germanyCadastreService';
import { enrichGermanyMvGroundEvidence, queryGermanyMvGroundEvidence } from './server/services/germanyMvEvidenceService';
import { enrichGermanyNationalHydrogeology, queryGermanyNationalHydrogeology } from './server/services/germanyNationalHydrogeologyService';
import { enrichGermanyBavariaGroundwater, queryGermanyBavariaGroundwater } from './server/services/germanyBavariaGroundwaterService';
import { enrichGermanyRlpGroundwater, queryGermanyRlpGroundwater } from './server/services/germanyRlpGroundwaterService';
import { enrichGermanyNrwHydrogeology, queryGermanyNrwHydrogeology } from './server/services/germanyNrwHydrogeologyService';
import { enrichGermanyBwHydrogeology, queryGermanyBwHydrogeology } from './server/services/germanyBadenWurttembergHydrogeologyService';
import { enrichGermanyBrandenburgHydrogeology, queryGermanyBrandenburgHydrogeology } from './server/services/germanyBrandenburgHydrogeologyService';
import { enrichGermanySaxonyAnhaltHydrogeology, queryGermanySaxonyAnhaltHydrogeology } from './server/services/germanySaxonyAnhaltHydrogeologyService';
import { enrichGermanySaxonyHydrogeology, queryGermanySaxonyHydrogeology } from './server/services/germanySaxonyHydrogeologyService';
import { enrichGermanyThuringiaHydrogeology, queryGermanyThuringiaHydrogeology } from './server/services/germanyThuringiaHydrogeologyService';
import { enrichGermanyHesseHydrogeology, queryGermanyHesseHydrogeology } from './server/services/germanyHesseHydrogeologyService';
import { enrichGermanySchleswigHolsteinHydrogeology, queryGermanySchleswigHolsteinHydrogeology } from './server/services/germanySchleswigHolsteinHydrogeologyService';
import { enrichGermanySaarlandHydrogeology, queryGermanySaarlandHydrogeology } from './server/services/germanySaarlandHydrogeologyService';
import { enrichGermanyHamburgHydrogeology, queryGermanyHamburgHydrogeology } from './server/services/germanyHamburgHydrogeologyService';
import { enrichGermanyBerlinHydrogeology, queryGermanyBerlinHydrogeology } from './server/services/germanyBerlinHydrogeologyService';
import { enrichGermanyBremenHydrogeology, queryGermanyBremenHydrogeology } from './server/services/germanyBremenHydrogeologyService';
import { enrichGermanyLowerSaxonyHydrogeology, queryGermanyLowerSaxonyHydrogeology } from './server/services/germanyLowerSaxonyHydrogeologyService';
import { queryGermanyFloodEvidence } from './server/services/germanyFloodEvidenceService';
import { queryGermanyBoreholes } from './server/services/germanyBoreholeEvidenceService';
import { enrichLuxembourgNationalEvidence, queryLuxembourgNationalEvidence } from './server/services/luxembourgNationalEvidenceService';
import { applyBelgiumCadastreToReport, queryBelgiumCadastre } from './server/services/belgiumCadastreService';
import { enrichBelgiumNationalEvidence, queryBelgiumNationalEvidence } from './server/services/belgiumNationalEvidenceService';
import { applySwitzerlandCadastreToReport, querySwitzerlandCadastre } from './server/services/switzerlandCadastreService';
import { enrichSwitzerlandNationalEvidence, querySwitzerlandNationalEvidence } from './server/services/switzerlandNationalEvidenceService';
import { applyMaltaCadastreToReport, queryMaltaCadastre } from './server/services/maltaCadastreService';
import { enrichMaltaNationalEvidence, queryMaltaNationalEvidence } from './server/services/maltaNationalEvidenceService';
import { enrichCroatiaNationalEvidence, queryCroatiaNationalEvidence } from './server/services/croatiaNationalEvidenceService';
import { queryCroatiaCadastre } from './server/services/croatiaCadastreService';
import { getCenterFromShape, resolveSiteLocation } from './server/services/locationResolutionService';
import { getUKVerificationChecklist } from './server/services/ukRecommendationsService';
import { buildGroundSamplingLayout, sampleSoilGridsVariability } from './server/services/groundContextService';
import { enrichEuropeanLandValuation, queryEuropeanLandValuationEvidence } from './server/services/europeLandValuationService';
import { getAiInterpretationRuntimeConfig, interpretSurveyLandEvidence } from './server/services/aiInterpretationService';
import { queryLocalHelp } from './server/services/localHelpService';
import { compareSitesWithAi } from './server/services/aiComparisonService';
import { answerGroundSurfQuestion } from './server/services/groundSurfAdvisorService';
import { verifyFirebaseAuthorization } from './server/services/firebaseAuthService';
import { createCanonicalReport } from './server/reporting/canonicalReport';
import { renderLocalizedReport } from './server/reporting/localizedReport';
import { renderSlovakLocalizedReport } from './server/reporting/slovakLocalizedReport';
import { renderDutchLocalizedReport } from './server/reporting/dutchLocalizedReport';
import { renderFrEsFiLocalizedReport } from './server/reporting/frEsFiLocalizedReport';
import { renderCroatiaLocalizedReport } from './server/reporting/croatiaLocalizedReport';
import { renderCzechLocalizedReport } from './server/reporting/czechLocalizedReport';
import { renderSwedishLocalizedReport } from './server/reporting/swedishLocalizedReport';
import { renderNorwegianLocalizedReport } from './server/reporting/norwegianLocalizedReport';
import { renderDanishLocalizedReport } from './server/reporting/danishLocalizedReport';
import { renderHungarianLocalizedReport } from './server/reporting/hungarianLocalizedReport';
import { renderFranceGroundPresentation } from './server/reporting/franceGroundPresentation';
import { renderCroatiaGroundPresentation } from './server/reporting/croatiaGroundPresentation';
import { renderSlovakiaGroundPresentation } from './server/reporting/slovakiaGroundPresentation';
import { renderCzechiaGroundPresentation } from './server/reporting/czechiaGroundPresentation';
import { renderCzechiaCadastrePresentation } from './server/reporting/czechiaCadastrePresentation';
import { applySiteSpecificCountryEvidence, buildEvidenceDisplayRecords, enrichValuationPresentation } from './server/reporting/evidenceDisplay';
import { applyValuationAreaGuard } from './server/reporting/valuationAreaGuard';
import { getCountrySupport } from './src/data/countrySupport';
import { queryAustriaGroundEvidence } from './server/services/austriaGroundEvidenceService';
import { applyFinlandCadastreToReport, queryFinlandCadastre } from './server/services/finlandCadastreService';
import { queryFinlandNationalEvidence } from './server/services/finlandNationalEvidenceService';
import { applyPortugalCadastreToReport, queryPortugalCadastre } from './server/services/portugalCadastreService';
import { enrichPortugalNationalEvidence, queryPortugalNationalEvidence } from './server/services/portugalNationalEvidenceService';
import { enrichLisbonUrbanEvidence, queryLisbonUrbanGeology } from './server/services/lisbonUrbanGeologyService';
import { applyEstoniaCadastreToReport, queryEstoniaCadastre } from './server/services/estoniaCadastreService';
import { applyLatviaCadastreToReport, queryLatviaCadastre } from './server/services/latviaCadastreService';
import { applyLatviaNationalEvidenceToReport, queryLatviaNationalEvidence } from './server/services/latviaNationalEvidenceService';
import { applyEstoniaNationalEvidenceToReport, queryEstoniaNationalEvidence } from './server/services/estoniaNationalEvidenceService';
import { enrichEstoniaUrbanEvidence, queryEstoniaUrbanGeology } from './server/services/estoniaUrbanGeologyService';
import { renderCountrySeoPage } from './server/seo/renderCountrySeoPage';
import { queryHungaryCadastre } from './server/services/hungaryCadastreService';
import { queryCyprusCadastre } from './server/services/cyprusCadastreService';
import { queryIcelandCadastre } from './server/services/icelandCadastreService';
import { investigateUkBgsSources } from './server/services/ukBgsSourceInvestigationService';
import { enrichUKGroundwater, queryUKGroundwater } from './server/services/ukGroundwaterEvidenceService';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  res.removeHeader('X-Frame-Options');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});
app.use('/api/billing', createBillingRouter());
app.use(express.json({ limit: '10mb' }));
const reportsStore: Record<string, any> = {};
const aiRateLimits = new Map<string, { windowStart: number; count: number }>();

function consumeAiRateLimit(key: string) {
  const now = Date.now();
  const current = aiRateLimits.get(key);
  if (!current || now - current.windowStart >= 60_000) {
    aiRateLimits.set(key, { windowStart: now, count: 1 });
    return true;
  }
  if (current.count >= 10) return false;
  current.count += 1;
  return true;
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.get('/api/cadastre/query', async (req, res) => {
  const lat = Number(req.query.lat); const lng = Number(req.query.lng); const country = String(req.query.country || 'PL').toUpperCase();
  const state = String(req.query.state || '').trim() || null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Valid lat and lng query parameters are required.' });
  const profile = getCountryProfile(country);
  const support = getCountrySupport(country);
  if (support.capabilities.nationalCadastre && country === 'PL') return res.json(await fetchPolandCadastralParcel(lat, lng));
  if (support.capabilities.nationalCadastre && country === 'HR') return res.json(await queryCroatiaCadastre(lat, lng));
  if (country === 'DE') return res.json(await queryGermanyCadastre(lat, lng, state));
  if (country === 'GB') {
    const resolved = await resolveSiteLocation(lat, lng, 'United Kingdom');
    return res.json(await queryUKCadastre(lat, lng, resolved.municipality));
  }

  if (support.capabilities.nationalCadastre && country === 'CZ') {
    const national = await queryCzechiaCadastre(lat, lng);
    const inspire = national.success && national.parcel?.geometryPoints?.length
      ? await queryCzechiaInspireCadastre(national.parcel.geometryPoints, national.parcel.cadastralAreaId && national.parcel.parcelNumber ? `${national.parcel.cadastralAreaId}-${national.parcel.parcelNumber}` : null)
      : null;
    return res.json({ ...national, inspire });
  }
  if (support.capabilities.nationalCadastre && country === 'NO') return res.json(await queryNorwayCadastre(lat, lng));
  if (support.capabilities.nationalCadastre && country === 'NL') return res.json(await queryNetherlandsCadastre(lat, lng));
  if (support.capabilities.nationalCadastre && country === 'DK') return res.json(await queryDenmarkCadastre(lat, lng));
  if (support.capabilities.nationalCadastre && country === 'EE') return res.json(await queryEstoniaCadastre(lat, lng));
  if (support.capabilities.nationalCadastre && country === 'LV') return res.json(await queryLatviaCadastre(lat, lng));
  if (support.capabilities.nationalCadastre && country === 'FI') {
    const finland = await queryFinlandCadastre(lat, lng);
    return res.json({ ...finland, geometryPoints: finland.geometryPoints, viewServiceUrl: 'https://inspire-wms.maanmittauslaitos.fi/inspire-wms/CP/ows', viewLayer: 'CP.CadastralParcel', viewStyle: '', viewAttribution: '© National Land Survey of Finland' });
  }
  if (support.capabilities.nationalCadastre && country === 'PT') {
    const portugal = await queryPortugalCadastre(lat, lng);
    return res.json({ ...portugal, geometryPoints: portugal.geometryPoints, viewServiceUrl: 'https://snicws.dgterritorio.gov.pt/geoserver/inspire/ows', viewLayer: 'cadastralparcel', viewStyle: 'generic', viewAttribution: '© Direção-Geral do Território — Cadastro Predial' });
  }
  if (support.capabilities.nationalCadastre && country === 'HU') return res.json(await queryHungaryCadastre(lat, lng));
  if (support.capabilities.nationalCadastre && country === 'CY') return res.json(await queryCyprusCadastre(lat, lng));
  if (support.capabilities.nationalCadastre && country === 'IS') return res.json(await queryIcelandCadastre(lat, lng));
  if (support.capabilities.nationalCadastre && country === 'IE') return res.json(await queryIrelandCadastre(lat, lng));
  if (support.capabilities.nationalCadastre && country === 'LU') return res.json(await queryLuxembourgCadastre(lat, lng));
  if (support.capabilities.nationalCadastre && country === 'BE') return res.json(await queryBelgiumCadastre(lat, lng));
  return res.json({ success: false, reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY', message: `Automated national cadastre acquisition is not implemented for ${profile.countryName}. Verify the parcel with ${profile.cadastreAuthority}.`, cadastreAuthority: profile.cadastreAuthority, portalUrl: profile.cadastrePortalUrl });
});

async function handleAnalyzeSite(req: express.Request, res: express.Response) {
  const diagnosticId = randomUUID();
  let stage = 'request-validation';
  try {
    const shape = req.body.shape || req.body.boundaryShape;
    const requestedArea = Number(req.body.areaSize);
    if (!Number.isFinite(requestedArea) || requestedArea <= 0) {
      return res.status(400).json({ error: 'A positive site area is required.', code: 'SITE_AREA_INVALID' });
    }
    const areaSize = requestedArea;
    const countryCode = String(req.body.countryCode || req.body.country || 'PL').toUpperCase();
    const baseProfile = getCountryProfile(countryCode);
    const cProfile = countryCode === 'DK' ? {
      ...baseProfile,
      countryCode: 'DK', countryName: 'Denmark', currency: 'DKK', symbol: 'kr',
      cadastreAuthority: 'Klimadatastyrelsen / Datafordeleren — Matriklen2', cadastrePortalUrl: 'https://datafordeler.dk/dataoversigt/matriklen-mat/matriklen2-gaeldende-og-foreloebig-wfs/',
      geologyAuthority: 'De Nationale Geologiske Undersøgelser for Danmark og Grønland (GEUS / Jupiter)', geologyPortalUrl: 'https://data.geus.dk/geusmap/',
      floodAuthority: 'Relevante nationale og kommunale danske risikomyndigheder', floodPortalUrl: 'https://www.klimatilpasning.dk/',
      planningInstrumentName: 'Lokalplan / kommuneplanramme',
      standardSetbackRule: 'Fastlægges af gældende lokalplan, bygningsreglement og kommunal byggesagsbehandling; kræver lokal verifikation',
      baseValuationPerSqm: 0,
      valuationDataSource: 'No generic land-price fallback — calibrated Danish land-only evidence required'
    } : baseProfile;
    const support = getCountrySupport(countryCode);
    const country = req.body.country || cProfile.countryName;
    const defaultLanguage = countryCode === 'FR' ? 'fr' : countryCode === 'ES' ? 'es' : countryCode === 'FI' ? 'fi' : countryCode === 'SK' ? 'sk' : countryCode === 'CZ' ? 'cs' : countryCode === 'DK' ? 'da' : countryCode === 'NO' ? 'no' : countryCode === 'SE' ? 'sv' : countryCode === 'PL' ? 'pl' : countryCode === 'NL' ? 'nl' : countryCode === 'HR' ? 'hr' : countryCode === 'PT' ? 'pt' : countryCode === 'EE' ? 'et' : countryCode === 'LV' ? 'lv' : countryCode === 'LT' ? 'lt' : 'en';
    const requestedLanguage = String(req.body.language || req.body.languageCode || defaultLanguage).toLowerCase().split('-')[0];
    const language = requestedLanguage === 'sk'
      ? (countryCode === 'SK' ? 'sk' : 'en')
      : requestedLanguage === 'cs'
        ? (countryCode === 'CZ' ? 'cs' : 'en')
        : requestedLanguage === 'da'
          ? (countryCode === 'DK' ? 'da' : 'en')
          : requestedLanguage === 'sv'
            ? (countryCode === 'SE' ? 'sv' : 'en')
            : (requestedLanguage === 'no' || requestedLanguage === 'nb')
              ? (countryCode === 'NO' ? 'no' : 'en')
              : ['en', 'de', 'pl', 'nl', 'fr', 'es', 'fi', 'hr', 'pt', 'et', 'lv', 'lt'].includes(requestedLanguage) ? requestedLanguage : defaultLanguage;
    stage = 'site-centre';
    const center = getCenterFromShape(shape, req.body);
    if (!center) return res.status(400).json({ error: 'Select a site on the map to continue.', code: 'SITE_LOCATION_REQUIRED' });
    const [lat, lng] = center;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Select a valid site on the map to continue.', code: 'SITE_LOCATION_INVALID' });
    }

    stage = 'reverse-geocoding';
    const resolvedLocation = await resolveSiteLocation(lat, lng, country);
    let locationName = resolvedLocation.locationName;
    let municipality = resolvedLocation.municipality;
    let countyName = resolvedLocation.county;
    let stateName = resolvedLocation.state;
    let roadName = resolvedLocation.road;
    let resolvedCountryCode = resolvedLocation.countryCode;
    const resolvedRegionCode = resolvedLocation.regionCode;
    const ukJurisdiction = countryCode === 'GB'
      ? (/scotland/i.test(`${stateName || ''} ${locationName || ''}`) ? 'SCOTLAND' : /northern ireland/i.test(`${stateName || ''} ${locationName || ''}`) ? 'NORTHERN_IRELAND' : 'ENGLAND_WALES')
      : null;

    const locationCountryConfirmed = Boolean(resolvedCountryCode && (resolvedCountryCode === countryCode || (countryCode === 'GB' && resolvedCountryCode === 'UK')));
    const countryLocationUnresolved = !resolvedCountryCode;
    const countryLocationMismatch = Boolean(resolvedCountryCode && !locationCountryConfirmed);
    const acquisitionCountryCode = countryLocationMismatch ? 'EU' : countryCode;
    stage = 'geospatial-analysis-pipeline';
    const evidenceReport: any = await runGeospatialAnalysisPipeline({ lat, lng, areaSizeM2: areaSize, countryCode: acquisitionCountryCode, language, locationName, municipality, county: countyName, state: stateName, roadName });
    evidenceReport.countryCode = countryCode;
    evidenceReport.countryLocationMismatch = countryLocationMismatch;
    evidenceReport.countryLocationUnresolved = countryLocationUnresolved;

    let czechiaCadastre: any = null;
    let norwayCadastre: any = null;
    let netherlandsCadastre: any = null;
    let netherlandsGroundEvidence: any[] = [];
    let denmarkCadastre: any = null;
    let irelandCadastre: any = null;
    let luxembourgCadastre: any = null;
    let belgiumCadastre: any = null;
    let switzerlandCadastre: any = null;
    let maltaCadastre: any = null;
    let finlandCadastre: any = null;
    let portugalCadastre: any = null;
    let estoniaCadastre: any = null;
    let latviaCadastre: any = null;
    let germanyCadastre: any = null;
    let germanyMvEvidence: any[] = [];
    let germanyBoreholeEvidence: any[] = [];
    if (!countryLocationMismatch && countryCode === 'CZ' && support.capabilities.nationalCadastre) {
      stage = 'czechia-cadastre';
      try {
        czechiaCadastre = await queryCzechiaCadastre(lat, lng);
        let czechiaInspire: any = null;
        if (czechiaCadastre.success && czechiaCadastre.parcel?.geometryPoints?.length) {
          czechiaInspire = await queryCzechiaInspireCadastre(czechiaCadastre.parcel.geometryPoints, czechiaCadastre.parcel.cadastralAreaId && czechiaCadastre.parcel.parcelNumber ? `${czechiaCadastre.parcel.cadastralAreaId}-${czechiaCadastre.parcel.parcelNumber}` : null);
          czechiaCadastre.inspire = czechiaInspire;
        }
        if (czechiaCadastre.success) {
          applyCzechiaCadastreToReport(evidenceReport, czechiaCadastre, areaSize);
          municipality = czechiaCadastre.parcel?.municipality || municipality;
          countyName = czechiaCadastre.parcel?.district || countyName;
          stateName = czechiaCadastre.parcel?.region || stateName;
          if (evidenceReport.evidenceScore?.breakdown?.cadastreAndGeometry) {
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = Math.max(12, Number(evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score) || 0);
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.rationale = 'ČÚZK RÚIAN returned a registered parcel identifier and polygon at the selected coordinate; legal title and boundary conclusiveness still require KN/ISKN verification.';
          }
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Official National Cadastre') : [];
          evidenceReport.dataSourcesCited.push({ name: czechiaCadastre.sourceName, organization: 'Český úřad zeměměřický a katastrální (ČÚZK)', url: czechiaCadastre.sourceUrl, type: 'Official National Cadastre', status: 'VERIFIED' });
          if (czechiaInspire?.success) {
            const localRef = czechiaCadastre.parcel?.cadastralAreaId && czechiaCadastre.parcel?.parcelNumber
              ? `${czechiaCadastre.parcel.cadastralAreaId}-${czechiaCadastre.parcel.parcelNumber}`
              : null;
            const inspireRef = czechiaInspire.parcel?.nationalCadastralReference || null;
            const referenceAgrees = Boolean(localRef && inspireRef && localRef === inspireRef);
            evidenceReport.evidenceRegistry.push({
              id: 'cz-inspire-cadastre', category: 'Cadastre & identification',
              claim: `Czech INSPIRE Cadastral Parcels returned ${inspireRef || czechiaInspire.parcel?.label || 'a parcel'} from the ČÚZK ISKN publication${referenceAgrees ? '; national cadastral reference agrees with RÚIAN' : ''}.`,
              status: referenceAgrees ? 'VERIFIED' : 'REQUIRES_VERIFICATION',
              sourceName: 'ČÚZK INSPIRE WFS — Cadastral Parcels',
              sourceUrl: czechiaInspire.source.serviceUrl, datasetDate: czechiaInspire.datasetDate,
              spatialRelationship: 'INSPIRE parcel queried around the official RÚIAN parcel geometry',
              calculationMethod: 'ČÚZK INSPIRE WFS 2.0.0 cp:CadastralParcel bbox query',
              confidence: referenceAgrees ? 'High' : 'Medium',
              limitation: referenceAgrees ? 'INSPIRE publication and RÚIAN agree on the national cadastral reference. INSPIRE remains an interoperable publication; legal title and rights require KN/ISKN.' : 'INSPIRE returned a parcel, but the national reference could not be independently matched to RÚIAN in this query.',
              value: { inspireId: czechiaInspire.parcel?.inspireId, nationalCadastralReference: inspireRef, areaM2: czechiaInspire.parcel?.areaM2, referenceAgrees }
            });
            evidenceReport.dataSourcesCited.push({ name: 'ČÚZK INSPIRE WFS — Cadastral Parcels', organization: 'Český úřad zeměměřický a katastrální (ČÚZK)', url: czechiaInspire.source.serviceUrl, type: 'Official National Cadastre', status: referenceAgrees ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
          }
        } else if (Array.isArray(czechiaCadastre.evidence)) {
          evidenceReport.evidenceRegistry.push(...czechiaCadastre.evidence);
        }
      } catch (e) { console.warn(`[${diagnosticId}] ČÚZK Czechia cadastre notice:`, e); }
    } else if (!countryLocationMismatch && countryCode === 'DE') {
      stage = 'germany-cadastre';
      try {
        germanyCadastre = await queryGermanyCadastre(lat, lng, stateName);
        applyGermanyCadastreToReport(evidenceReport, germanyCadastre, areaSize);
        if (germanyCadastre.success) {
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          evidenceReport.dataSourcesCited.push({ name: germanyCadastre.sourceName, organization: germanyCadastre.publisher || germanyCadastre.parcel?.state || 'German state surveying authority', url: germanyCadastre.sourceUrl, type: 'Official State Cadastre', status: 'VERIFIED' });
        }
      } catch (e) { console.warn(`[${diagnosticId}] Germany cadastre notice:`, e); }
    } else if (!countryLocationMismatch && countryCode === 'BE' && support.capabilities.nationalCadastre) {
      stage = 'belgium-cadastre';
      try {
        belgiumCadastre = await queryBelgiumCadastre(lat, lng);
        applyBelgiumCadastreToReport(evidenceReport, belgiumCadastre, areaSize);
        if (belgiumCadastre.success) {
          if (evidenceReport.evidenceScore?.breakdown?.cadastreAndGeometry) {
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = Math.max(12, Number(evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score) || 0);
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.rationale = 'FPS Finance/GAPD identifies the federal cadastral parcel and registered area at the selected coordinate. The open map is screening evidence and is not treated as a surveyed legal boundary or title record.';
          }
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Official National Cadastre') : [];
          evidenceReport.dataSourcesCited.push({ name: belgiumCadastre.sourceName, organization: 'FPS Finance / General Administration of Patrimonial Documentation (GAPD)', url: belgiumCadastre.sourceUrl, type: 'Official National Cadastre', status: 'VERIFIED' });
        }
      } catch (e) { console.warn(`[${diagnosticId}] Belgium federal cadastre notice:`, e); }
    } else if (!countryLocationMismatch && countryCode === 'CH' && support.capabilities.nationalCadastre) {
      stage = 'switzerland-cadastre';
      try {
        switzerlandCadastre = await querySwitzerlandCadastre(lat, lng);
        applySwitzerlandCadastreToReport(evidenceReport, switzerlandCadastre, areaSize);
        if (switzerlandCadastre.success) {
          municipality = switzerlandCadastre.parcel?.municipality || municipality;
          stateName = switzerlandCadastre.parcel?.canton || stateName;
          if (evidenceReport.evidenceScore?.breakdown?.cadastreAndGeometry) {
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = Math.max(18, Number(evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score) || 0);
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.rationale = 'Swiss official surveying returned the legally valid cadastral parcel polygon at the selected coordinate. This supports parcel identity and mapped geometry but does not establish ownership, land-register rights, easements or ÖREB restrictions.';
          }
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Official National Cadastre') : [];
          evidenceReport.dataSourcesCited.push({ name: switzerlandCadastre.sourceName, organization: 'Amtliche Vermessung Schweiz / swisstopo / cantonal surveying authorities', url: switzerlandCadastre.sourceUrl, type: 'Official National Cadastre', status: 'VERIFIED' });
        }
      } catch (e) { console.warn(`[${diagnosticId}] Switzerland official cadastre notice:`, e); }
    } else if (!countryLocationMismatch && countryCode === 'MT' && support.capabilities.nationalCadastre) {
      stage = 'malta-cadastre';
      try {
        maltaCadastre = await queryMaltaCadastre(lat, lng);
        applyMaltaCadastreToReport(evidenceReport, maltaCadastre, areaSize);
        if (maltaCadastre.success) {
          if (evidenceReport.evidenceScore?.breakdown?.cadastreAndGeometry) {
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = Math.max(12, Number(evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score) || 0);
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.rationale = 'The Malta Land Registry / Planning Authority registered-land WFS returned a parcel polygon at the selected coordinate. It is credited as official open-data screening, not as a legally conclusive title or surveyed-boundary determination.';
          }
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Official National Cadastre') : [];
          evidenceReport.dataSourcesCited.push({ name: maltaCadastre.sourceName, organization: 'Malta Land Registry / Planning Authority', url: maltaCadastre.sourceUrl, type: 'Official National Cadastre', status: 'VERIFIED' });
        }
      } catch (e) { console.warn(`[${diagnosticId}] Malta registered parcel notice:`, e); }
    } else if (!countryLocationMismatch && countryCode === 'NL' && support.capabilities.nationalCadastre) {
      stage = 'netherlands-cadastre';
      try {
        netherlandsCadastre = await queryNetherlandsCadastre(lat, lng);
        applyNetherlandsCadastreToReport(evidenceReport, netherlandsCadastre, areaSize);
        if (netherlandsCadastre.success) {
          if (evidenceReport.evidenceScore?.breakdown?.cadastreAndGeometry) {
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = Math.max(12, Number(evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score) || 0);
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.rationale = 'PDOK BRK identifies the mapped parcel and registered area at this coordinate; map position is approximate and is not credited as a surveyed legal boundary.';
          }
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Official National Cadastre') : [];
          evidenceReport.dataSourcesCited.push({ name: netherlandsCadastre.sourceName, organization: 'Kadaster / PDOK', url: netherlandsCadastre.sourceUrl, type: 'Official National Cadastre', status: 'VERIFIED' });
        }
      } catch (e) { console.warn(`[${diagnosticId}] PDOK Netherlands cadastre notice:`, e); }
      stage = 'netherlands-geotop';
      try {
        netherlandsGroundEvidence = await queryNetherlandsGroundEvidence(lat, lng);
        if (netherlandsGroundEvidence.length) evidenceReport.evidenceRegistry.push(...netherlandsGroundEvidence);
        enrichNetherlandsGroundEvidence(evidenceReport, netherlandsGroundEvidence);
        const geotopModelled = netherlandsGroundEvidence.some((item: any) => item.id === 'nl-geotop-profile' && item.status === 'MODELLED');
        if (geotopModelled) {
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.name !== 'TNO Geological Survey of the Netherlands — BRO GeoTOP v1.6.1') : [];
          evidenceReport.dataSourcesCited.push({ name: 'TNO Geological Survey of the Netherlands — BRO GeoTOP v1.6.1', organization: 'TNO / Geological Survey of the Netherlands', url: 'https://www.dinodata.nl/opendap/GeoTOP/geotop.nc.html', type: 'Geological Survey', status: 'MODELLED' });
        }
      } catch (e) { console.warn('[NL GeoTOP] DINOloket notice:', e); }
    } else if (!countryLocationMismatch && countryCode === 'PT' && support.capabilities.nationalCadastre) {
      stage = 'portugal-cadastre';
      try {
        portugalCadastre = await queryPortugalCadastre(lat, lng);
        applyPortugalCadastreToReport(evidenceReport, portugalCadastre, areaSize);
        if (portugalCadastre.success) {
          if (evidenceReport.evidenceScore?.breakdown?.cadastreAndGeometry) {
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = 18;
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.rationale = 'DGT Cadastro Predial returned a published cadastral parcel for the selected coordinate. Portugal cadastral coverage is incomplete, so an empty query is not treated as evidence that no property exists.';
          }
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Official National Cadastre') : [];
          evidenceReport.dataSourcesCited.push({ name: portugalCadastre.sourceName, organization: 'Direção-Geral do Território (DGT)', url: portugalCadastre.sourceUrl, type: 'Official National Cadastre', status: 'VERIFIED' });
        }
      } catch (e) { console.warn(`[${diagnosticId}] DGT Portugal cadastre notice:`, e); }
    } else if (!countryLocationMismatch && countryCode === 'FI' && support.capabilities.nationalCadastre) {
      stage = 'finland-cadastre';
      try {
        finlandCadastre = await queryFinlandCadastre(lat, lng);
        applyFinlandCadastreToReport(evidenceReport, finlandCadastre, areaSize);
        if (finlandCadastre.success) {
          if (evidenceReport.evidenceScore?.breakdown?.cadastreAndGeometry) {
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = 18;
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.rationale = 'National Land Survey INSPIRE Cadastral Parcels returned an official mapped parcel containing the selected coordinate. The geometry is cadastral map evidence, not a substitute for cadastral survey documents or title verification.';
          }
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Official National Cadastre') : [];
          evidenceReport.dataSourcesCited.push({ name: finlandCadastre.sourceName, organization: 'National Land Survey of Finland', url: finlandCadastre.sourceUrl, type: 'Official National Cadastre', status: 'VERIFIED' });
        }
      } catch (e) { console.warn(`[${diagnosticId}] National Land Survey Finland cadastre notice:`, e); }
    } else if (!countryLocationMismatch && countryCode === 'EE' && support.capabilities.nationalCadastre) {
      stage = 'estonia-cadastre';
      try {
        estoniaCadastre = await queryEstoniaCadastre(lat, lng);
        applyEstoniaCadastreToReport(evidenceReport, estoniaCadastre, areaSize);
        if (estoniaCadastre.success) {
          if (evidenceReport.evidenceScore?.breakdown?.cadastreAndGeometry) {
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = 18;
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.rationale = 'Estonian national cadastral units returned the current mapped cadastral unit containing the selected coordinate. The map supports parcel screening; certified cadastral documentation remains the reference for legal boundary questions.';
          }
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Official National Cadastre') : [];
          evidenceReport.dataSourcesCited.push({ name: estoniaCadastre.sourceName, organization: 'Estonian Land and Spatial Development Board', url: estoniaCadastre.sourceUrl, type: 'Official National Cadastre', status: 'VERIFIED' });
        }
      } catch (e) { console.warn(`[${diagnosticId}] Estonian cadastral evidence notice:`, e); }
    } else if (!countryLocationMismatch && countryCode === 'LV' && support.capabilities.nationalCadastre) {
      stage = 'latvia-cadastre';
      try {
        latviaCadastre = await queryLatviaCadastre(lat, lng);
        applyLatviaCadastreToReport(evidenceReport, latviaCadastre, areaSize);
        if (latviaCadastre.success && evidenceReport.evidenceScore?.breakdown?.cadastreAndGeometry) {
          evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = 18;
          evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.rationale = 'Latvian national INSPIRE cadastral service returned the current cadastral parcel containing the selected coordinate. Certified cadastral documentation remains the reference for legal boundary questions.';
        }
        if (latviaCadastre.success) evidenceReport.dataSourcesCited.push({ name: latviaCadastre.sourceName, organization: 'Valsts zemes dienests', url: latviaCadastre.sourceUrl, type: 'Official National Cadastre', status: 'VERIFIED' });
      } catch (e) { console.warn(`[${diagnosticId}] Latvian cadastral evidence notice:`, e); }
    } else if (!countryLocationMismatch && countryCode === 'NO' && support.capabilities.nationalCadastre) {
      stage = 'norway-cadastre';
      try {
        norwayCadastre = await queryNorwayCadastre(lat, lng);
        applyNorwayCadastreToReport(evidenceReport, norwayCadastre, areaSize);
        if (norwayCadastre.success) {
          if (evidenceReport.evidenceScore?.breakdown?.cadastreAndGeometry) {
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = 12;
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.rationale = 'Kartverket identifies the Matrikkelen unit at the selected location, but the open property API does not certify legal boundary type or detailed boundary quality; parcel identity is credited without treating the returned map geometry as a surveyed legal boundary.';
          }
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Official National Cadastre') : [];
          evidenceReport.dataSourcesCited.push({ name: norwayCadastre.sourceName, organization: 'Kartverket', url: norwayCadastre.sourceUrl, type: 'Official National Cadastre', status: 'VERIFIED' });
        }
      } catch (e) { console.warn(`[${diagnosticId}] Kartverket Norway cadastre notice:`, e); }
    } else if (!countryLocationMismatch && countryCode === 'IE' && support.capabilities.nationalCadastre) {
      stage = 'ireland-cadastre';
      try {
        irelandCadastre = await queryIrelandCadastre(lat, lng);
        applyIrelandCadastreToReport(evidenceReport, irelandCadastre, areaSize);
        if (irelandCadastre.success) {
          countyName = irelandCadastre.parcel?.county || countyName;
          if (evidenceReport.evidenceScore?.breakdown?.cadastreAndGeometry) {
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = Math.max(12, Number(evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score) || 0);
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.rationale = 'Tailte Éireann identifies a public freehold/leasehold title-boundary polygon and spatial parcel identifier. The open geometry is explicitly generalised and is credited as cadastral screening, not as a legally surveyed boundary.';
          }
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Official National Cadastre') : [];
          evidenceReport.dataSourcesCited.push({ name: irelandCadastre.sourceName, organization: 'Tailte Éireann', url: irelandCadastre.sourceUrl, type: 'Official National Cadastre', status: 'VERIFIED' });
        }
      } catch (e) { console.warn(`[${diagnosticId}] Tailte Éireann cadastre notice:`, e); }
    } else if (!countryLocationMismatch && countryCode === 'LU' && support.capabilities.nationalCadastre) {
      stage = 'luxembourg-cadastre';
      try {
        luxembourgCadastre = await queryLuxembourgCadastre(lat, lng);
        applyLuxembourgCadastreToReport(evidenceReport, luxembourgCadastre, areaSize);
        if (luxembourgCadastre.success) {
          if (evidenceReport.evidenceScore?.breakdown?.cadastreAndGeometry) {
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = Math.max(12, Number(evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score) || 0);
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.rationale = 'Luxembourg ACT identifies the mapped cadastral parcel at the selected coordinate. The map is credited as official cadastral screening, not as proof of ownership, title rights or a new legally surveyed boundary.';
          }
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Official National Cadastre') : [];
          evidenceReport.dataSourcesCited.push({ name: luxembourgCadastre.sourceName, organization: 'Administration du cadastre et de la topographie (ACT)', url: luxembourgCadastre.sourceUrl, type: 'Official National Cadastre', status: 'VERIFIED' });
        }
      } catch (e) { console.warn(`[${diagnosticId}] Luxembourg ACT cadastre notice:`, e); }
    } else if (!countryLocationMismatch && countryCode === 'DK' && support.capabilities.nationalCadastre) {
      stage = 'denmark-cadastre';
      try {
        denmarkCadastre = await queryDenmarkCadastre(lat, lng);
        applyDenmarkCadastreToReport(evidenceReport, denmarkCadastre, areaSize);
        if (denmarkCadastre.success) {
          municipality = denmarkCadastre.parcel?.municipalityName || municipality;
          if (evidenceReport.evidenceScore?.breakdown?.cadastreAndGeometry) {
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = 18;
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.rationale = 'Datafordeleren Matriklen2 returned the registered Danish cadastral parcel, registered area and registry geometry. The geometry is official register context but is not treated as a new legally surveyed boundary determination.';
          }
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Official National Cadastre') : [];
          evidenceReport.dataSourcesCited.push({ name: denmarkCadastre.sourceName, organization: 'Datafordeleren / Matriklen', url: denmarkCadastre.sourceUrl, type: 'Official National Cadastre', status: 'VERIFIED' });
        }
      } catch (e) { console.warn(`[${diagnosticId}] Datafordeleren Denmark cadastre notice:`, e); }
    }

    if (!countryLocationMismatch && countryCode === 'DE') {
      stage = 'germany-national-hydrogeology';
      try {
        const nationalHydroEvidence = await queryGermanyNationalHydrogeology(lat, lng, fetch);
        enrichGermanyNationalHydrogeology(evidenceReport, nationalHydroEvidence);
        const verifiedNationalHydro = nationalHydroEvidence.some((item: any) => item.status === 'VERIFIED');
        const modelledNationalHydro = nationalHydroEvidence.some((item: any) => item.id === 'de-huek250-excavation-water-screening' && item.status === 'MODELLED');
        evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
        if (!evidenceReport.dataSourcesCited.some((source: any) => source?.name === 'BGR / SGD — HÜK250')) {
          evidenceReport.dataSourcesCited.push({
            name: 'BGR / SGD — HÜK250',
            organization: 'Bundesanstalt für Geowissenschaften und Rohstoffe / Staatliche Geologische Dienste',
            url: 'https://services.bgr.de/arcgis/rest/services/grundwasser/huek250/MapServer',
            type: 'National Hydrogeological Survey',
            status: modelledNationalHydro ? 'MODELLED' : verifiedNationalHydro ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
          });
        }
      } catch (e) { console.warn(`[${diagnosticId}] Germany national HÜK250 evidence notice:`, e); }
      stage = 'germany-borehole-evidence';
      try {
        const boreholeResult = await queryGermanyBoreholes(lat, lng, fetch);
        germanyBoreholeEvidence = [boreholeResult];
        evidenceReport.evidenceRegistry.push(boreholeResult);
        if (boreholeResult.status === 'VERIFIED') {
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          evidenceReport.dataSourcesCited.push({ name: boreholeResult.sourceName, organization: 'Bundesanstalt für Geowissenschaften und Rohstoffe (BGR)', url: boreholeResult.sourceUrl, type: 'National Borehole Register', status: 'VERIFIED' });
        }
      } catch (e) { console.warn(`[${diagnosticId}] BGR German Borehole Locations notice:`, e); }
      stage = 'germany-mv-ground-evidence';
      try {
        const siteElevationM = typeof evidenceReport.terrain?.elevationAmsl === 'number' && Number.isFinite(evidenceReport.terrain.elevationAmsl) ? evidenceReport.terrain.elevationAmsl : null;
        const mvResult = await queryGermanyMvGroundEvidence(lat, lng, stateName, fetch, siteElevationM);
        germanyMvEvidence = mvResult.evidence;
        enrichGermanyMvGroundEvidence(evidenceReport, mvResult);
        if (mvResult.evidence.some((item: any) => item.id === 'de-mv-boreholes-lbds' && item.status === 'VERIFIED')) {
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          evidenceReport.dataSourcesCited.push({
            name: 'LUNG M-V — Landesbohrdatenspeicher (LBDS)',
            organization: 'Landesamt für Umwelt, Naturschutz und Geologie Mecklenburg-Vorpommern',
            url: 'https://umweltkarten.lung-mv.de/dienste/gg_lbds?SERVICE=WFS&REQUEST=GetCapabilities',
            type: 'Regional Borehole Register', status: 'VERIFIED'
          });
        }
        stage = 'germany-flood-evidence';
        try {
          const germanyFloodEvidence = await queryGermanyFloodEvidence(lat, lng, stateName, fetch);
          evidenceReport.evidenceRegistry.push(...germanyFloodEvidence);
          const verifiedFlood = germanyFloodEvidence.some((item: any) => item.status === 'VERIFIED');
          if (verifiedFlood && evidenceReport.evidenceScore?.breakdown?.environmentalAndFlood) {
            evidenceReport.evidenceScore.breakdown.environmentalAndFlood.score = Math.max(8, Number(evidenceReport.evidenceScore.breakdown.environmentalAndFlood.score) || 0);
            evidenceReport.evidenceScore.breakdown.environmentalAndFlood.rationale = 'BfG national flood-hazard mapping returned verified river-flood inundation evidence for the integrated Mecklenburg-Vorpommern state layer. This is mapped hazard evidence, not a site measurement.';
          }
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          if (!evidenceReport.dataSourcesCited.some((source: any) => source?.organization === 'WasserBLIcK / BfG')) {
            evidenceReport.dataSourcesCited.push({ name: 'WasserBLIcK / BfG — German flood hazard maps', organization: 'WasserBLIcK / BfG', url: 'https://geoportal.bafg.de/karten/HWRM/', type: 'National Flood Hazard Mapping', status: verifiedFlood ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
          }
        } catch (e) { console.warn(`[${diagnosticId}] German flood evidence notice:`, e); }
        if (mvResult.evidence.some((item: any) => item.id === 'de-mv-groundwater-dynamics' && item.status === 'MODELLED')) {
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          evidenceReport.dataSourcesCited.push({ name: 'LUNG M-V — Grundwasserhöhengleichen (2016)', organization: 'Landesamt für Umwelt, Naturschutz und Geologie Mecklenburg-Vorpommern', url: 'https://www.umweltkarten.mv-regierung.de/meta/dynamik.pdf', type: 'Hydrogeological Survey', status: 'MODELLED' });
        }
        if (mvResult.evidence.some((item: any) => item.id === 'de-mv-geology-gk50' && item.status === 'VERIFIED')) {
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          evidenceReport.dataSourcesCited.push({
            name: 'LUNG M-V — Geologische Karte (GK 50) 1:50.000',
            organization: 'Landesamt für Umwelt, Naturschutz und Geologie Mecklenburg-Vorpommern',
            url: 'https://www.umweltkarten.mv-regierung.de/script/mv_a7_geol_karten_wfs.php?SERVICE=WFS&REQUEST=GetCapabilities',
            type: 'Regional Geological Survey', status: 'VERIFIED'
          });
        }
      } catch (e) { console.warn(`[${diagnosticId}] Mecklenburg-Vorpommern regional evidence notice:`, e); }

      const normalizedGermanState = String(stateName || '').trim().toLowerCase();

      if (normalizedGermanState === 'bayern' || normalizedGermanState === 'bavaria' || normalizedGermanState.includes('bayern')) {
        stage = 'germany-bavaria-groundwater';
        try {
          const siteElevationM = typeof evidenceReport.terrain?.elevationAmsl === 'number' && Number.isFinite(evidenceReport.terrain.elevationAmsl) ? evidenceReport.terrain.elevationAmsl : null;
          const bavariaGroundwater = await queryGermanyBavariaGroundwater(lat, lng, stateName, fetch, siteElevationM);
          enrichGermanyBavariaGroundwater(evidenceReport, bavariaGroundwater);
          const verified = bavariaGroundwater.evidence.some((item: any) => item.status === 'VERIFIED');
          const modelled = bavariaGroundwater.evidence.some((item: any) => item.status === 'MODELLED');
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          evidenceReport.dataSourcesCited.push({ name: 'Bayerisches Landesamt für Umwelt — Hydrogeologie', organization: 'Bayerisches Landesamt für Umwelt (LfU)', url: 'https://www.lfu.bayern.de/gdi/wms/geologie/hk500?', type: 'Regional Hydrogeological Survey', status: modelled ? 'MODELLED' : verified ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
        } catch (e) { console.warn(`[${diagnosticId}] Bavaria groundwater evidence notice:`, e); }
      }

      if (normalizedGermanState === 'rheinland-pfalz' || normalizedGermanState === 'rhineland-palatinate' || normalizedGermanState.includes('rheinland-pfalz')) {
        stage = 'germany-rheinland-pfalz-groundwater';
        try {
          const siteElevationM = typeof evidenceReport.terrain?.elevationAmsl === 'number' && Number.isFinite(evidenceReport.terrain.elevationAmsl) ? evidenceReport.terrain.elevationAmsl : null;
          const rlpGroundwater = await queryGermanyRlpGroundwater(lat, lng, stateName, fetch, siteElevationM);
          enrichGermanyRlpGroundwater(evidenceReport, rlpGroundwater);
          const modelled = rlpGroundwater.evidence.some((item: any) => item.status === 'MODELLED');
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          evidenceReport.dataSourcesCited.push({ name: 'LGB — GWO-RLP 2025', organization: 'Landesamt für Geologie und Bergbau Rheinland-Pfalz', url: 'https://mapserver.lgb-rlp.de/cgi-bin/mc_gwo?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities', type: 'Regional Hydrogeological Survey', status: modelled ? 'MODELLED' : 'REQUIRES_VERIFICATION' });
        } catch (e) { console.warn(`[${diagnosticId}] Rheinland-Pfalz groundwater evidence notice:`, e); }
      }

      if (normalizedGermanState === 'nordrhein-westfalen' || normalizedGermanState === 'north rhine-westphalia' || normalizedGermanState.includes('nordrhein-westfalen')) {
        stage = 'germany-nrw-hydrogeology';
        try {
          const nrwHydrogeology = await queryGermanyNrwHydrogeology(lat, lng, stateName, fetch);
          enrichGermanyNrwHydrogeology(evidenceReport, nrwHydrogeology);
          const verified = nrwHydrogeology.evidence.some((item: any) => item.status === 'VERIFIED');
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          if (!evidenceReport.dataSourcesCited.some((source: any) => source?.name === 'Geologischer Dienst NRW — HK100')) {
            evidenceReport.dataSourcesCited.push({
              name: 'Geologischer Dienst NRW — HK100',
              organization: 'Geologischer Dienst Nordrhein-Westfalen',
              url: 'https://ogc-api.nrw.de/inspire-ge-hk100/v1',
              type: 'Regional Hydrogeological Survey',
              status: verified ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
            });
          }
        } catch (e) { console.warn(`[${diagnosticId}] NRW hydrogeology evidence notice:`, e); }
      }

      if (normalizedGermanState === 'baden-württemberg' || normalizedGermanState.includes('baden-württemberg') || normalizedGermanState.includes('baden-wuerttemberg')) {
        stage = 'germany-baden-wurttemberg-hydrogeology';
        try {
          const bwHydrogeology = await queryGermanyBwHydrogeology(lat, lng, stateName, fetch);
          enrichGermanyBwHydrogeology(evidenceReport, bwHydrogeology);
          const verified = bwHydrogeology.evidence.some((item: any) => item.status === 'VERIFIED');
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          if (!evidenceReport.dataSourcesCited.some((source: any) => source?.name === 'LGRB Baden-Württemberg — Hydrogeologie HK50')) {
            evidenceReport.dataSourcesCited.push({
              name: 'LGRB Baden-Württemberg — Hydrogeologie HK50',
              organization: 'Landesamt für Geologie, Rohstoffe und Bergbau Baden-Württemberg',
              url: 'https://services.lgrb-bw.de/ms/lgrb_geola_hyd?REQUEST=GetCapabilities&SERVICE=WMS&VERSION=1.3.0',
              type: 'Regional Hydrogeological Survey',
              status: verified ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
            });
          }
        } catch (e) { console.warn(`[${diagnosticId}] Baden-Württemberg hydrogeology evidence notice:`, e); }
      }

      if (normalizedGermanState === 'niedersachsen' || normalizedGermanState === 'lower saxony' || normalizedGermanState.includes('niedersachsen')) {
        stage = 'germany-lower-saxony-hydrogeology';
        try {
          const niHydrogeology = await queryGermanyLowerSaxonyHydrogeology(lat, lng, stateName, fetch);
          enrichGermanyLowerSaxonyHydrogeology(evidenceReport, niHydrogeology);
          const verified = niHydrogeology.evidence.some((item: any) => item.status === 'VERIFIED');
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          if (!evidenceReport.dataSourcesCited.some((source: any) => source?.name === 'LBEG Niedersachsen — Hydrogeologie / HK50')) {
            evidenceReport.dataSourcesCited.push({
              name: 'LBEG Niedersachsen — Hydrogeologie / HK50',
              organization: 'Landesamt für Bergbau, Energie und Geologie Niedersachsen',
              url: 'https://nibis.lbeg.de/net3/public/ogc.ashx?NodeId=200&Service=WMS&Request=GetCapabilities&',
              type: 'Regional Hydrogeological Survey',
              status: verified ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
            });
          }
        } catch (e) { console.warn(`[${diagnosticId}] Lower Saxony hydrogeology evidence notice:`, e); }
      }

      if (normalizedGermanState === 'brandenburg' || normalizedGermanState.includes('brandenburg')) {
        stage = 'germany-brandenburg-hydrogeology';
        try {
          const bbHydrogeology = await queryGermanyBrandenburgHydrogeology(lat, lng, stateName, fetch);
          enrichGermanyBrandenburgHydrogeology(evidenceReport, bbHydrogeology);
          const verified = bbHydrogeology.evidence.some((item: any) => item.status === 'VERIFIED');
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          if (!evidenceReport.dataSourcesCited.some((source: any) => source?.name === 'LBGR Brandenburg — Hydrogeologische Karten HYK50')) {
            evidenceReport.dataSourcesCited.push({
              name: 'LBGR Brandenburg — Hydrogeologische Karten HYK50',
              organization: 'Landesamt für Bergbau, Geologie und Rohstoffe Brandenburg',
              url: 'https://inspire.brandenburg.de/services/hgk_wms?REQUEST=GetCapabilities&SERVICE=WMS&VERSION=1.3.0',
              type: 'Regional Hydrogeological Survey',
              status: verified ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
            });
          }
        } catch (e) { console.warn(`[${diagnosticId}] Brandenburg hydrogeology evidence notice:`, e); }
      }

      // Check Sachsen-Anhalt before Sachsen: "Sachsen-Anhalt" contains "Sachsen".
      if (normalizedGermanState === 'sachsen-anhalt' || normalizedGermanState === 'saxony-anhalt' || normalizedGermanState.includes('sachsen-anhalt')) {
        stage = 'germany-saxony-anhalt-hydrogeology';
        try {
          const saHydrogeology = await queryGermanySaxonyAnhaltHydrogeology(lat, lng, stateName, fetch);
          enrichGermanySaxonyAnhaltHydrogeology(evidenceReport, saHydrogeology);
          const verified = saHydrogeology.evidence.some((item: any) => item.status === 'VERIFIED');
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          if (!evidenceReport.dataSourcesCited.some((source: any) => source?.name === 'LAGB / LHW Sachsen-Anhalt — Hydrogeologie / Grundwasser')) {
            evidenceReport.dataSourcesCited.push({
              name: 'LAGB / LHW Sachsen-Anhalt — Hydrogeologie / Grundwasser',
              organization: 'Landesamt für Geologie und Bergwesen Sachsen-Anhalt / Landesbetrieb für Hochwasserschutz und Wasserwirtschaft Sachsen-Anhalt',
              url: 'https://lagb.sachsen-anhalt.de/geologie/hydrogeologie',
              type: 'Regional Hydrogeological Survey',
              status: verified ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
            });
          }
        } catch (e) { console.warn(`[${diagnosticId}] Saxony-Anhalt hydrogeology evidence notice:`, e); }
      }

      if (normalizedGermanState === 'sachsen' || normalizedGermanState === 'saxony') {
        stage = 'germany-saxony-hydrogeology';
        try {
          const snHydrogeology = await queryGermanySaxonyHydrogeology(lat, lng, stateName, fetch);
          enrichGermanySaxonyHydrogeology(evidenceReport, snHydrogeology);
          const verified = snHydrogeology.evidence.some((item: any) => item.status === 'VERIFIED');
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          if (!evidenceReport.dataSourcesCited.some((source: any) => source?.name === 'LfULG Sachsen — Hydrogeologie / Grundwasserdynamik')) {
            evidenceReport.dataSourcesCited.push({
              name: 'LfULG Sachsen — Hydrogeologie / Grundwasserdynamik',
              organization: 'Sächsisches Landesamt für Umwelt, Landwirtschaft und Geologie',
              url: 'https://luis.sachsen.de/wasser/gw/grundwasserdynamik-2022.html',
              type: 'Regional Hydrogeological Survey',
              status: verified ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
            });
          }
        } catch (e) { console.warn(`[${diagnosticId}] Saxony hydrogeology evidence notice:`, e); }
      }

      if (normalizedGermanState === 'thüringen' || normalizedGermanState === 'thueringen' || normalizedGermanState === 'thuringia') {
        stage = 'germany-thuringia-hydrogeology';
        try {
          const thHydrogeology = await queryGermanyThuringiaHydrogeology(lat, lng, stateName, fetch);
          enrichGermanyThuringiaHydrogeology(evidenceReport, thHydrogeology);
          const verified = thHydrogeology.evidence.some((item: any) => item.status === 'VERIFIED');
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          if (!evidenceReport.dataSourcesCited.some((source: any) => source?.name === 'TLUBN Thüringen — Hydrogeologie / Grundwasser')) {
            evidenceReport.dataSourcesCited.push({
              name: 'TLUBN Thüringen — Hydrogeologie / Grundwasser',
              organization: 'Thüringer Landesamt für Umwelt, Bergbau und Naturschutz',
              url: 'https://www.geoproxy.geoportal-th.de/geoproxy/services/hydrogeologie?REQUEST=GetCapabilities&SERVICE=WMS&VERSION=1.3.0',
              type: 'Regional Hydrogeological Survey',
              status: verified ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
            });
          }
        } catch (e) { console.warn(`[${diagnosticId}] Thuringia hydrogeology evidence notice:`, e); }
      }

      if (normalizedGermanState === 'hessen' || normalizedGermanState === 'hesse') {
        stage = 'germany-hesse-hydrogeology';
        try {
          const heHydrogeology = await queryGermanyHesseHydrogeology(lat, lng, stateName, fetch);
          enrichGermanyHesseHydrogeology(evidenceReport, heHydrogeology);
          const verified = heHydrogeology.evidence.some((item: any) => item.status === 'VERIFIED');
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          if (!evidenceReport.dataSourcesCited.some((source: any) => source?.name === 'HLNUG / BGR Hessen — Hydrogeologie und Grundwasser')) {
            evidenceReport.dataSourcesCited.push({
              name: 'HLNUG / BGR Hessen — Hydrogeologie und Grundwasser',
              organization: 'Hessisches Landesamt für Naturschutz, Umwelt und Geologie / Bundesanstalt für Geowissenschaften und Rohstoffe',
              url: 'https://www.hlnug.de/themen/wasser/grundwasser/grundwasserkarten',
              type: 'Regional Hydrogeological Survey',
              status: verified ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
            });
          }
        } catch (e) { console.warn(`[${diagnosticId}] Hesse hydrogeology evidence notice:`, e); }
      }

      if (normalizedGermanState === 'bremen') {
        stage = 'germany-bremen-hydrogeology';
        try {
          const bremenHydrogeology = await queryGermanyBremenHydrogeology(lat, lng, stateName, fetch);
          enrichGermanyBremenHydrogeology(evidenceReport, bremenHydrogeology);
          const verified = bremenHydrogeology.evidence.some((item: any) => item.status === 'VERIFIED');
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          if (!evidenceReport.dataSourcesCited.some((source: any) => source?.name === 'Geologischer Dienst Bremen / SUKW — Hydrogeologie und Grundwasser')) {
            evidenceReport.dataSourcesCited.push({
              name: 'Geologischer Dienst Bremen / SUKW — Hydrogeologie und Grundwasser',
              organization: 'Freie Hansestadt Bremen — Senatorin für Umwelt, Klima und Wissenschaft / Geologischer Dienst Bremen',
              url: 'https://www.umwelt.bremen.de/umwelt/hochwasser-und-kuestenschutz-quantitative-wasserwirtschaft/grundwasserstaende-2384530',
              type: 'Groundwater Monitoring / Hydrogeology',
              status: verified ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
            });
          }
        } catch (e) { console.warn(`[${diagnosticId}] Bremen hydrogeology evidence notice:`, e); }
      }

      if (normalizedGermanState === 'berlin') {
        stage = 'germany-berlin-hydrogeology';
        try {
          const berlinHydrogeology = await queryGermanyBerlinHydrogeology(lat, lng, stateName, fetch);
          enrichGermanyBerlinHydrogeology(evidenceReport, berlinHydrogeology);
          const verified = berlinHydrogeology.evidence.some((item: any) => item.status === 'VERIFIED');
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          if (!evidenceReport.dataSourcesCited.some((source: any) => source?.name === 'Senatsverwaltung Berlin / Landesgeologie — Grundwasser')) {
            evidenceReport.dataSourcesCited.push({
              name: 'Senatsverwaltung Berlin / Landesgeologie — Grundwasser',
              organization: 'Senatsverwaltung für Mobilität, Verkehr, Klimaschutz und Umwelt Berlin',
              url: 'https://www.berlin.de/sen/uvk/umwelt/wasser-und-geologie/grundwasser/informationen-zum-grundwasser/',
              type: 'Groundwater Monitoring / Hydrogeology',
              status: verified ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
            });
          }
        } catch (e) { console.warn(`[${diagnosticId}] Berlin hydrogeology evidence notice:`, e); }
      }

      if (normalizedGermanState === 'hamburg') {
        stage = 'germany-hamburg-hydrogeology';
        try {
          const hamburgHydrogeology = await queryGermanyHamburgHydrogeology(lat, lng, stateName, fetch);
          enrichGermanyHamburgHydrogeology(evidenceReport, hamburgHydrogeology);
          const verified = hamburgHydrogeology.evidence.some((item: any) => item.status === 'VERIFIED');
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          if (!evidenceReport.dataSourcesCited.some((source: any) => source?.name === 'BUKEA / Geologisches Landesamt Hamburg — Hydrogeologie und Grundwasser')) {
            evidenceReport.dataSourcesCited.push({
              name: 'BUKEA / Geologisches Landesamt Hamburg — Hydrogeologie und Grundwasser',
              organization: 'Freie und Hansestadt Hamburg — Behörde für Umwelt, Klima, Energie und Agrarwirtschaft',
              url: 'https://www.hamburg.de/politik-und-verwaltung/behoerden/bukea/themen/wasser/grundwasser/grundwasserstand-176112',
              type: 'Groundwater Monitoring / Hydrogeology',
              status: verified ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
            });
          }
        } catch (e) { console.warn(`[${diagnosticId}] Hamburg hydrogeology evidence notice:`, e); }
      }

      if (normalizedGermanState === 'saarland') {
        stage = 'germany-saarland-hydrogeology';
        try {
          const saarlandHydrogeology = await queryGermanySaarlandHydrogeology(lat, lng, stateName, fetch);
          enrichGermanySaarlandHydrogeology(evidenceReport, saarlandHydrogeology);
          const verified = saarlandHydrogeology.evidence.some((item: any) => item.status === 'VERIFIED');
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          if (!evidenceReport.dataSourcesCited.some((source: any) => source?.name === 'LUA Saarland / BGR — Hydrogeologie und Grundwasser')) {
            evidenceReport.dataSourcesCited.push({
              name: 'LUA Saarland / BGR — Hydrogeologie und Grundwasser',
              organization: 'Landesamt für Umwelt- und Arbeitsschutz Saarland / Bundesanstalt für Geowissenschaften und Rohstoffe',
              url: 'https://geoportal.saarland.de/arcgis/services/Internet/Wasser_WFS/MapServer/WFSServer?request=GetCapabilities&SERVICE=WFS&VERSION=1.1.0',
              type: 'Groundwater Monitoring / Hydrogeology',
              status: verified ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
            });
          }
        } catch (e) { console.warn(`[${diagnosticId}] Saarland hydrogeology evidence notice:`, e); }
      }

      if (normalizedGermanState === 'schleswig-holstein' || normalizedGermanState === 'schleswig holstein') {
        stage = 'germany-schleswig-holstein-hydrogeology';
        try {
          const shHydrogeology = await queryGermanySchleswigHolsteinHydrogeology(lat, lng, stateName, fetch);
          enrichGermanySchleswigHolsteinHydrogeology(evidenceReport, shHydrogeology);
          const verified = shHydrogeology.evidence.some((item: any) => item.status === 'VERIFIED');
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          if (!evidenceReport.dataSourcesCited.some((source: any) => source?.name === 'LfU Schleswig-Holstein — Hydrogeologie / Grundwasser')) {
            evidenceReport.dataSourcesCited.push({
              name: 'LfU Schleswig-Holstein — Hydrogeologie / Grundwasser',
              organization: 'Landesamt für Umwelt Schleswig-Holstein',
              url: 'https://umweltgeodienste.schleswig-holstein.de/WMS_Hydrogeologie?SERVICE=WMS&REQUEST=GetCapabilities&',
              type: 'Regional Hydrogeological Survey',
              status: verified ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
            });
          }
        } catch (e) { console.warn(`[${diagnosticId}] Schleswig-Holstein hydrogeology evidence notice:`, e); }
      }

    }

    const samplingBoundary = evidenceReport.parcel?.isOfficialGeometry && evidenceReport.parcel?.geometryPoints?.length >= 3
      ? { type: 'polygon' as const, points: evidenceReport.parcel.geometryPoints }
      : shape;
    const groundSamplingLayout = buildGroundSamplingLayout(lat, lng, areaSize, samplingBoundary);
    stage = 'soilgrids-spatial-variability';
    try {
      const existingSiteSoil = {
        success: evidenceReport.soil?.status !== 'REQUIRES_VERIFICATION',
        sourceName: evidenceReport.soil?.sourceName,
        datasetVersion: evidenceReport.soil?.datasetVersion,
        usdaTextureClass: evidenceReport.soil?.usdaTextureClass,
        topsoilSandPct: evidenceReport.soil?.topsoilSandPct,
        topsoilSiltPct: evidenceReport.soil?.topsoilSiltPct,
        topsoilClayPct: evidenceReport.soil?.topsoilClayPct
      };
      const soilVariability = await sampleSoilGridsVariability(groundSamplingLayout, existingSiteSoil);
      evidenceReport.soil_variability = soilVariability;
      if (soilVariability.validSampleCount > 0) {
        evidenceReport.evidenceRegistry.push({
          id: 'soilgrids-spatial-variability',
          category: 'Pedological spatial context',
          claim: `SoilGrids returned ${soilVariability.validSampleCount} usable model samples across the selected geometry and vicinity.`,
          status: 'MODELLED',
          sourceName: soilVariability.sourceName,
          sourceUrl: evidenceReport.soil?.sourceUrl || 'https://soilgrids.org/',
          datasetDate: new Date().toISOString().slice(0, 10),
          spatialRelationship: `${soilVariability.validSampleCount} valid samples from a maximum of ${soilVariability.sampleCount} deterministic site/parcel/vicinity positions`,
          calculationMethod: 'Deterministic multi-point SoilGrids sampling; descriptive texture and sand/silt/clay ranges only',
          confidence: 'Medium',
          limitation: soilVariability.limitation,
          value: soilVariability
        });
      }
    } catch (e) { console.warn(`[${diagnosticId}] SoilGrids spatial variability notice:`, e); }
    let pgiSiteEvidence: any[] = [];
    let ukSiteEvidence: any[] = [];
    let ukCadastre: any = null;
    let scotlandCadastre: any = null;
    let northernIrelandLandRegistryEvidence: any[] = [];
    let franceSiteEvidence: any[] = [];
    let slovakiaGroundEvidence: any[] = [];
    let czechiaGroundEvidence: any[] = [];
    let norwayGroundEvidence: any[] = [];
    let swedenGroundEvidence: any[] = [];
    let denmarkGroundEvidence: any[] = [];
    let irelandNationalEvidence: any[] = [];
    let luxembourgNationalEvidence: any[] = [];
    let belgiumNationalEvidence: any[] = [];
    let switzerlandNationalEvidence: any[] = [];
    let maltaNationalEvidence: any[] = [];
    let croatiaNationalEvidence: any[] = [];
    let austriaGroundEvidence: any[] = [];
    let finlandNationalEvidence: any[] = [];
    let portugalNationalEvidence: any[] = [];
    let portugalLisbonUrbanEvidence: any[] = [];
    let estoniaNationalEvidence: any[] = [];
    let estoniaUrbanEvidence: any[] = [];
    let latviaNationalEvidence: any[] = [];
    let europeValuationEvidence: any = null;
    if (!countryLocationMismatch && countryCode === 'PL' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes)) {
      stage = 'pgi-site-evidence'; try { pgiSiteEvidence = await queryPolandSiteEvidence(lat, lng, fetch, groundSamplingLayout); } catch (e) { console.warn(`[${diagnosticId}] PIG site evidence notice:`, e); }
      if (support.capabilities.nationalHydrogeology) {
        stage = 'pgi-hydro-hazards'; try { pgiSiteEvidence.push(...await queryPolandHydroAndHazards(lat, lng, 5)); } catch (e) { console.warn(`[${diagnosticId}] PIG hydro/hazard evidence notice:`, e); }
      }
      stage = 'pgi-report-enrichment'; if (pgiSiteEvidence.length) evidenceReport.evidenceRegistry.push(...pgiSiteEvidence); enrichGeologyFromPgi(evidenceReport, pgiSiteEvidence);
    } else if (!countryLocationMismatch && countryCode === 'GB' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes || support.capabilities.nationalHydrogeology)) {
      if (ukJurisdiction === 'SCOTLAND') {
        stage = 'scotland-cadastre';
        try {
          scotlandCadastre = await queryScotlandCadastre(lat, lng);
          if (scotlandCadastre?.evidence?.length) evidenceReport.evidenceRegistry.push(...scotlandCadastre.evidence);
          evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
          evidenceReport.dataSourcesCited.push({
            name: scotlandCadastre.sourceName,
            organization: 'Registers of Scotland',
            url: scotlandCadastre.sourceUrl,
            type: 'Official Land Register Mapping',
            status: scotlandCadastre.success ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
          });
          if (scotlandCadastre.success && evidenceReport.evidenceScore?.breakdown?.cadastreAndGeometry) {
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = Math.max(18, Number(evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score) || 0);
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.rationale = 'Registers of Scotland INSPIRE returned a cadastral parcel at the selected coordinate. The open parcel is treated as indicative cadastral map evidence, not as a complete legal statement of title rights.';
          }
        } catch (e) { console.warn(`[${diagnosticId}] Scotland cadastral evidence notice:`, e); }
      } else if (ukJurisdiction === 'NORTHERN_IRELAND') {
        stage = 'northern-ireland-land-registry';
        northernIrelandLandRegistryEvidence = getNorthernIrelandLandRegistryEvidence();
        evidenceReport.evidenceRegistry.push(...northernIrelandLandRegistryEvidence);
        evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
        evidenceReport.dataSourcesCited.push({
          name: 'Northern Ireland Land Registry / Land & Property Services',
          organization: 'Department of Finance Northern Ireland',
          url: 'https://www.finance-ni.gov.uk/articles/land-registry-map',
          type: 'Official Land Registry',
          status: 'REQUIRES_VERIFICATION'
        });
      } else {
        stage = 'uk-cadastre';
        try {
          ukCadastre = await queryUKCadastre(lat, lng, municipality);
          if (ukCadastre?.evidence?.length) evidenceReport.evidenceRegistry.push(...ukCadastre.evidence);
          if (ukCadastre?.success && ukCadastre.parcel) {
            evidenceReport.parcel = {
              ...evidenceReport.parcel,
              status: 'VERIFIED',
              parcelId: ukCadastre.parcel.parcelId,
              countryCode: 'GB',
              geometryPoints: ukCadastre.parcel.geometryPoints,
              isOfficialGeometry: false,
              areaCalculatedM2: evidenceReport.parcel?.areaCalculatedM2 || areaSize,
              cadastralSource: ukCadastre.sourceName,
              inspireMappedAreaM2: ukCadastre.parcel.mappedAreaM2,
              datasetDate: ukCadastre.datasetDate,
              limitation: 'HM Land Registry INSPIRE polygons show the indicative position and extent of registered property. They do not establish the legal extent of a registered title; that requires the individual title plan.'
            };
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = Math.max(18, Number(evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score) || 0);
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.rationale = 'HM Land Registry INSPIRE returned a registered-property polygon containing the selected coordinate. The polygon is indicative and is not a legal title boundary; its mapped area is not used as the valuation area.';
            evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Official National Cadastre') : [];
            evidenceReport.dataSourcesCited.push({ name: ukCadastre.sourceName, organization: 'HM Land Registry', url: ukCadastre.sourceUrl, type: 'Official National Cadastre', status: 'VERIFIED' });
          }
        } catch (e) { console.warn(`[${diagnosticId}] UK cadastral evidence notice:`, e); }
      }
      stage = 'uk-site-evidence'; try { ukSiteEvidence = await queryUKSiteEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] UK national evidence notice:`, e); }
      stage = 'uk-groundwater-evidence';
      try {
        const ukGroundwaterEvidence = await queryUKGroundwater(lat, lng, stateName, fetch);
        if (ukGroundwaterEvidence.length) evidenceReport.evidenceRegistry.push(...ukGroundwaterEvidence);
        enrichUKGroundwater(evidenceReport, ukGroundwaterEvidence);
        const verifiedGroundwater = ukGroundwaterEvidence.some((item: any) => ['gb-ea-groundwater-level', 'gb-sepa-groundwater-level'].includes(item.id) && item.status === 'VERIFIED');
        evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
        if (verifiedGroundwater && !evidenceReport.dataSourcesCited.some((source: any) => /Environment Agency|SEPA/.test(String(source?.name || '')) && /groundwater/i.test(String(source?.name || '')))) {
          const observed = ukGroundwaterEvidence.find((item: any) => ['gb-ea-groundwater-level', 'gb-sepa-groundwater-level'].includes(item.id));
          evidenceReport.dataSourcesCited.push({
            name: observed?.sourceName || 'UK groundwater monitoring',
            organization: observed?.id === 'gb-sepa-groundwater-level' ? 'Scottish Environment Protection Agency (SEPA)' : 'Environment Agency',
            url: observed?.sourceUrl || 'https://www.bgs.ac.uk/groundwater/data/groundwater-levels/national-groundwater-level-archive/',
            type: 'Hydrological Registry',
            status: 'VERIFIED'
          });
        }
      } catch (e) { console.warn(`[${diagnosticId}] UK groundwater evidence notice:`, e); }
      stage = 'uk-report-enrichment'; if (ukSiteEvidence.length) evidenceReport.evidenceRegistry.push(...ukSiteEvidence);
      try { enrichGeologyFromBgs(evidenceReport, ukSiteEvidence); } catch (e) { console.warn(`[${diagnosticId}] BGS geology enrichment notice:`, e); }
      evidenceReport.verificationChecklist = getUKVerificationChecklist(municipality, stateName);
    } else if (!countryLocationMismatch && countryCode === 'AT' && support.capabilities.nationalGeology) {
      stage = 'austria-ground-evidence';
      try { austriaGroundEvidence = (await queryAustriaGroundEvidence(lat, lng)).evidence; } catch (e) { console.warn(`[${diagnosticId}] GeoSphere Austria evidence notice:`, e); }
      stage = 'austria-report-enrichment';
      if (austriaGroundEvidence.length) evidenceReport.evidenceRegistry.push(...austriaGroundEvidence);
      const verifiedGround = austriaGroundEvidence.some((item: any) => item.id === 'at-geosphere-geology-site' && item.status === 'VERIFIED');
      if (verifiedGround && evidenceReport.evidenceScore?.breakdown?.geologyAndGroundwater) {
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(16, Number(evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.rationale = 'GeoSphere Austria 1:50,000 geological mapping returned verified regional geology at the selected coordinate. It is credited as screening evidence without inferring parcel-scale stratigraphy or engineering parameters.';
      }
      evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.organization !== 'GeoSphere Austria') : [];
      evidenceReport.dataSourcesCited.push({
        name: 'GeoSphere Austria — INSPIRE Geological Units 1:50,000',
        organization: 'GeoSphere Austria',
        url: 'https://gis.geologie.ac.at/maps.html',
        type: 'Geological Survey',
        status: verifiedGround ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
      });
    } else if (!countryLocationMismatch && countryCode === 'PT' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes || support.capabilities.nationalHydrogeology)) {
      stage = 'portugal-national-evidence';
      try { portugalNationalEvidence = await queryPortugalNationalEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] LNEG Portugal evidence notice:`, e); }
      stage = 'portugal-report-enrichment';
      if (portugalNationalEvidence.length) evidenceReport.evidenceRegistry.push(...portugalNationalEvidence);
      enrichPortugalNationalEvidence(evidenceReport, portugalNationalEvidence);
      const verifiedGeology = portugalNationalEvidence.some((item: any) => ['pt-lneg-geology-200k', 'pt-lneg-geology-1m'].includes(item.id) && item.status === 'VERIFIED');
      const verifiedHydro = portugalNationalEvidence.some((item: any) => item.id === 'pt-lneg-aquifer-system' && item.status === 'VERIFIED');
      if (verifiedGeology && evidenceReport.evidenceScore?.breakdown?.geologyAndGroundwater) {
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(18, Number(evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.rationale = 'LNEG national geological mapping returned a mapped unit at the selected coordinate. This is screening evidence and does not establish parcel-scale stratigraphy or engineering parameters.';
      }
      if (verifiedHydro && evidenceReport.evidenceScore?.breakdown?.geologyAndGroundwater) {
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(18, Number(evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
      }
      evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.organization !== 'Laboratório Nacional de Energia e Geologia (LNEG)') : [];
      evidenceReport.dataSourcesCited.push({ name: 'LNEG — national geology, Sondabase and hydrogeological resources', organization: 'Laboratório Nacional de Energia e Geologia (LNEG)', url: 'https://geoportal.lneg.pt/', type: 'Geological Survey', status: (verifiedGeology || verifiedHydro) ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
      stage = 'lisbon-urban-geology';
      try {
        const lisbonUrban = await queryLisbonUrbanGeology(lat, lng);
        portugalLisbonUrbanEvidence = lisbonUrban.evidence;
      } catch (e) {
        console.warn(`[${diagnosticId}] Lisbon urban geology notice:`, e);
      }
      stage = 'lisbon-urban-report-enrichment';
      if (portugalLisbonUrbanEvidence.length) evidenceReport.evidenceRegistry.push(...portugalLisbonUrbanEvidence);
      enrichLisbonUrbanEvidence(evidenceReport, portugalLisbonUrbanEvidence);
      const verifiedLisbonUrban = portugalLisbonUrbanEvidence.some((item: any) => item.status === 'VERIFIED');
      const verifiedLisbonGeology = portugalLisbonUrbanEvidence.some((item: any) => item.id === 'pt-lisbon-geology-10k' && item.status === 'VERIFIED');
      if (verifiedLisbonGeology && evidenceReport.evidenceScore?.breakdown?.geologyAndGroundwater) {
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(19, Number(evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.rationale = 'Lisbon municipal 1:10,000 geology and urban geotechnical mapping returned verified city-scale context at the selected coordinate. This is higher-resolution screening evidence and does not establish parcel-scale engineering parameters.';
      }
      if (verifiedLisbonUrban) {
        evidenceReport.dataSourcesCited.push({ name: 'Câmara Municipal de Lisboa — urban geology, geotechnics, EC8 and hydrogeology', organization: 'Câmara Municipal de Lisboa', url: 'https://sigservices.cm-lisboa.pt/arcgis/rest/services/APP_Resist/App_Resist_Layers_Resist/MapServer', type: 'Urban Geotechnical Survey', status: 'VERIFIED' });
      }
    } else if (!countryLocationMismatch && countryCode === 'FI' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes)) {
      stage = 'finland-national-evidence';
      try { finlandNationalEvidence = (await queryFinlandNationalEvidence(lat, lng, municipality)).evidence; } catch (e) { console.warn(`[${diagnosticId}] GTK Finland evidence notice:`, e); }
      stage = 'finland-report-enrichment';
      if (finlandNationalEvidence.length) evidenceReport.evidenceRegistry.push(...finlandNationalEvidence);
      const verifiedGround = finlandNationalEvidence.some((item: any) => item.status === 'VERIFIED' && ['fi-gtk-bedrock', 'fi-gtk-soil'].includes(item.id));
      if (verifiedGround && evidenceReport.evidenceScore?.breakdown?.geologyAndGroundwater) {
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(18, Number(evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.rationale = 'GTK Finland returned verified national mapped bedrock and/or detailed soil context at the selected coordinate. These sources are credited as screening evidence without inferring parcel-scale stratigraphy or engineering parameters.';
      }
      if (finlandNationalEvidence.some((item: any) => item.id === 'fi-gtk-acid-sulphate-soils' && item.status === 'VERIFIED') && evidenceReport.evidenceScore?.breakdown?.environmentalAndFlood) {
        evidenceReport.evidenceScore.breakdown.environmentalAndFlood.score = Math.max(6, Number(evidenceReport.evidenceScore.breakdown.environmentalAndFlood.score) || 0);
        evidenceReport.evidenceScore.breakdown.environmentalAndFlood.rationale = 'GTK acid sulphate soil mapping returned a mapped screening overlap at the selected coordinate. This is not a site-specific soil chemistry or excavation assessment.';
      }
      evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.organization !== 'Geological Survey of Finland (GTK)') : [];
      evidenceReport.dataSourcesCited.push({ name: 'Geological Survey of Finland (GTK) — bedrock / soil / ground investigations', organization: 'Geological Survey of Finland (GTK)', url: 'https://www.gtk.fi/en/services/data-sets-and-online-services-geo-fi/interface-services/', type: 'Geological Survey', status: verifiedGround ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
    } else if (!countryLocationMismatch && countryCode === 'EE' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes || support.capabilities.nationalHydrogeology)) {
      stage = 'estonia-national-evidence';
      try { estoniaNationalEvidence = (await queryEstoniaNationalEvidence(lat, lng)).evidence; } catch (e) { console.warn(`[${diagnosticId}] Estonian Geological Survey evidence notice:`, e); }
      stage = 'estonia-report-enrichment';
      if (estoniaNationalEvidence.length) evidenceReport.evidenceRegistry.push(...estoniaNationalEvidence);
      applyEstoniaNationalEvidenceToReport(evidenceReport, estoniaNationalEvidence);
      const verifiedGround = estoniaNationalEvidence.some((item: any) => item.status === 'VERIFIED' && ['ee-egt-superficial-geology', 'ee-egt-bedrock-exposure'].includes(item.id));
      const verifiedHydro = estoniaNationalEvidence.some((item: any) => item.status === 'VERIFIED' && ['ee-egt-hydrogeology', 'ee-egt-groundwater-vulnerability'].includes(item.id));
      if ((verifiedGround || verifiedHydro) && evidenceReport.evidenceScore?.breakdown?.geologyAndGroundwater) {
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(18, Number(evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.rationale = 'Estonian Geological Survey mapping returned verified national geological and/or hydrogeological context at the selected coordinate. The evidence is screening context and does not establish parcel-scale stratigraphy or engineering parameters.';
      }
      evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.organization !== 'Estonian Geological Survey (EGT)') : [];
      evidenceReport.dataSourcesCited.push({ name: 'Estonian Geological Survey — 1:50,000 geology, hydrogeology and boreholes', organization: 'Estonian Geological Survey (EGT)', url: 'https://www.egt.ee/en/geoportal', type: 'Geological Survey', status: (verifiedGround || verifiedHydro) ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
      stage = 'estonia-urban-geology';
      try { estoniaUrbanEvidence = (await queryEstoniaUrbanGeology(lat, lng)).evidence; } catch (e) { console.warn(`[${diagnosticId}] Estonia urban geology notice:`, e); }
      stage = 'estonia-urban-report-enrichment';
      if (estoniaUrbanEvidence.length) evidenceReport.evidenceRegistry.push(...estoniaUrbanEvidence);
      enrichEstoniaUrbanEvidence(evidenceReport, estoniaUrbanEvidence);
      const verifiedUrban = estoniaUrbanEvidence.some((item: any) => item.status === 'VERIFIED');
      if (verifiedUrban) {
        evidenceReport.dataSourcesCited.push({ name: 'Estonian official building-geology survey and local specialist layers', organization: 'Maa- ja Ruumiamet / Estonian Geological Survey (EGT)', url: 'https://geoportaal.maaamet.ee/index.php?lang_id=1&page_id=417', type: 'Urban Geological / Ground Investigation Survey', status: 'VERIFIED' });
      }
    } else if (!countryLocationMismatch && countryCode === 'LV' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes || support.capabilities.nationalHydrogeology || support.capabilities.nationalFlood)) {
      stage = 'latvia-national-evidence';
      try { latviaNationalEvidence = await queryLatviaNationalEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] Latvian national evidence notice:`, e); }
      stage = 'latvia-report-enrichment';
      if (latviaNationalEvidence.length) evidenceReport.evidenceRegistry.push(...latviaNationalEvidence);
      applyLatviaNationalEvidenceToReport(evidenceReport, latviaNationalEvidence);
      const verifiedGround = latviaNationalEvidence.some((item: any) => item.id === 'lv-lvgmc-quaternary-geology' && item.status === 'VERIFIED');
      const verifiedHydro = latviaNationalEvidence.some((item: any) => ['lv-lvgmc-aquifer', 'lv-lvgmc-groundwater-body'].includes(item.id) && item.status === 'VERIFIED');
      if ((verifiedGround || verifiedHydro) && evidenceReport.evidenceScore?.breakdown?.geologyAndGroundwater) {
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(18, Number(evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.rationale = 'LVĢMC national geological and/or hydrogeological mapping returned verified context at the selected coordinate. This is screening evidence and does not establish parcel-scale stratigraphy or engineering parameters.';
      }
      if (latviaNationalEvidence.some((item: any) => item.id === 'lv-geolatvija-flood' && item.status === 'VERIFIED') && evidenceReport.evidenceScore?.breakdown?.environmentalAndFlood) {
        evidenceReport.evidenceScore.breakdown.environmentalAndFlood.score = Math.max(8, Number(evidenceReport.evidenceScore.breakdown.environmentalAndFlood.score) || 0);
        evidenceReport.evidenceScore.breakdown.environmentalAndFlood.rationale = 'Latvian national flood-risk mapping returned a verified flood-risk management polygon containing the selected coordinate. This does not provide parcel-specific flood depth or return-period design values.';
      }
      evidenceReport.dataSourcesCited.push({ name: 'LVĢMC / ĢEOLatvija — geology, hydrogeology and flood-risk services', organization: 'Latvian Environment, Geology and Meteorology Centre (LVĢMC)', url: 'https://geolatvija.lv/', type: 'National Geological and Flood Services', status: (verifiedGround || verifiedHydro || latviaNationalEvidence.some((item: any) => item.id === 'lv-geolatvija-flood' && item.status === 'VERIFIED')) ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
    } else if (!countryLocationMismatch && countryCode === 'FR' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes)) {
      stage = 'france-site-evidence'; try { franceSiteEvidence = await queryFranceSiteEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] BRGM France evidence notice:`, e); }
      stage = 'france-report-enrichment'; if (franceSiteEvidence.length) evidenceReport.evidenceRegistry.push(...franceSiteEvidence);
      try { enrichGeologyFromBrgm(evidenceReport, franceSiteEvidence); } catch (e) { console.warn(`[${diagnosticId}] BRGM geology enrichment notice:`, e); }
      stage = 'france-groundwater';
      try {
        const franceGroundwater = await queryFranceGroundwater(lat, lng, fetch);
        if (franceGroundwater.length) evidenceReport.evidenceRegistry.push(...franceGroundwater);
        enrichFranceGroundwater(evidenceReport, franceGroundwater);
        const verifiedGroundwater = franceGroundwater.some((item: any) => item.id === 'fr-hubeau-groundwater-level' && item.status === 'VERIFIED');
        evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited : [];
        if (!evidenceReport.dataSourcesCited.some((source: any) => source?.name === 'Hub’Eau / ADES — Piézométrie')) {
          evidenceReport.dataSourcesCited.push({
            name: 'Hub’Eau / ADES — Piézométrie',
            organization: 'Office Français de la Biodiversité / BRGM / Eaufrance',
            url: 'https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/stations',
            type: 'Hydrological Registry',
            status: verifiedGroundwater ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
          });
        }
      } catch (e) { console.warn(`[${diagnosticId}] France groundwater evidence notice:`, e); }
    } else if (!countryLocationMismatch && countryCode === 'HR' && support.capabilities.nationalGeology) {
      stage = 'croatia-national-geology';
      try { croatiaNationalEvidence = await queryCroatiaNationalEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] HGI Croatia geology notice:`, e); }
      stage = 'croatia-report-enrichment';
      if (croatiaNationalEvidence.length) evidenceReport.evidenceRegistry.push(...croatiaNationalEvidence);
      try { enrichCroatiaNationalEvidence(evidenceReport, croatiaNationalEvidence); } catch (e) { console.warn(`[${diagnosticId}] HGI Croatia geology enrichment notice:`, e); }
      const verifiedGround = croatiaNationalEvidence.some((item: any) => item.id === 'hr-hgi-geology-site' && item.status === 'VERIFIED');
      if (verifiedGround && evidenceReport.evidenceScore?.breakdown?.geologyAndGroundwater) {
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(18, Number(evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.rationale = 'Croatian Geological Survey INSPIRE geology returned verified mapped regional context at the selected coordinate. It is credited as screening evidence without inferring parcel engineering parameters.';
      }
      evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Geological Survey') : [];
      evidenceReport.dataSourcesCited.push({ name: 'Croatian Geological Survey — INSPIRE Geological Map 1:300,000', organization: 'Croatian Geological Survey (Hrvatski geološki institut)', url: 'https://transformiraj.nipp.hr/ows/services/org.2.abf7ddc6-7578-4070-a9db-c291a42e55c6_wfs', type: 'Geological Survey', status: verifiedGround ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
    } else if (!countryLocationMismatch && countryCode === 'SK' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes || support.capabilities.nationalHydrogeology)) {
      stage = 'slovakia-ground-evidence';
      try { slovakiaGroundEvidence = await querySlovakiaGroundEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] ŠGÚDŠ Slovakia evidence notice:`, e); }
      stage = 'slovakia-report-enrichment';
      if (slovakiaGroundEvidence.length) evidenceReport.evidenceRegistry.push(...slovakiaGroundEvidence);
      try { enrichSlovakiaGroundEvidence(evidenceReport, slovakiaGroundEvidence); } catch (e) { console.warn(`[${diagnosticId}] ŠGÚDŠ Slovakia enrichment notice:`, e); }
    } else if (!countryLocationMismatch && countryCode === 'CZ' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes || support.capabilities.nationalHydrogeology || support.capabilities.nationalRadon || support.capabilities.nationalMining)) {
      stage = 'czechia-ground-evidence';
      try { czechiaGroundEvidence = await queryCzechiaGroundEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] ČGS Czechia evidence notice:`, e); }
      stage = 'czechia-report-enrichment';
      if (czechiaGroundEvidence.length) evidenceReport.evidenceRegistry.push(...czechiaGroundEvidence);
      try { enrichCzechiaGroundEvidence(evidenceReport, czechiaGroundEvidence); } catch (e) { console.warn(`[${diagnosticId}] ČGS Czechia enrichment notice:`, e); }
    } else if (!countryLocationMismatch && countryCode === 'DK' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes || support.capabilities.nationalHydrogeology || support.capabilities.nationalPlanning)) {
      stage = 'denmark-national-evidence';
      try { denmarkGroundEvidence = await queryDenmarkGroundEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] GEUS/Plandata Denmark evidence notice:`, e); }
      stage = 'denmark-report-enrichment';
      if (denmarkGroundEvidence.length) evidenceReport.evidenceRegistry.push(...denmarkGroundEvidence);
      try { enrichDenmarkGroundEvidence(evidenceReport, denmarkGroundEvidence); } catch (e) { console.warn(`[${diagnosticId}] Denmark evidence enrichment notice:`, e); }
      const verifiedGround = denmarkGroundEvidence.some((item: any) => item.status === 'VERIFIED' && ['dk-jupiter-boreholes', 'dk-jupiter-groundwater'].includes(item.id));
      if (verifiedGround && evidenceReport.evidenceScore?.breakdown?.geologyAndGroundwater) {
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(14, Number(evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.rationale = 'GEUS/Jupiter returned verified nearby borehole and/or groundwater-observation context. These observations are credited as screening evidence without treating them as parcel geology, parcel groundwater or design parameters.';
      }
      evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Geological Survey') : [];
      evidenceReport.dataSourcesCited.push({ name: 'GEUS — Jupiter boreholes / groundwater observations', organization: 'De Nationale Geologiske Undersøgelser for Danmark og Grønland (GEUS)', url: 'https://data.geus.dk/geusmap/', type: 'Geological Survey', status: verifiedGround ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
    } else if (!countryLocationMismatch && countryCode === 'IE' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes || support.capabilities.nationalHydrogeology || support.capabilities.nationalRadon)) {
      stage = 'ireland-national-evidence';
      try { irelandNationalEvidence = await queryIrelandNationalEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] Ireland national evidence notice:`, e); }
      stage = 'ireland-report-enrichment';
      if (irelandNationalEvidence.length) evidenceReport.evidenceRegistry.push(...irelandNationalEvidence);
      try { enrichIrelandNationalEvidence(evidenceReport, irelandNationalEvidence); } catch (e) { console.warn(`[${diagnosticId}] Ireland evidence enrichment notice:`, e); }
      const verifiedGround = irelandNationalEvidence.some((item: any) => item.status === 'VERIFIED' && ['ie-gsi-bedrock', 'ie-gsi-quaternary', 'ie-gsi-aquifer', 'ie-gsi-boreholes'].includes(item.id));
      if (verifiedGround && evidenceReport.evidenceScore?.breakdown?.geologyAndGroundwater) {
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(18, Number(evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.rationale = 'Geological Survey Ireland returned national bedrock, superficial-geology, hydrogeological and/or verified-borehole evidence. These are credited as screening evidence without inferring parcel design parameters.';
      }
      evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Geological Survey') : [];
      evidenceReport.dataSourcesCited.push({ name: 'Geological Survey Ireland — Bedrock / Quaternary / Groundwater / Boreholes', organization: 'Geological Survey Ireland', url: 'https://www.gsi.ie/en-ie/data-and-maps/', type: 'Geological Survey', status: verifiedGround ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
    } else if (!countryLocationMismatch && countryCode === 'LU' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes || support.capabilities.nationalHydrogeology || support.capabilities.nationalFlood || support.capabilities.nationalPlanning)) {
      stage = 'luxembourg-national-evidence';
      try { luxembourgNationalEvidence = await queryLuxembourgNationalEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] Luxembourg national evidence notice:`, e); }
      stage = 'luxembourg-report-enrichment';
      if (luxembourgNationalEvidence.length) evidenceReport.evidenceRegistry.push(...luxembourgNationalEvidence);
      try { enrichLuxembourgNationalEvidence(evidenceReport, luxembourgNationalEvidence); } catch (e) { console.warn(`[${diagnosticId}] Luxembourg evidence enrichment notice:`, e); }
      const verifiedGround = luxembourgNationalEvidence.some((item: any) => item.status === 'VERIFIED' && ['lu-geo-geology', 'lu-geo-aquifer', 'lu-geo-groundwater-body', 'lu-geo-boreholes'].includes(item.id));
      if (verifiedGround && evidenceReport.evidenceScore?.breakdown?.geologyAndGroundwater) {
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(18, Number(evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.rationale = 'Luxembourg Geoportail returned official national geology, hydrogeology and/or borehole context. These sources are credited as screening evidence without inferring parcel engineering parameters.';
      }
      const pagVerified = luxembourgNationalEvidence.some((item: any) => item.id === 'lu-pag-zoning' && item.status === 'VERIFIED');
      if (pagVerified && evidenceReport.evidenceScore?.breakdown?.planningAndMarket) {
        evidenceReport.evidenceScore.breakdown.planningAndMarket.score = Math.max(4, Number(evidenceReport.evidenceScore.breakdown.planningAndMarket.score) || 0);
        evidenceReport.evidenceScore.breakdown.planningAndMarket.rationale = 'The national PAG layer returned the official zoning code at the selected coordinate. Detailed permitted use, density, setbacks and project consent still require commune/PAP verification.';
      }
      const floodVerified = luxembourgNationalEvidence.some((item: any) => item.id === 'lu-flood-screen' && item.status === 'VERIFIED');
      if (floodVerified && evidenceReport.evidenceScore?.breakdown?.environmentalAndFlood) {
        evidenceReport.evidenceScore.breakdown.environmentalAndFlood.score = Math.max(10, Number(evidenceReport.evidenceScore.breakdown.environmentalAndFlood.score) || 0);
        evidenceReport.evidenceScore.breakdown.environmentalAndFlood.rationale = 'Official Luxembourg HQ100 and extreme-flood layers responded for a direct-overlap screen at the selected coordinate; this does not replace full-parcel or hydraulic review.';
      }
      evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Geological Survey') : [];
      evidenceReport.dataSourcesCited.push({ name: 'Geoportail Luxembourg — geology / groundwater / boreholes / PAG / flood zones', organization: 'Grand Duchy of Luxembourg public geodata authorities', url: 'https://map.geoportail.lu/', type: 'Geological Survey', status: verifiedGround ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
    } else if (!countryLocationMismatch && countryCode === 'BE' && support.capabilities.nationalGeology) {
      stage = 'belgium-national-evidence';
      try { belgiumNationalEvidence = await queryBelgiumNationalEvidence(lat, lng, { regionCode: resolvedRegionCode, state: stateName, county: countyName }); } catch (e) { console.warn(`[${diagnosticId}] Belgium regional evidence notice:`, e); }
      stage = 'belgium-report-enrichment';
      if (belgiumNationalEvidence.length) evidenceReport.evidenceRegistry.push(...belgiumNationalEvidence);
      try { enrichBelgiumNationalEvidence(evidenceReport, belgiumNationalEvidence); } catch (e) { console.warn(`[${diagnosticId}] Belgium evidence enrichment notice:`, e); }
      const verifiedGround = belgiumNationalEvidence.some((item: any) => item.status === 'VERIFIED' && ['be-fl-geology', 'be-wa-geology'].includes(item.id));
      if (verifiedGround && evidenceReport.evidenceScore?.breakdown?.geologyAndGroundwater) {
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(16, Number(evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.rationale = 'The competent Belgian regional geological service returned official mapped geology at the selected coordinate. It is credited as screening evidence without inferring parcel engineering parameters.';
      }
      const regionalSource = belgiumNationalEvidence.find((item: any) => item.status === 'VERIFIED' && ['be-fl-geology', 'be-wa-geology'].includes(item.id));
      evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Geological Survey') : [];
      evidenceReport.dataSourcesCited.push({ name: regionalSource?.sourceName || 'Belgian regional geological authority', organization: regionalSource?.sourceName || 'Belgian regional geological authority', url: regionalSource?.sourceUrl || cProfile.geologyPortalUrl, type: 'Geological Survey', status: verifiedGround ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
    } else if (!countryLocationMismatch && countryCode === 'CH' && (support.capabilities.nationalGeology || support.capabilities.nationalHydrogeology)) {
      stage = 'switzerland-national-evidence';
      try { switzerlandNationalEvidence = await querySwitzerlandNationalEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] Switzerland national evidence notice:`, e); }
      stage = 'switzerland-report-enrichment';
      if (switzerlandNationalEvidence.length) evidenceReport.evidenceRegistry.push(...switzerlandNationalEvidence);
      try { enrichSwitzerlandNationalEvidence(evidenceReport, switzerlandNationalEvidence); } catch (e) { console.warn(`[${diagnosticId}] Switzerland evidence enrichment notice:`, e); }

      const verifiedGround = switzerlandNationalEvidence.some((item: any) => item.status === 'VERIFIED' && ['ch-geocover-bedrock','ch-geocover-unconsolidated','ch-hydrogeology-100k','ch-groundwater-body'].includes(item.id));
      if (verifiedGround && evidenceReport.evidenceScore?.breakdown?.geologyAndGroundwater) {
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(18, Number(evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.rationale = 'Swiss federal geology and/or hydrogeology returned official mapped context at the selected coordinate. These sources are credited as screening evidence without inferring parcel stratigraphy, groundwater depth or design parameters.';
      }
      const environmentalVerified = switzerlandNationalEvidence.some((item: any) => item.status === 'VERIFIED' && item.id === 'ch-kbs-contaminated-sites');
      if (environmentalVerified && evidenceReport.evidenceScore?.breakdown?.environmentalAndFlood) {
        evidenceReport.evidenceScore.breakdown.environmentalAndFlood.score = Math.max(8, Number(evidenceReport.evidenceScore.breakdown.environmentalAndFlood.score) || 0);
        evidenceReport.evidenceScore.breakdown.environmentalAndFlood.rationale = 'The harmonised cantonal contaminated-site register responded for the selected coordinate. This is credited as environmental screening, not as proof of clean ground; Swiss flood-hazard status still requires the competent cantonal/ÖREB source.';
      }
      const buildingZoneVerified = switzerlandNationalEvidence.some((item: any) => item.id === 'ch-building-zone' && item.status === 'VERIFIED');
      if (buildingZoneVerified && evidenceReport.evidenceScore?.breakdown?.planningAndMarket) {
        evidenceReport.evidenceScore.breakdown.planningAndMarket.score = Math.max(4, Number(evidenceReport.evidenceScore.breakdown.planningAndMarket.score) || 0);
        evidenceReport.evidenceScore.breakdown.planningAndMarket.rationale = 'ARE harmonised building-zone context was returned for the site. Binding buildability, use, density and restrictions still require the current cantonal/communal planning record and ÖREB extract; no land-market valuation is inferred.';
      }
      evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Geological Survey') : [];
      evidenceReport.dataSourcesCited.push({ name: 'swisstopo swissGEOCOVER2D / BAFU federal geodata', organization: 'swisstopo / Bundesamt für Umwelt (BAFU)', url: 'https://map.geo.admin.ch/', type: 'Geological Survey', status: verifiedGround ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
    } else if (!countryLocationMismatch && countryCode === 'MT' && (support.capabilities.nationalGeology || support.capabilities.nationalHydrogeology || support.capabilities.nationalFlood)) {
      stage = 'malta-national-evidence';
      try { maltaNationalEvidence = await queryMaltaNationalEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] Malta national evidence notice:`, e); }
      stage = 'malta-report-enrichment';
      if (maltaNationalEvidence.length) evidenceReport.evidenceRegistry.push(...maltaNationalEvidence);
      try { enrichMaltaNationalEvidence(evidenceReport, maltaNationalEvidence); } catch (e) { console.warn(`[${diagnosticId}] Malta evidence enrichment notice:`, e); }

      const verifiedGround = maltaNationalEvidence.some((item: any) => item.status === 'VERIFIED' && ['mt-geology-bedrock','mt-geology-superficial','mt-geology-artificial','mt-groundwater-body'].includes(item.id));
      if (verifiedGround && evidenceReport.evidenceScore?.breakdown?.geologyAndGroundwater) {
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score = Math.max(18, Number(evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.score) || 0);
        evidenceReport.evidenceScore.breakdown.geologyAndGroundwater.rationale = 'Malta national 1:10,000 geology and/or official groundwater mapping returned site-specific mapped context. These sources are credited as screening evidence without inferring parcel design parameters or groundwater depth.';
      }

      const officialFlood = maltaNationalEvidence.some((item: any) => item.status === 'VERIFIED' && ['mt-flood-hazard','mt-flood-risk'].includes(item.id));
      const environmental = maltaNationalEvidence.some((item: any) => item.status === 'VERIFIED' && ['mt-groundwater-protection','mt-natura2000'].includes(item.id));
      if ((officialFlood || environmental) && evidenceReport.evidenceScore?.breakdown?.environmentalAndFlood) {
        evidenceReport.evidenceScore.breakdown.environmentalAndFlood.score = Math.max(10, Number(evidenceReport.evidenceScore.breakdown.environmentalAndFlood.score) || 0);
        evidenceReport.evidenceScore.breakdown.environmentalAndFlood.rationale = 'Official Malta Floods Directive, groundwater-protection and/or Natura 2000 WFS layers responded for direct centre-point screening. This is not parcel-wide flood, ecological or regulatory clearance.';
      }

      evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => !['Geological Survey','Hydrological Registry'].includes(source?.type)) : [];
      evidenceReport.dataSourcesCited.push({ name: 'Geological Survey of Malta — Geological Map of the Maltese Islands 1:10,000', organization: 'Continental Shelf Department', url: 'https://continentalshelf.gov.mt/geological-survey/geological-map/', type: 'Geological Survey', status: verifiedGround ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
      evidenceReport.dataSourcesCited.push({ name: 'Malta Floods Directive — Flood Hazard / Flood Risk Areas', organization: 'Energy & Water Agency / Planning Authority', url: 'https://portal.data.gov.mt/dataset/flood-hazard-areas', type: 'Hydrological Registry', status: officialFlood ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
    } else if (!countryLocationMismatch && countryCode === 'SE' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes || support.capabilities.nationalHydrogeology)) {
      stage = 'sweden-ground-evidence';
      try { swedenGroundEvidence = await querySwedenGroundEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] SGU Sweden evidence notice:`, e); }
      stage = 'sweden-report-enrichment';
      if (swedenGroundEvidence.length) evidenceReport.evidenceRegistry.push(...swedenGroundEvidence);
      try { enrichSwedenGroundEvidence(evidenceReport, swedenGroundEvidence); } catch (e) { console.warn(`[${diagnosticId}] SGU Sweden enrichment notice:`, e); }
      const verifiedSgu = swedenGroundEvidence.some(item => item.status === 'VERIFIED');
      evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Geological Survey') : [];
      evidenceReport.dataSourcesCited.push({ name: 'SGU OGC API Features — Jordarter / Berggrund / Brunnsarkivet / Grundvattennivåer', organization: 'Sveriges geologiska undersökning (SGU)', url: 'https://api.sgu.se/oppnadata/', type: 'Geological Survey', status: verifiedSgu ? 'VERIFIED' : 'REQUIRES_VERIFICATION' });
    } else if (!countryLocationMismatch && countryCode === 'NO' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes || support.capabilities.nationalRadon)) {
      stage = 'norway-ground-evidence';
      try { norwayGroundEvidence = await queryNorwayGroundEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] NGU Norway evidence notice:`, e); }
      stage = 'norway-report-enrichment';
      if (norwayGroundEvidence.length) evidenceReport.evidenceRegistry.push(...norwayGroundEvidence);
      try { enrichNorwayGroundEvidence(evidenceReport, norwayGroundEvidence); } catch (e) { console.warn(`[${diagnosticId}] NGU Norway enrichment notice:`, e); }
      evidenceReport.dataSourcesCited = Array.isArray(evidenceReport.dataSourcesCited) ? evidenceReport.dataSourcesCited.filter((source: any) => source?.type !== 'Geological Survey') : [];
      evidenceReport.dataSourcesCited.push({
        name: 'NGU OGC API Features — Løsmasse / NADAG / marin leire / radon',
        organization: 'Norges geologiske undersøkelse (NGU)',
        url: 'https://geo.ngu.no/api/features/',
        type: 'Geological Survey',
        status: norwayGroundEvidence.some((item: any) => item.status === 'VERIFIED') ? 'VERIFIED' : 'REQUIRES_VERIFICATION'
      });
    }

    if (locationCountryConfirmed && support.capabilities.nationalValuation && ['AT', 'ES', 'FI', 'IE', 'LU'].includes(countryCode)) {
      stage = 'europe-land-valuation';
      try {
        const luxembourgPagCategory = countryCode === 'LU'
          ? String(luxembourgNationalEvidence.find((item: any) => item.id === 'lu-pag-zoning' && item.status === 'VERIFIED')?.value?.categories?.[0] || '')
          : undefined;
        europeValuationEvidence = await queryEuropeanLandValuationEvidence(countryCode, { municipality, county: countyName, state: stateName, pagCategory: luxembourgPagCategory });
        if (europeValuationEvidence) evidenceReport.evidenceRegistry.push(europeValuationEvidence);
        enrichEuropeanLandValuation(evidenceReport, europeValuationEvidence);
      } catch (e) {
        console.warn(`[${diagnosticId}] ${countryCode} land valuation notice:`, e);
        enrichEuropeanLandValuation(evidenceReport, null);
      }
    }

    if (countryLocationMismatch) {
      evidenceReport.evidenceRegistry.push({ id: `country-location-mismatch-${diagnosticId}`, category: 'Location Validation', claim: `Selected country (${countryCode}) does not match the country resolved from the site coordinates (${resolvedCountryCode}). National integrations for the selected country were not queried.`, status: 'REQUIRES_VERIFICATION', sourceName: 'OpenStreetMap Nominatim reverse geocoding', sourceUrl: 'https://nominatim.openstreetmap.org/', datasetDate: new Date().toISOString().slice(0, 10), spatialRelationship: 'Site-centre reverse geocode', calculationMethod: 'Reverse geocode of the selected site coordinates before national acquisition', confidence: 'High', limitation: 'The selected country is retained for the report, but only cross-border evidence is used until the country/location mismatch is corrected.', value: { selectedCountryCode: countryCode, resolvedCountryCode, reasonCode: 'AUTHORITATIVE_DATA_REQUIRED' } });
    }
    if (countryLocationUnresolved) {
      evidenceReport.evidenceRegistry.push({ id: `country-location-unresolved-${diagnosticId}`, category: 'Location Validation', claim: `The selected country (${countryCode}) could not be independently confirmed from the site coordinates because reverse geocoding returned no country.`, status: 'REQUIRES_VERIFICATION', sourceName: 'OpenStreetMap Nominatim reverse geocoding', sourceUrl: 'https://nominatim.openstreetmap.org/', datasetDate: new Date().toISOString().slice(0, 10), spatialRelationship: 'Site-centre reverse geocode', calculationMethod: 'Reverse geocode of the selected site coordinates before country-dependent valuation', confidence: 'Low', limitation: 'Country-dependent automated valuation is suppressed until the country is confirmed. Coordinate-based global or cross-border screening may still be shown.', value: { selectedCountryCode: countryCode, reasonCode: 'SOURCE_UNAVAILABLE' } });
    }

    stage = 'report-assembly';
    const baseCanonicalReport = createCanonicalReport(evidenceReport, cProfile);
    const siteSpecificCanonicalReport = applySiteSpecificCountryEvidence(baseCanonicalReport, evidenceReport);
    const valuationGuardAreaM2 = typeof evidenceReport.parcel?.officialAreaM2 === 'number' && Number.isFinite(evidenceReport.parcel.officialAreaM2) && evidenceReport.parcel.officialAreaM2 > 0
      ? evidenceReport.parcel.officialAreaM2
      : typeof evidenceReport.parcel?.areaCalculatedM2 === 'number' && Number.isFinite(evidenceReport.parcel.areaCalculatedM2) && evidenceReport.parcel.areaCalculatedM2 > 0
        ? evidenceReport.parcel.areaCalculatedM2
        : areaSize;
    const canonicalReport = applyValuationAreaGuard(siteSpecificCanonicalReport, valuationGuardAreaM2);
    const isSlovakPresentation = countryCode === 'SK' && language === 'sk';
    const isCzechPresentation = countryCode === 'CZ' && language === 'cs';
    const isDanishPresentation = countryCode === 'DK' && language === 'da';
    const isNorwegianPresentation = countryCode === 'NO' && language === 'no';
    const isSwedishPresentation = countryCode === 'SE' && language === 'sv';
    const isHungarianPresentation = countryCode === 'HU' && language === 'hu';
    const isDutchPresentation = language === 'nl';
    const isFrEsFiPresentation = ['fr', 'es', 'fi', 'pt', 'et', 'lv', 'lt'].includes(language);
    const isCroatianPresentation = countryCode === 'HR' && language === 'hr';
    const presentation: any = isCroatianPresentation
      ? renderCroatiaLocalizedReport(canonicalReport)
      : isSlovakPresentation
      ? renderSlovakLocalizedReport(canonicalReport)
      : isCzechPresentation
        ? renderCzechLocalizedReport(canonicalReport)
        : isDanishPresentation
          ? renderDanishLocalizedReport(canonicalReport)
          : isHungarianPresentation
            ? renderHungarianLocalizedReport(canonicalReport)
            : isSwedishPresentation
            ? renderSwedishLocalizedReport(canonicalReport)
            : isNorwegianPresentation
              ? renderNorwegianLocalizedReport(canonicalReport)
              : isDutchPresentation
                ? renderDutchLocalizedReport(canonicalReport)
                : isFrEsFiPresentation
                  ? renderFrEsFiLocalizedReport(canonicalReport, language as 'fr' | 'es' | 'fi' | 'pt' | 'et' | 'lv' | 'lt')
                  : renderLocalizedReport(canonicalReport, language);
    const mvGroundwaterDepth = Number(evidenceReport.geosurvey_context?.groundwater_depth_below_ground_m);
    const mvGroundwaterRisk = evidenceReport.geosurvey_context?.groundwater_excavation_risk_level;
    if (countryCode === 'DE' && Number.isFinite(mvGroundwaterDepth) && presentation.technicalNarrative) {
      presentation.technicalNarrative.groundwater_depth_m = `${mvGroundwaterDepth.toFixed(1)} m`;
      if (mvGroundwaterRisk === 'High' && Array.isArray(presentation.riskMatrix)) {
        const lang = String(language || 'en').toLowerCase().slice(0, 2);
        const groundwaterCategory: Record<string, string> = {
          en: 'Groundwater / excavation water', de: 'Grundwasser / Wasser in der Baugrube', pl: 'Wody gruntowe / woda w wykopach', nl: 'Grondwater / water in bouwputten',
          fr: 'Eaux souterraines / eau dans les fouilles', es: 'Aguas subterráneas / agua en excavaciones', fi: 'Pohjavesi / vesi kaivannoissa', hr: 'Podzemna voda / voda u iskopima',
          cs: 'Podzemní voda / voda ve výkopech', sk: 'Podzemná voda / voda vo výkopoch', da: 'Grundvand / vand i udgravninger', sv: 'Grundvatten / vatten i schakter',
          no: 'Grunnvann / vann i byggegrop', pt: 'Água subterrânea / água nas escavações', et: 'Põhjavesi / vesi kaevetistes', lv: 'Gruntsūdens / ūdens būvbedrē',
          lt: 'Požeminis vanduo / vanduo kasant', uk: 'Підземні води / вода у виїмках', sl: 'Podzemna voda / voda v izkopih', hu: 'Talajvíz / víz a munkagödörben'
        };
        const groundwaterDetail: Record<string, string> = {
          en: 'The calculated groundwater surface is above the modelled ground level, creating a high screening risk of very shallow groundwater and water entering excavations. Wet-weather conditions may make this more significant.',
          de: 'Der berechnete Grundwasserspiegel liegt über dem modellierten Geländeniveau. Das ergibt ein hohes Screening-Risiko für sehr oberflächennahes Grundwasser und Wasserzutritt in Baugruben; bei nasser Witterung kann dies verstärkt werden.',
          pl: 'Obliczony poziom wód gruntowych znajduje się powyżej modelowanej powierzchni terenu. Oznacza to wysokie ryzyko przesiewowe bardzo płytkiego występowania wód i napływu wody do wykopów; po mokrych okresach sytuacja może się nasilić.'
        };
        presentation.riskMatrix.unshift({ category: groundwaterCategory[lang] || groundwaterCategory.en, level: 'High', evidence_level: 'MODELLED', detail: groundwaterDetail[lang] || groundwaterDetail.en });
      }
    }
    if (!isCroatianPresentation && !isSlovakPresentation && !isCzechPresentation && !isDanishPresentation && !isSwedishPresentation && !isNorwegianPresentation && !isHungarianPresentation && !isDutchPresentation && !isFrEsFiPresentation) enrichValuationPresentation(canonicalReport, presentation);
    if (countryCode === 'PT' && portugalLisbonUrbanEvidence.some((item: any) => item.status === 'VERIFIED')) {
      const urban = evidenceReport.geosurvey_context || {};
      const urbanParts = [
        urban.urban_geology_unit_name ? `Lisbon municipal 1:10,000 mapping identifies ${urban.urban_geology_unit_name}.` : '',
        urban.urban_geotechnical_unit ? `The city geotechnical zoning places the site in unit ${urban.urban_geotechnical_unit}.` : '',
        urban.ec8_soil_class ? `The urban EC8 soil map assigns class ${urban.ec8_soil_class}${urban.ec8_smax !== null && urban.ec8_smax !== undefined ? ` (Smax ${urban.ec8_smax})` : ''}.` : '',
        urban.urban_groundwater_depth_class ? `Nearby mapped groundwater observations include a nearest depth class of ${urban.urban_groundwater_depth_class}.` : '',
        urban.urban_alluvium_depth_class ? `Nearby alluvium-depth observations include a nearest class of ${urban.urban_alluvium_depth_class}.` : '',
        urban.urban_fill_depth_class ? `Nearby fill-depth observations include a nearest class of ${urban.urban_fill_depth_class}.` : ''
      ].filter(Boolean).join(' ');
      if (urbanParts) {
        presentation.sections.soil_and_ground.detail = `${presentation.sections.soil_and_ground.detail} Lisbon urban geology adds higher-resolution municipal screening context: ${urbanParts} These mapped classes and nearby observations help identify what should be checked during site investigation; they do not establish parcel-scale engineering parameters.`.trim();
        const existingSource = presentation.sections.soil_and_ground.source_cited;
        presentation.sections.soil_and_ground.source_cited = [...new Set([existingSource, 'Câmara Municipal de Lisboa — urban geology, geotechnics and hydrogeology'].filter((source): source is string => Boolean(source)))].join('; ');
      }
    }
    if (countryCode === 'EE') {
      const urban = evidenceReport.geosurvey_context || {};
      const surveyCount = Number(urban.urban_building_geology_survey_count);
      const nearestSurveyM = Number(urban.urban_building_geology_nearest_distance_m);
      const surveyAsOf = urban.urban_building_geology_as_of;
      const hasSurvey = Number.isFinite(surveyCount) && surveyCount > 0;
      const surveyText = language === 'de'
        ? `Das estnische amtliche Archiv für Baugrunduntersuchungen liefert ${surveyCount >= 100 ? 'mindestens ' : ''}${Number.isFinite(surveyCount) ? surveyCount : 'mehrere'} kartierte Untersuchungsflächen im Umkreis von 5 km; die nächste ausgewählte Untersuchung liegt etwa ${Number.isFinite(nearestSurveyM) ? nearestSurveyM : '—'} m entfernt. Datenstand: ${surveyAsOf || '10.12.2024'}.`
        : language === 'pl'
          ? `Estońskie urzędowe archiwum badań podłoża budowlanego zwraca ${surveyCount >= 100 ? 'co najmniej ' : ''}${Number.isFinite(surveyCount) ? surveyCount : 'kilka'} kartowanych obszarów badań w promieniu 5 km; najbliższe wybrane badanie znajduje się około ${Number.isFinite(nearestSurveyM) ? nearestSurveyM : '—'} m od lokalizacji. Stan danych: ${surveyAsOf || '10.12.2024'}.`
          : `Estonia's official building-geology archive returns ${surveyCount >= 100 ? 'at least ' : ''}${Number.isFinite(surveyCount) ? surveyCount : 'several'} mapped survey areas within 5 km; the nearest selected survey is about ${Number.isFinite(nearestSurveyM) ? nearestSurveyM : '—'} m away. Dataset snapshot: ${surveyAsOf || '2024-12-10'}.`;
      const specialistParts = [
        urban.urban_landslide_dataset_class ? (language === 'de' ? `Die Pärnu-Spezialkarte erfasst den Punkt als ${urban.urban_landslide_dataset_class}.` : language === 'pl' ? `Specjalistyczna mapa Pärnu wskazuje ten punkt jako ${urban.urban_landslide_dataset_class}.` : `The Pärnu specialist layer maps the point as ${urban.urban_landslide_dataset_class}.`) : '',
        urban.urban_landslide_dataset_soil ? (language === 'de' ? `Der zugehörige kartierte Bodenkontext ist ${urban.urban_landslide_dataset_soil}.` : language === 'pl' ? `Powiązany kartowany kontekst gruntu to ${urban.urban_landslide_dataset_soil}.` : `The associated mapped soil context is ${urban.urban_landslide_dataset_soil}.`) : '',
        urban.urban_water_level_rise_modelled ? (language === 'de' ? 'Für Tartu liegt zusätzlich ein theoretisches +1,75-m-Wasserstandsanstiegsmodell vor.' : language === 'pl' ? 'Dla Tartu dostępny jest również teoretyczny model wzrostu poziomu wody o +1,75 m.' : 'For Tartu, an additional theoretical +1.75 m water-level-rise model is available.') : ''
      ].filter(Boolean).join(' ');
      if (hasSurvey) presentation.sections.soil_and_ground.detail = `${presentation.sections.soil_and_ground.detail} ${surveyText} ${language === 'de' ? 'Nahe Untersuchungen sind Kontext und kein Ersatz für eine standortbezogene Baugrunduntersuchung.' : language === 'pl' ? 'Pobliskie badania są jedynie kontekstem i nie zastępują badań podłoża w miejscu działki.' : 'Nearby surveys are contextual evidence and do not replace a site-specific ground investigation.'}`.trim();
      if (specialistParts) presentation.sections.soil_and_ground.detail = `${presentation.sections.soil_and_ground.detail} ${specialistParts}`.trim();
      if (hasSurvey) presentation.sections.soil_and_ground.source_cited = [...new Set([presentation.sections.soil_and_ground.source_cited, 'Maa- ja Ruumiamet / EGT — Ehitusgeoloogia'].filter(Boolean))].join('; ');
    }
    const franceGroundPresentation = renderFranceGroundPresentation(canonicalReport, presentation.language);
    if (franceGroundPresentation) {
      presentation.sections.soil_and_ground.detail = `${presentation.sections.soil_and_ground.detail} ${franceGroundPresentation.narrative}`.trim();
      const existingSource = presentation.sections.soil_and_ground.source_cited;
      presentation.sections.soil_and_ground.source_cited = [...new Set([existingSource, ...franceGroundPresentation.sourceNames].filter((source): source is string => Boolean(source)))].join('; ');
    }
    const slovakiaGroundPresentation = isSlovakPresentation ? null : renderSlovakiaGroundPresentation(canonicalReport, presentation.language);
    if (slovakiaGroundPresentation) {
      presentation.sections.soil_and_ground.detail = `${presentation.sections.soil_and_ground.detail} ${slovakiaGroundPresentation.narrative}`.trim();
      const existingSource = presentation.sections.soil_and_ground.source_cited;
      presentation.sections.soil_and_ground.source_cited = [...new Set([existingSource, ...slovakiaGroundPresentation.sourceNames].filter((source): source is string => Boolean(source)))].join('; ');
    }
    const czechiaGroundPresentation = isCzechPresentation ? null : renderCzechiaGroundPresentation(canonicalReport, presentation.language);
    if (czechiaGroundPresentation) {
      presentation.sections.soil_and_ground.detail = `${presentation.sections.soil_and_ground.detail} ${czechiaGroundPresentation.narrative}`.trim();
      const existingSource = presentation.sections.soil_and_ground.source_cited;
      presentation.sections.soil_and_ground.source_cited = [...new Set([existingSource, ...czechiaGroundPresentation.sourceNames].filter((source): source is string => Boolean(source)))].join('; ');
    }
    const croatiaGroundPresentation = countryCode === 'HR' ? renderCroatiaGroundPresentation(canonicalReport, presentation.language) : null;
    if (croatiaGroundPresentation) {
      presentation.sections.geohazard_risk.summary = croatiaGroundPresentation.geohazardNarrative;
      presentation.sections.geohazard_risk.detail = croatiaGroundPresentation.geohazardNarrative;
      const existingSource = presentation.sections.soil_and_ground.source_cited;
      const sources = [...new Set([existingSource, ...croatiaGroundPresentation.sourceNames].filter((source): source is string => Boolean(source)))].join('; ');
      presentation.sections.soil_and_ground.source_cited = sources;
      presentation.sections.geohazard_risk.source_cited = croatiaGroundPresentation.sourceNames.join('; ');
    }
    const czechiaCadastrePresentation = isCzechPresentation ? null : renderCzechiaCadastrePresentation(canonicalReport, presentation.language);
    if (czechiaCadastrePresentation) {
      presentation.sections.building_regulations.detail = `${presentation.sections.building_regulations.detail} ${czechiaCadastrePresentation.narrative}`.trim();
      const existingSource = presentation.sections.building_regulations.source_cited;
      presentation.sections.building_regulations.source_cited = [...new Set([existingSource, ...czechiaCadastrePresentation.sourceNames].filter((source): source is string => Boolean(source)))].join('; ');
    }
    const evidenceDisplayRecords = (isCroatianPresentation || isSlovakPresentation || isCzechPresentation || isDanishPresentation || isSwedishPresentation || isNorwegianPresentation || isDutchPresentation || isFrEsFiPresentation) ? presentation.evidenceRegistry : buildEvidenceDisplayRecords(canonicalReport.evidenceRecords, presentation.evidenceRegistry);
    // Match the area selected by createCanonicalReport for the German benchmark.
    const finiteArea = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
    const valuationAreaM2 = countryCode === 'DE'
      ? finiteArea(evidenceReport.parcel.officialAreaM2) ?? finiteArea(evidenceReport.parcel.areaCalculatedM2)
      : areaSize;
    const safePerSqm = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && valuationAreaM2 !== null && valuationAreaM2 > 0 ? value / valuationAreaM2 : null;
    const hasVerifiedParcel = Boolean(support.capabilities.nationalCadastre && evidenceReport.parcel?.status === 'VERIFIED');
    const hasOfficialParcel = Boolean(hasVerifiedParcel && evidenceReport.parcel?.isOfficialGeometry);
    const registeredAreaM2 = hasVerifiedParcel || (countryCode === 'NL' && netherlandsCadastre?.success) || (countryCode === 'BE' && belgiumCadastre?.success) || (countryCode === 'MT' && maltaCadastre?.success)
      ? evidenceReport.parcel?.officialAreaM2 ?? null : null;

    const reportData = {
      site_value_estimate: { min: canonicalReport.valuation.min, max: canonicalReport.valuation.max, median: canonicalReport.valuation.median, currency: canonicalReport.valuation.currency, basis: presentation.valuationMethodology, evidence_level: canonicalReport.valuation.status, uncertainty_rating: canonicalReport.valuation.mode === 'MARKET_CONTEXT' ? 'High' : canonicalReport.valuation.min === null ? undefined : evidenceReport.valuation?.uncertaintyRating, mode: canonicalReport.valuation.mode || 'PARCEL_TOTAL', context_price_per_sqm_min: canonicalReport.valuation.unitMin ?? safePerSqm(canonicalReport.valuation.min), context_price_per_sqm_max: canonicalReport.valuation.unitMax ?? safePerSqm(canonicalReport.valuation.max), context_price_per_sqm_median: canonicalReport.valuation.unitMedian ?? safePerSqm(canonicalReport.valuation.median), calibration_max_area_m2: canonicalReport.valuation.calibrationMaxAreaM2 },
      confidence_level: presentation.confidenceLabel,
      evidence_score: canonicalReport.evidenceScore,
      country_support: presentation.countrySupport,
      ground_context: { ...presentation.groundContext, ...(franceGroundPresentation ? { france_context: franceGroundPresentation } : {}), ...(slovakiaGroundPresentation ? { slovakia_context: slovakiaGroundPresentation } : {}), ...(czechiaGroundPresentation ? { czechia_context: czechiaGroundPresentation } : {}), ...(croatiaGroundPresentation ? { croatia_context: croatiaGroundPresentation } : {}) },
      czechia_cadastre: czechiaCadastre?.success ? { ...evidenceReport.czechia_cadastre, presentation: czechiaCadastrePresentation } : null,
      norway_cadastre: norwayCadastre?.success ? evidenceReport.norway_cadastre : null,
      denmark_cadastre: denmarkCadastre?.success ? evidenceReport.denmark_cadastre : null,
      belgium_cadastre: belgiumCadastre?.success ? evidenceReport.belgium_cadastre : null,
      switzerland_cadastre: switzerlandCadastre?.success ? evidenceReport.switzerland_cadastre : null,
      switzerland_contaminated_site: evidenceReport.switzerland_contaminated_site || null,
      malta_cadastre: maltaCadastre?.success ? evidenceReport.malta_cadastre : null,
      malta_ground_context: evidenceReport.malta_ground_context || null,
      belgium_region: evidenceReport.belgium_region || null,
      canonical_evidence: canonicalReport,
      official_geometry: hasOfficialParcel && evidenceReport.parcel?.geometryPoints?.length >= 3 ? evidenceReport.parcel.geometryPoints : null,
      mapped_geometry: countryCode === 'GB' && evidenceReport.parcel?.geometryPoints?.length >= 3 ? evidenceReport.parcel.geometryPoints : null,
      is_official_parcel: hasOfficialParcel,
      official_area_m2: registeredAreaM2,
      evidence_registry: evidenceDisplayRecords,
      verification_checklist: presentation.verificationChecklist,
      summary: presentation.summary,
      titles: presentation.titles,
      unavailable_reasons: presentation.unavailableReasons,
      geosurvey_context: { survey_authority: canonicalReport.geology.sourceName, geological_unit_name: canonicalReport.geology.unitName, lithology_type: canonicalReport.geology.lithology, geological_period_era: canonicalReport.geology.geologicalAge, groundwater_regime: canonicalReport.geology.groundwaterRegime, seismic_hazard_zone: canonicalReport.hazards.seismic.classification, radon_class: canonicalReport.hazards.radon.classification, official_portal_url: canonicalReport.geology.sourceUrl, evidence_level: canonicalReport.geology.status },
      lisbon_urban_context: countryCode === 'PT' ? {
        urban_geology_unit_name: evidenceReport.geosurvey_context?.urban_geology_unit_name || null,
        urban_geological_age: evidenceReport.geosurvey_context?.urban_geological_age || null,
        urban_geotechnical_unit: evidenceReport.geosurvey_context?.urban_geotechnical_unit || null,
        ec8_soil_class: evidenceReport.geosurvey_context?.ec8_soil_class || null,
        ec8_smax: evidenceReport.geosurvey_context?.ec8_smax ?? null,
        mass_movement_susceptibility: evidenceReport.geosurvey_context?.urban_mass_movement_susceptibility || null,
        groundwater_depth_class: evidenceReport.geosurvey_context?.urban_groundwater_depth_class || null,
        alluvium_depth_class: evidenceReport.geosurvey_context?.urban_alluvium_depth_class || null,
        fill_depth_class: evidenceReport.geosurvey_context?.urban_fill_depth_class || null,
        evidence_level: evidenceReport.geosurvey_context?.urban_evidence_level || null
      } : null,
      geotop_profile: evidenceReport.geosurvey_context?.geotop_profile || null,
      technical_parameters: { uk_inspire_mapped_area_m2: countryCode === 'GB' ? evidenceReport.parcel?.inspireMappedAreaM2 ?? null : null, cadastral_id_format: support.capabilities.nationalCadastre ? evidenceReport.parcel?.cadastralSource : null, cadastral_parcel_id: support.capabilities.nationalCadastre ? evidenceReport.parcel?.parcelId || null : null, cadastral_teryt: support.capabilities.nationalCadastre ? evidenceReport.parcel?.teryt : null, cadastral_commune: support.capabilities.nationalCadastre ? evidenceReport.parcel?.commune : null, cadastral_county: support.capabilities.nationalCadastre ? evidenceReport.parcel?.county : null, cadastral_voivodeship: support.capabilities.nationalCadastre ? evidenceReport.parcel?.voivodeship : null, cadastre_evidence_level: support.capabilities.nationalCadastre ? evidenceReport.parcel?.status : 'REQUIRES_VERIFICATION', is_official_parcel: hasOfficialParcel, official_area_m2: registeredAreaM2, elevation_amsl: canonicalReport.terrain.elevationM, min_elevation_amsl: canonicalReport.terrain.minElevationM, max_elevation_amsl: canonicalReport.terrain.maxElevationM, local_relief_m: canonicalReport.terrain.localReliefM, slope_degrees: canonicalReport.terrain.slopeDegrees, slope_percent: canonicalReport.terrain.slopePercent, slope_category: evidenceReport.terrain?.slopeCategory, aspect_direction: canonicalReport.terrain.aspectCode, ...presentation.technicalNarrative, soil_bearing_capacity_kpa: canonicalReport.soil.bearingCapacity, frost_depth_m: evidenceReport.soil?.frostSusceptibilityClass, radon_index: canonicalReport.hazards.radon.classification, setback_m: null },
      valuation_metrics: { valuation_area_m2: valuationAreaM2, price_per_sqm_min: safePerSqm(canonicalReport.valuation.min), price_per_sqm_max: safePerSqm(canonicalReport.valuation.max), price_per_sqm_median: safePerSqm(canonicalReport.valuation.median), comparable_evidence_count: canonicalReport.valuation.comparableCount, feasibility_rating: canonicalReport.valuation.min === null ? undefined : evidenceReport.valuation?.uncertaintyRating, soil_bearing_capacity_kpa: null },
      soil_metrics: { usda_texture: evidenceReport.soil?.usdaTextureClass, topsoil_sand_pct: evidenceReport.soil?.topsoilSandPct, topsoil_silt_pct: evidenceReport.soil?.topsoilSiltPct, topsoil_clay_pct: evidenceReport.soil?.topsoilClayPct, subsoil_sand_pct: evidenceReport.soil?.subsoilSandPct, subsoil_silt_pct: evidenceReport.soil?.subsoilSiltPct, subsoil_clay_pct: evidenceReport.soil?.subsoilClayPct, mean_bulk_density: evidenceReport.soil?.meanBulkDensityGcm3, mean_ph: evidenceReport.soil?.meanPhH2O, mean_soc: evidenceReport.soil?.meanOrganicCarbonPct, bearing_capacity_kpa: null, friction_angle_deg: null, cohesion_kpa: null, hydraulic_conductivity: null, drainage_class: null, frost_class: evidenceReport.soil?.frostSusceptibilityClass, topsoil_stripping_cm: null, source_name: evidenceReport.soil?.sourceName },
      stratigraphy: (evidenceReport.soil?.stratigraphyLayers || []).map((l: any) => ({ depth_range: l.depthRange, soil_type: l.soilType, bearing_capacity: presentation.unavailableReasons.engineeringParameter, description: presentation.unavailableReasons.engineeringParameter, sand_pct: l.sandPct, silt_pct: l.siltPct, clay_pct: l.clayPct, bulk_density: l.bulkDensity, ph: l.ph, soc: l.soc })),
      risk_matrix: presentation.riskMatrix,
      surrounding_landuse: evidenceReport.infrastructure?.surroundingLanduse,
      surrounding_buildings_count: evidenceReport.infrastructure?.surroundingBuildingsCount,
      amenity_index: (evidenceReport.infrastructure?.amenities || []).map((a: any) => ({ type: a.type, name: a.name, distance_m: a.distanceM, category: a.category })),
      utilities_checklist: presentation.utilitiesChecklist,
      ...presentation.sections,
      key_risks: presentation.keyRisks,
      opportunities: presentation.opportunities,
      data_sources: presentation.dataSources,
      legal_disclaimers: presentation.legalDisclaimers,
      location_name: locationName,
      language,
      pgi_site_evidence_count: pgiSiteEvidence.length,
      uk_site_evidence_count: ukSiteEvidence.length,
      scotland_cadastre_evidence_count: Array.isArray(scotlandCadastre?.evidence) ? scotlandCadastre.evidence.length : 0,
      northern_ireland_land_registry_evidence_count: northernIrelandLandRegistryEvidence.length,
      france_site_evidence_count: franceSiteEvidence.length,
      germany_mv_evidence_count: germanyMvEvidence.length,
      germany_borehole_evidence_count: germanyBoreholeEvidence.length,
      austria_ground_evidence_count: austriaGroundEvidence.length,
      portugal_cadastre_evidence_count: Array.isArray(portugalCadastre?.evidence) ? portugalCadastre.evidence.length : 0,
      portugal_national_evidence_count: portugalNationalEvidence.length,
      portugal_lisbon_urban_evidence_count: portugalLisbonUrbanEvidence.length,
      slovakia_ground_evidence_count: slovakiaGroundEvidence.length,
      czechia_ground_evidence_count: czechiaGroundEvidence.length,
      czechia_cadastre_evidence_count: Array.isArray(czechiaCadastre?.evidence) ? czechiaCadastre.evidence.length : 0,
      norway_ground_evidence_count: norwayGroundEvidence.length,
      sweden_ground_evidence_count: swedenGroundEvidence.length,
      netherlands_ground_evidence_count: netherlandsGroundEvidence.length,
      denmark_ground_evidence_count: denmarkGroundEvidence.length,
      norway_cadastre_evidence_count: Array.isArray(norwayCadastre?.evidence) ? norwayCadastre.evidence.length : 0,
      denmark_cadastre_evidence_count: Array.isArray(denmarkCadastre?.evidence) ? denmarkCadastre.evidence.length : 0,
      belgium_cadastre_evidence_count: Array.isArray(belgiumCadastre?.evidence) ? belgiumCadastre.evidence.length : 0,
      belgium_national_evidence_count: belgiumNationalEvidence.length,
      switzerland_cadastre_evidence_count: Array.isArray(switzerlandCadastre?.evidence) ? switzerlandCadastre.evidence.length : 0,
      switzerland_national_evidence_count: switzerlandNationalEvidence.length,
      malta_cadastre_evidence_count: Array.isArray(maltaCadastre?.evidence) ? maltaCadastre.evidence.length : 0,
      malta_national_evidence_count: maltaNationalEvidence.length,
      europe_valuation_evidence: europeValuationEvidence ? { id: europeValuationEvidence.id, status: europeValuationEvidence.status, source: europeValuationEvidence.sourceName } : null,
      country_location_mismatch: countryLocationMismatch ? { selected_country_code: countryCode, resolved_country_code: resolvedCountryCode } : null,
      uk_jurisdiction: ukJurisdiction
    };

    const officialGeometry = hasOfficialParcel && Array.isArray(evidenceReport.parcel?.geometryPoints) && evidenceReport.parcel.geometryPoints.length >= 3
      ? { type: 'polygon', points: evidenceReport.parcel.geometryPoints }
      : null;
    const mappedGeometry = countryCode === 'GB' && Array.isArray(evidenceReport.parcel?.geometryPoints) && evidenceReport.parcel.geometryPoints.length >= 3
      ? evidenceReport.parcel.geometryPoints
      : null;
    const finalReport = { id: evidenceReport.id, created_at: evidenceReport.generatedAt, location_name: locationName, country: cProfile.countryName, country_code: countryCode, language, latitude: lat, longitude: lng, area_size: areaSize, boundary: officialGeometry || shape || { type: 'circle', center: [lat, lng], radius: Math.sqrt(areaSize / Math.PI) }, official_geometry: officialGeometry?.points || null, mapped_geometry: mappedGeometry, is_official_parcel: hasOfficialParcel, official_area_m2: registeredAreaM2, uk_jurisdiction: ukJurisdiction, report_data: reportData };
    reportsStore[finalReport.id] = finalReport;
    res.json(finalReport);
  } catch (error: any) {
    console.error(`[${diagnosticId}] Error generating evidence site report at stage=${stage}:`, error);
    const message = typeof error?.message === 'string' ? error.message : 'Geospatial pipeline error';
    res.status(500).json({ error: 'Failed to generate evidence report', diagnostic_id: diagnosticId, stage, message });
  }
}

app.post('/api/analyze-site', handleAnalyzeSite);
app.post('/api/reports/analyze', handleAnalyzeSite);

app.get('/api/ai/status', (req, res) => {
  const config = getAiInterpretationRuntimeConfig();
  const authConfigured = Boolean(process.env.FIREBASE_WEB_API_KEY);
  res.json({
    providerConfigured: config.configured,
    available: config.configured && (config.allowAnonymous || authConfigured),
    provider: config.provider,
    model: config.model,
    authRequired: !config.allowAnonymous,
    authConfigured
  });
});

app.post('/api/ai/investigate-uk-sources', async (req, res) => {
  const diagnosticId = randomUUID();
  const config = getAiInterpretationRuntimeConfig();
  if (!config.configured) return res.status(503).json({ error: 'AI interpretation is not configured on this deployment.' });

  let rateLimitKey = req.ip || 'anonymous';
  if (!config.allowAnonymous) {
    const auth = await verifyFirebaseAuthorization(req.headers.authorization);
    if (!auth.ok) {
      if (auth.reason === 'AUTH_NOT_CONFIGURED') return res.status(503).json({ error: 'Sign-in is not configured on this deployment.' });
      if (auth.reason === 'USER_DISABLED') return res.status(403).json({ error: 'This user account cannot access AI interpretation.' });
      return res.status(401).json({ error: 'Please sign in to use AI interpretation.' });
    }
    rateLimitKey = auth.user.uid;
  }
  if (!consumeAiRateLimit(rateLimitKey)) return res.status(429).json({ error: 'AI source investigation rate limit reached. Please try again shortly.' });

  const report = req.body?.report;
  if (!report?.report_data) return res.status(400).json({ error: 'A valid GroundSurf report is required.' });
  if (String(report.country_code || report.countryCode || '').toUpperCase() !== 'GB') {
    return res.status(400).json({ error: 'BGS source investigation is currently available only for the UK.' });
  }

  const lat = Number(report.latitude);
  const lng = Number(report.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'The UK report does not contain valid coordinates.' });

  try {
    const investigation = await investigateUkBgsSources(lat, lng);
    const enrichedReport = investigation.evidence.length
      ? {
          ...report,
          report_data: {
            ...report.report_data,
            evidence_registry: [
              ...(Array.isArray(report.report_data.evidence_registry) ? report.report_data.evidence_registry : []),
              ...investigation.evidence
            ]
          }
        }
      : report;

    const interpretation = await interpretSurveyLandEvidence(enrichedReport);
    return res.json({
      ...interpretation,
      sourceInvestigation: {
        success: investigation.success,
        sourceCount: investigation.sourceCount,
        records: investigation.records,
        limitation: investigation.limitation
      }
    });
  } catch (error: any) {
    console.error(`[${diagnosticId}] UK BGS source investigation failed:`, error);
    const message = String(error?.message || '');
    if (/valid GroundSurf report|coordinates|UK report|BGS source investigation/i.test(message)) {
      return res.status(400).json({ error: message });
    }
    return res.status(502).json({ error: 'UK BGS source investigation is temporarily unavailable.', diagnostic_id: diagnosticId });
  }
});

app.post('/api/ai/interpret', async (req, res) => {
  const diagnosticId = randomUUID();
  const config = getAiInterpretationRuntimeConfig();
  if (!config.configured) return res.status(503).json({ error: 'AI interpretation is not configured on this deployment.' });

  let rateLimitKey = req.ip || 'anonymous';
  if (!config.allowAnonymous) {
    const auth = await verifyFirebaseAuthorization(req.headers.authorization);
    if (!auth.ok) {
      if (auth.reason === 'AUTH_NOT_CONFIGURED') return res.status(503).json({ error: 'Sign-in is not configured on this deployment.' });
      if (auth.reason === 'USER_DISABLED') return res.status(403).json({ error: 'This user account cannot access AI interpretation.' });
      return res.status(401).json({ error: 'Please sign in to use AI interpretation.' });
    }
    rateLimitKey = auth.user.uid;
  }

  if (!consumeAiRateLimit(rateLimitKey)) return res.status(429).json({ error: 'AI interpretation rate limit reached. Please try again shortly.' });
  const report = req.body?.report;
  if (!report?.report_data) return res.status(400).json({ error: 'A valid LandSurf report is required.' });

  try {
    const interpretation = await interpretSurveyLandEvidence(report);
    return res.json(interpretation);
  } catch (error: any) {
    console.error(`[${diagnosticId}] AI evidence interpretation failed:`, error);
    const message = String(error?.message || '');
    if (/valid LandSurf report|too large/i.test(message)) return res.status(400).json({ error: message });
    return res.status(502).json({ error: 'AI interpretation is temporarily unavailable.', diagnostic_id: diagnosticId });
  }
});

app.post('/api/ai/ask', async (req, res) => {
  const diagnosticId = randomUUID();
  const config = getAiInterpretationRuntimeConfig();
  if (!config.configured) return res.status(503).json({ error: 'The GroundSurf adviser is not configured on this deployment.' });

  let rateLimitKey = req.ip || 'anonymous';
  if (!config.allowAnonymous) {
    const auth = await verifyFirebaseAuthorization(req.headers.authorization);
    if (!auth.ok) {
      if (auth.reason === 'AUTH_NOT_CONFIGURED') return res.status(503).json({ error: 'Sign-in is not configured on this deployment.' });
      if (auth.reason === 'USER_DISABLED') return res.status(403).json({ error: 'This user account cannot access the GroundSurf adviser.' });
      return res.status(401).json({ error: 'Please sign in to use the GroundSurf adviser.' });
    }
    rateLimitKey = auth.user.uid;
  }

  if (!consumeAiRateLimit(rateLimitKey)) return res.status(429).json({ error: 'GroundSurf adviser rate limit reached. Please try again shortly.' });
  const report = req.body?.report;
  const question = typeof req.body?.question === 'string' ? req.body.question : '';
  const language = typeof req.body?.language === 'string' ? req.body.language : (report?.language || 'en');
  if (!report?.report_data) return res.status(400).json({ error: 'A valid GroundSurf land record is required.' });
  if (!question.trim()) return res.status(400).json({ error: 'Please ask a question about the land.' });

  try {
    const answer = await answerGroundSurfQuestion(report, question, language);
    return res.json(answer);
  } catch (error: any) {
    console.error(`[${diagnosticId}] GroundSurf adviser failed:`, error);
    const message = String(error?.message || '');
    if (/valid GroundSurf land record|Please ask|configured|requires the configured/i.test(message)) return res.status(400).json({ error: message });
    return res.status(502).json({ error: 'The GroundSurf adviser is temporarily unavailable.', diagnostic_id: diagnosticId });
  }
});

app.get('/api/local-help', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
  try {
    const businesses = await queryLocalHelp(lat, lng, category || query);
    return res.json({ businesses });
  } catch (error) {
    console.error('Local help lookup failed:', error);
    return res.json({ businesses: [] });
  }
});

app.post('/api/ai/compare', async (req, res) => {
  const diagnosticId = randomUUID();
  const config = getAiInterpretationRuntimeConfig();
  if (!config.configured) return res.status(503).json({ error: 'AI comparison is not configured on this deployment.' });

  let rateLimitKey = req.ip || 'anonymous';
  let userUid: string | undefined;
  if (!config.allowAnonymous) {
    const auth = await verifyFirebaseAuthorization(req.headers.authorization);
    if (!auth.ok) {
      if (auth.reason === 'AUTH_NOT_CONFIGURED') return res.status(503).json({ error: 'Sign-in is not configured on this deployment.' });
      if (auth.reason === 'USER_DISABLED') return res.status(403).json({ error: 'This user account cannot access AI comparison.' });
      return res.status(401).json({ error: 'Please sign in to compare sites with AI.' });
    }
    userUid = auth.user.uid;
    rateLimitKey = auth.user.uid;
  }

  if (!consumeAiRateLimit(rateLimitKey)) return res.status(429).json({ error: 'AI comparison rate limit reached. Please try again shortly.' });
  const reports = req.body?.reports;
  if (!Array.isArray(reports) || reports.length < 2 || reports.length > 4 || reports.some((report: any) => !report?.report_data)) {
    return res.status(400).json({ error: 'Select between 2 and 4 valid LandSurf reports for comparison.' });
  }

  try {
    const comparison = await compareSitesWithAi(reports, req.body?.intendedUse, { userUid });
    return res.json(comparison);
  } catch (error: any) {
    console.error(`[${diagnosticId}] AI site comparison failed:`, error);
    const message = String(error?.message || '');
    if (/Select between 2 and 4|unique report IDs|too large|valid LandSurf report/i.test(message)) return res.status(400).json({ error: message });
    return res.status(502).json({ error: 'AI comparison is temporarily unavailable.', diagnostic_id: diagnosticId });
  }
});

app.get('/api/reports', (req, res) => res.json(Object.values(reportsStore)));
app.get('/api/reports/:id', (req, res) => { const rep = reportsStore[req.params.id]; if (rep) res.json(rep); else res.status(404).json({ error: 'Report not found' }); });
app.post('/api/reports', (req, res) => { const report = req.body; if (report && report.id) { reportsStore[report.id] = report; res.json({ success: true, id: report.id }); } else res.status(400).json({ error: 'Invalid report data' }); });
app.delete('/api/reports/:id', (req, res) => { delete reportsStore[req.params.id]; res.json({ success: true }); });

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/country/:countryCode/', (req, res) => {
      const page = renderCountrySeoPage(String(req.params.countryCode || ''));
      if (!page) return res.status(404).send('Not found');
      res.type('html').send(page);
    });
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Geospatial Evidence Land Survey Server running on http://0.0.0.0:${PORT}`));
}

startServer().catch(err => { console.error('Failed to start server:', err); process.exit(1); });