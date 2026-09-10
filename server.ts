import express from 'express';
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
import { applyNorwayCadastreToReport, queryNorwayCadastre } from './server/services/norwayCadastreService';
import { enrichNorwayGroundEvidence, queryNorwayGroundEvidence } from './server/services/norwayGroundEvidenceService';
import { getUKVerificationChecklist } from './server/services/ukRecommendationsService';
import { buildGroundSamplingLayout, sampleSoilGridsVariability } from './server/services/groundContextService';
import { enrichEuropeanLandValuation, queryEuropeanLandValuationEvidence } from './server/services/europeLandValuationService';
import { createCanonicalReport } from './server/reporting/canonicalReport';
import { renderLocalizedReport } from './server/reporting/localizedReport';
import { renderSlovakLocalizedReport } from './server/reporting/slovakLocalizedReport';
import { renderDutchLocalizedReport } from './server/reporting/dutchLocalizedReport';
import { renderCzechLocalizedReport } from './server/reporting/czechLocalizedReport';
import { renderNorwegianLocalizedReport } from './server/reporting/norwegianLocalizedReport';
import { renderFranceGroundPresentation } from './server/reporting/franceGroundPresentation';
import { renderSlovakiaGroundPresentation } from './server/reporting/slovakiaGroundPresentation';
import { renderCzechiaGroundPresentation } from './server/reporting/czechiaGroundPresentation';
import { renderCzechiaCadastrePresentation } from './server/reporting/czechiaCadastrePresentation';
import { applySiteSpecificCountryEvidence, buildEvidenceDisplayRecords, enrichValuationPresentation } from './server/reporting/evidenceDisplay';
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
app.use(express.json({ limit: '10mb' }));
const reportsStore: Record<string, any> = {};

function getCenterFromShape(shape: any, reqBody?: any): [number, number] {
  if (reqBody?.latitude !== undefined && reqBody?.longitude !== undefined) return [Number(reqBody.latitude), Number(reqBody.longitude)];
  if (!shape) return [52.2297, 21.0122];
  if (shape.type === 'circle' && shape.center) return shape.center;
  if (shape.type === 'rectangle' && shape.corners?.length >= 2) {
    const lats = shape.corners.map((c: any) => (Array.isArray(c) ? c[0] : c.lat));
    const lngs = shape.corners.map((c: any) => (Array.isArray(c) ? c[1] : c.lng));
    return [(lats[0] + lats[1]) / 2, (lngs[0] + lngs[1]) / 2];
  }
  if ((shape.type === 'polygon' || shape.coordinates) && (shape.points?.length > 0 || shape.coordinates?.length > 0)) {
    const pts = shape.points || shape.coordinates;
    const lats = pts.map((p: any) => (Array.isArray(p) ? p[0] : p.lat));
    const lngs = pts.map((p: any) => (Array.isArray(p) ? p[1] : p.lng));
    return [lats.reduce((a: number, b: number) => a + b, 0) / lats.length, lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length];
  }
  if (shape.center && Array.isArray(shape.center)) return [shape.center[0], shape.center[1]];
  return [52.2297, 21.0122];
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.get('/api/cadastre/query', async (req, res) => {
  const lat = Number(req.query.lat); const lng = Number(req.query.lng); const country = String(req.query.country || 'PL').toUpperCase();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Valid lat and lng query parameters are required.' });
  const profile = getCountryProfile(country);
  const support = getCountrySupport(country);
  if (support.capabilities.nationalCadastre && country === 'PL') return res.json(await fetchPolandCadastralParcel(lat, lng));
  if (support.capabilities.nationalCadastre && country === 'CZ') return res.json(await queryCzechiaCadastre(lat, lng));
  if (support.capabilities.nationalCadastre && country === 'NO') return res.json(await queryNorwayCadastre(lat, lng));
  return res.json({ success: false, reasonCode: 'NOT_SUPPORTED_FOR_COUNTRY', message: `Automated national cadastre acquisition is not implemented for ${profile.countryName}. Verify the parcel with ${profile.cadastreAuthority}.`, cadastreAuthority: profile.cadastreAuthority, portalUrl: profile.cadastrePortalUrl });
});

async function handleAnalyzeSite(req: express.Request, res: express.Response) {
  const diagnosticId = randomUUID();
  let stage = 'request-validation';
  try {
    const shape = req.body.shape || req.body.boundaryShape;
    const requestedArea = Number(req.body.areaSize);
    const areaSize = Number.isFinite(requestedArea) && requestedArea > 0 ? requestedArea : 1000;
    const countryCode = String(req.body.countryCode || req.body.country || 'PL').toUpperCase();
    const cProfile = getCountryProfile(countryCode);
    const support = getCountrySupport(countryCode);
    const country = req.body.country || cProfile.countryName;
    const defaultLanguage = countryCode === 'SK' ? 'sk' : countryCode === 'CZ' ? 'cs' : countryCode === 'NO' ? 'no' : countryCode === 'PL' ? 'pl' : countryCode === 'NL' ? 'nl' : 'en';
    const requestedLanguage = String(req.body.language || req.body.languageCode || defaultLanguage).toLowerCase().split('-')[0];
    const language = requestedLanguage === 'sk'
      ? (countryCode === 'SK' ? 'sk' : 'en')
      : requestedLanguage === 'cs'
        ? (countryCode === 'CZ' ? 'cs' : 'en')
        : (requestedLanguage === 'no' || requestedLanguage === 'nb')
          ? (countryCode === 'NO' ? 'no' : 'en')
          : ['en', 'de', 'pl', 'nl'].includes(requestedLanguage) ? requestedLanguage : defaultLanguage;

    stage = 'site-centre';
    const [lat, lng] = getCenterFromShape(shape, req.body);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    let locationName = `${lat.toFixed(5)}, ${lng.toFixed(5)} (${country})`;
    let municipality = '', countyName = '', stateName = '', roadName = '';
    let resolvedCountryCode = '';

    stage = 'reverse-geocoding';
    try {
      const ctrl = new AbortController(); const id = setTimeout(() => ctrl.abort(), 3500);
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: { 'User-Agent': 'GeoSurveyEvidenceApp/4.0' }, signal: ctrl.signal });
      clearTimeout(id);
      if (r.ok) {
        const d: any = await r.json();
        if (d?.display_name) locationName = d.display_name;
        if (d?.address) {
          const a = d.address;
          municipality = a.city || a.town || a.village || a.municipality || a.suburb || '';
          countyName = a.county || '';
          stateName = a.state || a.province || a.region || '';
          roadName = a.road || '';
          resolvedCountryCode = String(a.country_code || '').toUpperCase();
        }
      }
    } catch (e) { console.warn(`[${diagnosticId}] Geocoding notice:`, e); }

    const countryLocationMismatch = Boolean(resolvedCountryCode && resolvedCountryCode !== countryCode && !(countryCode === 'GB' && resolvedCountryCode === 'UK'));
    const acquisitionCountryCode = countryLocationMismatch ? 'EU' : countryCode;
    stage = 'geospatial-analysis-pipeline';
    const evidenceReport: any = await runGeospatialAnalysisPipeline({ lat, lng, areaSizeM2: areaSize, countryCode: acquisitionCountryCode, language, locationName, municipality, county: countyName, state: stateName, roadName });
    evidenceReport.countryCode = countryCode;

    let czechiaCadastre: any = null;
    let norwayCadastre: any = null;
    if (!countryLocationMismatch && countryCode === 'CZ' && support.capabilities.nationalCadastre) {
      stage = 'czechia-cadastre';
      try {
        czechiaCadastre = await queryCzechiaCadastre(lat, lng);
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
        } else if (Array.isArray(czechiaCadastre.evidence)) {
          evidenceReport.evidenceRegistry.push(...czechiaCadastre.evidence);
        }
      } catch (e) { console.warn(`[${diagnosticId}] ČÚZK Czechia cadastre notice:`, e); }
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

    if (!countryLocationMismatch && support.capabilities.nationalValuation && ['AT', 'ES', 'FI', 'IE'].includes(countryCode)) {
      stage = 'europe-land-valuation';
      try {
        europeValuationEvidence = await queryEuropeanLandValuationEvidence(countryCode, { municipality, county: countyName, state: stateName });
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

    stage = 'report-assembly';
    const baseCanonicalReport = createCanonicalReport(evidenceReport, cProfile);
    const canonicalReport = applySiteSpecificCountryEvidence(baseCanonicalReport, evidenceReport);
    const isSlovakPresentation = countryCode === 'SK' && language === 'sk';
    const isCzechPresentation = countryCode === 'CZ' && language === 'cs';
    const isNorwegianPresentation = countryCode === 'NO' && language === 'no';
    const isDutchPresentation = language === 'nl';
    const presentation: any = isSlovakPresentation
      ? renderSlovakLocalizedReport(canonicalReport)
      : isCzechPresentation
        ? renderCzechLocalizedReport(canonicalReport)
        : isNorwegianPresentation
          ? renderNorwegianLocalizedReport(canonicalReport)
          : isDutchPresentation
            ? renderDutchLocalizedReport(canonicalReport)
            : renderLocalizedReport(canonicalReport, language);
    if (!isSlovakPresentation && !isCzechPresentation && !isNorwegianPresentation && !isDutchPresentation) enrichValuationPresentation(canonicalReport, presentation);
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
    const czechiaCadastrePresentation = isCzechPresentation ? null : renderCzechiaCadastrePresentation(canonicalReport, presentation.language);
    if (czechiaCadastrePresentation) {
      presentation.sections.building_regulations.detail = `${presentation.sections.building_regulations.detail} ${czechiaCadastrePresentation.narrative}`.trim();
      const existingSource = presentation.sections.building_regulations.source_cited;
      presentation.sections.building_regulations.source_cited = [...new Set([existingSource, ...czechiaCadastrePresentation.sourceNames].filter((source): source is string => Boolean(source)))].join('; ');
    }
    const evidenceDisplayRecords = (isSlovakPresentation || isCzechPresentation || isNorwegianPresentation || isDutchPresentation) ? presentation.evidenceRegistry : buildEvidenceDisplayRecords(canonicalReport.evidenceRecords, presentation.evidenceRegistry);
    const safePerSqm = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && areaSize > 0 ? value / areaSize : null;
    const hasOfficialParcel = Boolean(support.capabilities.nationalCadastre && evidenceReport.parcel?.status === 'VERIFIED' && evidenceReport.parcel?.isOfficialGeometry);

    const reportData = {
      site_value_estimate: { min: canonicalReport.valuation.min, max: canonicalReport.valuation.max, median: canonicalReport.valuation.median, currency: canonicalReport.valuation.currency, basis: presentation.valuationMethodology, evidence_level: canonicalReport.valuation.status, uncertainty_rating: canonicalReport.valuation.min === null ? undefined : evidenceReport.valuation?.uncertaintyRating },
      confidence_level: presentation.confidenceLabel,
      evidence_score: canonicalReport.evidenceScore,
      country_support: presentation.countrySupport,
      ground_context: { ...presentation.groundContext, ...(franceGroundPresentation ? { france_context: franceGroundPresentation } : {}), ...(slovakiaGroundPresentation ? { slovakia_context: slovakiaGroundPresentation } : {}), ...(czechiaGroundPresentation ? { czechia_context: czechiaGroundPresentation } : {}) },
      czechia_cadastre: czechiaCadastre?.success ? { ...evidenceReport.czechia_cadastre, presentation: czechiaCadastrePresentation } : null,
      norway_cadastre: norwayCadastre?.success ? evidenceReport.norway_cadastre : null,
      canonical_evidence: canonicalReport,
      evidence_registry: evidenceDisplayRecords,
      verification_checklist: presentation.verificationChecklist,
      summary: presentation.summary,
      titles: presentation.titles,
      unavailable_reasons: presentation.unavailableReasons,
      geosurvey_context: { survey_authority: canonicalReport.geology.sourceName, geological_unit_name: canonicalReport.geology.unitName, lithology_type: canonicalReport.geology.lithology, geological_period_era: canonicalReport.geology.geologicalAge, groundwater_regime: canonicalReport.geology.groundwaterRegime, seismic_hazard_zone: canonicalReport.hazards.seismic.classification, radon_class: canonicalReport.hazards.radon.classification, official_portal_url: canonicalReport.geology.sourceUrl, evidence_level: canonicalReport.geology.status },
      technical_parameters: { cadastral_id_format: support.capabilities.nationalCadastre ? evidenceReport.parcel?.cadastralSource : null, cadastral_parcel_id: support.capabilities.nationalCadastre ? evidenceReport.parcel?.parcelId || null : null, cadastral_teryt: support.capabilities.nationalCadastre ? evidenceReport.parcel?.teryt : null, cadastral_commune: support.capabilities.nationalCadastre ? evidenceReport.parcel?.commune : null, cadastral_county: support.capabilities.nationalCadastre ? evidenceReport.parcel?.county : null, cadastral_voivodeship: support.capabilities.nationalCadastre ? evidenceReport.parcel?.voivodeship : null, cadastre_evidence_level: support.capabilities.nationalCadastre ? evidenceReport.parcel?.status : 'REQUIRES_VERIFICATION', is_official_parcel: hasOfficialParcel, official_area_m2: hasOfficialParcel ? evidenceReport.parcel?.officialAreaM2 ?? null : null, elevation_amsl: canonicalReport.terrain.elevationM, min_elevation_amsl: canonicalReport.terrain.minElevationM, max_elevation_amsl: canonicalReport.terrain.maxElevationM, local_relief_m: canonicalReport.terrain.localReliefM, slope_degrees: canonicalReport.terrain.slopeDegrees, slope_percent: canonicalReport.terrain.slopePercent, slope_category: evidenceReport.terrain?.slopeCategory, aspect_direction: canonicalReport.terrain.aspectCode, ...presentation.technicalNarrative, soil_bearing_capacity_kpa: canonicalReport.soil.bearingCapacity, frost_depth_m: evidenceReport.soil?.frostSusceptibilityClass, radon_index: canonicalReport.hazards.radon.classification, setback_m: null },
      valuation_metrics: { price_per_sqm_min: safePerSqm(canonicalReport.valuation.min), price_per_sqm_max: safePerSqm(canonicalReport.valuation.max), price_per_sqm_median: safePerSqm(canonicalReport.valuation.median), comparable_evidence_count: canonicalReport.valuation.comparableCount, feasibility_rating: canonicalReport.valuation.min === null ? undefined : evidenceReport.valuation?.uncertaintyRating, soil_bearing_capacity_kpa: null },
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
      norway_cadastre_evidence_count: Array.isArray(norwayCadastre?.evidence) ? norwayCadastre.evidence.length : 0,
      europe_valuation_evidence: europeValuationEvidence ? { id: europeValuationEvidence.id, status: europeValuationEvidence.status, source: europeValuationEvidence.sourceName } : null,
      country_location_mismatch: countryLocationMismatch ? { selected_country_code: countryCode, resolved_country_code: resolvedCountryCode } : null
    };

    const finalReport = { id: evidenceReport.id, created_at: evidenceReport.generatedAt, location_name: locationName, country: cProfile.countryName, country_code: countryCode, language, latitude: lat, longitude: lng, area_size: areaSize, boundary: shape || { type: 'circle', center: [lat, lng], radius: Math.sqrt(areaSize / Math.PI) }, official_geometry: hasOfficialParcel ? evidenceReport.parcel?.geometryPoints : null, is_official_parcel: hasOfficialParcel, official_area_m2: hasOfficialParcel ? evidenceReport.parcel?.officialAreaM2 ?? null : null, report_data: reportData };
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