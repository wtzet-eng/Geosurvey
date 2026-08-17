/**
 * OpenStreetMap Overpass Spatial Proximity & Infrastructure Engine
 * Executes live geospatial vector queries for contextual evidence.
 */

export interface AmenityPoint { type: string; name: string; distanceM: number; category: 'transit' | 'education' | 'daily_needs' | 'healthcare' | 'civic'; }
export interface OverpassSpatialFeatures {
  nearestRoad: { name?: string; type: string; distanceM: number; hasDirectAccess: boolean; isPaved: boolean; surface?: string; maxSpeed?: string; lit?: boolean; sidewalk?: string; };
  nearestWatercourse: { name?: string; type: string; distanceM?: number; isImmediateFloodThreat: boolean; };
  powerInfrastructure: { found: boolean; type?: string; distanceM?: number; voltage?: string; };
  waterInfrastructure: { found: boolean; type?: string; distanceM?: number; };
  telecomInfrastructure: { found: boolean; type?: string; distanceM?: number; };
  protectedAreaNearby: { found: boolean; name?: string; type?: string; distanceM?: number; };
  surroundingLanduse: string[]; nearbyBuildingsCount: number; amenityIndex: AmenityPoint[]; success: boolean; sourceName: string; datasetDate: string;
}

export function haversineDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number { const R = 6371000; const dLat = ((lat2 - lat1) * Math.PI) / 180; const dLon = ((lon2 - lon1) * Math.PI) / 180; const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2; return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); }

const unavailable = (): OverpassSpatialFeatures => ({
  nearestRoad: { name: undefined, type: 'Not established', distanceM: NaN, hasDirectAccess: false, isPaved: false, surface: 'Not established' },
  nearestWatercourse: { type: 'Not established', distanceM: undefined, isImmediateFloodThreat: false },
  powerInfrastructure: { found: false }, waterInfrastructure: { found: false }, telecomInfrastructure: { found: false }, protectedAreaNearby: { found: false }, surroundingLanduse: [], nearbyBuildingsCount: 0, amenityIndex: [], success: false, sourceName: 'OpenStreetMap Overpass query unavailable', datasetDate: new Date().toISOString().slice(0, 10)
});

export async function queryOverpassSurroundings(lat: number, lng: number, parcelRadiusM: number = 30): Promise<OverpassSpatialFeatures> {
  const searchRadiusM = 450; const amenitySearchRadiusM = 1200;
  const query = `[out:json][timeout:8];(way["highway"](around:${searchRadiusM},${lat},${lng});way["waterway"](around:${searchRadiusM},${lat},${lng});relation["waterway"](around:${searchRadiusM},${lat},${lng});way["natural"="water"](around:${searchRadiusM},${lat},${lng});node["power"](around:${searchRadiusM},${lat},${lng});way["power"](around:${searchRadiusM},${lat},${lng});way["man_made"="pipeline"](around:${searchRadiusM},${lat},${lng});node["man_made"="pipeline"](around:${searchRadiusM},${lat},${lng});node["telecom"](around:${searchRadiusM},${lat},${lng});way["boundary"="protected_area"](around:${searchRadiusM},${lat},${lng});relation["boundary"="protected_area"](around:${searchRadiusM},${lat},${lng});way["landuse"](around:${searchRadiusM},${lat},${lng});way["building"](around:250,${lat},${lng});node["amenity"~"school|kindergarten|pharmacy|hospital|doctors|clinic|post_office"](around:${amenitySearchRadiusM},${lat},${lng});node["shop"~"supermarket|convenience|bakery|grocer"](around:${amenitySearchRadiusM},${lat},${lng});node["highway"="bus_stop"](around:${amenitySearchRadiusM},${lat},${lng});node["railway"="station"](around:2500,${lat},${lng}););out tags center 60;`;
  try {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 9000); let res: Response | null = null;
    for (const ep of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter']) {
      try { res = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'GeoSurvey/1.0 evidence extraction' }, body: `data=${encodeURIComponent(query)}`, signal: controller.signal }); if (res.ok) break; } catch {}
    }
    clearTimeout(timer); if (!res || !res.ok) return unavailable(); const data: any = await res.json(); if (!Array.isArray(data?.elements)) return unavailable();
    let minRoad=Infinity,minWater=Infinity,minPower=Infinity,minPipe=Infinity,minTelecom=Infinity,minProt=Infinity; let road:any,water:any,power:any,pipe:any,telecom:any,prot:any; const landuses=new Set<string>(); let buildings=0; const amenities:Record<string,AmenityPoint>={};
    for (const el of data.elements) { const elLat=el.center?.lat ?? el.lat, elLng=el.center?.lon ?? el.lon; if (!Number.isFinite(elLat)||!Number.isFinite(elLng)) continue; const dist=haversineDistanceM(lat,lng,elLat,elLng), t=el.tags||{};
      if(t.building&&dist<=250) buildings++; if(t.landuse) landuses.add(t.landuse);
      if(t.highway&&!['bus_stop','traffic_signals','crossing','street_lamp'].includes(t.highway)&&dist<minRoad){minRoad=dist;road={name:t.name||t.ref,type:t.highway,distanceM:Math.max(0,dist-parcelRadiusM),hasDirectAccess:dist<=parcelRadiusM+25,isPaved:t.surface?!['dirt','earth','unpaved','sand','grass','mud'].includes(t.surface):t.highway!=='track',surface:t.surface||'Unverified',maxSpeed:t.maxspeed,lit:t.lit==='yes',sidewalk:t.sidewalk};}
      if((t.waterway||t.natural==='water'||t.water)&&dist<minWater){minWater=dist;const wt=t.waterway||t.water||t.natural;water={name:t.name,type:wt,distanceM:Math.max(0,dist-parcelRadiusM),isImmediateFloodThreat:dist<=parcelRadiusM+60&&['river','stream','canal'].includes(wt)};}
      if(t.power&&dist<minPower){minPower=dist;power={found:true,type:t.power==='line'?'Overhead Power Line':t.power==='substation'?'Electrical Substation':t.power,distanceM:dist,voltage:t.voltage};}
      if((t.man_made==='pipeline'||t.pipeline)&&dist<minPipe){minPipe=dist;pipe={found:true,type:t.substance==='water'?'Water Supply Main':t.substance==='sewage'?'Sewerage Main':t.substance==='gas'?'Gas Distribution Main':'Municipal Pipeline',distanceM:dist};}
      if((t.telecom||t.tower==='communication'||t['tower:type']==='communication')&&dist<minTelecom){minTelecom=dist;telecom={found:true,type:'Telecommunication infrastructure',distanceM:dist};}
      if((t.boundary==='protected_area'||t.boundary==='national_park'||t.leisure==='nature_reserve')&&dist<minProt){minProt=dist;prot={found:true,name:t.name||'Protected area',type:t.protect_class?`IUCN Category ${t.protect_class}`:(t.boundary||t.leisure),distanceM:Math.max(0,dist-parcelRadiusM)};}
      const add=(key:string,p:AmenityPoint)=>{if(!amenities[key]||dist<amenities[key].distanceM)amenities[key]=p;}; if(t.shop&&['supermarket','convenience','bakery','grocer'].includes(t.shop))add('shop',{type:'Grocery / Supermarket',name:t.name||'Unnamed grocery',distanceM:dist,category:'daily_needs'}); if(t.amenity==='school'||t.amenity==='kindergarten')add(t.amenity,{type:t.amenity==='kindergarten'?'Kindergarten / Preschool':'School',name:t.name||'Unnamed school',distanceM:dist,category:'education'}); if(['pharmacy','doctors','hospital','clinic'].includes(t.amenity))add('health',{type:t.amenity==='hospital'?'Hospital':t.amenity==='pharmacy'?'Pharmacy':'Healthcare',name:t.name||'Unnamed healthcare facility',distanceM:dist,category:'healthcare'}); if(t.highway==='bus_stop')add('bus',{type:'Bus Stop',name:t.name||'Unnamed bus stop',distanceM:dist,category:'transit'}); if(t.railway==='station')add('rail',{type:'Railway Station',name:t.name||'Unnamed station',distanceM:dist,category:'transit'});
    }
    return { nearestRoad:road||{type:'No mapped road in query radius',distanceM:undefined as any,hasDirectAccess:false,isPaved:false,surface:'No mapped feature'}, nearestWatercourse:water||{type:'No mapped surface water feature in query radius',distanceM:undefined,isImmediateFloodThreat:false}, powerInfrastructure:power||{found:false},waterInfrastructure:pipe||{found:false},telecomInfrastructure:telecom||{found:false},protectedAreaNearby:prot||{found:false},surroundingLanduse:[...landuses].slice(0,6),nearbyBuildingsCount:buildings,amenityIndex:Object.values(amenities).sort((a,b)=>a.distanceM-b.distanceM),success:true,sourceName:'OpenStreetMap Live Spatial Vector Query (Overpass API)',datasetDate:new Date().toISOString().slice(0,10)};
  } catch { return unavailable(); }
}
