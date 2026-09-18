import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localizeSlovakEvidenceValue } from './slovakPresentation';

test('Slovak report uses the decision-first introduction', () => {
  const source = readFileSync(new URL('../components/ReportViewSlovak.tsx', import.meta.url), 'utf8');
  assert.match(source, /decisionIntroCopy\('sk'\)/);
  assert.match(source, /buyerSummary\(/);
  assert.match(source, /plainSummary/);
  assert.doesNotMatch(source, />Predbežné posúdenie lokality<\/h1>/);
});

test('Slovak evidence audit localizes generated English presentation while preserving source identity', () => {
  const cases: Array<[string, RegExp]> = [
    ['Terrain & Topography', /Terén a topografia/],
    ['Mean elevation 123 m a.s.l. with slope gradient of 0.8° (Flat (0-2°))', /Priemerná nadmorská výška 123 m n\. m\..*Rovinatý/],
    ['Cross-border hydrology context', /Regionálny hydrologický kontext/],
    ['Hydrology proximity data is not available because the spatial query did not complete. No flood-risk classification has been inferred.', /Údaje o blízkosti hydrologických prvkov/],
    ['Soil model', /Model pôdy/],
    ['SoilGrids query unavailable; no soil texture or engineering properties inferred.', /Dotaz SoilGrids nebol dostupný/],
    ['Infrastructure & Access', /Infraštruktúra a prístup/],
    ['Nearest public road corridor unconfirmed in open dataset', /Najbližší koridor verejnej cesty/],
    ['Environmental & Conservation', /Životné prostredie a ochrana prírody/],
    ['Environmental spatial query unavailable; no protected-area overlap or distance conclusion was inferred.', /Environmentálny priestorový dotaz/],
    ['Market Valuation & Economics', /Trh a oceňovanie pozemku/],
    ['Indicative Slovak land asking-price benchmark: approximately 231,952–744,688 € (~76 €/m²), based on Trnavský kraj regional residential/building-plot asking benchmark.', /Orientačný slovenský benchmark.*približne 231,952–744,688/],
    ['Pedological spatial context', /Priestorový pedologický kontext/],
    ['SoilGrids returned 1 usable model samples across the selected geometry and vicinity.', /SoilGrids vrátil 1 použiteľných modelových vzoriek/],
    ['Mapped geology', /Mapovaná geológia/],
    ['ŠGÚDŠ 1:50,000 geology maps the selected coordinate as fluviálne sedimenty', /Geologická mapa ŠGÚDŠ 1 : 50 000.*fluviálne sedimenty/],
    ['ŠGÚDŠ 1:200,000 descriptive geology maps the site as sedimenty neogénu a kvartéru', /Opisná geologická mapa ŠGÚDŠ 1 : 200 000.*sedimenty neogénu a kvartéru/],
    ['Ground hazards', /Geologické riziká/],
    ['The official slope-deformation susceptibility layer did not return a usable site feature.', /Oficiálna vrstva náchylnosti na svahové deformácie/],
    ['Galanta Spatial Planning Authority (ÚPN)', /Galanta — príslušný orgán územného plánovania/],
    ['Galanta competent local planning authority', /Galanta — príslušný miestny orgán územného plánovania/]
  ];

  for (const [input, expected] of cases) assert.match(localizeSlovakEvidenceValue(input), expected);

  const officialSource = 'Štátny geologický ústav Dionýza Štúra (ŠGÚDŠ / GeoIS)';
  assert.equal(localizeSlovakEvidenceValue(officialSource), officialSource);
});
