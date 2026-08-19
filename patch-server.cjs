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

fs.writeFileSync(file, source);
console.log('Applied resilient geology/report-assembly patch to server.ts');
