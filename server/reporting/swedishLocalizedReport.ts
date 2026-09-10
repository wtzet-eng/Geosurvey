import { AvailabilityReason, CanonicalReport, RiskClassification } from './canonicalReport';

const reasonCopy: Record<AvailabilityReason, string> = {
  NO_DATA: 'Källan hämtades utan tekniskt fel men returnerade ingen registrerad träff för platsen. Det är inte bevis för att förhållandet saknas.',
  SOURCE_UNAVAILABLE: 'Källan var tillfälligt otillgänglig eller kunde inte nås. Uppgiften behöver verifieras.',
  MALFORMED_DATA: 'Källan svarade men datastrukturen kunde inte valideras säkert. Ingen uppgift har härletts.',
  PARAMETER_NOT_PROVIDED: 'Den här parametern tillhandahålls inte av den använda datakällan.',
  INSUFFICIENT_EVIDENCE: 'Tillgängligt underlag är inte tillräckligt för att härleda värdet på ett tillförlitligt sätt.',
  NOT_SUPPORTED_FOR_COUNTRY: 'Den här nationella datakällan är ännu inte automatiserad för valt land. Kontrollera relevant officiell tjänst.',
  AUTHORITATIVE_DATA_REQUIRED: 'Uppgiften måste bekräftas i en auktoritativ källa eller av ansvarig myndighet.'
};

const riskLabel: Record<Exclude<RiskClassification, null>, string> = {
  NEGLIGIBLE: 'Försumbar', LOW: 'Låg', MODERATE: 'Måttlig', HIGH: 'Hög'
};
const statusLabel = { VERIFIED: 'Verifierad', MODELLED: 'Modellerad', REQUIRES_VERIFICATION: 'Behöver verifieras' } as const;
const confidenceLabel = { High: 'Hög', Medium: 'Medel', Low: 'Låg' } as const;
const utilityNames = { ELECTRICITY: 'El', WATER: 'Vatten', SEWER: 'Avlopp', GAS: 'Gas', TELECOM: 'Telekommunikation', OTHER: 'Teknisk försörjning' } as const;
const textureLabels: Record<string, string> = {
  sand: 'sand', 'loamy sand': 'lerig sand', 'sandy loam': 'sandig lättlera', loam: 'lerjord', 'silt loam': 'siltig lerjord', silt: 'silt',
  'sandy clay loam': 'sandig mellanlera', 'clay loam': 'mellanlera', 'silty clay loam': 'siltig mellanlera', 'sandy clay': 'sandig styv lera', 'silty clay': 'siltig styv lera', clay: 'lera'
};
const materialLabels: Record<string, string> = {
  ALLUVIAL: 'sväm- eller vattendragssediment', ORGANIC_OR_PEAT: 'organiskt material / torv', MADE_GROUND: 'fyllning', GLACIOFLUVIAL: 'isälvssediment',
  TILL: 'morän', COHESIVE: 'kohesivt material', GRANULAR: 'friktionsmaterial', OTHER: 'annat kartlagt material'
};

const reason = (code?: AvailabilityReason) => reasonCopy[code || 'AUTHORITATIVE_DATA_REQUIRED'];
const shown = (value: unknown, fallback = 'inte tillgängligt') => value === null || value === undefined || value === '' ? fallback : String(value);
const texture = (value: string | null) => value ? textureLabels[value.toLowerCase()] || value : null;
const risk = (value: RiskClassification) => value ? riskLabel[value] : 'inte tillgängligt';
const str = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
const num = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

function localizedClassification(value: string | null): string {
  if (!value) return 'inte tillgängligt';
  return value.replace(/Low to Very Low/gi, 'låg till mycket låg').replace(/Moderate/gi, 'måttlig').replace(/High/gi, 'hög').replace(/Low/gi, 'låg');
}

function supportNotice(canonical: CanonicalReport): string {
  if (canonical.countryCode === 'SE') {
    return 'För Sverige använder GeoSurvey utvalda nationella SGU-källor för jordarter, berggrund, Brunnsarkivet och nätet för observerade grundvattennivåer. Fastighetsindelning hos Lantmäteriet, bindande detaljplaner, MSB:s översvämningsunderlag och tomtmarknadsvärde måste fortfarande kontrolleras i respektive officiell tjänst.';
  }
  return canonical.support.maturity === 'SUPPORTED'
    ? 'Nationella källintegrationer finns för utvalda delar. Övriga kategorier kräver fortsatt officiell kontroll.'
    : 'Begränsad täckning: endast utvalda nationella källor är automatiserade. Övriga kategorier kräver kontroll hos ansvarig myndighet.';
}

function swedenGroundNarrative(canonical: CanonicalReport): string[] {
  const parts: string[] = [];
  const surface = canonical.evidenceRecords.find(record => record.id === 'se-sgu-surface-geology' && record.status === 'VERIFIED');
  const bedrock = canonical.evidenceRecords.find(record => record.id === 'se-sgu-bedrock' && record.status === 'VERIFIED');
  const wells = canonical.evidenceRecords.find(record => record.id === 'se-sgu-well-context' && record.status === 'VERIFIED');
  const groundwater = canonical.evidenceRecords.find(record => record.id === 'se-sgu-groundwater-stations' && record.status === 'VERIFIED');

  if (surface) {
    const v = (surface.value || {}) as Record<string, unknown>;
    parts.push(`SGU jordarter: ${str(v.deposit) || 'kartlagd jordart'}${str(v.scale) ? `; kartskala ${str(v.scale)}` : ''}.`);
  }
  if (bedrock) {
    const v = (bedrock.value || {}) as Record<string, unknown>;
    parts.push(`SGU berggrund: ${str(v.unit) || 'kartlagd geologisk enhet'}${str(v.rock) ? `; huvudsaklig bergart ${str(v.rock)}` : ''}${str(v.scale) ? `; rekommenderad presentationsskala ${str(v.scale)}` : ''}.`);
  }
  if (wells) {
    const v = (wells.value || {}) as Record<string, unknown>;
    const count = num(v.count) ?? 0;
    const nearest = num(v.nearestDistanceM);
    parts.push(`SGU Brunnsarkivet: ${count} brunns-/borrhålsregistreringar returnerades i sökområdet${nearest !== null ? `; närmaste returnerade registrering ligger cirka ${Math.round(nearest)} m från platsen` : ''}.`);
  }
  if (groundwater) {
    const v = (groundwater.value || {}) as Record<string, unknown>;
    const count = num(v.count) ?? 0;
    const nearest = num(v.nearestDistanceM);
    parts.push(`SGU observerade grundvattennivåer: ${count} mätstationer returnerades i sökområdet${nearest !== null ? `; närmaste station ligger cirka ${Math.round(nearest)} m från platsen` : ''}.`);
  }
  if (parts.length) parts.push('Kartdata, brunnar och grundvattenstationer är screeningsunderlag. De bevisar inte jordlagerföljd, bergdjup, grundvattennivå, hållfasthet, sättningar eller grundläggningsförhållanden under hela tomten och ersätter inte en platsspecifik geoteknisk undersökning.');
  return parts;
}

function localizedEvidenceRecord(record: any): any {
  const code = (record.value as { reasonCode?: AvailabilityReason } | null)?.reasonCode;
  const names: Record<string, string> = {
    'se-sgu-surface-geology': 'SGU – jordarter',
    'se-sgu-bedrock': 'SGU – berggrund',
    'se-sgu-well-context': 'SGU Brunnsarkivet – brunnar och borrhål',
    'se-sgu-groundwater-stations': 'SGU – observerade grundvattenstationer'
  };
  const isSwedish = Boolean(names[record.id]);
  return {
    ...record,
    category: names[record.id] || (record.id.startsWith('country-support-') ? 'Landstäckning' : record.category || 'Underlag'),
    claim: isSwedish ? `${names[record.id]} ingår som platsanknutet screeningsunderlag.` : record.id.startsWith('country-support-') ? reason('NOT_SUPPORTED_FOR_COUNTRY') : record.claim,
    spatialRelationship: isSwedish ? 'Rumslig relation till vald plats eller angivet sökområde finns registrerad i källposten.' : record.spatialRelationship,
    calculationMethod: isSwedish ? 'Källspecifik SGU-hämtning och normalisering till GeoSurveys evidensmodell.' : record.calculationMethod,
    confidence: confidenceLabel[record.confidence as keyof typeof confidenceLabel] || record.confidence,
    limitation: record.status === 'REQUIRES_VERIFICATION' ? reason(code) : record.limitation || 'Bindande eller projekteringsinriktade slutsatser måste bekräftas i auktoritativ källa eller genom platsspecifik undersökning.'
  };
}

export function renderSwedishLocalizedReport(canonical: CanonicalReport): any {
  const unavailable = 'inte tillgängligt';
  const support = supportNotice(canonical);
  const geologyUnit = canonical.geology.unitName || unavailable;
  const terrainText = canonical.terrain.elevationM === null ? 'Terrängdata är inte tillgängliga.' : `Modellerad terräng: höjd ${canonical.terrain.elevationM} m och lutning ${shown(canonical.terrain.slopeDegrees)}°.`;
  const soilTexture = texture(canonical.soil.texture);
  const soilText = `Jordmodell: textur ${soilTexture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}; bärförmåga: ${canonical.soil.bearingCapacity || reason('INSUFFICIENT_EVIDENCE')}.`;
  const geologyText = canonical.geology.unitName ? `SGU:s kartunderlag beskriver berggrundens geologiska enhet vid platsen som ${canonical.geology.unitName}.` : 'Kartlagd geologisk enhet är inte tillgänglig i de integrerade källorna för den här platsen.';
  const groundSpecific = swedenGroundNarrative(canonical);

  const mapped: any = canonical.groundContext?.mapped || null;
  const soilVariability: any = canonical.groundContext?.soilVariability || null;
  const variabilityCode = mapped?.variabilityClass || (soilVariability?.validSampleCount >= 2 ? (soilVariability.variationObserved ? 'MODERATE' : 'LOW') : 'INSUFFICIENT_EVIDENCE');
  const variabilityLabels: Record<string, string> = { LOW: 'Låg', MODERATE: 'Måttlig', HIGH: 'Hög', INSUFFICIENT_EVIDENCE: 'Otillräckligt underlag' };
  const contextSummary = mapped?.sampleCount ? (mapped.transitionIndicated ? 'Kartproverna antyder en övergång mellan olika geologiska eller genetiska enheter i området.' : 'Tillgängliga kartprover är relativt samstämmiga i området; det bekräftar ändå inte förhållandena under hela tomten.') : 'Det finns inte tillräckligt många kartprover för att säkert bedöma markens rumsliga variation.';
  const investigationFocus = mapped?.transitionIndicated ? 'Kontrollera den kartlagda övergången samt verkliga material, lagertjocklekar och vattenförhållanden genom fältundersökning.' : 'Kontrollera materialtyp, lagerföljd, bergdjup och vattenförhållanden med platsspecifik geoteknisk undersökning före tekniska beslut.';
  const groundContext = {
    title: 'Rumslig markkontext', evidence_level: canonical.groundContext?.status || 'REQUIRES_VERIFICATION', variability_code: variabilityCode, variability_label: variabilityLabels[variabilityCode] || variabilityCode,
    summary: contextSummary, mapped_units_label: 'Kartlagda enheter', mapped_units: mapped?.distinctMappedUnits || [], material_indicators_label: 'Indikatorer för kartlagt material', material_indicators: (mapped?.materialIndicators || []).map((item: string) => materialLabels[item] || item), transition_indicated: Boolean(mapped?.transitionIndicated),
    sample_label: 'Kartprover', sample_count: mapped?.sampleCount || 0, site_sample_count: mapped?.siteSampleCount || 0, parcel_sample_count: mapped?.parcelSampleCount || 0, vicinity_sample_count: mapped?.vicinitySampleCount || 0,
    soil_model_summary: soilVariability?.validSampleCount ? (soilVariability.variationObserved ? 'Jordmodellen antyder rumslig variation i textur.' : 'Jordmodellen är relativt samstämmig i de tillgängliga proverna.') : 'Det finns inte tillräckligt med jordmodellprover för att bedöma variation.', soil_model_sample_count: soilVariability?.validSampleCount || 0,
    soil_sand_range: soilVariability?.topsoilSandPctRange || null, soil_silt_range: soilVariability?.topsoilSiltPctRange || null, soil_clay_range: soilVariability?.topsoilClayPctRange || null,
    investigation_focus: investigationFocus,
    limitation: 'Kart- och modelldata lämpar sig endast för inledande screening. Omgivande data bekräftar inte lagerföljd, lagertjocklekar, vattenförhållanden eller tekniska parametrar under tomten.',
    source_name: mapped?.sourceName || soilVariability?.sourceName || 'SGU / SoilGrids', source_scale: mapped?.sourceScale || soilVariability?.sourceResolution || null,
    terrain_min_elevation_m: canonical.terrain.minElevationM ?? null, terrain_max_elevation_m: canonical.terrain.maxElevationM ?? null, terrain_local_relief_m: canonical.terrain.localReliefM ?? null
  };

  const valuationAvailable = canonical.valuation.min !== null && canonical.valuation.max !== null;
  const valuationText = valuationAvailable ? `Indikativ statistisk tomtmarknadsvärde: ${canonical.valuation.min!.toLocaleString('sv-SE')}–${canonical.valuation.max!.toLocaleString('sv-SE')} ${canonical.valuation.currency}.` : 'Automatiskt tomtmarknadsvärde visas inte eftersom GeoSurvey ännu saknar en tillräckligt dokumenterad svensk källa som isolerar själva markvärdet från byggnader och andra förbättringar.';
  const floodText = canonical.flood.classification ? `Inledande klassificering av översvämningsrisk: ${risk(canonical.flood.classification)}.` : 'MSB:s översvämningskartering är inte automatiserad i denna version. Kontrollera Översvämningsportalen och kommunens riskunderlag för platsen.';
  const roadText = `Närmaste kartlagda väg: ${shown(canonical.infrastructure.roadName || canonical.infrastructure.roadType)}, cirka ${shown(canonical.infrastructure.distanceM)} m från platsen.`;
  const environmentText = canonical.environment.protectedAreaName ? `Miljöscreeningen identifierade ${canonical.environment.protectedAreaName}.` : 'Ingen skyddsområdespost returnerades i den öppna miljöscreeningen för sökområdet.';

  const checklist = [
    ['Detaljplan och byggrätt', 'Kontrollera gällande detaljplan, planbestämmelser, eventuella områdesbestämmelser och bygglovsförutsättningar hos kommunen.', canonical.planning.authorityName],
    ['Geoteknisk undersökning', 'Beställ platsspecifik geoteknisk undersökning enligt tillämpliga svenska regler och Eurokod 7; använd SGU-data som bakgrund, inte som ersättning.', canonical.authorities.geology],
    ['Översvämning, ras och skred', 'Kontrollera MSB:s översvämningsunderlag och relevanta SGU/SGI-kommunala riskkartor; beställ detaljutredning där screening eller planförutsättningar kräver det.', canonical.authorities.flood],
    ['Fastighetsgräns och rättigheter', 'Kontrollera fastighetsindelning, lagfart, servitut och andra rättigheter via Lantmäteriet. Kartgränser ska inte behandlas som juridiskt avgjorda utan rätt underlag.', canonical.authorities.cadastre],
    ['Teknisk försörjning', 'Inhämta formella anslutningsvillkor från berörda nätägare och kommunen.', canonical.authorities.cadastre]
  ].map(([topic, itemReason, authority], index) => ({ topic, reason: itemReason, recommendedAuthorityOrExpert: authority, priority: index < 4 ? 'High' : 'Medium' }));

  const utilitiesChecklist = (canonical.utilities || []).map(item => ({
    utility: utilityNames[item.utilityCode],
    status: item.mapped ? (item.distanceM === null ? 'Tjänsten är kartlagd i den öppna datakällan.' : `Tjänsten är kartlagd cirka ${item.distanceM} m från platsen. Anslutning måste bekräftas av nätägaren.`) : reason(item.reasonCode),
    evidence_level: item.status, provider_type: item.sourceName, distance_m: item.distanceM ?? undefined, mapped_in_dataset: item.mapped,
    limitation: item.mapped ? reason('AUTHORITATIVE_DATA_REQUIRED') : reason(item.reasonCode)
  }));

  const dataSources = canonical.sourceRecords.map(source => ({ name: source.name, url: source.url, authority: source.name, verification_status: statusLabel[source.status] }));
  const evidenceRegistry = canonical.evidenceRecords.map(localizedEvidenceRecord);
  const summaryCore = valuationAvailable
    ? `Denna evidensbaserade bedömning gäller en tomt i Sverige. Kartlagd markkontext: ${geologyUnit}. ${terrainText} Jord: ${soilTexture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}. Evidenspoäng: ${canonical.evidenceScore.totalScore}/100. Indikativt tomtmarknadsvärde är ${canonical.valuation.min!.toLocaleString('sv-SE')}–${canonical.valuation.max!.toLocaleString('sv-SE')} ${canonical.valuation.currency}.`
    : `Denna evidensbaserade bedömning gäller en tomt i Sverige. Kartlagd markkontext: ${geologyUnit}. ${terrainText} Jord: ${soilTexture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}. Evidenspoäng: ${canonical.evidenceScore.totalScore}/100. Automatiskt tomtmarknadsvärde visas inte eftersom tillräckligt svensk markvärdesunderlag saknas.`;
  const section = (summary: string, detail: string, status: string, source?: string, limitation?: string) => ({ summary, detail, evidence_level: status, source_cited: source, limitation_notice: limitation });
  const groundDetail = [`${contextSummary} ${investigationFocus}`, ...groundSpecific].join(' ');

  return {
    language: 'sv',
    countrySupport: { maturity: canonical.support.maturity, label: 'Begränsad men nationellt integrerad täckning', notice: support, capabilities: canonical.support.capabilities },
    groundContext,
    summary: `${summaryCore} ${support}`,
    titles: { estimated_value: 'Indikativt tomtmarknadsvärde', confidence: 'Underlagets kvalitet', executive_summary: 'Sammanfattning' },
    confidenceLabel: canonical.evidenceScore.totalScore >= 75 ? 'Hög underlagskvalitet' : canonical.evidenceScore.totalScore >= 50 ? 'Medelhög underlagskvalitet' : 'Preliminär underlagskvalitet',
    unavailableReasons: {
      geology: reason(canonical.geology.reasonCode), soilTexture: reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED'), engineeringParameter: reason('INSUFFICIENT_EVIDENCE'), groundwater: reason('AUTHORITATIVE_DATA_REQUIRED'), planning: reason(canonical.planning.reasonCode), valuation: reason(canonical.valuation.reasonCode), sourceUnavailable: reason('SOURCE_UNAVAILABLE'), noFeature: reason('NO_DATA')
    },
    sections: {
      soil_and_ground: section(soilText, groundDetail, canonical.geology.status === 'VERIFIED' ? 'VERIFIED' : canonical.soil.status, canonical.geology.sourceName, 'SGU-kartor, närliggande brunnar och grundvattenstationer ersätter inte en geoteknisk undersökning på tomten.'),
      geohazard_risk: section(geologyText, 'Nationell geologisk screening är tillgänglig via SGU, men bindande eller projekteringsrelevant bedömning av ras, skred, erosion och stabilitet måste kontrolleras i relevanta SGU/SGI-, MSB- och kommunala underlag.', canonical.geology.status, canonical.geology.sourceName, reason('AUTHORITATIVE_DATA_REQUIRED')),
      flooding_risk: section(floodText, 'Kontrollera MSB:s Översvämningsportal, kommunens riskunderlag och gällande planeringsförutsättningar före mark- eller byggbeslut.', 'REQUIRES_VERIFICATION', canonical.authorities.flood, reason('AUTHORITATIVE_DATA_REQUIRED')),
      zoning_and_land_use: section(`Planstatus måste bekräftas enligt ${canonical.planning.instrumentName}.`, 'Kontrollera kommunens plankarta, planbestämmelser, detaljplanens genomförandestatus och eventuella andra bindande markanvändningskrav.', canonical.planning.status, canonical.planning.sourceName, reason(canonical.planning.reasonCode)),
      building_regulations: section('Fastighetsindelning och rättsliga fastighetsuppgifter hämtas inte automatiskt i denna version.', 'Kontrollera fastighetsbeteckning, gränser, lagfart, servitut och andra rättigheter hos Lantmäteriet. GeoSurvey behandlar inte en ritad användargräns som juridisk fastighetsgräns.', 'REQUIRES_VERIFICATION', canonical.authorities.cadastre, reason('AUTHORITATIVE_DATA_REQUIRED')),
      environmental_factors: section(environmentText, canonical.environment.reasonCode ? reason(canonical.environment.reasonCode) : reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.environment.status, canonical.environment.sourceName, canonical.environment.reasonCode ? reason(canonical.environment.reasonCode) : undefined),
      infrastructure_and_access: section(roadText, canonical.infrastructure.reasonCode ? reason(canonical.infrastructure.reasonCode) : reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.infrastructure.status, canonical.infrastructure.sourceName, canonical.infrastructure.reasonCode ? reason(canonical.infrastructure.reasonCode) : undefined),
      market_and_comparables: section(valuationText, 'Värderingsomfånget är strikt mark/tomt. Byggnader, konstruktioner och andra förbättringar är uttryckligen exkluderade.', canonical.valuation.status, canonical.valuation.sourceName, canonical.valuation.reasonCode ? reason(canonical.valuation.reasonCode) : undefined),
      development_cost_outlook: section(reason('AUTHORITATIVE_DATA_REQUIRED'), checklist.map(item => item.reason).join(' '), 'REQUIRES_VERIFICATION')
    },
    evidenceRegistry, verificationChecklist: checklist, utilitiesChecklist, dataSources,
    legalDisclaimers: [
      support,
      'Den automatiserade rapporten är endast en inledande screening och är inte ett myndighetsbeslut, juridisk rådgivning, geoteknisk undersökning eller värderingsutlåtande.',
      'SGU:s jordarts- och berggrundskartor beskriver kartlagda förhållanden och ersätter inte platsspecifik geoteknisk undersökning.',
      'Brunnar och grundvattenstationer i närheten beskriver sina egna observationspunkter och bevisar inte grundvattennivå eller jordlager under den valda tomten.',
      'Fastighetsindelning, rättigheter, MSB:s översvämningsunderlag och bindande kommunala planförhållanden måste kontrolleras i officiella tjänster.',
      'Ett eventuellt indikativt värde gäller endast själva marken/tomten. Byggnader, konstruktioner och andra förbättringar är uttryckligen exkluderade.',
      'Automatiskt tomtmarknadsvärde visas inte förrän en tillräckligt dokumenterad svensk land-only-källa har integrerats.'
    ],
    valuationMethodology: valuationText,
    technicalNarrative: { groundwater_depth_m: unavailable, groundwater_notice: 'Närliggande SGU-stationer eller brunnar får inte tolkas som tomtens grundvattennivå.', zoning_name: canonical.planning.instrumentName, max_far: unavailable, max_building_coverage_pct: unavailable, min_biologically_active_pct: unavailable, max_height_m: unavailable, utility_status: reason('AUTHORITATIVE_DATA_REQUIRED') },
    riskMatrix: [
      { category: 'Ras och skred', level: canonical.hazards.landslide.classification ? risk(canonical.hazards.landslide.classification) : unavailable, evidence_level: canonical.hazards.landslide.status, detail: canonical.hazards.landslide.classification ? `Allmän terrängscreening: ${risk(canonical.hazards.landslide.classification)}. Kontrollera relevanta svenska riskkartor separat.` : 'Nationell ras- och skredrisk är inte automatiserad i denna version.' },
      { category: 'Seismisk risk', level: localizedClassification(canonical.hazards.seismic.classification), evidence_level: canonical.hazards.seismic.status, detail: `Seismiskt screeningvärde: ${localizedClassification(canonical.hazards.seismic.pga)}.` },
      { category: 'Radon', level: localizedClassification(canonical.hazards.radon.classification), evidence_level: canonical.hazards.radon.status, detail: canonical.hazards.radon.classification ? `Områdesscreening: ${localizedClassification(canonical.hazards.radon.classification)}.` : reason(canonical.hazards.radon.reasonCode) },
      { category: 'Gruv- och bergbruksförhållanden', level: localizedClassification(canonical.hazards.mining.classification), evidence_level: canonical.hazards.mining.status, detail: canonical.hazards.mining.classification ? `Screening av gruvförhållanden: ${localizedClassification(canonical.hazards.mining.classification)}.` : reason(canonical.hazards.mining.reasonCode) }
    ],
    keyRisks: checklist.slice(0, 4).map(item => item.reason),
    opportunities: ['SGU erbjuder mycket starka öppna nationella källor för inledande mark- och grundscreening.', 'Brunnsarkivet och nätet för observerade grundvattennivåer gör det möjligt att hitta relevant omgivande underlag utan att behandla det som mätningar på själva tomten.']
  };
}
