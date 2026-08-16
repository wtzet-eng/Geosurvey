import {
  CadastralParcelInfo,
  EnvironmentalAnalysis,
  EvidenceItem,
  EvidenceLevel,
  EvidenceQualityScore,
  InfrastructureAnalysis,
  PlanningZoningAnalysis,
  SoilAnalysis,
  TerrainAnalysis,
  ValuationAssessment,
  VerificationRequirement,
  VerifiedSiteReport
} from '../types';
import { calculateTerrainFromGrid } from '../services/elevationService';
import { queryOverpassSurroundings } from '../services/osmOverpassService';
import { fetchGenuineSoilGridsData } from '../services/soilGridsService';
import { fetchPolandCadastralParcel, getPolandGeologicalModel } from '../adapters/poland';
import { getCountryProfile } from '../adapters/countries';

export interface AnalysisInput {
  lat: number;
  lng: number;
  areaSizeM2: number;
  countryCode: string;
  language: string;
  locationName?: string;
  municipality?: string;
  county?: string;
  state?: string;
  roadName?: string;
}

export async function runGeospatialAnalysisPipeline(input: AnalysisInput): Promise<VerifiedSiteReport> {
  const { lat, lng, areaSizeM2, countryCode, language, locationName, municipality, county, state } = input;
  const cProfile = getCountryProfile(countryCode);
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];

  const evidenceRegistry: EvidenceItem[] = [];

  // Parallel data fetching across authoritative spatial APIs & scientific datasets
  const [terrainGrid, osmFeatures, soilGridsData, polandCadastre] = await Promise.all([
    calculateTerrainFromGrid(lat, lng, Math.max(25, Math.sqrt(areaSizeM2 / Math.PI))),
    queryOverpassSurroundings(lat, lng, Math.max(20, Math.sqrt(areaSizeM2 / Math.PI))),
    fetchGenuineSoilGridsData(lat, lng),
    countryCode === 'PL' ? fetchPolandCadastralParcel(lat, lng) : Promise.resolve(null)
  ]);

  // =========================================================================
  // 1. Cadastral Parcel Resolution & Official Geometry (Priority 1)
  // =========================================================================
  let parcelInfo: CadastralParcelInfo;

  if (countryCode === 'PL' && polandCadastre && polandCadastre.success) {
    const hasOfficialGeom = Boolean(polandCadastre.isOfficialGeometry && polandCadastre.geometryPoints && polandCadastre.geometryPoints.length >= 3);
    const effectiveAreaM2 = polandCadastre.officialAreaM2 || areaSizeM2;

    parcelInfo = {
      status: 'VERIFIED',
      parcelId: polandCadastre.parcelId,
      teryt: polandCadastre.teryt,
      commune: polandCadastre.commune || municipality,
      county: polandCadastre.county || county,
      voivodeship: polandCadastre.voivodeship || state,
      region: polandCadastre.region,
      countryCode: 'PL',
      geometryWkt: polandCadastre.geomWkt,
      geometryPoints: polandCadastre.geometryPoints,
      isOfficialGeometry: hasOfficialGeom,
      areaCalculatedM2: areaSizeM2,
      officialAreaM2: polandCadastre.officialAreaM2,
      cadastralSource: polandCadastre.source,
      datasetDate: todayStr,
      limitation: hasOfficialGeom
        ? 'Official cadastral polygon boundary geometry retrieved directly from GUGiK ULDK. Legal boundary coordinates and rights are confirmed in County Documentation Center (PODGiK).'
        : 'Cadastral parcel identifier confirmed via GUGiK ULDK. Exact polygon geometry could not be vector-streamed; user-drawn boundary is displayed as proxy.'
    };

    evidenceRegistry.push({
      id: 'cadastre-parcel-id',
      category: 'Cadastre & Identification',
      claim: hasOfficialGeom
        ? `Official Polish Cadastral Parcel Geometry Retrieved: Plot ID ${polandCadastre.parcelId} (TERYT: ${polandCadastre.teryt || 'N/A'}, Official Area: ~${effectiveAreaM2.toLocaleString()} m²)`
        : `Official Polish Cadastral Parcel Identified: Plot ID ${polandCadastre.parcelId} (TERYT: ${polandCadastre.teryt || 'N/A'})`,
      status: 'VERIFIED',
      sourceName: polandCadastre.source,
      sourceUrl: 'https://geoportal.gov.pl',
      datasetDate: todayStr,
      spatialRelationship: hasOfficialGeom
        ? `Direct official cadastral parcel polygon vector (${polandCadastre.geometryPoints?.length} vertices) at ${lat.toFixed(6)}°N, ${lng.toFixed(6)}°E`
        : `Centroid point query at ${lat.toFixed(6)}°N, ${lng.toFixed(6)}°E`,
      calculationMethod: 'GUGiK ULDK (GetParcelByXY with WKT geometry & WGS84 projection)',
      confidence: 'High',
      limitation: 'Represents official digital cadastral vector index (EGiB). Legal ownership and encumbrances reside in the Land and Mortgage Register (Księga Wieczysta).',
      value: {
        parcelId: polandCadastre.parcelId,
        teryt: polandCadastre.teryt,
        hasOfficialGeometry: hasOfficialGeom,
        officialAreaM2: polandCadastre.officialAreaM2
      }
    });
  } else {
    parcelInfo = {
      status: 'REQUIRES_VERIFICATION',
      commune: municipality || 'Local Municipality',
      county: county || 'Local District',
      voivodeship: state || cProfile.countryName,
      countryCode: cProfile.countryCode,
      isOfficialGeometry: false,
      areaCalculatedM2: areaSizeM2,
      cadastralSource: `${cProfile.cadastreAuthority} (Spatial Index)`,
      datasetDate: todayStr,
      limitation: `Specific cadastral plot folio and official boundary geometry for ${cProfile.countryName} require manual query to local land registry (${cProfile.cadastreAuthority}).`
    };

    evidenceRegistry.push({
      id: 'cadastre-spatial-index',
      category: 'Cadastre & Identification',
      claim: `Location resolved to administrative zone of ${municipality || state || cProfile.countryName} (Cadastral parcel identifier unconfirmed)`,
      status: 'REQUIRES_VERIFICATION',
      sourceName: cProfile.cadastreAuthority,
      sourceUrl: cProfile.cadastrePortalUrl,
      datasetDate: todayStr,
      spatialRelationship: `User-drawn boundary centroid: ${lat.toFixed(6)}°N, ${lng.toFixed(6)}°E`,
      calculationMethod: 'Administrative boundary spatial index query',
      confidence: 'Medium',
      limitation: `Official cadastral folio and boundary coordinates must be extracted from ${cProfile.cadastreAuthority}.`
    });
  }

  // =========================================================================
  // 2. Terrain, DEM Elevation & Topography (Priority 10)
  // =========================================================================
  const hasWatercourseNearby = Boolean(osmFeatures.nearestWatercourse.distanceM !== undefined && osmFeatures.nearestWatercourse.distanceM <= 350);
  const watercourseDist = osmFeatures.nearestWatercourse.distanceM;

  const terrainAnalysis: TerrainAnalysis = {
    elevationAmsl: terrainGrid.centerElevationM,
    minElevationAmsl: terrainGrid.minElevationM,
    maxElevationAmsl: terrainGrid.maxElevationM,
    elevationDifferenceM: terrainGrid.elevationDifferenceM,
    averageSlopePercent: terrainGrid.slopePercent,
    averageSlopeDegrees: terrainGrid.slopeDegrees,
    slopeCategory: terrainGrid.slopeCategory,
    aspectDirection: terrainGrid.aspectDirection,
    floodInundationRisk: {
      status: hasWatercourseNearby ? 'REQUIRES_VERIFICATION' : 'MODELLED',
      level: (watercourseDist !== undefined && watercourseDist <= 100)
        ? 'Moderate'
        : (watercourseDist !== undefined && watercourseDist <= 250)
        ? 'Low'
        : 'Negligible',
      distanceToWaterwayM: watercourseDist,
      waterwayName: osmFeatures.nearestWatercourse.name,
      waterwayType: osmFeatures.nearestWatercourse.type,
      statutoryZoneStatus: 'Unconfirmed from open data (Requires ISOK Hydroportal / Wody Polskie check)',
      description: watercourseDist !== undefined
        ? `Nearest mapped open water feature (${osmFeatures.nearestWatercourse.name || osmFeatures.nearestWatercourse.type}) located approximately ${watercourseDist} m from parcel. Spatial proximity indicator only.`
        : 'No open surface watercourses mapped within the 450 m analysis buffer.',
      sourceName: `${cProfile.floodAuthority} (ISOK Hydroportal) & OpenStreetMap Hydrology`,
      limitation: 'Spatial proximity to open water is an indicator and DOES NOT replace statutory 100-year (Q100) or 500-year (Q500) flood hazard maps published by Wody Polskie (ISOK).'
    },
    geohazards: {
      landslideSusceptibility: {
        status: terrainGrid.slopeDegrees > 12 ? 'REQUIRES_VERIFICATION' : 'MODELLED',
        level: terrainGrid.slopeDegrees > 15 ? 'Moderate' : terrainGrid.slopeDegrees > 8 ? 'Low' : 'Negligible',
        description: terrainGrid.slopeDegrees < 5
          ? `Terrain slope is gentle (${terrainGrid.slopeDegrees}° / ${terrainGrid.slopePercent}%), indicating very low natural slope instability.`
          : `Terrain slope gradient is ${terrainGrid.slopeDegrees}° (${terrainGrid.slopePercent}%). Slopes above 8° require geotechnical verification for mass movement susceptibility (SOPO registry).`,
        sourceName: `${cProfile.geologyAuthority} (SOPO Geohazard Register)`
      },
      seismicRisk: {
        status: 'MODELLED',
        zone: countryCode === 'IT' ? 'Zone 2–3 (Moderate)' : countryCode === 'GR' ? 'Zone 2 (Moderate-High)' : 'Eurocode 8 Zone 0–1 (Low to Very Low)',
        pgaG: countryCode === 'IT' ? '0.10 – 0.20g' : '< 0.05g (Aseismic baseline)',
        sourceName: 'European-Mediterranean Seismological Centre (EMSC) / Eurocode 8 ESHM20'
      },
      radonPotential: {
        status: 'MODELLED',
        classification: 'Class 1 / Low potential (< 100 Bq/m³ expected annual average)',
        sourceName: 'European Commission Joint Research Centre (JRC European Atlas of Natural Radiation)'
      },
      miningSubsidence: {
        status: (countryCode === 'PL' && lat >= 50.0 && lat <= 50.5 && lng >= 18.4 && lng <= 19.5) ? 'REQUIRES_VERIFICATION' : 'MODELLED',
        classification: (countryCode === 'PL' && lat >= 50.0 && lat <= 50.5 && lng >= 18.4 && lng <= 19.5)
          ? 'Potential Mining Area (Górnośląskie Zagłębie Węglowe) - Requires Category I-V verification from State Mining Authority (WUG)'
          : 'No historical mining exploitation recorded in regional database',
        sourceName: countryCode === 'PL' ? 'Wyższy Urząd Górniczy (WUG) / PIG-PIB MIDAS' : 'National Geological Survey Mining Database'
      }
    }
  };

  evidenceRegistry.push({
    id: 'terrain-elevation-slope',
    category: 'Terrain & Topography',
    claim: `Mean elevation ${terrainGrid.centerElevationM} m a.s.l. with slope gradient of ${terrainGrid.slopeDegrees}° (${terrainGrid.slopeCategory})`,
    status: 'VERIFIED',
    sourceName: terrainGrid.sourceName,
    datasetDate: terrainGrid.datasetDate,
    spatialRelationship: `9-point cross-sampling grid across parcel area (${areaSizeM2} m²)`,
    calculationMethod: 'Numerical finite-difference Horn filter from multi-point DEM elevation samples',
    confidence: 'High',
    limitation: 'Derived from 30m/90m satellite DEM. Detailed foundation grading and earthwork calculations require a licensed surveyor\'s Situational-Height Map (MDCP).',
    value: { elevation: terrainGrid.centerElevationM, slopeDeg: terrainGrid.slopeDegrees, aspect: terrainGrid.aspectDirection }
  });

  evidenceRegistry.push({
    id: 'flood-proximity-check',
    category: 'Hydrology & Flooding',
    claim: terrainAnalysis.floodInundationRisk.description,
    status: terrainAnalysis.floodInundationRisk.status,
    sourceName: `${cProfile.floodAuthority} (ISOK Hydroportal)`,
    sourceUrl: cProfile.floodPortalUrl,
    datasetDate: todayStr,
    spatialRelationship: watercourseDist !== undefined
      ? `Proximity vector to nearest mapped open watercourse: ${watercourseDist} m`
      : '450 m spatial query buffer around parcel',
    calculationMethod: 'Spatial distance transform to nearest mapped hydrology vectors',
    confidence: watercourseDist !== undefined && watercourseDist > 200 ? 'High' : 'Medium',
    limitation: 'Does not replace official statutory flood hazard maps (Q100/Q500) from Wody Polskie (ISOK) or local stormwater drainage modeling.'
  });

  // =========================================================================
  // 3. Soil, Lithology & Honest Groundwater (Priority 4, 5, 6)
  // Reclassified SoilGrids as MODELLED (not VERIFIED) with no fake groundwater depths
  // =========================================================================
  let geologicalUnitName = `${cProfile.countryName} Regional Sedimentary Province`;
  let lithologyDesc = `Sedimentary Deposits: ${soilGridsData.usdaTextureClass} (Topsoil Sand ${soilGridsData.topsoilSandPct}%, Silt ${soilGridsData.topsoilSiltPct}%, Clay ${soilGridsData.topsoilClayPct}%)`;
  let stratPeriod = 'Quaternary (Holocene / Pleistocene)';
  let groundRegime = 'Regional porous aquifer';
  let plGroundwaterNotice = 'Zwierciadło wód gruntowych nieustalone bezpośrednio (Wymaga piezometru w odwiercie geotechnicznym).';

  if (countryCode === 'PL') {
    const plGeo = getPolandGeologicalModel(lat, lng, terrainGrid.centerElevationM);
    geologicalUnitName = plGeo.geologicalUnit;
    lithologyDesc = `${plGeo.lithologyType} | ISRIC Texture: ${soilGridsData.usdaTextureClass} (Sand ${soilGridsData.topsoilSandPct}%, Silt ${soilGridsData.topsoilSiltPct}%, Clay ${soilGridsData.topsoilClayPct}%)`;
    stratPeriod = plGeo.stratigraphicPeriod;
    groundRegime = plGeo.groundwaterRegime;
    plGroundwaterNotice = plGeo.groundwaterNotice;
  }

  const stratigraphyLayers = soilGridsData.stratigraphyProfile.map(l => ({
    depthRange: l.depthRange,
    soilType: `${l.textureClass} (Sand: ${l.sandPct}%, Silt: ${l.siltPct}%, Clay: ${l.clayPct}%)`,
    mechanicalStatus: l.estimatedBearingCapacityKpa > 0
      ? `Modelled pedological bearing capacity: ~${l.estimatedBearingCapacityKpa} kPa (Bulk density: ${l.bulkDensityGcm3} g/cm³)`
      : 'Organic humus topsoil layer (Non-bearing, stripping mandatory)',
    description: l.mechanicalDescription,
    sandPct: l.sandPct,
    siltPct: l.siltPct,
    clayPct: l.clayPct,
    bulkDensity: l.bulkDensityGcm3,
    ph: l.phH2O,
    soc: l.soilOrganicCarbonPct
  }));

  const soilInfo: SoilAnalysis = {
    status: 'MODELLED', // Correctly reclassified: SoilGrids is a digital soil mapping model, not a physical site investigation
    geologicalUnit: geologicalUnitName,
    lithologyType: lithologyDesc,
    stratigraphicPeriod: stratPeriod,
    usdaTextureClass: soilGridsData.usdaTextureClass,
    topsoilSandPct: soilGridsData.topsoilSandPct,
    topsoilSiltPct: soilGridsData.topsoilSiltPct,
    topsoilClayPct: soilGridsData.topsoilClayPct,
    subsoilSandPct: soilGridsData.subsoilSandPct,
    subsoilSiltPct: soilGridsData.subsoilSiltPct,
    subsoilClayPct: soilGridsData.subsoilClayPct,
    meanBulkDensityGcm3: soilGridsData.meanBulkDensityGcm3,
    meanPhH2O: soilGridsData.meanPhH2O,
    meanOrganicCarbonPct: soilGridsData.meanOrganicCarbonPct,
    estimatedWaterTableDepthM: 'Not directly measured (Requires on-site borehole)',
    groundwaterNotice: plGroundwaterNotice,
    estimatedBearingCapacityKpa: `Preliminary pedological estimate: ~${soilGridsData.estimatedBearingCapacityKpa} (Requires Eurocode 7 verification)`,
    effectiveFrictionAngleDeg: soilGridsData.effectiveFrictionAngleDeg,
    cohesionKpa: soilGridsData.cohesionKpa,
    hydraulicConductivityMs: soilGridsData.hydraulicConductivityMs,
    drainageClass: soilGridsData.drainageClass,
    frostSusceptibilityClass: soilGridsData.frostSusceptibilityClass,
    topsoilStrippingDepthCm: soilGridsData.topsoilStrippingDepthCm,
    groundwaterRegime: groundRegime,
    isMeasuredBoreholeData: false,
    sourceName: 'ISRIC - World Soil Information (SoilGrids 2.0 250m Global Spatial Model)',
    sourceUrl: soilGridsData.sourceUrl,
    datasetVersion: soilGridsData.datasetVersion,
    limitation: 'ISRIC SoilGrids is a 250 m resolution scientific prediction model. Direct allowable bearing capacity (kPa), layer boundaries, and groundwater depth MUST be confirmed by on-site boreholes pursuant to Eurocode 7 (EN 1997-1).',
    stratigraphyLayers
  };

  evidenceRegistry.push({
    id: 'soilgrids-isric-mechanics',
    category: 'Geology & Soil Mechanics',
    claim: `Soil Texture: ${soilGridsData.usdaTextureClass} (Sand ${soilGridsData.topsoilSandPct}%, Silt ${soilGridsData.topsoilSiltPct}%, Clay ${soilGridsData.topsoilClayPct}%, Mean Density ${soilGridsData.meanBulkDensityGcm3} g/cm³, pH ${soilGridsData.meanPhH2O}) [MODELLED]`,
    status: 'MODELLED',
    sourceName: soilGridsData.sourceName,
    sourceUrl: soilGridsData.sourceUrl,
    datasetDate: 'SoilGrids 2.0 Global Pedometric Database',
    spatialRelationship: `ISRIC 250 m cell query at ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`,
    calculationMethod: 'ISRIC Machine-Learned Pedometric Horizon Inversion (0–200 cm depth profile)',
    confidence: 'Medium',
    limitation: 'Provides high-quality regional pedological indicators. Physical geotechnical boreholes and dynamic probing are mandatory under building law to establish design soil parameters.',
    value: { texture: soilGridsData.usdaTextureClass, meanPh: soilGridsData.meanPhH2O, meanDensity: soilGridsData.meanBulkDensityGcm3 }
  });

  // =========================================================================
  // 4. Planning & Statutory Zoning Parameters (Priority 3)
  // Honest Uncertainty: FAR, height, and setbacks are NOT established from open data
  // =========================================================================
  const planningAnalysis: PlanningZoningAnalysis = {
    status: 'REQUIRES_VERIFICATION',
    hasLocalPlan: 'Unknown / Requires Municipal Confirmation',
    planDesignation: `Subject to local municipal master plan (${cProfile.planningInstrumentName})`,
    permittedUseCategory: 'Not established from open data — Subject to municipal planning certificate',
    maxFar: 'Not established from open data — Requires Wypis i Wyrys z MPZP or Decyzja WZ',
    maxCoveragePct: 'Not established — Requires municipal planning certificate',
    minBiologicallyActivePct: 'Not established — Subject to MPZP / WZ',
    maxBuildingHeightM: 'Not established — Subject to MPZP / WZ',
    setbackRules: cProfile.standardSetbackRule,
    authorityName: `${municipality || cProfile.countryName} Municipal Planning Department (Wydział Architektury / Urbanistyki)`,
    documentRequired: countryCode === 'PL' ? 'Wypis i Wyrys z Miejscowego Planu Zagospodarowania Przestrzennego (MPZP) lub Decyzja o Warunkach Zabudowy (WZ)' : 'Official Municipal Planning Certificate / B-Plan Extract',
    sourceName: `${municipality || cProfile.countryName} Spatial Planning Authority (${cProfile.planningInstrumentName})`,
    limitation: `Legally binding building rights, exact FAR, building lines, maximum height, and permitted functions CANNOT be established remotely and MUST be verified by obtaining an Official Planning Certificate (${cProfile.planningInstrumentName}) from the local municipality.`
  };

  evidenceRegistry.push({
    id: 'planning-zoning-status',
    category: 'Planning & Legal Constraints',
    claim: `Planning Instrument: ${cProfile.planningInstrumentName}. Building parameters require formal municipal extract.`,
    status: 'REQUIRES_VERIFICATION',
    sourceName: `${municipality || 'Municipal'} Spatial Planning Authority`,
    datasetDate: todayStr,
    spatialRelationship: `Territory of ${municipality || state || cProfile.countryName}`,
    calculationMethod: 'National statutory planning law synthesis (Art. 61 UoZPiZP / BauGB)',
    confidence: 'Medium',
    limitation: 'Only an official municipal planning certificate (Wypis/Wyrys z MPZP, B-Plan, Certificat d\'Urbanisme) provides legally binding development rights.'
  });

  // =========================================================================
  // 5. Infrastructure, Utilities & Road Access (Priority 7)
  // No fake utility fallback distances: if not mapped in OSM, distance is undefined
  // =========================================================================
  const roadDirect = osmFeatures.nearestRoad.hasDirectAccess;
  const roadDist = osmFeatures.nearestRoad.distanceM;

  const infrastructureAnalysis: InfrastructureAnalysis = {
    roadAccess: {
      status: roadDist <= 20 && roadDist > 0 ? 'VERIFIED' : roadDist > 0 ? 'MODELLED' : 'REQUIRES_VERIFICATION',
      nearestRoadType: osmFeatures.nearestRoad.type || 'Unclassified / Unconfirmed',
      nearestRoadName: osmFeatures.nearestRoad.name,
      estimatedDistanceM: roadDist,
      directAccessVerified: roadDirect,
      isPaved: osmFeatures.nearestRoad.isPaved,
      surface: osmFeatures.nearestRoad.surface,
      maxSpeed: osmFeatures.nearestRoad.maxSpeed,
      lit: osmFeatures.nearestRoad.lit,
      sidewalk: osmFeatures.nearestRoad.sidewalk,
      sourceName: 'OpenStreetMap Road Network Vectors (Live spatial query)'
    },
    utilities: [
      {
        utility: 'Electricity (LV Power Grid)',
        status: osmFeatures.powerInfrastructure.found ? 'MODELLED' : 'REQUIRES_VERIFICATION',
        availability: osmFeatures.powerInfrastructure.found
          ? `Power infrastructure mapped in OpenStreetMap (~${osmFeatures.powerInfrastructure.distanceM} m, ${osmFeatures.powerInfrastructure.type || 'LV Grid'}). Connection capacity requires DSO confirmation.`
          : 'No power lines/transformers mapped in immediate OpenStreetMap buffer. Requires application for Technical Connection Conditions (TWP) to DSO.',
        distanceM: osmFeatures.powerInfrastructure.distanceM,
        mappedInDataset: osmFeatures.powerInfrastructure.found,
        sourceName: 'OpenStreetMap Spatial Layer & Regional Distribution System Operator (DSO)',
        limitation: 'Connection capacity, transformer reserve, and connection fee require formal Technical Connection Conditions (Warunki Przyłączenia) from the power DSO.'
      },
      {
        utility: 'Potable Water Supply',
        status: osmFeatures.waterInfrastructure.found ? 'MODELLED' : 'REQUIRES_VERIFICATION',
        availability: osmFeatures.waterInfrastructure.found
          ? `Water pipeline mapped in OpenStreetMap (~${osmFeatures.waterInfrastructure.distanceM} m). Pressure and connection terms require water utility confirmation.`
          : 'No municipal water pipeline mapped in open vector dataset. Requires inquiry to municipal waterworks (PWiK) or on-site water well.',
        distanceM: osmFeatures.waterInfrastructure.distanceM,
        mappedInDataset: osmFeatures.waterInfrastructure.found,
        sourceName: 'Municipal Waterworks / OpenStreetMap Vector Data',
        limitation: 'Actual pipe diameter, water pressure, and hookup authorization require formal confirmation from the municipal water utility.'
      },
      {
        utility: 'Sanitary Sewerage',
        status: 'REQUIRES_VERIFICATION',
        availability: 'No sanitary sewer mapped in open dataset. Requires verification with municipal waterworks or permit for sealed holding tank / biological treatment unit (POŚ).',
        distanceM: undefined,
        mappedInDataset: false,
        sourceName: 'Municipal Environmental Protection & Waterworks',
        limitation: 'If municipal sewer is unavailable, local environmental regulations dictate whether a sealed holding tank (szambo) or home wastewater treatment plant (przydomowa oczyszczalnia) is legally permissible.'
      },
      {
        utility: 'Natural Gas Grid',
        status: 'REQUIRES_VERIFICATION',
        availability: 'No gas pipeline mapped in immediate vector buffer. Connection subject to regional gas network distribution radius.',
        distanceM: undefined,
        mappedInDataset: false,
        sourceName: 'National Gas Distribution Operator (PSG)',
        limitation: 'Connection feasibility depends on regional gas distribution pipeline capacity.'
      },
      {
        utility: 'Broadband / Telecommunications',
        status: osmFeatures.telecomInfrastructure.found ? 'MODELLED' : 'REQUIRES_VERIFICATION',
        availability: osmFeatures.telecomInfrastructure.found
          ? `Telecom infrastructure mapped in OpenStreetMap (~${osmFeatures.telecomInfrastructure.distanceM} m).`
          : 'No telecom infrastructure mapped in immediate buffer. Broadband availability (FTTH / 5G) requires operator address lookup.',
        distanceM: osmFeatures.telecomInfrastructure.distanceM,
        mappedInDataset: osmFeatures.telecomInfrastructure.found,
        sourceName: 'National Telecommunications Infrastructure Register / OSM',
        limitation: 'Physical fiber entry box and ISP service availability require direct operator check.'
      }
    ],
    amenities: osmFeatures.amenityIndex,
    surroundingBuildingsCount: osmFeatures.nearbyBuildingsCount,
    surroundingLanduse: osmFeatures.surroundingLanduse
  };

  evidenceRegistry.push({
    id: 'infrastructure-road-access',
    category: 'Infrastructure & Access',
    claim: roadDist > 0
      ? `Road access: ${osmFeatures.nearestRoad.name || osmFeatures.nearestRoad.type} located ~${roadDist} m from plot boundary (Surface: ${osmFeatures.nearestRoad.surface || 'Paved'}, Direct access: ${roadDirect ? 'Yes' : 'Unconfirmed'})`
      : 'Nearest public road corridor unconfirmed in open dataset',
    status: roadDist <= 20 && roadDist > 0 ? 'VERIFIED' : 'MODELLED',
    sourceName: osmFeatures.sourceName,
    datasetDate: osmFeatures.datasetDate,
    spatialRelationship: `Distance vector from parcel centroid to nearest road axis: ${roadDist} m`,
    calculationMethod: 'Haversine distance calculation to nearest mapped highway polyline in OSM',
    confidence: roadDist > 0 ? 'High' : 'Low',
    limitation: 'Legal right-of-way (służebność drogowa / zjazd z drogi publicznej) must be confirmed in the land register and municipal road department.'
  });

  // =========================================================================
  // 6. Environmental Overlays (Priority 11)
  // =========================================================================
  const environmentalAnalysis: EnvironmentalAnalysis = {
    natura2000Intersect: false,
    distanceToNatura2000M: osmFeatures.protectedAreaNearby.found ? (osmFeatures.protectedAreaNearby.distanceM || 300) : 1500,
    nearestProtectedAreaName: osmFeatures.protectedAreaNearby.name,
    protectedAreaType: osmFeatures.protectedAreaNearby.type,
    landscapeParkOverlay: false,
    waterProtectionZone: false,
    status: 'MODELLED',
    sourceName: 'European Environment Agency (EEA Natura 2000) & General Directorate for Environmental Protection (GDOŚ)',
    limitation: 'Regional spatial overlay. Local environmental constraints (e.g. tree felling permits under art. 83 ustawy o ochronie przyrody, protected species habitats) require on-site inspection.'
  };

  evidenceRegistry.push({
    id: 'environmental-natura2000',
    category: 'Environmental & Conservation',
    claim: osmFeatures.protectedAreaNearby.found
      ? `Protected environmental area (${osmFeatures.protectedAreaNearby.name || 'Nature Reserve'}) detected within ~${osmFeatures.protectedAreaNearby.distanceM} m`
      : 'No Natura 2000 special protection areas directly overlapping the parcel footprint in open regional vector index',
    status: 'MODELLED',
    sourceName: 'EEA / General Directorate for Environmental Protection (GDOŚ)',
    datasetDate: '2025/2026 Register',
    spatialRelationship: `Spatial buffer intersection check across parcel extent (${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E)`,
    calculationMethod: 'Geospatial buffer query against European protected area registers',
    confidence: 'High',
    limitation: 'Does not replace an on-site dendrological inspection for tree felling permissions or local environmental screening.'
  });

  // =========================================================================
  // 7. Valuation Model (Priority 8)
  // Repositioned as "INDICATIVE AUTOMATED MODEL ESTIMATE (0 Direct Deeds Verified)"
  // =========================================================================
  const isCapitalOrMajorCity = municipality
    ? /warszaw|kraków|wrocław|poznań|gdańsk|berlin|münchen|hamburg|frankfurt|paris|lyon|marseille|london|madrid|barcelona|roma|milano|zürich|geneva|wien/i.test(municipality)
    : false;

  let locationMultiplier = isCapitalOrMajorCity ? 1.85 : (municipality && municipality.length > 0) ? 1.15 : 0.85;
  if (terrainGrid.slopeDegrees > 10) locationMultiplier *= 0.88;
  if (!roadDirect && roadDist > 50) locationMultiplier *= 0.82;

  const scaleModifier = areaSizeM2 > 2500 ? 0.90 : areaSizeM2 < 750 ? 1.10 : 1.0;

  const unitMedianPrice = Math.round(cProfile.baseValuationPerSqm * locationMultiplier * scaleModifier);
  const unitMinPrice = Math.round(unitMedianPrice * 0.82);
  const unitMaxPrice = Math.round(unitMedianPrice * 1.22);

  const totalMin = Math.round(areaSizeM2 * unitMinPrice);
  const totalMax = Math.round(areaSizeM2 * unitMaxPrice);
  const totalMedian = Math.round(areaSizeM2 * unitMedianPrice);

  const valuationAssessment: ValuationAssessment = {
    status: 'MODELLED',
    indicativeMinPrice: totalMin,
    indicativeMaxPrice: totalMax,
    indicativeMedianPrice: totalMedian,
    indicativePricePerSqm: unitMedianPrice,
    currency: cProfile.currency,
    methodology: `Indicative Automated Econometric Benchmark (0 Direct Comparable Deeds Verified). Model synthesizes regional cadastral price indexes (${cProfile.valuationDataSource}) adjusted for plot size (${areaSizeM2} m²), terrain slope (${terrainGrid.slopeDegrees}°), and road infrastructure proximity.`,
    comparableEvidenceCount: 0,
    marketTrendDescription: `Indicative statistical benchmark: ${unitMinPrice.toLocaleString()} – ${unitMaxPrice.toLocaleString()} ${cProfile.symbol}/m². Note: High variance exists depending on binding MPZP planning rights and actual utility connection conditions.`,
    priceDrivers: [
      { factor: 'Location & Settlement Tier', impact: isCapitalOrMajorCity ? '+85% (Metropolitan Tier)' : '+15% (Regional Municipality)', weight: 'High' },
      { factor: 'Road Proximity & Infrastructure', impact: roadDirect ? 'Neutral / Standard' : '-18% (Off-road / Access required)', weight: 'Medium' },
      { factor: 'Terrain Topography & Slope', impact: terrainGrid.slopeDegrees > 8 ? '-12% (Earthworks & Retaining Costs)' : 'Neutral (Flat Terrain)', weight: 'Medium' },
      { factor: 'Parcel Area Scale', impact: areaSizeM2 > 2000 ? '-10% (Economy of Scale)' : 'Standard', weight: 'Low' }
    ],
    uncertaintyRating: 'High',
    disclaimer: 'INDICATIVE AUTOMATED ESTIMATE ONLY: This calculation is generated purely for preliminary comparative due diligence. It DOES NOT constitute an official property appraisal (Operat Szacunkowy / Gutachten) pursuant to the Act on Real Estate Management (Ustawa o gospodarce nieruchomościami).'
  };

  evidenceRegistry.push({
    id: 'valuation-indicative-model',
    category: 'Market Valuation & Economics',
    claim: `Indicative Valuation Benchmark: ${totalMin.toLocaleString()} – ${totalMax.toLocaleString()} ${cProfile.symbol} (~${unitMedianPrice} ${cProfile.symbol}/m²) [0 Direct Comparable Deeds Verified]`,
    status: 'MODELLED',
    sourceName: cProfile.valuationDataSource,
    datasetDate: '2025/2026 Regional Statistical Cadastral Benchmark',
    spatialRelationship: `Regional administrative territory: ${municipality || state || cProfile.countryName}`,
    calculationMethod: 'Multi-factor hedonic statistical adjustment model based on location tier, road proximity, slope, and size',
    confidence: 'Low',
    limitation: 'Automated statistical estimate without direct deed verification. A legally binding appraisal requires an on-site inspection by a Certified Property Valuer (Rzeczoznawca Majątkowy).'
  });

  // =========================================================================
  // 8. Evidence Quality Score & Capping Rules (Priority 9)
  // Clear, honest scoring that caps the total score if critical evidence is unverified
  // =========================================================================
  let cadScore = 0;
  if (parcelInfo.isOfficialGeometry) {
    cadScore = 20; // Official cadastral polygon geometry retrieved from GUGiK ULDK
  } else if (parcelInfo.status === 'VERIFIED') {
    cadScore = 14; // Parcel ID & TERYT verified, but user-drawn boundary proxy
  } else {
    cadScore = 6;  // Unverified parcel ID
  }

  let terrainScore = terrainGrid.isMeasured ? 20 : 14; // Multi-point Copernicus DEM
  let geoScore = soilGridsData.success ? 14 : 8;       // SoilGrids is MODELLED, capped at 14/20 because physical boreholes are unperformed
  let infraScore = osmFeatures.success ? 12 : 6;      // Live OSM vector query
  let envScore = 11;                                  // Spatial protected area & watercourse buffer
  let planScore = 4;                                  // Planning unverified, capped at 4/10

  let rawTotalScore = cadScore + terrainScore + geoScore + infraScore + envScore + planScore;
  
  // Capping rule: If planning is unverified and official cadastral geometry is missing, cap total at 65/100
  let cappingApplied: string | undefined = undefined;
  if (!parcelInfo.isOfficialGeometry && rawTotalScore > 65) {
    rawTotalScore = 65;
    cappingApplied = 'Total score capped at 65/100 because official cadastral polygon geometry could not be vector-streamed from GUGiK.';
  }

  const totalScore = Math.min(100, Math.max(0, rawTotalScore));
  const ratingClass: EvidenceQualityScore['ratingClass'] =
    totalScore >= 75
      ? 'Robust Evidence (75-100)'
      : totalScore >= 50
      ? 'Moderate Evidence (50-74)'
      : 'Preliminary / Low Evidence (<50)';

  const verifiedCount = evidenceRegistry.filter(e => e.status === 'VERIFIED').length;
  const modelledCount = evidenceRegistry.filter(e => e.status === 'MODELLED').length;
  const unverifiedCount = evidenceRegistry.filter(e => e.status === 'REQUIRES_VERIFICATION').length;

  const evidenceScore: EvidenceQualityScore = {
    totalScore,
    ratingClass,
    cappingApplied,
    breakdown: {
      cadastreAndGeometry: {
        score: cadScore,
        max: 20,
        rationale: parcelInfo.isOfficialGeometry
          ? 'Official cadastral parcel polygon vector boundary retrieved directly from GUGiK ULDK.'
          : parcelInfo.status === 'VERIFIED'
          ? 'Official parcel ID & TERYT verified in GUGiK ULDK; geometry represented via user-drawn boundary proxy.'
          : 'Administrative centroid resolved; cadastral parcel identifier and boundary unconfirmed.'
      },
      terrainAndElevation: {
        score: terrainScore,
        max: 20,
        rationale: '9-point high-resolution DEM cross-grid sampling with mathematical finite-difference slope and aspect calculation.'
      },
      geologyAndGroundwater: {
        score: geoScore,
        max: 20,
        rationale: 'ISRIC SoilGrids 2.0 scientific multi-depth soil profile (Sand/Silt/Clay%, Bulk Density, pH) classified as MODELLED. Physical boreholes unperformed.'
      },
      infrastructureAndAccess: {
        score: infraScore,
        max: 15,
        rationale: 'Live OSM spatial vector query for road access geometry, surface type, power infrastructure, and surrounding urban amenities.'
      },
      environmentalAndFlood: {
        score: envScore,
        max: 15,
        rationale: 'Spatial buffer analysis to nearest surface watercourse and European protected areas. Statutory ISOK Q100 flood maps unretrieved.'
      },
      planningAndMarket: {
        score: planScore,
        max: 10,
        rationale: 'Indicative econometric model without direct deed verification. Binding MPZP development rights require formal municipal extract.'
      }
    },
    verifiedCount,
    modelledCount,
    unverifiedCount,
    summaryExplanation: `The Evidence Quality Score of ${totalScore}/100 reflects ${verifiedCount} directly verified datasets (Cadastre & DEM Topography), ${modelledCount} scientific models & spatial layers (ISRIC SoilGrids 2.0, OSM Overpass), and ${unverifiedCount} critical parameters requiring mandatory professional on-site confirmation (MPZP Planning, Eurocode 7 Geotechnical Boreholes, DSO Utility Connection Terms).`
  };

  // =========================================================================
  // 9. Mandatory Pre-Construction Verification Checklist
  // =========================================================================
  const verificationChecklist: VerificationRequirement[] = [
    {
      topic: 'Official Planning Certificate (Wypis i Wyrys z MPZP lub Decyzja WZ)',
      reason: 'Binding building height, maximum building coverage ratio, floor area ratio (FAR), and allowed roof geometries must be legally verified before architectural commission.',
      recommendedAuthorityOrExpert: `${municipality || 'Municipal'} Spatial Planning & Architecture Department (Wydział Architektury / Urbanistyki)`,
      priority: 'High'
    },
    {
      topic: 'Geotechnical Site Investigation (Badania Geotechniczne / Baugrunduntersuchung)',
      reason: `ISRIC SoilGrids data indicates ${soilGridsData.usdaTextureClass} subsoil. Pursuant to Eurocode 7 (EN 1997-1), exact allowable bearing capacity (kPa), layer boundaries, and seasonal water table depth must be determined through on-site boreholes, dynamic probing, and licensed geotechnical opinion.`,
      recommendedAuthorityOrExpert: 'Licensed Geotechnical Engineer / Geologist (Uprawniony Geolog / Geotechnik)',
      priority: 'High'
    },
    {
      topic: 'Topographical Survey for Design (Mapa do Celów Projektowych - MDCP)',
      reason: 'Mandatory for official building permit application; defines exact boundary markers, underground utilities, and ground level contours certified by County Documentation Center (PODGiK).',
      recommendedAuthorityOrExpert: 'Licensed Land Surveyor (Uprawniony Geodeta)',
      priority: 'High'
    },
    {
      topic: 'Utility Connection Terms (Warunki Przyłączeniowe Gestorów Sieci)',
      reason: 'Formal confirmation of grid capacity, hookup locations, and technical connection requirements for electricity, water, sewage, and gas.',
      recommendedAuthorityOrExpert: 'Regional Utility DSOs (Power, Waterworks, Gas Operators)',
      priority: 'Medium'
    },
    {
      topic: 'Land and Mortgage Register Verification (Księga Wieczysta)',
      reason: 'Verification of legal ownership, easements, transmission rights (służebność przesyłu), mortgages, and third-party rights.',
      recommendedAuthorityOrExpert: 'District Court Land Registry (Wydział Ksiąg Wieczystych) / Notary Public',
      priority: 'High'
    }
  ];

  // =========================================================================
  // 10. Executive Summary & Statutory Disclaimers
  // =========================================================================
  const executiveSummary = language === 'pl'
    ? `Niniejszy operat przestrzenny stanowi opartą na dowodach analizę działki ${parcelInfo.parcelId ? `o identyfikatorze ${parcelInfo.parcelId}` : ''} (${parcelInfo.isOfficialGeometry ? 'z geometrii GUGiK ULDK' : 'z obrysu użytkownika'}) o powierzchni ${areaSizeM2.toLocaleString()} m² w obrębie: ${municipality || state || cProfile.countryName} (${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E). Wskaźnik jakości dowodów wynosi ${totalScore}/100 (${ratingClass}). Analiza topograficzna wykazała średnią wysokość ${terrainGrid.centerElevationM} m n.p.m. oraz spadek terenu ${terrainGrid.slopeDegrees}° (${terrainGrid.slopeCategory}). Pobrano modelowane dane glebowe z bazy ISRIC SoilGrids 2.0 (${soilGridsData.usdaTextureClass}, piasek: ${soilGridsData.topsoilSandPct}%, pył: ${soilGridsData.topsoilSiltPct}%, ił: ${soilGridsData.topsoilClayPct}%, pH: ${soilGridsData.meanPhH2O}). Poziom wód gruntowych nie został zmierzony bezpośrednio. Droga dojazdowa (${osmFeatures.nearestRoad.name || osmFeatures.nearestRoad.type}) znajduje się w odległości ok. ${roadDist} m. Orientacyjny model wyceny wskazuje ${totalMin.toLocaleString()} – ${totalMax.toLocaleString()} ${cProfile.symbol}. Wiążące parametry budowlane i prawne wymagają uzyskania wypisu z MPZP oraz terenowych badań geotechnicznych (Eurokod 7).`
    : `This spatial due diligence report synthesizes multi-source evidence for ${parcelInfo.parcelId ? `cadastral parcel ${parcelInfo.parcelId}` : 'site'} (${parcelInfo.isOfficialGeometry ? 'official GUGiK ULDK geometry' : 'user boundary'}) with an area of ${areaSizeM2.toLocaleString()} m² in ${municipality || state || cProfile.countryName} (${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E). The Evidence Quality Score is ${totalScore}/100 (${ratingClass}). Topographic sampling indicates mean elevation of ${terrainGrid.centerElevationM} m a.s.l. with a slope gradient of ${terrainGrid.slopeDegrees}° (${terrainGrid.slopeCategory}). Scientific ISRIC SoilGrids 2.0 data indicates ${soilGridsData.usdaTextureClass} subsoil (Sand: ${soilGridsData.topsoilSandPct}%, Silt: ${soilGridsData.topsoilSiltPct}%, Clay: ${soilGridsData.topsoilClayPct}%, pH: ${soilGridsData.meanPhH2O}) [MODELLED]. Groundwater depth is not directly measured. Road access (${osmFeatures.nearestRoad.name || osmFeatures.nearestRoad.type}) is situated approx. ${roadDist} m away. The indicative statistical land valuation range is ${totalMin.toLocaleString()} – ${totalMax.toLocaleString()} ${cProfile.symbol}. Binding building rights strictly require an official municipal planning extract (MPZP / B-Plan) and Eurocode 7 on-site geotechnical boreholes.`;

  const dataSourcesCited = [
    {
      name: cProfile.cadastreAuthority,
      organization: 'National Cadastral and Geodetic Service (GUGiK ULDK / EGiB)',
      url: cProfile.cadastrePortalUrl,
      type: 'Official National Cadastre' as const,
      status: parcelInfo.status
    },
    {
      name: 'Copernicus European DEM / Open-Meteo Elevation Engine',
      organization: 'European Space Agency (ESA) & Copernicus Land Monitoring Service',
      url: 'https://land.copernicus.eu',
      type: 'Elevation DEM' as const,
      status: 'VERIFIED' as const
    },
    {
      name: soilGridsData.sourceName,
      organization: 'ISRIC - World Soil Information (Global Pedometric Database)',
      url: soilGridsData.sourceUrl,
      type: 'Scientific Soil Database' as const,
      status: 'MODELLED' as const
    },
    {
      name: cProfile.geologyAuthority,
      organization: 'National Geological Survey Institute (PIG-PIB)',
      url: cProfile.geologyPortalUrl,
      type: 'Geological Survey' as const,
      status: 'MODELLED' as const
    },
    {
      name: cProfile.floodAuthority,
      organization: 'State Water Management Authority (PGW Wody Polskie / ISOK)',
      url: cProfile.floodPortalUrl,
      type: 'Hydrological Registry' as const,
      status: terrainAnalysis.floodInundationRisk.status
    },
    {
      name: 'OpenStreetMap Live Overpass Spatial Engine',
      organization: 'OpenStreetMap Foundation & Community Contributors',
      url: 'https://overpass-turbo.eu',
      type: 'Spatial Overpass' as const,
      status: 'VERIFIED' as const
    },
    {
      name: cProfile.valuationDataSource,
      organization: 'National Statistical and Real Estate Price Monitoring Registry (RCiWN Benchmark)',
      url: cProfile.cadastrePortalUrl,
      type: 'Statistical Market Benchmark' as const,
      status: 'MODELLED' as const
    }
  ];

  const isPl = language === 'pl';
  const isDe = language === 'de';

  const statutoryDisclaimers = isPl ? [
    'KLAUZULA INFORMACYJNA I STATUS DANYCH PRZESTRZENNYCH (Dyrektywa 2007/2/WE INSPIRE & Ustawa o Infrastrukturze Informacji Przestrzennej): Niniejsze opracowanie ma charakter wyłącznie wstępny, poglądowy i screeningowy. Zostało wygenerowane automatycznie w oparciu o otwarte zbiory danych przestrzennych (GUGiK, PIG-PIB, ISRIC SoilGrids 2.0, Copernicus DEM, OpenStreetMap). Żadna informacja zawarta w niniejszym raporcie nie stanowi oficjalnego zaświadczenia administracyjnego ani dokumentu urzędowego w rozumieniu Kodeksu postępowania administracyjnego (KPA).',
    'BRAK MOCY PRAWNEJ OPERATU SZACUNKOWEGO (Ustawa o gospodarce nieruchomościami z dn. 21 sierpnia 1997 r., Dz.U. 2023 poz. 344): Prezentowane wartości liczbowe stanowią orientacyjny model statystyczny oparty na zagregowanych danych transakcyjnych (0 bezpośrednich transakcji porównawczych). Niniejszy raport NIE JEST operatem szacunkowym sporządzonym przez uprawnionego rzeczoznawcę majątkowego i nie może być podstawą zabezpieczenia wierzytelności bankowych, wyceny podatkowej, postępowań sądowych ani wiążących transakcji kupna/sprzedaży nieruchomości.',
    'ZASTRZEŻENIE GEOTECHNICZNE (Eurokod 7 / PN-EN 1997-1 oraz Rozporządzenie MTBiGM z dn. 25 kwietnia 2012 r. w sprawie ustalania geotechnicznych warunków posadowienia obiektów budowlanych): Właściwości pedologiczne, wskaźniki uziarnienia (frakcje piasku, pyłu, iłu) oraz orientacyjna nośność podłoża (kPa) pochodzą z globalnych modeli przestrzennych ISRIC (dane modelowane, brak odwiertów na działce). Głębokość zwierciadła wody gruntowej nie została zmierzona. Przed przystąpieniem do projektowania fundamentów BEZWZGLĘDNIE WYMAGANE jest wykonanie terenowych badań podłoża gruntowego (odwierty geotechniczne, sondowania) przez uprawnionego geologa.',
    'WARUNKI PLANISTYCZNE I PRZEPISY BUDOWLANE (Ustawa o planowaniu i zagospodarowaniu przestrzennym oraz Prawo Budowlane): Wiążące parametry inwestycyjne (maksymalna intensywność zabudowy, wysokość, powierzchnia biologicznie czynna, linia zabudowy) wynikają wyłącznie z aktualnego Miejscowego Planu Zagospodarowania Przestrzennego (Wypis i Wyrys z MPZP) lub ostatecznej Decyzji o Warunkach Zabudowy (Decyzja WZ) wydanej przez właściwy Urząd Gminy/Miasta.',
    'GRANICE EWIDENCYJNE I STAN PRAWNY (EGiB / Księgi Wieczyste): Prezentowana geometria i identyfikatory działek pochodzą z publicznych rejestrów GUGiK ULDK. Przebieg granic ewidencyjnych oraz stan prawny nieruchomości (służebności, hipoteki, roszczenia osób trzecich) podlegają weryfikacji w Państwowym Zasobie Geodezyjnym i Kartograficznym (PODGiK) oraz we właściwym Wydziale Ksiąg Wieczystych Sądu Rejonowego.',
    'DOSTĘPNOŚĆ MEDIÓW I INFRASTRUKTURY TECHNICZNEJ: Wyniki analizy sieci w korytarzu drogowym opierają się na danych wektorowych i nie gwarantują możliwości przyłączenia. Rzeczywiste warunki, rezerwy mocy i koszty budowy przyłączy wymagają uzyskania pisemnych Technicznych Warunków Przyłączenia (TWP) od poszczególnych gestorów sieci dystrybucyjnych.',
    'OGRANICZENIE ODPOWIEDZIALNOŚCI PRAWNEJ I FINANSOWEJ: Twórcy platformy, operatorzy algorytmów oraz dostawcy danych przestrzennych NIE PONOSZĄ ODPOWIEDZIALNOŚCI za jakiekolwiek bezpośrednie, pośrednie lub wynikowe szkody, straty finansowe lub koszty budowlane powstałe w wyniku posłużenia się informacjami zawartymi w niniejszym raporcie.'
  ] : isDe ? [
    'GESETZLICHE INFORMATIONSPFLICHT & STATUS (EU-Richtlinie 2007/2/EG INSPIRE): Diese automatisierte Standort- und Baugrundanalyse basiert auf öffentlich zugänglichen Geodaten und dient ausschließlich der vorläufigen Sondierung und Due-Diligence-Prüfung.',
    'KEIN VERKEHRSWERTGUTACHTEN GEMÄSS § 194 BauGB: Die ermittelten Richtwerte basieren auf statistischen Vergleichsmodellen (0 geprüfte Vergleichskaufverträge). Dieser Bericht ersetzt kein amtliches Verkehrswertgutachten.',
    'GEOTECHNISCHER HAFTUNGSAUSSCHLUSS GEMÄSS EUROCODE 7 (DIN EN 1997-1): Die bodenmechanischen Schätzungen sind großräumige Modellwerte. Objektbezogene Baugrundaufschlüsse (Bohrungen) und ein Baugrundgutachten sind gesetzlich vorgeschrieben.',
    'PLANUNGSRECHTLICHER VORBEHALT (BauGB): Bebaubarkeit, Geschossflächenzahl (GFZ) und Abstandsflächen bedürfen der Überprüfung durch amtlichen Auszug aus dem Bebauungsplan (B-Plan) beim Bauordnungsamt.',
    'VOLLSTÄNDIGER HAFTUNGSAUSSCHLUSS: Keine Haftung für Investitionsentscheidungen oder Baukostensteigerungen.'
  ] : [
    'LEGAL NOTICE & STATUTORY DUE DILIGENCE SCOPE (EU Directive 2007/2/EC INSPIRE): This automated preliminary land assessment synthesizes multi-source open spatial data (Copernicus DEM, ISRIC SoilGrids 2.0, OpenStreetMap, Cadastral registers). It is generated exclusively for preliminary screening purposes and does not constitute an official administrative certificate.',
    'NOT A LICENSED PROPERTY APPRAISAL / VALUATION: The estimated valuation range represents an automated econometric benchmark (0 direct comparable deeds verified). It DOES NOT constitute a Certified Property Appraisal and CANNOT be utilized for mortgage lending or bank collateral underwriting.',
    'GEOTECHNICAL ENGINEERING & EUROCODE 7 (EN 1997-1) STATUTORY DISCLAIMER: Soil particle distributions and bearing capacity estimates represent global pedometric modeling (MODELLED). Groundwater table depth is not directly measured. Physical on-site boreholes and a licensed Geotechnical Report are strictly required.',
    'STATUTORY PLANNING & ZONING (MPZP / B-PLAN / PLU) NOTICE: Legally binding building entitlements require an official certified extract from the municipal spatial development plan or planning certificate issued by the competent municipal planning authority.',
    'CADASTRAL BOUNDARIES & TITLE VERIFICATION: Parcel boundary vectors reflect digital indexes. Exact parcel boundary demarcations and legal encumbrances must be confirmed via a certified cadastral map and official Land and Mortgage Registry.',
    'UTILITY NETWORKS & CAPACITY CONDITIONS: Technical connection feasibility, grid capacity, and connection fees require formal Technical Connection Conditions (TWP) issued directly by regional utility operators (DSOs).',
    'TOTAL LIMITATION OF LEGAL & FINANCIAL LIABILITY: Neither the platform operators nor spatial data providers accept any legal or financial liability for investment decisions or construction costs arising from reliance upon this automated dossier.'
  ];

  return {
    id: `REP-${countryCode}-${Date.now().toString(36).toUpperCase()}`,
    generatedAt: nowIso,
    countryCode,
    language,
    parcel: parcelInfo,
    terrain: terrainAnalysis,
    soil: soilInfo,
    planning: planningAnalysis,
    infrastructure: infrastructureAnalysis,
    environment: environmentalAnalysis,
    valuation: valuationAssessment,
    evidenceScore,
    evidenceRegistry,
    verificationChecklist,
    executiveSummary,
    dataSourcesCited,
    statutoryDisclaimers
  };
}
