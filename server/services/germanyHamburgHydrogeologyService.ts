import type { EvidenceItem, VerifiedSiteReport } from '../types';

export interface GermanyHamburgHydrogeologyResult {
  state: 'Hamburg';
  evidence: EvidenceItem[];
  hydrogeologyMapped: boolean;
  groundwaterDepthMapped: boolean;
  groundwaterMonitoringMapped: boolean;
  nearestMonitoringDistanceM: number | null;
}

const HYDRO_WMS = 'https://geodienste.hamburg.de/wms_grundwassergleichen?';
const MONITORING_OAF = 'https://api.hamburg.de/datasets/v1/grundwassermessstellen/collections/grundwassermessstellen/items';
const SOURCE = 'BUKEA / Geologisches Landesamt Hamburg — Hydrogeologie und Grundwasser';
const STATE = 'Hamburg' as const;
const today = () => new Date().toISOString().slice(0, 10);

async function fetchText(url: string, fetcher: typeof fetch): Promise<string | null> {
  try {
    const r = await fetcher(url, { headers: { Accept: 'application/xml, text/xml, text/plain, application/geo+json, application/json' } });
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

function findLayer(capabilities: string, terms: string[]): string | null {
  const re = /<Layer[^>]*>[\s\S]*?<Name>([^<]+)<\/Name>[\s\S]*?(?:<Title>([^<]+)<\/Title>)?[\s\S]*?<\/Layer>/gi;
  for (const m of capabilities.matchAll(re)) {
    const name = m[1].trim();
    const title = (m[2] || '').toLowerCase();
    if (terms.some(t => name.toLowerCase().includes(t) || title.includes(t))) return name;
  }
  return null;
}

async function queryWms(terms: string[], lat: number, lng: number, fetcher: typeof fetch) {
  const capUrl = HYDRO_WMS + 'SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0';
  const caps = await fetchText(capUrl, fetcher);
  if (!caps) return { text: null, url: capUrl };
  const layer = findLayer(caps, terms);
  if (!layer) return { text: null, url: capUrl };
  const d = 0.015;
  const url = HYDRO_WMS + new URLSearchParams({
    SERVICE:'WMS', VERSION:'1.3.0', REQUEST:'GetFeatureInfo',
    LAYERS:layer, QUERY_LAYERS:layer, INFO_FORMAT:'text/plain',
    CRS:'EPSG:4326',
    BBOX:[(lat-d).toFixed(6),(lng-d).toFixed(6),(lat+d).toFixed(6),(lng+d).toFixed(6)].join(','),
    WIDTH:'101', HEIGHT:'101', I:'50', J:'50', FEATURE_COUNT:'5'
  }).toString();
  return { text: await fetchText(url, fetcher), url };
}

function addEvidence(evidence: EvidenceItem[], id: string, q: {text:string|null;url:string}, claim: string, limitation: string, confidence:'High'|'Medium'|'Low'='Medium') {
  if (!q.text || /serviceexception|exceptionreport|error/i.test(q.text)) return;
  evidence.push({
    id, category:'Hydrogeology',
    claim: claim + ' Official Hamburg response: ' + q.text.replace(/\s+/g,' ').trim().slice(0,1800),
    status:'VERIFIED', sourceName:SOURCE, sourceUrl:q.url, datasetDate:today(),
    spatialRelationship:'Official Hamburg hydrogeological service response at the selected coordinate',
    calculationMethod:'Hamburg WMS GetCapabilities layer discovery followed by point GetFeatureInfo query',
    confidence, limitation, value:{attributeResponse:q.text}
  });
}

function haversineM(lat1:number,lon1:number,lat2:number,lon2:number) {
  const R=6371000, p=Math.PI/180, dLat=(lat2-lat1)*p, dLon=(lon2-lon1)*p;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

async function queryNearestMonitoring(lat:number,lng:number,fetcher:typeof fetch) {
  const dLat=0.08, dLng=0.13;
  const url=MONITORING_OAF+'?'+new URLSearchParams({
    f:'json', limit:'200', bbox:[lng-dLng,lat-dLat,lng+dLng,lat+dLat].join(',')
  }).toString();
  const text=await fetchText(url,fetcher);
  if(!text) return {text:null,url,distanceM:null,feature:null};
  try {
    const json=JSON.parse(text);
    const features=Array.isArray(json.features)?json.features:[];
    let best:any=null, bestD=Infinity;
    for(const f of features) {
      const c=f?.geometry?.coordinates;
      if(!Array.isArray(c)||c.length<2) continue;
      const d=haversineM(lat,lng,Number(c[1]),Number(c[0]));
      if(d<bestD){bestD=d;best=f;}
    }
    return {text,url,distanceM:Number.isFinite(bestD)?bestD:null,feature:best};
  } catch { return {text,url,distanceM:null,feature:null}; }
}

export async function queryGermanyHamburgHydrogeology(lat:number,lng:number,state:string|null|undefined,fetcher:typeof fetch=fetch):Promise<GermanyHamburgHydrogeologyResult>{
  const normalized=String(state||'').trim().toLowerCase();
  if(normalized && !['hamburg','freie und hansestadt hamburg'].includes(normalized))
    return {state:STATE,evidence:[],hydrogeologyMapped:false,groundwaterDepthMapped:false,groundwaterMonitoringMapped:false,nearestMonitoringDistanceM:null};

  const evidence:EvidenceItem[]=[];

  const contours=await queryWms(['grundwassergleichen','gleichplan','grundwasser'],lat,lng,fetcher);
  addEvidence(evidence,'de-hh-groundwater-contours',contours,
    'Hamburg publishes groundwater-elevation contour plans for the first main aquifer, including minimum, maximum and mean groundwater conditions. These contours indicate regional groundwater elevation and flow direction and are specifically used for planning groundwater management and keeping excavations dry.',
    'Contour plans are interpolated regional products. Local groundwater levels can differ, especially where monitoring density is lower or hydrogeological conditions change rapidly. They do not replace a site measurement.','High');

  const monitoring=await queryNearestMonitoring(lat,lng,fetcher);
  if(monitoring.feature) {
    const p=monitoring.feature.properties||{};
    evidence.push({
      id:'de-hh-current-groundwater-monitor',
      category:'Hydrogeology',
      claim:'A Hamburg groundwater monitoring station is mapped near the selected site. The published current-data service provides daily mean groundwater levels and their classification; the nearest returned station is approximately '+Math.round(monitoring.distanceM||0)+' m away. Reported attributes: '+JSON.stringify({
        station:p.messstellennummer, aquifer:p.grundwasserleiterzuordnung, aquiferType:p.grundwasserleiterart,
        groundElevationNHN:p.gelaendeoberkante, groundwaterLevelNHN:p.wasserstand, groundwaterDepthBelowGroundM:p.wasserstand_m_u_gok,
        date:p.datum, classification:p.klassifikation_des_aktuellen_grundwasserstandes
      }),
      status:'VERIFIED', sourceName:SOURCE, sourceUrl:monitoring.url, datasetDate:today(),
      spatialRelationship:'Nearest published Hamburg groundwater monitoring feature returned within approximately 13 km of the selected coordinate',
      calculationMethod:'Hamburg OGC API Features query with a coordinate bounding box, followed by haversine nearest-feature selection',
      confidence:'High',
      limitation:'Hamburg states that monitoring coordinates are deliberately blurred and may differ from the actual station location by more than 100 m. A monitoring station is not a property-level measurement; aquifer, elevation and date must be considered.',
      value:{distanceM:monitoring.distanceM,attributes:p}
    });
  }

  const hydro=await queryWms(['hydrogeologische profiltypen','profiltypen','hydrogeologie'],lat,lng,fetcher);
  addEvidence(evidence,'de-hh-hydrogeological-profile-type',hydro,
    'Hamburg hydrogeological profile-type mapping describes the relationship between permeable and less-permeable layers in the unsaturated zone and helps distinguish settings where shallow groundwater or perched/stagnant water may occur.',
    'The profile-type mapping is regional and does not determine exact layer thickness or current groundwater depth at a property. Local borehole information can be more detailed.','Medium');

  if(!evidence.length) evidence.push({
    id:'de-hh-hydrogeology-no-data',category:'Hydrogeology',
    claim:'The official Hamburg hydrogeological services did not return a usable attribute response for the selected coordinate.',
    status:'REQUIRES_VERIFICATION',sourceName:SOURCE,sourceUrl:HYDRO_WMS,datasetDate:today(),
    spatialRelationship:'Selected site coordinate in Hamburg',
    calculationMethod:'Official Hamburg hydrogeological service query; missing responses are not interpreted as negative findings',
    confidence:'Low',limitation:'No current groundwater condition is inferred from a missing regional-map response.',
    value:{reasonCode:'INSUFFICIENT_EVIDENCE'}
  });

  return {
    state:STATE,evidence,
    hydrogeologyMapped:evidence.some(i=>i.id==='de-hh-hydrogeological-profile-type'&&i.status==='VERIFIED'),
    groundwaterDepthMapped:evidence.some(i=>i.id==='de-hh-groundwater-contours'&&i.status==='VERIFIED'),
    groundwaterMonitoringMapped:evidence.some(i=>i.id==='de-hh-current-groundwater-monitor'&&i.status==='VERIFIED'),
    nearestMonitoringDistanceM:monitoring.distanceM
  };
}

export function enrichGermanyHamburgHydrogeology(report:VerifiedSiteReport&Record<string,any>,result:GermanyHamburgHydrogeologyResult):void{
  if(!Array.isArray(report.evidenceRegistry)) report.evidenceRegistry=[];
  report.evidenceRegistry.push(...result.evidence);
  const contours=result.evidence.find(i=>i.id==='de-hh-groundwater-contours'&&i.status==='VERIFIED');
  const hydro=result.evidence.find(i=>i.id==='de-hh-hydrogeological-profile-type'&&i.status==='VERIFIED');
  const monitor=result.evidence.find(i=>i.id==='de-hh-current-groundwater-monitor'&&i.status==='VERIFIED');
  report.geosurvey_context={
    ...(report.geosurvey_context||{}),
    hh_hydrogeology_mapped:Boolean(hydro),
    hh_groundwater_contours_mapped:Boolean(contours),
    hh_groundwater_monitoring_mapped:Boolean(monitor),
    hh_nearest_groundwater_monitor_distance_m:Number.isFinite(result.nearestMonitoringDistanceM||NaN)?result.nearestMonitoringDistanceM:null,
    hh_hydrogeology_evidence_level:hydro||contours||monitor?'VERIFIED':'REQUIRES_VERIFICATION',
    hh_hydrogeology_source:SOURCE
  };
  if(report.soil&&(hydro||contours||monitor)){
    report.soil.groundwaterNotice=[
      monitor?.claim,contours?.claim,hydro?.claim,
      'Hamburg has shallow groundwater in many parts of the city, and official guidance explicitly identifies groundwater ingress as a construction concern.',
      'For excavation screening, the nearest monitoring evidence should be interpreted together with the groundwater contours and the planned excavation depth. Local/perched groundwater and seasonal or high-groundwater conditions still require site investigation.'
    ].filter(Boolean).join(' ');
  }
}

export const GERMANY_HAMBURG_HYDROGEOLOGY_SOURCES={
  groundwaterContoursWms:HYDRO_WMS,
  currentMonitoringOaf:MONITORING_OAF,
  hydrogeology:'https://www.hamburg.de/politik-und-verwaltung/behoerden/bukea/themen/boden-und-geologie/geologie/hydrogeologie-168934',
  groundwaterPlanningMaps:'https://www.hamburg.de/politik-und-verwaltung/behoerden/bukea/themen/wasser/grundwasser/artikel-hydrogeologische-planungskarten-175950',
  currentGroundwater:'https://www.hamburg.de/politik-und-verwaltung/behoerden/bukea/themen/wasser/grundwasser/grundwasserstand-176112'
};
