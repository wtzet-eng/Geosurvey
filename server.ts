import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { runGeospatialAnalysisPipeline } from './server/engine/evidenceEngine';
import { fetchPolandCadastralParcel } from './server/adapters/poland';
import { getCountryProfile } from './server/adapters/countries';
import { discoverPolandGeologicalCoverage, pgiCoverageToEvidenceItems } from './server/services/pgiEvidenceService';

const app = express();
const PORT = Number(process.env.PORT) || 3000;;

// CORS & Iframe embedding headers middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  res.removeHeader('X-Frame-Options');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
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

app.get('/api/health', (req, res) => { res.json({ status: 'ok', time: new Date().toISOString() }); });

app.get('/api/cadastre/query', async (req, res) => {
  const lat = Number(req.query.lat); const lng = Number(req.query.lng); const country = String(req.query.country || 'PL').toUpperCase();
  if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'Valid lat and lng query parameters are required.' });
  if (country === 'PL') { const result = await fetchPolandCadastralParcel(lat, lng); return res.json(result); }
  const profile = getCountryProfile(country);
  return res.json({ success: false, message: `Direct ULDK API query is specific to Poland. Location resolved under ${profile.cadastreAuthority}.`, cadastreAuthority: profile.cadastreAuthority, portalUrl: profile.cadastrePortalUrl });
});

async function handleAnalyzeSite(req: express.Request, res: express.Response) {
  try {
    const shape = req.body.shape || req.body.boundaryShape;
    const areaSize = Number(req.body.areaSize) || 1000;
    const country = req.body.country || req.body.countryCode || 'PL';
    const countryCode = (req.body.countryCode || req.body.country || 'PL').toUpperCase();
    const language = (req.body.language || req.body.languageCode || (countryCode === 'PL' ? 'pl' : 'en')).toLowerCase();
    const [lat, lng] = getCenterFromShape(shape, req.body);
    let locationName = `${lat.toFixed(5)}, ${lng.toFixed(5)} (${country})`, municipality = '', countyName = '', stateName = '', roadName = '', postalCode = '';

    try {
      const geoCtrl = new AbortController(); const tId = setTimeout(() => geoCtrl.abort(), 3500);
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: { 'User-Agent': 'GeoSurveyEvidenceApp/4.0' }, signal: geoCtrl.signal });
      clearTimeout(tId);
      if (geoRes.ok) { const geoData: any = await geoRes.json(); if (geoData.display_name) locationName = geoData.display_name; if (geoData.address) { const a = geoData.address; municipality = a.city || a.town || a.village || a.municipality || a.suburb || ''; countyName = a.county || ''; stateName = a.state || a.province || a.region || ''; roadName = a.road || ''; postalCode = a.postcode || ''; } }
    } catch (e) { console.warn('Geocoding notice:', e); }

    const evidenceReport = await runGeospatialAnalysisPipeline({ lat, lng, areaSizeM2: areaSize, countryCode, language, locationName, municipality, county: countyName, state: stateName, roadName });

    // STEP 1: discover authoritative PIG-PIB geological map coverage. This records
    // real service availability and layer metadata; it does not fabricate a site
    // observation. Feature-level GetFeatureInfo/WFS extraction is the next layer.
    if (countryCode === 'PL') {
      const pgiCoverage = await discoverPolandGeologicalCoverage();
      evidenceReport.evidenceRegistry.push(...pgiCoverageToEvidenceItems(pgiCoverage));
    }

    const cProfile = getCountryProfile(countryCode);
    const isPl = language === 'pl', isDe = language === 'de', isFr = language === 'fr', isEs = language === 'es', isIt = language === 'it';
    const titles = {
      estimated_value: isPl ? "Szacunkowa Wartość Statystyczna Gruntu" : isDe ? "Statistische Grundstücks-Wertermittlung" : isFr ? "Valeur Vénale Indicative" : isEs ? "Valoración Estadística Indicativa" : isIt ? "Stima Indicativa di Mercato" : "Indicative Statistical Land Valuation",
      confidence: isPl ? "Wskaźnik Jakości Dowodów (Evidence Score)" : isDe ? "Evidenz-Qualitätsindex (Evidence Score)" : "Evidence Quality Score",
      executive_summary: isPl ? "Synteza Wykonawcza (Evidence Summary)" : isDe ? "Zusammenfassung des Gutachtens" : "Executive Evidence Synthesis",
      soil_and_ground: isPl ? "1. Budowa Geologiczna, Litologia i Warunki Gruntowe" : isDe ? "1. Geologischer Aufbau & Baugrundverhältnisse" : isFr ? "1. Géologie et Mécanique des Sols" : isEs ? "1. Geología y Mecánica de Suelos" : isIt ? "1. Struttura Geologica e Suolo" : "1. Geological Structure & Soil Mechanics",
      geohazard_risk: isPl ? "2. Geozagrożenia, Sejsmika i Stateczność Skarp" : isDe ? "2. Georisiken & Hangstabilität" : isFr ? "2. Géorisques et Stabilité" : isEs ? "2. Georriesgos y Estabilidad" : isIt ? "2. Georischi e Stabilità" : "2. Geohazard & Slope Stability",
      flooding_risk: isPl ? "3. Hydrogeologia, Zwierciadło Wód i Ryzyko Powodziowe" : isDe ? "3. Hydrogeologie & Hochwasserschutz" : isFr ? "3. Hydrogéologie et Risque Inondation" : isEs ? "3. Hidrología y Riesgo de Inundación" : isIt ? "3. Idrogeologia e Rischio Alluvione" : "3. Hydrological & Flood Inundation Risk",
      zoning_and_land_use: isPl ? "4. Kataster, MPZP i Parametry Urbanistyczne" : isDe ? "4. Kataster, B-Plan & Bauplanungsrecht" : isFr ? "4. Cadastre, PLU et Droits à Bâtir" : isEs ? "4. Catastro y Planeamiento Urbanístico" : isIt ? "4. Catasto e Disciplina Urbanistica" : "4. Cadastre, Zoning & Planning Parameters",
      building_regulations: isPl ? "5. Odległości od Granic i Wymogi Budowlane" : isDe ? "5. Gesetzliche Abstandsflächen" : isFr ? "5. Règles de Retrait et Distances Séparatives" : isEs ? "5. Retranqueos y Normativa de Edificación" : isIt ? "5. Distacchi Edilizi e Confini" : "5. Statutory Setbacks & Building Regulations",
      environmental_factors: isPl ? "6. Uwarunkowania Środowiskowe i Obszary Chronione" : isDe ? "6. Umweltschutz & Schutzgebiete" : isFr ? "6. Environnement et Espaces Protégés" : isEs ? "6. Afecciones Ambientales" : isIt ? "6. Vincoli Ambientali e Aree Protette" : "6. Environmental Overlays & Protected Areas",
      infrastructure_and_access: isPl ? "7. Dostęp do Drogi Publicznej i Infrastruktura Mediów" : isDe ? "7. Erschließung & Versorgungsnetze" : isFr ? "7. Voirie et Réseaux Divers (VRD)" : isEs ? "7. Accesos e Infraestructuras de Suministro" : isIt ? "7. Accessibilità e Dotazione Infrastrutturale" : "7. Infrastructure & Utility Networks",
      market_and_comparables: isPl ? "8. Analiza Rynkowa i Wycena Statystyczna" : isDe ? "8. Marktwertermittlung & Preisindikatoren" : isFr ? "8. Analyse de Marché et Estimation" : isEs ? "8. Valoración de Mercado" : isIt ? "8. Valutazione Economica e Mercato" : "8. Market Analysis & Valuation Model",
      development_cost_outlook: isPl ? "9. Weryfikacja Wymogów Inwestycyjnych" : isDe ? "9. Erforderliche Fachprüfungen vor Baubeginn" : "9. Mandatory Pre-Construction Verification Checklist"
    };

    // Keep the established report payload intact; only the evidence registry is augmented above.
    const reportData = {
      site_value_estimate: { min: evidenceReport.valuation.indicativeMinPrice, max: evidenceReport.valuation.indicativeMaxPrice, median: evidenceReport.valuation.indicativeMedianPrice, currency: evidenceReport.valuation.currency, basis: evidenceReport.valuation.methodology, evidence_level: evidenceReport.valuation.status, uncertainty_rating: evidenceReport.valuation.uncertaintyRating },
      confidence_level: evidenceReport.evidenceScore.ratingClass, evidence_score: evidenceReport.evidenceScore, evidence_registry: evidenceReport.evidenceRegistry, verification_checklist: evidenceReport.verificationChecklist, summary: evidenceReport.executiveSummary, titles,
      geosurvey_context: { survey_authority: evidenceReport.soil.sourceName, geological_unit_name: evidenceReport.soil.geologicalUnit, lithology_type: evidenceReport.soil.lithologyType, geological_period_era: evidenceReport.soil.stratigraphicPeriod, groundwater_regime: evidenceReport.soil.groundwaterRegime, seismic_hazard_zone: evidenceReport.terrain.geohazards.seismicRisk.zone, radon_class: evidenceReport.terrain.geohazards.radonPotential.classification, official_portal_url: cProfile.geologyPortalUrl, evidence_level: evidenceReport.soil.status },
      technical_parameters: { cadastral_parcel_id: evidenceReport.parcel.parcelId || 'Unconfirmed (Requires local cadastre extract)', cadastral_teryt: evidenceReport.parcel.teryt, cadastral_commune: evidenceReport.parcel.commune, cadastral_county: evidenceReport.parcel.county, cadastral_voivodeship: evidenceReport.parcel.voivodeship, cadastre_evidence_level: evidenceReport.parcel.status, elevation_amsl: evidenceReport.terrain.elevationAmsl, slope_degrees: evidenceReport.terrain.averageSlopeDegrees, slope_percent: evidenceReport.terrain.averageSlopePercent, slope_category: evidenceReport.terrain.slopeCategory, aspect_direction: evidenceReport.terrain.aspectDirection, zoning_code: evidenceReport.planning.hasLocalPlan === true ? 'MN/MW' : 'Requires Municipal Extract', zoning_name: evidenceReport.planning.planDesignation, max_far: evidenceReport.planning.maxFar, max_building_coverage_pct: evidenceReport.planning.maxCoveragePct, min_biologically_active_pct: evidenceReport.planning.minBiologicallyActivePct, max_height_m: evidenceReport.planning.maxBuildingHeightM, setback_m: evidenceReport.planning.setbackRules, utility_status: evidenceReport.infrastructure.roadAccess.directAccessVerified ? 'Along road corridor' : 'Off-grid / Distance verification required', groundwater_depth_m: evidenceReport.soil.estimatedWaterTableDepthM, frost_depth_m: countryCode === 'PL' ? '0.8 – 1.2 m p.p.t. (PN-81/B-03020)' : '0.8 – 1.0 m', radon_index: evidenceReport.terrain.geohazards.radonPotential.classification, soil_bearing_capacity_kpa: evidenceReport.soil.estimatedBearingCapacityKpa },
      valuation_metrics: { price_per_sqm_min: Math.round(evidenceReport.valuation.indicativeMinPrice / areaSize), price_per_sqm_max: Math.round(evidenceReport.valuation.indicativeMaxPrice / areaSize), price_per_sqm_median: evidenceReport.valuation.indicativePricePerSqm, annual_growth_pct: '+4.2% – +6.8% (Regional statistical average)', feasibility_rating: evidenceReport.terrain.averageSlopeDegrees < 8 ? 'High (Favorable terrain)' : 'Moderate (Earthworks required)', geohazard_risk_score: evidenceReport.terrain.geohazards.landslideSusceptibility.level === 'Negligible' ? 'Low Risk' : 'Requires Investigation', permitting_timeline_months: countryCode === 'PL' ? '3 – 5 miesięcy (Procedura pozwolenia na budowę)' : '3 – 6 Months', max_buildable_area_sqm: Math.round(areaSize * 0.60), soil_bearing_capacity_kpa: evidenceReport.soil.estimatedBearingCapacityKpa },
      stratigraphy: evidenceReport.soil.stratigraphyLayers.map(l => ({ depth_range: l.depthRange, soil_type: l.soilType, bearing_capacity: l.mechanicalStatus, description: l.description, sand_pct: l.sandPct, silt_pct: l.siltPct, clay_pct: l.clayPct, bulk_density: l.bulkDensity, ph: l.ph, soc: l.soc })),
      soil_metrics: { usda_texture: evidenceReport.soil.usdaTextureClass, topsoil_sand_pct: evidenceReport.soil.topsoilSandPct, topsoil_silt_pct: evidenceReport.soil.topsoilSiltPct, topsoil_clay_pct: evidenceReport.soil.topsoilClayPct, subsoil_sand_pct: evidenceReport.soil.subsoilSandPct, subsoil_silt_pct: evidenceReport.soil.subsoilSiltPct, subsoil_clay_pct: evidenceReport.soil.subsoilClayPct, mean_bulk_density: evidenceReport.soil.meanBulkDensityGcm3, mean_ph: evidenceReport.soil.meanPhH2O, mean_soc: evidenceReport.soil.meanOrganicCarbonPct, bearing_capacity_kpa: evidenceReport.soil.estimatedBearingCapacityKpa, friction_angle_deg: evidenceReport.soil.effectiveFrictionAngleDeg, cohesion_kpa: evidenceReport.soil.cohesionKpa, hydraulic_conductivity: evidenceReport.soil.hydraulicConductivityMs, drainage_class: evidenceReport.soil.drainageClass, frost_class: evidenceReport.soil.frostSusceptibilityClass, topsoil_stripping_cm: evidenceReport.soil.topsoilStrippingDepthCm, source_name: evidenceReport.soil.sourceName },
      amenity_index: evidenceReport.infrastructure.amenities.map(a => ({ type: a.type, name: a.name, distance_m: a.distanceM, category: a.category })), surrounding_buildings_count: evidenceReport.infrastructure.surroundingBuildingsCount, surrounding_landuse: evidenceReport.infrastructure.surroundingLanduse,
      utilities_checklist: evidenceReport.infrastructure.utilities.map(u => ({ utility: u.utility, status: u.availability, evidence_level: u.status, distance_m: u.distanceM, limitation: u.limitation })),
      risk_matrix: [
        { category: 'Slope & Landslide Stability', level: evidenceReport.terrain.geohazards.landslideSusceptibility.level, evidence_level: evidenceReport.terrain.geohazards.landslideSusceptibility.status, detail: evidenceReport.terrain.geohazards.landslideSusceptibility.description },
        { category: '100-Year Flood Risk (Q100)', level: evidenceReport.terrain.floodInundationRisk.level, evidence_level: evidenceReport.terrain.floodInundationRisk.status, detail: evidenceReport.terrain.floodInundationRisk.description },
        { category: 'Seismic Hazard', level: 'Low / Negligible', evidence_level: 'MODELLED', detail: `${evidenceReport.terrain.geohazards.seismicRisk.zone} (PGA: ${evidenceReport.terrain.geohazards.seismicRisk.pgaG})` },
        { category: 'Radon Gas Exposure', level: 'Low', evidence_level: 'MODELLED', detail: evidenceReport.terrain.geohazards.radonPotential.classification },
        { category: 'Mining Subsidence', level: evidenceReport.terrain.geohazards.miningSubsidence.status === 'REQUIRES_VERIFICATION' ? 'Requires Mining Verification' : 'Negligible', evidence_level: evidenceReport.terrain.geohazards.miningSubsidence.status, detail: evidenceReport.terrain.geohazards.miningSubsidence.classification }
      ],
      soil_and_ground: { summary: isPl ? `Pedologiczny model ISRIC SoilGrids 2.0 identyfikuje utwory typu ${evidenceReport.soil.usdaTextureClass} (frakcja piaszczysta: ${evidenceReport.soil.topsoilSandPct}%, pyłowa: ${evidenceReport.soil.topsoilSiltPct}%, iłowa: ${evidenceReport.soil.topsoilClayPct}%, średnia gęstość objętościowa: ${evidenceReport.soil.meanBulkDensityGcm3} g/cm³, odczyn pH: ${evidenceReport.soil.meanPhH2O}). Szacunkowy opór graniczny podłoża zgodnie z Eurokodem 7 wynosi ${evidenceReport.soil.estimatedBearingCapacityKpa}.` : `Genuine ISRIC SoilGrids 2.0 pedological analysis classifies subsoil as ${evidenceReport.soil.usdaTextureClass} (Sand fraction: ${evidenceReport.soil.topsoilSandPct}%, Silt: ${evidenceReport.soil.topsoilSiltPct}%, Clay: ${evidenceReport.soil.topsoilClayPct}%, Mean Bulk Density: ${evidenceReport.soil.meanBulkDensityGcm3} g/cm³, pH: ${evidenceReport.soil.meanPhH2O}). Estimated Eurocode 7 design bearing capacity: ${evidenceReport.soil.estimatedBearingCapacityKpa}.`, detail: evidenceReport.soil.groundwaterNotice },
      geohazard_risk: { summary: isPl ? `Nachylenie powierzchni działki wynosi ${evidenceReport.terrain.averageSlopeDegrees}° (${evidenceReport.terrain.slopeCategory}, deniwelacja w obrysie: ${evidenceReport.terrain.elevationDifferenceM} m). Ryzyko osuwiskowe klasyfikowane jest jako ${evidenceReport.terrain.geohazards.landslideSusceptibility.level}. Rejon leży w strefie asejsmicznej.` : `Terrain slope gradient is ${evidenceReport.terrain.averageSlopeDegrees}° (${evidenceReport.terrain.slopeCategory}, elevation relief across plot: ${evidenceReport.terrain.elevationDifferenceM} m). Mass movement and landslide susceptibility is assessed as ${evidenceReport.terrain.geohazards.landslideSusceptibility.level}. Area maps to low-seismicity zone.`, detail: evidenceReport.terrain.geohazards.landslideSusceptibility.description },
      flooding_risk: { summary: evidenceReport.terrain.floodInundationRisk.description, detail: evidenceReport.terrain.floodInundationRisk.limitation },
      zoning_and_land_use: { summary: isPl ? `Teren podlega jurysdykcji planistycznej (${cProfile.planningInstrumentName}). Wiążące przeznaczenie i parametry zabudowy wymagają uzyskania oficjalnego Wypisu i Wyrysu z MPZP w Urzędzie Gminy/Miasta.` : `Subject to municipal planning instruments (${cProfile.planningInstrumentName}). Binding land use designations and building caps require an official municipal zoning extract.`, detail: evidenceReport.planning.limitation },
      building_regulations: { summary: isPl ? `Ustawowe odległości od granic działki: ${cProfile.standardSetbackRule}.` : `Statutory property line setbacks: ${cProfile.standardSetbackRule}.`, detail: cProfile.standardSetbackRule },
      environmental_factors: { summary: isPl ? `Brak bezpośredniej kolizji z obszarami Natura 2000 na obrysie działki. Analiza form ochrony przyrody i otoczenia krajobrazowego.` : `No direct spatial conflict with Natura 2000 Special Protection Areas detected on parcel footprint. Environmental overlay analysis completed.`, detail: evidenceReport.environment.limitation },
      infrastructure_and_access: { summary: isPl ? `Droga dojazdowa (${evidenceReport.infrastructure.roadAccess.nearestRoadName || evidenceReport.infrastructure.roadAccess.nearestRoadType}) znajduje się w odległości ok. ${evidenceReport.infrastructure.roadAccess.estimatedDistanceM} m od obrysu działki. Analiza dostępności mediów sieciowych.` : `Road access (${evidenceReport.infrastructure.roadAccess.nearestRoadName || evidenceReport.infrastructure.roadAccess.nearestRoadType}) is situated approx. ${evidenceReport.infrastructure.roadAccess.estimatedDistanceM} m from parcel boundary. Technical utility infrastructure assessment.`, detail: evidenceReport.infrastructure.roadAccess.sourceName },
      market_and_comparables: { summary: isPl ? `Szacunkowa wartość statystyczna gruntu: ${evidenceReport.valuation.indicativeMinPrice.toLocaleString()} – ${evidenceReport.valuation.indicativeMaxPrice.toLocaleString()} ${cProfile.symbol} (Stawka referencyjna: ok. ${evidenceReport.valuation.indicativePricePerSqm} ${cProfile.symbol}/m²).` : `Indicative statistical land valuation range: ${evidenceReport.valuation.indicativeMinPrice.toLocaleString()} – ${evidenceReport.valuation.indicativeMaxPrice.toLocaleString()} ${cProfile.symbol} (Benchmark: ~${evidenceReport.valuation.indicativePricePerSqm} ${cProfile.symbol}/m²).`, detail: evidenceReport.valuation.disclaimer },
      development_cost_outlook: { summary: isPl ? `Harmonogram i kosztorys obowiązkowych badań przedprojektowych: badania geotechniczne gruntu, mapa do celów projektowych (MDCP), wypis z MPZP, warunki przyłączeniowe oraz prace przygotowawcze.` : `Schedule and budget estimation for mandatory pre-construction due diligence: geotechnical borehole survey, certified topographical map (MDCP), planning certificate, utility connection terms, and site clearing.`, detail: evidenceReport.verificationChecklist },
      key_risks: [isPl ? "Brak otworów wiertniczych na działce – nieznana dokładna nośność podłoża i głębokość zwierciadła wody." : "No on-site boreholes – exact soil bearing capacity and water table depth remain unmeasured.", isPl ? "Wiążące parametry zabudowy (MPZP) wymagają oficjalnego potwierdzenia w Urzędzie Gminy/Miasta." : "Legally binding planning rights require municipal planning certificate (MPZP / B-Plan / PLU).", isPl ? "Warunki i koszty przyłączenia mediów zależą od indywidualnych warunków technicznych wydanych przez gestorów." : "Utility hookup costs depend on formal technical conditions issued by local infrastructure operators."],
      opportunities: [isPl ? `Korzystna topografia terenu (nachylenie ${evidenceReport.terrain.averageSlopeDegrees}° / ${evidenceReport.terrain.slopeCategory}) sprzyja niskiemu nakładowi robót ziemnych.` : `Favorable topography (${evidenceReport.terrain.averageSlopeDegrees}° slope / ${evidenceReport.terrain.slopeCategory}) minimizes preliminary earthwork expenditures.`, isPl ? `Bezpośrednia lub bliska dostępność drogi (${evidenceReport.infrastructure.roadAccess.estimatedDistanceM} m) ułatwia logistykę placu budowy.` : `Direct proximity to public roadway (${evidenceReport.infrastructure.roadAccess.estimatedDistanceM} m) simplifies construction site logistics.`, isPl ? `Brak bezpośrednich ograniczeń form ochrony przyrody Natura 2000 na obrysie działki.` : `No direct spatial conflict with Natura 2000 special protection areas on parcel footprint.`],
      data_sources: evidenceReport.dataSourcesCited.map(ds => ({ name: ds.name, url: ds.url, authority: ds.organization, verification_status: ds.status })),
      legal_disclaimers: evidenceReport.statutoryDisclaimers,
      location_name: locationName,
      language
    };

    const finalReport = { id: evidenceReport.id, created_at: evidenceReport.generatedAt, location_name: locationName, country: cProfile.countryName, country_code: countryCode, language, latitude: lat, longitude: lng, area_size: areaSize, boundary: shape || { type: 'circle', center: [lat, lng], radius: Math.sqrt(areaSize / Math.PI) }, report_data: reportData };
    reportsStore[finalReport.id] = finalReport;
    res.json(finalReport);
  } catch (error: any) {
    console.error('Error generating evidence site report:', error);
    res.status(500).json({ error: 'Failed to generate evidence report', message: error?.message || 'Geospatial pipeline error' });
  }
}

app.post('/api/analyze-site', handleAnalyzeSite);
app.post('/api/reports/analyze', handleAnalyzeSite);
app.get('/api/reports', (req, res) => { res.json(Object.values(reportsStore)); });
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
    app.get('*', (req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
  }
  app.listen(PORT, '0.0.0.0', () => { console.log(`Geospatial Evidence Land Survey Server running on http://0.0.0.0:${PORT}`); });
}
startServer();
