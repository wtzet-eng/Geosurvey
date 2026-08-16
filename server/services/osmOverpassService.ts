/**
 * OpenStreetMap Overpass Spatial Proximity & Infrastructure Engine
 * Executes live geospatial vector scraping within parcel radius (350m - 1200m):
 * - Road access geometry (highway class, surface, name, lit, sidewalk, maxspeed)
 * - Hydrological vectors (rivers, streams, canals, water bodies, ditches)
 * - Power grid & Electrical infrastructure (lines, cables, substations, transformers, poles)
 * - Municipal utilities (water pipelines, sewage facilities, gas pipelines, telecom)
 * - Protected environmental areas (Natura 2000, nature reserves, national parks)
 * - Surrounding POI & Urban Amenity accessibility index (Supermarket, Pharmacy, School, Transit)
 * - Building morphology & surrounding density
 */

export interface AmenityPoint {
  type: string;
  name: string;
  distanceM: number;
  category: 'transit' | 'education' | 'daily_needs' | 'healthcare' | 'civic';
}

export interface OverpassSpatialFeatures {
  nearestRoad: {
    name?: string;
    type: string;
    distanceM: number;
    hasDirectAccess: boolean;
    isPaved: boolean;
    surface?: string;
    maxSpeed?: string;
    lit?: boolean;
    sidewalk?: string;
  };
  nearestWatercourse: {
    name?: string;
    type: string;
    distanceM?: number;
    isImmediateFloodThreat: boolean;
  };
  powerInfrastructure: {
    found: boolean;
    type?: string;
    distanceM?: number;
    voltage?: string;
  };
  waterInfrastructure: {
    found: boolean;
    type?: string;
    distanceM?: number;
  };
  telecomInfrastructure: {
    found: boolean;
    type?: string;
    distanceM?: number;
  };
  protectedAreaNearby: {
    found: boolean;
    name?: string;
    type?: string;
    distanceM?: number;
  };
  surroundingLanduse: string[];
  nearbyBuildingsCount: number;
  amenityIndex: AmenityPoint[];
  success: boolean;
  sourceName: string;
  datasetDate: string;
}

export function haversineDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export async function queryOverpassSurroundings(lat: number, lng: number, parcelRadiusM: number = 30): Promise<OverpassSpatialFeatures> {
  const searchRadiusM = 450;
  const amenitySearchRadiusM = 1200;

  const fallback: OverpassSpatialFeatures = {
    nearestRoad: {
      name: 'Unconfirmed / Not mapped in query buffer',
      type: 'unclassified',
      distanceM: 0,
      hasDirectAccess: false,
      isPaved: false,
      surface: 'Unverified'
    },
    nearestWatercourse: {
      type: 'No mapped surface watercourse within 450m buffer',
      distanceM: undefined,
      isImmediateFloodThreat: false
    },
    powerInfrastructure: {
      found: false
    },
    waterInfrastructure: {
      found: false
    },
    telecomInfrastructure: {
      found: false
    },
    protectedAreaNearby: {
      found: false
    },
    surroundingLanduse: [],
    nearbyBuildingsCount: 0,
    amenityIndex: [],
    success: false,
    sourceName: 'OpenStreetMap Cartographic Layer (Vector Query Fallback)',
    datasetDate: 'Live OSM Vector Dataset'
  };

  const query = `
    [out:json][timeout:6];
    (
      way["highway"](around:${searchRadiusM},${lat},${lng});
      way["waterway"](around:${searchRadiusM},${lat},${lng});
      relation["waterway"](around:${searchRadiusM},${lat},${lng});
      way["natural"="water"](around:${searchRadiusM},${lat},${lng});
      node["power"](around:${searchRadiusM},${lat},${lng});
      way["power"](around:${searchRadiusM},${lat},${lng});
      way["man_made"="pipeline"](around:${searchRadiusM},${lat},${lng});
      node["man_made"="pipeline"](around:${searchRadiusM},${lat},${lng});
      node["telecom"](around:${searchRadiusM},${lat},${lng});
      way["boundary"="protected_area"](around:${searchRadiusM},${lat},${lng});
      relation["boundary"="protected_area"](around:${searchRadiusM},${lat},${lng});
      way["boundary"="national_park"](around:${searchRadiusM},${lat},${lng});
      relation["boundary"="national_park"](around:${searchRadiusM},${lat},${lng});
      way["landuse"](around:${searchRadiusM},${lat},${lng});
      way["building"](around:250,${lat},${lng});
      node["amenity"~"school|kindergarten|pharmacy|hospital|doctors|clinic|post_office"](around:${amenitySearchRadiusM},${lat},${lng});
      node["shop"~"supermarket|convenience|bakery|grocer"](around:${amenitySearchRadiusM},${lat},${lng});
      node["highway"="bus_stop"](around:${amenitySearchRadiusM},${lat},${lng});
      node["railway"="station"](around:2500,${lat},${lng});
    );
    out tags center 60;
  `;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
    ];

    let res: Response | null = null;
    for (const ep of endpoints) {
      try {
        res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'EuropeanLandSurveyApp/5.0' },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal
        });
        if (res.ok) break;
      } catch (e) {
        continue;
      }
    }
    clearTimeout(timeout);

    if (!res || !res.ok) {
      return fallback;
    }

    const data: any = await res.json();
    if (!data || !Array.isArray(data.elements)) {
      return fallback;
    }

    let minRoadDist = 9999;
    let closestRoad: any = null;

    let minWaterDist = 9999;
    let closestWater: any = null;

    let minPowerDist = 9999;
    let closestPower: any = null;

    let minWaterPipeDist = 9999;
    let closestWaterPipe: any = null;

    let minTelecomDist = 9999;
    let closestTelecom: any = null;

    let minProtDist = 9999;
    let closestProt: any = null;

    const landuses = new Set<string>();
    let buildingsCount = 0;
    const amenitiesMap: Record<string, AmenityPoint> = {};

    for (const el of data.elements) {
      const elLat = el.center ? el.center.lat : el.lat;
      const elLng = el.center ? el.center.lon : el.lon;
      if (!elLat || !elLng) continue;

      const dist = haversineDistanceM(lat, lng, elLat, elLng);
      const tags = el.tags || {};

      // Building count
      if (tags.building) {
        if (dist <= 250) buildingsCount++;
      }

      // Landuse
      if (tags.landuse) {
        landuses.add(tags.landuse);
      }

      // Check Road
      if (tags.highway && !['bus_stop', 'traffic_signals', 'crossing', 'street_lamp'].includes(tags.highway)) {
        if (dist < minRoadDist) {
          minRoadDist = dist;
          closestRoad = {
            name: tags.name || tags.ref,
            type: tags.highway,
            distanceM: Math.max(0, dist - parcelRadiusM),
            hasDirectAccess: dist <= parcelRadiusM + 25,
            isPaved: tags.surface ? !['dirt', 'earth', 'unpaved', 'sand', 'grass', 'mud'].includes(tags.surface) : tags.highway !== 'track',
            surface: tags.surface || (tags.highway === 'track' ? 'unpaved/gravel' : 'asphalt/paved'),
            maxSpeed: tags.maxspeed,
            lit: tags.lit === 'yes',
            sidewalk: tags.sidewalk
          };
        }
      }

      // Check Watercourse
      if (tags.waterway || tags.natural === 'water' || tags.water) {
        if (dist < minWaterDist) {
          minWaterDist = dist;
          const waterType = tags.waterway || tags.water || tags.natural || 'watercourse';
          closestWater = {
            name: tags.name,
            type: waterType,
            distanceM: Math.max(0, dist - parcelRadiusM),
            isImmediateFloodThreat: dist <= parcelRadiusM + 60 && ['river', 'stream', 'canal'].includes(waterType)
          };
        }
      }

      // Check Power
      if (tags.power) {
        if (dist < minPowerDist) {
          minPowerDist = dist;
          closestPower = {
            found: true,
            type: tags.power === 'line' ? 'Overhead Power Line' : tags.power === 'substation' ? 'Electrical Substation' : tags.power === 'transformer' ? 'Distribution Transformer' : tags.power,
            distanceM: dist,
            voltage: tags.voltage
          };
        }
      }

      // Check Pipelines / Water
      if (tags.man_made === 'pipeline' || tags.pipeline) {
        if (dist < minWaterPipeDist) {
          minWaterPipeDist = dist;
          closestWaterPipe = {
            found: true,
            type: tags.substance === 'water' ? 'Water Supply Main' : tags.substance === 'gas' ? 'Gas Distribution Main' : tags.substance === 'sewage' ? 'Sewerage Main' : 'Municipal Pipeline',
            distanceM: dist
          };
        }
      }

      // Check Telecom
      if (tags.telecom || tags.tower === 'communication' || tags['tower:type'] === 'communication') {
        if (dist < minTelecomDist) {
          minTelecomDist = dist;
          closestTelecom = {
            found: true,
            type: 'Cellular / Telecommunication Mast',
            distanceM: dist
          };
        }
      }

      // Check Protected Area
      if (tags.boundary === 'protected_area' || tags.boundary === 'national_park' || tags.leisure === 'nature_reserve') {
        if (dist < minProtDist) {
          minProtDist = dist;
          closestProt = {
            found: true,
            name: tags.name || tags.protect_class || 'Protected Nature Reserve',
            type: tags.protect_class ? `IUCN Category ${tags.protect_class}` : (tags.boundary || tags.leisure),
            distanceM: Math.max(0, dist - parcelRadiusM)
          };
        }
      }

      // Check Amenities / POIs
      if (tags.shop && ['supermarket', 'convenience', 'bakery', 'grocer'].includes(tags.shop)) {
        if (!amenitiesMap['shop'] || dist < amenitiesMap['shop'].distanceM) {
          amenitiesMap['shop'] = {
            type: 'Grocery / Supermarket',
            name: tags.name || 'Local Grocery Store',
            distanceM: dist,
            category: 'daily_needs'
          };
        }
      }

      if (tags.amenity === 'school' || tags.amenity === 'kindergarten') {
        const key = tags.amenity;
        if (!amenitiesMap[key] || dist < amenitiesMap[key].distanceM) {
          amenitiesMap[key] = {
            type: tags.amenity === 'kindergarten' ? 'Kindergarten / Preschool' : 'Primary / Secondary School',
            name: tags.name || (tags.amenity === 'kindergarten' ? 'Local Kindergarten' : 'Local School'),
            distanceM: dist,
            category: 'education'
          };
        }
      }

      if (tags.amenity === 'pharmacy' || tags.amenity === 'doctors' || tags.amenity === 'hospital' || tags.amenity === 'clinic') {
        if (!amenitiesMap['health'] || dist < amenitiesMap['health'].distanceM) {
          amenitiesMap['health'] = {
            type: tags.amenity === 'hospital' ? 'Hospital' : tags.amenity === 'pharmacy' ? 'Pharmacy' : 'Healthcare Clinic',
            name: tags.name || 'Community Health Facility',
            distanceM: dist,
            category: 'healthcare'
          };
        }
      }

      if (tags.highway === 'bus_stop') {
        if (!amenitiesMap['bus'] || dist < amenitiesMap['bus'].distanceM) {
          amenitiesMap['bus'] = {
            type: 'Bus Stop',
            name: tags.name || 'Public Transit Stop',
            distanceM: dist,
            category: 'transit'
          };
        }
      }

      if (tags.railway === 'station' || tags.railway === 'halt') {
        if (!amenitiesMap['rail'] || dist < amenitiesMap['rail'].distanceM) {
          amenitiesMap['rail'] = {
            type: 'Railway Station',
            name: tags.name || 'Railway Station',
            distanceM: dist,
            category: 'transit'
          };
        }
      }
    }

    const amenityIndex = Object.values(amenitiesMap).sort((a, b) => a.distanceM - b.distanceM);

    return {
      nearestRoad: closestRoad || fallback.nearestRoad,
      nearestWatercourse: closestWater || {
        type: 'No mapped open watercourse within 450m buffer (Statutory flood hazard check required)',
        distanceM: undefined,
        isImmediateFloodThreat: false
      },
      powerInfrastructure: closestPower || { found: false },
      waterInfrastructure: closestWaterPipe || { found: false },
      telecomInfrastructure: closestTelecom || { found: false },
      protectedAreaNearby: closestProt || { found: false },
      surroundingLanduse: Array.from(landuses).slice(0, 6),
      nearbyBuildingsCount: buildingsCount,
      amenityIndex: amenityIndex,
      success: true,
      sourceName: 'OpenStreetMap Live Spatial Vector Query (Overpass API)',
      datasetDate: 'Live Vector Database (2026)'
    };
  } catch (err) {
    console.warn('Overpass API query notice:', err);
    return fallback;
  }
}
