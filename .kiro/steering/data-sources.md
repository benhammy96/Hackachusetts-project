# Data sources

Authoritative registry: `pipeline/sources.py`. It generates
`public/data/meta.json`, which the provenance dialog renders. If you add a field
to the pipeline without adding it there, the UI will show it with no source and
the calibration test `names a verified source for every field that has data`
will fail.

Everything below was fetched live from the publisher. Nothing is hand-entered.

## Map context layers

| Layer                        | Source                    | Status   | Caveat                                                |
| ---------------------------- | ------------------------- | -------- | ----------------------------------------------------- |
| Lakes and major water bodies | MassGIS Major Hydrography | verified | local display layer; not used by the score            |
| Town and county labels       | MassGIS Census 2020 Towns | verified | local display layer; labels use representative points |

## Per-hex fields

| Field(s)                                         | Source                                                                         | Status           | Caveat                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------ | ---------------- | --------------------------------------------------------------------------------- |
| `town`                                           | MassGIS Census 2020 Towns                                                      | verified         | coastal cells fall back to the nearest town                                       |
| `d_tx69/115/345_km`                              | OpenStreetMap `power=line` with `voltage`, via Overpass                        | verified         | crowd-sourced, coverage incomplete, **distance ≠ capacity**                       |
| `d_clean_km`                                     | OpenStreetMap `power=plant`/`generator` with a hydro/wind/solar/nuclear source | **proxy**        | proximity is not procurement and not CES eligibility                              |
| `mlp_town`                                       | MassGIS Electricity Providers by Town                                          | **proxy**        | detected by provider-name pattern; a light plant does not establish clean supply  |
| `d_highway_km`                                   | MassGIS Major Highways                                                         | verified         | road access. **Not fiber.**                                                       |
| `d_fiber_km`                                     | —                                                                              | **unavailable**  | no licensed fiber-route dataset is wired in                                       |
| `land_class`, `land_use_name`, `land_cover_name` | MassGIS 2016 Land Cover / Land Use                                             | verified         | 2016 vintage; says nothing about zoning or availability                           |
| `pop_1km`                                        | MassGIS Census 2020 Blocks (`POP20`)                                           | modeled          | sums blocks whose Census internal point is within 1 km                            |
| `school_or_hospital_500m`                        | MassGIS Schools PK-12 (9 sublayers) + Hospitals                                | verified         |                                                                                   |
| `in_ej`, `near_ej_1mi`, `d_ej_km`, `ej_criteria` | MassGIS 2020 EJ Populations                                                    | verified         | the layer contains **only** EJ block groups, so it cannot supply total population |
| `water_stress`                                   | —                                                                              | **unavailable**  | no WRC stressed-basin or WRI Aqueduct join                                        |
| `in_sw_supply_watershed`                         | MassGIS Surface Water Supply Watersheds                                        | **proxy**        | water-supply sensitivity, not basin stress; not used as a score base              |
| `d_dw_zone2_km`                                  | MassDEP Zone II + IWPA                                                         | verified         |                                                                                   |
| `flood_100yr`, `flood_500yr`                     | FEMA NFHL via MassGIS                                                          | verified         | preliminary screen, not a flood determination                                     |
| `coastal_slr`                                    | NOAA / MA CZM sea level rise, ≤ 3 ft                                           | verified         | inundation extent, not a parcel assessment                                        |
| `brownfield`, `aul_site_500m`                    | MassDEP Activity and Use Limitation sites                                      | verified / proxy | an AUL indicates prior contamination, not developability                          |
| `developed_frac_1km`                             | derived from the land class of the H3 k-ring                                   | modeled          | res-8 neighbours sit ~0.9 km out                                                  |
| `excluded`, `exclude_reason`                     | union of the four hard screens                                                 | modeled          |                                                                                   |

## Economic inputs (`public/data/assumptions.json`)

| Input                                   | Source                                                               | Status         |
| --------------------------------------- | -------------------------------------------------------------------- | -------------- |
| Industrial electricity price            | EIA Electric Power Monthly Table 5.6.A, Massachusetts, current month | verified       |
| Grid CO2e output rate                   | EPA eGRID2023 Summary Tables, Table 1, NEWE subregion                | verified       |
| PUE, WUE, hours/year, construction $/MW | Atlas scenario inputs                                                | **assumption** |

A statewide sector average is not a negotiated large-load tariff. An annual
average output rate is not a marginal rate and is not market-based Scope 2.

## How the pipeline reaches big layers

MassGIS cannot return geometry for a multipoint query against a very large
layer, and MassGIS 2016 Land Cover / Land Use is 22.8 million polygons. So:

1. one multipoint request with `returnIdsOnly` gives the object ids of every
   feature touching a batch of up to 300 cell centres;
2. a second request fetches just those features with generalised geometry;
3. a local shapely STRtree gives the exact per-cell answer.

Two requests per 300 cells instead of 300. Distances are computed in
EPSG:26986, implemented in `pipeline/geo.py`.

Stages cache to `pipeline/.cache/`, so a rerun is cheap. Delete a cache file to
refetch one stage.

## Acquisition rules

- Record URL, publisher, vintage, licence and null count for every field.
- Never ship a paid API credential to the browser.
- Map overlays may be generalised for display; per-cell flags must come from
  full-resolution queries. `meta.json` states this.
- Nothing may set `for_sale` or imply availability. Atlas has no listing data.
