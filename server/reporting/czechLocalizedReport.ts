import { AvailabilityReason, CanonicalReport, RiskClassification } from './canonicalReport';

const reasonCopy: Record<AvailabilityReason, string> = {
  NO_DATA: 'Zdroj byl úspěšně dotázán, ale pro tuto lokalitu nevrátil žádný prvek. Nejde o důkaz, že daný jev neexistuje.',
  SOURCE_UNAVAILABLE: 'Zdroj byl dočasně nedostupný nebo se k němu nepodařilo připojit. Je nutné ověření.',
  MALFORMED_DATA: 'Zdroj odpověděl, ale strukturu dat nebylo možné bezpečně ověřit. Nebyla odvozena žádná hodnota.',
  PARAMETER_NOT_PROVIDED: 'Použitý datový soubor tento parametr neposkytuje.',
  INSUFFICIENT_EVIDENCE: 'Dostupné důkazy nejsou dostatečné pro bezpečné odvození této hodnoty.',
  NOT_SUPPORTED_FOR_COUNTRY: 'Tento automatizovaný národní zdroj zatím není pro vybranou zemi podporován. Údaj ověřte v příslušném oficiálním zdroji.',
  AUTHORITATIVE_DATA_REQUIRED: 'Tato informace musí být potvrzena v autoritativním dokumentu nebo příslušným orgánem.'
};

const riskLabel: Record<Exclude<RiskClassification, null>, string> = {
  NEGLIGIBLE: 'Zanedbatelné',
  LOW: 'Nízké',
  MODERATE: 'Střední',
  HIGH: 'Vysoké'
};

const statusLabel = {
  VERIFIED: 'Ověřeno',
  MODELLED: 'Modelováno',
  REQUIRES_VERIFICATION: 'Vyžaduje ověření'
} as const;

const confidenceLabel = { High: 'Vysoká', Medium: 'Střední', Low: 'Nízká' } as const;

const textureLabels: Record<string, string> = {
  sand: 'písek',
  'loamy sand': 'hlinitý písek',
  'sandy loam': 'písčitá hlína',
  loam: 'hlína',
  'silt loam': 'prachovitá hlína',
  silt: 'prach',
  'sandy clay loam': 'písčitá jílovitá hlína',
  'clay loam': 'jílovitá hlína',
  'silty clay loam': 'prachovitá jílovitá hlína',
  'sandy clay': 'písčitý jíl',
  'silty clay': 'prachovitý jíl',
  clay: 'jíl'
};

const materialLabels: Record<string, string> = {
  ALLUVIAL: 'aluviální sedimenty',
  ORGANIC_OR_PEAT: 'organické / rašelinné sedimenty',
  MADE_GROUND: 'navážka / antropogenní materiál',
  GLACIOFLUVIAL: 'glaciofluviální sedimenty',
  TILL: 'ledovcový till',
  COHESIVE: 'soudržný materiál',
  GRANULAR: 'zrnitý materiál',
  OTHER: 'jiný mapovaný materiál'
};

const utilityNames = {
  ELECTRICITY: 'Elektřina',
  WATER: 'Pitná voda',
  SEWER: 'Kanalizace',
  GAS: 'Plyn',
  TELECOM: 'Telekomunikace',
  OTHER: 'Technická infrastruktura'
} as const;

const reason = (code?: AvailabilityReason) => reasonCopy[code || 'AUTHORITATIVE_DATA_REQUIRED'];
const shown = (value: unknown, fallback = 'údaj není k dispozici') => value === null || value === undefined || value === '' ? fallback : String(value);
const texture = (value: string | null) => value ? textureLabels[value.toLowerCase()] || value : null;
const risk = (value: RiskClassification) => value ? riskLabel[value] : 'údaj není k dispozici';
const stringOrNull = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

function localizedClassification(value: string | null): string {
  if (!value) return 'údaj není k dispozici';
  return value
    .replace(/Low to Very Low/gi, 'nízké až velmi nízké')
    .replace(/Moderate/gi, 'střední')
    .replace(/High/gi, 'vysoké')
    .replace(/Low/gi, 'nízké');
}

function supportNotice(canonical: CanonicalReport): string {
  if (canonical.countryCode === 'CZ') {
    return 'Pro Česko jsou integrovány vybrané národní zdroje ČÚZK/RÚIAN a České geologické služby (ČGS). Údaje, které tato verze GeoSurvey automaticky nezískává, musí být ověřeny v příslušném oficiálním registru nebo u kompetentního úřadu.';
  }
  if (canonical.support.maturity === 'SUPPORTED') return 'Pro vybrané oblasti jsou dostupné národní zdrojové integrace; nepodporované kategorie stále vyžadují úřední ověření.';
  return 'Omezené pokrytí: pro tuto zemi jsou automatizovány pouze vybrané národní zdroje. Ostatní kategorie vyžadují ověření u příslušného orgánu.';
}

function czechGroundNarrative(canonical: CanonicalReport): string[] {
  const parts: string[] = [];
  const engineering = canonical.evidenceRecords.find(record => record.id === 'cz-cgs-engineering-geology' && record.status === 'VERIFIED');
  const hydro = canonical.evidenceRecords.find(record => record.id === 'cz-cgs-hydrogeology' && record.status === 'VERIFIED');
  const boreholes = canonical.evidenceRecords.find(record => record.id === 'cz-cgs-borehole-context' && record.status === 'VERIFIED');
  const deformation = canonical.evidenceRecords.find(record => record.id === 'cz-cgs-slope-deformation-site' && record.status === 'VERIFIED');

  if (engineering) {
    const raw = (engineering.value || {}) as Record<string, unknown>;
    const code = stringOrNull(raw.code);
    const name = stringOrNull(raw.name);
    const characterization = stringOrNull(raw.characterization);
    const rocks = stringOrNull(raw.typicalRocks);
    const scale = stringOrNull(raw.scale);
    parts.push(`ČGS — inženýrskogeologické rajonování${scale ? ` (${scale})` : ''}: ${name || code || 'mapovaný rajón'}${code && code !== name ? ` (${code})` : ''}${characterization ? `; ${characterization}` : ''}${rocks ? `; typické mapované horniny/zeminy: ${rocks}` : ''}.`);
  }
  if (hydro) {
    const raw = (hydro.value || {}) as Record<string, unknown>;
    const unit = stringOrNull(raw.unit) || stringOrNull(raw.name);
    const rock = stringOrNull(raw.rock);
    const transmissivity = stringOrNull(raw.transmissivity);
    const description = stringOrNull(raw.description);
    const scale = stringOrNull(raw.scale);
    const values = [unit, rock, transmissivity ? `transmisivita ${transmissivity}` : null, description].filter(Boolean).join('; ');
    parts.push(`ČGS — hydrogeologický kontext${scale ? ` (${scale})` : ''}: ${values || 'vrácen mapovaný hydrogeologický kontext'}.`);
  }
  if (boreholes) {
    const raw = (boreholes.value || {}) as Record<string, unknown>;
    const rows = Array.isArray(raw.boreholes) ? raw.boreholes : [];
    const hydroRows = Array.isArray(raw.hydrogeologicalBoreholes) ? raw.hydrogeologicalBoreholes : [];
    const nearest = numberOrNull(raw.nearestDistanceM);
    const radius = numberOrNull(raw.searchRadiusM);
    parts.push(`Registr vrtů ČGS: ${rows.length} okolních záznamů${radius ? ` v okruhu ${(radius / 1000).toFixed(0)} km` : ''}, z toho ${hydroRows.length} s hydrogeologickými údaji${nearest === null ? '' : `; nejbližší záznam přibližně ${nearest} m od lokality`}.`);
  }
  if (deformation) {
    const raw = (deformation.value || {}) as Record<string, unknown>;
    const count = numberOrNull(raw.count) ?? 0;
    parts.push(`Registr terénně ověřených svahových deformací ČGS: vybranou lokalitu protíná ${count} mapovaných ploch deformací.`);
  }
  if (parts.length) parts.push('Mapové údaje a okolní průzkumné záznamy slouží pouze k předběžnému screeningu. Nepotvrzují stratigrafii pod parcelou, hladinu podzemní vody, stav nebo ulehlost zemin, únosnost, soudržnost, úhel tření, sedání ani návrh založení.');
  return parts;
}

function czechCadastreNarrative(canonical: CanonicalReport): string[] {
  const parts: string[] = [];
  const parcelRecord = canonical.evidenceRecords.find(record => record.id === 'cz-cuzk-ruian-parcel' && record.status === 'VERIFIED');
  const buildingRecord = canonical.evidenceRecords.find(record => record.id === 'cz-cuzk-ruian-buildings' && record.status === 'VERIFIED');

  if (parcelRecord) {
    const raw = (parcelRecord.value || {}) as Record<string, unknown>;
    const parcelNumber = stringOrNull(raw.parcelNumber);
    const area = numberOrNull(raw.areaM2);
    const landType = stringOrNull(raw.landType);
    const landUse = stringOrNull(raw.landUse);
    const cadastralArea = stringOrNull(raw.cadastralAreaName);
    parts.push(`ČÚZK RÚIAN — katastrální kontext: parcela ${parcelNumber || 'identifikovaná parcela'}${area !== null ? `; evidovaná výměra ${area.toLocaleString('cs-CZ')} m²` : ''}${landType ? `; druh pozemku ${landType}` : ''}${landUse ? `; evidovaný způsob využití ${landUse}` : ''}${cadastralArea ? `; katastrální území ${cadastralArea}` : ''}.`);
  }
  if (buildingRecord) {
    const raw = (buildingRecord.value || {}) as Record<string, unknown>;
    const rows = Array.isArray(raw.buildings) ? raw.buildings as Array<Record<string, unknown>> : [];
    const count = numberOrNull(raw.buildingCount) ?? rows.length;
    const first = rows[0];
    const example = first ? [
      stringOrNull(first.use) ? `evidované využití ${stringOrNull(first.use)}` : null,
      numberOrNull(first.floorCount) !== null ? `počet podlaží ${numberOrNull(first.floorCount)}` : null,
      numberOrNull(first.floorAreaM2) !== null ? `podlahová plocha ${numberOrNull(first.floorAreaM2)} m²` : null,
      numberOrNull(first.builtUpAreaM2) !== null ? `zastavěná plocha ${numberOrNull(first.builtUpAreaM2)} m²` : null
    ].filter(Boolean).join(', ') : '';
    parts.push(`ČÚZK RÚIAN vrátil ${count} evidovaných stavebních objektů zasahujících do parcely${example ? `; například ${example}` : ''}.`);
  }
  if (parts.length) parts.push('RÚIAN je autoritativní územní registr, ale sám o sobě nepotvrzuje vlastnictví, právní titul, věcná břemena ani jiná zatížení. Atributy budov jsou registrační údaje, nikoli stavebně-technický průzkum, posouzení stavu, stavební povolení nebo ocenění; budovy zůstávají z odhadu hodnoty pozemku vyloučeny.');
  return parts;
}

export function renderCzechLocalizedReport(canonical: CanonicalReport): any {
  const unavailable = 'údaj není k dispozici';
  const support = supportNotice(canonical);
  const geologyUnit = canonical.geology.unitName || unavailable;
  const terrainText = canonical.terrain.elevationM === null
    ? 'Údaje o terénu nejsou k dispozici.'
    : `Modelovaný terén: nadmořská výška ${canonical.terrain.elevationM} m a sklon ${shown(canonical.terrain.slopeDegrees)}°.`;
  const soilTexture = texture(canonical.soil.texture);
  const soilText = `Model půdy: textura ${soilTexture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}; únosnost: ${canonical.soil.bearingCapacity || reason('INSUFFICIENT_EVIDENCE')}.`;
  const geologyText = canonical.geology.unitName
    ? `Podle zdroje ${canonical.geology.sourceName} se lokalita nachází v geologické jednotce ${canonical.geology.unitName}.`
    : 'Geologická jednotka není v posuzovaných zdrojích k dispozici.';
  const groundSpecific = czechGroundNarrative(canonical);
  const cadastreSpecific = czechCadastreNarrative(canonical);

  const mapped: any = canonical.groundContext?.mapped || null;
  const soilVariability: any = canonical.groundContext?.soilVariability || null;
  const variabilityCode = mapped?.variabilityClass || (soilVariability?.validSampleCount >= 2 ? (soilVariability.variationObserved ? 'MODERATE' : 'LOW') : 'INSUFFICIENT_EVIDENCE');
  const variabilityLabels: Record<string, string> = { LOW: 'Nízká', MODERATE: 'Střední', HIGH: 'Vysoká', INSUFFICIENT_EVIDENCE: 'Nedostatek důkazů' };
  const contextSummary = mapped?.sampleCount
    ? mapped.transitionIndicated
      ? 'Mapované vzorky naznačují přechod mezi odlišnými geologickými nebo genetickými jednotkami v okolí lokality.'
      : 'Dostupné mapované vzorky jsou v analyzovaném okolí převážně konzistentní; nejde však o potvrzení podmínek pod celou parcelou.'
    : 'Pro spolehlivé posouzení prostorové proměnlivosti podloží není dostatek mapovaných vzorků.';
  const investigationFocus = mapped?.transitionIndicated
    ? 'Při terénním průzkumu ověřte mapovaný přechod a skutečné materiály pod lokalitou včetně změn mocnosti a stavu vrstev.'
    : 'Před technickými rozhodnutími ověřte materiál, genezi, stav a vodní poměry průzkumem konkrétní lokality.';
  const groundContext = {
    title: 'Prostorový kontext podloží',
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
    soil_model_summary: soilVariability?.validSampleCount ? (soilVariability.variationObserved ? 'Model půdy naznačuje prostorovou proměnlivost textury.' : 'Model půdy je v dostupných vzorcích relativně konzistentní.') : 'Modelové vzorky půdy nejsou dostatečné pro posouzení proměnlivosti.',
    soil_model_sample_count: soilVariability?.validSampleCount || 0,
    soil_sand_range: soilVariability?.topsoilSandPctRange || null,
    soil_silt_range: soilVariability?.topsoilSiltPctRange || null,
    soil_clay_range: soilVariability?.topsoilClayPctRange || null,
    investigation_focus: investigationFocus,
    limitation: 'Mapový a modelový kontext slouží pouze pro předběžné posouzení. Údaje z okolí nepotvrzují profil, mocnost vrstev, vodní poměry, stav ani inženýrské parametry pod parcelou.',
    source_name: mapped?.sourceName || soilVariability?.sourceName || null,
    source_scale: mapped?.sourceScale || soilVariability?.sourceResolution || null,
    terrain_min_elevation_m: canonical.terrain.minElevationM ?? null,
    terrain_max_elevation_m: canonical.terrain.maxElevationM ?? null,
    terrain_local_relief_m: canonical.terrain.localReliefM ?? null
  };

  const valuationAvailable = canonical.valuation.min !== null && canonical.valuation.max !== null;
  const valuationText = valuationAvailable
    ? `Orientační statistická hodnota pozemku: ${canonical.valuation.min!.toLocaleString('cs-CZ')}–${canonical.valuation.max!.toLocaleString('cs-CZ')} ${canonical.valuation.currency}.`
    : reason(canonical.valuation.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED');
  const floodText = canonical.flood.classification ? `Klasifikace předběžného povodňového rizika: ${risk(canonical.flood.classification)}.` : reason(canonical.flood.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED');
  const roadText = `Nejbližší mapovaná komunikace: ${shown(canonical.infrastructure.roadName || canonical.infrastructure.roadType)}, přibližně ${shown(canonical.infrastructure.distanceM)} m od lokality.`;
  const environmentText = canonical.environment.protectedAreaName ? `Environmentální screening identifikoval ${canonical.environment.protectedAreaName}.` : 'V prověřovaném území nebyl v použitém otevřeném zdroji identifikován prvek chráněného území.';

  const localizedCategory = 'Vědecké důkazy';
  const supportCategory = 'Rozsah podpory země';
  const evidenceRegistry = canonical.evidenceRecords.map(record => {
    const code = (record.value as { reasonCode?: AvailabilityReason } | null)?.reasonCode;
    const isSupport = record.id.startsWith('country-support-');
    return {
      ...record,
      category: isSupport ? supportCategory : localizedCategory,
      claim: isSupport ? reason('NOT_SUPPORTED_FOR_COUNTRY') : `Důkazní záznam pro kategorii ${localizedCategory}.`,
      spatialRelationship: isSupport ? support : 'Prostorový vztah byl zaznamenán pro vybranou lokalitu.',
      calculationMethod: isSupport ? 'Kontrola dostupnosti národní integrace' : 'Převzetí ze zdroje a normalizace do kanonického důkazního modelu.',
      confidence: confidenceLabel[record.confidence] || record.confidence,
      limitation: record.status === 'REQUIRES_VERIFICATION' ? reason(code) : 'Závazné nebo projektové závěry musí být potvrzeny příslušným autoritativním zdrojem nebo průzkumem konkrétní lokality.'
    };
  });

  const checklist = [
    ['Úřední potvrzení územního plánování', 'Ověřte aktuální územně plánovací dokumentaci a závazné podmínky u příslušného stavebního nebo obecního úřadu.', canonical.planning.authorityName],
    ['Geotechnický průzkum', 'Objednejte geotechnický průzkum konkrétní lokality podle Eurokódu 7.', canonical.authorities.geology],
    ['Geodetické a katastrální ověření', 'V případě potřeby nechte odborně ověřit hranice, výměru a polohopis; zobrazená geometrie nenahrazuje právní určení hranice.', canonical.authorities.cadastre],
    ['Podmínky připojení sítí', 'Získejte formální podmínky připojení od příslušných provozovatelů sítí.', canonical.authorities.cadastre],
    ['Vlastnictví a právní omezení', 'Ověřte vlastnictví, věcná břemena, zástavní práva a další omezení v příslušných registrech.', canonical.authorities.cadastre]
  ].map(([topic, itemReason, authority], index) => ({ topic, reason: itemReason, recommendedAuthorityOrExpert: authority, priority: index === 3 ? 'Medium' : 'High' }));

  const utilitiesChecklist = (canonical.utilities || []).map(item => ({
    utility: utilityNames[item.utilityCode],
    status: item.mapped ? (item.distanceM === null ? 'Síť je mapována v prověřovaném otevřeném datovém souboru.' : `Síť je mapována přibližně ${item.distanceM} m od lokality. Možnost připojení musí potvrdit provozovatel.`) : reason(item.reasonCode),
    evidence_level: item.status,
    provider_type: item.sourceName,
    distance_m: item.distanceM ?? undefined,
    mapped_in_dataset: item.mapped,
    limitation: item.mapped ? reason('AUTHORITATIVE_DATA_REQUIRED') : reason(item.reasonCode)
  }));

  const dataSources = canonical.sourceRecords.map(source => ({ name: source.name, url: source.url, authority: source.name, verification_status: statusLabel[source.status] }));
  const summaryCore = valuationAvailable
    ? `Toto posouzení založené na důkazech se týká lokality v Česku. Geologická jednotka: ${geologyUnit}. ${terrainText} Půda: ${soilTexture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}. Skóre kvality důkazů: ${canonical.evidenceScore.totalScore}/100. Statistické rozpětí hodnoty pozemku je ${canonical.valuation.min!.toLocaleString('cs-CZ')}–${canonical.valuation.max!.toLocaleString('cs-CZ')} ${canonical.valuation.currency}.`
    : `Toto posouzení založené na důkazech se týká lokality v Česku. Geologická jednotka: ${geologyUnit}. ${terrainText} Půda: ${soilTexture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}. Skóre kvality důkazů: ${canonical.evidenceScore.totalScore}/100. Automatická hodnota pozemku se neuvádí, protože není k dispozici dostatečný podporovaný zdroj pro ocenění.`;

  const groundDetail = [`Závazné informace musí potvrdit příslušný orgán. ${contextSummary} ${investigationFocus}`, ...groundSpecific].join(' ');
  const buildingDetail = [reason(canonical.planning.reasonCode), ...cadastreSpecific].join(' ');
  const section = (summary: string, detail: string, status: string, source?: string, limitation?: string) => ({ summary, detail, evidence_level: status, source_cited: source, limitation_notice: limitation });

  return {
    language: 'cs',
    countrySupport: { maturity: canonical.support.maturity, label: canonical.support.maturity === 'SUPPORTED' ? 'Podporováno' : 'Omezené pokrytí', notice: support, capabilities: canonical.support.capabilities },
    groundContext,
    summary: canonical.support.maturity === 'LIMITED' ? `${summaryCore} ${support}` : summaryCore,
    titles: { estimated_value: 'Orientační statistická hodnota pozemku', confidence: 'Kvalita důkazů', executive_summary: 'Souhrnné hodnocení' },
    confidenceLabel: canonical.evidenceScore.totalScore >= 75 ? 'Vysoká kvalita důkazů' : canonical.evidenceScore.totalScore >= 50 ? 'Střední kvalita důkazů' : 'Předběžná kvalita důkazů',
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
      geohazard_risk: section(geologyText, `${geologyText} Mapované geologické a svahové údaje slouží ke screeningu a nenahrazují průzkum konkrétní parcely.`, canonical.geology.status, canonical.geology.sourceName, canonical.geology.reasonCode ? reason(canonical.geology.reasonCode) : undefined),
      flooding_risk: section(floodText, canonical.flood.reasonCode ? reason(canonical.flood.reasonCode) : reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.flood.status, canonical.flood.sourceName, canonical.flood.reasonCode ? reason(canonical.flood.reasonCode) : undefined),
      zoning_and_land_use: section(`Parametry územního plánování je nutné potvrdit podle dokumentu ${canonical.planning.instrumentName}.`, reason(canonical.planning.reasonCode), canonical.planning.status, canonical.planning.sourceName, reason(canonical.planning.reasonCode)),
      building_regulations: section(cadastreSpecific.length ? cadastreSpecific[0] : reason('AUTHORITATIVE_DATA_REQUIRED'), buildingDetail, canonical.planning.status, cadastreSpecific.length ? canonical.authorities.cadastre : canonical.planning.authorityName, reason(canonical.planning.reasonCode)),
      environmental_factors: section(environmentText, canonical.environment.reasonCode ? reason(canonical.environment.reasonCode) : reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.environment.status, canonical.environment.sourceName, canonical.environment.reasonCode ? reason(canonical.environment.reasonCode) : undefined),
      infrastructure_and_access: section(roadText, canonical.infrastructure.reasonCode ? reason(canonical.infrastructure.reasonCode) : reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.infrastructure.status, canonical.infrastructure.sourceName, canonical.infrastructure.reasonCode ? reason(canonical.infrastructure.reasonCode) : undefined),
      market_and_comparables: section(valuationText, canonical.valuation.reasonCode ? reason(canonical.valuation.reasonCode) : 'Jde pouze o orientační hodnotu samotného pozemku. Budovy, stavby a jiná zhodnocení nejsou zahrnuta.', canonical.valuation.status, canonical.valuation.sourceName, canonical.valuation.reasonCode ? reason(canonical.valuation.reasonCode) : undefined),
      development_cost_outlook: section(reason('AUTHORITATIVE_DATA_REQUIRED'), checklist.map(item => item.reason).join(' '), 'REQUIRES_VERIFICATION')
    },
    evidenceRegistry,
    verificationChecklist: checklist,
    utilitiesChecklist,
    dataSources,
    legalDisclaimers: [
      ...(canonical.support.maturity === 'LIMITED' ? [support] : []),
      'Tento automatizovaný report slouží pouze k předběžnému posouzení a není úředním rozhodnutím, právním stanoviskem ani odborným průzkumem lokality.',
      'Automatická hodnota se uvádí pouze tehdy, pokud ji podporuje dostatečný národní zdrojový podklad.',
      'Modelované půdní údaje nenahrazují geotechnický průzkum podle Eurokódu 7.',
      'Závazná práva k výstavbě a regulační podmínky vyžadují úřední potvrzení.',
      'Orientační hodnota se vztahuje pouze na pozemek a nezahrnuje budovy, stavby ani jiná zhodnocení.',
      'Před investičním rozhodnutím ověřte dostupnost, aktuálnost a omezení všech použitých zdrojů.'
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
      { category: 'Sesuvy', level: canonical.hazards.landslide.classification ? risk(canonical.hazards.landslide.classification) : unavailable, evidence_level: canonical.hazards.landslide.status, detail: canonical.hazards.landslide.classification ? `Klasifikace náchylnosti k sesuvům: ${risk(canonical.hazards.landslide.classification)}.` : reason('SOURCE_UNAVAILABLE') },
      { category: 'Seismické riziko', level: localizedClassification(canonical.hazards.seismic.classification), evidence_level: canonical.hazards.seismic.status, detail: `Seismická screeningová hodnota: ${localizedClassification(canonical.hazards.seismic.pga)}.` },
      { category: 'Radon', level: localizedClassification(canonical.hazards.radon.classification), evidence_level: canonical.hazards.radon.status, detail: canonical.hazards.radon.classification ? `Klasifikace radonového screeningu: ${localizedClassification(canonical.hazards.radon.classification)}.` : reason(canonical.hazards.radon.reasonCode) },
      { category: 'Vlivy těžby', level: localizedClassification(canonical.hazards.mining.classification), evidence_level: canonical.hazards.mining.status, detail: canonical.hazards.mining.classification ? `Klasifikace screeningu vlivů těžby: ${localizedClassification(canonical.hazards.mining.classification)}.` : reason(canonical.hazards.mining.reasonCode) }
    ],
    keyRisks: checklist.slice(0, 3).map(item => item.reason),
    opportunities: ['Kanonický model zachovává původ a stav každého důkazu.', 'Terénní, půdní, geologické a katastrální údaje jsou zobrazeny v jednom společném hodnocení.']
  };
}
