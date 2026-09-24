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
import { enrichGeologyFromBrgm, queryFranceSiteEvidence } from './server/services/franceSiteEvidenceService';
import { enrichSlovakiaGroundEvidence, querySlovakiaGroundEvidence } from './server/services/slovakiaGroundEvidenceService';
import { enrichCzechiaGroundEvidence, queryCzechiaGroundEvidence } from './server/services/czechiaGroundEvidenceService';
import { applyCzechiaCadastreToReport, queryCzechiaCadastre } from './server/services/czechiaCadastreService';
import { queryCzechiaInspireCadastre } from './server/services/czechiaInspireCadastreService';
import { enrichSwedenGroundEvidence, querySwedenGroundEvidence } from './server/services/swedenGroundEvidenceService';
import { applyNorwayCadastreToReport, queryNorwayCadastre } from './server/services/norwayCadastreService';
import { applyNetherlandsCadastreToReport, queryNetherlandsCadastre } from './server/services/netherlandsCadastreService';
import { enrichNorwayGroundEvidence, queryNorwayGroundEvidence } from './server/services/norwayGroundEvidenceService';
import { applyDenmarkCadastreToReport, queryDenmarkCadastre } from './server/services/denmarkCadastreService';
import { enrichDenmarkGroundEvidence, queryDenmarkGroundEvidence } from './server/services/denmarkGroundEvidenceService';
import { applyIrelandCadastreToReport, queryIrelandCadastre } from './server/services/irelandCadastreService';
import { enrichIrelandNationalEvidence, queryIrelandNationalEvidence } from './server/services/irelandNationalEvidenceService';
import { applyLuxembourgCadastreToReport, queryLuxembourgCadastre } from './server/services/luxembourgCadastreService';
import { applyGermanyCadastreToReport, queryGermanyCadastre } from './server/services/germanyCadastreService';
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
import { compareSitesWithAi } from './server/services/aiComparisonService';
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
import { renderFranceGroundPresentation } from './server/reporting/franceGroundPresentation';
import { renderCroatiaGroundPresentation } from './server/reporting/croatiaGroundPresentation';
import { renderSlovakiaGroundPresentation } from './server/reporting/slovakiaGroundPresentation';
import { renderCzechiaGroundPresentation } from './server/reporting/czechiaGroundPresentation';
import { renderCzechiaCadastrePresentation } from './server/reporting/czechiaCadastrePresentation';
import { applySiteSpecificCountryEvidence, buildEvidenceDisplayRecords, enrichValuationPresentation } from './server/reporting/evidenceDisplay';
import { applyValuationAreaGuard } from './server/reporting/valuationAreaGuard';
import { getCountrySupport } from './src/data/countrySupport';

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
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Valid lat and lng query parameters are required.' });
  const profile = getCountryProfile(country);
  const support = getCountrySupport(country);
  if (support.capabilities.nationalCadastre && country === 'PL') return res.json(await fetchPolandCadastralParcel(lat, lng));
  if (support.capabilities.nationalCadastre && country === 'HR') return res.json(await queryCroatiaCadastre(lat, lng));
  if (country === 'DE') return res.json(await queryGermanyCadastre(lat, lng, null));
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
    const defaultLanguage = countryCode === 'FR' ? 'fr' : countryCode === 'ES' ? 'es' : countryCode === 'FI' ? 'fi' : countryCode === 'SK' ? 'sk' : countryCode === 'CZ' ? 'cs' : countryCode === 'DK' ? 'da' : countryCode === 'NO' ? 'no' : countryCode === 'SE' ? 'sv' : countryCode === 'PL' ? 'pl' : countryCode === 'NL' ? 'nl' : countryCode === 'HR' ? 'hr' : 'en';
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
              : ['en', 'de', 'pl', 'nl', 'fr', 'es', 'fi', 'hr'].includes(requestedLanguage) ? requestedLanguage : defaultLanguage;
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
    let denmarkCadastre: any = null;
    let irelandCadastre: any = null;
    let luxembourgCadastre: any = null;
    let belgiumCadastre: any = null;
    let switzerlandCadastre: any = null;
    let maltaCadastre: any = null;
    let germanyCadastre: any = null;
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
            evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score = Math.max(18, Number(evidenceReport.evidenceScore.breakdown.cadastreAndGeometry.score) || 0);
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
          evidenceReport.dataSourcesCited.push({ name: germanyCadastre.sourceName, organization: 'Landesamt für innere Verwaltung M-V, Amt für Geoinformation, Vermessung und Katasterwesen', url: germanyCadastre.sourceUrl, type: 'Official National Cadastre', status: 'VERIFIED' });
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
    let europeValuationEvidence: any = null;
    if (!countryLocationMismatch && countryCode === 'PL' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes)) {
      stage = 'pgi-site-evidence'; try { pgiSiteEvidence = await queryPolandSiteEvidence(lat, lng, fetch, groundSamplingLayout); } catch (e) { console.warn(`[${diagnosticId}] PIG site evidence notice:`, e); }
      if (support.capabilities.nationalHydrogeology) {
        stage = 'pgi-hydro-hazards'; try { pgiSiteEvidence.push(...await queryPolandHydroAndHazards(lat, lng, 5)); } catch (e) { console.warn(`[${diagnosticId}] PIG hydro/hazard evidence notice:`, e); }
      }
      stage = 'pgi-report-enrichment'; if (pgiSiteEvidence.length) evidenceReport.evidenceRegistry.push(...pgiSiteEvidence); enrichGeologyFromPgi(evidenceReport, pgiSiteEvidence);
    } else if (!countryLocationMismatch && countryCode === 'GB' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes || support.capabilities.nationalHydrogeology)) {
      stage = 'uk-site-evidence'; try { ukSiteEvidence = await queryUKSiteEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] UK national evidence notice:`, e); }
      stage = 'uk-report-enrichment'; if (ukSiteEvidence.length) evidenceReport.evidenceRegistry.push(...ukSiteEvidence);
      try { enrichGeologyFromBgs(evidenceReport, ukSiteEvidence); } catch (e) { console.warn(`[${diagnosticId}] BGS geology enrichment notice:`, e); }
      evidenceReport.verificationChecklist = getUKVerificationChecklist(municipality, stateName);
    } else if (!countryLocationMismatch && countryCode === 'FR' && (support.capabilities.nationalGeology || support.capabilities.nationalBoreholes)) {
      stage = 'france-site-evidence'; try { franceSiteEvidence = await queryFranceSiteEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] BRGM France evidence notice:`, e); }
      stage = 'france-report-enrichment'; if (franceSiteEvidence.length) evidenceReport.evidenceRegistry.push(...franceSiteEvidence);
      try { enrichGeologyFromBrgm(evidenceReport, franceSiteEvidence); } catch (e) { console.warn(`[${diagnosticId}] BRGM geology enrichment notice:`, e); }
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
    const isDutchPresentation = language === 'nl';
    const isFrEsFiPresentation = language === 'fr' || language === 'es' || language === 'fi';
    const isCroatianPresentation = countryCode === 'HR' && language === 'hr';
    const presentation: any = isCroatianPresentation
      ? renderCroatiaLocalizedReport(canonicalReport)
      : isSlovakPresentation
      ? renderSlovakLocalizedReport(canonicalReport)
      : isCzechPresentation
        ? renderCzechLocalizedReport(canonicalReport)
        : isDanishPresentation
          ? renderDanishLocalizedReport(canonicalReport)
          : isSwedishPresentation
            ? renderSwedishLocalizedReport(canonicalReport)
            : isNorwegianPresentation
              ? renderNorwegianLocalizedReport(canonicalReport)
              : isDutchPresentation
                ? renderDutchLocalizedReport(canonicalReport)
                : isFrEsFiPresentation
                  ? renderFrEsFiLocalizedReport(canonicalReport, language as 'fr' | 'es' | 'fi')
                  : renderLocalizedReport(canonicalReport, language);
    if (!isCroatianPresentation && !isSlovakPresentation && !isCzechPresentation && !isDanishPresentation && !isSwedishPresentation && !isNorwegianPresentation && !isDutchPresentation && !isFrEsFiPresentation) enrichValuationPresentation(canonicalReport, presentation);
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
      evidence_registry: evidenceDisplayRecords,
      verification_checklist: presentation.verificationChecklist,
      summary: presentation.summary,
      titles: presentation.titles,
      unavailable_reasons: presentation.unavailableReasons,
      geosurvey_context: { survey_authority: canonicalReport.geology.sourceName, geological_unit_name: canonicalReport.geology.unitName, lithology_type: canonicalReport.geology.lithology, geological_period_era: canonicalReport.geology.geologicalAge, groundwater_regime: canonicalReport.geology.groundwaterRegime, seismic_hazard_zone: canonicalReport.hazards.seismic.classification, radon_class: canonicalReport.hazards.radon.classification, official_portal_url: canonicalReport.geology.sourceUrl, evidence_level: canonicalReport.geology.status },
      technical_parameters: { cadastral_id_format: support.capabilities.nationalCadastre ? evidenceReport.parcel?.cadastralSource : null, cadastral_parcel_id: support.capabilities.nationalCadastre ? evidenceReport.parcel?.parcelId || null : null, cadastral_teryt: support.capabilities.nationalCadastre ? evidenceReport.parcel?.teryt : null, cadastral_commune: support.capabilities.nationalCadastre ? evidenceReport.parcel?.commune : null, cadastral_county: support.capabilities.nationalCadastre ? evidenceReport.parcel?.county : null, cadastral_voivodeship: support.capabilities.nationalCadastre ? evidenceReport.parcel?.voivodeship : null, cadastre_evidence_level: support.capabilities.nationalCadastre ? evidenceReport.parcel?.status : 'REQUIRES_VERIFICATION', is_official_parcel: hasOfficialParcel, official_area_m2: registeredAreaM2, elevation_amsl: canonicalReport.terrain.elevationM, min_elevation_amsl: canonicalReport.terrain.minElevationM, max_elevation_amsl: canonicalReport.terrain.maxElevationM, local_relief_m: canonicalReport.terrain.localReliefM, slope_degrees: canonicalReport.terrain.slopeDegrees, slope_percent: canonicalReport.terrain.slopePercent, slope_category: evidenceReport.terrain?.slopeCategory, aspect_direction: canonicalReport.terrain.aspectCode, ...presentation.technicalNarrative, soil_bearing_capacity_kpa: canonicalReport.soil.bearingCapacity, frost_depth_m: evidenceReport.soil?.frostSusceptibilityClass, radon_index: canonicalReport.hazards.radon.classification, setback_m: null },
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
      france_site_evidence_count: franceSiteEvidence.length,
      slovakia_ground_evidence_count: slovakiaGroundEvidence.length,
      czechia_ground_evidence_count: czechiaGroundEvidence.length,
      czechia_cadastre_evidence_count: Array.isArray(czechiaCadastre?.evidence) ? czechiaCadastre.evidence.length : 0,
      norway_ground_evidence_count: norwayGroundEvidence.length,
      sweden_ground_evidence_count: swedenGroundEvidence.length,
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
      country_location_mismatch: countryLocationMismatch ? { selected_country_code: countryCode, resolved_country_code: resolvedCountryCode } : null
    };

    const officialGeometry = hasOfficialParcel && Array.isArray(evidenceReport.parcel?.geometryPoints) && evidenceReport.parcel.geometryPoints.length >= 3
      ? { type: 'polygon', points: evidenceReport.parcel.geometryPoints }
      : null;
    const finalReport = { id: evidenceReport.id, created_at: evidenceReport.generatedAt, location_name: locationName, country: cProfile.countryName, country_code: countryCode, language, latitude: lat, longitude: lng, area_size: areaSize, boundary: officialGeometry || shape || { type: 'circle', center: [lat, lng], radius: Math.sqrt(areaSize / Math.PI) }, official_geometry: officialGeometry?.points || null, is_official_parcel: hasVerifiedParcel, official_area_m2: registeredAreaM2, report_data: reportData };
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
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Geospatial Evidence Land Survey Server running on http://0.0.0.0:${PORT}`));
}

startServer().catch(err => { console.error('Failed to start server:', err); process.exit(1); });