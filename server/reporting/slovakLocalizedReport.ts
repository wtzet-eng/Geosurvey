import { AvailabilityReason, CanonicalReport, RiskClassification } from './canonicalReport';

const reasonCopy: Record<AvailabilityReason, string> = {
  NO_DATA: 'Zdroj bol úspešne dopytovaný, ale pre túto lokalitu nevrátil žiadny prvok. Nie je to dôkaz neprítomnosti javu.',
  SOURCE_UNAVAILABLE: 'Zdroj bol dočasne nedostupný alebo sa k nemu nepodarilo pripojiť. Vyžaduje sa overenie.',
  MALFORMED_DATA: 'Zdroj odpovedal, ale štruktúru údajov nebolo možné bezpečne overiť. Nebola odvodená žiadna hodnota.',
  PARAMETER_NOT_PROVIDED: 'Použitý súbor údajov tento parameter neposkytuje.',
  INSUFFICIENT_EVIDENCE: 'Dostupné dôkazy nepostačujú na bezpečné odvodenie tejto hodnoty.',
  NOT_SUPPORTED_FOR_COUNTRY: 'Táto automatizovaná národná integrácia nie je pre vybranú krajinu podporovaná. Údaj treba overiť u príslušného orgánu.',
  AUTHORITATIVE_DATA_REQUIRED: 'Informácia vyžaduje potvrdenie v autoritatívnom dokumente alebo príslušným orgánom.'
};

const riskLabel: Record<Exclude<RiskClassification, null>, string> = {
  NEGLIGIBLE: 'Zanedbateľné',
  LOW: 'Nízke',
  MODERATE: 'Stredné',
  HIGH: 'Vysoké'
};

const statusLabel = {
  VERIFIED: 'Overené',
  MODELLED: 'Modelované',
  REQUIRES_VERIFICATION: 'Vyžaduje overenie'
} as const;

const confidenceLabel = { High: 'Vysoká', Medium: 'Stredná', Low: 'Nízka' } as const;

const textureLabels: Record<string, string> = {
  sand: 'piesok',
  'loamy sand': 'hlinitý piesok',
  'sandy loam': 'piesčitá hlina',
  loam: 'hlina',
  'silt loam': 'prachovitá hlina',
  silt: 'prach',
  'sandy clay loam': 'piesčitá ílovitá hlina',
  'clay loam': 'ílovitá hlina',
  'silty clay loam': 'prachovitá ílovitá hlina',
  'sandy clay': 'piesčitý íl',
  'silty clay': 'prachovitý íl',
  clay: 'íl'
};

const materialLabels: Record<string, string> = {
  ALLUVIAL: 'aluviálne sedimenty',
  ORGANIC_OR_PEAT: 'organické / rašelinové sedimenty',
  MADE_GROUND: 'navážky',
  GLACIOFLUVIAL: 'fluvioglaciálne sedimenty',
  TILL: 'ľadovcová moréna / till',
  COHESIVE: 'súdržný materiál',
  GRANULAR: 'zrnitý materiál',
  OTHER: 'iný mapovaný materiál'
};

const utilityNames = {
  ELECTRICITY: 'Elektrina',
  WATER: 'Pitná voda',
  SEWER: 'Splašková kanalizácia',
  GAS: 'Zemný plyn',
  TELECOM: 'Telekomunikácie',
  OTHER: 'Inžinierska sieť'
} as const;

const reason = (code?: AvailabilityReason) => reasonCopy[code || 'AUTHORITATIVE_DATA_REQUIRED'];
const shown = (value: unknown, fallback = 'údaj nie je k dispozícii') => value === null || value === undefined || value === '' ? fallback : String(value);
const texture = (value: string | null) => value ? textureLabels[value.toLowerCase()] || value : null;
const risk = (value: RiskClassification) => value ? riskLabel[value] : 'údaj nie je k dispozícii';

function localizedClassification(value: string | null): string {
  if (!value) return 'údaj nie je k dispozícii';
  return value
    .replace(/Low to Very Low/gi, 'nízke až veľmi nízke')
    .replace(/Moderate/gi, 'stredné')
    .replace(/High/gi, 'vysoké')
    .replace(/Low/gi, 'nízke');
}

function slovakiaGroundNarrative(canonical: CanonicalReport): string[] {
  const parts: string[] = [];
  const engineering = canonical.evidenceRecords.find(record => record.id === 'sk-sguds-engineering-geology-50k' && record.status === 'VERIFIED');
  const hydro = canonical.evidenceRecords.find(record => record.id === 'sk-sguds-hydrogeology' && record.status === 'VERIFIED');
  const boreholes = canonical.evidenceRecords.find(record => record.id === 'sk-sguds-borehole-context' && record.status === 'VERIFIED');

  if (engineering) {
    const raw = (engineering.value || {}) as Record<string, unknown>;
    const zone = typeof raw.zone === 'string' ? raw.zone : 'mapovaný rajón';
    const formation = typeof raw.formation === 'string' && raw.formation !== zone ? ` (${raw.formation})` : '';
    parts.push(`ŠGÚDŠ — inžinierskogeologické rajónovanie v lokalite: ${zone}${formation}.`);
  }
  if (hydro) {
    const raw = (hydro.value || {}) as Record<string, unknown>;
    const values = [raw.lithology, raw.permeability, raw.hydrogeologicalFunction].filter(item => typeof item === 'string' && item).join('; ');
    parts.push(`ŠGÚDŠ — hydrogeologický kontext: ${values || 'vrátený mapovaný kontext kolektora'}.`);
  }
  if (boreholes) {
    const raw = (boreholes.value || {}) as Record<string, unknown>;
    const engineeringRows = Array.isArray(raw.engineeringBoreholes) ? raw.engineeringBoreholes as Array<Record<string, unknown>> : [];
    const hydroRows = Array.isArray(raw.hydrogeologicalBoreholes) ? raw.hydrogeologicalBoreholes as Array<Record<string, unknown>> : [];
    const distances = [...engineeringRows, ...hydroRows].map(row => typeof row.distanceM === 'number' ? row.distanceM : null).filter((d): d is number => d !== null).sort((a, b) => a - b);
    const radius = typeof raw.searchRadiusM === 'number' ? raw.searchRadiusM : null;
    parts.push(`Register vrtov ŠGÚDŠ: ${engineeringRows.length} inžinierskych/viacúčelových a ${hydroRows.length} hydrogeologických záznamov${radius ? ` v okruhu ${(radius / 1000).toFixed(0)} km` : ''}${distances.length ? `; najbližší záznam približne ${distances[0]} m od lokality` : ''}.`);
  }
  if (parts.length) parts.push('Národné mapové údaje a okolité vrty sú iba podkladom na predbežné posúdenie. Nepotvrdzujú stratigrafiu pod parcelou, stav alebo konzistenciu zemín, hladinu podzemnej vody, únosnosť, pevnostné parametre ani návrh založenia.');
  return parts;
}

function supportNotice(canonical: CanonicalReport): string {
  if (canonical.support.maturity !== 'LIMITED') return 'Pre vybrané oblasti sú dostupné národné zdrojové integrácie; nepodporované kategórie naďalej vyžadujú úradné overenie.';
  return 'Obmedzené pokrytie: pre Slovensko sú automatizované vybrané národné geologické, vrtné, hydrogeologické a oceňovacie zdroje. Kataster, záväzné územné plánovanie, povodňové mapy, radón a banské vplyvy naďalej vyžadujú overenie v príslušných oficiálnych zdrojoch.';
}

export function renderSlovakLocalizedReport(canonical: CanonicalReport): any {
  const unavailable = 'údaj nie je k dispozícii';
  const support = supportNotice(canonical);
  const geologyUnit = canonical.geology.unitName || unavailable;
  const terrainText = canonical.terrain.elevationM === null
    ? 'Údaje o teréne nie sú k dispozícii.'
    : `Modelovaný terén: nadmorská výška ${canonical.terrain.elevationM} m a sklon ${shown(canonical.terrain.slopeDegrees)}°.`;
  const soilTexture = texture(canonical.soil.texture);
  const soilText = `Model pôdy: textúra ${soilTexture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}; únosnosť: ${canonical.soil.bearingCapacity || reason('INSUFFICIENT_EVIDENCE')}.`;
  const geologyText = canonical.geology.unitName
    ? `Podľa zdroja ${canonical.geology.sourceName} sa lokalita nachádza v geologickej jednotke ${canonical.geology.unitName}.`
    : 'Geologická jednotka nie je v posudzovaných zdrojoch k dispozícii.';
  const groundSpecific = slovakiaGroundNarrative(canonical);

  const mapped: any = canonical.groundContext?.mapped || null;
  const soilVariability: any = canonical.groundContext?.soilVariability || null;
  const variabilityCode = mapped?.variabilityClass || (soilVariability?.validSampleCount >= 2 ? (soilVariability.variationObserved ? 'MODERATE' : 'LOW') : 'INSUFFICIENT_EVIDENCE');
  const variabilityLabels: Record<string, string> = { LOW: 'Nízka', MODERATE: 'Stredná', HIGH: 'Vysoká', INSUFFICIENT_EVIDENCE: 'Nedostatok dôkazov' };
  const contextSummary = mapped?.sampleCount
    ? mapped.transitionIndicated
      ? 'Mapované vzorky naznačujú prechod medzi rozdielnymi geologickými alebo litogenetickými jednotkami v okolí lokality.'
      : 'Dostupné mapované vzorky sú v analyzovanom okolí prevažne konzistentné; nejde však o potvrdenie podmienok pod celou parcelou.'
    : 'Na spoľahlivé posúdenie priestorovej premenlivosti podložia nie je dostatok mapovaných vzoriek.';
  const investigationFocus = mapped?.transitionIndicated
    ? 'Pri terénnom prieskume overiť mapovaný prechod a skutočné materiály pod lokalitou vrátane zmien hrúbky a stavu.'
    : 'Pred inžinierskymi rozhodnutiami overiť materiál, genézu, stav a vodné pomery prieskumom konkrétnej lokality.';
  const groundContext = {
    title: 'Priestorový kontext podložia',
    evidence_level: canonical.groundContext?.status || 'REQUIRES_VERIFICATION',
    variability_code: variabilityCode,
    variability_label: variabilityLabels[variabilityCode] || variabilityCode,
    summary: contextSummary,
    mapped_units_label: 'Mapované jednotky',
    mapped_units: mapped?.distinctMappedUnits || [],
    material_indicators_label: 'Indikátory mapovaného materiálu',
    material_indicators: (mapped?.materialIndicators || []).map((item: string) => materialLabels[item] || item),
    transition_indicated: Boolean(mapped?.transitionIndicated),
    sample_label: 'Mapované vzorky',
    sample_count: mapped?.sampleCount || 0,
    site_sample_count: mapped?.siteSampleCount || 0,
    parcel_sample_count: mapped?.parcelSampleCount || 0,
    vicinity_sample_count: mapped?.vicinitySampleCount || 0,
    soil_model_summary: soilVariability?.validSampleCount ? (soilVariability.variationObserved ? 'Model pôdy naznačuje priestorovú premenlivosť textúry.' : 'Model pôdy je v dostupných vzorkách relatívne konzistentný.') : 'Modelové vzorky pôdy nie sú dostatočné na posúdenie premenlivosti.',
    soil_model_sample_count: soilVariability?.validSampleCount || 0,
    soil_sand_range: soilVariability?.topsoilSandPctRange || null,
    soil_silt_range: soilVariability?.topsoilSiltPctRange || null,
    soil_clay_range: soilVariability?.topsoilClayPctRange || null,
    investigation_focus: investigationFocus,
    limitation: 'Mapový a modelový kontext slúži iba na predbežné posúdenie. Údaje z okolia nepotvrdzujú profil, hrúbku vrstiev, vodné pomery, stav ani inžinierske parametre pod parcelou.',
    source_name: mapped?.sourceName || soilVariability?.sourceName || null,
    source_scale: mapped?.sourceScale || soilVariability?.sourceResolution || null,
    terrain_min_elevation_m: canonical.terrain.minElevationM ?? null,
    terrain_max_elevation_m: canonical.terrain.maxElevationM ?? null,
    terrain_local_relief_m: canonical.terrain.localReliefM ?? null
  };

  const valuationAvailable = canonical.valuation.min !== null && canonical.valuation.max !== null;
  const valuationText = valuationAvailable
    ? `Orientačná štatistická hodnota pozemku: ${canonical.valuation.min!.toLocaleString('sk-SK')}–${canonical.valuation.max!.toLocaleString('sk-SK')} ${canonical.valuation.currency}.`
    : reason(canonical.valuation.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED');
  const floodText = canonical.flood.classification ? `Klasifikácia predbežného povodňového rizika: ${risk(canonical.flood.classification)}.` : reason(canonical.flood.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED');
  const roadText = `Najbližšia mapovaná cesta: ${shown(canonical.infrastructure.roadName || canonical.infrastructure.roadType)}, približne ${shown(canonical.infrastructure.distanceM)} m od lokality.`;
  const environmentText = canonical.environment.protectedAreaName ? `Environmentálne preverenie identifikovalo ${canonical.environment.protectedAreaName}.` : 'V preverovanom území nebol v použitom otvorenom zdroji identifikovaný prvok chráneného územia.';

  const localizedCategory = 'Vedecké dôkazy';
  const supportCategory = 'Rozsah podpory krajiny';
  const evidenceRegistry = canonical.evidenceRecords.map(record => {
    const code = (record.value as { reasonCode?: AvailabilityReason } | null)?.reasonCode;
    const isSupport = record.id.startsWith('country-support-');
    return {
      ...record,
      category: isSupport ? supportCategory : localizedCategory,
      claim: isSupport ? reason('NOT_SUPPORTED_FOR_COUNTRY') : `Dôkazový záznam pre kategóriu ${localizedCategory}.`,
      spatialRelationship: isSupport ? support : 'Priestorový vzťah bol zaznamenaný pre vybranú lokalitu.',
      calculationMethod: isSupport ? 'Kontrola dostupnosti národnej integrácie' : 'Prevzatie zo zdroja a normalizácia do kanonického dôkazového modelu.',
      confidence: confidenceLabel[record.confidence] || record.confidence,
      limitation: record.status === 'REQUIRES_VERIFICATION' ? reason(code) : 'Záväzné alebo projektové závery musia byť potvrdené príslušným autoritatívnym zdrojom alebo terénnym prieskumom.'
    };
  });

  const checklist = [
    ['Úradné potvrdenie územného plánovania', 'Získať aktuálnu záväznú územnoplánovaciu informáciu alebo stanovisko.', canonical.planning.authorityName],
    ['Geotechnický prieskum', 'Objednať geotechnický prieskum lokality podľa Eurokódu 7.', canonical.authorities.geology],
    ['Geodetické zameranie', 'Objednať autorizované polohopisné a výškopisné zameranie.', canonical.authorities.cadastre],
    ['Podmienky pripojenia sietí', 'Získať formálne podmienky pripojenia od prevádzkovateľov sietí.', canonical.authorities.cadastre],
    ['Vlastníctvo a kataster', 'Overiť vlastníctvo, hranice, vecné bremená a ťarchy v katastri nehnuteľností.', canonical.authorities.cadastre]
  ].map(([topic, itemReason, authority], index) => ({ topic, reason: itemReason, recommendedAuthorityOrExpert: authority, priority: index === 3 ? 'Medium' : 'High' }));

  const utilitiesChecklist = (canonical.utilities || []).map(item => ({
    utility: utilityNames[item.utilityCode],
    status: item.mapped ? (item.distanceM === null ? 'Sieť je mapovaná v preverovanom otvorenom súbore údajov.' : `Sieť je mapovaná približne ${item.distanceM} m od lokality. Podmienky pripojenia musí potvrdiť prevádzkovateľ.`) : reason(item.reasonCode),
    evidence_level: item.status,
    provider_type: item.sourceName,
    distance_m: item.distanceM ?? undefined,
    mapped_in_dataset: item.mapped,
    limitation: item.mapped ? reason('AUTHORITATIVE_DATA_REQUIRED') : reason(item.reasonCode)
  }));

  const dataSources = canonical.sourceRecords.map(source => ({ name: source.name, url: source.url, authority: source.name, verification_status: statusLabel[source.status] }));
  const summaryCore = valuationAvailable
    ? `Toto posúdenie založené na dôkazoch sa týka lokality na Slovensku. Geologická jednotka: ${geologyUnit}. Terén: ${terrainText} Pôda: ${soilTexture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}. Skóre kvality dôkazov: ${canonical.evidenceScore.totalScore}/100. Štatistické rozpätie hodnoty pozemku je ${canonical.valuation.min!.toLocaleString('sk-SK')}–${canonical.valuation.max!.toLocaleString('sk-SK')} ${canonical.valuation.currency}.`
    : `Toto posúdenie založené na dôkazoch sa týka lokality na Slovensku. Geologická jednotka: ${geologyUnit}. Terén: ${terrainText} Pôda: ${soilTexture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}. Skóre kvality dôkazov: ${canonical.evidenceScore.totalScore}/100. Automatická hodnota pozemku sa neuvádza, pretože nie je k dispozícii dostatočný podporovaný oceňovací podklad.`;

  const groundDetail = [`Záväzné informácie vyžadujú potvrdenie príslušným orgánom. ${contextSummary} ${investigationFocus}`, ...groundSpecific].join(' ');
  const section = (summary: string, detail: string, status: string, source?: string, limitation?: string) => ({ summary, detail, evidence_level: status, source_cited: source, limitation_notice: limitation });

  return {
    language: 'sk',
    countrySupport: { maturity: canonical.support.maturity, label: canonical.support.maturity === 'SUPPORTED' ? 'Podporované' : 'Obmedzené pokrytie', notice: support, capabilities: canonical.support.capabilities },
    groundContext,
    summary: canonical.support.maturity === 'LIMITED' ? `${summaryCore} ${support}` : summaryCore,
    titles: { estimated_value: 'Orientačná štatistická hodnota pozemku', confidence: 'Kvalita dôkazov', executive_summary: 'Súhrnné hodnotenie' },
    confidenceLabel: canonical.evidenceScore.totalScore >= 75 ? 'Vysoká kvalita dôkazov' : canonical.evidenceScore.totalScore >= 50 ? 'Stredná kvalita dôkazov' : 'Predbežná kvalita dôkazov',
    unavailableReasons: {
      geology: reason(canonical.geology.reasonCode),
      soilTexture: reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED'),
      engineeringParameter: reason('INSUFFICIENT_EVIDENCE'),
      groundwater: reason(canonical.support.capabilities.nationalHydrogeology ? 'AUTHORITATIVE_DATA_REQUIRED' : 'NOT_SUPPORTED_FOR_COUNTRY'),
      planning: reason(canonical.planning.reasonCode),
      valuation: reason(canonical.valuation.reasonCode),
      sourceUnavailable: reason('SOURCE_UNAVAILABLE'),
      noFeature: reason('NO_DATA')
    },
    sections: {
      soil_and_ground: section(soilText, groundDetail, canonical.soil.status, canonical.soil.sourceName, canonical.soil.reasonCode ? reason(canonical.soil.reasonCode) : undefined),
      geohazard_risk: section(geologyText, `${geologyText} Mapované geologické a svahové údaje slúžia na skríning a nenahrádzajú prieskum konkrétnej parcely.`, canonical.geology.status, canonical.geology.sourceName, canonical.geology.reasonCode ? reason(canonical.geology.reasonCode) : undefined),
      flooding_risk: section(floodText, canonical.flood.reasonCode ? reason(canonical.flood.reasonCode) : reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.flood.status, canonical.flood.sourceName, canonical.flood.reasonCode ? reason(canonical.flood.reasonCode) : undefined),
      zoning_and_land_use: section(`Parametre územného plánovania treba potvrdiť podľa dokumentu ${canonical.planning.instrumentName}.`, reason(canonical.planning.reasonCode), canonical.planning.status, canonical.planning.sourceName, reason(canonical.planning.reasonCode)),
      building_regulations: section(reason('AUTHORITATIVE_DATA_REQUIRED'), `Regulačné podmienky treba potvrdiť podľa dokumentu ${canonical.planning.instrumentName}.`, canonical.planning.status, canonical.planning.authorityName, reason(canonical.planning.reasonCode)),
      environmental_factors: section(environmentText, canonical.environment.reasonCode ? reason(canonical.environment.reasonCode) : reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.environment.status, canonical.environment.sourceName, canonical.environment.reasonCode ? reason(canonical.environment.reasonCode) : undefined),
      infrastructure_and_access: section(roadText, canonical.infrastructure.reasonCode ? reason(canonical.infrastructure.reasonCode) : reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.infrastructure.status, canonical.infrastructure.sourceName, canonical.infrastructure.reasonCode ? reason(canonical.infrastructure.reasonCode) : undefined),
      market_and_comparables: section(valuationText, canonical.valuation.reasonCode ? reason(canonical.valuation.reasonCode) : 'Ide o orientačnú hodnotu samotného pozemku; budovy, stavby a iné zlepšenia nie sú zahrnuté.', canonical.valuation.status, canonical.valuation.sourceName, canonical.valuation.reasonCode ? reason(canonical.valuation.reasonCode) : undefined),
      development_cost_outlook: section(reason('AUTHORITATIVE_DATA_REQUIRED'), checklist.map(item => item.reason).join(' '), 'REQUIRES_VERIFICATION')
    },
    evidenceRegistry,
    verificationChecklist: checklist,
    utilitiesChecklist,
    dataSources,
    legalDisclaimers: [
      ...(canonical.support.maturity === 'LIMITED' ? [support] : []),
      'Tento automatizovaný report slúži iba na predbežné posúdenie a nie je úradným rozhodnutím ani odborným posudkom.',
      'Automatická hodnota sa uvádza iba vtedy, keď ju podporuje dostatočný národný zdrojový podklad.',
      'Modelované pôdne údaje nenahrádzajú geotechnický prieskum podľa Eurokódu 7.',
      'Záväzné práva na výstavbu a regulatívy vyžadujú úradné potvrdenie.',
      'Orientačná hodnota sa vzťahuje iba na pozemok a nezahŕňa budovy, stavby ani iné zlepšenia.',
      'Pred investičným rozhodnutím treba preveriť dostupnosť, aktuálnosť a obmedzenia všetkých použitých zdrojov.'
    ],
    valuationMethodology: valuationText,
    technicalNarrative: {
      groundwater_depth_m: unavailable,
      groundwater_notice: canonical.support.capabilities.nationalHydrogeology ? reason('AUTHORITATIVE_DATA_REQUIRED') : reason('NOT_SUPPORTED_FOR_COUNTRY'),
      zoning_name: canonical.planning.instrumentName,
      max_far: unavailable,
      max_building_coverage_pct: unavailable,
      min_biologically_active_pct: unavailable,
      max_height_m: unavailable,
      utility_status: reason('AUTHORITATIVE_DATA_REQUIRED')
    },
    riskMatrix: [
      { category: 'Zosuvy', level: canonical.hazards.landslide.classification ? risk(canonical.hazards.landslide.classification) : unavailable, evidence_level: canonical.hazards.landslide.status, detail: canonical.hazards.landslide.classification ? `Klasifikácia náchylnosti na zosuvy: ${risk(canonical.hazards.landslide.classification)}.` : reason('SOURCE_UNAVAILABLE') },
      { category: 'Seizmické riziko', level: localizedClassification(canonical.hazards.seismic.classification), evidence_level: canonical.hazards.seismic.status, detail: `Seizmická skríningová hodnota: ${localizedClassification(canonical.hazards.seismic.pga)}.` },
      { category: 'Radón', level: localizedClassification(canonical.hazards.radon.classification), evidence_level: canonical.hazards.radon.status, detail: canonical.hazards.radon.classification ? `Klasifikácia radónového skríningu: ${localizedClassification(canonical.hazards.radon.classification)}.` : reason(canonical.hazards.radon.reasonCode) },
      { category: 'Banské vplyvy', level: localizedClassification(canonical.hazards.mining.classification), evidence_level: canonical.hazards.mining.status, detail: canonical.hazards.mining.classification ? `Klasifikácia skríningu banských vplyvov: ${localizedClassification(canonical.hazards.mining.classification)}.` : reason(canonical.hazards.mining.reasonCode) }
    ],
    keyRisks: checklist.slice(0, 3).map(item => item.reason),
    opportunities: ['Kanonický model zachováva pôvod a stav každého dôkazu.', 'Terénne, pôdne a zdrojové údaje sú zobrazené v jednom spoločnom hodnotení.']
  };
}
