# Czechia national ground evidence

GeoSurvey treats the Czech Geological Survey (ČGS) sources below as separate evidence families. Mapped geology, engineering-geological zoning, hydrogeological mapping, registered boreholes and hazard maps are not interchangeable with site investigation or design geotechnical parameters.

## Automated sources

| Evidence family | Automated source | Use in GeoSurvey |
| --- | --- | --- |
| Geological mapping | ČGS GEOČR50, rock units layer 2: `https://mapy.geology.cz/arcgis/rest/services/Geologie/geologicka_mapa50/MapServer` | 1:50,000 mapped unit, lithology, genesis and age/context where supplied |
| Engineering geology | ČGS `IG_rajony50`: `https://mapy.geology.cz/arcgis/rest/services/Geohazardy/IG_rajony50/MapServer` | Prefer 1:50,000 engineering-geological zone; 1:500,000 layer is fallback only |
| Hydrogeology | ČGS HydroGEOČR50: `https://mapy.geology.cz/arcgis/rest/services/HydroGeologie/HG50_mapa/MapServer` | Prefer 1:50,000 hydrogeological unit / rock transmissivity context |
| Hydrogeology fallback | ČGS national hydrogeological zones: `https://mapy.geology.cz/arcgis/rest/services/HydroGeologie/HG_rajony/MapServer` | Upper/deep/base national zoning when no detailed HydroGEOČR50 feature is returned |
| Boreholes | ČGS borehole survey: `https://mapy.geology.cz/arcgis/rest/services/Prozkoumanost/Vrtna_prozkoumanost/MapServer` | General boreholes plus hydrogeological-data subset within 5 km; nearest distance is contextual |
| Landslide susceptibility | ČGS `sesuvna_nachylnost`: `https://mapy.geology.cz/arcgis/rest/services/Geohazardy/sesuvna_nachylnost/MapServer` | Official low / medium / high susceptibility class |
| Mapped slope deformation | ČGS `svahove_deformace`: `https://mapy.geology.cz/arcgis/rest/services/Geohazardy/svahove_deformace/MapServer` | Field-verified deformation polygon intersecting the selected coordinate; intersection escalates the screening warning |
| Radon | ČGS complex radon information: `https://mapy.geology.cz/arcgis/rest/services/Geohazardy/radon_komplexni_informace/MapServer` | Area-level geological radon index 1/2/3 mapped to Low/Moderate/High; building-measurement statistics remain contextual |
| Mining | ČGS undermined areas: `https://mapy.geology.cz/arcgis/rest/services/Dulni_Dila/poddolovana_uzemi/MapServer` | Registered undermined-area intersection at the site coordinate |

ČGS web-service directory: `https://cgs.gov.cz/en/maps-and-data/web-services`

## Evidence hierarchy and limitations

1. GEOČR50 geology is authoritative mapped geological evidence, but it is not parcel stratigraphy.
2. The 1:50,000 engineering-geological zoning is construction-relevant screening context, but it does not provide design parameters.
3. HydroGEOČR50 is preferred where available; broader national hydrogeological zones are explicitly marked as fallback context.
4. Nearby boreholes remain nearby observations. A 5 km registry search never implies that a returned log describes the selected parcel.
5. Landslide susceptibility and a field-verified mapped slope deformation are retained separately. An actual mapped deformation intersecting the selected coordinate is treated as the stronger screening warning.
6. Radon and undermined-area layers are screening constraints, not measurements of the selected building or predictions of settlement/subsidence.
7. Source failure or an empty service result remains `REQUIRES_VERIFICATION`; absence is not inferred from a failed or incomplete desktop query.

## Deliberately not inferred

The Czechia pack does **not** infer or populate parcel-specific bearing capacity, cohesion, friction angle, density/consistency, settlement, groundwater depth, inflow rate, dewatering requirement, foundation type or foundation design from these national maps or nearby records.

## Current country capability scope

Automated in this pack:

- national geology
- national borehole context
- national hydrogeology
- national radon screening
- national mining/undermined-area screening
- national landslide susceptibility and mapped slope-deformation evidence (reported through the geohazard pathway)

Still requires separate validated integration:

- cadastral/building register acquisition
- statutory flood mapping
- binding planning/buildability
- land valuation

Czechia therefore remains a **LIMITED** country pack even though its national ground evidence is comparatively strong.
