import { CanonicalReport, ReportLanguage, normalizeReportLanguage } from '../reporting/canonicalReport';
import { GEOLOGICAL_INTERPRETATIONS } from './knowledgeBase';
import { GeologicalInterpretationRecord, ResolvedGeologicalInterpretation } from './types';
const normalized = (value: string | null | undefined) => (value || '').trim().toLocaleLowerCase('en-GB');
const rank = { FORMATION: 3, GROUP: 2, LITHOLOGY: 1 } as const;
export function resolveGeologicalInterpretation(geology: CanonicalReport['geology'], records = GEOLOGICAL_INTERPRETATIONS): ResolvedGeologicalInterpretation | null {
  const identities = [geology.unitName, geology.lithology].filter((value): value is string => Boolean(value));
  const matches = records.flatMap(record => identities.flatMap(identity => [record.geologicalIdentity,...record.aliases].some(alias=>normalized(alias)===normalized(identity)) ? [{record,matchedGeologicalIdentity:identity,matchLevel:record.matchLevel}] : [])).sort((a,b)=>rank[b.matchLevel]-rank[a.matchLevel]);
  return matches[0] || null;
}
export function renderGeologicalInterpretation(resolved: ResolvedGeologicalInterpretation, requestedLanguage: string) {
  const language: ReportLanguage = normalizeReportLanguage(requestedLanguage); const claims = Object.values(resolved.record.interpretation).map(claim=>claim?.[language]).filter((claim):claim is string=>Boolean(claim));
  const intro = language==='pl' ? `Lokalizacja jest kartowana w obrębie jednostki ${resolved.matchedGeologicalIdentity}.` : language==='de' ? `Der Standort ist in der Einheit ${resolved.matchedGeologicalIdentity} kartiert.` : `The site is mapped within ${resolved.matchedGeologicalIdentity}.`;
  const disclaimer = language==='pl' ? 'Jest to regionalna interpretacja oparta na publikacji, a nie wniosek geotechniczny dla konkretnej lokalizacji.' : language==='de' ? 'Dies ist eine veröffentlichte regionale Interpretation und keine standortbezogene geotechnische Schlussfolgerung.' : 'This is published regional interpretation, not a site-specific geotechnical conclusion.';
  return { evidenceType: resolved.record.evidenceType, matchedGeologicalIdentity: resolved.matchedGeologicalIdentity, matchLevel: resolved.matchLevel, summary: [intro,...claims].join(' '), disclaimer, siteSpecific: false, source: {...resolved.record.source} };
}
export function resolvePublicationUrl(publicationIdentity:string, currentUrls:Record<string,string>, records=GEOLOGICAL_INTERPRETATIONS){ return currentUrls[publicationIdentity] || records.find(record=>record.source.publicationIdentity===publicationIdentity)?.source.url || null; }
