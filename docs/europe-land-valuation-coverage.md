# European land valuation coverage

GeoSurvey does not use a generic European land-price baseline.

A country may expose an automated land value only when a calibrated, land-specific evidence source has been implemented. The preferred hierarchy is the most local defensible benchmark available, then broader regional evidence, then a dated national fallback. Broader tiers carry wider uncertainty. Buildings, structures and other improvements are excluded throughout.

## Current calibrated valuation paths

- Poland — RCN/Cenatorium building-land transaction benchmarks: city → voivodeship → national.
- Germany — Destatis/Regionaldatenbank baureifes Land: city → Bundesland → national.
- France — Cerema DVF+ buildable-land-signalled transactions: nearby → commune; no generic fallback.
- United Kingdom — England-only MHCLG local-authority residential land policy-appraisal benchmark; Scotland, Wales and Northern Ireland fail closed.
- Slovakia — residential/building-plot asking benchmarks: city → kraj → national; explicitly not transaction evidence.
- Austria — Statistik Austria 2025 buildable-plot national benchmark; very wide uncertainty until finer automated geography is integrated.
- Spain — MIVAU registered urban/developable-land statistics: province where resolvable → dated national fallback.
- Finland — Statistics Finland single-family-house plot transaction statistics: Greater Helsinki where applicable → national; source failure fails closed.
- Ireland — CSO Residentially Zoned Land Prices: county where published → national transaction median.

## All other European countries

Automated valuation is disabled until a current land-specific source is calibrated. House-price series, agricultural-land prices, stale building-plot series and generic cross-country averages are not substituted.
