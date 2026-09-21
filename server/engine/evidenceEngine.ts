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
import { fetchBgsSiteEvidence, ukGeotechnicalDesignFallback } from '../services/bgsEvidenceService';
import { resolvePolandValuationBenchmark } from '../services/polandValuationBenchmark';
import { fetchPolandCadastralParcel } from '../adapters/poland';
import { getCountryProfile } from '../adapters/countries';
import { fetchCroatiaFloodEvidence } from '../services/croatiaFloodService';

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
  const [terrainGrid, osmFeatures, soilGridsData, polandCadastre, bgsEvidence, croatiaFloodEvidence] = await Promise.all([
    calculateTerrainFromGrid(lat, lng, Math.max(25, Math.sqrt(areaSizeM2 / Math.PI))),
    queryOverpassSurroundings(lat, lng, Math.max(20, Math.sqrt(areaSizeM2 / Math.PI))),
    fetchGenuineSoilGridsData(lat, lng),
    countryCode === 'PL' ? fetchPolandCadastralParcel(lat, lng) : Promise.resolve(null),
    countryCode === 'GB' ? fetchBgsSiteEvidence(lat, lng) : Promise.resolve(null),
    countryCode === 'HR' ? fetchCroatiaFloodEvidence(lat, lng) : Promise.resolve(null)
  ]);
  const terrainAvailable = Number.isFinite(terrainGrid.centerElevationM) && Number.isFinite(terrainGrid.slopeDegrees);
  const osmAvailable = osmFeatures.success;

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
  const hasWatercourseNearby = Boolean(osmAvailable && osmFeatures.nearestWatercourse.distanceM !== undefined && osmFeatures.nearestWatercourse.distanceM <= 350);
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
      status: !osmAvailable ? 'REQUIRES_VERIFICATION' : hasWatercourseNearby ? 'REQUIRES_VERIFICATION' : 'MODELLED',
      level: !osmAvailable ? 'Not available' : (watercourseDist !== undefined && watercourseDist <= 100)
        ? 'Moderate'
        : (watercourseDist !== undefined && watercourseDist <= 250)
        ? 'Low'
        : 'Negligible',
      distanceToWaterwayM: watercourseDist,
      waterwayName: osmFeatures.nearestWatercourse.name,
      waterwayType: osmFeatures.nearestWatercourse.type,
      statutoryZoneStatus: 'Unconfirmed from open data; verify the competent statutory flood-hazard authority',
      description: !osmAvailable
        ? 'Hydrology proximity data is not available because the spatial query did not complete. No flood-risk classification has been inferred.'
        : watercourseDist !== undefined
        ? `Nearest mapped open water feature (${osmFeatures.nearestWatercourse.name || osmFeatures.nearestWatercourse.type}) located approximately ${watercourseDist} m from parcel. Spatial proximity indicator only.`
        : 'No open surface watercourses mapped within the 450 m analysis buffer.',
      sourceName: `OpenStreetMap hydrology; statutory verification: ${cProfile.floodAuthority}`,
      limitation: 'Spatial proximity to open water is a screening indicator only and does not replace the competent national or regional statutory flood-hazard maps.'
    },
    geohazards: {
      landslideSusceptibility: {
        status: !terrainAvailable || terrainGrid.slopeDegrees > 12 ? 'REQUIRES_VERIFICATION' : 'MODELLED',
        level: !terrainAvailable ? 'Not available' : terrainGrid.slopeDegrees > 15 ? 'Moderate' : terrainGrid.slopeDegrees > 8 ? 'Low' : 'Negligible',
        description: !terrainAvailable
          ? 'Terrain elevation data is not available; landslide susceptibility has not been inferred.'
          : terrainGrid.slopeDegrees < 5
          ? `Terrain slope is gentle (${terrainGrid.slopeDegrees}° / ${terrainGrid.slopePercent}%), indicating very low natural slope instability.`
          : `Terrain slope gradient is ${terrainGrid.slopeDegrees}° (${terrainGrid.slopePercent}%). Slopes above 8° warrant location-specific geotechnical and landslide-hazard verification.`,
        sourceName: 'Terrain-derived screening; verify the competent national or regional landslide inventory'
      },
      seismicRisk: {
        status: 'REQUIRES_VERIFICATION',
        zone: 'Not available — no location-specific seismic hazard query was completed',
        pgaG: 'Not available — no location-specific peak-ground-acceleration value was queried',
        sourceName: 'No location-specific seismic hazard source queried'
      },
      radonPotential: {
        status: 'REQUIRES_VERIFICATION',
        classification: 'Not available — no location-specific national radon dataset was queried',
        sourceName: 'European Commission Joint Research Centre (JRC European Atlas of Natural Radiation)'
      },
      miningSubsidence: {
        status: 'REQUIRES_VERIFICATION',
        classification: (countryCode === 'PL' && lat >= 50.0 && lat <= 50.5 && lng >= 18.4 && lng <= 19.5)
          ? 'Potential Mining Area (Górnośląskie Zagłębie Węglowe) - Requires Category I-V verification from State Mining Authority (WUG)'
          : 'Not available — no location-specific mining registry query was completed',
        sourceName: countryCode === 'PL' ? 'Wyższy Urząd Górniczy (WUG) / PIG-PIB MIDAS' : 'National Geological Survey Mining Database'
      }
    }
  };

  if (croatiaFloodEvidence) {
    terrainAnalysis.floodInundationRisk = {
      status: croatiaFloodEvidence.status,
      level: croatiaFloodEvidence.level,
      distanceToWaterwayM: watercourseDist,
      waterwayName: osmFeatures.nearestWatercourse.name,
      waterwayType: osmFeatures.nearestWatercourse.type,
      statutoryZoneStatus: croatiaFloodEvidence.status === 'VERIFIED' ? 'Official Croatian flood-hazard WMS queried at the selected coordinate' : 'Official Croatian flood-hazard source could not be queried reliably',
      description: croatiaFloodEvidence.description,
      sourceName: croatiaFloodEvidence.sourceName,
      limitation: croatiaFloodEvidence.evidence.limitation
    };
    evidenceRegistry.push(croatiaFloodEvidence.evidence);
  }

  evidenceRegistry.push({
    id: 'terrain-elevation-slope',
    category: 'Terrain & Topography',
    claim: terrainAvailable ? `Mean elevation ${terrainGrid.centerElevationM} m a.s.l. with slope gradient of ${terrainGrid.slopeDegrees}° (${terrainGrid.slopeCategory})` : 'Elevation dataset query unavailable; no elevation, slope, or aspect result inferred.',
    status: terrainAvailable ? 'MODELLED' : 'REQUIRES_VERIFICATION',
    sourceName: terrainGrid.sourceName,
    datasetDate: terrainGrid.datasetDate,
    spatialRelationship: `9-point cross-sampling grid across parcel area (${areaSizeM2} m²)`,
    calculationMethod: 'Numerical finite-difference Horn filter from multi-point DEM elevation samples',
    confidence: terrainAvailable ? 'Medium' : 'Low',
    limitation: 'Derived from 30m/90m satellite DEM. Detailed foundation grading and earthwork calculations require a licensed surveyor\'s Situational-Height Map (MDCP).',
    value: { elevation: terrainGrid.centerElevationM, slopeDeg: terrainGrid.slopeDegrees, aspect: terrainGrid.aspectDirection }
  });

  evidenceRegistry.push({
    id: 'flood-proximity-check',
    category: 'Hydrology & Flooding',
    claim: terrainAnalysis.floodInundationRisk.description,
    status: terrainAnalysis.floodInundationRisk.status,
    sourceName: croatiaFloodEvidence?.sourceName || (osmAvailable ? 'OpenStreetMap hydrology' : cProfile.floodAuthority),
    sourceUrl: croatiaFloodEvidence?.sourceUrl || (osmAvailable ? 'https://www.openstreetmap.org/' : cProfile.floodPortalUrl),
    datasetDate: croatiaFloodEvidence?.datasetDate || todayStr,
    spatialRelationship: croatiaFloodEvidence
      ? croatiaFloodEvidence.evidence.spatialRelationship
      : watercourseDist !== undefined
      ? `Proximity vector to nearest mapped open watercourse: ${watercourseDist} m`
      : '450 m spatial query buffer around parcel',
    calculationMethod: croatiaFloodEvidence
      ? croatiaFloodEvidence.evidence.calculationMethod
      : 'Spatial distance transform to nearest mapped hydrology vectors',
    confidence: croatiaFloodEvidence
      ? croatiaFloodEvidence.evidence.confidence
      : watercourseDist !== undefined && watercourseDist > 200 ? 'High' : 'Medium',
    limitation: croatiaFloodEvidence?.evidence.limitation || 'Does not replace official statutory flood-hazard mapping or project-specific stormwater and drainage assessment.'
  });

  // =========================================================================
  // 3. Soil, Lithology & Honest Groundwater (Priority 4, 5, 6)
  // Reclassified SoilGrids as MODELLED (not VERIFIED) with no fake groundwater depths
  // =========================================================================
  let geologicalUnitName = 'Not available — national geological map not queried';
  let lithologyDesc = soilGridsData.success ? `Pedological texture only: ${soilGridsData.usdaTextureClass} (not a geological lithology classification)` : 'Not available';
  let stratPeriod = 'Not available';
  let groundRegime = 'Not available — requires hydrogeological evidence';
  let plGroundwaterNotice = 'Zwierciadło wód gruntowych nieustalone bezpośrednio (Wymaga piezometru w odwiercie geotechnicznym).';

  if (countryCode === 'PL') {
    // The live PGI acquisition enriches these fields after validated source
    // queries. Coordinate-only regional prose is not a mapped geological unit.
    geologicalUnitName = 'Not available — requires validated PGI-PIB map evidence';
    lithologyDesc = 'Not available — requires validated PGI-PIB map evidence';
    stratPeriod = 'Not available — requires validated PGI-PIB map evidence';
    groundRegime = 'Not available — requires authoritative hydrogeological evidence';
    plGroundwaterNotice = 'Poziom wód gruntowych nie został ustalony na podstawie pomiaru dla działki. Wymagane są dane obserwacyjne lub badania terenowe.';
  } else if (countryCode === 'GB' && bgsEvidence) {
    if (bgsEvidence.geology.available) {
      geologicalUnitName = bgsEvidence.geology.unitName || 'Not available';
      lithologyDesc = bgsEvidence.geology.lithology || 'Not available';
      stratPeriod = bgsEvidence.geology.geologicalAge || 'Not available';
    }
    if (bgsEvidence.groundwater.available) {
      groundRegime = `Modelled groundwater depth: ${bgsEvidence.groundwater.modelledDepth}`;
      plGroundwaterNotice = bgsEvidence.groundwater.limitation;
    } else {
      plGroundwaterNotice = 'No measured or validated modelled groundwater level was returned. Site investigation is required for design groundwater level.';
    }
  }

  const stratigraphyLayers = soilGridsData.stratigraphyProfile.map(l => ({
    depthRange: l.depthRange,
    soilType: l.textureClass,
    mechanicalStatus: 'Not available — no verified site-specific engineering evidence',
    description: 'Pedological model values only; no engineering design parameter inferred.',
    sandPct: l.sandPct,
    siltPct: l.siltPct,
    clayPct: l.clayPct,
    bulkDensity: l.bulkDensityGcm3,
    ph: l.phH2O,
    soc: l.soilOrganicCarbonPct
  }));
  const ukEngineering = ukGeotechnicalDesignFallback();

  const soilInfo: SoilAnalysis = {
    status: soilGridsData.success ? 'MODELLED' : 'REQUIRES_VERIFICATION',
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
    estimatedWaterTableDepthM: countryCode === 'GB' && bgsEvidence?.groundwater.available ? `Modelled: ${bgsEvidence.groundwater.modelledDepth}` : 'Not directly measured (Requires on-site borehole)',
    groundwaterNotice: plGroundwaterNotice,
    estimatedBearingCapacityKpa: ukEngineering.bearingCapacity,
    effectiveFrictionAngleDeg: ukEngineering.frictionAngle,
    cohesionKpa: ukEngineering.cohesion,
    hydraulicConductivityMs: ukEngineering.hydraulicConductivity,
    drainageClass: ukEngineering.drainageClass,
    frostSusceptibilityClass: soilGridsData.frostSusceptibilityClass,
    topsoilStrippingDepthCm: soilGridsData.topsoilStrippingDepthCm,
    groundwaterRegime: groundRegime,
    isMeasuredBoreholeData: false,
    sourceName: 'ISRIC - World Soil Information (SoilGrids 2.0 250m Global Spatial Model)',
    sourceUrl: soilGridsData.sourceUrl,
    datasetVersion: soilGridsData.datasetVersion,
    limitation: soilGridsData.limitation,
    stratigraphyLayers
  };

  evidenceRegistry.push({
    id: 'soilgrids-isric-mechanics',
    category: 'Geology & Soil Mechanics',
    claim: soilGridsData.success ? `Soil Texture: ${soilGridsData.usdaTextureClass} (Sand ${soilGridsData.topsoilSandPct}%, Silt ${soilGridsData.topsoilSiltPct}%, Clay ${soilGridsData.topsoilClayPct}%, Mean Density ${soilGridsData.meanBulkDensityGcm3} g/cm³, pH ${soilGridsData.meanPhH2O}) [MODELLED]` : 'SoilGrids query unavailable; no soil texture or engineering properties inferred.',
    status: soilGridsData.success ? 'MODELLED' : 'REQUIRES_VERIFICATION',
    sourceName: soilGridsData.sourceName,
    sourceUrl: soilGridsData.sourceUrl,
    datasetDate: 'SoilGrids 2.0 Global Pedometric Database',
    spatialRelationship: `ISRIC 250 m cell query at ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`,
    calculationMethod: 'ISRIC Machine-Learned Pedometric Horizon Inversion (0–200 cm depth profile)',
    confidence: soilGridsData.success ? 'Medium' : 'Low',
    limitation: soilGridsData.limitation,
    value: { evidenceTier: 3, resolutionM: 250, depthIntervals: soilGridsData.stratigraphyProfile.map(layer => layer.depthRange), texture: soilGridsData.usdaTextureClass, meanPh: soilGridsData.meanPhH2O, meanDensity: soilGridsData.meanBulkDensityGcm3 }
  });

  if (countryCode === 'GB' && bgsEvidence) {
    evidenceRegistry.push({ id: 'bgs-geology-site', category: 'Geology', claim: bgsEvidence.geology.available ? `BGS mapped geology returned ${bgsEvidence.geology.unitName || bgsEvidence.geology.lithology} at the site centre (evidence tier ${bgsEvidence.geology.tier}).` : 'BGS detailed and regional geology queries returned no usable mapped unit.', status: bgsEvidence.geology.status, sourceName: bgsEvidence.geology.sourceName, sourceUrl: bgsEvidence.geology.sourceUrl, datasetDate: todayStr, spatialRelationship: 'Site-centre point intersection', calculationMethod: 'BGS ArcGIS feature query; detailed mapping before regional fallback', confidence: bgsEvidence.geology.tier === 1 ? 'High' : bgsEvidence.geology.tier === 2 ? 'Medium' : 'Low', limitation: bgsEvidence.geology.limitation, value: { evidenceTier: bgsEvidence.geology.tier, scale: bgsEvidence.geology.scale, geologicalUnit: bgsEvidence.geology.unitName, lithology: bgsEvidence.geology.lithology, geologicalAge: bgsEvidence.geology.geologicalAge, superficialDeposit: bgsEvidence.geology.superficialDeposit } });
    evidenceRegistry.push({ id: 'bgs-groundwater-site', category: 'Hydrogeology', claim: bgsEvidence.groundwater.available ? `BGS modelled groundwater context returned: ${bgsEvidence.groundwater.modelledDepth}.` : 'No validated BGS modelled groundwater value was returned.', status: bgsEvidence.groundwater.status, sourceName: bgsEvidence.groundwater.sourceName, sourceUrl: bgsEvidence.groundwater.sourceUrl, datasetDate: todayStr, spatialRelationship: 'Site-centre model query', calculationMethod: 'BGS GeoIndex layer discovery and point query', confidence: bgsEvidence.groundwater.available ? 'Medium' : 'Low', limitation: bgsEvidence.groundwater.limitation, value: { evidenceTier: bgsEvidence.groundwater.tier, modelledDepth: bgsEvidence.groundwater.modelledDepth } });
    evidenceRegistry.push({ id: 'bgs-borehole-context', category: 'Boreholes', claim: bgsEvidence.boreholes.available ? `${bgsEvidence.boreholes.count} nearby BGS borehole record(s); nearest approximately ${bgsEvidence.boreholes.nearestDistanceKm?.toFixed(2) ?? 'unknown'} km away.` : 'No queryable nearby BGS borehole context was returned.', status: bgsEvidence.boreholes.available ? 'VERIFIED' : 'REQUIRES_VERIFICATION', sourceName: bgsEvidence.boreholes.sourceName, sourceUrl: bgsEvidence.boreholes.sourceUrl, datasetDate: todayStr, spatialRelationship: 'Approximately 5 km search envelope around site centre', calculationMethod: 'BGS GeoIndex spatial feature query', confidence: bgsEvidence.boreholes.available ? 'Medium' : 'Low', limitation: bgsEvidence.boreholes.limitation, value: { evidenceTier: bgsEvidence.boreholes.tier, count: bgsEvidence.boreholes.count, nearestDistanceKm: bgsEvidence.boreholes.nearestDistanceKm, nearestRecordId: bgsEvidence.boreholes.nearestRecordId } });
  }

  // =========================================================================
  // 4. Planning & Statutory Zoning Parameters (Priority 3)
  // Honest Uncertainty: FAR, height, and setbacks are NOT established from open data
  // =========================================================================
  const planningAnalysis: PlanningZoningAnalysis = {
    status: 'REQUIRES_VERIFICATION',
    hasLocalPlan: 'Unknown / Requires Municipal Confirmation',
    planDesignation: `Subject to local municipal master plan (${cProfile.planningInstrumentName})`,
    permittedUseCategory: 'Not established from open data — Subject to municipal planning certificate',
    maxFar: 'Not established — requires official local planning documentation',
    maxCoveragePct: 'Not established — Requires municipal planning certificate',
    minBiologicallyActivePct: 'Not established — requires official local planning documentation',
    maxBuildingHeightM: 'Not established — requires official local planning documentation',
    setbackRules: cProfile.standardSetbackRule,
    authorityName: `${municipality || cProfile.countryName} competent local planning authority`,
    documentRequired: 'Official local planning instrument extract / planning certificate',
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
    calculationMethod: 'Country-profile planning screening; no binding parcel-level planning determination',
    confidence: 'Medium',
    limitation: 'Only the competent authority and applicable official local planning instrument can establish legally binding development rights.'
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
        limitation: 'Connection capacity, transformer reserve and connection fees require formal connection terms from the competent electricity distribution operator.'
      },
      {
        utility: 'Potable Water Supply',
        status: osmFeatures.waterInfrastructure.found ? 'MODELLED' : 'REQUIRES_VERIFICATION',
        availability: osmFeatures.waterInfrastructure.found
          ? `Water pipeline mapped in OpenStreetMap (~${osmFeatures.waterInfrastructure.distanceM} m). Pressure and connection terms require water utility confirmation.`
          : 'No municipal water pipeline was mapped in the open vector dataset. Verify supply and connection options with the competent water utility; an alternative private supply may require separate approval.',
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
        limitation: 'If public sewerage is unavailable, the competent local authority must confirm which private wastewater solution, if any, is legally permissible.'
      },
      {
        utility: 'Natural Gas Grid',
        status: 'REQUIRES_VERIFICATION',
        availability: 'No gas pipeline mapped in immediate vector buffer. Connection subject to regional gas network distribution radius.',
        distanceM: undefined,
        mappedInDataset: false,
        sourceName: 'Competent gas distribution operator',
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
    status: !osmAvailable ? 'REQUIRES_VERIFICATION' : roadDist <= 20 && roadDist > 0 ? 'MODELLED' : 'REQUIRES_VERIFICATION',
    sourceName: osmFeatures.sourceName,
    datasetDate: osmFeatures.datasetDate,
    spatialRelationship: Number.isFinite(roadDist) ? `Distance vector from parcel centroid to nearest road axis: ${roadDist} m` : 'Road proximity query unavailable',
    calculationMethod: 'Haversine distance calculation to nearest mapped highway polyline in OSM',
    confidence: roadDist > 0 ? 'High' : 'Low',
    limitation: 'Legal access, easements and permission for any road connection must be confirmed in the relevant land/title register and with the competent road authority.'
  });

  // =========================================================================
  // 6. Environmental Overlays (Priority 11)
  // =========================================================================
  const environmentalAnalysis: EnvironmentalAnalysis = {
    natura2000Intersect: undefined,
    distanceToNatura2000M: osmAvailable && osmFeatures.protectedAreaNearby.found ? osmFeatures.protectedAreaNearby.distanceM : undefined,
    nearestProtectedAreaName: osmFeatures.protectedAreaNearby.name,
    protectedAreaType: osmFeatures.protectedAreaNearby.type,
    landscapeParkOverlay: false,
    waterProtectionZone: false,
    status: osmAvailable ? 'MODELLED' : 'REQUIRES_VERIFICATION',
    sourceName: 'OpenStreetMap Overpass — mapped protected-area context',
    limitation: 'OpenStreetMap is incomplete and is not an official protected-area register. Confirm statutory designations and local environmental constraints with the competent authority.'
  };

  evidenceRegistry.push({
    id: 'environmental-natura2000',
    category: 'Environmental & Conservation',
    claim: !osmAvailable
      ? 'Environmental spatial query unavailable; no protected-area overlap or distance conclusion was inferred.'
      : osmFeatures.protectedAreaNearby.found
      ? `OpenStreetMap maps ${osmFeatures.protectedAreaNearby.name || 'a protected-area feature'} approximately ${osmFeatures.protectedAreaNearby.distanceM} m from the selected coordinate; confirm its legal status in the national register.`
      : 'The OpenStreetMap query returned no nearby protected-area feature; this does not establish that statutory designations are absent.',
    status: osmAvailable ? 'MODELLED' : 'REQUIRES_VERIFICATION',
    sourceName: 'OpenStreetMap Overpass — mapped protected-area context',
    datasetDate: todayStr,
    spatialRelationship: `Mapped feature proximity around site centre (${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E)`,
    calculationMethod: 'OpenStreetMap Overpass nearby protected-area feature lookup; no official Natura 2000 register queried',
    confidence: osmAvailable ? 'Medium' : 'Low',
    limitation: 'OpenStreetMap coverage is incomplete. No returned feature is not evidence that a statutory protected area or local environmental restriction is absent.'
  });

  // =========================================================================
  // 7. Valuation Model (Priority 8)
  // Repositioned as "INDICATIVE AUTOMATED MODEL ESTIMATE (0 Direct Deeds Verified)"
  // =========================================================================
  const isPoland = countryCode === 'PL';
  const polishBenchmark = isPoland
    ? resolvePolandValuationBenchmark(parcelInfo.commune || municipality, parcelInfo.voivodeship || state)
    : undefined;
  const isCapitalOrMajorCity = !isPoland && municipality
    ? /berlin|münchen|hamburg|frankfurt|paris|lyon|marseille|london|madrid|barcelona|roma|milano|zürich|geneva|wien/i.test(municipality)
    : false;

  // Poland uses an explicit city -> voivodeship -> national benchmark hierarchy.
  // Do not stack the old municipality uplift on top of a location-specific benchmark.
  let locationMultiplier = isPoland ? 1.0 : isCapitalOrMajorCity ? 1.85 : (municipality && municipality.length > 0) ? 1.15 : 0.85;
  if (terrainGrid.slopeDegrees > 10) locationMultiplier *= 0.88;
  if (!roadDirect && roadDist > 50) locationMultiplier *= 0.82;

  const scaleModifier = areaSizeM2 > 2500 ? 0.90 : areaSizeM2 < 750 ? 1.10 : 1.0;
  const benchmarkPricePerSqm = polishBenchmark?.benchmarkPricePerSqm ?? cProfile.baseValuationPerSqm;
  const uncertaintyLowFactor = polishBenchmark?.lowFactor ?? 0.82;
  const uncertaintyHighFactor = polishBenchmark?.highFactor ?? 1.22;

  const unitMedianPrice = Math.round(benchmarkPricePerSqm * locationMultiplier * scaleModifier);
  const unitMinPrice = Math.round(unitMedianPrice * uncertaintyLowFactor);
  const unitMaxPrice = Math.round(unitMedianPrice * uncertaintyHighFactor);

  const totalMin = Math.round(areaSizeM2 * unitMinPrice);
  const totalMax = Math.round(areaSizeM2 * unitMaxPrice);
  const totalMedian = Math.round(areaSizeM2 * unitMedianPrice);

  const polishMethodology = polishBenchmark
    ? `Uses the ${polishBenchmark.label} (${polishBenchmark.benchmarkPricePerSqm} ${cProfile.symbol}/m²) from ${polishBenchmark.sourceName} as the location baseline. No additional municipality uplift is applied. The uncertainty interval widens from city to voivodeship to national fallback because no direct parcel comparables or binding planning rights were verified.`
    : undefined;
  const locationDriverImpact = polishBenchmark
    ? `${polishBenchmark.benchmarkPricePerSqm} ${cProfile.symbol}/m² ${polishBenchmark.tier} transaction benchmark (no generic municipality uplift)`
    : isCapitalOrMajorCity ? '+85% (Metropolitan Tier)' : '+15% (Regional Municipality)';

  const valuationAssessment: ValuationAssessment = {
    status: 'MODELLED',
    indicativeMinPrice: totalMin,
    indicativeMaxPrice: totalMax,
    indicativeMedianPrice: totalMedian,
    indicativePricePerSqm: unitMedianPrice,
    currency: cProfile.currency,
    methodology: `Indicative Automated Econometric Benchmark (0 Direct Comparable Deeds Verified). ${polishMethodology || `Model uses the configured market baseline (${cProfile.valuationDataSource}) adjusted for settlement tier.`} Plot-size adjustment uses ${areaSizeM2} m². ${terrainAvailable ? `A terrain slope adjustment used the modelled slope of ${terrainGrid.slopeDegrees}°.` : 'No terrain adjustment was applied because elevation data was unavailable.'} ${Number.isFinite(roadDist) ? 'Mapped road proximity was considered.' : 'No road-proximity adjustment was applied because infrastructure data was unavailable.'}`,
    comparableEvidenceCount: 0,
    marketTrendDescription: `Indicative statistical benchmark: ${unitMinPrice.toLocaleString()} – ${unitMaxPrice.toLocaleString()} ${cProfile.symbol}/m².${polishBenchmark ? ` Benchmark tier: ${polishBenchmark.tier}.` : ''} High variance remains possible because binding planning rights and actual utility connection conditions are not verified.`,
    priceDrivers: [
      { factor: 'Location & Settlement Tier', impact: locationDriverImpact, weight: 'High' },
      ...(isPoland ? [{ factor: 'Planning / Buildability Evidence', impact: 'Not verified — uncertainty range widened; a building-land benchmark does not prove parcel buildability', weight: 'High' as const }] : []),
      { factor: 'Road Proximity & Infrastructure', impact: roadDirect ? 'Neutral / Standard' : '-18% (Off-road / Access required)', weight: 'Medium' },
      { factor: 'Terrain Topography & Slope', impact: !terrainAvailable ? 'Not applied (terrain data unavailable)' : terrainGrid.slopeDegrees > 8 ? '-12% (Earthworks & Retaining Costs)' : 'Neutral (modelled gentle terrain)', weight: 'Medium' },
      { factor: 'Parcel Area Scale', impact: areaSizeM2 > 2000 ? '-10% (Economy of Scale)' : 'Standard', weight: 'Low' }
    ],
    uncertaintyRating: 'High',
    disclaimer: 'INDICATIVE AUTOMATED ESTIMATE ONLY: This calculation is for preliminary comparative due diligence. It is not a licensed or statutory property appraisal and must not be treated as one.'
  };

  evidenceRegistry.push({
    id: 'valuation-indicative-model',
    category: 'Market Valuation & Economics',
    claim: `Indicative Valuation Benchmark: ${totalMin.toLocaleString()} – ${totalMax.toLocaleString()} ${cProfile.symbol} (~${unitMedianPrice} ${cProfile.symbol}/m²) [0 Direct Comparable Deeds Verified]`,
    status: 'MODELLED',
    sourceName: polishBenchmark?.sourceName || cProfile.valuationDataSource,
    sourceUrl: polishBenchmark?.sourceUrl,
    datasetDate: polishBenchmark?.datasetDate || '2025/2026 Regional Statistical Cadastral Benchmark',
    spatialRelationship: polishBenchmark
      ? `${polishBenchmark.tier} benchmark for ${parcelInfo.commune || municipality || parcelInfo.voivodeship || state || cProfile.countryName}`
      : `Regional administrative territory: ${municipality || state || cProfile.countryName}`,
    calculationMethod: polishBenchmark
      ? `${polishBenchmark.tier} transaction benchmark with parcel-size, road-access and terrain adjustments; no generic municipality uplift`
      : 'Multi-factor hedonic statistical adjustment model based on location tier, road proximity, slope, and size',
    confidence: 'Low',
    limitation: 'Automated statistical estimate without direct deed verification. A land-price benchmark does not establish parcel buildability. A professional appraisal requires current local comparable evidence and a suitably qualified valuer.'
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

  let terrainScore = terrainAvailable ? 14 : 0;
  let geoScore = soilGridsData.success ? 14 : 0;
  let infraScore = osmAvailable ? 12 : 0;
  let envScore = croatiaFloodEvidence?.status === 'VERIFIED' ? 15 : osmAvailable ? 11 : 0;
  let planScore = 4;                                  // Planning unverified, capped at 4/10

  let rawTotalScore = cadScore + terrainScore + geoScore + infraScore + envScore + planScore;
  
  // Capping rule: If planning is unverified and official cadastral geometry is missing, cap total at 65/100
  let cappingApplied: string | undefined = undefined;
  if (!parcelInfo.isOfficialGeometry && rawTotalScore > 65) {
    rawTotalScore = 65;
    cappingApplied = 'Total score capped at 65/100 because official cadastral polygon geometry was not available to the automated analysis.';
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
          ? 'Official cadastral parcel polygon geometry was retrieved from the configured national cadastral source.'
          : parcelInfo.status === 'VERIFIED'
          ? 'Cadastral parcel identity was verified, while geometry remains a user-drawn or non-authoritative boundary proxy.'
          : 'Administrative centroid resolved; cadastral parcel identifier and boundary unconfirmed.'
      },
      terrainAndElevation: {
        score: terrainScore,
        max: 20,
        rationale: terrainAvailable ? '9-point DEM cross-grid sampling with mathematical finite-difference slope and aspect calculation.' : 'Elevation query unavailable; no terrain classification inferred.'
      },
      geologyAndGroundwater: {
        score: geoScore,
        max: 20,
        rationale: soilGridsData.success ? 'ISRIC SoilGrids 2.0 scientific multi-depth soil profile classified as MODELLED; physical boreholes remain outstanding.' : 'SoilGrids query unavailable or malformed; no soil or groundwater evidence points awarded.'
      },
      infrastructureAndAccess: {
        score: infraScore,
        max: 15,
        rationale: osmAvailable ? 'Live OSM spatial vector query for road access geometry, surface type, power infrastructure, and surrounding urban amenities.' : 'OSM spatial query unavailable or malformed; no infrastructure evidence points awarded.'
      },
      environmentalAndFlood: {
        score: envScore,
        max: 15,
        rationale: croatiaFloodEvidence?.status === 'VERIFIED'
          ? 'Official Croatian flood-hazard mapping was queried at the selected coordinate across the 2019 high-, medium- and low-probability scenarios.'
          : osmAvailable ? 'Spatial buffer analysis to nearest surface watercourse and mapped protected areas. Statutory flood maps unretrieved.' : 'Spatial query unavailable; no flood-proximity or protected-area conclusion inferred.'
      },
      planningAndMarket: {
        score: planScore,
        max: 10,
        rationale: 'Indicative econometric model without direct deed verification. Binding development rights require official local planning evidence.'
      }
    },
    verifiedCount,
    modelledCount,
    unverifiedCount,
    summaryExplanation: `The Evidence Quality Score of ${totalScore}/100 reflects ${verifiedCount} directly verified datasets, ${modelledCount} scientific models and spatial layers, and ${unverifiedCount} critical parameters requiring authoritative or on-site confirmation, including planning, geotechnical conditions and utility connection terms.`
  };

  // =========================================================================
  // 9. Mandatory Pre-Construction Verification Checklist
  // =========================================================================
  const verificationChecklist: VerificationRequirement[] = [
    {
      topic: 'Official local planning extract / planning certificate',
      reason: 'Binding permitted use, development intensity, building height, coverage, building lines and other project parameters must be confirmed before design decisions.',
      recommendedAuthorityOrExpert: `${municipality || cProfile.countryName} competent local planning authority`,
      priority: 'High'
    },
    {
      topic: 'Geotechnical site investigation',
      reason: `SoilGrids provides regional pedological model context only. Site-specific bearing capacity, stratigraphy, settlement behaviour and groundwater conditions require an appropriate geotechnical investigation under the locally applicable design framework.`,
      recommendedAuthorityOrExpert: 'Suitably qualified geotechnical engineer / engineering geologist',
      priority: 'High'
    },
    {
      topic: 'Topographical and cadastral survey for design',
      reason: 'Confirm legal or authoritative boundary information, levels and relevant mapped services to the accuracy required for design and permitting.',
      recommendedAuthorityOrExpert: 'Suitably qualified land surveyor / cadastral professional',
      priority: 'High'
    },
    {
      topic: 'Utility connection terms',
      reason: 'Confirm network capacity, connection points, technical requirements and fees directly with the competent electricity, water, wastewater, gas and telecommunications operators.',
      recommendedAuthorityOrExpert: 'Competent utility network operators',
      priority: 'Medium'
    },
    {
      topic: 'Land title and encumbrance verification',
      reason: 'Confirm ownership, easements, mortgages, access rights, transmission rights and other third-party interests in the competent legal register.',
      recommendedAuthorityOrExpert: 'Competent land/title registry and, where appropriate, a qualified legal professional',
      priority: 'High'
    }
  ];

  // =========================================================================
  // 10. Executive Summary & Statutory Disclaimers
  // =========================================================================
  const terrainSummary = terrainAvailable
    ? `${terrainGrid.centerElevationM} m a.s.l.; slope ${terrainGrid.slopeDegrees}° (${terrainGrid.slopeCategory})`
    : 'not available (elevation query failed)';
  const soilSummary = soilGridsData.success
    ? `${soilGridsData.usdaTextureClass}; sand ${soilGridsData.topsoilSandPct}%, silt ${soilGridsData.topsoilSiltPct}%, clay ${soilGridsData.topsoilClayPct}%, pH ${soilGridsData.meanPhH2O}`
    : 'not available (SoilGrids query failed)';
  const roadSummary = Number.isFinite(roadDist)
    ? `${osmFeatures.nearestRoad.name || osmFeatures.nearestRoad.type}, approximately ${roadDist} m away`
    : 'not available (spatial query failed)';
  const siteLabel = parcelInfo.parcelId ? `cadastral parcel ${parcelInfo.parcelId}` : 'site';
  const executiveSummary = language === 'pl'
    ? `Niniejszy raport due diligence obejmuje ${siteLabel} o powierzchni ${areaSizeM2.toLocaleString()} m² w lokalizacji ${municipality || state || cProfile.countryName} (${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E). Wskaźnik jakości dowodów: ${totalScore}/100 (${ratingClass}). Teren: ${terrainSummary.replace('not available', 'brak danych')}. Gleba: ${soilSummary.replace('not available', 'brak danych')}. Dostęp drogowy: ${roadSummary.replace('not available', 'brak danych')}. Orientacyjna wycena statystyczna: ${totalMin.toLocaleString()}–${totalMax.toLocaleString()} ${cProfile.symbol}. Wiążące parametry wymagają dokumentów planistycznych i badań terenowych.`
    : language === 'de'
    ? `Dieser Due-Diligence-Bericht untersucht den Standort ${siteLabel} mit einer Fläche von ${areaSizeM2.toLocaleString()} m² in ${municipality || state || cProfile.countryName} (${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E). Evidenz-Qualitätsindex: ${totalScore}/100 (${ratingClass}). Gelände: ${terrainSummary.replace('not available', 'nicht verfügbar')}. Boden: ${soilSummary.replace('not available', 'nicht verfügbar')}. Straßenzugang: ${roadSummary.replace('not available', 'nicht verfügbar')}. Indikative statistische Bewertung: ${totalMin.toLocaleString()}–${totalMax.toLocaleString()} ${cProfile.symbol}. Verbindliche Parameter erfordern amtliche Planungsunterlagen und Vor-Ort-Untersuchungen.`
    : `This spatial due-diligence report assesses the ${siteLabel} with an area of ${areaSizeM2.toLocaleString()} m² in ${municipality || state || cProfile.countryName} (${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E). Evidence Quality Score: ${totalScore}/100 (${ratingClass}). Terrain: ${terrainSummary}. Soil: ${soilSummary}. Road access: ${roadSummary}. Indicative statistical valuation: ${totalMin.toLocaleString()}–${totalMax.toLocaleString()} ${cProfile.symbol}. Binding parameters require official planning documents and on-site investigations.`;

  const dataSourcesCited = [
    {
      name: cProfile.cadastreAuthority,
      organization: cProfile.cadastreAuthority,
      url: cProfile.cadastrePortalUrl,
      type: 'Official National Cadastre' as const,
      status: parcelInfo.status
    },
    {
      name: 'Copernicus European DEM / Open-Meteo Elevation Engine',
      organization: 'European Space Agency (ESA) & Copernicus Land Monitoring Service',
      url: 'https://land.copernicus.eu',
      type: 'Elevation DEM' as const,
      status: terrainAvailable ? 'MODELLED' as const : 'REQUIRES_VERIFICATION' as const
    },
    {
      name: soilGridsData.sourceName,
      organization: 'ISRIC - World Soil Information (Global Pedometric Database)',
      url: soilGridsData.sourceUrl,
      type: 'Scientific Soil Database' as const,
      status: soilGridsData.success ? 'MODELLED' as const : 'REQUIRES_VERIFICATION' as const
    },
    {
      name: bgsEvidence?.geology.sourceName || cProfile.geologyAuthority,
      organization: countryCode === 'GB' ? 'British Geological Survey' : cProfile.geologyAuthority,
      url: bgsEvidence?.geology.sourceUrl || cProfile.geologyPortalUrl,
      type: 'Geological Survey' as const,
      status: soilInfo.status
    },
    {
      name: cProfile.floodAuthority,
      organization: cProfile.floodAuthority,
      url: cProfile.floodPortalUrl,
      type: 'Hydrological Registry' as const,
      status: terrainAnalysis.floodInundationRisk.status
    },
    {
      name: 'OpenStreetMap Live Overpass Spatial Engine',
      organization: 'OpenStreetMap Foundation & Community Contributors',
      url: 'https://overpass-turbo.eu',
      type: 'Spatial Overpass' as const,
      status: osmAvailable ? 'MODELLED' as const : 'REQUIRES_VERIFICATION' as const
    },
    {
      name: polishBenchmark?.sourceName || cProfile.valuationDataSource,
      organization: countryCode === 'PL' ? 'RCN / GUGiK-derived transaction data and Cenatorium market reporting' : cProfile.valuationDataSource,
      url: polishBenchmark?.sourceUrl || cProfile.cadastrePortalUrl,
      type: 'Statistical Market Benchmark' as const,
      status: 'MODELLED' as const
    }
  ];

  const isPl = language === 'pl';
  const isDe = language === 'de';

  const statutoryDisclaimers = isPl ? [
    'STATUS I ZAKRES RAPORTU: To automatyczne opracowanie służy wyłącznie wstępnej analizie due diligence. Łączy otwarte dane przestrzenne i nie jest urzędowym zaświadczeniem ani dokumentem administracyjnym.',
    'NIE JEST TO OPERAT ANI URZĘDOWA WYCENA: Pokazane wartości, jeżeli są dostępne, mają charakter orientacyjny i statystyczny. Nie zastępują wyceny wykonanej przez uprawnionego rzeczoznawcę zgodnie z prawem właściwym dla lokalizacji nieruchomości.',
    'WARUNKI GRUNTOWE: Dane SoilGrids i modele wysokościowe są danymi przesiewowymi. Nie określają nośności, osiadania ani projektowego poziomu wód gruntowych. Do decyzji projektowych wymagane są badania odpowiednie dla lokalizacji i inwestycji.',
    'PLANOWANIE I MOŻLIWOŚĆ ZABUDOWY: Wiążące przeznaczenie terenu, parametry zabudowy i procedury pozwoleń wynikają z prawa oraz dokumentów właściwych dla lokalizacji działki i muszą być potwierdzone przez właściwy organ.',
    'GRANICE I STAN PRAWNY: Dane mapowe nie zastępują potwierdzenia granic, tytułu prawnego, służebności, obciążeń ani praw osób trzecich we właściwych rejestrach.',
    'MEDIA I INFRASTRUKTURA: Obecność obiektu sieciowego na mapie nie potwierdza możliwości ani kosztu przyłączenia. Warunki należy uzyskać bezpośrednio od właściwych operatorów.',
    'OGRANICZENIE ODPOWIEDZIALNOŚCI: Raport jest narzędziem informacyjnym do analizy wstępnej. Decyzje inwestycyjne powinny opierać się na aktualnych dokumentach urzędowych i odpowiednich opiniach zawodowych.'
  ] : isDe ? [
    'STATUS UND UMFANG: Diese automatisierte Standortanalyse dient ausschließlich der vorläufigen Due-Diligence-Prüfung. Sie fasst offene Geodaten zusammen und ist keine behördliche Bescheinigung.',
    'KEIN AMTLICHES ODER LIZENZIERTES WERTGUTACHTEN: Angezeigte Werte sind, soweit vorhanden, indikative statistische Orientierungswerte. Sie ersetzen keine Bewertung durch eine nach dem am Standort geltenden Recht qualifizierte Fachperson.',
    'BAUGRUND: SoilGrids- und Geländemodelle sind Screening-Daten. Sie bestimmen weder Tragfähigkeit noch Setzungen oder den Bemessungsgrundwasserstand. Für Planungsentscheidungen sind standort- und projektbezogene Untersuchungen erforderlich.',
    'PLANUNGSRECHT UND BEBAUBARKEIT: Verbindliche Nutzung, Bauparameter und Genehmigungsanforderungen ergeben sich aus dem am Standort geltenden Recht und den dort maßgeblichen Planungsunterlagen und müssen bei der zuständigen Behörde bestätigt werden.',
    'GRENZEN UND RECHTSSTATUS: Karteninformationen ersetzen nicht die Prüfung von Grenzen, Eigentum, Dienstbarkeiten, Belastungen oder Rechten Dritter in den zuständigen Registern.',
    'VERSORGUNGSNETZE: Ein kartiertes Netzobjekt bestätigt weder Anschlussmöglichkeit noch Kapazität oder Kosten. Verbindliche Bedingungen sind direkt bei den zuständigen Netzbetreibern einzuholen.',
    'HAFTUNGSHINWEIS: Der Bericht ist ein Informationswerkzeug für die Vorprüfung. Investitionsentscheidungen sollten auf aktuellen amtlichen Unterlagen und geeigneter fachlicher Beratung beruhen.'
  ] : [
    'STATUS & SCOPE: This automated site assessment is for preliminary due diligence only. It synthesizes open spatial data and is not an official administrative certificate.',
    'NOT A LICENSED OR STATUTORY PROPERTY APPRAISAL: Any displayed value is an indicative statistical screening estimate. It does not replace an appraisal by a suitably qualified professional under the law applicable to the site.',
    'GROUND CONDITIONS: SoilGrids and terrain models are screening evidence. They do not establish bearing capacity, settlement behaviour or design groundwater level. Project decisions require appropriate site-specific investigation.',
    'PLANNING & BUILDABILITY: Binding land use, development parameters and permitting requirements arise from the law and official planning instruments applicable at the site and must be confirmed with the competent authority.',
    'BOUNDARIES & LEGAL TITLE: Map vectors do not replace confirmation of boundaries, ownership, easements, encumbrances or third-party rights in the competent registers.',
    'UTILITIES & INFRASTRUCTURE: A mapped network feature does not establish connection feasibility, capacity or cost. Binding terms must be obtained directly from the competent utility operators.',
    'RELIANCE: This report is an information tool for preliminary screening. Investment decisions should rely on current official records and appropriate professional advice.'
  ];

  const report: VerifiedSiteReport & { geosurvey_context?: Record<string, unknown> } = {
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
  if (countryCode === 'GB' && bgsEvidence) report.geosurvey_context = {
    geological_unit_name: bgsEvidence.geology.unitName,
    lithology_type: bgsEvidence.geology.lithology,
    geological_period_era: bgsEvidence.geology.geologicalAge,
    superficial_deposit: bgsEvidence.geology.superficialDeposit,
    groundwater_regime: bgsEvidence.groundwater.modelledDepth ? `Modelled groundwater depth: ${bgsEvidence.groundwater.modelledDepth}` : null,
    evidence_level: bgsEvidence.geology.status,
    evidence_tier: bgsEvidence.geology.tier,
    source_name: bgsEvidence.geology.sourceName,
    source_url: bgsEvidence.geology.sourceUrl,
    source_scale: bgsEvidence.geology.scale,
    nearby_borehole_count: bgsEvidence.boreholes.count,
    nearest_borehole_distance_km: bgsEvidence.boreholes.nearestDistanceKm,
    nearest_borehole_record_id: bgsEvidence.boreholes.nearestRecordId
  };
  return report;
}
