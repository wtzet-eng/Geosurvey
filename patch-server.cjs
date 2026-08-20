const fs = require('fs');

const file = 'server.ts';
let source = fs.readFileSync(file, 'utf8');

const enrichMarker = 'function enrichGeologyFromPgi(report: any, pgiEvidence: any[]) {';
if (!source.includes(enrichMarker)) throw new Error('Expected geology enrichment function not found');
if (!source.includes('report.geosurvey_context = report.geosurvey_context || {};')) {
  source = source.replace(enrichMarker, `${enrichMarker}\n  // External geology evidence is optional; never let missing context crash report generation.\n  report.geosurvey_context = report.geosurvey_context || {};`);
}

// Match the report-assembly stage independently of the following statement layout.
// server.ts may format these statements on separate lines, so the patch must not depend on whitespace.
const assemblyMarker = "stage = 'report-assembly';";
if (!source.includes(assemblyMarker)) throw new Error('Expected report assembly stage marker not found');
if (!source.includes('const reportContext = evidenceReport.geosurvey_context || {}')) {
  source = source.replace(assemblyMarker, `${assemblyMarker} const reportContext = evidenceReport.geosurvey_context || { geological_unit_name: evidenceReport.soil?.geologicalUnit, lithology_type: evidenceReport.soil?.lithologyType, geological_period_era: evidenceReport.soil?.stratigraphicPeriod, evidence_level: evidenceReport.soil?.status };`);
}

source = source
  .replaceAll('evidenceReport.geosurvey_context.geological_unit_name', 'reportContext.geological_unit_name')
  .replaceAll('evidenceReport.geosurvey_context.lithology_type', 'reportContext.lithology_type')
  .replaceAll('evidenceReport.geosurvey_context.geological_period_era', 'reportContext.geological_period_era')
  .replaceAll('evidenceReport.geosurvey_context.evidence_level', 'reportContext.evidence_level');

// Never expose the generic Germany fallback for UK.
source = source.replace(
  "let geologicalUnitName = `${cProfile.countryName} Regional Sedimentary Province`;",
  "let geologicalUnitName = countryCode === 'GB' ? 'BGS geological unit not resolved from the returned DiGMapGB feature' : `${cProfile.countryName} Regional Sedimentary Province`;"
);

// Pass the selected report language into the UK checklist generator.
source = source.replace(
  'getUKVerificationChecklist(municipality, stateName)',
  'getUKVerificationChecklist(municipality, stateName, language)'
);

// Country + language aware source labels.
const sourceLocalizationMarker = "const assemblyMarker = \"stage = 'report-assembly';\";";
if (!source.includes('function localizeEvidenceSourceName(')) {
  const sourceLocalization = `function localizeEvidenceSourceName(name: any, countryCode: string, language: string): string {
  const raw = String(name || '').trim();
  if (!raw) return raw;
  const code = String(countryCode || '').toUpperCase();
  const lang = String(language || 'en').toLowerCase();
  const key = raw.toLowerCase();
  const dictionaries: Record<string, Record<string, string>> = {
    PL: {
      'państwowy instytut geologiczny – pib': lang === 'pl' ? 'Państwowy Instytut Geologiczny – PIB' : lang === 'de' ? 'Polnisches Staatliches Geologisches Institut – Nationales Forschungsinstitut (PIG-PIB)' : 'Polish Geological Institute – National Research Institute (PIG-PIB)',
      'państwowy instytut geologiczny - pib': lang === 'pl' ? 'Państwowy Instytut Geologiczny – PIB' : lang === 'de' ? 'Polnisches Staatliches Geologisches Institut – Nationales Forschungsinstitut (PIG-PIB)' : 'Polish Geological Institute – National Research Institute (PIG-PIB)',
      'główny urząd geodezji i kartografii (gugik / egib)': lang === 'pl' ? 'Główny Urząd Geodezji i Kartografii (GUGiK / EGiB)' : lang === 'de' ? 'Polnisches Hauptamt für Geodäsie und Kartografie (GUGiK / EGiB)' : 'Polish Head Office of Geodesy and Cartography (GUGiK / EGiB)',
      'państwowe gospodarstwo wodne wody polskie (hydroportal isok)': lang === 'pl' ? 'Państwowe Gospodarstwo Wodne Wody Polskie (Hydroportal ISOK)' : lang === 'de' ? 'Polnische Staatliche Wasserwirtschaft Wody Polskie (Hydroportal ISOK)' : 'Polish State Water Holding Wody Polskie (ISOK Hydroportal)',
      'wyższy urząd górniczy (wug) / pig-pib midas': lang === 'pl' ? 'Wyższy Urząd Górniczy (WUG) / PIG-PIB MIDAS' : lang === 'de' ? 'Polnisches Oberbergamt (WUG) / PIG-PIB MIDAS' : 'Polish State Mining Authority (WUG) / PIG-PIB MIDAS'
    },
    GB: {
      'british geological survey (bgs / geoindex 1:50 000)': lang === 'pl' ? 'Brytyjska Służba Geologiczna (BGS / GeoIndex 1:50 000)' : lang === 'de' ? 'British Geological Survey (BGS / GeoIndex 1:50.000)' : 'British Geological Survey (BGS / GeoIndex 1:50,000)',
      'hm land registry / ordnance survey (os mastermap)': lang === 'pl' ? 'Brytyjski Rejestr Gruntów (HM Land Registry) / Ordnance Survey (OS MasterMap)' : lang === 'de' ? 'Britisches Grundbuchamt (HM Land Registry) / Ordnance Survey (OS MasterMap)' : 'HM Land Registry / Ordnance Survey (OS MasterMap)',
      'environment agency / natural resources wales (flood map for planning)': lang === 'pl' ? 'Environment Agency / Natural Resources Wales (mapy zagrożenia powodziowego)' : lang === 'de' ? 'Environment Agency / Natural Resources Wales (Hochwasser-Gefahrenkarten)' : 'Environment Agency / Natural Resources Wales (Flood Map for Planning)',
      'coal authority': lang === 'pl' ? 'Brytyjski Urząd Górniczy (Coal Authority)' : lang === 'de' ? 'Britische Bergbaubehörde (Coal Authority)' : 'Coal Authority',
      'historic england / local historic environment record': lang === 'pl' ? 'Historic England / lokalny rejestr dziedzictwa historycznego' : lang === 'de' ? 'Historic England / lokales Denkmal- und Umweltregister' : 'Historic England / local Historic Environment Record'
    }
  };
  const dict = dictionaries[code];
  if (dict?.[key]) return dict[key];
  const looksPolish = /państwowy instytut geologiczny|główny urząd geodezji|wody polskie|wyższy urząd górniczy|pgi-pib|gugik|wug/i.test(raw);
  if (code !== 'PL' && looksPolish) {
    return lang === 'de' ? 'Nationale Fachbehörde / Geologischer Dienst' : lang === 'pl' ? 'Krajowy urząd / służba geologiczna' : 'National authority / geological survey';
  }
  return raw;
}

function localizeEvidenceSourceFields(reportData: any, countryCode: string, language: string): any {
  if (!reportData || typeof reportData !== 'object') return reportData;
  const out = { ...reportData };
  if (Array.isArray(out.evidence_registry)) {
    out.evidence_registry = out.evidence_registry.map((item: any) => ({ ...item, sourceName: localizeEvidenceSourceName(item?.sourceName, countryCode, language) }));
  }
  if (Array.isArray(out.data_sources)) {
    out.data_sources = out.data_sources.map((item: any) => ({ ...item, name: localizeEvidenceSourceName(item?.name, countryCode, language), authority: localizeEvidenceSourceName(item?.authority, countryCode, language) }));
  }
  if (out.geosurvey_context?.survey_authority) {
    out.geosurvey_context = { ...out.geosurvey_context, survey_authority: localizeEvidenceSourceName(out.geosurvey_context.survey_authority, countryCode, language) };
  }
  if (out.soil_metrics?.source_name) {
    out.soil_metrics = { ...out.soil_metrics, source_name: localizeEvidenceSourceName(out.soil_metrics.source_name, countryCode, language) };
  }
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && value.source_cited) {
      out[key] = { ...value, source_cited: localizeEvidenceSourceName(value.source_cited, countryCode, language) };
    }
  }
  return out;
}
`;
  source = source.replace(sourceLocalizationMarker, `${sourceLocalizationMarker}\n${sourceLocalization}`);
}

// Replace the legacy Polish verification checklist with language-safe source code.
const checklistStart = 'const verificationChecklist: VerificationRequirement[] = [';
const checklistEnd = '  // =========================================================================\n  // 10. Executive Summary & Statutory Disclaimers';
if (source.includes(checklistStart) && source.includes(checklistEnd)) {
  const localizedChecklist = `const verificationChecklist: VerificationRequirement[] = language === 'pl' ? [
    {
      topic: 'Oficjalne ustalenia planistyczne (MPZP lub decyzja o warunkach zabudowy)',
      reason: 'Wiążące przeznaczenie terenu, parametry zabudowy, wysokość budynku, intensywność zabudowy, powierzchnia biologicznie czynna oraz wymagania dotyczące dachu i dostępu należy potwierdzić w aktualnych dokumentach planistycznych przed zleceniem projektu.',
      recommendedAuthorityOrExpert: String(municipality || 'Gmina właściwa miejscowo') + ' — właściwy urząd gminy/miasta, wydział planowania przestrzennego i architektury',
      priority: 'High'
    },
    {
      topic: 'Badanie geotechniczne i opinia geotechniczna',
      reason: 'Dane SoilGrids wskazują modelowany profil gruntu (' + String(soilGridsData?.usdaTextureClass || 'nieokreślony') + '). Parametry nośności, warstwy gruntu i poziom wód gruntowych należy potwierdzić badaniami terenowymi, odwiertami lub sondowaniami oraz właściwą opinią geotechniczną zgodnie z Eurokodem 7.',
      recommendedAuthorityOrExpert: 'Uprawniony geolog / geotechnik lub projektant posiadający właściwe kwalifikacje',
      priority: 'High'
    },
    {
      topic: 'Mapa do celów projektowych i pomiar geodezyjny',
      reason: 'Przed szczegółowym projektem należy potwierdzić granice działki, rzędne terenu, istniejące obiekty, uzbrojenie oraz dostęp. Obrys z analizy przestrzennej nie zastępuje pomiaru geodezyjnego.',
      recommendedAuthorityOrExpert: 'Uprawniony geodeta',
      priority: 'High'
    },
    {
      topic: 'Warunki przyłączenia mediów',
      reason: 'Należy formalnie potwierdzić możliwość i parametry przyłączenia energii elektrycznej, wody, kanalizacji, gazu i innych mediów. Obecność sieci na mapie nie potwierdza dostępnej przepustowości.',
      recommendedAuthorityOrExpert: 'Właściwi operatorzy sieci i przedsiębiorstwa wodociągowo-kanalizacyjne',
      priority: 'Medium'
    },
    {
      topic: 'Weryfikacja księgi wieczystej i praw do nieruchomości',
      reason: 'Przed nabyciem lub zabudową należy sprawdzić własność, służebności, hipoteki, prawa przejazdu, ograniczenia i inne obciążenia ujawnione w księdze wieczystej oraz dokumentach powiązanych.',
      recommendedAuthorityOrExpert: 'Właściwy sąd rejonowy — wydział ksiąg wieczystych / notariusz / radca prawny lub adwokat',
      priority: 'High'
    }
  ] : [
    {
      topic: 'Official Planning Certificate',
      reason: 'Binding building height, maximum building coverage ratio, floor area ratio (FAR), and allowed roof geometries must be legally verified before architectural commission.',
      recommendedAuthorityOrExpert: 'Local planning authority / municipal planning and architecture department',
      priority: 'High'
    },
    {
      topic: 'Geotechnical Site Investigation',
      reason: 'ISRIC SoilGrids data indicates the modelled subsoil. Exact allowable bearing capacity, layer boundaries, and seasonal water table depth must be determined through on-site investigation.',
      recommendedAuthorityOrExpert: 'Licensed Geotechnical Engineer / Geologist',
      priority: 'High'
    },
    {
      topic: 'Topographical Survey for Design',
      reason: 'Confirm exact boundary markers, ground levels, structures and utilities before detailed design.',
      recommendedAuthorityOrExpert: 'Licensed Land Surveyor',
      priority: 'High'
    },
    {
      topic: 'Utility Connection Terms',
      reason: 'Formal confirmation of grid capacity, connection locations and technical requirements is required from the relevant operators.',
      recommendedAuthorityOrExpert: 'Regional utility operators',
      priority: 'Medium'
    },
    {
      topic: 'Land and Mortgage Register Verification',
      reason: 'Verify ownership, easements, mortgages and third-party rights before acquisition or development.',
      recommendedAuthorityOrExpert: 'Land Registry / Notary Public / Property Solicitor',
      priority: 'High'
    }
  ];\n\n`;
  const start = source.indexOf(checklistStart);
  const end = source.indexOf(checklistEnd, start);
  if (start >= 0 && end > start) source = source.slice(0, start) + localizedChecklist + source.slice(end);
}

// Apply source-name localization immediately before the final report is returned.
const finalReportMarker = 'const finalReport = {';
if (source.includes(finalReportMarker) && !source.includes('localizeEvidenceSourceFields(reportData, countryCode, language)')) {
  source = source.replace(
    finalReportMarker,
    `const localizedReportData = localizeEvidenceSourceFields(reportData, countryCode, language);\n    ${finalReportMarker}`
  );
  source = source.replace('report_data: reportData };', 'report_data: localizedReportData };');
}

fs.writeFileSync(file, source);
console.log('Applied resilient geology, UK language, checklist, and country/language source-label isolation patches to server.ts');
