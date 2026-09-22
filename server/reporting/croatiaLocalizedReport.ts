import { AvailabilityReason, CanonicalReport, RiskClassification } from './canonicalReport';

type Copy = {
  unavailable: string; supported: string; limited: string; verified: string; modelled: string; requires: string;
  confidenceHigh: string; confidenceMedium: string; confidenceLow: string;
  geology: (source: string, unit: string) => string; terrain: (elevation: number, slope: unknown) => string;
  soil: (texture: string, bearing: string) => string; flood: (risk: string) => string;
  road: (road: string, distance: string) => string; environmentClear: string; environment: (area: string) => string;
  valuation: (min: string, max: string, currency: string) => string; noValuation: string;
  summary: (country: string, geology: string, terrain: string, soil: string) => string;
  supportNotice: string; groundTitle: string; variability: Record<string,string>; contextConsistent: string; contextTransition: string; contextInsufficient: string;
  investigationFocus: string; mappedUnits: string; materialIndicators: string; mappedSamples: string; groundLimitation: string; soilModelVariable: string; soilModelConsistent: string; soilModelInsufficient: string;
  titles: { estimated_value: string; confidence: string; executive_summary: string }; planningSummary: (instrument: string) => string; planningDetail: (instrument: string) => string;
  binding: string; mappedGeologyLimitation: string; landOnly: string; preliminaryDisclaimer: string; noAbsenceDisclaimer: string; modelDisclaimer: string; planningDisclaimer: string; sourceDisclaimer: string;
  checklist: Array<[string,string,'geology'|'cadastre'|'planning']>; utilityNames: Record<string,string>; utilityMapped: string; utilityDistance: (distance:number)=>string;
  riskNames: { landslide:string; seismic:string; radon:string; mining:string }; opportunities:string[];
};

const c: Copy = {
  unavailable:'Nema podataka', supported:'Podržano', limited:'Ograničena pokrivenost', verified:'Provjereno', modelled:'Modelirano', requires:'Potrebna provjera',
  confidenceHigh:'Visoka kvaliteta dokaza', confidenceMedium:'Srednja kvaliteta dokaza', confidenceLow:'Preliminarna kvaliteta dokaza',
  geology:(source,unit)=>`Prema izvoru ${source}, lokacija se nalazi u geološkoj jedinici ${unit}.`, terrain:(elevation,slope)=>`Modelirani teren: nadmorska visina ${elevation} m i nagib ${slope}°.`,
  soil:(texture,bearing)=>`Model tla: tekstura ${texture}; nosivost: ${bearing}.`, flood:risk=>`Preliminarna klasifikacija opasnosti od poplava: ${risk}.`, road:(road,distance)=>`Najbliža kartirana javna prometnica: ${road}, približno ${distance} m udaljena.`,
  environmentClear:'Na ispitivanom području nije kartirano zaštićeno područje.', environment:area=>`Preliminarni okolišni pregled identificirao je ${area}.`,
  valuation:(min,max,currency)=>`Indikativna statistička vrijednost zemljišta: ${min}–${max} ${currency}.`, noValuation:'Automatizirana vrijednost zemljišta nije prikazana jer nema dovoljno potkrijepljenih nacionalnih dokaza o vrijednosti.',
  summary:(country,geology,terrain,soil)=>`Ova procjena temeljena na dokazima odnosi se na lokaciju u ${country}. Geološka jedinica: ${geology}. ${terrain} Tlo: ${soil}.`,
  supportNotice:'Ograničena pokrivenost: automatizirani su samo nacionalni izvori koji su stvarno integrirani. Ostale kategorije treba provjeriti kod nadležnog tijela.',
  groundTitle:'Prostorni kontekst podzemlja', variability:{LOW:'Niska',MODERATE:'Umjerena',HIGH:'Visoka',INSUFFICIENT_EVIDENCE:'Nedovoljno dokaza'},
  contextConsistent:'Dostupni kartirani uzorci uglavnom su međusobno usklađeni oko lokacije; to ne potvrđuje uvjete ispod cijele parcele.',
  contextTransition:'Kartirani uzorci upućuju na prijelaz između više geoloških ili genetskih jedinica oko lokacije.',
  contextInsufficient:'Kartirani uzorci nisu dovoljni za pouzdanu procjenu prostorne varijabilnosti podzemlja.',
  investigationFocus:'Prije tehničke odluke provjerite materijale, njihovo stanje, debljinu i vodne uvjete ciljanim istraživanjem konkretne lokacije.', mappedUnits:'Kartirane jedinice', materialIndicators:'Pokazatelji kartiranog materijala', mappedSamples:'Kartirani uzorci',
  groundLimitation:'Kartirani i modelirani podaci služe samo za preliminarni screening. Ne potvrđuju profil ispod parcele, debljinu slojeva, podzemne vode ni projektne parametre.',
  soilModelVariable:'Model tla pokazuje prostornu varijaciju teksture.', soilModelConsistent:'Model tla je relativno ujednačen u dostupnim uzorcima.', soilModelInsufficient:'Nema dovoljno uzoraka modela tla za procjenu varijabilnosti.',
  titles:{estimated_value:'Indikativna statistička vrijednost zemljišta',confidence:'Kvaliteta dokaza',executive_summary:'Sažetak procjene'},
  planningSummary:instrument=>`Parametre planiranja treba potvrditi prema ${instrument}.`, planningDetail:instrument=>`Obvezujuća prava i ograničenja treba provjeriti u važećoj dokumentaciji koja se odnosi na ${instrument}.`,
  binding:'Obvezujuće informacije treba potvrditi nadležno tijelo.', mappedGeologyLimitation:'Kartirana geološka podloga služi za preliminarni screening i ne zamjenjuje istraživanje konkretne lokacije.',
  landOnly:'Samo vrijednost zemljišta — zgrade, građevine i druga poboljšanja nisu uključeni.', preliminaryDisclaimer:'Ovaj automatizirani izvještaj je preliminarni screening i alat za podršku odlučivanju; nije službena odluka, pravno mišljenje ni stručno istraživanje lokacije.',
  noAbsenceDisclaimer:'Izostanak evidentirane opasnosti, ograničenja ili okolišnog problema nije dokaz da on ne postoji.', modelDisclaimer:'Modelirani podaci o tlu ne zamjenjuju geotehničko istraživanje prema Eurokodu 7.', planningDisclaimer:'Obvezujuća prava građenja i planska pravila treba službeno potvrditi.', sourceDisclaimer:'Prije investicijske odluke provjerite aktualnost, dostupnost i ograničenja svih izvora.',
  checklist:[['Službena potvrda planiranja','Provjerite obvezujuća pravila planiranja i važeću dokumentaciju kod nadležnog tijela.','planning'],['Geotehničko istraživanje','Provedite geotehničko istraživanje konkretne lokacije u skladu s Eurokodom 7.','geology'],['Topografska i katastarska provjera','Po potrebi profesionalno provjerite granice i dimenzije; kartirana geometrija nije pravno utvrđivanje međa.','cadastre'],['Uvjeti priključenja na infrastrukturu','Zatražite službene uvjete priključenja od upravitelja mreža.','cadastre'],['Vlasništvo i tereti','Provjerite vlasništvo, služnosti, terete i druga pravna ograničenja u nadležnim registrima.','cadastre']],
  utilityNames:{ELECTRICITY:'Električna energija',WATER:'Voda',SEWER:'Kanalizacija',GAS:'Plin',TELECOM:'Telekomunikacije',OTHER:'Mreža'},
  utilityMapped:'Mreža je kartirana u korištenom skupu podataka.', utilityDistance:distance=>`Mreža je kartirana približno ${distance} m od lokacije. Upravitelj mreže mora potvrditi mogućnost priključenja.`,
  riskNames:{landslide:'Odroni i klizišta',seismic:'Seizmički rizik',radon:'Radon',mining:'Utjecaj rudarstva'},
  opportunities:['Kanonijski model čuva porijeklo i status svakog dokaza.','Podaci o terenu, tlu i javnim izvorima objedinjeni su u jednoj preliminarnoj procjeni.']
};

const reason = (code?: AvailabilityReason) => {
  switch (code) {
    case 'NO_DATA': return 'Izvor je uspješno dohvaćen, ali za ovu lokaciju nije vratio objekt. To nije dokaz da pojava ne postoji.';
    case 'SOURCE_UNAVAILABLE': return 'Izvor je privremeno nedostupan ili mu se nije moguće povezati. Potrebna je provjera.';
    case 'MALFORMED_DATA': return 'Odgovor izvora nije bilo moguće sigurno provjeriti. Vrijednost nije izvedena.';
    case 'PARAMETER_NOT_PROVIDED': return 'Ovaj parametar nije dostupan u korištenom skupu podataka.';
    case 'INSUFFICIENT_EVIDENCE': return 'Dostupni dokazi nisu dovoljni za sigurnu izvedbu ove vrijednosti.';
    case 'NOT_SUPPORTED_FOR_COUNTRY': return 'Ovaj automatizirani izvor nije podržan za odabranu državu.';
    case 'AUTHORITATIVE_DATA_REQUIRED': return 'Ovaj podatak treba potvrditi nadležno tijelo.';
    default: return c.unavailable;
  }
};
const level = (value: unknown) => String(value ?? '').trim();
const localScientificValue = (value: string | null | undefined) => {
  if (!value) return c.unavailable;
  const text = value.trim();
  return text.replace(/\bHolocene\b/gi, 'Holocen').replace(/\bsedimentary material\b/gi, 'sedimentni materijal').replace(/\bclastic sedimentary rock\b/gi, 'klastične sedimentne stijene').replace(/\blimestone\b/gi, 'vapnenac');
};
const localSoilTexture = (value: string | null | undefined) => {
  if (!value) return c.unavailable;
  const map: Record<string, string> = {'sandy loam':'pjeskovita ilovača','loam':'ilovača','clay loam':'glinasta ilovača','silt loam':'praškasta ilovača'};
  return map[value.trim().toLowerCase()] || value.trim();
};

const localRisk = (classification: RiskClassification | null | undefined) => {
  if (!classification) return c.unavailable;
  return ({NEGLIGIBLE:'Zanemariv',LOW:'Nizak',MODERATE:'Umjeren',HIGH:'Visok'} as Record<string,string>)[classification] || classification;
};
const authority = (canonical: CanonicalReport, kind: 'geology'|'cadastre'|'planning') => kind === 'geology' ? canonical.authorities.geology : kind === 'planning' ? canonical.authorities.planning : canonical.authorities.cadastre;

export function renderCroatiaLocalizedReport(canonical: CanonicalReport): any {
  const geologyUnit = localScientificValue(canonical.geology.unitName);
  const terrainText = canonical.terrain.elevationM === null ? c.unavailable : c.terrain(canonical.terrain.elevationM, level(canonical.terrain.slopeDegrees) || c.unavailable);
  const soilTexture = localSoilTexture(canonical.soil.texture);
  const soilText = c.soil(soilTexture, canonical.soil.bearingCapacity || reason('INSUFFICIENT_EVIDENCE'));
  const geologyText = canonical.geology.unitName ? c.geology(canonical.geology.sourceName,geologyUnit) : reason(canonical.geology.reasonCode);
  const mapped: any = canonical.groundContext?.mapped || null;
  const soilVariability: any = canonical.groundContext?.soilVariability || null;
  const variabilityCode = mapped?.variabilityClass || (soilVariability?.validSampleCount >= 2 ? (soilVariability.variationObserved ? 'MODERATE':'LOW') : 'INSUFFICIENT_EVIDENCE');
  const contextSummary = mapped?.sampleCount ? (mapped.transitionIndicated ? c.contextTransition : c.contextConsistent) : c.contextInsufficient;
  const groundContext = {
    title:c.groundTitle,evidence_level:canonical.groundContext?.status || 'REQUIRES_VERIFICATION',variability_code:variabilityCode,variability_label:c.variability[variabilityCode] || variabilityCode,summary:contextSummary,
    mapped_units_label:c.mappedUnits,mapped_units:mapped?.distinctMappedUnits || [],material_indicators_label:c.materialIndicators,material_indicators:mapped?.materialIndicators || [],transition_indicated:Boolean(mapped?.transitionIndicated),sample_label:c.mappedSamples,
    sample_count:mapped?.sampleCount || 0,site_sample_count:mapped?.siteSampleCount || 0,parcel_sample_count:mapped?.parcelSampleCount || 0,vicinity_sample_count:mapped?.vicinitySampleCount || 0,
    soil_model_summary:soilVariability?.validSampleCount ? (soilVariability.variationObserved ? c.soilModelVariable : c.soilModelConsistent) : c.soilModelInsufficient,soil_model_sample_count:soilVariability?.validSampleCount || 0,
    soil_sand_range:soilVariability?.topsoilSandPctRange || null,soil_silt_range:soilVariability?.topsoilSiltPctRange || null,soil_clay_range:soilVariability?.topsoilClayPctRange || null,
    investigation_focus:c.investigationFocus,limitation:c.groundLimitation,source_name:mapped?.sourceName || soilVariability?.sourceName || null,source_scale:mapped?.sourceScale || soilVariability?.sourceResolution || null,
    terrain_min_elevation_m:canonical.terrain.minElevationM ?? null,terrain_max_elevation_m:canonical.terrain.maxElevationM ?? null,terrain_local_relief_m:canonical.terrain.localReliefM ?? null
  };
  const valuationAvailable = canonical.valuation.min !== null && canonical.valuation.max !== null;
  const valuationText = valuationAvailable ? c.valuation(canonical.valuation.min!.toLocaleString('hr-HR'),canonical.valuation.max!.toLocaleString('hr-HR'),canonical.valuation.currency) : c.noValuation;
  const floodText = canonical.flood.classification ? c.flood(localRisk(canonical.flood.classification)) : reason(canonical.flood.reasonCode);
  const roadText = canonical.infrastructure.distanceM !== null && canonical.infrastructure.distanceM !== undefined ? c.road(canonical.infrastructure.roadName || canonical.infrastructure.roadType || c.unavailable, level(canonical.infrastructure.distanceM)) : reason(canonical.infrastructure.reasonCode || 'NO_DATA');
  const environmentText = canonical.environment.status === 'REQUIRES_VERIFICATION' || canonical.environment.reasonCode ? reason(canonical.environment.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED') : canonical.environment.protectedAreaName ? c.environment(canonical.environment.protectedAreaName) : c.environmentClear;
  const evidenceRegistry = canonical.evidenceRecords.map(record => {
    const code=(record.value as {reasonCode?:AvailabilityReason}|null)?.reasonCode; const support=record.id.startsWith('country-support-');
    return {...record,category:support?'Nacionalna pokrivenost':record.category,claim:support?reason('NOT_SUPPORTED_FOR_COUNTRY'):record.claim,spatialRelationship:support?c.supportNotice:record.spatialRelationship,confidence:record.confidence==='High'?c.confidenceHigh:record.confidence==='Medium'?c.confidenceMedium:c.confidenceLow,limitation:record.status==='REQUIRES_VERIFICATION'?reason(code):c.binding};
  });
  const planningAuthority=canonical.planning.authorityName || c.unavailable; const planningSource=canonical.planning.sourceName || planningAuthority;
  const planningInstrument = canonical.countryCode === 'HR' ? 'važećoj prostorno-planskoj dokumentaciji i sustavu ISPU' : canonical.planning.instrumentName;
  const checklist=c.checklist.map(([topic,itemReason,kind],index)=>({topic,reason:itemReason,recommendedAuthorityOrExpert:kind==='geology'?'Geotehnički inženjer / stručnjak za istraživanje tla':authority(canonical,kind),priority:index===3?'Medium':'High'}));
  const utilitiesChecklist=(canonical.utilities || []).map(item=>({utility:c.utilityNames[item.utilityCode] || item.utilityCode,status:item.mapped?(item.distanceM===null?c.utilityMapped:c.utilityDistance(item.distanceM)):reason(item.reasonCode),evidence_level:item.status,provider_type:item.sourceName,distance_m:item.distanceM ?? undefined,mapped_in_dataset:item.mapped,limitation:item.mapped?reason('AUTHORITATIVE_DATA_REQUIRED'):reason(item.reasonCode)}));
  const dataSources=canonical.sourceRecords.map(source=>({name:source.name,url:source.url,authority:source.name,verification_status:source.status==='VERIFIED'?c.verified:source.status==='MODELLED'?c.modelled:c.requires}));
  const section=(summary:string,detail:string,status:string,source?:string,limitation?:string)=>({summary,detail,evidence_level:status,source_cited:source,limitation_notice:limitation});
  return {
    language:'hr',countrySupport:{maturity:canonical.support.maturity,label:canonical.support.maturity==='SUPPORTED'?c.supported:c.limited,notice:c.supportNotice,capabilities:canonical.support.capabilities},groundContext,
    summary:`${c.summary(canonical.countryCode === 'HR' ? 'Hrvatskoj' : canonical.countryName,geologyUnit,terrainText,soilTexture)} ${c.supportNotice}`,titles:c.titles,confidenceLabel:canonical.evidenceScore.totalScore>=75?c.confidenceHigh:canonical.evidenceScore.totalScore>=50?c.confidenceMedium:c.confidenceLow,
    unavailableReasons:{geology:reason(canonical.geology.reasonCode),soilTexture:reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED'),engineeringParameter:reason('INSUFFICIENT_EVIDENCE'),groundwater:canonical.support.capabilities.nationalHydrogeology?reason('AUTHORITATIVE_DATA_REQUIRED'):reason('NOT_SUPPORTED_FOR_COUNTRY'),planning:reason(canonical.planning.reasonCode),valuation:reason(canonical.valuation.reasonCode),sourceUnavailable:reason('SOURCE_UNAVAILABLE'),noFeature:reason('NO_DATA')},
    sections:{soil_and_ground:section(soilText,`${c.binding} ${contextSummary} ${c.investigationFocus}`,canonical.soil.status,canonical.soil.sourceName,canonical.soil.reasonCode?reason(canonical.soil.reasonCode):undefined),geohazard_risk:section(geologyText,`${geologyText} ${c.mappedGeologyLimitation}`,canonical.geology.status,canonical.geology.sourceName,canonical.geology.reasonCode?reason(canonical.geology.reasonCode):undefined),flooding_risk:section(floodText,canonical.flood.reasonCode?reason(canonical.flood.reasonCode):c.binding,canonical.flood.status,canonical.flood.sourceName,canonical.flood.reasonCode?reason(canonical.flood.reasonCode):undefined),zoning_and_land_use:section(c.planningSummary(planningInstrument),reason(canonical.planning.reasonCode),canonical.planning.status,planningSource,reason(canonical.planning.reasonCode)),building_regulations:section(reason('AUTHORITATIVE_DATA_REQUIRED'),c.planningDetail(planningInstrument),canonical.planning.status,planningAuthority,reason(canonical.planning.reasonCode)),environmental_factors:section(environmentText,canonical.environment.reasonCode?reason(canonical.environment.reasonCode):c.binding,canonical.environment.status,canonical.environment.sourceName,canonical.environment.reasonCode?reason(canonical.environment.reasonCode):undefined),infrastructure_and_access:section(roadText,canonical.infrastructure.reasonCode?reason(canonical.infrastructure.reasonCode):c.binding,canonical.infrastructure.status,canonical.infrastructure.sourceName,canonical.infrastructure.reasonCode?reason(canonical.infrastructure.reasonCode):undefined),market_and_comparables:section(valuationText,canonical.valuation.reasonCode?reason(canonical.valuation.reasonCode):c.landOnly,canonical.valuation.status,canonical.valuation.sourceName,canonical.valuation.reasonCode?reason(canonical.valuation.reasonCode):undefined),development_cost_outlook:section(reason('AUTHORITATIVE_DATA_REQUIRED'),checklist.map(item=>item.reason).join(' '),'REQUIRES_VERIFICATION')},
    evidenceRegistry,verificationChecklist:checklist,utilitiesChecklist,dataSources,
    legalDisclaimers:[...(canonical.support.maturity==='LIMITED'?[c.supportNotice]:[]),c.preliminaryDisclaimer,c.landOnly,c.noAbsenceDisclaimer,c.modelDisclaimer,c.planningDisclaimer,c.sourceDisclaimer],
    valuationMethodology:`${valuationText} ${c.landOnly}`,
    technicalNarrative:{groundwater_depth_m:c.unavailable,groundwater_notice:canonical.support.capabilities.nationalHydrogeology?reason('AUTHORITATIVE_DATA_REQUIRED'):reason('NOT_SUPPORTED_FOR_COUNTRY'),zoning_name:canonical.planning.instrumentName,max_far:c.unavailable,max_building_coverage_pct:c.unavailable,min_biologically_active_pct:c.unavailable,max_height_m:c.unavailable,utility_status:reason('AUTHORITATIVE_DATA_REQUIRED')},
    riskMatrix:[
      {category:c.riskNames.landslide,level:localRisk(canonical.hazards.landslide.classification),evidence_level:canonical.hazards.landslide.status,detail:localRisk(canonical.hazards.landslide.classification)},
      {category:c.riskNames.seismic,level:level(canonical.hazards.seismic.classification)||c.unavailable,evidence_level:canonical.hazards.seismic.status,detail:level(canonical.hazards.seismic.pga)||c.unavailable},
      {category:c.riskNames.radon,level:level(canonical.hazards.radon.classification)||c.unavailable,evidence_level:canonical.hazards.radon.status,detail:level(canonical.hazards.radon.classification)||reason(canonical.hazards.radon.reasonCode)},
      {category:c.riskNames.mining,level:level(canonical.hazards.mining.classification)||c.unavailable,evidence_level:canonical.hazards.mining.status,detail:level(canonical.hazards.mining.classification)||reason(canonical.hazards.mining.reasonCode)}
    ],
    keyRisks:checklist.slice(0,3).map(item=>item.reason),opportunities:c.opportunities
  };
}
