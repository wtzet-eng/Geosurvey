import { AvailabilityReason, CanonicalReport, RiskClassification } from './canonicalReport';

const reasonCopy: Record<AvailabilityReason, string> = {
  NO_DATA: 'De bron is succesvol geraadpleegd, maar gaf voor deze locatie geen object terug. Dit is geen bewijs dat het verschijnsel afwezig is.',
  SOURCE_UNAVAILABLE: 'De bron was tijdelijk niet beschikbaar of kon niet worden bereikt. Verificatie is nodig.',
  MALFORMED_DATA: 'De bron antwoordde, maar de gegevensstructuur kon niet veilig worden gevalideerd. Er is geen waarde afgeleid.',
  PARAMETER_NOT_PROVIDED: 'Deze parameter wordt niet geleverd door de gebruikte dataset.',
  INSUFFICIENT_EVIDENCE: 'Het beschikbare bewijs is onvoldoende om deze waarde verantwoord af te leiden.',
  NOT_SUPPORTED_FOR_COUNTRY: 'Deze geautomatiseerde nationale bron wordt voor het geselecteerde land nog niet ondersteund. Controleer de bevoegde officiële bron.',
  AUTHORITATIVE_DATA_REQUIRED: 'Deze informatie moet worden bevestigd in een gezaghebbend document of door de bevoegde instantie.'
};

const riskLabel: Record<Exclude<RiskClassification, null>, string> = {
  NEGLIGIBLE: 'Verwaarloosbaar',
  LOW: 'Laag',
  MODERATE: 'Matig',
  HIGH: 'Hoog'
};

const statusLabel = {
  VERIFIED: 'Geverifieerd',
  MODELLED: 'Gemodelleerd',
  REQUIRES_VERIFICATION: 'Verificatie vereist'
} as const;

const confidenceLabel = { High: 'Hoog', Medium: 'Gemiddeld', Low: 'Laag' } as const;

const textureLabels: Record<string, string> = {
  sand: 'zand',
  'loamy sand': 'lemig zand',
  'sandy loam': 'zandige leem',
  loam: 'leem',
  'silt loam': 'siltige leem',
  silt: 'silt',
  'sandy clay loam': 'zandige kleileem',
  'clay loam': 'kleileem',
  'silty clay loam': 'siltige kleileem',
  'sandy clay': 'zandige klei',
  'silty clay': 'siltige klei',
  clay: 'klei'
};

const materialLabels: Record<string, string> = {
  ALLUVIAL: 'alluviale afzettingen',
  ORGANIC_OR_PEAT: 'organisch materiaal / veen',
  MADE_GROUND: 'opgebracht terrein',
  GLACIOFLUVIAL: 'glaciofluviale afzettingen',
  TILL: 'keileem / glaciale till',
  COHESIVE: 'cohesief materiaal',
  GRANULAR: 'korrelig materiaal',
  OTHER: 'ander gekarteerd materiaal'
};

const utilityNames = {
  ELECTRICITY: 'Elektriciteit',
  WATER: 'Drinkwater',
  SEWER: 'Riolering',
  GAS: 'Gas',
  TELECOM: 'Telecommunicatie',
  OTHER: 'Nutsvoorziening'
} as const;

const reason = (code?: AvailabilityReason) => reasonCopy[code || 'AUTHORITATIVE_DATA_REQUIRED'];
const shown = (value: unknown, fallback = 'niet beschikbaar') => value === null || value === undefined || value === '' ? fallback : String(value);
const texture = (value: string | null) => value ? textureLabels[value.toLowerCase()] || value : null;
const risk = (value: RiskClassification) => value ? riskLabel[value] : 'niet beschikbaar';

function localizedClassification(value: string | null): string {
  if (!value) return 'niet beschikbaar';
  return value
    .replace(/Low to Very Low/gi, 'laag tot zeer laag')
    .replace(/Moderate/gi, 'matig')
    .replace(/High/gi, 'hoog')
    .replace(/Low/gi, 'laag');
}

function supportNotice(canonical: CanonicalReport): string {
  if (canonical.countryCode === 'NL') {
    return 'Nederland beschikt over sterke landelijke publieke bronnen, waaronder Kadaster/PDOK, BRO/DINOloket, GeoTOP, REGIS II, DSO en Rijkswaterstaat/LIWO. Alleen bronnen die in deze GeoSurvey-versie daadwerkelijk automatisch en locatie-specifiek worden bevraagd, worden als geïntegreerd aangemerkt; overige gegevens moeten in de officiële dienst worden gecontroleerd.';
  }
  if (canonical.support.maturity === 'SUPPORTED') {
    return 'Voor geselecteerde onderdelen zijn nationale bronintegraties beschikbaar. Niet-ondersteunde categorieën moeten nog steeds in de officiële bron worden gecontroleerd.';
  }
  return 'Beperkte dekking: voor dit land zijn slechts geselecteerde nationale bronintegraties geautomatiseerd. Niet-geïntegreerde categorieën vereisen controle bij de bevoegde officiële instantie.';
}

export function renderDutchLocalizedReport(canonical: CanonicalReport): any {
  const unavailable = 'niet beschikbaar';
  const support = supportNotice(canonical);
  const geologyUnit = canonical.geology.unitName || unavailable;
  const terrainText = canonical.terrain.elevationM === null
    ? 'Terreingegevens zijn niet beschikbaar.'
    : `Gemodelleerd terrein: hoogte ${canonical.terrain.elevationM} m en helling ${shown(canonical.terrain.slopeDegrees)}°.`;
  const soilTexture = texture(canonical.soil.texture);
  const soilText = `Bodemmodel: textuur ${soilTexture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}; draagkracht: ${canonical.soil.bearingCapacity || reason('INSUFFICIENT_EVIDENCE')}.`;
  const geologyText = canonical.geology.unitName
    ? `Volgens ${canonical.geology.sourceName} ligt de locatie in de geologische eenheid ${canonical.geology.unitName}.`
    : 'Voor de onderzochte bronnen is geen geologische eenheid beschikbaar.';

  const mapped: any = canonical.groundContext?.mapped || null;
  const soilVariability: any = canonical.groundContext?.soilVariability || null;
  const variabilityCode = mapped?.variabilityClass || (soilVariability?.validSampleCount >= 2 ? (soilVariability.variationObserved ? 'MODERATE' : 'LOW') : 'INSUFFICIENT_EVIDENCE');
  const variabilityLabels: Record<string, string> = { LOW: 'Laag', MODERATE: 'Matig', HIGH: 'Hoog', INSUFFICIENT_EVIDENCE: 'Onvoldoende bewijs' };
  const contextSummary = mapped?.sampleCount
    ? mapped.transitionIndicated
      ? 'De gekarteerde monsters wijzen op een overgang tussen verschillende geologische of genetische eenheden rond de locatie.'
      : 'De beschikbare gekarteerde monsters zijn in de onderzochte omgeving grotendeels consistent; dit bevestigt echter niet de omstandigheden onder het gehele perceel.'
    : 'Er zijn onvoldoende gekarteerde monsters om de ruimtelijke variatie van de ondergrond betrouwbaar te beoordelen.';
  const investigationFocus = mapped?.transitionIndicated
    ? 'Controleer bij veldonderzoek de gekarteerde overgang en de werkelijke materialen onder de locatie, inclusief veranderingen in laagdikte en toestand.'
    : 'Controleer vóór technische beslissingen het materiaal, de ontstaanswijze, de toestand en de waterhuishouding met locatie-specifiek onderzoek.';
  const groundContext = {
    title: 'Ruimtelijke context van de ondergrond',
    evidence_level: canonical.groundContext?.status || 'REQUIRES_VERIFICATION',
    variability_code: variabilityCode,
    variability_label: variabilityLabels[variabilityCode] || variabilityCode,
    summary: contextSummary,
    mapped_units_label: 'Gekarteerde eenheden',
    mapped_units: mapped?.distinctMappedUnits || [],
    material_indicators_label: 'Indicatoren van gekarteerd materiaal',
    material_indicators: (mapped?.materialIndicators || []).map((item: string) => materialLabels[item] || item),
    transition_indicated: Boolean(mapped?.transitionIndicated),
    sample_label: 'Gekarteerde monsters',
    sample_count: mapped?.sampleCount || 0,
    site_sample_count: mapped?.siteSampleCount || 0,
    parcel_sample_count: mapped?.parcelSampleCount || 0,
    vicinity_sample_count: mapped?.vicinitySampleCount || 0,
    soil_model_summary: soilVariability?.validSampleCount ? (soilVariability.variationObserved ? 'Het bodemmodel wijst op ruimtelijke variatie in textuur.' : 'Het bodemmodel is in de beschikbare monsters relatief consistent.') : 'Er zijn onvoldoende bodemmodelmonsters om de variatie te beoordelen.',
    soil_model_sample_count: soilVariability?.validSampleCount || 0,
    soil_sand_range: soilVariability?.topsoilSandPctRange || null,
    soil_silt_range: soilVariability?.topsoilSiltPctRange || null,
    soil_clay_range: soilVariability?.topsoilClayPctRange || null,
    investigation_focus: investigationFocus,
    limitation: 'Kaart- en modelinformatie is uitsluitend geschikt voor een eerste screening. Gegevens uit de omgeving bevestigen niet het profiel, de laagdiktes, watercondities, toestand of technische parameters onder het perceel.',
    source_name: mapped?.sourceName || soilVariability?.sourceName || null,
    source_scale: mapped?.sourceScale || soilVariability?.sourceResolution || null,
    terrain_min_elevation_m: canonical.terrain.minElevationM ?? null,
    terrain_max_elevation_m: canonical.terrain.maxElevationM ?? null,
    terrain_local_relief_m: canonical.terrain.localReliefM ?? null
  };

  const valuationAvailable = canonical.valuation.min !== null && canonical.valuation.max !== null;
  const valuationText = valuationAvailable
    ? `Indicatieve statistische grondwaarde: ${canonical.valuation.min!.toLocaleString('nl-NL')}–${canonical.valuation.max!.toLocaleString('nl-NL')} ${canonical.valuation.currency}.`
    : reason(canonical.valuation.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED');
  const floodText = canonical.flood.classification ? `Classificatie van de eerste overstromingsscreening: ${risk(canonical.flood.classification)}.` : reason(canonical.flood.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED');
  const roadText = `Dichtstbijzijnde gekarteerde weg: ${shown(canonical.infrastructure.roadName || canonical.infrastructure.roadType)}, op ongeveer ${shown(canonical.infrastructure.distanceM)} m van de locatie.`;
  const environmentText = canonical.environment.protectedAreaName ? `De milieuscreening identificeerde ${canonical.environment.protectedAreaName}.` : 'In de gebruikte open bron is in het onderzochte gebied geen beschermd gebiedsobject aangetroffen.';

  const localizedCategory = 'Wetenschappelijk bewijs';
  const supportCategory = 'Landendekking';
  const evidenceRegistry = canonical.evidenceRecords.map(record => {
    const code = (record.value as { reasonCode?: AvailabilityReason } | null)?.reasonCode;
    const isSupport = record.id.startsWith('country-support-');
    return {
      ...record,
      category: isSupport ? supportCategory : localizedCategory,
      claim: isSupport ? reason('NOT_SUPPORTED_FOR_COUNTRY') : `Bewijsrecord voor de categorie ${localizedCategory}.`,
      spatialRelationship: isSupport ? support : 'De ruimtelijke relatie is vastgelegd voor de geselecteerde locatie.',
      calculationMethod: isSupport ? 'Controle van de beschikbaarheid van nationale integraties' : 'Bron-specifieke inname en normalisatie naar het canonieke bewijsmodel.',
      confidence: confidenceLabel[record.confidence] || record.confidence,
      limitation: record.status === 'REQUIRES_VERIFICATION' ? reason(code) : 'Bindende of ontwerpgerichte conclusies moeten worden bevestigd door een bevoegde officiële bron of door locatie-specifiek onderzoek.'
    };
  });

  const checklist = [
    ['Officiële planologische bevestiging', 'Controleer de actuele bindende planregels en het omgevingsplan bij de bevoegde instantie.', canonical.planning.authorityName],
    ['Geotechnisch onderzoek', 'Laat een locatie-specifiek geotechnisch onderzoek uitvoeren volgens Eurocode 7.', canonical.authorities.geology],
    ['Topografische en kadastrale verificatie', 'Laat grenzen en maatvoering zo nodig professioneel verifiëren; kaartgeometrie is geen juridische grensvaststelling.', canonical.authorities.cadastre],
    ['Aansluitvoorwaarden nutsvoorzieningen', 'Vraag formele aansluitvoorwaarden op bij de relevante netbeheerders.', canonical.authorities.cadastre],
    ['Eigendom en beperkingen', 'Controleer eigendom, erfdienstbaarheden, lasten en andere juridische beperkingen in de bevoegde registers.', canonical.authorities.cadastre]
  ].map(([topic, itemReason, authority], index) => ({ topic, reason: itemReason, recommendedAuthorityOrExpert: authority, priority: index === 3 ? 'Medium' : 'High' }));

  const utilitiesChecklist = (canonical.utilities || []).map(item => ({
    utility: utilityNames[item.utilityCode],
    status: item.mapped ? (item.distanceM === null ? 'De voorziening is gekarteerd in de geraadpleegde open dataset.' : `De voorziening is gekarteerd op ongeveer ${item.distanceM} m van de locatie. De netbeheerder moet de aansluitmogelijkheid bevestigen.`) : reason(item.reasonCode),
    evidence_level: item.status,
    provider_type: item.sourceName,
    distance_m: item.distanceM ?? undefined,
    mapped_in_dataset: item.mapped,
    limitation: item.mapped ? reason('AUTHORITATIVE_DATA_REQUIRED') : reason(item.reasonCode)
  }));

  const dataSources = canonical.sourceRecords.map(source => ({ name: source.name, url: source.url, authority: source.name, verification_status: statusLabel[source.status] }));
  const summaryCore = valuationAvailable
    ? `Deze evidence-first beoordeling betreft een locatie in ${canonical.countryName}. Geologische eenheid: ${geologyUnit}. ${terrainText} Bodem: ${soilTexture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}. Bewijskwaliteit: ${canonical.evidenceScore.totalScore}/100. De statistische grondwaardebandbreedte is ${canonical.valuation.min!.toLocaleString('nl-NL')}–${canonical.valuation.max!.toLocaleString('nl-NL')} ${canonical.valuation.currency}.`
    : `Deze evidence-first beoordeling betreft een locatie in ${canonical.countryName}. Geologische eenheid: ${geologyUnit}. ${terrainText} Bodem: ${soilTexture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}. Bewijskwaliteit: ${canonical.evidenceScore.totalScore}/100. Er wordt geen automatische grondwaarde weergegeven omdat onvoldoende ondersteund nationaal waarderingsbewijs beschikbaar is.`;

  const groundDetail = `Bindende informatie moet door de bevoegde instantie worden bevestigd. ${contextSummary} ${investigationFocus}`;
  const section = (summary: string, detail: string, status: string, source?: string, limitation?: string) => ({ summary, detail, evidence_level: status, source_cited: source, limitation_notice: limitation });

  return {
    language: 'nl',
    countrySupport: { maturity: canonical.support.maturity, label: canonical.support.maturity === 'SUPPORTED' ? 'Ondersteund' : 'Beperkte dekking', notice: support, capabilities: canonical.support.capabilities },
    groundContext,
    summary: canonical.support.maturity === 'LIMITED' ? `${summaryCore} ${support}` : summaryCore,
    titles: { estimated_value: 'Indicatieve statistische grondwaarde', confidence: 'Bewijskwaliteit', executive_summary: 'Samenvattende beoordeling' },
    confidenceLabel: canonical.evidenceScore.totalScore >= 75 ? 'Hoge bewijskwaliteit' : canonical.evidenceScore.totalScore >= 50 ? 'Gemiddelde bewijskwaliteit' : 'Voorlopige bewijskwaliteit',
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
      geohazard_risk: section(geologyText, `${geologyText} Gekarteerde geologische gegevens zijn bedoeld voor screening en vervangen geen onderzoek van het specifieke perceel.`, canonical.geology.status, canonical.geology.sourceName, canonical.geology.reasonCode ? reason(canonical.geology.reasonCode) : undefined),
      flooding_risk: section(floodText, canonical.flood.reasonCode ? reason(canonical.flood.reasonCode) : reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.flood.status, canonical.flood.sourceName, canonical.flood.reasonCode ? reason(canonical.flood.reasonCode) : undefined),
      zoning_and_land_use: section(`Planologische parameters moeten worden bevestigd onder ${canonical.planning.instrumentName}.`, reason(canonical.planning.reasonCode), canonical.planning.status, canonical.planning.sourceName, reason(canonical.planning.reasonCode)),
      building_regulations: section(reason('AUTHORITATIVE_DATA_REQUIRED'), `Regelgeving moet worden bevestigd aan de hand van ${canonical.planning.instrumentName}.`, canonical.planning.status, canonical.planning.authorityName, reason(canonical.planning.reasonCode)),
      environmental_factors: section(environmentText, canonical.environment.reasonCode ? reason(canonical.environment.reasonCode) : reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.environment.status, canonical.environment.sourceName, canonical.environment.reasonCode ? reason(canonical.environment.reasonCode) : undefined),
      infrastructure_and_access: section(roadText, canonical.infrastructure.reasonCode ? reason(canonical.infrastructure.reasonCode) : reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.infrastructure.status, canonical.infrastructure.sourceName, canonical.infrastructure.reasonCode ? reason(canonical.infrastructure.reasonCode) : undefined),
      market_and_comparables: section(valuationText, canonical.valuation.reasonCode ? reason(canonical.valuation.reasonCode) : 'Dit is uitsluitend een indicatieve grondwaarde. Gebouwen, bouwwerken en andere verbeteringen zijn niet inbegrepen.', canonical.valuation.status, canonical.valuation.sourceName, canonical.valuation.reasonCode ? reason(canonical.valuation.reasonCode) : undefined),
      development_cost_outlook: section(reason('AUTHORITATIVE_DATA_REQUIRED'), checklist.map(item => item.reason).join(' '), 'REQUIRES_VERIFICATION')
    },
    evidenceRegistry,
    verificationChecklist: checklist,
    utilitiesChecklist,
    dataSources,
    legalDisclaimers: [
      ...(canonical.support.maturity === 'LIMITED' ? [support] : []),
      'Dit geautomatiseerde rapport is uitsluitend bedoeld voor een eerste screening en is geen officieel besluit, juridisch advies of professioneel locatieonderzoek.',
      'Een automatische waarde wordt alleen weergegeven wanneer voldoende bewijs uit een ondersteunde nationale waarderingsbron beschikbaar is.',
      'Gemodelleerde bodemgegevens vervangen geen geotechnisch onderzoek volgens Eurocode 7.',
      'Bindende bouw- en planologische rechten moeten officieel worden bevestigd.',
      'Elke indicatieve waarde heeft uitsluitend betrekking op de grond. Gebouwen, bouwwerken en andere verbeteringen zijn uitgesloten.',
      'Controleer vóór een investeringsbeslissing de actualiteit, beschikbaarheid en beperkingen van alle gebruikte bronnen.'
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
      { category: 'Aardverschuivingen', level: canonical.hazards.landslide.classification ? risk(canonical.hazards.landslide.classification) : unavailable, evidence_level: canonical.hazards.landslide.status, detail: canonical.hazards.landslide.classification ? `Classificatie van gevoeligheid voor aardverschuivingen: ${risk(canonical.hazards.landslide.classification)}.` : reason('SOURCE_UNAVAILABLE') },
      { category: 'Seismisch risico', level: localizedClassification(canonical.hazards.seismic.classification), evidence_level: canonical.hazards.seismic.status, detail: `Seismische screeningswaarde: ${localizedClassification(canonical.hazards.seismic.pga)}.` },
      { category: 'Radon', level: localizedClassification(canonical.hazards.radon.classification), evidence_level: canonical.hazards.radon.status, detail: canonical.hazards.radon.classification ? `Classificatie van radonscreening: ${localizedClassification(canonical.hazards.radon.classification)}.` : reason(canonical.hazards.radon.reasonCode) },
      { category: 'Mijnbouwinvloed', level: localizedClassification(canonical.hazards.mining.classification), evidence_level: canonical.hazards.mining.status, detail: canonical.hazards.mining.classification ? `Classificatie van mijnbouwinvloed: ${localizedClassification(canonical.hazards.mining.classification)}.` : reason(canonical.hazards.mining.reasonCode) }
    ],
    keyRisks: checklist.slice(0, 3).map(item => item.reason),
    opportunities: ['Het canonieke model bewaart de herkomst en status van ieder bewijsrecord.', 'Terrein-, bodem- en brongegevens worden samengebracht in één voorlopige beoordeling.']
  };
}
