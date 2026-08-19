import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { randomUUID } from 'crypto';
import { runGeospatialAnalysisPipeline } from './server/engine/evidenceEngine';
import { fetchPolandCadastralParcel } from './server/adapters/poland';
import { getCountryProfile } from './server/adapters/countries';
import { queryPolandSiteEvidence } from './server/services/pgiSiteEvidenceService';
import { queryPolandHydroAndHazards } from './server/services/pgiSupplementEvidenceService';
import { queryUKSiteEvidence, enrichGeologyFromBgs } from './server/services/ukSiteEvidenceService';
import { getUKVerificationChecklist } from './server/services/ukRecommendationsService';

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
  if (reqBody?.latitude && reqBody?.longitude) return [Number(reqBody.latitude), Number(reqBody.longitude)];
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

function pgiFeatureProperties(evidence: any): Record<string, any> {
  const info = evidence?.value?.featureInfo;
  const features = info?.features || info?.FeatureInfo || [];
  const props = features?.[0]?.properties;
  return props && typeof props === 'object' ? props : {};
}
function pgiProperty(props: Record<string, any>, patterns: RegExp[]): any {
  const key = Object.keys(props).find(k => patterns.some(p => p.test(k)));
  return key ? props[key] : undefined;
}
function enrichGeologyFromPgi(report: any, pgiEvidence: any[]) {
  const maps = pgiEvidence.filter((x: any) => /Geological Map|Lithogenetic Map|Engineering-Geological Map/i.test(x.category || '') && x.status === 'VERIFIED');
  const boreholes = pgiEvidence.filter((x: any) => x.category === 'Boreholes' && x.status === 'VERIFIED');
  if (!maps.length && !boreholes.length) return;
  const primary = maps[0];
  const props = pgiFeatureProperties(primary);
  const geologicalUnit = pgiProperty(props, [/geolog/i, /jednost/i, /unit/i, /utwor/i, /symbol/i]) || report.geosurvey_context.geological_unit_name;
  const lithology = pgiProperty(props, [/litolog/i, /lithology/i, /rock/i, /osad/i, /material/i]) || report.geosurvey_context.lithology_type;
  const period = pgiProperty(props, [/strat/i, /wiek/i, /age/i, /okres/i, /period/i]) || report.geosurvey_context.geological_period_era;
  report.geosurvey_context = { ...report.geosurvey_context, geological_unit_name: geologicalUnit, lithology_type: lithology, geological_period_era: period, pgi_evidence_status: 'VERIFIED', pgi_map_evidence_count: maps.length, pgi_borehole_count: boreholes.length, pgi_boreholes: boreholes.map((x: any) => ({ distance_km: x.value?.distanceKm, feature_id: x.value?.featureId, properties: x.value?.properties, geological_profile: x.value?.geologicalProfileProperties })), pgi_sources: maps.map((x: any) => ({ category: x.category, source: x.sourceName, url: x.sourceUrl, status: x.status, limitation: x.limitation })) };
  report.geosurvey_context.evidence_level = 'VERIFIED';
}

function buildLocalizedSections(evidenceReport: any, language: string, locationName: string, areaSize: number): Record<string, any> {
  const de = language === 'de';
  const pl = language === 'pl';
  const soil = evidenceReport.soil;
  const terrain = evidenceReport.terrain;
  const planning = evidenceReport.planning;
  const infrastructure = evidenceReport.infrastructure;
  const environment = evidenceReport.environment;
  const valuation = evidenceReport.valuation;
  const score = evidenceReport.evidenceScore?.totalScore;
  const loc = locationName || `${evidenceReport.countryCode}`;

  const text = {
    soil: pl ? 'Dane SoilGrids wskazują modelowany profil glebowy. Parametry projektowe wymagają badań geotechnicznych na miejscu.' : de ? 'Die SoilGrids-Daten liefern ein modelliertes Bodenprofil. Bemessungsparameter müssen durch eine standortbezogene geotechnische Untersuchung bestätigt werden.' : 'SoilGrids provides a modelled soil profile. Design parameters require site-specific geotechnical investigation.',
    geohazard: pl ? 'Wstępny screening zagrożeń obejmuje osuwiska, sejsmikę, radon i zapadliska/osiadanie górnicze. Wyniki wymagają weryfikacji dla decyzji projektowych.' : de ? 'Das vorläufige Geogefahren-Screening umfasst Rutschungen, Seismik, Radon und Bergsenkung. Für Planungsentscheidungen ist eine standortbezogene Prüfung erforderlich.' : 'The preliminary geohazard screening covers landslide susceptibility, seismicity, radon and mining subsidence. Site-specific verification is required for design decisions.',
    flood: pl ? 'Ocena hydrologiczna wykorzystuje odległość do najbliższych cieków. Nie zastępuje ustawowych map zagrożenia powodziowego.' : de ? 'Die hydrologische Bewertung nutzt die Entfernung zu den nächsten Gewässern. Sie ersetzt keine amtlichen Hochwassergefahrenkarten.' : 'The hydrology assessment uses proximity to mapped watercourses. It does not replace statutory flood hazard maps.',
    planning: pl ? 'Wiążące parametry zabudowy wymagają aktualnego dokumentu planistycznego właściwej gminy.' : de ? 'Verbindliche Baurechte und Kennzahlen müssen anhand der aktuellen kommunalen Planungsunterlagen bestätigt werden.' : 'Binding development rights and parameters must be confirmed from current municipal planning documents.',
    environment: pl ? 'Ocena środowiskowa jest screeningiem przestrzennym i nie zastępuje lokalnej oceny przyrodniczej.' : de ? 'Die Umweltbewertung ist ein räumliches Screening und ersetzt keine standortbezogene ökologische Prüfung.' : 'The environmental assessment is a spatial screening and does not replace a site-specific ecological review.',
    infrastructure: pl ? 'Dane o drogach i infrastrukturze pochodzą z otwartych danych przestrzennych; warunki przyłączenia wymagają potwierdzenia przez operatorów.' : de ? 'Straßen- und Infrastrukturdaten stammen aus offenen räumlichen Daten. Anschlussbedingungen müssen von den jeweiligen Betreibern bestätigt werden.' : 'Road and infrastructure data come from open spatial data. Connection conditions require confirmation by the relevant operators.',
    market: pl ? 'Wartość jest orientacyjnym modelem statystycznym, a nie operatem szacunkowym.' : de ? 'Der Wert ist eine indikative statistische Modellrechnung und kein formelles Verkehrswertgutachten.' : 'The value is an indicative statistical model, not a formal valuation report.',
    development: pl ? 'Najważniejsze dalsze działania to potwierdzenie planowania, geotechniki, infrastruktury i ograniczeń środowiskowych.' : de ? 'Die wichtigsten nächsten Schritte sind die Bestätigung von Planung, Geotechnik, Infrastruktur und Umweltauflagen.' : 'The main next steps are confirmation of planning, geotechnics, infrastructure and environmental constraints.'
  };

  return {
    soil_and_ground: { summary: de ? 'Baugrund und Gründungsverhältnisse' : pl ? 'Warunki gruntowe i fundamentowe' : 'Ground and foundation conditions', detail: text.soil, evidence_level: soil.status, source_cited: soil.sourceName, limitation_notice: soil.limitation },
    geohazard_risk: { summary: de ? 'Geogefahren-Screening' : pl ? 'Ocena zagrożeń geologicznych' : 'Geohazard screening', detail: text.geohazard, evidence_level: terrain.geohazards.landslideSusceptibility.status, source_cited: terrain.geohazards.landslideSusceptibility.sourceName, limitation_notice: 'Screening only; specialist verification may be required.' },
    flooding_risk: { summary: de ? 'Hochwasser und Hydrologie' : pl ? 'Powodzie i hydrologia' : 'Flooding and hydrology', detail: text.flood, evidence_level: terrain.floodInundationRisk.status, source_cited: terrain.floodInundationRisk.sourceName, limitation_notice: terrain.floodInundationRisk.limitation },
    zoning_and_land_use: { summary: de ? 'Planungsrecht und Landnutzung' : pl ? 'Planowanie przestrzenne i użytkowanie terenu' : 'Planning and land use', detail: `${text.planning} ${planning.planDesignation || ''}`, evidence_level: planning.status, source_cited: planning.sourceName, limitation_notice: planning.limitation },
    building_regulations: { summary: de ? 'Bau- und Genehmigungsanforderungen' : pl ? 'Wymogi budowlane i administracyjne' : 'Building and regulatory requirements', detail: text.planning, evidence_level: 'REQUIRES_VERIFICATION', source_cited: planning.sourceName, limitation_notice: planning.documentRequired },
    environmental_factors: { summary: de ? 'Umweltfaktoren' : pl ? 'Czynniki środowiskowe' : 'Environmental factors', detail: text.environment, evidence_level: environment.status, source_cited: environment.sourceName, limitation_notice: environment.limitation },
    infrastructure_and_access: { summary: de ? 'Infrastruktur und Erschließung' : pl ? 'Infrastruktura i dostęp' : 'Infrastructure and access', detail: text.infrastructure, evidence_level: infrastructure.roadAccess.status, source_cited: infrastructure.roadAccess.sourceName, limitation_notice: 'Utility capacity and legal access require direct confirmation.' },
    market_and_comparables: { summary: de ? 'Markt und Bewertungsrahmen' : pl ? 'Rynek i kontekst wyceny' : 'Market and valuation context', detail: `${text.market} ${valuation.marketTrendDescription || ''}`, evidence_level: valuation.status, source_cited: 'Automated statistical valuation model', limitation_notice: valuation.disclaimer },
    development_cost_outlook: { summary: de ? 'Auswirkungen auf die Entwicklung' : pl ? 'Implikacje inwestycyjne' : 'Development implications', detail: `${text.development} ${loc} · ${areaSize.toLocaleString()} m² · Evidence Score ${score ?? '—'}/100.`, evidence_level: 'REQUIRES_VERIFICATION', source_cited: planning.sourceName, limitation_notice: 'No construction cost quote is generated by this screening.' }
  };
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.get('/api/cadastre/query', async (req, res) => { const lat = Number(req.query.lat); const lng = Number(req.query.lng); const country = String(req.query.country || 'PL').toUpperCase(); if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'Valid lat and lng query parameters are required.' }); if (country === 'PL') return res.json(await fetchPolandCadastralParcel(lat, lng)); const profile = getCountryProfile(country); return res.json({ success: false, message: `Direct ULDK API query is specific to Poland. Location resolved under ${profile.cadastreAuthority}.`, cadastreAuthority: profile.cadastreAuthority, portalUrl: profile.cadastrePortalUrl }); });

async function handleAnalyzeSite(req: express.Request, res: express.Response) {
  const diagnosticId = randomUUID();
  let stage = 'request-validation';
  try {
    const shape = req.body.shape || req.body.boundaryShape;
    const areaSize = Number(req.body.areaSize) || 1000;
    const countryCode = (req.body.countryCode || req.body.country || 'PL').toUpperCase();
    const language = (req.body.language || req.body.languageCode || (countryCode === 'PL' ? 'pl' : 'en')).toLowerCase();
    stage = 'site-centre';
    const [lat, lng] = getCenterFromShape(shape, req.body);
    let locationName = `${lat.toFixed(5)}, ${lng.toFixed(5)} (${countryCode})`;
    let municipality = '', countyName = '', stateName = '', roadName = '';
    let resolvedCountryCode = '';

    stage = 'reverse-geocoding';
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 3500);
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: { 'User-Agent': 'GeoSurveyEvidenceApp/4.0' }, signal: ctrl.signal });
      clearTimeout(id);
      if (r.ok) {
        const d: any = await r.json();
        if (d.display_name) locationName = d.display_name;
        if (d.address) {
          const a = d.address;
          municipality = a.city || a.town || a.village || a.municipality || a.suburb || '';
          countyName = a.county || '';
          stateName = a.state || a.province || a.region || '';
          roadName = a.road || '';
          resolvedCountryCode = String(a.country_code || '').toUpperCase();
        }
      }
    } catch (e) { console.warn(`[${diagnosticId}] Geocoding notice:`, e); }

    const countryLocationMismatch = Boolean(resolvedCountryCode && resolvedCountryCode !== countryCode && !((countryCode === 'GB') && resolvedCountryCode === 'UK'));
    stage = 'geospatial-analysis-pipeline';
    const evidenceReport = await runGeospatialAnalysisPipeline({ lat, lng, areaSizeM2: areaSize, countryCode, language, locationName, municipality, county: countyName, state: stateName, roadName });

    let pgiSiteEvidence: any[] = [];
    let ukSiteEvidence: any[] = [];
    if (countryCode === 'PL') {
      stage = 'pgi-site-evidence';
      try { pgiSiteEvidence = await queryPolandSiteEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] PIG site evidence notice:`, e); }
      stage = 'pgi-hydro-hazards';
      try { pgiSiteEvidence.push(...await queryPolandHydroAndHazards(lat, lng, 5)); } catch (e) { console.warn(`[${diagnosticId}] PIG hydro/hazard evidence notice:`, e); }
      stage = 'pgi-report-enrichment';
      if (pgiSiteEvidence.length) evidenceReport.evidenceRegistry.push(...pgiSiteEvidence);
      enrichGeologyFromPgi(evidenceReport, pgiSiteEvidence);
    } else if (countryCode === 'GB') {
      stage = 'uk-site-evidence';
      try { ukSiteEvidence = await queryUKSiteEvidence(lat, lng); } catch (e) { console.warn(`[${diagnosticId}] UK national evidence notice:`, e); }
      stage = 'uk-report-enrichment';
      if (ukSiteEvidence.length) evidenceReport.evidenceRegistry.push(...ukSiteEvidence);
      try { enrichGeologyFromBgs(evidenceReport, ukSiteEvidence); } catch (e) { console.warn(`[${diagnosticId}] BGS geology enrichment notice:`, e); }
      evidenceReport.verificationChecklist = getUKVerificationChecklist(municipality, stateName);
    }
    if (countryLocationMismatch) {
      evidenceReport.evidenceRegistry.push({ id: `country-location-mismatch-${diagnosticId}`, category: 'Location Validation', claim: `Selected country (${countryCode}) does not match the country resolved from the site coordinates (${resolvedCountryCode}).`, status: 'REQUIRES_VERIFICATION', sourceName: 'OpenStreetMap Nominatim reverse geocoding', sourceUrl: 'https://nominatim.openstreetmap.org/', datasetDate: new Date().toISOString().slice(0, 10), spatialRelationship: 'Site-centre reverse geocode', calculationMethod: 'Reverse geocode of the selected site coordinates', confidence: 'High', limitation: 'The selected country is retained for the report, but site-specific physical evidence should be interpreted using the actual coordinates.', value: { selectedCountryCode: countryCode, resolvedCountryCode } });
    }

    stage = 'report-assembly';
    const cProfile = getCountryProfile(countryCode);
    const localizedSections = buildLocalizedSections(evidenceReport, language, locationName, areaSize);
    const titles = {
      estimated_value: language === 'pl' ? 'Szacunkowa Wartość Statystyczna Gruntu' : language === 'de' ? 'Statistische Grundstücks-Wertermittlung' : language === 'fr' ? 'Valeur Vénale Indicative' : 'Indicative Statistical Land Valuation',
      confidence: language === 'pl' ? 'Wskaźnik Jakości Dowodów (Evidence Score)' : language === 'de' ? 'Evidenz-Qualitätsindex (Evidence Score)' : 'Evidence Quality Score',
      executive_summary: language === 'pl' ? 'Synteza Wykonawcza (Evidence Summary)' : language === 'de' ? 'Zusammenfassung des Gutachtens' : 'Executive Evidence Synthesis'
    };

    const technicalParameters = {
      cadastral_id_format: evidenceReport.parcel.cadastralSource,
      cadastral_parcel_id: evidenceReport.parcel.parcelId || 'Unconfirmed (Requires local cadastre extract)',
      cadastral_teryt: evidenceReport.parcel.teryt,
      cadastral_commune: evidenceReport.parcel.commune,
      cadastral_county: evidenceReport.parcel.county,
      cadastral_voivodeship: evidenceReport.parcel.voivodeship,
      cadastre_evidence_level: evidenceReport.parcel.status,
      is_official_parcel: evidenceReport.parcel.isOfficialGeometry,
      official_area_m2: evidenceReport.parcel.officialAreaM2,
      elevation_amsl: evidenceReport.terrain.elevationAmsl,
      slope_degrees: evidenceReport.terrain.averageSlopeDegrees,
      slope_percent: evidenceReport.terrain.averageSlopePercent,
      slope_category: evidenceReport.terrain.slopeCategory,
      aspect_direction: evidenceReport.terrain.aspectDirection,
      zoning_code: evidenceReport.planning.planDesignation,
      zoning_name: evidenceReport.planning.permittedUseCategory,
      max_far: evidenceReport.planning.maxFar,
      max_building_coverage_pct: evidenceReport.planning.maxCoveragePct,
      min_biologically_active_pct: evidenceReport.planning.minBiologicallyActivePct,
      max_height_m: evidenceReport.planning.maxBuildingHeightM,
      setback_m: evidenceReport.planning.setbackRules,
      utility_status: evidenceReport.infrastructure.utilities.map((u: any) => `${u.utility}: ${u.status}`).join('; '),
      groundwater_depth_m: evidenceReport.soil.estimatedWaterTableDepthM,
      groundwater_notice: evidenceReport.soil.groundwaterNotice,
      frost_depth_m: evidenceReport.soil.frostSusceptibilityClass,
      radon_index: evidenceReport.terrain.geohazards.radonPotential.classification,
      soil_bearing_capacity_kpa: evidenceReport.soil.estimatedBearingCapacityKpa
    };

    const soilMetrics = {
      usda_texture: evidenceReport.soil.usdaTextureClass,
      topsoil_sand_pct: evidenceReport.soil.topsoilSandPct,
      topsoil_silt_pct: evidenceReport.soil.topsoilSiltPct,
      topsoil_clay_pct: evidenceReport.soil.topsoilClayPct,
      subsoil_sand_pct: evidenceReport.soil.subsoilSandPct,
      subsoil_silt_pct: evidenceReport.soil.subsoilSiltPct,
      subsoil_clay_pct: evidenceReport.soil.subsoilClayPct,
      mean_bulk_density: evidenceReport.soil.meanBulkDensityGcm3,
      mean_ph: evidenceReport.soil.meanPhH2O,
      mean_soc: evidenceReport.soil.meanOrganicCarbonPct,
      bearing_capacity_kpa: evidenceReport.soil.estimatedBearingCapacityKpa,
      friction_angle_deg: evidenceReport.soil.effectiveFrictionAngleDeg,
      cohesion_kpa: evidenceReport.soil.cohesionKpa,
      hydraulic_conductivity: evidenceReport.soil.hydraulicConductivityMs,
      drainage_class: evidenceReport.soil.drainageClass,
      frost_class: evidenceReport.soil.frostSusceptibilityClass,
      topsoil_stripping_cm: evidenceReport.soil.topsoilStrippingDepthCm,
      source_name: evidenceReport.soil.sourceName
    };

    const stratigraphy = evidenceReport.soil.stratigraphyLayers.map((l: any) => ({ depth_range: l.depthRange, soil_type: l.soilType, bearing_capacity: l.mechanicalStatus, description: l.description, sand_pct: l.sandPct, silt_pct: l.siltPct, clay_pct: l.clayPct, bulk_density: l.bulkDensity, ph: l.ph, soc: l.soc }));
    const riskMatrix = [
      { category: 'Landslide susceptibility', level: evidenceReport.terrain.geohazards.landslideSusceptibility.level, evidence_level: evidenceReport.terrain.geohazards.landslideSusceptibility.status, detail: evidenceReport.terrain.geohazards.landslideSusceptibility.description },
      { category: 'Seismic hazard', level: evidenceReport.terrain.geohazards.seismicRisk.zone, evidence_level: evidenceReport.terrain.geohazards.seismicRisk.status, detail: evidenceReport.terrain.geohazards.seismicRisk.pgaG },
      { category: 'Radon potential', level: evidenceReport.terrain.geohazards.radonPotential.classification, evidence_level: evidenceReport.terrain.geohazards.radonPotential.status, detail: evidenceReport.terrain.geohazards.radonPotential.sourceName },
      { category: 'Mining subsidence', level: evidenceReport.terrain.geohazards.miningSubsidence.classification, evidence_level: evidenceReport.terrain.geohazards.miningSubsidence.status, detail: evidenceReport.terrain.geohazards.miningSubsidence.sourceName }
    ];

    const reportData = {
      site_value_estimate: { min: evidenceReport.valuation.indicativeMinPrice, max: evidenceReport.valuation.indicativeMaxPrice, median: evidenceReport.valuation.indicativeMedianPrice, currency: evidenceReport.valuation.currency, basis: evidenceReport.valuation.methodology, evidence_level: evidenceReport.valuation.status, uncertainty_rating: evidenceReport.valuation.uncertaintyRating },
      confidence_level: evidenceReport.evidenceScore.ratingClass,
      evidence_score: evidenceReport.evidenceScore,
      evidence_registry: evidenceReport.evidenceRegistry,
      verification_checklist: evidenceReport.verificationChecklist,
      summary: evidenceReport.executiveSummary,
      titles,
      geosurvey_context: { ...evidenceReport.geosurvey_context, survey_authority: evidenceReport.soil.sourceName, geological_unit_name: evidenceReport.geosurvey_context.geological_unit_name, lithology_type: evidenceReport.geosurvey_context.lithology_type, geological_period_era: evidenceReport.geosurvey_context.geological_period_era, groundwater_regime: evidenceReport.soil.groundwaterRegime, seismic_hazard_zone: evidenceReport.terrain.geohazards.seismicRisk.zone, radon_class: evidenceReport.terrain.geohazards.radonPotential.classification, official_portal_url: cProfile.geologyPortalUrl, evidence_level: evidenceReport.geosurvey_context.evidence_level || evidenceReport.soil.status },
      valuation_metrics: { price_per_sqm_min: evidenceReport.valuation.indicativeMinPrice / areaSize, price_per_sqm_max: evidenceReport.valuation.indicativeMaxPrice / areaSize, price_per_sqm_median: evidenceReport.valuation.indicativeMedianPrice / areaSize, annual_growth_pct: evidenceReport.valuation.marketTrendDescription, feasibility_rating: evidenceReport.valuation.uncertaintyRating, geohazard_risk_score: String(riskMatrix.filter((r: any) => r.level === 'High' || r.level === 'Moderate').length), permitting_timeline_months: 'Requires local planning confirmation', max_buildable_area_sqm: undefined, soil_bearing_capacity_kpa: evidenceReport.soil.estimatedBearingCapacityKpa, comparable_evidence_count: evidenceReport.valuation.comparableEvidenceCount },
      technical_parameters: technicalParameters,
      stratigraphy,
      soil_metrics: soilMetrics,
      amenity_index: evidenceReport.infrastructure.amenities.map((a: any) => ({ type: a.type, name: a.name, distance_m: a.distanceM, category: a.category })),
      surrounding_buildings_count: evidenceReport.infrastructure.surroundingBuildingsCount,
      surrounding_landuse: evidenceReport.infrastructure.surroundingLanduse,
      utilities_checklist: evidenceReport.infrastructure.utilities.map((u: any) => ({ utility: u.utility, status: u.status, evidence_level: u.status, distance_m: u.distanceM, mapped_in_dataset: u.mappedInDataset, limitation: u.limitation })),
      risk_matrix: riskMatrix,
      ...localizedSections,
      key_risks: riskMatrix.filter((r: any) => r.level === 'High' || r.level === 'Moderate').map((r: any) => `${r.category}: ${r.detail}`),
      opportunities: evidenceReport.infrastructure.amenities.slice(0, 5).map((a: any) => `${a.name || a.type} (${Math.round(a.distanceM)} m)`),
      data_sources: evidenceReport.dataSourcesCited.map(ds => ({ name: ds.name, url: ds.url, authority: ds.organization, verification_status: ds.status })),
      legal_disclaimers: evidenceReport.statutoryDisclaimers,
      location_name: locationName,
      language,
      pgi_site_evidence_count: pgiSiteEvidence.length,
      uk_site_evidence_count: ukSiteEvidence.length,
      country_location_mismatch: countryLocationMismatch ? { selected_country_code: countryCode, resolved_country_code: resolvedCountryCode } : null
    };

    const finalReport = { id: evidenceReport.id, created_at: evidenceReport.generatedAt, location_name: locationName, country: cProfile.countryName, country_code: countryCode, language, latitude: lat, longitude: lng, area_size: areaSize, boundary: shape || { type: 'circle', center: [lat, lng], radius: Math.sqrt(areaSize / Math.PI) }, official_geometry: evidenceReport.parcel.geometryPoints, is_official_parcel: evidenceReport.parcel.isOfficialGeometry, official_area_m2: evidenceReport.parcel.officialAreaM2, report_data: reportData };
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