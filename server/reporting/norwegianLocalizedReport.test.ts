import test from 'node:test';
import assert from 'node:assert/strict';
import { renderNorwegianLocalizedReport } from './norwegianLocalizedReport';

function fixture(): any {
  return {
    countryCode:'NO', countryName:'Norway',
    support:{countryCode:'NO',maturity:'LIMITED',capabilities:{nationalCadastre:true,nationalGeology:true,nationalBoreholes:true,nationalHydrogeology:true,nationalFlood:false,nationalPlanning:false,nationalValuation:false,nationalRadon:true,nationalMining:false}},
    authorities:{cadastre:'Kartverket (Matrikkelen / Grunnboken)',geology:'Norges geologiske undersøkelse (NGU / NADAG)',flood:'Norges vassdrags- og energidirektorat (NVE)',planning:'Kommunen',valuation:'Ingen støttet automatisk kilde'},
    geology:{unitName:null,lithology:null,geologicalAge:null,groundwaterRegime:null,status:'REQUIRES_VERIFICATION',sourceName:'Norges geologiske undersøkelse (NGU / NADAG)',reasonCode:'NO_DATA'},
    groundContext:{mapped:null,soilVariability:null,status:'REQUIRES_VERIFICATION',reasonCode:'INSUFFICIENT_EVIDENCE'},
    terrain:{elevationM:147,minElevationM:145,maxElevationM:150,localReliefM:5,slopeDegrees:6.8,slopePercent:12,aspectCode:'W',status:'MODELLED'},
    soil:{texture:null,bearingCapacity:null,status:'REQUIRES_VERIFICATION',sourceName:'SoilGrids',reasonCode:'SOURCE_UNAVAILABLE'},
    hazards:{
      landslide:{classification:'NEGLIGIBLE',status:'MODELLED',sourceName:'screening'},
      seismic:{classification:null,pga:null,status:'REQUIRES_VERIFICATION',sourceName:'ESHM20'},
      radon:{classification:null,status:'REQUIRES_VERIFICATION',sourceName:'NGU',reasonCode:'MALFORMED_DATA'},
      mining:{classification:null,status:'REQUIRES_VERIFICATION',sourceName:'NGU',reasonCode:'NOT_SUPPORTED_FOR_COUNTRY'}
    },
    flood:{classification:null,status:'REQUIRES_VERIFICATION',sourceName:'NVE',reasonCode:'NOT_SUPPORTED_FOR_COUNTRY'},
    planning:{status:'REQUIRES_VERIFICATION',instrumentName:'Kommuneplanens arealdel / reguleringsplan',authorityName:'Østerås competent local planning authority',sourceName:'Østerås Spatial Planning Authority (Kommuneplanens arealdel / reguleringsplan)',reasonCode:'NOT_SUPPORTED_FOR_COUNTRY'},
    infrastructure:{roadName:null,roadType:null,distanceM:null,status:'REQUIRES_VERIFICATION',sourceName:'OpenStreetMap',reasonCode:'SOURCE_UNAVAILABLE'},
    utilities:[],
    environment:{protectedAreaName:null,distanceM:null,status:'REQUIRES_VERIFICATION',sourceName:'OpenStreetMap',reasonCode:'SOURCE_UNAVAILABLE'},
    valuation:{min:null,max:null,median:null,currency:'NOK',status:'REQUIRES_VERIFICATION',comparableCount:0,sourceName:'No generic land-price fallback',reasonCode:'NOT_SUPPORTED_FOR_COUNTRY'},
    evidenceScore:{totalScore:35},sourceRecords:[],evidenceRecords:[]
  };
}

test('Norwegian planning labels remain Norwegian', () => {
  const report=renderNorwegianLocalizedReport(fixture());
  const text=JSON.stringify({planning:report.sections.zoning_and_land_use, checklist:report.verificationChecklist});
  assert.doesNotMatch(text,/Spatial Planning Authority|competent local planning authority/i);
  assert.match(text,/kommunens planmyndighet/i);
  assert.match(report.verificationChecklist[0].recommendedAuthorityOrExpert,/kommunens planmyndighet/i);
});