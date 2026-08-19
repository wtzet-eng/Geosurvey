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

fs.writeFileSync(file, source);
console.log('Applied resilient geology, UK fallback, and localized checklist patch to server.ts');
