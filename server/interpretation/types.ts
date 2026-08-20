import { ReportLanguage } from '../reporting/canonicalReport';
export type InterpretationEvidenceType = 'PUBLISHED_REGIONAL_INTERPRETATION';
export type InterpretationMatchLevel = 'FORMATION' | 'GROUP' | 'LITHOLOGY';
export type LocalizedClaim = Record<ReportLanguage, string>;
export interface GeologicalPublication { publicationIdentity: string; title: string; publisher: string; publicationId: string; url: string; year?: number; doi?: string; isbn?: string; }
export interface GeologicalInterpretationRecord {
  geologicalIdentity: string;
  aliases: string[];
  matchLevel: InterpretationMatchLevel;
  interpretation: Partial<Record<'typicalMaterial'|'weatheringBehaviour'|'variability'|'permeabilityContext'|'shrinkSwellContext'|'excavationContext'|'foundationContext'|'groundwaterContext'|'investigationPriority', LocalizedClaim>>;
  evidenceType: InterpretationEvidenceType;
  source: GeologicalPublication;
  siteSpecific: false;
}
export interface ResolvedGeologicalInterpretation { record: GeologicalInterpretationRecord; matchedGeologicalIdentity: string; matchLevel: InterpretationMatchLevel; }
