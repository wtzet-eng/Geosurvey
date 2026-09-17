import { AvailabilityReason, CanonicalReport, RiskClassification } from './canonicalReport';

const reasonCopy: Record<AvailabilityReason, string> = {
  NO_DATA: 'Kilden blev forespurgt uden teknisk fejl, men returnerede ingen registreret træffer for stedet. Det er ikke dokumentation for, at forholdet ikke findes.',
  SOURCE_UNAVAILABLE: 'Kilden var midlertidigt utilgængelig eller kunne ikke nås. Oplysningen skal verificeres.',
  MALFORMED_DATA: 'Kilden svarede, men datastrukturen kunne ikke valideres sikkert. Der er ikke udledt en værdi.',
  PARAMETER_NOT_PROVIDED: 'Denne parameter leveres ikke af den anvendte datakilde.',
  INSUFFICIENT_EVIDENCE: 'Det tilgængelige datagrundlag er ikke tilstrækkeligt til at udlede værdien pålideligt.',
  NOT_SUPPORTED_FOR_COUNTRY: 'Denne nationale datakilde er endnu ikke automatiseret for det valgte land. Kontrollér den relevante officielle tjeneste.',
  AUTHORITATIVE_DATA_REQUIRED: 'Oplysningen skal bekræftes i en autoritativ kilde eller af den kompetente myndighed/fagperson.'
};

const statusLabel = { VERIFIED: 'Verificeret', MODELLED: 'Modelleret', REQUIRES_VERIFICATION: 'Skal verificeres' } as const;
const confidenceLabel = { High: 'Høj', Medium: 'Middel', Low: 'Lav' } as const;
const utilityNames = { ELECTRICITY: 'El', WATER: 'Vand', SEWER: 'Kloak', GAS: 'Gas', TELECOM: 'Telekommunikation', OTHER: 'Teknisk forsyning' } as const;
const riskLabel: Record<Exclude<RiskClassification, null>, string> = { NEGLIGIBLE: 'Ubetydelig', LOW: 'Lav', MODERATE: 'Moderat', HIGH: 'Høj' };

const reason = (code?: AvailabilityReason) => reasonCopy[code || 'AUTHORITATIVE_DATA_REQUIRED'];
const shown = (value: unknown, fallback = 'ikke tilgængelig') => value === null || value === undefined || value === '' ? fallback : String(value);
const risk = (value: RiskClassification) => value ? riskLabel[value] : 'ikke tilgængelig';
const str = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
const num = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

function localizedClassification(value: string | null): string {
  if (!value) return 'ikke tilgængelig';
  return value.replace(/Low to Very Low/gi, 'lav til meget lav').replace(/Moderate/gi, 'moderat').replace(/High/gi, 'høj').replace(/Low/gi, 'lav');
}

function supportNotice(): string {
  return 'For Danmark anvender LandSurf udvalgte nationale kilder fra Datafordeleren/Matriklen, GEUS Jupiter, Danmarks Digitale Jordartskort og Plandata.dk. Oversvømmelse, radon, råstof-/mineforhold og automatisk jordværdi kræver fortsat særskilt officiel kontrol.';
}

function denmarkGroundNarrative(canonical: CanonicalReport): string[] {
  const parts: string[] = [];
  const surface = canonical.evidenceRecords.find(record => record.id === 'dk-geus-surface-geology' && record.status === 'VERIFIED');
  const boreholes = canonical.evidenceRecords.find(record => record.id === 'dk-jupiter-boreholes' && record.status === 'VERIFIED');
  const groundwater = canonical.evidenceRecords.find(record => record.id === 'dk-jupiter-groundwater' && record.status === 'VERIFIED');
  const planning = canonical.evidenceRecords.find(record => record.id === 'dk-plandata-localplan' && record.status === 'VERIFIED');
  const cadastre = canonical.evidenceRecords.find(record => record.id === 'dk-datafordeler-cadastre' && record.status === 'VERIFIED');

  if (surface) {
    const v = (surface.value || {}) as Record<string, unknown>;
    parts.push(`GEUS Jordartskort: ${str(v.deposit) || str(v.code) || 'kortlagt jordart'}${str(v.scale) ? `; målestok ${str(v.scale)}` : ''}.`);
  }
  if (boreholes) {
    const v = (boreholes.value || {}) as Record<string, unknown>;
    parts.push(`Jupiter: ${num(v.count) ?? 0} boringer blev returneret i søgeområdet${num(v.nearestDistanceM) !== null ? `; nærmeste returnerede boring ligger ca. ${Math.round(num(v.nearestDistanceM)!)} m fra stedet` : ''}.`);
  }
  if (groundwater) {
    const v = (groundwater.value || {}) as Record<string, unknown>;
    parts.push(`Jupiter grundvand: ${num(v.count) ?? 0} registreringer med seneste pejling blev returneret${num(v.nearestDistanceM) !== null ? `; nærmeste registrering ligger ca. ${Math.round(num(v.nearestDistanceM)!)} m fra stedet` : ''}.`);
  }
  if (planning) {
    const v = (planning.value || {}) as Record<string, any>;
    const first = Array.isArray(v.plans) ? v.plans[0] : null;
    parts.push(`Plandata.dk: vedtaget lokalplan registreret ved stedet${first?.name ? ` — ${first.name}` : first?.planNumber ? ` — ${first.planNumber}` : ''}.`);
  }
  if (cadastre) {
    const v = (cadastre.value || {}) as Record<string, unknown>;
    parts.push(`Datafordeleren/Matriklen: ${str(v.parcelId) || 'jordstykke identificeret'}${num(v.registeredAreaM2) !== null ? `; registreret areal ${num(v.registeredAreaM2)} m²` : ''}.`);
  }
  if (parts.length) parts.push('Kortdata, naboboringer og pejlinger er screeningsgrundlag. De dokumenterer ikke jordlag, bæreevne, sætninger eller grundvand på hele den valgte grund og erstatter ikke en stedsspecifik geoteknisk undersøgelse.');
  return parts;
}

function localizedEvidenceRecord(record: any): any {
  const code = (record.value as { reasonCode?: AvailabilityReason } | null)?.reasonCode;
  const names: Record<string, string> = {
    'dk-datafordeler-cadastre': 'Datafordeleren/Matriklen — matrikel og jordstykke',
    'dk-datafordeler-cadastre-unavailable': 'Datafordeleren/Matriklen — matrikel og jordstykke',
    'dk-geus-surface-geology': 'GEUS — Jordartskort 1:25.000',
    'dk-geus-surface-geology-unavailable': 'GEUS — Jordartskort 1:25.000',
    'dk-geus-surface-geology-no-data': 'GEUS — Jordartskort 1:25.000',
    'dk-jupiter-boreholes': 'GEUS Jupiter — boringer',
    'dk-jupiter-boreholes-unavailable': 'GEUS Jupiter — boringer',
    'dk-jupiter-boreholes-no-data': 'GEUS Jupiter — boringer',
    'dk-jupiter-groundwater': 'GEUS Jupiter — grundvandspejlinger',
    'dk-jupiter-groundwater-unavailable': 'GEUS Jupiter — grundvandspejlinger',
    'dk-jupiter-groundwater-no-data': 'GEUS Jupiter — grundvandspejlinger',
    'dk-plandata-localplan': 'Plandata.dk — vedtaget lokalplan',
    'dk-plandata-localplan-unavailable': 'Plandata.dk — vedtaget lokalplan',
    'dk-plandata-localplan-no-data': 'Plandata.dk — vedtaget lokalplan'
  };
  const isDanish = Boolean(names[record.id]);
  return {
    ...record,
    category: names[record.id] || (record.id.startsWith('country-support-') ? 'Landets datadækning' : record.category || 'Datagrundlag'),
    claim: isDanish ? `${names[record.id]} indgår som stedrelateret screeningsgrundlag.` : record.id.startsWith('country-support-') ? reason('NOT_SUPPORTED_FOR_COUNTRY') : record.claim,
    spatialRelationship: isDanish ? 'Den rumlige relation til det valgte sted eller søgeområde er registreret i kildeposten.' : record.spatialRelationship,
    calculationMethod: isDanish ? 'Kildespecifik national dataforespørgsel og normalisering til LandSurfs evidensmodel.' : record.calculationMethod,
    confidence: confidenceLabel[record.confidence as keyof typeof confidenceLabel] || record.confidence,
    limitation: record.status === 'REQUIRES_VERIFICATION' ? reason(code) : record.limitation || reason('AUTHORITATIVE_DATA_REQUIRED')
  };
}

export function renderDanishLocalizedReport(canonical: CanonicalReport): any {
  const unavailable = 'ikke tilgængelig';
  const support = supportNotice();
  const groundSpecific = denmarkGroundNarrative(canonical);
  const terrainText = canonical.terrain.elevationM === null ? 'Terrændata er ikke tilgængelige.' : `Modelleret terræn: kote ca. ${canonical.terrain.elevationM} m og hældning ${shown(canonical.terrain.slopeDegrees)}°.`;
  const soilText = `Jordmodel: tekstur ${canonical.soil.texture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}; bæreevne: ${canonical.soil.bearingCapacity || reason('INSUFFICIENT_EVIDENCE')}.`;
  const mapped: any = canonical.groundContext?.mapped || null;
  const soilVariability: any = canonical.groundContext?.soilVariability || null;
  const variabilityCode = mapped?.variabilityClass || (soilVariability?.validSampleCount >= 2 ? (soilVariability.variationObserved ? 'MODERATE' : 'LOW') : 'INSUFFICIENT_EVIDENCE');
  const variabilityLabels: Record<string, string> = { LOW: 'Lav', MODERATE: 'Moderat', HIGH: 'Høj', INSUFFICIENT_EVIDENCE: 'Utilstrækkeligt grundlag' };
  const groundContext = {
    title: 'Rumlig jord- og terrænkontekst', evidence_level: canonical.groundContext?.status || 'REQUIRES_VERIFICATION', variability_code: variabilityCode, variability_label: variabilityLabels[variabilityCode] || variabilityCode,
    summary: mapped?.sampleCount ? 'Der findes flere kort-/modelprøver omkring den valgte geometri; de beskriver rumlig kontekst, ikke en dokumenteret jordprofil.' : 'Der er ikke nok kort-/modelprøver til sikkert at beskrive rumlig variation.',
    mapped_units_label: 'Kortlagte enheder', mapped_units: mapped?.distinctMappedUnits || [], material_indicators_label: 'Materialeindikatorer', material_indicators: mapped?.materialIndicators || [], transition_indicated: Boolean(mapped?.transitionIndicated),
    sample_label: 'Kort-/modelprøver', sample_count: mapped?.sampleCount || 0, site_sample_count: mapped?.siteSampleCount || 0, parcel_sample_count: mapped?.parcelSampleCount || 0, vicinity_sample_count: mapped?.vicinitySampleCount || 0,
    soil_model_summary: soilVariability?.validSampleCount ? 'SoilGrids anvendes som modelleret pedologisk baggrund og ikke som geoteknisk projekteringsdata.' : 'Der er ikke tilstrækkelige SoilGrids-prøver til en variationsbeskrivelse.', soil_model_sample_count: soilVariability?.validSampleCount || 0,
    soil_sand_range: soilVariability?.topsoilSandPctRange || null, soil_silt_range: soilVariability?.topsoilSiltPctRange || null, soil_clay_range: soilVariability?.topsoilClayPctRange || null,
    investigation_focus: 'Verificér materialetype, lagfølge, eventuelt fyld, grundvand og geotekniske egenskaber med en stedsspecifik undersøgelse før projektering.',
    limitation: 'Kort- og modeldata er kun egnet til indledende screening. Nærliggende boringer og pejlinger dokumenterer ikke forholdene under hele grunden.',
    source_name: mapped?.sourceName || soilVariability?.sourceName || 'GEUS / SoilGrids', source_scale: mapped?.sourceScale || soilVariability?.sourceResolution || null,
    terrain_min_elevation_m: canonical.terrain.minElevationM ?? null, terrain_max_elevation_m: canonical.terrain.maxElevationM ?? null, terrain_local_relief_m: canonical.terrain.localReliefM ?? null
  };

  const valuationAvailable = canonical.valuation.min !== null && canonical.valuation.max !== null;
  const valuationText = valuationAvailable
    ? `Indikativ statistisk jordværdi: ${canonical.valuation.min!.toLocaleString('da-DK')}–${canonical.valuation.max!.toLocaleString('da-DK')} ${canonical.valuation.currency}.`
    : 'Automatisk jordværdi vises ikke, fordi LandSurf endnu ikke har integreret et tilstrækkeligt dokumenteret dansk datagrundlag, som isolerer selve jordværdien fra bygninger og andre forbedringer.';
  const planningVerified = canonical.evidenceRecords.some(record => record.id === 'dk-plandata-localplan' && record.status === 'VERIFIED');
  const cadastreVerified = canonical.evidenceRecords.some(record => record.id === 'dk-datafordeler-cadastre' && record.status === 'VERIFIED');
  const planningText = planningVerified
    ? `Plandata.dk har returneret en vedtaget lokalplan ved stedet. Det dokumenterer planens registrerede overlap, men den konkrete byggeret og alle bestemmelser skal læses i originalplanen og verificeres hos kommunen.`
    : `Planforhold skal verificeres efter ${canonical.planning.instrumentName}.`;
  const floodText = canonical.flood.classification ? `Indledende oversvømmelsesscreening: ${risk(canonical.flood.classification)}.` : 'National dansk oversvømmelsesfare er ikke automatiseret i denne version. Kontrollér de relevante officielle og kommunale risikokort.';
  const roadText = `Nærmeste kortlagte vej: ${shown(canonical.infrastructure.roadName || canonical.infrastructure.roadType)}, ca. ${shown(canonical.infrastructure.distanceM)} m fra stedet.`;
  const environmentText = canonical.environment.protectedAreaName ? `Miljøscreeningen identificerede ${canonical.environment.protectedAreaName}.` : 'Der blev ikke returneret et beskyttet område i den åbne miljøscreening for søgeområdet.';
  const section = (summary: string, detail: string, status: string, source?: string, limitation?: string) => ({ summary, detail, evidence_level: status, source_cited: source, limitation_notice: limitation });

  const checklist = [
    ['Lokalplan og byggeret', 'Læs den gældende lokalplan, kommuneplanramme og alle relevante bestemmelser; bekræft projektets konkrete byggeret hos kommunen.', canonical.planning.authorityName],
    ['Geoteknisk undersøgelse', 'Bestil en stedsspecifik geoteknisk undersøgelse; brug GEUS/Jupiter som baggrund, ikke som erstatning for boringer eller sonderinger på grunden.', canonical.authorities.geology],
    ['Matrikelgrænse og rettigheder', 'Kontrollér matrikelgrænsens retlige status, ejerskab, servitutter og hæftelser i de relevante officielle ejendomsregistre og ved behov hos en landinspektør.', canonical.authorities.cadastre],
    ['Oversvømmelse og terrænrisiko', 'Kontrollér de relevante officielle og kommunale oversvømmelses- og terrænrisikokort for stedet.', canonical.authorities.flood],
    ['Forsyning', 'Indhent formelle tilslutningsvilkår fra de relevante forsyningsselskaber.', 'Kommune / forsyningsselskaber']
  ].map(([topic, itemReason, authority], index) => ({ topic, reason: itemReason, recommendedAuthorityOrExpert: authority, priority: index < 4 ? 'High' : 'Medium' }));

  const utilitiesChecklist = (canonical.utilities || []).map(item => ({
    utility: utilityNames[item.utilityCode],
    status: item.mapped ? (item.distanceM === null ? 'Forsyningen er kortlagt i den åbne datakilde.' : `Forsyningen er kortlagt ca. ${item.distanceM} m fra stedet. Tilslutning skal bekræftes af forsyningsselskabet.`) : reason(item.reasonCode),
    evidence_level: item.status, provider_type: item.sourceName, distance_m: item.distanceM ?? undefined, mapped_in_dataset: item.mapped,
    limitation: item.mapped ? reason('AUTHORITATIVE_DATA_REQUIRED') : reason(item.reasonCode)
  }));

  const evidenceRegistry = canonical.evidenceRecords.map(localizedEvidenceRecord);
  const dataSources = canonical.sourceRecords.map(source => ({ name: source.name, url: source.url, authority: source.name, verification_status: statusLabel[source.status] }));
  const summaryCore = `Denne evidensbaserede screening gælder en grund i Danmark. ${terrainText} Jordmodel: ${canonical.soil.texture || reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED')}. Evidensscore: ${canonical.evidenceScore.totalScore}/100. ${valuationAvailable ? `Indikativ jordværdi: ${canonical.valuation.min!.toLocaleString('da-DK')}–${canonical.valuation.max!.toLocaleString('da-DK')} ${canonical.valuation.currency}.` : 'Automatisk jordværdi vises ikke, fordi et tilstrækkeligt dansk land-only datagrundlag ikke er integreret.'}`;
  const groundDetail = groundSpecific.join(' ');

  return {
    language: 'da',
    countrySupport: { maturity: canonical.support.maturity, label: 'Begrænset, men nationalt integreret dækning', notice: support, capabilities: canonical.support.capabilities },
    groundContext,
    summary: `${summaryCore} ${support}`,
    titles: { estimated_value: 'Indikativ jordværdi', confidence: 'Datagrundlagets kvalitet', executive_summary: 'Sammenfatning' },
    confidenceLabel: canonical.evidenceScore.totalScore >= 75 ? 'Høj datakvalitet' : canonical.evidenceScore.totalScore >= 50 ? 'Middel datakvalitet' : 'Foreløbigt datagrundlag',
    unavailableReasons: { geology: reason(canonical.geology.reasonCode), soilTexture: reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED'), engineeringParameter: reason('INSUFFICIENT_EVIDENCE'), groundwater: reason('AUTHORITATIVE_DATA_REQUIRED'), planning: reason(canonical.planning.reasonCode), valuation: reason(canonical.valuation.reasonCode), sourceUnavailable: reason('SOURCE_UNAVAILABLE'), noFeature: reason('NO_DATA') },
    sections: {
      soil_and_ground: section(soilText, groundDetail, groundSpecific.length ? 'VERIFIED' : canonical.soil.status, 'GEUS / Jupiter / SoilGrids', 'GEUS-kort, Jupiter-boringer og pejlinger erstatter ikke en geoteknisk undersøgelse på grunden.'),
      geohazard_risk: section('Geologisk screening er foreløbig.', 'GEUS-data giver jordarts- og borehulskontekst. Stabilitet, erosion, skråningsforhold og andre projektrelevante georisici skal vurderes særskilt, når terræn eller projekt kræver det.', 'REQUIRES_VERIFICATION', canonical.authorities.geology, reason('AUTHORITATIVE_DATA_REQUIRED')),
      flooding_risk: section(floodText, 'Kontrollér relevante nationale og kommunale oversvømmelsesdata samt planbestemmelser før køb eller projektering.', 'REQUIRES_VERIFICATION', canonical.authorities.flood, reason('AUTHORITATIVE_DATA_REQUIRED')),
      zoning_and_land_use: section(planningText, 'Plandata.dk viser registreret planoverlap. Byggefelter, anvendelse, bebyggelsesprocent, højde, afstande, dispensationer og øvrige bindende bestemmelser skal verificeres i plandokumentet og hos kommunen.', planningVerified ? 'VERIFIED' : 'REQUIRES_VERIFICATION', 'Plandata.dk', reason('AUTHORITATIVE_DATA_REQUIRED')),
      building_regulations: section(cadastreVerified ? 'Datafordelerens Matriklen-WFS identificerer jordstykket og kan levere registreret areal/registergeometri; kortgrænsen er ikke i sig selv en ny juridisk grænseafsætning.' : 'Automatisk matrikelopslag blev ikke verificeret for denne kørsel. Kontrollér Matriklen/Datafordeleren eller matriklen.dk.', 'Kontrollér ejendomsidentitet, grænsens retlige status, ejerskab, servitutter og hæftelser i de originale danske registre. Ved grænsetvivl anvendes landinspektør.', cadastreVerified ? 'VERIFIED' : 'REQUIRES_VERIFICATION', canonical.authorities.cadastre, reason('AUTHORITATIVE_DATA_REQUIRED')),
      environmental_factors: section(environmentText, canonical.environment.reasonCode ? reason(canonical.environment.reasonCode) : reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.environment.status, canonical.environment.sourceName, canonical.environment.reasonCode ? reason(canonical.environment.reasonCode) : undefined),
      infrastructure_and_access: section(roadText, canonical.infrastructure.reasonCode ? reason(canonical.infrastructure.reasonCode) : reason('AUTHORITATIVE_DATA_REQUIRED'), canonical.infrastructure.status, canonical.infrastructure.sourceName, canonical.infrastructure.reasonCode ? reason(canonical.infrastructure.reasonCode) : undefined),
      market_and_comparables: section(valuationText, 'Værdiomfanget er strengt jord/grund. Bygninger, konstruktioner og andre forbedringer er udtrykkeligt udelukket.', canonical.valuation.status, canonical.valuation.sourceName, canonical.valuation.reasonCode ? reason(canonical.valuation.reasonCode) : undefined),
      development_cost_outlook: section(reason('AUTHORITATIVE_DATA_REQUIRED'), checklist.map(item => item.reason).join(' '), 'REQUIRES_VERIFICATION')
    },
    evidenceRegistry, verificationChecklist: checklist, utilitiesChecklist, dataSources,
    legalDisclaimers: [
      support,
      'Den automatiserede rapport er kun en indledende screening og er ikke en myndighedsafgørelse, juridisk rådgivning, geoteknisk undersøgelse eller vurderingsrapport.',
      'Danmarks Digitale Jordartskort beskriver kortlagt overfladegeologi omkring kortlægningsdybden og dokumenterer ikke den konkrete lagfølge under grunden.',
      'Nærliggende Jupiter-boringer og grundvandspejlinger beskriver deres egne observationspunkter og dokumenterer ikke grundvand eller jordlag under hele den valgte grund.',
      'Datafordelerens/Matriklens registrerede geometri og areal skal ikke forveksles med en ny juridisk grænseafsætning; rettigheder og grænsetvivl kræver original registerkontrol og eventuelt landinspektør.',
      'Plandata.dk-overlap erstatter ikke læsning af den gældende lokalplan og kommunal bekræftelse af den konkrete byggeret.',
      'Et eventuelt indikativt beløb gælder kun selve jorden/grunden. Bygninger, konstruktioner og andre forbedringer er udtrykkeligt udelukket.',
      'Automatisk jordværdi vises ikke, før en tilstrækkeligt dokumenteret dansk land-only kilde er integreret.'
    ],
    valuationMethodology: valuationText,
    technicalNarrative: { groundwater_depth_m: unavailable, groundwater_notice: 'Nærliggende Jupiter-pejlinger må ikke fortolkes som grundvandstanden på den valgte grund.', zoning_name: canonical.planning.instrumentName, max_far: unavailable, max_building_coverage_pct: unavailable, min_biologically_active_pct: unavailable, max_height_m: unavailable, utility_status: reason('AUTHORITATIVE_DATA_REQUIRED') },
    riskMatrix: [
      { category: 'Skråning og stabilitet', level: canonical.hazards.landslide.classification ? risk(canonical.hazards.landslide.classification) : unavailable, evidence_level: canonical.hazards.landslide.status, detail: 'National projektrelevant stabilitetsvurdering er ikke automatiseret; stedsspecifik kontrol kan være nødvendig.' },
      { category: 'Seismisk risiko', level: localizedClassification(canonical.hazards.seismic.classification), evidence_level: canonical.hazards.seismic.status, detail: `Seismisk screening: ${localizedClassification(canonical.hazards.seismic.pga)}.` },
      { category: 'Radon', level: localizedClassification(canonical.hazards.radon.classification), evidence_level: canonical.hazards.radon.status, detail: canonical.hazards.radon.classification ? `Områdescreening: ${localizedClassification(canonical.hazards.radon.classification)}.` : reason(canonical.hazards.radon.reasonCode) },
      { category: 'Råstof- og mineforhold', level: localizedClassification(canonical.hazards.mining.classification), evidence_level: canonical.hazards.mining.status, detail: canonical.hazards.mining.classification ? `Screening: ${localizedClassification(canonical.hazards.mining.classification)}.` : reason(canonical.hazards.mining.reasonCode) }
    ],
    keyRisks: checklist.slice(0, 4).map(item => item.reason),
    opportunities: ['Danmark har stærke åbne nationale datakilder til en indledende vurdering af matrikel, jordart, boringer, grundvandsobservationer og planforhold.', 'Kilderne kan bruges sammen uden at gøre naboboringer eller kortdata til projekteringsværdier for selve grunden.']
  };
}
