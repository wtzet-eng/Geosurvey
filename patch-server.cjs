const fs = require('fs');

const file = 'server.ts';
let source = fs.readFileSync(file, 'utf8');

const enrichMarker = 'function enrichGeologyFromPgi(report: any, pgiEvidence: any[]) {';
if (!source.includes(enrichMarker)) throw new Error('Expected geology enrichment function not found');
if (!source.includes('report.geosurvey_context = report.geosurvey_context || {};')) {
  source = source.replace(enrichMarker, `${enrichMarker}\n  // External geology evidence is optional; never let missing context crash report generation.\n  report.geosurvey_context = report.geosurvey_context || {};`);
}

const assemblyMarker = "stage = 'report-assembly'; const cProfile = getCountryProfile(countryCode);";
if (!source.includes(assemblyMarker)) throw new Error('Expected report assembly marker not found');
if (!source.includes('const reportContext = evidenceReport.geosurvey_context || {}')) {
  source = source.replace(assemblyMarker, `${assemblyMarker} const reportContext = evidenceReport.geosurvey_context || { geological_unit_name: evidenceReport.soil?.geologicalUnit, lithology_type: evidenceReport.soil?.lithologyType, geological_period_era: evidenceReport.soil?.stratigraphicPeriod, evidence_level: evidenceReport.soil?.status };`);
}

source = source
  .replaceAll('evidenceReport.geosurvey_context.geological_unit_name', 'reportContext.geological_unit_name')
  .replaceAll('evidenceReport.geosurvey_context.lithology_type', 'reportContext.lithology_type')
  .replaceAll('evidenceReport.geosurvey_context.geological_period_era', 'reportContext.geological_period_era')
  .replaceAll('evidenceReport.geosurvey_context.evidence_level', 'reportContext.evidence_level');

// Never expose the generic Germany fallback for UK. If BGS cannot resolve a
// feature, show an honest UK-specific message instead of a foreign regional unit.
source = source.replace(
  "let geologicalUnitName = `${cProfile.countryName} Regional Sedimentary Province`;",
  "let geologicalUnitName = countryCode === 'GB' ? 'BGS geological unit not resolved from the returned DiGMapGB feature' : `${cProfile.countryName} Regional Sedimentary Province`;"
);

// Pass the selected report language into the UK checklist generator.
source = source.replace(
  'getUKVerificationChecklist(municipality, stateName)',
  'getUKVerificationChecklist(municipality, stateName, language)'
);

// Replace the legacy Polish verification checklist with a genuinely Polish
// version when the selected report language is Polish. Other languages retain
// the existing fallback checklist until their dedicated localization is cleaned.
const checklistStart = 'const verificationChecklist: VerificationRequirement[] = [';
const checklistEnd = '  // =========================================================================\n  // 10. Executive Summary & Statutory Disclaimers';
if (source.includes(checklistStart) && source.includes(checklistEnd)) {
  const localizedChecklist = `const verificationChecklist: VerificationRequirement[] = language === 'pl' ? [
    {
      topic: 'Oficjalne ustalenia planistyczne (MPZP lub decyzja o warunkach zabudowy)',
      reason: 'Wiążące przeznaczenie terenu, parametry zabudowy, wysokość budynku, intensywność zabudowy, powierzchnia biologicznie czynna oraz wymagania dotyczące dachu i dostępu należy potwierdzić w aktualnych dokumentach planistycznych przed zleceniem projektu.',
      recommendedAuthorityOrExpert: \\`${'${municipality || \'Gmina właściwa miejscowo\'}'} — właściwy urząd gminy/miasta, wydział planowania przestrzennego i architektury\\`,
      priority: 'High'
    },
    {
      topic: 'Badanie geotechniczne i opinia geotechniczna',
      reason: \\`Dane SoilGrids wskazują modelowany profil gruntu (${ '${soilGridsData.usdaTextureClass}' }). Parametry nośności, warstwy gruntu i poziom wód gruntowych należy potwierdzić badaniami terenowymi, odwiertami lub sondowaniami oraz właściwą opinią geotechniczną zgodnie z Eurokodem 7.\\`,
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
      topic: 'Official Planning Certificate (Wypis i Wyrys z MPZP lub Decyzja WZ)',
      reason: 'Binding building height, maximum building coverage ratio, floor area ratio (FAR), and allowed roof geometries must be legally verified before architectural commission.',
      recommendedAuthorityOrExpert: \\`${'${municipality || \'Municipal\'}'} Spatial Planning & Architecture Department (Wydział Architektury / Urbanistyki)\\`,
      priority: 'High'
    },
    {
      topic: 'Geotechnical Site Investigation (Badania Geotechniczne / Baugrunduntersuchung)',
      reason: \\`ISRIC SoilGrids data indicates ${ '${soilGridsData.usdaTextureClass}' } subsoil. Pursuant to Eurocode 7 (EN 1997-1), exact allowable bearing capacity (kPa), layer boundaries, and seasonal water table depth must be determined through on-site investigation.\\`,
      recommendedAuthorityOrExpert: 'Licensed Geotechnical Engineer / Geologist (Uprawniony Geolog / Geotechnik)',
      priority: 'High'
    },
    {
      topic: 'Topographical Survey for Design (Mapa do Celów Projektowych - MDCP)',
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
      topic: 'Land and Mortgage Register Verification (Księga Wieczysta)',
      reason: 'Verify ownership, easements, mortgages and third-party rights before acquisition or development.',
      recommendedAuthorityOrExpert: 'District Court Land Registry / Notary Public',
      priority: 'High'
    }
  ];\n\n`;
  const start = source.indexOf(checklistStart);
  const end = source.indexOf(checklistEnd, start);
  if (start >= 0 && end > start) source = source.slice(0, start) + localizedChecklist + source.slice(end);
}

fs.writeFileSync(file, source);
console.log('Applied resilient geology, UK fallback, UK language, and Polish checklist localization patches to server.ts');
