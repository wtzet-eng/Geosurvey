# Report reliability validation

Validated on 2026-08-20 against commit pending finalization. No deployment was performed.

## Method and result notation

The matrix exercises every configured national profile at representative capital-city coordinates in English (`en`), German (`de`), and Polish (`pl`). Two deterministic data conditions were used:

- **Available:** valid finite elevation, complete SoilGrids horizons, and valid OSM terrain/context features were injected. Planning remained `REQUIRES_VERIFICATION` because the pipeline does not query binding municipal plans. Radon and mining remained explicitly unavailable because no location-specific authoritative endpoint is implemented.
- **Unavailable:** outbound upstream calls failed. Terrain, soil, flood, infrastructure, environment, and planning correctly used honest fallbacks; valuation remained an explicitly `MODELLED` statistical estimate.

For every row below: HTTP status was 200; country and requested language matched; all 9 expected narrative sections were present; no `NaN`, `undefined`, generic “Regional Sedimentary Province,” unsupported “no mining,” or unsupported “low radon” claim appeared; localized section markers matched the requested language. Valid injected elevation (`100 m`) and soil data were preserved in the available-data response.

Dataset notation: `A` = available/modelled from valid injected data; `F` = honest fallback / requires verification; `M` = explicitly modelled valuation; `P` = planning requires official verification. Dataset order is **terrain, soil, flood, infrastructure, environment, planning, valuation**.

## Full country/language matrix

| Case | Representative coordinate | Available datasets | Available fallbacks | Unavailable datasets | Unavailable fallbacks | Sections | Misleading/fabricated | Localization |
|---|---:|---|---|---|---|---:|---|---|
| `DE-en` | `52.5200,13.4050` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `en` |
| `DE-de` | `52.5200,13.4050` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `de` |
| `DE-pl` | `52.5200,13.4050` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `pl` |
| `PL-en` | `52.2297,21.0122` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `en` |
| `PL-de` | `52.2297,21.0122` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `de` |
| `PL-pl` | `52.2297,21.0122` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `pl` |
| `GB-en` | `51.5074,-0.1278` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `en` |
| `GB-de` | `51.5074,-0.1278` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `de` |
| `GB-pl` | `51.5074,-0.1278` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `pl` |
| `FR-en` | `48.8566,2.3522` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `en` |
| `FR-de` | `48.8566,2.3522` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `de` |
| `FR-pl` | `48.8566,2.3522` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `pl` |
| `ES-en` | `40.4168,-3.7038` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `en` |
| `ES-de` | `40.4168,-3.7038` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `de` |
| `ES-pl` | `40.4168,-3.7038` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `pl` |
| `IT-en` | `41.9028,12.4964` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `en` |
| `IT-de` | `41.9028,12.4964` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `de` |
| `IT-pl` | `41.9028,12.4964` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `pl` |
| `NL-en` | `52.3676,4.9041` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `en` |
| `NL-de` | `52.3676,4.9041` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `de` |
| `NL-pl` | `52.3676,4.9041` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `pl` |
| `CH-en` | `47.3769,8.5417` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `en` |
| `CH-de` | `47.3769,8.5417` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `de` |
| `CH-pl` | `47.3769,8.5417` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `pl` |
| `AT-en` | `48.2082,16.3738` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `en` |
| `AT-de` | `48.2082,16.3738` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `de` |
| `AT-pl` | `48.2082,16.3738` | `A,A,A,A,A,P,M` | planning; radon; mining | `F,F,F,F,F,P,M` | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct `pl` |

## Partial, null, malformed, and non-finite cases

| Case | HTTP | Country | Language | Available datasets | Fallbacks | Sections | Misleading/fabricated | Localization |
|---|---:|---|---|---|---|---:|---|---|
| `partial-DE-en` | 200 | DE | en | terrain; valid empty OSM query; valuation | soil; road access; planning; radon; mining | 9/9 | none detected | correct |
| `partial-DE-de` | 200 | DE | de | terrain; valid empty OSM query; valuation | soil; road access; planning; radon; mining | 9/9 | none detected | correct |
| `partial-DE-pl` | 200 | DE | pl | terrain; valid empty OSM query; valuation | soil; road access; planning; radon; mining | 9/9 | none detected | correct |
| `malformed-FR-en` | 200 | FR | en | valuation | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct |
| `malformed-FR-de` | 200 | FR | de | valuation | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct |
| `malformed-FR-pl` | 200 | FR | pl | valuation | terrain; soil; flood; infrastructure; environment; planning; radon; mining | 9/9 | none detected | correct |
| `invalid coordinates / non-finite area` | 400 | request rejected | de | none | not applicable | not generated | no inferred data | localized report not applicable |

The malformed-upstream case supplied a mixed-type elevation array, incomplete SoilGrids layers, `null` OSM elements, and a `null` reverse-geocoder body. The invalid-input case supplied a non-numeric latitude and the string `Infinity` as area. Null upstream payloads follow the same validated fallback path as malformed and unavailable payloads.

## Remaining risks

- External services can change schemas, rate-limit, or time out; responses are now rejected rather than converted into apparently valid engineering values, but availability remains outside the application's control.
- Seismic values are broad Eurocode screening assumptions, not a location-specific national hazard-map query. They remain labelled `MODELLED`.
- Valuation remains a high-uncertainty statistical model with zero verified comparable deeds.
- Planning, cadastral title/boundaries outside supported official Polish responses, radon, mining, groundwater, utility capacity, and legal access require authoritative or on-site verification.
- The deterministic available-data matrix validates preservation and assembly behavior; it does not certify the accuracy or uptime of third-party production APIs.
