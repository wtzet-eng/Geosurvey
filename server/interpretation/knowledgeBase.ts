import { GeologicalInterpretationRecord } from './types';
export const GEOLOGICAL_INTERPRETATIONS: GeologicalInterpretationRecord[] = [{
  geologicalIdentity: 'Mercia Mudstone Group', aliases: ['Mercia Mudstone', 'MMG'], matchLevel: 'GROUP', evidenceType: 'PUBLISHED_REGIONAL_INTERPRETATION', siteSpecific: false,
  interpretation: {
    typicalMaterial: { en: 'Published regional literature describes the unit as predominantly mudstone, with subordinate siltstone and sandstone.', de: 'Die veröffentlichte regionale Fachliteratur beschreibt die Einheit überwiegend als Tonstein mit untergeordnetem Schluff- und Sandstein.', pl: 'Opublikowana literatura regionalna opisuje jednostkę jako zbudowaną głównie z iłowców, z podrzędnymi mułowcami i piaskowcami.' },
    weatheringBehaviour: { en: 'Engineering behaviour is strongly influenced by weathering and local lithological variation.', de: 'Das ingenieurgeologische Verhalten wird stark durch Verwitterung und lokale lithologische Unterschiede beeinflusst.', pl: 'Na zachowanie inżyniersko-geologiczne silnie wpływają wietrzenie i lokalna zmienność litologiczna.' },
    investigationPriority: { en: 'Confirm weathering grade, lithological variation and groundwater conditions through a site-specific ground investigation.', de: 'Verwitterungsgrad, lithologische Unterschiede und Grundwasserverhältnisse sind durch eine standortbezogene Baugrunduntersuchung zu bestätigen.', pl: 'Stopień zwietrzenia, zmienność litologiczną i warunki wodne należy potwierdzić w badaniach podłoża dla konkretnej lokalizacji.' }
  },
  source: { publicationIdentity: 'BGS_RR_01_02', title: 'Engineering geology of British rocks and soils — Mudstones of the Mercia Mudstone Group', publisher: 'British Geological Survey', publicationId: 'RR/01/02', url: 'https://www.bgs.ac.uk/geological-research/bgs-publications/', year: 2002 }
}];
