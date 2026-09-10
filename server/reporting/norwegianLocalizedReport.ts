import { AvailabilityReason, CanonicalReport, RiskClassification } from './canonicalReport';

const reasonCopy: Record<AvailabilityReason, string> = {
  NO_DATA: 'Kilden ble hentet uten feil, men returnerte ingen registrert forekomst for dette stedet. Dette er ikke bevis på at forholdet ikke finnes.',
  SOURCE_UNAVAILABLE: 'Kilden var midlertidig utilgjengelig eller kunne ikke nås. Opplysningen må verifiseres.',
  MALFORMED_DATA: 'Kilden svarte, men datastrukturen kunne ikke valideres sikkert. Ingen verdi ble utledet.',
  PARAMETER_NOT_PROVIDED: 'Denne parameteren leveres ikke av datasettet som er brukt.',
  INSUFFICIENT_EVIDENCE: 'Tilgjengelig dokumentasjon er ikke tilstrekkelig til å utlede denne verdien på en forsvarlig måte.',
  NOT_SUPPORTED_FOR_COUNTRY: 'Denne nasjonale kilden er ennå ikke automatisert for valgt land. Kontroller den relevante offisielle tjenesten.',
  AUTHORITATIVE_DATA_REQUIRED: 'Opplysningen må bekreftes i en autoritativ kilde eller av ansvarlig myndighet.'
};

const riskLabel: Record<Exclude<RiskClassification, null>, string> = {
  NEGLIGIBLE: 'Ubetydelig', LOW: 'Lav', MODERATE: 'Moderat', HIGH: 'Høy'
};
const statusLabel = { VERIFIED: 'Verifisert', MODELLED: 'Modellert', REQUIRES_VERIFICATION: 'Må verifiseres' } as const;
const confidenceLabel = { High: 'Høy', Medium: 'Middels', Low: 'Lav' } as const;
const utilityNames = { ELECTRICITY: 'Strøm', WATER: 'Vann', SEWER: 'Avløp', GAS: 'Gass', TELECOM: 'Telekommunikasjon', OTHER: 'Teknisk infrastruktur' } as const;
const textureLabels: Record<string, string> = { sand: 'sand', 'loamy sand': 'leirholdig sand', 'sandy loam': 'sandholdig mold', loam: 'mold', 'silt loam': 'siltholdig mold', silt: 'silt', 'sandy clay loam': 'sandholdig leirmold', 'clay loam': 'leirmold', 'silty clay loam': 'siltholdig leirmold', 'sandy clay': 'sandholdig leire', 'silty clay': 'siltholdig leire', clay: 'leire' };
const materialLabels: Record<string, string> = { ALLUVIAL: 'elve- og bekkeavsetninger', ORGANIC_OR_PEAT: 'organisk materiale / torv', MADE_GROUND: 'fyllmasser', GLACIOFLUVIAL: 'breelvavsetninger', TILL: 'morene', COHESIVE: 'kohesivt materiale', GRANULAR: 'friksjonsmateriale', OTHER: 'annet kartlagt materiale' };

const reason = (code?: AvailabilityReason) => reasonCopy[code || 'AUTHORITATIVE_DATA_REQUIRED'];
const shown = (value: unknown, fallback = 'ikke tilgjengelig') => value === null || value === undefined || value === '' ? fallback : String(value);
const texture = (value: string | null) => value ? textureLabels[value.toLowerCase()] || value : null;
const risk = (value: RiskClassification) => value ? riskLabel[value] : 'ikke tilgjengelig';
const str = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
const num = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

function localizedClassification(value: string | null): string {
  if (!value) return 'ikke tilgjengelig';
  return value.replace(/Low to Very Low/gi, 'lav til svært lav').replace(/Moderate/gi, 'moderat').replace(/High/gi, 'høy').replace(/Low/gi, 'lav');
}

function supportNotice(canonical: CanonicalReport): string {
  if (canonical.countryCode === 'NO') {
    return 'For Norge bruker GeoSurvey utvalgte nasjonale kilder fra Kartverket og NGU. Eiendomsidentifikasjon, detaljerte løsmasser, NADAG-borehull, mulighet for marin leire og radonaktsomhet kan hentes automatisk. NVE-farekart, kommunale arealplaner, juridisk eiendomsinformasjon og tomteverdi må fortsatt kontrolleres i de offisielle tjenestene.';
  }
  return canonical.support.maturity === 'SUPPORTED'
    ? 'Nasjonale kildeintegrasjoner finnes for utvalgte områder. Andre kategorier krever fortsatt offisiell kontroll.'
    : 'Begrenset dekning: bare utvalgte nasjonale kilder er automatisert. Andre kategorier krever kontroll hos ansvarlig myndighet.';
}

function norwayGroundNarrative(canonical: CanonicalReport): string[] {
  const parts: string[] = [];
  const deposits = canonical.evidenceRecords.find(record => record.id === 'no-ngu-loose-mass-detailed' && record.status === 'VERIFIED');
  const nadag = canonical.evidenceRecords.find(record => record.id === 'no-ngu-nadag-borehole-context' && record.status === 'VERIFIED');
  const marineClay = canonical.evidenceRecords.find(record => record.id === 'no-ngu-marine-clay' && record.status === 'VERIFIED');
  const radon = canonical.evidenceRecords.find(record => record.id === 'no-ngu-radon-awareness' && record.status === 'VERIFIED');

  if (deposits) {
    const v = (deposits.value || {}) as Record<string, unknown>;
    const deposit = str(v.deposit);
    const infiltration = str(v.infiltration);
    const groundwater = str(v.groundwater);
    parts.push(`NGU Løsmasse detaljert: ${deposit || 'kartlagt løsmassetype'}${infiltration ? `; infiltrasjonspotensial: ${infiltration}` : ''}${groundwater ? `; grunnvannspotensial i løsmassene: ${groundwater}` : ''}.`);
  }
  if (nadag) {
    const v = (nadag.value || {}) as Record<string, unknown>;
    const count = num(v.count) ?? 0;
    const nearest = num(v.nearestDistanceM);
    parts.push(`NGU NADAG: ${count} geotekniske borehullsregistreringer ble returnert i søkeområdet${nearest !== null ? `; nærmeste returnerte registrering ligger omtrent ${Math.round(nearest)} m fra stedet` : ''}.`);
  }
  if (marineClay) {
    const v = (marineClay.value || {}) as Record<string, unknown>;
    parts.push(`NGU – mulighet for marin leire: ${str(v.classification) || 'kartlagt klassifikasjon tilgjengelig'}. Dette uttrykker mulighet, ikke påvist marin eller kvikk leire på tomten.`);
  }
  if (radon) {
    const v = (radon.value || {}) as Record<string, unknown>;
    parts.push(`NGU radonaktsomhet: ${str(v.classification) || 'kartlagt aktsomhetsklasse tilgjengelig'}. Dette er områdescreening, ikke en radonmåling på tomten eller i en bygning.`);
  }
  if (parts.length) parts.push('Kartdata og borehull i nærheten er screeninggrunnlag. De dokumenterer ikke lagfølgen, bergdybden, grunnvannstanden, styrken eller setningsegenskapene under hele tomten og erstatter ikke geoteknisk grunnundersøkelse.');
  return parts;
}

function norwayCadastreNarrative(canonical: CanonicalReport): string[] {
  const record = canonical.evidenceRecords.find(item => item.id === 'no-kartverket-property' && item.status === 'VERIFIED');
  if (!record) return [];
  const v = (record.value || {}) as Record<string, unknown>;
  const parcelId = str(v.parcelId);
  const distance = num(v.distanceM);
  const accuracy = str(v.accuracyClass);
  return [
    `Kartverket – Åpent eiendoms-API identifiserer matrikkelenheten ${parcelId || 'ved valgt sted'}${distance !== null ? `, omtrent ${distance} m fra valgt punkt` : ''}${accuracy ? `; grov stedfestingsklasse: ${accuracy}` : ''}.`,
    'Kartverket opplyser at eiendomskartet kan være ufullstendig eller upresist, og det åpne API-et leverer ikke grensetype eller detaljert kvalitetsinformasjon for grensene. Geometrien brukes derfor som registerkontekst, ikke som sertifisert juridisk grense. Eierskap, hjemmel, servitutter og heftelser må verifiseres i Matrikkelen/Grunnboken.'
  ];
}

function localizedEvidenceRecord(record: any): any {
  const code = (record.value as { reasonCode?: AvailabilityReason } | null)?.reasonCode;
  const names: Record<string, string> = {
    'no-kartverket-property': 'Kartverket – matrikkelenhet',
    'no-ngu-loose-mass-detailed': 'NGU – detaljerte løsmasser',
    'no-ngu-nadag-borehole-context': 'NGU NADAG – grunnundersøkelser',
    'no-ngu-marine-clay': 'NGU – mulighet for marin leire',
    'no-ngu-radon-awareness': 'NGU – radonaktsomhet'
  };
  return {
    ...record,
    category: names[record.id] || (record.id.startsWith('country-support-') ? 'Landdekning' : 'Dokumentasjon'),
    claim: names[record.id] ? `${names[record.id]} er inkludert som stedsspesifikk screeningdokumentasjon.` : record.id.startsWith('country-support-') ? reason('NOT_SUPPORTED_FOR_COUNTRY') : 'Dokumentasjonsrecord for valgt sted.',
    spatialRelationship: record.id.startsWith('country-support-') ? 'Nasjonal støtteprofil for Norge.' : 'Romlig relasjon er registrert for valgt sted eller angitt søkeområde.',
    calculationMethod: record.id.startsWith('country-support-') ? 'Kontroll av tilgjengelige nasjonale integrasjoner.' : 'Kildespesifikk innhenting og normalisering til GeoSurveys dokumentasjonsmodell.',
    confidence: confidenceLabel[record.confidence as keyof typeof confidenceLabel] || record.confidence,
    limitation: record.status === 'REQUIRES_VERIFICATION' ? reason(code) : record.limitation || 'Bindende eller prosjekteringsrettede konklusjoner må bekreftes i autoritativ kilde eller ved stedsspesifikk undersøkelse.'
  };
}

export function renderNorwegianLocalizedReport(canonical: CanonicalReport): any {
  const unavailable = 'ikke tilgjengelig';
  const support = supportNotice(canonical);
  const geologyUnit = canonical.geology.unitName || unavailable;
  const terrainText = canonical.terrain.elevationM === null ? 'Terrengdata er ikke tilgjengelig.' : `Modellert terreng: høyde ${canonical.terrain.elevationM} m og helning ${shown(canonical.terrain.slopeDegrees)}°.`;
  const soilTexture = texture(canonical.soil.texture);
  const soilText = `Jordmodell: tekstur ${soilTexture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}; bæreevne: ${canonical.soil.bearingCapacity || reason('INSUFFICIENT_EVIDENCE')}.`;
  const geologyText = canonical.geology.unitName ? `NGU-konteksten beskriver overflaten/undergrunnen ved stedet som ${canonical.geology.unitName}.` : 'Kartlagt geologisk eller løsmasseenhet er ikke tilgjengelig i de integrerte kildene for dette stedet.';
  const groundSpecific = norwayGroundNarrative(canonical);
  const cadastreSpecific = norwayCadastreNarrative(canonical);

  const mapped: any = canonical.groundContext?.mapped || null;
  const soilVariability: any = canonical.groundContext?.soilVariability || null;
  const variabilityCode = mapped?.variabilityClass || (soilVariability?.validSampleCount >= 2 ? (soilVariability.variationObserved ? 'MODERATE' : 'LOW') : 'INSUFFICIENT_EVIDENCE');
  const variabilityLabels: Record<string, string> = { LOW: 'Lav', MODERATE: 'Moderat', HIGH: 'Høy', INSUFFICIENT_EVIDENCE: 'Utilstrekkelig dokumentasjon' };
  const contextSummary = mapped?.sampleCount ? (mapped.transitionIndicated ? 'Kartlagte prøver antyder overgang mellom ulike geologiske eller genetiske enheter i området.' : 'Tilgjengelige kartprøver er forholdsvis konsistente i området; dette bekrefter likevel ikke forholdene under hele tomten.') : 'Det er ikke nok kartlagte prøver til å vurdere romlig variasjon i grunnen sikkert.';
  const investigationFocus = mapped?.transitionIndicated ? 'Kontroller den kartlagte overgangen og faktiske materialer, lagtykkelser og vannforhold ved feltundersøkelse.' : 'Kontroller materialtype, lagdeling, bergdybde og vannforhold med stedsspesifikk grunnundersøkelse før tekniske beslutninger.';
  const groundContext = {
    title: 'Romlig grunnkontekst', evidence_level: canonical.groundContext?.status || 'REQUIRES_VERIFICATION', variability_code: variabilityCode, variability_label: variabilityLabels[variabilityCode] || variabilityCode,
    summary: contextSummary, mapped_units_label: 'Kartlagte enheter', mapped_units: mapped?.distinctMappedUnits || [], material_indicators_label: 'Indikatorer for kartlagt materiale', material_indicators: (mapped?.materialIndicators || []).map((item: string) => materialLabels[item] || item), transition_indicated: Boolean(mapped?.transitionIndicated),
    sample_label: 'Kartprøver', sample_count: mapped?.sampleCount || 0, site_sample_count: mapped?.siteSampleCount || 0, parcel_sample_count: mapped?.parcelSampleCount || 0, vicinity_sample_count: mapped?.vicinitySampleCount || 0,
    soil_model_summary: soilVariability?.validSampleCount ? (soilVariability.variationObserved ? 'Jordmodellen antyder romlig variasjon i tekstur.' : 'Jordmodellen er forholdsvis konsistent i de tilgjengelige prøvene.') : 'Det er ikke nok jordmodellprøver til å vurdere variasjon.', soil_model_sample_count: soilVariability?.validSampleCount || 0,
    soil_sand_range: soilVariability?.topsoilSandPctRange || null, soil_silt_range: soilVariability?.topsoilSiltPctRange || null, soil_clay_range: soilVariability?.topsoilClayPctRange || null,
    investigation_focus: investigationFocus,
    limitation: 'Kart- og modelldata er bare egnet til innledende screening. Omkringliggende data bekrefter ikke lagdeling, lagtykkelser, vannforhold eller tekniske parametere under tomten.',
    source_name: mapped?.sourceName || soilVariability?.sourceName || 'NGU / SoilGrids', source_scale: mapped?.sourceScale || soilVariability?.sourceResolution || null,
    terrain_min_elevation_m: canonical.terrain.minElevationM ?? null, terrain_max_elevation_m: canonical.terrain.maxElevationM ?? null, terrain_local_relief_m: canonical.terrain.localReliefM ?? null
  };

  const valuationAvailable = canonical.valuation.min !== null && canonical.valuation.max !== null;
  const valuationText = valuationAvailable ? `Indikativ statistisk tomteverdi: ${canonical.valuation.min!.toLocaleString('nb-NO')}–${canonical.valuation.max!.toLocaleString('nb-NO')} ${canonical.valuation.currency}.` : reason(canonical.valuation.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED');
  const floodText = canonical.flood.classification ? `Innledende klassifisering av flomrisiko: ${risk(canonical.flood.classification)}.` : 'NVE flomfare er ikke automatisert i denne versjonen. Kontroller NVE Atlas/farekart for stedet.';
  const roadText = `Nærmeste kartlagte vei: ${shown(canonical.infrastructure.roadName || canonical.infrastructure.roadType)}, omtrent ${shown(canonical.infrastructure.distanceM)} m fra stedet.`;
  const environmentText = canonical.environment.protectedAreaName ? `Miljøscreeningen identifiserte ${canonical.environment.protectedAreaName}.` : 'Ingen verneområdefunksjon ble returnert i den åpne miljøscreeningen for søkeområdet.';

  const checklist = [
    ['Arealplan og byggevilkår', 'Kontroller gjeldende kommuneplan/reguleringsplan og bindende byggevilkår hos kommunen.', canonical.planning.authorityName],
    ['Geoteknisk grunnundersøkelse', 'Bestill stedsspesifikk geoteknisk undersøkelse etter Eurokode 7; bruk NADAG som bakgrunn, ikke som erstatning.', canonical.authorities.geology],
    ['Flom- og skredfare', 'Kontroller NVE Atlas og relevante aktsomhets-/farekart; bestill detaljert vurdering når screening eller tiltaksklasse krever det.', canonical.authorities.flood],
    ['Eiendomsgrenser og rettigheter', 'Kontroller Matrikkelen/Grunnboken og få grensene faglig avklart dersom presisjon er viktig for tiltaket.', canonical.authorities.cadastre],
    ['Tilknytning til teknisk infrastruktur', 'Innhent formelle tilknytningsvilkår fra aktuelle netteiere og kommunen.', canonical.authorities.cadastre]
  ].map(([topic, itemReason, authority], index) => ({ topic, reason: itemReason, recommendedAuthorityOrExpert: authority, priority: index < 4 ? 'High' : 'Medium' }));

  const utilitiesChecklist = (canonical.utilities || []).map(item => ({
    utility: utilityNames[item.utilityCode],
    status: item.mapped ? (item.distanceM === null ? 'Tjenesten er kartlagt i det åpne datasettet som ble brukt.' : `Tjenesten er kartlagt omtrent ${item.distanceM} m fra stedet. Tilknytning må bekreftes av netteier.`) : reason(item.reasonCode),
    evidence_level: item.status, provider_type: item.sourceName, distance_m: item.distanceM ?? undefined, mapped_in_dataset: item.mapped,
    limitation: item.mapped ? reason('AUTHORITATIVE_DATA_REQUIRED') : reason(item.reasonCode)
  }));

  const dataSources = canonical.sourceRecords.map(source => ({ name: source.name, url: source.url, authority: source.name, verification_status: statusLabel[source.status] }));
  const evidenceRegistry = canonical.evidenceRecords.map(localizedEvidenceRecord);
  const summaryCore = valuationAvailable
    ? `Denne kunnskapsbaserte vurderingen gjelder en tomt i Norge. Kartlagt grunnkontekst: ${geologyUnit}. ${terrainText} Jord: ${soilTexture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}. Dokumentasjonsscore: ${canonical.evidenceScore.totalScore}/100. Indikativ tomteverdi er ${canonical.valuation.min!.toLocaleString('nb-NO')}–${canonical.valuation.max!.toLocaleString('nb-NO')} ${canonical.valuation.currency}.`
    : `Denne kunnskapsbaserte vurderingen gjelder en tomt i Norge. Kartlagt grunnkontekst: ${geologyUnit}. ${terrainText} Jord: ${soilTexture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}. Dokumentasjonsscore: ${canonical.evidenceScore.totalScore}/100. Automatisk tomteverdi vises ikke fordi GeoSurvey ennå ikke har en tilstrekkelig dokumentert norsk kilde for tomteverdi.`;
  const section = (summary: string, detail: string, status: string, source?: string, limitation?: string) => ({ summary, detail, evidence_level: status, source_cited: source, limitation_notice: limitation });
  const groundDetail = [`${contextSummary} ${investigationFocus}`, ...groundSpecific].join(' ');
  const parcelDetail = cadastreSpecific.length ? cadastreSpecific.join(' ') : reason('AUTHORITATIVE_DATA_REQUIRED');

  return {
    language: 'no',
    countrySupport: { maturity: canonical.support.maturity, label: 'Begrenset, men nasjonalt integrert dekning', notice: support, capabilities: canonical.support.capabilities },
    groundContext,
    summary: `${summaryCore} ${support}`,
    titles: { estimated_value: 'Indikativ tomteverdi', confidence: 'Dokumentasjonskvalitet', executive_summary: 'Sammendrag' },
    confidenceLabel: canonical.evidenceScore.totalScore >= 75 ? 'Høy dokumentasjonskvalitet' : canonical.evidenceScore.totalScore >= 50 ? 'Middels dokumentasjonskvalitet' : 'Foreløpig dokumentasjonskvalitet',
    unavailableReasons: {
      geology: reason(canonical.geology.reasonCode), soilTexture: reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED'), engineeringParameter: reason('INSUFFICIENT_EVIDENCE'), groundwater: reason('AUTHORITATIVE_DATA_REQUIRED'), planning: reason(canonical.planning.reasonCode), valuation: reason(canonical.valuation.reasonCode), sourceUnavailable: reason('SOURCE_UNAVAILABLE'), noFeature: reason('NO_DATA')
    },
    sections: {
      soil_and_ground: section(soilText, groundDetail, canonical.geology.status === 'VERIFIED' ? 'VERIFIED' : canonical.soil.status, canonical.geology.sourceName, 'Kartlagte løsmasser og nærliggende undersøkelser erstatter ikke geoteknisk undersøkelse på tomten.'),
      geohazard_risk: section(geologyText, `${groundSpecific.find(text => text.includes('marin leire')) || ''} ${groundSpecific.find(text => text.includes('radon')) || ''}`.trim() || reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.geology.status, canonical.geology.sourceName, 'NVE-skredfare og andre bindende farevurderinger må kontrolleres separat.'),
      flooding_risk: section(floodText, 'Kontroller NVE Atlas og gjeldende flomaktsomhets-/farekart før areal- eller byggevedtak.', 'REQUIRES_VERIFICATION', canonical.authorities.flood, reason('AUTHORITATIVE_DATA_REQUIRED')),
      zoning_and_land_use: section(`Arealplanstatus må bekreftes etter ${canonical.planning.instrumentName}.`, 'Kontroller kommunens digitale planregister, plankart, bestemmelser og eventuelle hensynssoner.', canonical.planning.status, canonical.planning.sourceName, reason(canonical.planning.reasonCode)),
      building_regulations: section(cadastreSpecific[0] || reason('AUTHORITATIVE_DATA_REQUIRED'), parcelDetail, cadastreSpecific.length ? 'VERIFIED' : 'REQUIRES_VERIFICATION', canonical.authorities.cadastre, 'Matrikkeldata dokumenterer registerkontekst, ikke automatisk eierskap, juridisk grense eller byggerett.'),
      environmental_factors: section(environmentText, canonical.environment.reasonCode ? reason(canonical.environment.reasonCode) : reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.environment.status, canonical.environment.sourceName, canonical.environment.reasonCode ? reason(canonical.environment.reasonCode) : undefined),
      infrastructure_and_access: section(roadText, canonical.infrastructure.reasonCode ? reason(canonical.infrastructure.reasonCode) : reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.infrastructure.status, canonical.infrastructure.sourceName, canonical.infrastructure.reasonCode ? reason(canonical.infrastructure.reasonCode) : undefined),
      market_and_comparables: section(valuationText, canonical.valuation.reasonCode ? reason(canonical.valuation.reasonCode) : 'Kun tomteverdi. Bygninger, konstruksjoner og andre påkostninger er ikke inkludert.', canonical.valuation.status, canonical.valuation.sourceName, canonical.valuation.reasonCode ? reason(canonical.valuation.reasonCode) : undefined),
      development_cost_outlook: section(reason('AUTHORITATIVE_DATA_REQUIRED'), checklist.map(item => item.reason).join(' '), 'REQUIRES_VERIFICATION')
    },
    evidenceRegistry, verificationChecklist: checklist, utilitiesChecklist, dataSources,
    legalDisclaimers: [
      support,
      'Denne automatiserte rapporten er kun en innledende screening og er ikke et offentlig vedtak, juridisk rådgivning eller profesjonell grunnundersøkelse.',
      'Kartverket opplyser at eiendomskartet kan være ufullstendig eller upresist; den åpne geometrien behandles derfor ikke som sertifisert juridisk grense.',
      'NGU-kart og NADAG-data beskriver kartlagte eller nærliggende forhold og erstatter ikke stedsspesifikk geoteknisk undersøkelse.',
      'NVE-flom- og skredfare samt bindende kommunale planforhold må kontrolleres i de offisielle tjenestene.',
      'En eventuell indikativ verdi gjelder kun selve tomten. Bygninger, konstruksjoner og andre påkostninger er uttrykkelig utelatt.',
      'Automatisk tomteverdi vises ikke før en tilstrekkelig dokumentert norsk land-only verdikilde er integrert.'
    ],
    valuationMethodology: valuationText,
    technicalNarrative: { groundwater_depth_m: unavailable, groundwater_notice: reason('AUTHORITATIVE_DATA_REQUIRED'), zoning_name: canonical.planning.instrumentName, max_far: unavailable, max_building_coverage_pct: unavailable, min_biologically_active_pct: unavailable, max_height_m: unavailable, utility_status: reason('AUTHORITATIVE_DATA_REQUIRED') },
    riskMatrix: [
      { category: 'Skred', level: canonical.hazards.landslide.classification ? risk(canonical.hazards.landslide.classification) : unavailable, evidence_level: canonical.hazards.landslide.status, detail: canonical.hazards.landslide.classification ? `Generell skredscreening: ${risk(canonical.hazards.landslide.classification)}. NVE må kontrolleres for offisiell aktsomhet/fare.` : 'NVE-skredfare er ikke automatisert i denne versjonen.' },
      { category: 'Seismisk risiko', level: localizedClassification(canonical.hazards.seismic.classification), evidence_level: canonical.hazards.seismic.status, detail: `Seismisk screeningsverdi: ${localizedClassification(canonical.hazards.seismic.pga)}.` },
      { category: 'Radon', level: localizedClassification(canonical.hazards.radon.classification), evidence_level: canonical.hazards.radon.status, detail: canonical.hazards.radon.classification ? `NGU radonaktsomhet: ${localizedClassification(canonical.hazards.radon.classification)}.` : reason(canonical.hazards.radon.reasonCode) },
      { category: 'Gruve-/bergverksforhold', level: localizedClassification(canonical.hazards.mining.classification), evidence_level: canonical.hazards.mining.status, detail: canonical.hazards.mining.classification ? `Screening av bergverksforhold: ${localizedClassification(canonical.hazards.mining.classification)}.` : reason(canonical.hazards.mining.reasonCode) }
    ],
    keyRisks: checklist.slice(0, 4).map(item => item.reason),
    opportunities: ['Kartverket og NGU gir Norge uvanlig gode åpne kilder for innledende tomtescreening.', 'NADAG gjør det mulig å se om relevante geotekniske undersøkelser finnes i nærheten uten å late som de gjelder hele tomten.']
  };
}
