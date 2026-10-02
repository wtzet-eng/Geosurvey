import { AvailabilityReason, CanonicalReport, RiskClassification } from './canonicalReport';

const reasonCopy: Record<AvailabilityReason, string> = {
  NO_DATA: 'A forrás hibamentesen elérhető volt, de a kiválasztott helyhez nem adott vissza adatot. Ez nem bizonyítja, hogy az adott körülmény nem létezik.',
  SOURCE_UNAVAILABLE: 'A forrás átmenetileg nem volt elérhető vagy nem volt megbízhatóan lekérdezhető. Az adatot hivatalosan ellenőrizni kell.',
  MALFORMED_DATA: 'A forrás válasza nem volt biztonságosan értelmezhető. Érték nem került levezetésre.',
  PARAMETER_NOT_PROVIDED: 'Ezt a paramétert a felhasznált adatforrás nem szolgáltatja.',
  INSUFFICIENT_EVIDENCE: 'A rendelkezésre álló bizonyíték nem elegendő a megalapozott következtetéshez.',
  NOT_SUPPORTED_FOR_COUNTRY: 'Ez a nemzeti forrás még nincs automatizálva a kiválasztott országban. Ellenőrizze a hivatalos szolgáltatást.',
  AUTHORITATIVE_DATA_REQUIRED: 'Az adatot hiteles hivatalos forrásban vagy az illetékes szakhatóságnál kell megerősíteni.'
};

const statusLabel = { VERIFIED: 'Ellenőrzött', MODELLED: 'Modellezett', REQUIRES_VERIFICATION: 'Ellenőrzés szükséges' } as const;
const confidenceLabel = { High: 'Magas', Medium: 'Közepes', Low: 'Alacsony' } as const;
const riskLabel: Record<Exclude<RiskClassification, null>, string> = { NEGLIGIBLE: 'Elhanyagolható', LOW: 'Alacsony', MODERATE: 'Mérsékelt', HIGH: 'Magas' };

const shown = (v: unknown, fallback = 'nem érhető el') => v === null || v === undefined || v === '' ? fallback : String(v);
const num = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null;
const reason = (code?: AvailabilityReason) => reasonCopy[code || 'AUTHORITATIVE_DATA_REQUIRED'];
const risk = (v: RiskClassification) => v ? riskLabel[v] : 'nem érhető el';

function supportNotice(canonical: CanonicalReport): string {
  if (canonical.countryCode === 'HU') {
    return 'Magyarországon a GroundSurf jelenleg közvetlenül lekérdezi a HUGEO 1:100 000 földtani térképet és a környező fúrási adatokat. A nyilvános INSPIRE kataszteri WFS jelenleg Mesterszállás adatkészletét teszi elérhetővé, ezért országos automatikus telekazonosítást nem állítunk.';
  }
  return canonical.support.maturity === 'SUPPORTED'
    ? 'A kiválasztott kategóriákhoz nemzeti forrásintegrációk érhetők el. A többi kategóriát hivatalosan kell ellenőrizni.'
    : 'Korlátozott lefedettség: csak bizonyos nemzeti források automatizáltak. A többi kategóriát az illetékes hivatalos forrásokban kell ellenőrizni.';
}

function localizedRecord(record: any): any {
  const categories: Record<string,string> = {
    'hu-lechner-cadastre-parcel': 'Lechner – kataszteri telek',
    'hu-lechner-cadastre-no-data': 'Lechner – kataszteri lekérdezés',
    'hu-lechner-cadastre-unavailable': 'Lechner – kataszteri szolgáltatás',
    'hu-lechner-cadastre-error': 'Lechner – kataszteri szolgáltatás',
    'hu-hugeo-geology-point': 'HUGEO – földtani térkép 1:100 000',
    'hu-hugeo-geology-no-data': 'HUGEO – földtani térkép',
    'hu-hugeo-borehole-context': 'HUGEO – közeli fúrások',
    'hu-hugeo-boreholes-no-data': 'HUGEO – fúrások',
    'hu-hugeo-engineering-geology-context': 'HUGEO – alkalmazott és mérnökgeológiai háttér'
  };
  return {
    ...record,
    category: categories[record.id] || (record.id.startsWith('country-support-') ? 'Országos lefedettség' : 'Dokumentáció'),
    confidence: confidenceLabel[record.confidence as keyof typeof confidenceLabel] || record.confidence,
    limitation: record.status === 'REQUIRES_VERIFICATION'
      ? reason((record.value as { reasonCode?: AvailabilityReason } | null)?.reasonCode)
      : record.limitation || 'A kötelező érvényű vagy tervezési következtetéseket hiteles forrásban és szükség esetén helyszíni vizsgálattal kell megerősíteni.'
  };
}

export function renderHungarianLocalizedReport(canonical: CanonicalReport): any {
  const support = supportNotice(canonical);
  const geology = canonical.geology.unitName
    ? `A HUGEO földtani térkép a kiválasztott pontnál a „${canonical.geology.unitName}” megnevezést adja${canonical.geology.lithology ? `; litológia: ${canonical.geology.lithology}` : ''}.`
    : 'A kiválasztott ponthoz nem áll rendelkezésre olvasható, helyhez kötött földtani egység.';
  const ground = canonical.soil.texture
    ? `A globális talajmodell textúrája: ${canonical.soil.texture}.`
    : 'A felhasznált talajmodell nem adott megbízható talajtextúrát a helyszínhez.';
  const terrain = canonical.terrain.elevationM === null
    ? 'A domborzati lekérdezés nem adott megbízható magasságot.'
    : `A modellezett magasság ${canonical.terrain.elevationM} m, a lejtés ${shown(canonical.terrain.slopeDegrees)}°.`;
  const boreholes = canonical.evidenceRecords.find(item => item.id === 'hu-hugeo-borehole-context' && item.status === 'VERIFIED');
  const boreholeValue = (boreholes?.value || {}) as Record<string, unknown>;
  const boreholeText = boreholes
    ? `A HUGEO 3 km-es környezetében ${shown(boreholeValue.count, 'több')} fúrási rekord került visszaadásra${num(boreholeValue.nearestDistanceM) !== null ? `; a legközelebbi körülbelül ${Math.round(num(boreholeValue.nearestDistanceM) as number)} m-re van` : ''}.`
    : 'A HUGEO 3 km-es fúrási szűrése nem adott vissza értelmezhető rekordot.';
  const parcelRecord = canonical.evidenceRecords.find(item => item.id === 'hu-lechner-cadastre-parcel' && item.status === 'VERIFIED');
  const parcelText = parcelRecord
    ? parcelRecord.claim
    : 'A nyilvános magyar INSPIRE kataszteri szolgáltatásból nem állt rendelkezésre az adott ponthoz megerősített telekazonosító.';

  const section = (summary: string, detail: string, status: string, source?: string, limitation?: string) => ({
    summary, detail, evidence_level: status, source_cited: source, limitation_notice: limitation
  });

  const checklist = [
    { topic: 'Hatályos területrendezési és településrendezési szabályok', reason: 'Ellenőrizze a helyi szabályozási tervet, övezeti besorolást és a tervezett használat feltételeit az illetékes önkormányzatnál.', recommendedAuthorityOrExpert: canonical.authorities.planning, priority: 'High' },
    { topic: 'Geotechnikai talajvizsgálat', reason: 'Ellenőrizze a rétegsort, a teherbírást, a süllyedési viselkedést és a vízviszonyokat a konkrét építési célhoz igazított helyszíni vizsgálattal.', recommendedAuthorityOrExpert: canonical.authorities.geology, priority: 'High' },
    { topic: 'Víz- és árvízi viszonyok', reason: 'Ellenőrizze a hivatalos vízügyi és árvízi térképeket, különösen mélyfekvésű vagy vízfolyás közeli területen.', recommendedAuthorityOrExpert: canonical.authorities.flood, priority: 'High' },
    { topic: 'Telekhatár és jogi helyzet', reason: 'A helyrajzi azonosítót, tulajdont, terheket, szolgalmakat és jogilag hiteles határt a megfelelő ingatlan-nyilvántartási forrásban kell megerősíteni.', recommendedAuthorityOrExpert: canonical.authorities.cadastre, priority: 'High' },
    { topic: 'Közmű- és megközelítési feltételek', reason: 'A térképen látható hálózat nem igazolja automatikusan a csatlakozás lehetőségét, kapacitását vagy költségét; kérjen hivatalos feltételeket.', recommendedAuthorityOrExpert: 'Illetékes közműszolgáltatók', priority: 'Medium' }
  ];

  const dataSources = canonical.sourceRecords.map(source => ({
    name: source.name,
    url: source.url,
    authority: source.name,
    verification_status: statusLabel[source.status]
  }));

  return {
    language: 'hu',
    countrySupport: {
      maturity: canonical.support.maturity,
      label: 'Korlátozott, nemzeti forrásokkal',
      notice: support,
      capabilities: canonical.support.capabilities
    },
    summary: `${geology} ${terrain} ${ground} ${boreholeText} ${support}`,
    titles: {
      estimated_value: 'Indikatív telekérték',
      confidence: 'Bizonyítéki minőség',
      executive_summary: 'Összefoglaló'
    },
    confidenceLabel: canonical.evidenceScore.totalScore >= 75 ? 'Magas bizonyítéki minőség' : canonical.evidenceScore.totalScore >= 50 ? 'Közepes bizonyítéki minőség' : 'Előzetes bizonyítéki minőség',
    unavailableReasons: {
      geology: reason(canonical.geology.reasonCode),
      soilTexture: reason(canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED'),
      engineeringParameter: reason('INSUFFICIENT_EVIDENCE'),
      groundwater: reason('AUTHORITATIVE_DATA_REQUIRED'),
      planning: reason(canonical.planning.reasonCode),
      valuation: reason(canonical.valuation.reasonCode),
      sourceUnavailable: reason('SOURCE_UNAVAILABLE'),
      noFeature: reason('NO_DATA')
    },
    sections: {
      soil_and_ground: section(ground, `${terrain} ${boreholeText} A közeli fúrások és a regionális térkép segítik a további vizsgálat megtervezését, de nem helyettesítik a konkrét építési helyszín geotechnikai feltárását.`, canonical.geology.status, canonical.geology.sourceName, 'A térképi földtani információ és a közeli fúrások környezeti háttérként szolgálnak; a tervezéshez helyszíni vizsgálat szükséges.'),
      geohazard_risk: section(geology, `A kiválasztott helyszínnél a domborzat és a földtani háttér további ellenőrzést indokolhat. A kockázat fennállását vagy építési alkalmasságot ez önmagában nem állapítja meg. Láthatóan nincs automatizált országos magyar veszélytérkép-eredmény ebben a verzióban.`, canonical.hazards.landslide.status, canonical.geology.sourceName),
      flooding_risk: section(canonical.flood.classification ? `Az előzetes árvízi osztályozás: ${risk(canonical.flood.classification)}.` : 'Az országos hivatalos árvízi eredmény nem automatizált ebben a verzióban.', 'A hivatalos vízügyi és árvízi térképeket, valamint a helyi vízviszonyokat a döntés előtt ellenőrizni kell.', 'REQUIRES_VERIFICATION', canonical.authorities.flood, reason('AUTHORITATIVE_DATA_REQUIRED')),
      zoning_and_land_use: section('A hatályos területhasználatot és beépíthetőséget hivatalos helyi terv alapján kell megerősíteni.', `A jelenlegi tervezési helyzetet a(z) ${canonical.planning.instrumentName} alapján kell ellenőrizni.`, canonical.planning.status, canonical.planning.sourceName, reason(canonical.planning.reasonCode)),
      building_regulations: section(parcelText, `A nyilvános kataszteri WFS jelenlegi hozzáférése nem országos; Mesterszállás adatkészletére korlátozódik. A helyrajzi szám és a jogi telekhatár más hivatalos ingatlan-nyilvántartási forrásban ellenőrizendő.`, parcelRecord ? 'VERIFIED' : 'REQUIRES_VERIFICATION', canonical.authorities.cadastre, 'A kataszteri térképi geometria nem igazolja automatikusan a tulajdonjogot, szolgalmakat vagy jogilag hiteles telekhatárt.'),
      environmental_factors: section('A környezeti és védettségi helyzetet a hivatalos nemzeti vagy helyi nyilvántartásban kell ellenőrizni.', reason(canonical.environment.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED'), canonical.environment.status, canonical.environment.sourceName),
      infrastructure_and_access: section(canonical.infrastructure.roadName ? `A legközelebbi térképi út: ${canonical.infrastructure.roadName}, körülbelül ${shown(canonical.infrastructure.distanceM)} m-re.` : 'A közúti kapcsolatra vonatkozó részletes adat nem érhető el.', 'A térképi jelenlét nem igazolja a jogi útkapcsolatot vagy a közműcsatlakozás műszaki feltételeit.', canonical.infrastructure.status, canonical.infrastructure.sourceName),
      market_and_comparables: section(canonical.valuation.min !== null && canonical.valuation.max !== null ? `Az indikatív tartomány ${canonical.valuation.min.toLocaleString('hu-HU')}–${canonical.valuation.max.toLocaleString('hu-HU')} ${canonical.valuation.currency}.` : 'A magyar telekérték automatizált, kellően dokumentált forrásból nem állapítható meg ebben a verzióban.', reason(canonical.valuation.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED'), canonical.valuation.status, canonical.valuation.sourceName),
      development_cost_outlook: section('A fejlesztési költségek és a tényleges beépíthetőség helyszíni és hatósági ellenőrzést igényel.', checklist.map(item => item.reason).join(' '), 'REQUIRES_VERIFICATION')
    },
    evidenceRegistry: canonical.evidenceRecords.map(localizedRecord),
    verificationChecklist: checklist,
    dataSources,
    legalDisclaimers: [
      support,
      'Ez az automatizált jelentés kizárólag előzetes átvilágítás. Nem hatósági igazolás, jogi vélemény, értékbecslés vagy geotechnikai tervezési dokumentum.',
      'A HUGEO földtani térkép regionális térképezési információ. Nem állapítja meg a teljes rétegsort, teherbírást, süllyedést vagy tervezési talajvízszintet a konkrét telken.',
      'A közeli fúrási adatok vizsgálati hátteret adnak, de nem bizonyítják, hogy a fúrás közvetlenül a kiválasztott telket reprezentálja.',
      'A kataszteri geometria és azonosítás nem igazolja automatikusan a tulajdonjogot, terheket vagy jogilag hiteles határt.',
      'Egy hiányzó vagy vissza nem adott veszély- vagy korlátozási rekord nem bizonyítja annak hiányát.',
      'A beruházási döntéseket aktuális hivatalos adatokra és megfelelő szakmai vizsgálatokra kell alapozni.'
    ],
    technicalNarrative: {
      groundwater_depth_m: 'nem érhető el',
      groundwater_notice: 'A tervezési talajvízszinthez hivatalos vagy helyszíni vizsgálat szükséges.',
      zoning_name: canonical.planning.instrumentName,
      max_far: 'nem érhető el',
      max_building_coverage_pct: 'nem érhető el',
      min_biologically_active_pct: 'nem érhető el',
      max_height_m: 'nem érhető el',
      utility_status: 'Hivatalos közműfeltételek szükségesek.'
    },
    riskMatrix: [
      { category: 'Felszínmozgás / csuszamlás', level: risk(canonical.hazards.landslide.classification), evidence_level: canonical.hazards.landslide.status, detail: canonical.hazards.landslide.classification ? `Előzetes osztályozás: ${risk(canonical.hazards.landslide.classification)}.` : 'Nincs automatizált, helyhez kötött országos eredmény.' },
      { category: 'Szeizmikus viszonyok', level: shown(canonical.hazards.seismic.classification), evidence_level: canonical.hazards.seismic.status, detail: 'A konkrét építési követelményeket az alkalmazandó szabványok és a helyszínhez tartozó hivatalos adatok alapján kell meghatározni.' },
      { category: 'Radon', level: shown(canonical.hazards.radon.classification), evidence_level: canonical.hazards.radon.status, detail: reason(canonical.hazards.radon.reasonCode) },
      { category: 'Bányászati / süllyedési viszonyok', level: shown(canonical.hazards.mining.classification), evidence_level: canonical.hazards.mining.status, detail: reason(canonical.hazards.mining.reasonCode) }
    ],
    keyRisks: checklist.slice(0,4).map(item => item.reason),
    opportunities: [
      'A HUGEO országos földtani térképe közvetlenül lekérdezhető helyfüggő földtani háttérhez.',
      boreholes ? 'A HUGEO fúrási WFS megmutatja, hogy van-e a környéken további vizsgálati háttér.' : 'A HUGEO fúrási adatbázis különösen hasznos lehet a környék korábbi feltárásainak kereséséhez.'
    ]
  };
}
