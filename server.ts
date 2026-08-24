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
import { getUKVerificationChecklist } from './server/services/ukRecommendationsService';
import { createCanonicalReport } from './server/reporting/canonicalReport';
import { renderLocalizedReport } from './server/reporting/localizedReport';

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
  if (country === 'PL') return res.json(await fetchPolandCadastralParcel(lat, lng));
  const profile = getCountryProfile(country);
  return res.json({ success: false, message: `Direct ULDK API query is specific to Poland. Location resolved under ${profile.cadastreAuthority}.`, cadastreAuthority: profile.cadastreAuthority, portalUrl: profile.cadastrePortalUrl });
});

async function handleAnalyzeSite(req: express.Request, res: express.Response) {
  const diagnosticId = randomUUID();
  let stage = 'request-validation';
  try {
    const shape = req.body.shape || req.body.boundaryShape;
    const requestedArea = Number(req.body.areaSize);
    const areaSize = Number.isFinite(requestedArea) && requestedArea > 0 ? requestedArea : 1000;
    const countryCode = String(req.body.countryCode || req.body.country || 'PL').toUpperCase();
    const country = req.body.country || getCountryProfile(countryCode).countryName;
    const language = String(req.body.language || req.body.languageCode || (countryCode === 'PL' ? 'pl' : 'en')).toLowerCase();

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
    stage = 'geospatial-analysis-pipeline';
    const evidenceReport: any = await runGeospatialAnalysisPipeline({ lat, lng, areaSizeM2: areaSize, countryCode, language, locationName, municipality, county: countyName, state: stateName, roadName });

    let pgiSiteEvidence: any[] = [];
    let ukSiteEvidence: any[] = [];
    if (countryCode === 'PL') {
      stage = 'pgi-site-evidence'; try { pgiSiteEvidence = await queryPolandSiteEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] PIG site evidence notice:`, e); }
      stage = 'pgi-hydro-hazards'; try { pgiSiteEvidence.push(...await queryPolandHydroAndHazards(lat, lng, 5)); } catch (e) { console.warn(`[${diagnosticId}] PIG hydro/hazard evidence notice:`, e); }
      stage = 'pgi-report-enrichment'; if (pgiSiteEvidence.length) evidenceReport.evidenceRegistry.push(...pgiSiteEvidence); enrichGeologyFromPgi(evidenceReport, pgiSiteEvidence);
    } else if (countryCode === 'GB') {
      stage = 'uk-site-evidence'; try { ukSiteEvidence = await queryUKSiteEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] UK national evidence notice:`, e); }
      stage = 'uk-report-enrichment'; if (ukSiteEvidence.length) evidenceReport.evidenceRegistry.push(...ukSiteEvidence);
      try { enrichGeologyFromBgs(evidenceReport, ukSiteEvidence); } catch (e) { console.warn(`[${diagnosticId}] BGS geology enrichment notice:`, e); }
      evidenceReport.verificationChecklist = getUKVerificationChecklist(municipality, stateName);
    }
    if (countryLocationMismatch) {
      evidenceReport.evidenceRegistry.push({ id: `country-location-mismatch-${diagnosticId}`, category: 'Location Validation', claim: `Selected country (${countryCode}) does not match the country resolved from the site coordinates (${resolvedCountryCode}).`, status: 'REQUIRES_VERIFICATION', sourceName: 'OpenStreetMap Nominatim reverse geocoding', sourceUrl: 'https://nominatim.openstreetmap.org/', datasetDate: new Date().toISOString().slice(0, 10), spatialRelationship: 'Site-centre reverse geocode', calculationMethod: 'Reverse geocode of the selected site coordinates', confidence: 'High', limitation: 'The selected country is retained for the report, but site-specific physical evidence should be interpreted using the actual coordinates.', value: { selectedCountryCode: countryCode, resolvedCountryCode } });
    }

    stage = 'report-assembly';
    const cProfile = getCountryProfile(countryCode);
    const canonicalReport = createCanonicalReport(evidenceReport, cProfile);
    const presentation = renderLocalizedReport(canonicalReport, language);
    const safePerSqm = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && areaSize > 0 ? value / areaSize : null;

    const reportData = {
      site_value_estimate: { min: evidenceReport.valuation?.indicativeMinPrice, max: evidenceReport.valuation?.indicativeMaxPrice, median: evidenceReport.valuation?.indicativeMedianPrice, currency: evidenceReport.valuation?.currency, basis: presentation.valuationMethodology, evidence_level: evidenceReport.valuation?.status, uncertainty_rating: evidenceReport.valuation?.uncertaintyRating },
      confidence_level: presentation.confidenceLabel,
      evidence_score: evidenceReport.evidenceScore,
      canonical_evidence: canonicalReport,
      evidence_registry: presentation.evidenceRegistry,
      verification_checklist: presentation.verificationChecklist,
      summary: presentation.summary,
      titles: presentation.titles,
      unavailable_reasons: presentation.unavailableReasons,
      geosurvey_context: { survey_authority: canonicalReport.geology.sourceName, geological_unit_name: canonicalReport.geology.unitName, lithology_type: canonicalReport.geology.lithology, geological_period_era: canonicalReport.geology.geologicalAge, groundwater_regime: canonicalReport.geology.groundwaterRegime, seismic_hazard_zone: canonicalReport.hazards.seismic.classification, radon_class: canonicalReport.hazards.radon.classification, official_portal_url: canonicalReport.geology.sourceUrl, evidence_level: canonicalReport.geology.status },
      technical_parameters: { cadastral_id_format: evidenceReport.parcel?.cadastralSource, cadastral_parcel_id: evidenceReport.parcel?.parcelId || null, cadastral_teryt: evidenceReport.parcel?.teryt, cadastral_commune: evidenceReport.parcel?.commune, cadastral_county: evidenceReport.parcel?.county, cadastral_voivodeship: evidenceReport.parcel?.voivodeship, cadastre_evidence_level: evidenceReport.parcel?.status, is_official_parcel: evidenceReport.parcel?.isOfficialGeometry, official_area_m2: evidenceReport.parcel?.officialAreaM2 || evidenceReport.parcel?.areaCalculatedM2, elevation_amsl: canonicalReport.terrain.elevationM, slope_degrees: canonicalReport.terrain.slopeDegrees, slope_percent: canonicalReport.terrain.slopePercent, slope_category: evidenceReport.terrain?.slopeCategory, aspect_direction: canonicalReport.terrain.aspectCode, ...presentation.technicalNarrative, soil_bearing_capacity_kpa: canonicalReport.soil.bearingCapacity, frost_depth_m: evidenceReport.soil?.frostSusceptibilityClass, radon_index: canonicalReport.hazards.radon.classification, setback_m: evidenceReport.planning?.setbackRules },
      valuation_metrics: { price_per_sqm_min: safePerSqm(evidenceReport.valuation?.indicativeMinPrice), price_per_sqm_max: safePerSqm(evidenceReport.valuation?.indicativeMaxPrice), price_per_sqm_median: evidenceReport.valuation?.indicativePricePerSqm ?? safePerSqm(evidenceReport.valuation?.indicativeMedianPrice), comparable_evidence_count: evidenceReport.valuation?.comparableEvidenceCount, feasibility_rating: evidenceReport.valuation?.uncertaintyRating, soil_bearing_capacity_kpa: null },
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
      country_location_mismatch: countryLocationMismatch ? { selected_country_code: countryCode, resolved_country_code: resolvedCountryCode } : null
    };

    const finalReport = { id: evidenceReport.id, created_at: evidenceReport.generatedAt, location_name: locationName, country: cProfile.countryName, country_code: countryCode, language, latitude: lat, longitude: lng, area_size: areaSize, boundary: shape || { type: 'circle', center: [lat, lng], radius: Math.sqrt(areaSize / Math.PI) }, official_geometry: evidenceReport.parcel?.geometryPoints, is_official_parcel: evidenceReport.parcel?.isOfficialGeometry, official_area_m2: evidenceReport.parcel?.officialAreaM2, report_data: reportData };
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
startServer();
