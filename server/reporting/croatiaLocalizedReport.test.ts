import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCroatiaLocalizedReport } from './croatiaLocalizedReport';

const canonical: any = {
  countryCode:'HR', countryName:'Croatia',
  support:{countryCode:'HR',maturity:'LIMITED',capabilities:{nationalCadastre:false,nationalGeology:true,nationalBoreholes:false,nationalHydrogeology:false,nationalFlood:true,nationalPlanning:false,nationalValuation:false,nationalRadon:false,nationalMining:false}},
  authorities:{cadastre:'DGU / Uređena zemlja',geology:'Hrvatski geološki institut',flood:'Hrvatske vode',planning:'ISPU / nadležno tijelo',valuation:'Nije dostupno'},
  geology:{unitName:'Holocene — sedimentary material',lithology:'sedimentary material',geologicalAge:'Holocene',groundwaterRegime:null,status:'VERIFIED',sourceName:'Hrvatski geološki institut (HGI)',sourceUrl:'https://www.hgi-cgs.hr/en/geoloske-karte/'},
  groundContext:{mapped:{sampleCount:1,siteSampleCount:1,parcelSampleCount:1,vicinitySampleCount:0,distinctMappedUnits:['Holocene — sedimentary material'],materialIndicators:['sedimentary material'],transitionIndicated:false,variabilityClass:'LOW',sourceName:'HGI',sourceScale:'1:300,000'},soilVariability:{validSampleCount:1,variationObserved:false,sourceName:'ISRIC SoilGrids'},status:'VERIFIED'},
  terrain:{elevationM:107,minElevationM:107,maxElevationM:107,localReliefM:0,slopeDegrees:0,slopePercent:0,aspectCode:'N',status:'MODELLED'},
  hazards:{landslide:{classification:'LOW',status:'MODELLED',sourceName:'screening'},seismic:{classification:'Low to Very Low',pga:'<0.05g',status:'MODELLED',sourceName:'ESHM20'},radon:{classification:null,status:'REQUIRES_VERIFICATION',sourceName:'JRC',reasonCode:'NOT_SUPPORTED_FOR_COUNTRY'},mining:{classification:null,status:'REQUIRES_VERIFICATION',sourceName:'national source',reasonCode:'NOT_SUPPORTED_FOR_COUNTRY'}},
  flood:{classification:'LOW',status:'VERIFIED',distanceToWaterwayM:null,sourceName:'Hrvatske vode'},
  soil:{texture:'Sandy loam',bearingCapacity:null,status:'MODELLED',sourceName:'ISRIC SoilGrids'},
  planning:{status:'REQUIRES_VERIFICATION',instrumentName:'ISPU',authorityName:'nadležno tijelo',sourceName:'ISPU',reasonCode:'AUTHORITATIVE_DATA_REQUIRED'},
  infrastructure:{roadName:null,roadType:null,distanceM:null,status:'REQUIRES_VERIFICATION',sourceName:'OpenStreetMap',reasonCode:'SOURCE_UNAVAILABLE'},
  utilities:[],
  environment:{protectedAreaName:null,distanceM:null,status:'REQUIRES_VERIFICATION',sourceName:'official environmental source',reasonCode:'SOURCE_UNAVAILABLE'},
  valuation:{min:null,max:null,median:null,currency:'EUR',status:'REQUIRES_VERIFICATION',comparableCount:0,sourceName:'Nije dostupno',reasonCode:'NOT_SUPPORTED_FOR_COUNTRY'},
  evidenceScore:{totalScore:67,verifiedCount:2,modelledCount:3,unverifiedCount:5},
  sourceRecords:[{name:'Hrvatski geološki institut (HGI)',url:'https://www.hgi-cgs.hr/en/geoloske-karte/',status:'VERIFIED'}],
  evidenceRecords:[{id:'croatia-geology',category:'Geological evidence',claim:'Holocene mapped',status:'VERIFIED',sourceName:'HGI',sourceUrl:'https://transformiraj.nipp.hr/',confidence:'High',spatialRelationship:'Exact point'},{id:'flood',category:'Flooding',claim:'Low',status:'VERIFIED',sourceName:'Hrvatske vode',confidence:'High',spatialRelationship:'Screened'}]
};

test('Croatia renderer is fully Croatian and keeps scientific values/source identity intact',()=>{
  const report=renderCroatiaLocalizedReport(canonical);
  assert.equal(report.language,'hr');
  const text=[report.summary,report.sections.soil_and_ground.summary,report.sections.soil_and_ground.detail,report.sections.geohazard_risk.summary,report.sections.geohazard_risk.detail,report.sections.flooding_risk.summary,report.sections.zoning_and_land_use.summary,report.sections.zoning_and_land_use.detail,report.sections.building_regulations.detail,report.sections.environmental_factors.summary,report.sections.infrastructure_and_access.summary,report.sections.market_and_comparables.summary,report.verificationChecklist.map((item:any)=>item.topic+' '+item.reason).join(' '),report.legalDisclaimers.join(' ')].join('\n');
  for(const phrase of ['Executive Summary','Requires verification','Modelled','Verified','No data','Recommended Investigations','Land value only']) assert.doesNotMatch(text,new RegExp(phrase,'i'),phrase);
  assert.match(report.summary,/Ova procjena temeljena na dokazima/i);
  assert.match(report.sections.geohazard_risk.summary,/HGI/);
  assert.match(report.sections.flooding_risk.summary,/Nizak/);
  assert.match(report.sections.zoning_and_land_use.detail,/nadležno tijelo/i);
  assert.match(report.verificationChecklist[0].topic,/planiranja/i);
  assert.equal(report.evidenceRegistry[0].sourceName,'HGI');
});
