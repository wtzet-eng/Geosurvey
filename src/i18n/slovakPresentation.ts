export const localizeSlovakEvidenceValue = (value: unknown): string => {
  const text = String(value ?? '').trim();
  const exact: Record<string,string> = {
    'Terrain & Topography':'Terén a topografia',
    'Cross-border hydrology context':'Regionálny hydrologický kontext',
    'Soil model':'Model pôdy',
    'Infrastructure & Access':'Infraštruktúra a prístup',
    'Environmental & Conservation':'Životné prostredie a ochrana prírody',
    'Market Valuation & Economics':'Trh a oceňovanie pozemku',
    'Pedological spatial context':'Priestorový pedologický kontext',
    'Mapped geology':'Mapovaná geológia',
    'Hydrogeological context':'Hydrogeologický kontext',
    'Ground hazards':'Geologické riziká',
    'Country support scope':'Rozsah podpory krajiny',
    'Nearest public road corridor unconfirmed in open dataset':'Najbližší koridor verejnej cesty nebol potvrdený v otvorenom dátovom zdroji.',
    'SoilGrids query unavailable; no soil texture or engineering properties inferred.':'Dotaz SoilGrids nebol dostupný; nebola odvodená textúra pôdy ani inžinierske vlastnosti.',
    'Environmental spatial query unavailable; no protected-area overlap or distance conclusion was inferred.':'Environmentálny priestorový dotaz nebol dostupný; nebol odvodený záver o prekrytí s chráneným územím ani o vzdialenosti.',
    'The official slope-deformation susceptibility layer did not return a usable site feature.':'Oficiálna vrstva náchylnosti na svahové deformácie nevrátila použiteľný prvok pre túto lokalitu.'
  };
  if (exact[text]) return exact[text];

  const elevation = text.match(/^Mean elevation ([\d.,-]+) m a\.s\.l\. with slope gradient of ([\d.,-]+)° \((.+)\)$/i);
  if (elevation) {
    const slopeClass = elevation[3]
      .replace(/^Flat/i,'Rovinatý')
      .replace(/^Gentle/i,'Mierny')
      .replace(/^Moderate/i,'Stredný')
      .replace(/^Steep/i,'Strmý')
      .replace(/^Very steep/i,'Veľmi strmý');
    return `Priemerná nadmorská výška ${elevation[1]} m n. m. so sklonom ${elevation[2]}° (${slopeClass})`;
  }

  if (/^Hydrology proximity data is not available because the spatial query did not complete/i.test(text)) {
    return 'Údaje o blízkosti hydrologických prvkov nie sú dostupné, pretože priestorový dotaz sa nedokončil. Nebola odvodená žiadna klasifikácia povodňového rizika.';
  }

  const samples = text.match(/^SoilGrids returned (\d+) usable model samples across the selected geometry and vicinity\.?$/i);
  if (samples) return `SoilGrids vrátil ${samples[1]} použiteľných modelových vzoriek pre vybranú geometriu a jej okolie.`;

  const valuation = text.match(/^Indicative Slovak land asking-price benchmark: approximately (.+?), based on Trnavský kraj regional residential\/building-plot asking benchmark\.?$/i);
  if (valuation) return `Orientačný slovenský benchmark ponukových cien pozemkov: približne ${valuation[1]}, na základe regionálneho benchmarku ponukových cien rezidenčných/stavebných pozemkov v Trnavskom kraji.`;

  const geology50 = text.match(/^ŠGÚDŠ 1:50,000 geology maps the selected coordinate as (.+)$/i);
  if (geology50) return `Geologická mapa ŠGÚDŠ 1 : 50 000 zobrazuje vybranú polohu ako ${geology50[1]}`;

  const geology200 = text.match(/^ŠGÚDŠ 1:200,000 descriptive geology maps the site as (.+)$/i);
  if (geology200) return `Opisná geologická mapa ŠGÚDŠ 1 : 200 000 zobrazuje lokalitu ako ${geology200[1]}`;

  return text
    .replace(/^(.+?) Spatial Planning Authority \(/i, '$1 — príslušný orgán územného plánovania (')
    .replace(/^(.+?) competent local planning authority$/i, '$1 — príslušný miestny orgán územného plánovania');
};
