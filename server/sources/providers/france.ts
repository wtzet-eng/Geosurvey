import { SourceEndpoint } from '../sourceTypes';

const provider = 'Bureau de Recherches Géologiques et Minières (BRGM)';
const common = {
  provider,
  country: 'FR',
  coverage: 'France',
  type: 'WMS' as const,
  expectedCapabilities: ['GetCapabilities', 'GetMap', 'GetFeatureInfo'],
  expectedLayers: [],
  requiredFieldGroups: [],
  licence: 'BRGM InfoTerre open geoscience-data terms; source metadata and scale limitations apply',
  approval: 'APPROVED' as const
};

/**
 * Official BRGM InfoTerre OGC services documented at
 * https://infoterre.brgm.fr/page/geoservices-ogc.
 *
 * Layer discovery remains dynamic because BRGM publishes several detailed,
 * regional, borehole and hazard products through the same service roots.
 */
export const FRANCE_SOURCE_ENDPOINTS: SourceEndpoint[] = [
  {
    ...common,
    id: 'fr-brgm-geology-ogc',
    logicalSourceId: 'FR_BRGM_GEOLOGY',
    url: 'https://geoservices.brgm.fr/geologie',
    priority: 1,
    evidenceTier: 1,
    compatibilityGroup: 'fr-brgm-geology',
    provenance: 'BRGM InfoTerre geology OGC service: geological maps from 1:50,000 products through national-scale lithological/geological coverage'
  },
  {
    ...common,
    id: 'fr-brgm-bss-ogc',
    logicalSourceId: 'FR_BRGM_BSS',
    url: 'https://geoservices.brgm.fr/geologie',
    priority: 1,
    evidenceTier: 1,
    compatibilityGroup: 'fr-brgm-bss',
    provenance: 'BRGM Banque du Sous-Sol (BSS) borehole and underground-work records exposed through InfoTerre OGC services'
  },
  {
    ...common,
    id: 'fr-brgm-risks-ogc',
    logicalSourceId: 'FR_BRGM_RISKS',
    url: 'https://geoservices.brgm.fr/risques',
    priority: 1,
    evidenceTier: 2,
    compatibilityGroup: 'fr-brgm-ground-risks',
    provenance: 'BRGM InfoTerre natural-risk OGC service including shrink-swell clay, underground cavities, mass movements and groundwater-rise screening layers'
  }
];
