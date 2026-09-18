import { AvailabilityReason, CanonicalReport, RiskClassification } from './canonicalReport';

export type FrEsFiLanguage = 'fr' | 'es' | 'fi';

type Copy = {
  locale: string;
  unavailable: string;
  supported: string;
  limited: string;
  evidence: string;
  countryCoverage: string;
  verified: string;
  modelled: string;
  requires: string;
  confidenceHigh: string;
  confidenceMedium: string;
  confidenceLow: string;
  evidenceHigh: string;
  evidenceMedium: string;
  evidencePreliminary: string;
  geologyUnavailable: string;
  geology: (source: string, unit: string) => string;
  terrainUnavailable: string;
  terrain: (elevation: number, slope: unknown) => string;
  soil: (texture: string, bearing: string) => string;
  flood: (risk: string) => string;
  road: (road: string, distance: string) => string;
  environmentClear: string;
  environment: (area: string) => string;
  valuation: (min: string, max: string, currency: string) => string;
  noValuation: string;
  summary: (country: string, geology: string, terrain: string, soil: string, score: number, valuation: string) => string;
  supportNotice: string;
  groundTitle: string;
  variability: Record<string, string>;
  contextConsistent: string;
  contextTransition: string;
  contextInsufficient: string;
  investigationFocus: string;
  mappedUnits: string;
  materialIndicators: string;
  mappedSamples: string;
  groundLimitation: string;
  soilModelVariable: string;
  soilModelConsistent: string;
  soilModelInsufficient: string;
  titles: { estimated_value: string; confidence: string; executive_summary: string };
  planningSummary: (instrument: string) => string;
  planningDetail: (instrument: string) => string;
  binding: string;
  mappedGeologyLimitation: string;
  landOnly: string;
  preliminaryDisclaimer: string;
  noAbsenceDisclaimer: string;
  modelDisclaimer: string;
  planningDisclaimer: string;
  sourceDisclaimer: string;
  checklist: Array<[string, string, 'geology' | 'cadastre' | 'planning']>;
  utilityNames: Record<string, string>;
  utilityMapped: string;
  utilityDistance: (distance: number) => string;
  riskNames: { landslide: string; seismic: string; radon: string; mining: string };
  riskLabels: Record<string, string>;
  opportunities: string[];
};

const copies: Record<FrEsFiLanguage, Copy> = {
  fr: {
    locale: 'fr-FR', unavailable: 'non disponible', supported: 'Pris en charge', limited: 'Couverture limitée', evidence: 'Élément de preuve', countryCoverage: 'Couverture nationale', verified: 'Vérifié', modelled: 'Modélisé', requires: 'Vérification requise', confidenceHigh: 'Élevée', confidenceMedium: 'Moyenne', confidenceLow: 'Faible', evidenceHigh: 'Qualité de preuve élevée', evidenceMedium: 'Qualité de preuve moyenne', evidencePreliminary: 'Qualité de preuve préliminaire',
    geologyUnavailable: 'Aucune unité géologique n’est disponible dans les sources consultées.', geology: (source, unit) => `Selon ${source}, le site se situe dans l’unité géologique ${unit}.`, terrainUnavailable: 'Les mesures de terrain ne sont pas disponibles.', terrain: (elevation, slope) => `Terrain modélisé : altitude ${elevation} m et pente ${slope}°.`, soil: (texture, bearing) => `Modèle de sol : texture ${texture} ; capacité portante : ${bearing}.`, flood: risk => `Classement de présélection du risque d’inondation : ${risk}.`, road: (road, distance) => `Voie cartographiée la plus proche : ${road}, à environ ${distance} m.`, environmentClear: 'Aucune entité d’aire protégée n’a été cartographiée dans la zone interrogée.', environment: area => `La présélection environnementale a identifié ${area}.`, valuation: (min, max, currency) => `Valeur foncière statistique indicative : ${min}–${max} ${currency}.`, noValuation: 'Aucune valeur foncière automatisée n’est présentée faute de preuve nationale suffisamment étayée.', summary: (country, geology, terrain, soil, score, valuation) => `Cette évaluation fondée sur les preuves concerne un site en ${country}. Unité géologique : ${geology}. ${terrain} Sol : ${soil}. ${valuation}`,
    supportNotice: 'Couverture limitée : seules les sources nationales effectivement intégrées sont automatisées. Les autres catégories doivent être vérifiées auprès de l’autorité compétente.', groundTitle: 'Contexte spatial du sous-sol', variability: { LOW: 'Faible', MODERATE: 'Modérée', HIGH: 'Élevée', INSUFFICIENT_EVIDENCE: 'Preuves insuffisantes' }, contextConsistent: 'Les échantillons cartographiés disponibles sont globalement cohérents autour du site ; cela ne confirme pas les conditions sous l’ensemble de la parcelle.', contextTransition: 'Les échantillons cartographiés indiquent une transition entre plusieurs unités géologiques ou génétiques autour du site.', contextInsufficient: 'Les échantillons cartographiés sont insuffisants pour caractériser de façon fiable la variabilité spatiale du sous-sol.', investigationFocus: 'Avant toute décision technique, vérifier sur site les matériaux, leur état, leur épaisseur et les conditions d’eau au moyen d’une investigation spécifique.', mappedUnits: 'Unités cartographiées', materialIndicators: 'Indicateurs de matériaux cartographiés', mappedSamples: 'Échantillons cartographiés', groundLimitation: 'Les données cartographiques et modélisées servent uniquement à la présélection. Elles ne confirment ni le profil sous la parcelle, ni l’épaisseur des couches, ni les eaux souterraines, ni les paramètres de calcul.', soilModelVariable: 'Le modèle de sol indique une variabilité spatiale de texture.', soilModelConsistent: 'Le modèle de sol est relativement cohérent dans les échantillons disponibles.', soilModelInsufficient: 'Les échantillons du modèle de sol sont insuffisants pour évaluer la variabilité.', titles: { estimated_value: 'Valeur foncière statistique indicative', confidence: 'Qualité des preuves', executive_summary: 'Synthèse de l’évaluation' }, planningSummary: instrument => `Les paramètres d’urbanisme doivent être confirmés au titre de ${instrument}.`, planningDetail: instrument => `Les droits et contraintes opposables doivent être vérifiés dans les documents en vigueur relatifs à ${instrument}.`, binding: 'Les informations opposables doivent être confirmées par l’autorité compétente.', mappedGeologyLimitation: 'Les données géologiques cartographiées sont destinées à la présélection et ne remplacent pas une investigation spécifique au site.', landOnly: 'Valeur du terrain uniquement — les bâtiments, constructions et autres améliorations sont exclus.', preliminaryDisclaimer: 'Ce rapport automatisé est un outil de présélection et d’aide à la décision ; il ne constitue ni une décision officielle, ni un avis juridique, ni une étude professionnelle du site.', noAbsenceDisclaimer: 'L’absence d’un risque, d’une restriction ou d’un enjeu environnemental enregistré ne prouve pas son absence réelle.', modelDisclaimer: 'Les données de sol modélisées ne remplacent pas une investigation géotechnique conforme à l’Eurocode 7.', planningDisclaimer: 'Les droits à construire et règles opposables doivent être confirmés officiellement.', sourceDisclaimer: 'Vérifier l’actualité, la disponibilité et les limites des sources avant toute décision d’investissement.', checklist: [['Confirmation officielle de l’urbanisme', 'Vérifier les règles d’urbanisme opposables et les documents en vigueur auprès de l’autorité compétente.', 'planning'], ['Investigation géotechnique', 'Faire réaliser une investigation géotechnique spécifique au site conformément à l’Eurocode 7.', 'geology'], ['Vérification topographique et cadastrale', 'Faire vérifier les limites et dimensions si nécessaire ; la géométrie cartographique ne constitue pas une détermination juridique des limites.', 'cadastre'], ['Conditions de raccordement aux réseaux', 'Obtenir les conditions formelles de raccordement auprès des gestionnaires de réseaux.', 'cadastre'], ['Titre et servitudes', 'Vérifier le titre, les servitudes, charges et autres restrictions juridiques dans les registres compétents.', 'cadastre']], utilityNames: { ELECTRICITY: 'Électricité', WATER: 'Eau', SEWER: 'Assainissement', GAS: 'Gaz', TELECOM: 'Télécommunications', OTHER: 'Réseau' }, utilityMapped: 'Le réseau est cartographié dans le jeu de données consulté.', utilityDistance: distance => `Le réseau est cartographié à environ ${distance} m du site. Le gestionnaire doit confirmer la possibilité de raccordement.`, riskNames: { landslide: 'Glissements de terrain', seismic: 'Risque sismique', radon: 'Radon', mining: 'Influence minière' }, riskLabels: { NEGLIGIBLE: 'Négligeable', LOW: 'Faible', MODERATE: 'Modéré', HIGH: 'Élevé' }, opportunities: ['Le modèle canonique conserve la provenance et le statut de chaque élément de preuve.', 'Les données de terrain, de sol et de sources publiques sont regroupées dans une seule évaluation préliminaire.']
  },
  es: {
    locale: 'es-ES', unavailable: 'no disponible', supported: 'Compatible', limited: 'Cobertura limitada', evidence: 'Evidencia', countryCoverage: 'Cobertura nacional', verified: 'Verificado', modelled: 'Modelado', requires: 'Requiere verificación', confidenceHigh: 'Alta', confidenceMedium: 'Media', confidenceLow: 'Baja', evidenceHigh: 'Calidad de evidencia alta', evidenceMedium: 'Calidad de evidencia media', evidencePreliminary: 'Calidad de evidencia preliminar',
    geologyUnavailable: 'No hay una unidad geológica disponible en las fuentes revisadas.', geology: (source, unit) => `Según ${source}, el emplazamiento se encuentra en la unidad geológica ${unit}.`, terrainUnavailable: 'No hay mediciones del terreno disponibles.', terrain: (elevation, slope) => `Terreno modelado: elevación ${elevation} m y pendiente ${slope}° .`, soil: (texture, bearing) => `Modelo de suelo: textura ${texture}; capacidad portante: ${bearing}.`, flood: risk => `Clasificación preliminar del riesgo de inundación: ${risk}.`, road: (road, distance) => `Vía cartografiada más próxima: ${road}, a unos ${distance} m.`, environmentClear: 'No se cartografió ninguna entidad de área protegida en la zona consultada.', environment: area => `La evaluación ambiental preliminar identificó ${area}.`, valuation: (min, max, currency) => `Valor estadístico indicativo del suelo: ${min}–${max} ${currency}.`, noValuation: 'No se presenta una valoración automatizada del suelo porque no hay evidencia nacional compatible suficiente.', summary: (country, geology, terrain, soil, score, valuation) => `Esta evaluación basada en evidencias corresponde a un emplazamiento en ${country}. Unidad geológica: ${geology}. ${terrain} Suelo: ${soil}. ${valuation}`,
    supportNotice: 'Cobertura limitada: solo se automatizan las fuentes nacionales realmente integradas. Las demás categorías requieren comprobación ante la autoridad competente.', groundTitle: 'Contexto espacial del terreno', variability: { LOW: 'Baja', MODERATE: 'Moderada', HIGH: 'Alta', INSUFFICIENT_EVIDENCE: 'Evidencia insuficiente' }, contextConsistent: 'Las muestras cartografiadas disponibles son en general coherentes alrededor del emplazamiento; esto no confirma las condiciones bajo toda la parcela.', contextTransition: 'Las muestras cartografiadas indican una transición entre distintas unidades geológicas o genéticas alrededor del emplazamiento.', contextInsufficient: 'No hay suficientes muestras cartografiadas para caracterizar con fiabilidad la variabilidad espacial del terreno.', investigationFocus: 'Antes de tomar decisiones técnicas, verificar mediante investigación específica del emplazamiento los materiales, su estado, espesor y condiciones de agua.', mappedUnits: 'Unidades cartografiadas', materialIndicators: 'Indicadores de material cartografiado', mappedSamples: 'Muestras cartografiadas', groundLimitation: 'La información cartográfica y modelada sirve únicamente para una evaluación preliminar. No confirma el perfil bajo la parcela, los espesores de capas, las aguas subterráneas ni los parámetros de diseño.', soilModelVariable: 'El modelo de suelo indica variación espacial de textura.', soilModelConsistent: 'El modelo de suelo es relativamente coherente en las muestras disponibles.', soilModelInsufficient: 'No hay suficientes muestras del modelo de suelo para evaluar la variación.', titles: { estimated_value: 'Valor estadístico indicativo del suelo', confidence: 'Calidad de la evidencia', executive_summary: 'Resumen de la evaluación' }, planningSummary: instrument => `Los parámetros urbanísticos deben confirmarse conforme a ${instrument}.`, planningDetail: instrument => `Los derechos y restricciones vinculantes deben verificarse en la documentación vigente de ${instrument}.`, binding: 'La información vinculante debe confirmarse con la autoridad competente.', mappedGeologyLimitation: 'Los datos geológicos cartografiados son de evaluación preliminar y no sustituyen una investigación específica del emplazamiento.', landOnly: 'Solo valor del suelo — se excluyen edificios, construcciones y otras mejoras.', preliminaryDisclaimer: 'Este informe automatizado sirve únicamente como evaluación preliminar y apoyo a la decisión; no es una resolución oficial, asesoramiento jurídico ni una investigación profesional del emplazamiento.', noAbsenceDisclaimer: 'La ausencia de un riesgo, restricción o problema ambiental registrado no demuestra que no exista.', modelDisclaimer: 'Los datos de suelo modelados no sustituyen una investigación geotécnica conforme al Eurocódigo 7.', planningDisclaimer: 'Los derechos urbanísticos y de edificación vinculantes deben confirmarse oficialmente.', sourceDisclaimer: 'Antes de una decisión de inversión, compruebe la vigencia, disponibilidad y limitaciones de todas las fuentes.', checklist: [['Confirmación urbanística oficial', 'Verificar las normas urbanísticas vinculantes y la documentación vigente ante la autoridad competente.', 'planning'], ['Investigación geotécnica', 'Encargar una investigación geotécnica específica del emplazamiento conforme al Eurocódigo 7.', 'geology'], ['Verificación topográfica y catastral', 'Verificar profesionalmente límites y dimensiones cuando sea necesario; la geometría cartográfica no determina jurídicamente los linderos.', 'cadastre'], ['Condiciones de conexión a servicios', 'Obtener condiciones formales de conexión de los gestores de redes.', 'cadastre'], ['Título y cargas', 'Comprobar titularidad, servidumbres, cargas y otras restricciones jurídicas en los registros competentes.', 'cadastre']], utilityNames: { ELECTRICITY: 'Electricidad', WATER: 'Agua', SEWER: 'Saneamiento', GAS: 'Gas', TELECOM: 'Telecomunicaciones', OTHER: 'Servicio' }, utilityMapped: 'El servicio está cartografiado en el conjunto de datos consultado.', utilityDistance: distance => `El servicio está cartografiado a unos ${distance} m del emplazamiento. El gestor debe confirmar la posibilidad de conexión.`, riskNames: { landslide: 'Deslizamientos', seismic: 'Riesgo sísmico', radon: 'Radón', mining: 'Influencia minera' }, riskLabels: { NEGLIGIBLE: 'Despreciable', LOW: 'Bajo', MODERATE: 'Moderado', HIGH: 'Alto' }, opportunities: ['El modelo canónico conserva la procedencia y el estado de cada evidencia.', 'Los datos de terreno, suelo y fuentes públicas se reúnen en una única evaluación preliminar.']
  },
  fi: {
    locale: 'fi-FI', unavailable: 'ei saatavilla', supported: 'Tuettu', limited: 'Rajoitettu kattavuus', evidence: 'Näyttö', countryCoverage: 'Maakohtainen kattavuus', verified: 'Vahvistettu', modelled: 'Mallinnettu', requires: 'Vaatii tarkistuksen', confidenceHigh: 'Korkea', confidenceMedium: 'Keskitaso', confidenceLow: 'Matala', evidenceHigh: 'Näytön laatu korkea', evidenceMedium: 'Näytön laatu keskitasoa', evidencePreliminary: 'Näyttö alustavaa',
    geologyUnavailable: 'Tarkastelluista lähteistä ei ole saatavilla geologista yksikköä.', geology: (source, unit) => `${source}-lähteen mukaan kohde sijaitsee geologisessa yksikössä ${unit}.`, terrainUnavailable: 'Maastomittauksia ei ole saatavilla.', terrain: (elevation, slope) => `Mallinnettu maasto: korkeus ${elevation} m ja kaltevuus ${slope}° .`, soil: (texture, bearing) => `Maaperämalli: maalaji/tekstuuriluokka ${texture}; kantavuus: ${bearing}.`, flood: risk => `Tulvariskin alustava luokitus: ${risk}.`, road: (road, distance) => `Lähin kartoitettu tie: ${road}, noin ${distance} m päässä.`, environmentClear: 'Tarkastellulla alueella ei kartoitettu suojelualuekohdetta.', environment: area => `Ympäristön alustava tarkastelu tunnisti kohteen ${area}.`, valuation: (min, max, currency) => `Suuntaa-antava tilastollinen maan arvo: ${min}–${max} ${currency}.`, noValuation: 'Automaattista maan arviota ei esitetä, koska riittävää tuettua kansallista arvonmääritysnäyttöä ei ole saatavilla.', summary: (country, geology, terrain, soil, score, valuation) => `Tämä näyttöön perustuva arvio koskee kohdetta maassa ${country}. Geologinen yksikkö: ${geology}. ${terrain} Maaperä: ${soil}. ${valuation}`,
    supportNotice: 'Rajoitettu kattavuus: vain järjestelmään aidosti integroidut kansalliset lähteet ovat automatisoituja. Muut luokat on tarkistettava toimivaltaiselta viranomaiselta.', groundTitle: 'Pohjamaan alueellinen konteksti', variability: { LOW: 'Vähäinen', MODERATE: 'Kohtalainen', HIGH: 'Suuri', INSUFFICIENT_EVIDENCE: 'Näyttö riittämätön' }, contextConsistent: 'Saatavilla olevat kartoitetut näytteet ovat ympäristössä pääosin johdonmukaisia; tämä ei kuitenkaan vahvista koko tontin alapuolisia olosuhteita.', contextTransition: 'Kartoitetut näytteet viittaavat eri geologisten tai syntyperäisten yksiköiden vaihettumiseen kohteen ympärillä.', contextInsufficient: 'Kartoitetut näytteet eivät riitä pohjamaan alueellisen vaihtelun luotettavaan arviointiin.', investigationFocus: 'Varmista ennen teknisiä päätöksiä materiaalit, niiden tila, kerrospaksuudet ja vesiolosuhteet kohdekohtaisella tutkimuksella.', mappedUnits: 'Kartoitetut yksiköt', materialIndicators: 'Kartoitetun materiaalin indikaattorit', mappedSamples: 'Kartoitetut näytteet', groundLimitation: 'Kartta- ja malliaineisto soveltuu vain alustavaan seulontaan. Se ei vahvista tontin maakerrosprofiilia, kerrospaksuuksia, pohjavesiolosuhteita tai mitoitusparametreja.', soilModelVariable: 'Maaperämalli viittaa tekstuurin alueelliseen vaihteluun.', soilModelConsistent: 'Maaperämalli on käytettävissä olevissa näytteissä suhteellisen johdonmukainen.', soilModelInsufficient: 'Maaperämallin näytteitä ei ole riittävästi vaihtelun arviointiin.', titles: { estimated_value: 'Suuntaa-antava tilastollinen maan arvo', confidence: 'Näytön laatu', executive_summary: 'Arvion yhteenveto' }, planningSummary: instrument => `Kaavoitusparametrit on vahvistettava asiakirjan ${instrument} perusteella.`, planningDetail: instrument => `Sitovat rakentamis- ja kaavoitusehdot on tarkistettava voimassa olevasta asiakirjasta ${instrument}.`, binding: 'Sitovat tiedot on vahvistettava toimivaltaiselta viranomaiselta.', mappedGeologyLimitation: 'Kartoitetut geologiset tiedot ovat alustavaa seulontaa eivätkä korvaa kohdekohtaista geologista tutkimusta.', landOnly: 'Vain maan arvo — rakennukset, rakenteet ja muut parannukset eivät sisälly arvoon.', preliminaryDisclaimer: 'Tämä automatisoitu raportti on alustava seulonta- ja päätöksenteon tukiväline; se ei ole viranomaispäätös, oikeudellinen lausunto tai ammattimainen kohdetutkimus.', noAbsenceDisclaimer: 'Rekisteröidyn riskin, rajoituksen tai ympäristötekijän puuttuminen ei osoita, ettei sitä olisi.', modelDisclaimer: 'Mallinnettu maaperätieto ei korvaa Eurokoodi 7:n mukaista geoteknistä tutkimusta.', planningDisclaimer: 'Sitovat rakentamis- ja kaavoitusoikeudet on vahvistettava virallisesti.', sourceDisclaimer: 'Tarkista kaikkien lähteiden ajantasaisuus, saatavuus ja rajoitukset ennen investointipäätöstä.', checklist: [['Virallinen kaavoituksen vahvistus', 'Tarkista sitovat kaavamääräykset ja voimassa olevat asiakirjat toimivaltaiselta viranomaiselta.', 'planning'], ['Geotekninen tutkimus', 'Teetä kohdekohtainen geotekninen tutkimus Eurokoodi 7:n mukaisesti.', 'geology'], ['Topografinen ja kiinteistörajojen tarkistus', 'Tarkistuta rajat ja mitat tarvittaessa ammattilaisella; karttageometria ei ole juridinen rajankäynti.', 'cadastre'], ['Liittymisehdot', 'Pyydä verkonhaltijoilta viralliset liittymisehdot.', 'cadastre'], ['Omistus ja rasitteet', 'Tarkista omistus, rasitteet ja muut oikeudelliset rajoitukset toimivaltaisista rekistereistä.', 'cadastre']], utilityNames: { ELECTRICITY: 'Sähkö', WATER: 'Vesi', SEWER: 'Viemäri', GAS: 'Kaasu', TELECOM: 'Tietoliikenne', OTHER: 'Yhdyskuntatekniikka' }, utilityMapped: 'Yhdyskuntatekninen verkko on kartoitettu tarkastellussa aineistossa.', utilityDistance: distance => `Verkko on kartoitettu noin ${distance} m päähän kohteesta. Verkonhaltijan on vahvistettava liittymismahdollisuus.`, riskNames: { landslide: 'Maanvyörymät', seismic: 'Seisminen riski', radon: 'Radon', mining: 'Kaivostoiminnan vaikutus' }, riskLabels: { NEGLIGIBLE: 'Merkityksetön', LOW: 'Matala', MODERATE: 'Kohtalainen', HIGH: 'Korkea' }, opportunities: ['Kanoninen malli säilyttää jokaisen näyttötiedon alkuperän ja tilan.', 'Maasto-, maaperä- ja lähdetiedot yhdistetään yhdeksi alustavaksi arvioksi.']
  }
};

const reasonCopy: Record<FrEsFiLanguage, Record<AvailabilityReason, string>> = {
  fr: { NO_DATA: 'La source a été interrogée avec succès mais n’a renvoyé aucun objet pour ce site. Cela ne prouve pas l’absence du phénomène.', SOURCE_UNAVAILABLE: 'La source est temporairement indisponible ou inaccessible. Une vérification est requise.', MALFORMED_DATA: 'La source a répondu mais sa structure n’a pas pu être validée de manière sûre. Aucune valeur n’a été déduite.', PARAMETER_NOT_PROVIDED: 'Ce paramètre n’est pas fourni par le jeu de données utilisé.', INSUFFICIENT_EVIDENCE: 'Les preuves disponibles sont insuffisantes pour déduire cette valeur de manière sûre.', NOT_SUPPORTED_FOR_COUNTRY: 'Cette source nationale automatisée n’est pas prise en charge pour le pays sélectionné. Consultez l’autorité compétente.', AUTHORITATIVE_DATA_REQUIRED: 'Cette information doit être confirmée par un document officiel ou par l’autorité compétente.' },
  es: { NO_DATA: 'La fuente se consultó correctamente pero no devolvió ningún elemento para este emplazamiento. Esto no demuestra la ausencia del fenómeno.', SOURCE_UNAVAILABLE: 'La fuente no está disponible temporalmente o no se pudo alcanzar. Se requiere verificación.', MALFORMED_DATA: 'La fuente respondió, pero su estructura no pudo validarse de forma segura. No se dedujo ningún valor.', PARAMETER_NOT_PROVIDED: 'Este parámetro no lo proporciona el conjunto de datos utilizado.', INSUFFICIENT_EVIDENCE: 'La evidencia disponible es insuficiente para inferir este valor con seguridad.', NOT_SUPPORTED_FOR_COUNTRY: 'Esta fuente nacional automatizada no es compatible con el país seleccionado. Consulte a la autoridad competente.', AUTHORITATIVE_DATA_REQUIRED: 'Esta información requiere confirmación mediante un documento oficial o por la autoridad competente.' },
  fi: { NO_DATA: 'Lähde haettiin onnistuneesti, mutta se ei palauttanut kohdetta tälle sijainnille. Tämä ei osoita ilmiön puuttumista.', SOURCE_UNAVAILABLE: 'Lähde oli tilapäisesti poissa käytöstä tai siihen ei saatu yhteyttä. Tarkistus vaaditaan.', MALFORMED_DATA: 'Lähde vastasi, mutta tietorakennetta ei voitu validoida turvallisesti. Arvoa ei päätelty.', PARAMETER_NOT_PROVIDED: 'Käytetty aineisto ei sisällä tätä parametria.', INSUFFICIENT_EVIDENCE: 'Saatavilla oleva näyttö ei riitä arvon turvalliseen päättelemiseen.', NOT_SUPPORTED_FOR_COUNTRY: 'Tätä automatisoitua kansallista lähdettä ei tueta valitussa maassa. Tarkista tieto toimivaltaiselta viranomaiselta.', AUTHORITATIVE_DATA_REQUIRED: 'Tämä tieto on vahvistettava virallisesta asiakirjasta tai toimivaltaiselta viranomaiselta.' }
};

const shown = (value: unknown, fallback: string) => value === null || value === undefined || value === '' ? fallback : String(value);
const reason = (language: FrEsFiLanguage, code?: AvailabilityReason) => reasonCopy[language][code || 'AUTHORITATIVE_DATA_REQUIRED'];

function localRisk(copy: Copy, classification: RiskClassification): string {
  return classification ? copy.riskLabels[classification] || classification : copy.unavailable;
}

function localClassification(copy: Copy, input: string | null): string {
  if (!input) return copy.unavailable;
  return input.replace(/Low to Very Low/gi, `${copy.riskLabels.LOW}–${copy.riskLabels.NEGLIGIBLE}`).replace(/Moderate/gi, copy.riskLabels.MODERATE).replace(/High/gi, copy.riskLabels.HIGH).replace(/Low/gi, copy.riskLabels.LOW);
}

function authority(canonical: CanonicalReport, kind: 'geology' | 'cadastre' | 'planning') {
  return kind === 'geology' ? canonical.authorities.geology : kind === 'planning' ? canonical.authorities.planning : canonical.authorities.cadastre;
}

function localizedPlanningLabel(value: string | undefined, language: FrEsFiLanguage): string {
  const raw = String(value || '');
  if (language === 'es') return raw
    .replace(/^(.+?) Spatial Planning Authority/i, '$1 — autoridad de planeamiento')
    .replace(/^(.+?) competent local planning authority$/i, '$1 — autoridad urbanística competente')
    .replace(/Spatial Planning Authority/gi, 'autoridad de planeamiento')
    .replace(/competent local planning authority/gi, 'autoridad urbanística competente');
  if (language === 'fr') return raw
    .replace(/^(.+?) Spatial Planning Authority/i, '$1 — autorité compétente en urbanisme')
    .replace(/^(.+?) competent local planning authority$/i, '$1 — autorité locale compétente en urbanisme');
  if (language === 'fi') return raw
    .replace(/^(.+?) Spatial Planning Authority/i, '$1 — kaavoitusviranomainen')
    .replace(/^(.+?) competent local planning authority$/i, '$1 — toimivaltainen paikallinen kaavoitusviranomainen');
  return raw;
}

export function renderFrEsFiLocalizedReport(canonical: CanonicalReport, language: FrEsFiLanguage): any {
  const c = copies[language];
  const support = c.supportNotice;
  const geologyUnit = canonical.geology.unitName || c.unavailable;
  const terrainText = canonical.terrain.elevationM === null ? c.terrainUnavailable : c.terrain(canonical.terrain.elevationM, shown(canonical.terrain.slopeDegrees, c.unavailable));
  const soilTexture = canonical.soil.texture || reason(language, canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED');
  const soilText = c.soil(soilTexture, canonical.soil.bearingCapacity || reason(language, 'INSUFFICIENT_EVIDENCE'));
  const geologyText = canonical.geology.unitName ? c.geology(canonical.geology.sourceName, canonical.geology.unitName) : c.geologyUnavailable;
  const mapped: any = canonical.groundContext?.mapped || null;
  const soilVariability: any = canonical.groundContext?.soilVariability || null;
  const variabilityCode = mapped?.variabilityClass || (soilVariability?.validSampleCount >= 2 ? (soilVariability.variationObserved ? 'MODERATE' : 'LOW') : 'INSUFFICIENT_EVIDENCE');
  const contextSummary = mapped?.sampleCount ? (mapped.transitionIndicated ? c.contextTransition : c.contextConsistent) : c.contextInsufficient;
  const groundContext = {
    title: c.groundTitle,
    evidence_level: canonical.groundContext?.status || 'REQUIRES_VERIFICATION',
    variability_code: variabilityCode,
    variability_label: c.variability[variabilityCode] || variabilityCode,
    summary: contextSummary,
    mapped_units_label: c.mappedUnits,
    mapped_units: mapped?.distinctMappedUnits || [],
    material_indicators_label: c.materialIndicators,
    material_indicators: mapped?.materialIndicators || [],
    transition_indicated: Boolean(mapped?.transitionIndicated),
    sample_label: c.mappedSamples,
    sample_count: mapped?.sampleCount || 0,
    site_sample_count: mapped?.siteSampleCount || 0,
    parcel_sample_count: mapped?.parcelSampleCount || 0,
    vicinity_sample_count: mapped?.vicinitySampleCount || 0,
    soil_model_summary: soilVariability?.validSampleCount ? (soilVariability.variationObserved ? c.soilModelVariable : c.soilModelConsistent) : c.soilModelInsufficient,
    soil_model_sample_count: soilVariability?.validSampleCount || 0,
    soil_sand_range: soilVariability?.topsoilSandPctRange || null,
    soil_silt_range: soilVariability?.topsoilSiltPctRange || null,
    soil_clay_range: soilVariability?.topsoilClayPctRange || null,
    investigation_focus: c.investigationFocus,
    limitation: c.groundLimitation,
    source_name: mapped?.sourceName || soilVariability?.sourceName || null,
    source_scale: mapped?.sourceScale || soilVariability?.sourceResolution || null,
    terrain_min_elevation_m: canonical.terrain.minElevationM ?? null,
    terrain_max_elevation_m: canonical.terrain.maxElevationM ?? null,
    terrain_local_relief_m: canonical.terrain.localReliefM ?? null
  };

  const valuationAvailable = canonical.valuation.min !== null && canonical.valuation.max !== null;
  const minText = valuationAvailable ? canonical.valuation.min!.toLocaleString(c.locale) : '';
  const maxText = valuationAvailable ? canonical.valuation.max!.toLocaleString(c.locale) : '';
  const valuationText = valuationAvailable ? c.valuation(minText, maxText, canonical.valuation.currency) : reason(language, canonical.valuation.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED');
  const summaryValuation = valuationAvailable ? `${valuationText} ${c.landOnly}` : c.noValuation;
  const floodText = canonical.flood.classification ? c.flood(localRisk(c, canonical.flood.classification)) : reason(language, canonical.flood.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED');
  const roadText = c.road(shown(canonical.infrastructure.roadName || canonical.infrastructure.roadType, c.unavailable), shown(canonical.infrastructure.distanceM, c.unavailable));
  const environmentText = canonical.environment.status === 'REQUIRES_VERIFICATION' || canonical.environment.reasonCode
    ? reason(language, canonical.environment.reasonCode || 'AUTHORITATIVE_DATA_REQUIRED')
    : canonical.environment.protectedAreaName ? c.environment(canonical.environment.protectedAreaName) : c.environmentClear;
  const summaryCore = c.summary(canonical.countryName, geologyUnit, terrainText, soilTexture, canonical.evidenceScore.totalScore, summaryValuation);

  const evidenceRegistry = canonical.evidenceRecords.map(record => {
    const code = (record.value as { reasonCode?: AvailabilityReason } | null)?.reasonCode;
    const isSupport = record.id.startsWith('country-support-');
    return {
      ...record,
      category: isSupport ? c.countryCoverage : record.category,
      claim: isSupport ? reason(language, 'NOT_SUPPORTED_FOR_COUNTRY') : record.id === 'environmental-natura2000' && code ? reason(language, code) : record.claim,
      spatialRelationship: isSupport ? support : record.spatialRelationship,
      calculationMethod: record.calculationMethod,
      confidence: record.confidence === 'High' ? c.confidenceHigh : record.confidence === 'Medium' ? c.confidenceMedium : c.confidenceLow,
      limitation: record.status === 'REQUIRES_VERIFICATION' ? reason(language, code) : c.binding
    };
  });

  const planningAuthority = localizedPlanningLabel(canonical.planning.authorityName, language);
  const planningSource = localizedPlanningLabel(canonical.planning.sourceName, language);
  const checklist = c.checklist.map(([topic, itemReason, kind], index) => ({ topic, reason: itemReason, recommendedAuthorityOrExpert: kind === 'planning' ? planningAuthority : authority(canonical, kind), priority: index === 3 ? 'Medium' : 'High' }));
  const utilitiesChecklist = (canonical.utilities || []).map(item => ({
    utility: c.utilityNames[item.utilityCode] || item.utilityCode,
    status: item.mapped ? (item.distanceM === null ? c.utilityMapped : c.utilityDistance(item.distanceM)) : reason(language, item.reasonCode),
    evidence_level: item.status,
    provider_type: item.sourceName,
    distance_m: item.distanceM ?? undefined,
    mapped_in_dataset: item.mapped,
    limitation: item.mapped ? reason(language, 'AUTHORITATIVE_DATA_REQUIRED') : reason(language, item.reasonCode)
  }));
  const dataSources = canonical.sourceRecords.map(source => ({ name: source.name, url: source.url, authority: source.name, verification_status: source.status === 'VERIFIED' ? c.verified : source.status === 'MODELLED' ? c.modelled : c.requires }));
  const section = (summary: string, detail: string, status: string, source?: string, limitation?: string) => ({ summary, detail, evidence_level: status, source_cited: source, limitation_notice: limitation });

  return {
    language,
    countrySupport: { maturity: canonical.support.maturity, label: canonical.support.maturity === 'SUPPORTED' ? c.supported : c.limited, notice: support, capabilities: canonical.support.capabilities },
    groundContext,
    summary: canonical.support.maturity === 'LIMITED' ? `${summaryCore} ${support}` : summaryCore,
    titles: c.titles,
    confidenceLabel: canonical.evidenceScore.totalScore >= 75 ? c.evidenceHigh : canonical.evidenceScore.totalScore >= 50 ? c.evidenceMedium : c.evidencePreliminary,
    unavailableReasons: {
      geology: reason(language, canonical.geology.reasonCode), soilTexture: reason(language, canonical.soil.reasonCode || 'PARAMETER_NOT_PROVIDED'), engineeringParameter: reason(language, 'INSUFFICIENT_EVIDENCE'), groundwater: reason(language, canonical.support.capabilities.nationalHydrogeology ? 'AUTHORITATIVE_DATA_REQUIRED' : 'NOT_SUPPORTED_FOR_COUNTRY'), planning: reason(language, canonical.planning.reasonCode), valuation: reason(language, canonical.valuation.reasonCode), sourceUnavailable: reason(language, 'SOURCE_UNAVAILABLE'), noFeature: reason(language, 'NO_DATA')
    },
    sections: {
      soil_and_ground: section(soilText, `${c.binding} ${contextSummary} ${c.investigationFocus}`, canonical.soil.status, canonical.soil.sourceName, canonical.soil.reasonCode ? reason(language, canonical.soil.reasonCode) : undefined),
      geohazard_risk: section(geologyText, `${geologyText} ${c.mappedGeologyLimitation}`, canonical.geology.status, canonical.geology.sourceName, canonical.geology.reasonCode ? reason(language, canonical.geology.reasonCode) : undefined),
      flooding_risk: section(floodText, canonical.flood.reasonCode ? reason(language, canonical.flood.reasonCode) : c.binding, canonical.flood.status, canonical.flood.sourceName, canonical.flood.reasonCode ? reason(language, canonical.flood.reasonCode) : undefined),
      zoning_and_land_use: section(c.planningSummary(canonical.planning.instrumentName), reason(language, canonical.planning.reasonCode), canonical.planning.status, planningSource, reason(language, canonical.planning.reasonCode)),
      building_regulations: section(reason(language, 'AUTHORITATIVE_DATA_REQUIRED'), c.planningDetail(canonical.planning.instrumentName), canonical.planning.status, planningAuthority, reason(language, canonical.planning.reasonCode)),
      environmental_factors: section(environmentText, canonical.environment.reasonCode ? reason(language, canonical.environment.reasonCode) : c.binding, canonical.environment.status, canonical.environment.sourceName, canonical.environment.reasonCode ? reason(language, canonical.environment.reasonCode) : undefined),
      infrastructure_and_access: section(roadText, canonical.infrastructure.reasonCode ? reason(language, canonical.infrastructure.reasonCode) : c.binding, canonical.infrastructure.status, canonical.infrastructure.sourceName, canonical.infrastructure.reasonCode ? reason(language, canonical.infrastructure.reasonCode) : undefined),
      market_and_comparables: section(valuationText, canonical.valuation.reasonCode ? reason(language, canonical.valuation.reasonCode) : c.landOnly, canonical.valuation.status, canonical.valuation.sourceName, canonical.valuation.reasonCode ? reason(language, canonical.valuation.reasonCode) : undefined),
      development_cost_outlook: section(reason(language, 'AUTHORITATIVE_DATA_REQUIRED'), checklist.map(item => item.reason).join(' '), 'REQUIRES_VERIFICATION')
    },
    evidenceRegistry,
    verificationChecklist: checklist,
    utilitiesChecklist,
    dataSources,
    legalDisclaimers: [...(canonical.support.maturity === 'LIMITED' ? [support] : []), c.preliminaryDisclaimer, c.landOnly, c.noAbsenceDisclaimer, c.modelDisclaimer, c.planningDisclaimer, c.sourceDisclaimer],
    valuationMethodology: `${valuationText} ${c.landOnly}`,
    technicalNarrative: { groundwater_depth_m: c.unavailable, groundwater_notice: canonical.support.capabilities.nationalHydrogeology ? reason(language, 'AUTHORITATIVE_DATA_REQUIRED') : reason(language, 'NOT_SUPPORTED_FOR_COUNTRY'), zoning_name: canonical.planning.instrumentName, max_far: c.unavailable, max_building_coverage_pct: c.unavailable, min_biologically_active_pct: c.unavailable, max_height_m: c.unavailable, utility_status: reason(language, 'AUTHORITATIVE_DATA_REQUIRED') },
    riskMatrix: [
      { category: c.riskNames.landslide, level: canonical.hazards.landslide.classification ? localRisk(c, canonical.hazards.landslide.classification) : c.unavailable, evidence_level: canonical.hazards.landslide.status, detail: canonical.hazards.landslide.classification ? localRisk(c, canonical.hazards.landslide.classification) : reason(language, 'SOURCE_UNAVAILABLE') },
      { category: c.riskNames.seismic, level: localClassification(c, canonical.hazards.seismic.classification), evidence_level: canonical.hazards.seismic.status, detail: localClassification(c, canonical.hazards.seismic.pga) },
      { category: c.riskNames.radon, level: localClassification(c, canonical.hazards.radon.classification), evidence_level: canonical.hazards.radon.status, detail: canonical.hazards.radon.classification ? localClassification(c, canonical.hazards.radon.classification) : reason(language, canonical.hazards.radon.reasonCode) },
      { category: c.riskNames.mining, level: localClassification(c, canonical.hazards.mining.classification), evidence_level: canonical.hazards.mining.status, detail: canonical.hazards.mining.classification ? localClassification(c, canonical.hazards.mining.classification) : reason(language, canonical.hazards.mining.reasonCode) }
    ],
    keyRisks: checklist.slice(0, 3).map(item => item.reason),
    opportunities: c.opportunities
  };
}

[executed on device: toma (e8359509-e325-4515-b2ff-2da47ff811ad)]