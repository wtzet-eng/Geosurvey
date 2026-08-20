import { CanonicalReport, ReportLanguage, normalizeReportLanguage } from '../reporting/canonicalReport';
import { GEOLOGICAL_INTERPRETATIONS } from './knowledgeBase';
import { GeologicalInterpretationRecord, ResolvedGeologicalInterpretation } from './types';

const normalized = (value: string | null | undefined) => (value || '').trim().toLocaleLowerCase('en-GB');
const rank = { FORMATION: 3, GROUP: 2, LITHOLOGY: 1 } as const;
const prohibitedClaimPatterns = [
  /\b(?:allowable|design|safe)\s+bearing capacity\b/i,
  /\bfriction angle\b/i,
  /\bcohesion\b/i,
  /\bsettlement(?:\s+magnitude)?\b/i,
  /\b(?:measured|design|parcel-specific)\s+(?:groundwater|water table)/i,
  /\b(?:recommend(?:ed|ation)?|select(?:ed|ion)?)\s+(?:a\s+)?foundation\b/i
];

export function validateInterpretationRecord(record: GeologicalInterpretationRecord): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (record.evidenceType !== 'PUBLISHED_REGIONAL_INTERPRETATION') reasons.push('unsupported evidence type');
  if (record.siteSpecific !== false) reasons.push('interpretation must not be site specific');
  if (!record.source.publicationIdentity || !record.source.publicationId || !record.source.title || !record.source.publisher || !record.source.url) reasons.push('incomplete citation identity');
  for (const localized of Object.values(record.interpretation)) {
    if (!localized) continue;
    for (const claim of Object.values(localized)) if (prohibitedClaimPatterns.some(pattern => pattern.test(claim))) reasons.push(`prohibited engineering claim: ${claim}`);
  }
  return { valid: reasons.length === 0, reasons };
}

export function resolveGeologicalInterpretation(geology: CanonicalReport['geology'], records = GEOLOGICAL_INTERPRETATIONS): ResolvedGeologicalInterpretation | null {
  const matches = records
    .filter(record => validateInterpretationRecord(record).valid)
    .flatMap(record => {
      const identity = record.matchLevel === 'LITHOLOGY' ? geology.lithology : geology.unitName;
      if (!identity) return [];
      const matched = [record.geologicalIdentity, ...record.aliases].some(alias => normalized(alias) === normalized(identity));
      return matched ? [{ record, matchedGeologicalIdentity: identity, matchLevel: record.matchLevel }] : [];
    })
    .sort((a, b) => rank[b.matchLevel] - rank[a.matchLevel]);
  return matches[0] || null;
}

export function renderGeologicalInterpretation(resolved: ResolvedGeologicalInterpretation, requestedLanguage: string) {
  const validation = validateInterpretationRecord(resolved.record);
  if (!validation.valid) throw new Error(`Unsafe geological interpretation record: ${validation.reasons.join('; ')}`);
  const language: ReportLanguage = normalizeReportLanguage(requestedLanguage);
  const claims = Object.values(resolved.record.interpretation).map(claim => claim?.[language]).filter((claim): claim is string => Boolean(claim));
  const intro = language === 'pl' ? `Lokalizacja jest kartowana w obrębie jednostki ${resolved.matchedGeologicalIdentity}.` : language === 'de' ? `Der Standort ist in der Einheit ${resolved.matchedGeologicalIdentity} kartiert.` : `The site is mapped within ${resolved.matchedGeologicalIdentity}.`;
  const disclaimer = language === 'pl' ? 'Jest to regionalna interpretacja oparta na publikacji, a nie wniosek geotechniczny dla konkretnej lokalizacji.' : language === 'de' ? 'Dies ist eine veröffentlichte regionale Interpretation und keine standortbezogene geotechnische Schlussfolgerung.' : 'This is published regional interpretation, not a site-specific geotechnical conclusion.';
  return { evidenceType: resolved.record.evidenceType, matchedGeologicalIdentity: resolved.matchedGeologicalIdentity, matchLevel: resolved.matchLevel, summary: [intro, ...claims].join(' '), disclaimer, siteSpecific: false, source: { ...resolved.record.source } };
}

export function resolvePublicationUrl(publicationIdentity: string, currentUrls: Record<string, string>, records = GEOLOGICAL_INTERPRETATIONS) {
  return currentUrls[publicationIdentity] || records.find(record => record.source.publicationIdentity === publicationIdentity)?.source.url || null;
}
