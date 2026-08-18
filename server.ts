import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { runGeospatialAnalysisPipeline } from './server/engine/evidenceEngine';
import { fetchPolandCadastralParcel } from './server/adapters/poland';
import { getCountryProfile } from './server/adapters/countries';
import { queryPolandSiteEvidence } from './server/services/pgiSiteEvidenceService';
import { queryPolandHydroAndHazards } from './server/services/pgiSupplementEvidenceService';

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
function getCenterFromShape(shape: any, reqBody?: any): [number, number] { if (reqBody?.latitude && reqBody?.longitude) return [Number(reqBody.latitude), Number(reqBody.longitude)]; if (!shape) return [52.2297, 21.0122]; if (shape.type === 'circle' && shape.center) return shape.center; if (shape.type === 'rectangle' && shape.corners?.length >= 2) { const lats = shape.corners.map((c: any) => (Array.isArray(c) ? c[0] : c.lat)); const lngs = shape.corners.map((c: any) => (Array.isArray(c) ? c[1] : c.lng)); return [(lats[0] + lats[1]) / 2, (lngs[0] + lngs[1]) / 2]; } if ((shape.type === 'polygon' || shape.coordinates) && (shape.points?.length > 0 || shape.coordinates?.length > 0)) { const pts = shape.points || shape.coordinates; const lats = pts.map((p: any) => (Array.isArray(p) ? p[0] : p.lat)); const lngs = pts.map((p: any) => (Array.isArray(p) ? p[1] : p.lng)); return [lats.reduce((a: number, b: number) => a + b, 0) / lats.length, lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length]; } if (shape.center && Array.isArray(shape.center)) return [shape.center[0], shape.center[1]]; return [52.2297, 21.0122]; }
function firstPgiMapEvidence(items: any[]) { return items.find((x: any) => x.category?.includes('Geological Map') || x.category?.includes('Lithogenetic Map') || x.category?.includes('Engineering-Geological Map')); }
function pgiFeatureProperties(evidence: any): Record<string, any> { const info = evidence?.value?.featureInfo; const features = info?.features || info?.FeatureInfo || []; const props = features?.[0]?.properties; return props && typeof props === 'object' ? props : {}; }
function pgiProperty(props: Record<string, any>, patterns: RegExp[]): any { const key = Object.keys(props).find(k => patterns.some(p => p.test(k))); return key ? props[key] : undefined; }
function enrichGeologyFromPgi(report: any, pgiEvidence: any[]) {
  const maps = pgiEvidence.filter((x: any) => /Geological Map|Lithogenetic Map|Engineering-Geological Map/i.test(x.category || '') && x.status === 'VERIFIED');
  const boreholes = pgiEvidence.filter((x: any) => x.category === 'Boreholes' && x.status === 'VERIFIED');
  if (!maps.length && !boreholes.length) return;
  const primary = maps[0];
  const props = pgiFeatureProperties(primary);
  const geologicalUnit = pgiProperty(props, [/geolog/i, /jednost/i, /unit/i, /utwor/i, /symbol/i]) || report.geosurvey_context.geological_unit_name;
  const lithology = pgiProperty(props, [/litolog/i, /lithology/i, /rock/i, /osad/i, /material/i]) || report.geosurvey_context.lithology_type;
  const period = pgiProperty(props, [/strat/i, /wiek/i, /age/i, /okres/i, /period/i]) || report.geosurvey_context.geological_period_era;
  report.geosurvey_context = {
    ...report.geosurvey_context,
    geological_unit_name: geologicalUnit,
    lithology_type: lithology,
    geological_period_era: period,
    pgi_evidence_status: 'VERIFIED',
    pgi_map_evidence_count: maps.length,
    pgi_borehole_count: boreholes.length,
    pgi_boreholes: boreholes.map((x: any) => ({ distance_km: x.value?.distanceKm, feature_id: x.value?.featureId, properties: x.value?.properties, geological_profile: x.value?.geologicalProfileProperties })),
    pgi_sources: maps.map((x: any) => ({ category: x.category, source: x.sourceName, url: x.sourceUrl, status: x.status, limitation: x.limitation }))
  };
  report.geosurvey_context.evidence_level = 'VERIFIED';
}
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.get('/api/cadastre/query', async (req, res) => { const lat = Number(req.query.lat); const lng = Number(req.query.lng); const country = String(req.query.country || 'PL').toUpperCase(); if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'Valid lat and lng query parameters are required.' }); if (country === 'PL') return res.json(await fetchPolandCadastralParcel(lat, lng)); const profile = getCountryProfile(country); return res.json({ success: false, message: `Direct ULDK API query is specific to Poland. Location resolved under ${profile.cadastreAuthority}.`, cadastreAuthority: profile.cadastreAuthority, portalUrl: profile.cadastrePortalUrl }); });
async function handleAnalyzeSite(req: express.Request, res: express.Response) { try { const shape = req.body.shape || req.body.boundaryShape; const areaSize = Number(req.body.areaSize) || 1000; const country = req.body.country || req.body.countryCode || 'PL'; const countryCode = (req.body.countryCode || req.body.country || 'PL').toUpperCase(); const language = (req.body.language || req.body.languageCode || (countryCode === 'PL' ? 'pl' : 'en')).toLowerCase(); const [lat, lng] = getCenterFromShape(shape, req.body); let locationName = `${lat.toFixed(5)}, ${lng.toFixed(5)} (${country})`; let municipality = '', countyName = '', stateName = '', roadName = ''; try { const ctrl = new AbortController(); const id = setTimeout(() => ctrl.abort(), 3500); const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: { 'User-Agent': 'GeoSurveyEvidenceApp/4.0' }, signal: ctrl.signal }); clearTimeout(id); if (r.ok) { const d: any = await r.json(); if (d.display_name) locationName = d.display_name; if (d.address) { const a = d.address; municipality = a.city || a.town || a.village || a.municipality || a.suburb || ''; countyName = a.county || ''; stateName = a.state || a.province || a.region || ''; roadName = a.road || ''; } } } catch (e) { console.warn('Geocoding notice:', e); } const evidenceReport = await runGeospatialAnalysisPipeline({ lat, lng, areaSizeM2: areaSize, countryCode, language, locationName, municipality, county: countyName, state: stateName, roadName });
    let pgiSiteEvidence: any[] = [];
    if (countryCode === 'PL') {
      try { pgiSiteEvidence = await queryPolandSiteEvidence(lat, lng); } catch (e) { console.warn('PIG site evidence notice:', e); }
      try { pgiSiteEvidence.push(...await queryPolandHydroAndHazards(lat, lng, 5)); } catch (e) { console.warn('PIG hydro/hazard evidence notice:', e); }
      if (pgiSiteEvidence.length) evidenceReport.evidenceRegistry.push(...pgiSiteEvidence);
      enrichGeologyFromPgi(evidenceReport, pgiSiteEvidence);
    }
    const cProfile = getCountryProfile(countryCode); const titles = { estimated_value: language === 'pl' ? 'Szacunkowa Wartość Statystyczna Gruntu' : language === 'de' ? 'Statistische Grundstücks-Wertermittlung' : language === 'fr' ? 'Valeur Vénale Indicative' : 'Indicative Statistical Land Valuation', confidence: language === 'pl' ? 'Wskaźnik Jakości Dowodów (Evidence Score)' : language === 'de' ? 'Evidenz-Qualitätsindex (Evidence Score)' : 'Evidence Quality Score', executive_summary: language === 'pl' ? 'Synteza Wykonawcza (Evidence Summary)' : language === 'de' ? 'Zusammenfassung des Gutachtens' : 'Executive Evidence Synthesis' }; const reportData = { site_value_estimate: { min: evidenceReport.valuation.indicativeMinPrice, max: evidenceReport.valuation.indicativeMaxPrice, median: evidenceReport.valuation.indicativeMedianPrice, currency: evidenceReport.valuation.currency, basis: evidenceReport.valuation.methodology, evidence_level: evidenceReport.valuation.status, uncertainty_rating: evidenceReport.valuation.uncertaintyRating }, confidence_level: evidenceReport.evidenceScore.ratingClass, evidence_score: evidenceReport.evidenceScore, evidence_registry: evidenceReport.evidenceRegistry, verification_checklist: evidenceReport.verificationChecklist, summary: evidenceReport.executiveSummary, titles, geosurvey_context: { ...evidenceReport.geosurvey_context, survey_authority: evidenceReport.soil.sourceName, geological_unit_name: evidenceReport.geosurvey_context.geological_unit_name, lithology_type: evidenceReport.geosurvey_context.lithology_type, geological_period_era: evidenceReport.geosurvey_context.geological_period_era, groundwater_regime: evidenceReport.soil.groundwaterRegime, seismic_hazard_zone: evidenceReport.terrain.geohazards.seismicRisk.zone, radon_class: evidenceReport.terrain.geohazards.radonPotential.classification, official_portal_url: cProfile.geologyPortalUrl, evidence_level: evidenceReport.geosurvey_context.evidence_level || evidenceReport.soil.status }, technical_parameters: { cadastral_parcel_id: evidenceReport.parcel.parcelId || 'Unconfirmed (Requires local cadastre extract)', elevation_amsl: evidenceReport.terrain.elevationAmsl, slope_degrees: evidenceReport.terrain.averageSlopeDegrees, groundwater_depth_m: evidenceReport.soil.estimatedWaterTableDepthM, soil_bearing_capacity_kpa: evidenceReport.soil.estimatedBearingCapacityKpa }, data_sources: evidenceReport.dataSourcesCited.map(ds => ({ name: ds.name, url: ds.url, authority: ds.organization, verification_status: ds.status })), legal_disclaimers: evidenceReport.statutoryDisclaimers, location_name: locationName, language, pgi_site_evidence_count: pgiSiteEvidence.length }; const finalReport = { id: evidenceReport.id, created_at: evidenceReport.generatedAt, location_name: locationName, country: cProfile.countryName, country_code: countryCode, language, latitude: lat, longitude: lng, area_size: areaSize, boundary: shape || { type: 'circle', center: [lat, lng], radius: Math.sqrt(areaSize / Math.PI) }, report_data: reportData }; reportsStore[finalReport.id] = finalReport; res.json(finalReport); } catch (error: any) { console.error('Error generating evidence site report:', error); res.status(500).json({ error: 'Failed to generate evidence report', message: error?.message || 'Geospatial pipeline error' }); } }
app.post('/api/analyze-site', handleAnalyzeSite); app.post('/api/reports/analyze', handleAnalyzeSite); app.get('/api/reports', (req, res) => res.json(Object.values(reportsStore))); app.get('/api/reports/:id', (req, res) => { const rep = reportsStore[req.params.id]; if (rep) res.json(rep); else res.status(404).json({ error: 'Report not found' }); }); app.post('/api/reports', (req, res) => { const report = req.body; if (report && report.id) { reportsStore[report.id] = report; res.json({ success: true, id: report.id }); } else res.status(400).json({ error: 'Invalid report data' }); }); app.delete('/api/reports/:id', (req, res) => { delete reportsStore[req.params.id]; res.json({ success: true }); });
async function startServer() { if (process.env.NODE_ENV !== 'production') { const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' }); app.use(vite.middlewares); } else { const distPath = path.join(process.cwd(), 'dist'); app.use(express.static(distPath)); app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html'))); } app.listen(PORT, '0.0.0.0', () => console.log(`Geospatial Evidence Land Survey Server running on http://0.0.0.0:${PORT}`)); }
startServer();
