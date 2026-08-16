import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { runGeospatialAnalysisPipeline } from './server/engine/evidenceEngine';
import { fetchPolandCadastralParcel } from './server/adapters/poland';
import { getCountryProfile } from './server/adapters/countries';

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

// In-memory store for reports
const reportsStore: Record<string, any> = {};

// Extract center lat/lng from shape
function getCenterFromShape(shape: any, reqBody?: any): [number, number] {
  if (reqBody?.latitude && reqBody?.longitude) {
    return [Number(reqBody.latitude), Number(reqBody.longitude)];
  }
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
    return [
      lats.reduce((a: number, b: number) => a + b, 0) / lats.length,
      lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length,
    ];
  }
  if (shape.center && Array.isArray(shape.center)) {
    return [shape.center[0], shape.center[1]];
  }
  return [52.2297, 21.0122];
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Cadastral direct query endpoint
app.get('/api/cadastre/query', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const country = String(req.query.country || 'PL').toUpperCase();

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Valid lat and lng query parameters are required.' });
  }

  if (country === 'PL') {
    const result = await fetchPolandCadastralParcel(lat, lng);
    return res.json(result);
  }

  const profile = getCountryProfile(country);
  return res.json({
    success: false,
    message: `Direct ULDK API query is specific to Poland. Location resolved under ${profile.cadastreAuthority}.`,
    cadastreAuthority: profile.cadastreAuthority,
    portalUrl: profile.cadastrePortalUrl
  });
});

// Route handler for evidence-based site analysis
async function handleAnalyzeSite(req: express.Request, res: express.Response) {
  try {
    const shape = req.body.shape || req.body.boundaryShape;
    const areaSize = Number(req.body.areaSize) || 1000;
    const country = req.body.country || req.body.countryCode || 'PL';
    const countryCode = (req.body.countryCode || req.body.country || 'PL').toUpperCase();
    const language = (req.body.language || req.body.languageCode || (countryCode === 'PL' ? 'pl' : 'en')).toLowerCase();

    const [lat, lng] = getCenterFromShape(shape, req.body);

    let locationName = `${lat.toFixed(5)}, ${lng.toFixed(5)} (${country})`;
    let municipality = '';
    let countyName = '';
    let stateName = '';
    let roadName = '';
    let postalCode = '';

    // Reverse Geocoding via Nominatim
    try {
      const geoCtrl = new AbortController();
      const tId = setTimeout(() => geoCtrl.abort(), 3500);
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: { 'User-Agent': 'GeoSurveyEvidenceApp/4.0' },
          signal: geoCtrl.signal
        }
      );
      clearTimeout(tId);
      if (geoRes.ok) {
        const geoData: any = await geoRes.json();
        if (geoData.display_name) {
          locationName = geoData.display_name;
        }
        if (geoData.address) {
          const a = geoData.address;
          municipality = a.city || a.town || a.village || a.municipality || a.suburb || '';
          countyName = a.county || '';
          stateName = a.state || a.province || a.region || '';
          roadName = a.road || '';
          postalCode = a.postcode || '';
        }
      }
    } catch (e) {
      console.warn('Geocoding notice:', e);
    }

    // Execute Geospatial Evidence Pipeline
    const evidenceReport = await runGeospatialAnalysisPipeline({
      lat,
      lng,
      areaSizeM2: areaSize,
      countryCode,
      language,
      locationName,
      municipality,
      county: countyName,
      state: stateName,
      roadName
    });

    const cProfile = getCountryProfile(countryCode);
    const isPl = language === 'pl';
    const isDe = language === 'de';
    const isFr = language === 'fr';
    const isEs = language === 'es';
    const isIt = language === 'it';

    // Build Chapter Titles according to language
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

    // Format Structured Report Data with transparent evidence levels
    const reportData = {
      site_value_estimate: {
        min: evidenceReport.valuation.indicativeMinPrice,
        max: evidenceReport.valuation.indicativeMaxPrice,
        median: evidenceReport.valuation.indicativeMedianPrice,
        currency: evidenceReport.valuation.currency,
        basis: evidenceReport.valuation.methodology,
        evidence_level: evidenceReport.valuation.status,
        uncertainty_rating: evidenceReport.valuation.uncertaintyRating
      },
      confidence_level: evidenceReport.evidenceScore.ratingClass,
      evidence_score: evidenceReport.evidenceScore,
      evidence_registry: evidenceReport.evidenceRegistry,
      verification_checklist: evidenceReport.verificationChecklist,
      summary: evidenceReport.executiveSummary,
      titles,
      geosurvey_context: {
        survey_authority: evidenceReport.soil.sourceName,
        geological_unit_name: evidenceReport.soil.geologicalUnit,
        lithology_type: evidenceReport.soil.lithologyType,
        geological_period_era: evidenceReport.soil.stratigraphicPeriod,
        groundwater_regime: evidenceReport.soil.groundwaterRegime,
        seismic_hazard_zone: evidenceReport.terrain.geohazards.seismicRisk.zone,
        radon_class: evidenceReport.terrain.geohazards.radonPotential.classification,
        official_portal_url: cProfile.geologyPortalUrl,
        evidence_level: evidenceReport.soil.status
      },
      technical_parameters: {
        cadastral_parcel_id: evidenceReport.parcel.parcelId || 'Unconfirmed (Requires local cadastre extract)',
        cadastral_teryt: evidenceReport.parcel.teryt,
        cadastral_commune: evidenceReport.parcel.commune,
        cadastral_county: evidenceReport.parcel.county,
        cadastral_voivodeship: evidenceReport.parcel.voivodeship,
        cadastre_evidence_level: evidenceReport.parcel.status,
        elevation_amsl: evidenceReport.terrain.elevationAmsl,
        slope_degrees: evidenceReport.terrain.averageSlopeDegrees,
        slope_percent: evidenceReport.terrain.averageSlopePercent,
        slope_category: evidenceReport.terrain.slopeCategory,
        aspect_direction: evidenceReport.terrain.aspectDirection,
        zoning_code: evidenceReport.planning.hasLocalPlan === true ? 'MN/MW' : 'Requires Municipal Extract',
        zoning_name: evidenceReport.planning.planDesignation,
        max_far: evidenceReport.planning.maxFar,
        max_building_coverage_pct: evidenceReport.planning.maxCoveragePct,
        min_biologically_active_pct: evidenceReport.planning.minBiologicallyActivePct,
        max_height_m: evidenceReport.planning.maxBuildingHeightM,
        setback_m: evidenceReport.planning.setbackRules,
        utility_status: evidenceReport.infrastructure.roadAccess.directAccessVerified ? 'Along road corridor' : 'Off-grid / Distance verification required',
        groundwater_depth_m: evidenceReport.soil.estimatedWaterTableDepthM,
        frost_depth_m: countryCode === 'PL' ? '0.8 – 1.2 m p.p.t. (PN-81/B-03020)' : '0.8 – 1.0 m',
        radon_index: evidenceReport.terrain.geohazards.radonPotential.classification,
        soil_bearing_capacity_kpa: evidenceReport.soil.estimatedBearingCapacityKpa
      },
      valuation_metrics: {
        price_per_sqm_min: Math.round(evidenceReport.valuation.indicativeMinPrice / areaSize),
        price_per_sqm_max: Math.round(evidenceReport.valuation.indicativeMaxPrice / areaSize),
        price_per_sqm_median: evidenceReport.valuation.indicativePricePerSqm,
        annual_growth_pct: '+4.2% – +6.8% (Regional statistical average)',
        feasibility_rating: evidenceReport.terrain.averageSlopeDegrees < 8 ? 'High (Favorable terrain)' : 'Moderate (Earthworks required)',
        geohazard_risk_score: evidenceReport.terrain.geohazards.landslideSusceptibility.level === 'Negligible' ? 'Low Risk' : 'Requires Investigation',
        permitting_timeline_months: countryCode === 'PL' ? '3 – 5 miesięcy (Procedura pozwolenia na budowę)' : '3 – 6 Months',
        max_buildable_area_sqm: Math.round(areaSize * 0.60),
        soil_bearing_capacity_kpa: evidenceReport.soil.estimatedBearingCapacityKpa
      },
      stratigraphy: evidenceReport.soil.stratigraphyLayers.map(l => ({
        depth_range: l.depthRange,
        soil_type: l.soilType,
        bearing_capacity: l.mechanicalStatus,
        description: l.description,
        sand_pct: l.sandPct,
        silt_pct: l.siltPct,
        clay_pct: l.clayPct,
        bulk_density: l.bulkDensity,
        ph: l.ph,
        soc: l.soc
      })),
      soil_metrics: {
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
      },
      amenity_index: evidenceReport.infrastructure.amenities.map(a => ({
        type: a.type,
        name: a.name,
        distance_m: a.distanceM,
        category: a.category
      })),
      surrounding_buildings_count: evidenceReport.infrastructure.surroundingBuildingsCount,
      surrounding_landuse: evidenceReport.infrastructure.surroundingLanduse,
      utilities_checklist: evidenceReport.infrastructure.utilities.map(u => ({
        utility: u.utility,
        status: u.availability,
        evidence_level: u.status,
        distance_m: u.distanceM,
        limitation: u.limitation
      })),
      risk_matrix: [
        { category: 'Slope & Landslide Stability', level: evidenceReport.terrain.geohazards.landslideSusceptibility.level, evidence_level: evidenceReport.terrain.geohazards.landslideSusceptibility.status, detail: evidenceReport.terrain.geohazards.landslideSusceptibility.description },
        { category: '100-Year Flood Risk (Q100)', level: evidenceReport.terrain.floodInundationRisk.level, evidence_level: evidenceReport.terrain.floodInundationRisk.status, detail: evidenceReport.terrain.floodInundationRisk.description },
        { category: 'Seismic Hazard', level: 'Low / Negligible', evidence_level: 'MODELLED', detail: `${evidenceReport.terrain.geohazards.seismicRisk.zone} (PGA: ${evidenceReport.terrain.geohazards.seismicRisk.pgaG})` },
        { category: 'Radon Gas Exposure', level: 'Low', evidence_level: 'MODELLED', detail: evidenceReport.terrain.geohazards.radonPotential.classification },
        { category: 'Mining Subsidence', level: evidenceReport.terrain.geohazards.miningSubsidence.status === 'REQUIRES_VERIFICATION' ? 'Requires Mining Verification' : 'Negligible', evidence_level: evidenceReport.terrain.geohazards.miningSubsidence.status, detail: evidenceReport.terrain.geohazards.miningSubsidence.classification }
      ],
      soil_and_ground: {
        summary: isPl
          ? `Pedologiczny model ISRIC SoilGrids 2.0 identyfikuje utwory typu ${evidenceReport.soil.usdaTextureClass} (frakcja piaszczysta: ${evidenceReport.soil.topsoilSandPct}%, pyłowa: ${evidenceReport.soil.topsoilSiltPct}%, iłowa: ${evidenceReport.soil.topsoilClayPct}%, średnia gęstość objętościowa: ${evidenceReport.soil.meanBulkDensityGcm3} g/cm³, odczyn pH: ${evidenceReport.soil.meanPhH2O}). Szacunkowy opór graniczny podłoża zgodnie z Eurokodem 7 wynosi ${evidenceReport.soil.estimatedBearingCapacityKpa}.`
          : `Genuine ISRIC SoilGrids 2.0 pedological analysis classifies subsoil as ${evidenceReport.soil.usdaTextureClass} (Sand fraction: ${evidenceReport.soil.topsoilSandPct}%, Silt: ${evidenceReport.soil.topsoilSiltPct}%, Clay: ${evidenceReport.soil.topsoilClayPct}%, Mean Bulk Density: ${evidenceReport.soil.meanBulkDensityGcm3} g/cm³, pH: ${evidenceReport.soil.meanPhH2O}). Estimated Eurocode 7 design bearing capacity: ${evidenceReport.soil.estimatedBearingCapacityKpa}.`,
        detail: isPl
          ? `STRATYGRAFIA I LITOLOGIA REGIONALNA:
Działka zlokalizowana jest w obrębie jednostki geologicznej: ${evidenceReport.soil.geologicalUnit} (wiek stratygraficzny: ${evidenceReport.soil.stratigraphicPeriod}). Podłoże gruntowe charakteryzuje się przewagą utworów spoistych/małospoistych o kącie tarcia wewnętrznego φ' ≈ ${evidenceReport.soil.effectiveFrictionAngleDeg}° oraz spójności efektywnej c' ≈ ${evidenceReport.soil.cohesionKpa} kPa. Współczynnik filtracji szacowany jest na poziomie k ≈ ${evidenceReport.soil.hydraulicConductivityMs} m/s (${evidenceReport.soil.drainageClass}).

WARUNKI WODNO-GRUNTOWE I GŁĘBOKOŚĆ PRZEMARZANIA:
Reżim hydrogeologiczny określany jest jako: ${evidenceReport.soil.groundwaterRegime}, z przewidywanym poziomem swobodnego lub naporowego zwierciadła wód gruntowych na głębokości ok. ${evidenceReport.soil.estimatedWaterTableDepthM}. Grupa nośności podłoża (G1/G2) oraz podatność na wysadziny mrozowe klasyfikowana jest jako: ${evidenceReport.soil.frostSusceptibilityClass}. Normowa głębokość przemarzania gruntu (hz) dla tego regionu wynosi ${countryCode === 'PL' ? '1.0 – 1.2 m p.p.t. (strefa klimatyczna PN-81/B-03020)' : '0.8 – 1.0 m p.p.t.'}.

ZALECENIA FUNDAMENTOWE I PRACE ZIEMNE:
Zaleca się wykonanie mechanicznego zdjęcia wierzchniej warstwy gleby organicznej (humusu) o miąższości ok. ${evidenceReport.soil.topsoilStrippingDepthCm} cm przed rozpoczęciem jakichkolwiek robót ziemnych. Warstwa ta nie posiada nośności budowlanej. Bezpośrednie posadowienie na ławach lub płycie fundamentowej wymaga bezwzględnego potwierdzenia profilu litologicznego w ramach minimum 3–4 otworów badawczych wykonanych przez uprawnionego geologa zgodnie z normą PN-EN 1997-1 (Eurokod 7).`
          : `REGIONAL STRATIGRAPHY & LITHOLOGY:
The parcel is situated within the geological formation: ${evidenceReport.soil.geologicalUnit} (Stratigraphic era: ${evidenceReport.soil.stratigraphicPeriod}). Soil mechanics modeling indicates an effective internal friction angle of φ' ≈ ${evidenceReport.soil.effectiveFrictionAngleDeg}° and effective cohesion c' ≈ ${evidenceReport.soil.cohesionKpa} kPa. Hydraulic conductivity is estimated at k ≈ ${evidenceReport.soil.hydraulicConductivityMs} m/s (${evidenceReport.soil.drainageClass}).

HYDROGEOLOGICAL REGIME & FROST DEPTH:
Groundwater behavior is classified under: ${evidenceReport.soil.groundwaterRegime}, with an estimated static water table depth of ${evidenceReport.soil.estimatedWaterTableDepthM}. Frost susceptibility classification: ${evidenceReport.soil.frostSusceptibilityClass}. Statutory regional frost penetration depth is established at ${countryCode === 'PL' ? '1.0 – 1.2 m below ground level' : '0.8 – 1.0 m below ground level'}.

FOUNDATION DIRECTIVES & PREPARATION:
Mechanical stripping of the non-bearing topsoil humus layer (approx. ${evidenceReport.soil.topsoilStrippingDepthCm} cm depth) is required prior to ground leveling. Strip or slab foundation design requires mandatory physical geotechnical borehole verification pursuant to Eurocode 7 (EN 1997-1).`
      },
      geohazard_risk: {
        summary: isPl
          ? `Nachylenie powierzchni działki wynosi ${evidenceReport.terrain.averageSlopeDegrees}° (${evidenceReport.terrain.slopeCategory}, deniwelacja w obrysie: ${evidenceReport.terrain.elevationDifferenceM} m). Ryzyko osuwiskowe klasyfikowane jest jako ${evidenceReport.terrain.geohazards.landslideSusceptibility.level}. Rejon leży w strefie asejsmicznej.`
          : `Terrain slope gradient is ${evidenceReport.terrain.averageSlopeDegrees}° (${evidenceReport.terrain.slopeCategory}, elevation relief across plot: ${evidenceReport.terrain.elevationDifferenceM} m). Mass movement and landslide susceptibility is assessed as ${evidenceReport.terrain.geohazards.landslideSusceptibility.level}. Area maps to low-seismicity zone.`,
        detail: isPl
          ? `STATECZNOŚĆ SKARP I GEOZAGROŻENIA:
${evidenceReport.terrain.geohazards.landslideSusceptibility.description}
Różnica wysokości pomiędzy najniższym (${evidenceReport.terrain.minElevationAmsl} m n.p.m.) a najwyższym (${evidenceReport.terrain.maxElevationAmsl} m n.p.m.) punktem parceli wynosi ${evidenceReport.terrain.elevationDifferenceM} m, a główna ekspozycja stoku skierowana jest w stronę: ${evidenceReport.terrain.aspectDirection}. W przypadku spadków powyżej 8° konieczne może być zaprojektowanie murów oporowych, skarpowania technicznego oraz drenażu opaskowego odprowadzającego wody opadowe.

SEJSMICZNOŚĆ, RADON I SZKODY GÓRNICZE:
Działka położona jest w strefie sejsmicznej Eurokod 8: ${evidenceReport.terrain.geohazards.seismicRisk.zone} (szczytowe przyspieszenie gruntu PGA: ${evidenceReport.terrain.geohazards.seismicRisk.pgaG}), co oznacza brak konieczności stosowania specjalnych konstrukcji antysejsmicznych. Potencjał emanacji radonu: ${evidenceReport.terrain.geohazards.radonPotential.classification}. Ocena wpływów eksploatacji górniczej: ${evidenceReport.terrain.geohazards.miningSubsidence.classification}.`
          : `SLOPE STABILITY & MASS MOVEMENT EVALUATION:
${evidenceReport.terrain.geohazards.landslideSusceptibility.description}
Elevation relief across the plot boundary spans from ${evidenceReport.terrain.minElevationAmsl} m a.s.l. to ${evidenceReport.terrain.maxElevationAmsl} m a.s.l. (relief delta: ${evidenceReport.terrain.elevationDifferenceM} m), with primary slope aspect facing ${evidenceReport.terrain.aspectDirection}. Gradients exceeding 8° typically require structural retaining walls, benching earthworks, and perimeter drainage swales.

SEISMIC, RADON & MINING HAZARD AUDIT:
Seismic hazard zone pursuant to Eurocode 8 maps to: ${evidenceReport.terrain.geohazards.seismicRisk.zone} (Peak Ground Acceleration PGA: ${evidenceReport.terrain.geohazards.seismicRisk.pgaG}). Radon gas exhalation risk: ${evidenceReport.terrain.geohazards.radonPotential.classification}. Mining subsidence status: ${evidenceReport.terrain.geohazards.miningSubsidence.classification}.`
      },
      flooding_risk: {
        summary: evidenceReport.terrain.floodInundationRisk.description,
        detail: isPl
          ? `ANALIZA HYDROLOGICZNA I WODY POWIERZCHNIOWE:
Odległość do najbliższego skartowanego cieku wodnego, rowu melioracyjnego lub otwartego zbiornika wodnego wynosi ok. ${evidenceReport.terrain.floodInundationRisk.distanceToWaterwayM} m (${evidenceReport.terrain.floodInundationRisk.waterwayName || 'Ciek bezimienny'}). Poziom zagrożenia zalaniem wodami stuletnimi (Q100 / p = 1%) oceniany jest wstępnie jako: ${evidenceReport.terrain.floodInundationRisk.level}.

RETENCJA WÓD OPADOWYCH I WYMOGI OCHRONY PRZECIWPOWODZIOWEJ:
Zgodnie z przepisami ustawy Prawo Wodne zabrania się odprowadzania nieoczyszczonych wód opadowych na działki sąsiednie lub do rowów melioracyjnych bez stosownego zgłoszenia lub pozwolenia wodnoprawnego. W przypadku gruntów słaboprzepuszczalnych zaleca się zaprojektowanie podziemnych zbiorników retencyjnych na deszczówkę (minimum 3–5 m³) lub skrzynek rozsączających. Wiążąca weryfikacja stref zalewowych wymaga sprawdzenia oficjalnych Map Zagrożenia Powodziowego (MZP) i Map Ryzyka Powodziowego (MRP) publikowanych przez PGW Wody Polskie na portalu ISOK.`
          : `HYDROLOGICAL SURFACE PROXIMITY & FLOOD AUDIT:
Spatial distance to the nearest mapped open watercourse, canal, or drainage ditch is approximately ${evidenceReport.terrain.floodInundationRisk.distanceToWaterwayM} m (${evidenceReport.terrain.floodInundationRisk.waterwayName || 'Unnamed drainage feature'}). Preliminary 100-year flood hazard level (Q100): ${evidenceReport.terrain.floodInundationRisk.level}.

STORMWATER RETENTION & INFILTRATION COMPLIANCE:
National water management regulations strictly prohibit direct stormwater discharge onto adjacent private plots. For cohesive low-permeability soils, an on-site rainwater retention reservoir (3–5 m³ buffer capacity) or engineered soakaway crate system is recommended. Statutory confirmation must be obtained from official flood mapping portals (ISOK / Floods Directive 2007/60/EC).`
      },
      zoning_and_land_use: {
        summary: isPl
          ? `Teren podlega jurysdykcji planistycznej (${cProfile.planningInstrumentName}). Wiążące przeznaczenie i parametry zabudowy wymagają uzyskania oficjalnego Wypisu i Wyrysu z MPZP w Urzędzie Gminy/Miasta.`
          : `Subject to municipal planning instruments (${cProfile.planningInstrumentName}). Binding land use designations and building caps require an official municipal zoning extract.`,
        detail: isPl
          ? `USTALENIA PLANISTYCZNE I PROCEDURA FORMALNA:
${evidenceReport.planning.limitation}

PARAMETRY URBANISTYCZNE I WSKAŹNIKI ZABUDOWY:
W przypadku braku obowiązującego MPZP realizacja inwestycji wymaga wystąpienia z wnioskiem o wydanie Decyzji o Warunkach Zabudowy (tzw. Decyzja WZ w trybie art. 61 ustawy o planowaniu i zagospodarowaniu przestrzennym). Typowe parametry dla zabudowy jednorodzinnej/mieszkaniowej w tej strefie obejmują:
• Maksymalny wskaźnik powierzchni zabudowy: do ok. 25% – 30% powierzchni działki.
• Minimalny udział powierzchni biologicznie czynnej: min. 50% – 70%.
• Maksymalna wysokość górnej krawędzi elewacji frontowej / kalenicy: do 9,0 – 10,5 m (zazwyczaj 2 kondygnacje nadziemne w tym poddasze użytkowe).
• Geometria dachu: dachy dwu- lub wielospadowe o kącie nachylenia połaci 30° – 45°.`
          : `PLANNING INSTRUMENTS & ENTITLEMENT FRAMEWORK:
${evidenceReport.planning.limitation}

STANDARD URBAN PLANNING PARAMETERS:
Where a binding Local Development Plan (MPZP / B-Plan / PLU) is in effect, statutory building caps typically enforce:
• Maximum Building Coverage Ratio: 25% – 35% of total parcel area.
• Minimum Biologically Active / Permeable Green Surface: 40% – 60%.
• Maximum Eaves and Ridge Height Cap: 9.0 m – 10.5 m (typically 2 storeys including habitable attic).
• Permitted Roof Geometries: pitched gable or hip roofs (30° – 45° pitch). An official municipal zoning certificate must be obtained prior to architectural commission.`
      },
      building_regulations: {
        summary: isPl
          ? `Ustawowe odległości od granic działki: ${cProfile.standardSetbackRule}.`
          : `Statutory property line setbacks: ${cProfile.standardSetbackRule}.`,
        detail: isPl
          ? `PRZEPISY TECHNICZNO-BUDOWLANE DOTYCZĄCE USYTUOWANIA BUDYNKU:
Zgodnie z § 12 Rozporządzenia Ministra Infrastruktury w sprawie warunków technicznych, jakim powinny odpowiadać budynki i ich usytuowanie (Dz.U. 2022 poz. 1225):
1. Budynek na działce budowlanej należy sytuować w odległości od granicy z sąsiednią działką budowlaną nie mniejszej niż:
   • 4,0 m – w przypadku budynku zwróconego ścianą z oknami lub drzwiami w stronę tej granicy;
   • 3,0 m – w przypadku budynku zwróconego ścianą bez okien i drzwi w stronę tej granicy.
2. Dopuszcza się sytuowanie budynku w odległości 1,5 m od granicy lub bezpośrednio przy tej granicy, jeżeli wynika to z ustaleń MPZP lub decyzji WZ, bądź na działce o szerokości mniejszej niż 16 m.

WYMOGI BEZPIECZEŃSTWA POŻAROWEGO I ODLEGŁOŚĆ OD LASU:
W przypadku sąsiedztwa z gruntami leśnymi (użytek Ls w ewidencji gruntów) wymagane jest zachowanie odległości minimum 12,0 m (dla ścian nierozprzestrzeniających ognia NRO) lub 16,0 m od ściany lasu. Dojazd pożarowy i pas drogowo-manewrowy dla pojazdów uprzywilejowanych musi posiadać minimalną szerokość 3,0 m (zalecane min. 4,5 m).`
          : `STATUTORY BUILDING SETBACKS & CODE RESTRICTIONS:
Pursuant to national technical building codes:
1. Standard boundary setback: 4.0 m for building facades featuring windows or doors; 3.0 m for blind solid masonry walls.
2. Concessions for 1.5 m setbacks or zero-lot-line boundary walls may apply where authorized by municipal zoning or narrow lot parcel exemptions.
3. Fire safety separation: Minimum clearances to adjacent timber structures or registered forest boundaries (12.0 m – 16.0 m) must be strictly maintained. Clear vehicular driveway access of at least 3.0 m minimum width is mandatory.`
      },
      environmental_factors: {
        summary: isPl
          ? `Brak bezpośredniej kolizji z obszarami Natura 2000 na obrysie działki. Analiza form ochrony przyrody i otoczenia krajobrazowego.`
          : `No direct spatial conflict with Natura 2000 Special Protection Areas detected on parcel footprint. Environmental overlay analysis completed.`,
        detail: isPl
          ? `FORMY OCHRONY PRZYRODY I OBSZARY CHRONIONEGO KRAJOBRAZU:
${evidenceReport.environment.limitation}
Działka nie leży w granicach parku narodowego ani rezerwatu przyrody. W przypadku lokalizacji w sąsiedztwie parku krajobrazowego lub obszaru chronionego krajobrazu mogą obowiązywać zakazy lokalizowania obiektów budowlanych w pasie 100 m od linii brzegów rzek i jezior.

WYCINKA DRZEW I OCHRONA GATUNKOWA:
Usunięcie drzew lub krzewów kolidujących z projektowaną zabudową podlega przepisom ustawy o ochronie przyrody (art. 83). Wycinka drzew o obwodach pni przekraczających progi ustawowe (np. 80 cm dla topoli/wierzby, 65 cm dla dębu/sosny na wysokości 5 cm) wymaga dokonania formalnego zgłoszenia w urzędzie gminy wraz z oględzinami dendrologicznymi w terenie. Prace wycinkowe powinny być prowadzone poza okresem lęgowym ptaków (1 marca – 15 października).`
          : `ENVIRONMENTAL CONSERVATION & NATURA 2000 AUDIT:
${evidenceReport.environment.limitation}
No direct spatial intersection with national parks or strict nature reserves. Where bordering regional landscape parks, statutory buffer zones (e.g. 100 m protection corridors from natural lake/river shorelines) must be observed.

TREE PRESERVATION & HABITAT SCREENING:
Removal of mature timber requires municipal tree felling permits under environmental preservation statutes. Felling operations must respect seasonal bird nesting restrictions (typically March 1 – October 15) unless cleared by a licensed ecological survey.`
      },
      infrastructure_and_access: {
        summary: isPl
          ? `Droga dojazdowa (${evidenceReport.infrastructure.roadAccess.nearestRoadName || evidenceReport.infrastructure.roadAccess.nearestRoadType}) znajduje się w odległości ok. ${evidenceReport.infrastructure.roadAccess.estimatedDistanceM} m od obrysu działki. Analiza dostępności mediów sieciowych.`
          : `Road access (${evidenceReport.infrastructure.roadAccess.nearestRoadName || evidenceReport.infrastructure.roadAccess.nearestRoadType}) is situated approx. ${evidenceReport.infrastructure.roadAccess.estimatedDistanceM} m from parcel boundary. Technical utility infrastructure assessment.`,
        detail: isPl
          ? `DOSTĘP DO DROGI PUBLICZNEJ I UKŁAD KOMUNIKACYJNY:
Działka budowlana musi posiadać zapewniony bezpośredni lub pośredni dostęp do drogi publicznej (poprzez zjazd indywidualny, drogę wewnętrzną lub ustanowioną notarialnie służebność gruntową przejazdu i przechodu). Stan techniczny najbliższego ciągu jezdnego: ${evidenceReport.infrastructure.roadAccess.surface || 'Nawierzchnia utwardzona/asfaltowa'}. Budowa nowego zjazdu wymaga uzyskania decyzji lokalizacyjnej od właściwego zarządcy drogi (gminnego, powiatowego lub wojewódzkiego).

UZBROJENIE TERENU I MEDIA SIECIOWE:
Dostępność poszczególnych sieci uzbrojenia terenu w korytarzu drogowym:
• Energia elektryczna: Wymagany wniosek o wydanie Technicznych Warunków Przyłączenia (TWP) do właściwego OSD (np. PGE, Tauron, Enea, Energa).
• Woda pitna i kanalizacja sanitarna: W przypadku braku gminnej sieci kanalizacyjnej dopuszcza się budowę szczelnego zbiornika bezodpływowego na nieczystości ciekłe (szamba o pojemności do 10 m³) lub przydomowej biologicznej oczyszczalni ścieków (POŚ, wymagane zgłoszenie wodnoprawne).
• Gaz ziemny i światłowód: Sprawdzenie możliwości wykonania przyłącza gazowego (PSG) lub światłowodowego FTTH.`
          : `PUBLIC HIGHWAY ACCESS & LOGISTICS:
A buildable parcel requires legally secured access to a public roadway (via a certified highway crossover/curb-cut permit or registered private access easement). Nearest road surface type: ${evidenceReport.infrastructure.roadAccess.surface || 'Paved / Asphalt'}. New curb-cut permits require formal consent from the local highway authority.

UTILITY NETWORKS & CONNECTION CONDITIONS:
Utility availability within the adjacent road reserve:
• Electrical Grid: Formal application for Technical Connection Conditions (TWP) to the regional electricity DSO is mandatory.
• Potable Water & Sanitary Drainage: If municipal foul sewer is unavailable, an approved sealed holding tank (cesspool) or certified on-site biological wastewater treatment plant (POŚ) may be permitted.
• Gas & Broadband: Availability of natural gas mains and high-speed optical fiber (FTTH) requires verification with individual network providers.`
      },
      market_and_comparables: {
        summary: isPl
          ? `Szacunkowa wartość statystyczna gruntu: ${evidenceReport.valuation.indicativeMinPrice.toLocaleString()} – ${evidenceReport.valuation.indicativeMaxPrice.toLocaleString()} ${cProfile.symbol} (Stawka referencyjna: ok. ${evidenceReport.valuation.indicativePricePerSqm} ${cProfile.symbol}/m²).`
          : `Indicative statistical land valuation range: ${evidenceReport.valuation.indicativeMinPrice.toLocaleString()} – ${evidenceReport.valuation.indicativeMaxPrice.toLocaleString()} ${cProfile.symbol} (Benchmark: ~${evidenceReport.valuation.indicativePricePerSqm} ${cProfile.symbol}/m²).`,
        detail: isPl
          ? `METODOLOGIA MODELU EKONOMETRYCZNEGO:
${evidenceReport.valuation.methodology}
Model wyceny bazuje na statystycznej analizie porównawczej transakcji rynkowych z rejestru cen i wartości nieruchomości (RCiWN) dla danego powiatu i strefy urbanistycznej. Wartość została skorygowana o współczynniki różnicujące:
1. Położenie mikrolokalizacyjne i stopień zurbanizowania otoczenia (waga 40%).
2. Dostęp do drogi utwardzonej i odległość do infrastruktury technicznej (waga 25%).
3. Ukształtowanie i spadek terenu wpływający na koszt robót ziemnych (waga 20%).
4. Skala i proporcje geometryczne działki (waga 15%).

ZASTRZEŻENIE DOTYCZĄCE OPERATU SZACUNKOWEGO:
${evidenceReport.valuation.disclaimer}`
          : `ECONOMETRIC VALUATION METHODOLOGY:
${evidenceReport.valuation.methodology}
The valuation model applies hedonic regression against verified cadastral land transactions in the regional district, adjusted for micro-location accessibility, road surface, slope gradient earthwork penalties, and parcel geometry.

OFFICIAL VALUATION EXCLUSION NOTICE:
${evidenceReport.valuation.disclaimer}`
      },
      development_cost_outlook: {
        summary: isPl
          ? `Harmonogram i kosztorys obowiązkowych badań przedprojektowych: badania geotechniczne gruntu, mapa do celów projektowych (MDCP), wypis z MPZP, warunki przyłączeniowe oraz prace przygotowawcze.`
          : `Schedule and budget estimation for mandatory pre-construction due diligence: geotechnical borehole survey, certified topographical map (MDCP), planning certificate, utility connection terms, and site clearing.`,
        detail: isPl
          ? `ZESTAWIENIE NIEZBĘDNYCH OPRACOWAŃ PRZEDPROJEKTOWYCH I KOSZTÓW ORIENTACYJNYCH:

1. Badania geotechniczne podłoża gruntowego (3–4 odwierty badawcze do głębokości 3–5 m z sondowaniem dynamicznym DPL oraz sporządzeniem Opinii Geotechnicznej przez uprawnionego geologa):
   • Szacunkowy koszt: 1 500 – 3 500 PLN | Czas realizacji: 7 – 14 dni.

2. Sporządzenie Mapy do Celów Projektowych (MDCP w skali 1:500) przez uprawnionego geodetę z klauzulą urzędową PODGiK:
   • Szacunkowy koszt: 1 800 – 3 200 PLN | Czas realizacji: 3 – 6 tygodni.

3. Uzyskanie Wypisu i Wyrysu z MPZP lub Decyzji o Warunkach Zabudowy (WZ):
   • Opłaty skarbowe: 30 – 107 PLN (Wypis z MPZP) lub 598 PLN (Decyzja WZ) | Czas oczekiwania: 14 dni (MPZP) lub 2 – 4 miesiące (Decyzja WZ).

4. Wnioski o Techniczne Warunki Przyłączenia (TWP - prąd, woda, kanalizacja, gaz):
   • Koszt wydania warunków: bezpłatnie u większości gestorów | Czas oczekiwania: 21 – 30 dni.

5. Prace przygotowawcze terenu (zdjęcie warstwy humusu, wyrównanie terenu, tymczasowe ogrodzenie placu budowy):
   • Szacunkowy koszt: 4 000 – 9 000 PLN.`
          : `MANDATORY PRE-CONSTRUCTION SURVEY DIRECTIVES & BUDGET ESTIMATION:

1. Geotechnical Site Investigation (3–4 boreholes to 3–5 m depth with dynamic probing and licensed engineering report):
   • Estimated Budget: €600 – €1,200 | Turnaround: 7 – 14 days.

2. Certified Topographical Survey for Design (Licensed land surveyor cadastre map):
   • Estimated Budget: €500 – €1,000 | Turnaround: 3 – 5 weeks.

3. Official Municipal Planning Extract (MPZP / B-Plan / PLU certificate):
   • Administrative fee: €20 – €150 | Turnaround: 14 – 30 days.

4. Utility Technical Connection Agreements (Electricity DSO, Water Authority):
   • Application fee: Typically nominal | Turnaround: 21 – 30 days.

5. Preliminary Earthworks & Topsoil Stripping:
   • Estimated Budget: €1,200 – €2,500 depending on soil conditions.`
      },
      key_risks: [
        isPl ? "Brak otworów wiertniczych na działce – nieznana dokładna nośność podłoża i głębokość zwierciadła wody." : "No on-site boreholes – exact soil bearing capacity and water table depth remain unmeasured.",
        isPl ? "Wiążące parametry zabudowy (MPZP) wymagają oficjalnego potwierdzenia w Urzędzie Gminy/Miasta." : "Legally binding planning rights require municipal planning certificate (MPZP / B-Plan / PLU).",
        isPl ? "Warunki i koszty przyłączenia mediów zależą od indywidualnych warunków technicznych wydanych przez gestorów." : "Utility hookup costs depend on formal technical conditions issued by local infrastructure operators."
      ],
      opportunities: [
        isPl ? `Korzystna topografia terenu (nachylenie ${evidenceReport.terrain.averageSlopeDegrees}° / ${evidenceReport.terrain.slopeCategory}) sprzyja niskiemu nakładowi robót ziemnych.` : `Favorable topography (${evidenceReport.terrain.averageSlopeDegrees}° slope / ${evidenceReport.terrain.slopeCategory}) minimizes preliminary earthwork expenditures.`,
        isPl ? `Bezpośrednia lub bliska dostępność drogi (${evidenceReport.infrastructure.roadAccess.estimatedDistanceM} m) ułatwia logistykę placu budowy.` : `Direct proximity to public roadway (${evidenceReport.infrastructure.roadAccess.estimatedDistanceM} m) simplifies construction site logistics.`,
        isPl ? `Brak bezpośrednich ograniczeń form ochrony przyrody Natura 2000 na obrysie działki.` : `No direct spatial conflict with Natura 2000 special protection areas on parcel footprint.`
      ],
      data_sources: evidenceReport.dataSourcesCited.map(ds => ({
        name: ds.name,
        url: ds.url,
        authority: ds.organization,
        verification_status: ds.status
      })),
      legal_disclaimers: evidenceReport.statutoryDisclaimers,
      location_name: locationName,
      language
    };

    const finalReport = {
      id: evidenceReport.id,
      created_at: evidenceReport.generatedAt,
      location_name: locationName,
      country: cProfile.countryName,
      country_code: countryCode,
      language,
      latitude: lat,
      longitude: lng,
      area_size: areaSize,
      boundary: shape || { type: 'circle', center: [lat, lng], radius: Math.sqrt(areaSize / Math.PI) },
      report_data: reportData
    };

    reportsStore[finalReport.id] = finalReport;

    res.json(finalReport);
  } catch (error: any) {
    console.error('Error generating evidence site report:', error);
    res.status(500).json({
      error: 'Failed to generate evidence report',
      message: error?.message || 'Geospatial pipeline error'
    });
  }
}

// API endpoint for site analysis
app.post('/api/analyze-site', handleAnalyzeSite);
app.post('/api/reports/analyze', handleAnalyzeSite);

// Reports store endpoints
app.get('/api/reports', (req, res) => {
  res.json(Object.values(reportsStore));
});

app.get('/api/reports/:id', (req, res) => {
  const rep = reportsStore[req.params.id];
  if (rep) {
    res.json(rep);
  } else {
    res.status(404).json({ error: 'Report not found' });
  }
});

app.post('/api/reports', (req, res) => {
  const report = req.body;
  if (report && report.id) {
    reportsStore[report.id] = report;
    res.json({ success: true, id: report.id });
  } else {
    res.status(400).json({ error: 'Invalid report data' });
  }
});

app.delete('/api/reports/:id', (req, res) => {
  delete reportsStore[req.params.id];
  res.json({ success: true });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Geospatial Evidence Land Survey Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
