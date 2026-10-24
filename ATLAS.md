# Atlas

Explore Massachusetts for potential data center sites, discover candidate parcels, and evaluate grid, water, climate, land, community and cost tradeoffs with an explainable 0–10 screening score.

Built for the Climate Tech track (6 hours). This is a phased product and build spec: a six-hour core demo plus optional real-parcel discovery, cost estimation and regression research. Hand it to Kiro to generate specs and tasks.

**Evidence warning:** Legal assertions (including EO 658 and its thresholds), API availability, licensing, dataset update dates and access permissions must be verified against primary sources before being represented as fact in the UI. The original project narrative is preserved as a hypothesis pending verification.

---

## 1. Context

- Massachusetts Executive Order 658 (signed September 8, 2026) requires data centers above **25 MW** peak demand to procure new clean electricity (Clean Energy Standard eligible) to match annual use, or pay into a **Ratepayer Protection Fund**. It also requires **community approval** and **water and air protections**. The DPU will create large-load rate schedules so other ratepayers do not pay for grid upgrades.
- The state paused its data center sales tax exemption in June 2026 and is on track for its first hyperscale AI data center.
- No tool lets a resident, town, or developer click a spot in Massachusetts and see if it is a good or bad place for a data center, and why.

## 2. Users

| User | Question | What Atlas gives them |
| --- | --- | --- |
| Resident or select board | Should we fight or welcome this proposal? | Plain-language brief and score breakdown |
| Developer or utility planner | Where can we build without a long fight? | Fatal-flaw screening and EO 658 checklist |
| State planner or journalist | Where should MA steer data centers? | Statewide heat map of best and worst zones |

## 3. Goals and non-goals

**Goals**
- Click anywhere in MA, pick a size, get an explainable score in under 200 ms.
- Show both lenses (Buildability and Community) and where they disagree.
- Generate a town-meeting brief in 6 languages with an EO 658 checklist.
- Look polished on a projector and in a 90-second LinkedIn video.

**Non-goals**
- Parcel-level legal or engineering accuracy (candidate parcel mode is screening only).
- Real interconnection queue data or utility hosting capacity.
- User accounts, saving sites, or a database in the six-hour MVP; PostGIS is a later option.

---

## 4. Scoring model

### 4.1 Formula

```
B = 10 * sum(w_i * f_i) / sum(w_i)        over Buildability factors with data
C = 10 * sum(w_j * f_j) / sum(w_j)        over Community factors with data
X = 0 if any hard exclusion, else 1
a = 0.50 (Balanced) | 0.35 (Resident) | 0.65 (Developer)

Atlas = min(10, X * B^a * C^(1 - a) + bonus)
```

- Every factor value `f` is in [0, 1], 1 is best.
- A factor with missing data is dropped from numerator and denominator. Missing data never reads as "bad site".
- Balanced lens (a = 0.5) is the plain geometric mean: a site that is 10 for developers and 2 for neighbors scores 4.5, not 6.
- Round the displayed score to one decimal.

### 4.2 Factors

| Lens | Factor | Weight | Formula for f (0 to 1) |
| --- | --- | --- | --- |
| Buildability | Grid access | 35 | `clamp(1 - (d_km - 1) / 14)` where `d_km` is distance to a transmission line at the required voltage (see 4.3) |
| Buildability | Clean power access | 25 | `clamp(1 - d_clean_km / 30)`, +0.2 if in a municipal light plant town. If MW <= 25, `f = max(f, 0.6)` (EO 658 not triggered) |
| Buildability | Fiber and latency | 20 | `clamp(1 - d_fiber_km / 20)` |
| Buildability | Land readiness | 20 | By land class: industrial 1.0, brownfield 1.0, commercial 0.8, other developed 0.5, agriculture 0.3, forest 0.1, residential 0.0 |
| Community | Residents nearby | 30 | `clamp(1 - pop_1km / P)` where P = 8000 (5 MW), 5000 (25 MW), 3000 (100 MW), 1500 (300 MW). Subtract 0.3 if a school or hospital is within 500 m |
| Community | Environmental justice | 30 | In an EJ block group: 0.0. Within 1 mile of one: 0.4. Else `0.6 + 0.4 * clamp(d_ej_km / 8)` |
| Community | Water | 20 | `base = 1 - water_stress` (stressed 0.7, medium 0.4, low 0.1). Subtract 0.3 if within 1 km of a drinking water Zone II. If cooling is evaporative, subtract `0.3 * mw / 300` |
| Community | Climate risk | 20 | 0.5 if in the 0.2% (500-year) floodplain, 0.4 if in coastal sea level rise exposure, else 1.0. Take the minimum |

`clamp(x)` means clamp to [0, 1].

### 4.3 Size scaling (MW presets)

| Preset | MW | Required transmission voltage | EO 658 applies |
| --- | --- | --- | --- |
| Edge | 5 | 69 kV or higher | No |
| Enterprise | 25 | 69 kV or higher | No (threshold is above 25 MW) |
| Campus | 100 | 115 kV or higher | Yes |
| Hyperscale | 300 | 345 kV or higher | Yes |

These voltage thresholds are our modeling assumptions, not engineering rules. Say so in the UI tooltip.

### 4.4 Hard exclusions (X = 0, shown as "Fatal flaw" with the reason)

1. Permanently protected open space (protection level P) or Article 97 land
2. Wetlands or open water
3. FEMA 1% annual chance (100-year) floodplain
4. Drinking water Zone I or Zone A

### 4.5 Bonuses (total capped at +1.0)

- +0.5 brownfield or previously developed industrial land
- +0.3 closed-loop or air cooling selected
- +0.2 waste heat reuse possible (building density within 1 km above threshold)

### 4.6 Score bands

| Score | Label | Color |
| --- | --- | --- |
| 8.0 to 10 | Strong site | Green `#22C55E` |
| 6.0 to 7.9 | Workable with conditions | Lime `#A3E635` |
| 4.0 to 5.9 | Contested: expect a fight | Amber `#F5A524` |
| 0.1 to 3.9 | Do not build here | Red `#E5484D` |
| 0 | Fatal flaw | Zinc `#3F3F46` |

### 4.7 Invariants (must be property-tested)

- Score is always in [0, 10].
- Any exclusion gives a score of exactly 0.
- Moving a site into an EJ block group never raises the score.
- Increasing MW never raises the grid factor or the residents factor at the same hex.
- Switching cooling from evaporative to closed-loop never lowers the score.
- Every factor value is in [0, 1].

### 4.8 Calibration sites (must be unit-tested)

| Site | Approx. lat, lng | MW | Expected |
| --- | --- | --- | --- |
| Holyoke, near MGHPCC (100 Bigelow St) | 42.2025, -72.6079 | 100 | 6.0 or higher. Note: downtown Holyoke has EJ block groups, so "Contested" is acceptable; if so, the demo story becomes "even the state's model green data center would face hard questions today" |
| Chelsea, residential | 42.3918, -71.0328 | 100 | Below 4.0 |
| Quabbin Reservoir | 42.3800, -72.2900 | any | Exactly 0, reason "Protected drinking water" |

Design principle: **environmental justice is a protection, never an advantage.** Low-income or cheap land in a burdened neighborhood must always lower the score.

---

## 5. Data

### 5.1 Hex grid

- H3 resolution 8 (about 0.74 km² per hex), clipped to the Massachusetts boundary.
- Store **raw values**, not scores. The browser computes scores so sliders are instant.

### 5.2 `public/data/hexes.json` schema

```json
{
  "h3": "882a306a2bfffff",
  "lat": 42.2025,
  "lng": -72.6079,
  "town": "HOLYOKE",
  "d_tx69_km": 0.8,
  "d_tx115_km": 1.9,
  "d_tx345_km": 6.4,
  "d_clean_km": 0.5,
  "mlp_town": true,
  "d_fiber_km": 2.1,
  "land_class": "industrial",
  "pop_1km": 2100,
  "school_or_hospital_500m": false,
  "in_ej": false,
  "near_ej_1mi": true,
  "d_ej_km": 0.6,
  "water_stress": 0.1,
  "d_dw_zone2_km": 3.0,
  "flood_500yr": false,
  "coastal_slr": false,
  "bldg_density_1km": 0.42,
  "brownfield": true,
  "excluded": false,
  "exclude_reason": null
}
```

Use `null` for any value with no data. If the file exceeds about 5 MB, switch to PMTiles.

### 5.3 Sources

| Field(s) | Dataset | Fallback |
| --- | --- | --- |
| `d_tx*_km` | OpenStreetMap `power=line` with `voltage` tag (Overpass API) | HIFLD transmission lines archive (HIFLD Open was deactivated Aug 26, 2025) |
| `d_clean_km`, `mlp_town` | EIA-860 plant list; MassGIS Public Utility Service Providers | ~15 hand-entered clean generation points |
| `d_fiber_km` | MassGIS / MassDOT interstate centerlines (I-90, I-95/128, I-495, I-91) | OSM `highway=motorway` |
| `land_class`, `brownfield` | MassGIS 2016 Land Cover/Land Use | OSM `landuse=*` |
| `pop_1km`, `in_ej`, `near_ej_1mi`, `d_ej_km` | MassGIS 2020 Environmental Justice Populations (includes TOTAL_POP) | Census API block groups |
| `school_or_hospital_500m` | MassGIS schools and hospitals | OSM `amenity=school|hospital` |
| `water_stress`, `d_dw_zone2_km` | MassGIS drainage sub-basins + WRC Stressed Basins; MassDEP Zone II / Zone A | WRI Aqueduct baseline water stress |
| `flood_500yr`, `coastal_slr` | FEMA National Flood Hazard Layer | Elevation under 3 m within 2 km of coast |
| `excluded` (open space) | MassGIS Protected and Recreational OpenSpace (has Article 97 field), EEA ArcGIS REST service | OSM `boundary=protected_area` |
| `excluded` (wetlands) | MassDEP Wetlands | OSM `natural=wetland` |

### 5.4 Pipeline (`pipeline/build_hexes.py`)

1. Load the MA boundary; `h3.polygon_to_cells(boundary, 8)`; compute centroids.
2. For line and point layers: GeoPandas `sjoin_nearest` to get distances in km (project to EPSG:26986, MA State Plane meters).
3. For polygon layers: `sjoin` with `predicate="intersects"` for flags.
4. `pop_1km`: sum block group population weighted by area overlap with a 1 km buffer.
5. Write `public/data/hexes.json`. Print row count and a summary of nulls per column.

---

## 6. Requirements (EARS format)

### 6.1 Map

- WHEN the app loads, THE SYSTEM SHALL fly the camera from the Berkshires to Boston at a 50 degree pitch within 4 seconds.
- THE SYSTEM SHALL render every hex as an extruded 3D column whose height and color both encode the score.
- WHEN the user selects an MW preset, THE SYSTEM SHALL rescore and recolor all hexes within 300 ms.
- WHEN the user clicks the map, THE SYSTEM SHALL snap the click to its H3 cell, drop a 3D building footprint scaled to the MW, draw a 1 km ring, and draw an arc to the nearest qualifying transmission line.
- WHEN the user clicks outside Massachusetts, THE SYSTEM SHALL show "Pick a spot inside Massachusetts".
- THE SYSTEM SHALL provide layer toggles for transmission lines, EJ block groups, protected land, and flood zones.

### 6.2 Score card

- WHEN a site is selected, THE SYSTEM SHALL show the score with a count-up animation, its band label and color, and any bonus applied.
- THE SYSTEM SHALL show Buildability and Community as two bars with values.
- WHEN Buildability and Community differ by 3 or more, THE SYSTEM SHALL show a callout naming the weakest factor.
- THE SYSTEM SHALL list all eight factors with value, a mini bar, and the raw fact behind it (for example "Nearest 345 kV line: 3.2 km").
- IF the site is excluded, THEN THE SYSTEM SHALL show score 0, the "Fatal flaw" label, and the exclusion reason at the top.
- WHEN the user changes lens, cooling, or MW, THE SYSTEM SHALL update the card without a network call.

### 6.3 Town-meeting brief agent

- WHEN the user clicks "Write town-meeting brief", THE SYSTEM SHALL stream a brief from `/api/brief` with three sections: What the score means, What EO 658 requires at this size, Questions to ask the developer (exactly 5).
- WHEN the user picks a language (EN, ES, PT, HT, VI, ZH, SQ), THE SYSTEM SHALL regenerate the brief in that language.
- THE SYSTEM SHALL ground every number in the brief in tool results; it SHALL NOT invent figures.
- IF Bedrock is unavailable, THEN THE SYSTEM SHALL serve a cached brief for the three calibration sites and show a small "offline" tag.

### 6.4 Find a better spot

- WHEN the user clicks "Find a better spot", THE SYSTEM SHALL return the top 3 non-excluded hexes within 25 km with a higher score, fly to each in turn, and show a one-line reason for each.

### 6.5 Compare (stretch)

- WHEN the user pins two sites, THE SYSTEM SHALL show their score cards side by side with differences highlighted.

---

## 7. UI spec

### 7.1 Layout (1280 x 720 target)

```
+--------------------------------------------------------------------------------+
| Atlas   [5 MW] [25 MW] [100 MW] [300 MW]        ( Resident|Balanced|Dev ) |
+-------------------------------------------------+------------------------------+
|                                                 |  Holyoke, MA                 |
|   [Your site]   [Quabbin: fatal]   [Boston]     |  Campus 100 MW, evaporative  |
|                                                 |                              |
|        3D extruded H3 hex map                   |  8.5 / 10      (Strong site) |
|        (dark basemap, 50 degree pitch)          |  +0.5 brownfield bonus       |
|                                                 |  Buildability  ========== 9.0|
|        dropped building + 1 km ring             |  Community     =======    7.1|
|        arc to nearest transmission line         |  [!] EJ block groups < 1 mi  |
|                                                 |                              |
|                                                 |  Why this score              |
|                                                 |  Grid access        ==  0.85 |
|   Legend: Strong | Workable | Contested |       |  Clean power        ==  0.97 |
|           Do not build | Fatal flaw             |  ... 8 rows ...              |
|   Layers: [Lines] [EJ] [Protected] [Flood]      |  [ Write town-meeting brief ]|
|                                                 |  [ Find a better spot ]      |
+-------------------------------------------------+------------------------------+
```

The brief opens as a slide-over panel on top of the score card, with language chips in its header.

### 7.2 Design tokens

| Token | Value |
| --- | --- |
| Background | `#0A0B0D` |
| Surface (glass) | `rgba(255,255,255,0.06)` with `backdrop-filter: blur(16px)` |
| Border | `rgba(255,255,255,0.10)` |
| Text | `#F5F5F5` |
| Muted text | `#A1A1AA` |
| Accent (hackathon orange) | `#F0A93B` |
| Score ramp | `#E5484D` red, `#F5A524` amber, `#A3E635` lime, `#22C55E` green, `#3F3F46` fatal |
| Display font | Anton (Google Fonts), uppercase, for the app name and the big score |
| Body font | Inter |
| Radius | 12 px panels, 999 px chips |

### 7.3 Accessibility

- Never use color alone: every band shows its label text.
- All controls reachable by keyboard; visible focus ring in the accent color.
- Text contrast at least 4.5:1 on the dark background.
- Brief text at a 6th to 8th grade reading level.

---

## 8. Architecture

```
pipeline/build_hexes.py  --->  public/data/hexes.json
                                     |
Browser (Next.js)                    v
  MapLibre + deck.gl  --->  lib/score.ts (pure, client-side)  --->  Score card
                                                                      |
Server (Next.js API route)                                            v
  /api/brief  --->  Claude on Amazon Bedrock (Converse API, tool use)
                      tools: get_site_score, get_eo658_checklist, find_alternatives
```

### 8.1 Stack

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Map | MapLibre GL JS, deck.gl (`H3HexagonLayer` extruded, `PolygonLayer` extruded for the building, `ArcLayer`, `PathLayer`) |
| Basemap | CARTO Dark Matter (or MapTiler dark) |
| Geo | h3-js, @turf/turf |
| Data prep | Python 3.11, geopandas, h3, shapely, requests (Overpass) |
| AI | Amazon Bedrock, Claude model, Converse API with tool use (`@aws-sdk/client-bedrock-runtime`) |
| Tests | Vitest, fast-check |
| Hosting | AWS Amplify Hosting (Vercel as backup) |

### 8.2 API contract

`POST /api/brief`

```json
{ "h3": "882a306a2bfffff", "mw": 100, "cooling": "evaporative", "lens": "balanced", "lang": "en" }
```

Response: `text/event-stream` of markdown.

Tools the agent can call (all run server-side using the same `lib/score.ts` and `hexes.json`):

| Tool | Input | Output |
| --- | --- | --- |
| `get_site_score` | `h3, mw, cooling, lens` | Full score card: score, band, B, C, factors with raw facts, bonuses, exclusion |
| `get_eo658_checklist` | `mw` | List of requirements that apply at that size (empty list at 25 MW or below, with a note) |
| `find_alternatives` | `h3, mw, cooling, lens, radius_km = 25, k = 3` | Top k higher-scoring, non-excluded hexes with town, score, and one-line reason |

System prompt rules: plain language, no invented numbers, cite factor names, exactly 5 questions, end with "Scores are a planning aid, not a permitting decision."

---

## 9. Repo structure

```
atlas/
  .kiro/
    steering/  product.md  tech.md  structure.md  scoring.md  data-sources.md  design.md
    specs/     score-engine/  hex-map/  site-brief-agent/  data-pipeline/
    hooks/
  pipeline/build_hexes.py
  public/data/hexes.json
  public/data/briefs-cache.json
  app/page.tsx
  app/api/brief/route.ts
  components/Map.tsx  ScoreCard.tsx  FactorRow.tsx  BriefPanel.tsx  TopBar.tsx  Legend.tsx
  lib/score.ts  lib/weights.ts  lib/eo658.ts  lib/hexes.ts
  tests/score.test.ts  tests/score.property.test.ts  tests/calibration.test.ts
  README.md
```

---

## 10. Kiro setup

### 10.1 Specs to create (in this order)

1. **score-engine**: `lib/score.ts`, `lib/weights.ts`, `lib/eo658.ts` and all tests from sections 4.7 and 4.8.
2. **data-pipeline**: `pipeline/build_hexes.py` producing the schema in 5.2.
3. **hex-map**: requirements 6.1 and 6.2.
4. **site-brief-agent**: requirements 6.3 and 6.4.

### 10.2 Hooks

| Trigger | Action |
| --- | --- |
| Save `lib/score.ts` | Run Vitest: unit, property, and calibration tests |
| Save `.kiro/steering/scoring.md` | Regenerate `lib/weights.ts` from the weights table, then run tests |
| Create a file in `components/` | Review for accessibility rules in `design.md` |
| Save `pipeline/*.py` | Update `data-sources.md` with any new `hexes.json` field |

### 10.3 MCP servers

- Fetch (dataset metadata and docs)
- AWS Documentation (Bedrock, Amplify)
- Playwright, optional (click through the golden path)

---

## 11. Build plan (6 hours, 4 roles)

| Time | Data | Map and UI | Score engine | Agent and story |
| --- | --- | --- | --- | --- |
| 0:00 to 0:30 | Start Overpass and EJ downloads | Scaffold Next.js, Tailwind, deck.gl | Steering files (everyone) | Confirm Bedrock access |
| 0:30 to 2:00 | First `hexes.json` with 3 factors by 1:15 | 3D hex layer, click handler, MW chips | `score.ts` + invariant tests green | `/api/brief` stub |
| 2:00 to 3:30 | Remaining factors and exclusions | Score card, factor rows, building drop | Calibration tests, tune weights | Real tools and brief |
| **3:30** | **Checkpoint: full golden path works** | | | |
| 3:30 to 5:00 | QA 10 random hexes | flyTo, count-up, lens toggle | Steering-to-weights hook | Languages, Find a better spot |
| 5:00 to 5:30 | Freeze; cache demo briefs | Final visual pass at 1280 x 720 | README | Rehearse demo twice |
| 5:30 to 6:00 | Record 90 s video, submit | | | |

**Cut order if behind:** Compare mode, then languages (keep EN + ES), then weight sliders (keep lens presets), then Find a better spot, then statewide coverage (fall back to Greater Boston + Pioneer Valley).

**Never cut:** 3D hex map, click to score, factor breakdown, town-meeting brief.

---

## 12. Task checklist

- [ ] Write the six steering files in `.kiro/steering/`
- [ ] Implement `lib/weights.ts` from `scoring.md`
- [ ] Implement factor functions and `score()` in `lib/score.ts`
- [ ] Implement `lib/eo658.ts` checklist by MW
- [ ] Unit tests for each factor function
- [ ] Property tests for every invariant in 4.7
- [ ] Calibration tests for the three sites in 4.8
- [ ] Build `pipeline/build_hexes.py` and generate `hexes.json`
- [ ] Map component with extruded H3 layer and dark basemap
- [ ] Opening camera fly-in
- [ ] MW preset chips that rescore the map
- [ ] Click to drop site: building, 1 km ring, arc to line
- [ ] Score card with count-up, band, bars, callout
- [ ] Factor rows with raw facts
- [ ] Lens toggle and cooling toggle
- [ ] Layer toggles and legend
- [ ] `/api/brief` route with Bedrock Converse and three tools
- [ ] Brief panel with streaming and language chips
- [ ] Find a better spot with camera fly-through
- [ ] Cached briefs for offline fallback
- [ ] Hooks configured in `.kiro/hooks/`
- [ ] README with formula, data table, screenshots
- [ ] Deploy to Amplify
- [ ] Record 90-second demo video

---

## 13. Demo script (3 minutes)

| Time | Say | Do |
| --- | --- | --- |
| 0:00 | "Six weeks ago Massachusetts required every big data center to win community approval and bring its own clean power. Nobody has a tool to tell a town if a site is good or bad. We built one." | Fly-in over the 3D map |
| 0:30 | "Let's put a 100 MW campus in Holyoke." | Click Holyoke; score lands |
| 0:50 | "That's where BU, MIT, and Harvard already run research computing, on river hydropower." | Point at the factors |
| 1:05 | "Same building in Chelsea." | Click Chelsea; red; read the callout |
| 1:30 | "What should residents ask?" | Generate brief; switch to Spanish |
| 1:50 | "And Quabbin?" | Click; Fatal flaw |
| 2:05 | "Built spec-first in Kiro." | Show `.kiro/`; edit a weight in `scoring.md`; hook regenerates code; map reshapes |
| 2:40 | "Any of 351 towns can use this before a developer knocks." | Close on statewide map |

---

## 14. Definition of done

- All tests in `tests/` pass.
- The three calibration clicks produce the expected bands.
- The golden path works offline with cached briefs.
- Deployed URL loads in under 3 seconds on venue Wi-Fi.
- `.kiro/` folder (steering, specs, hooks) committed and visible in the repo.

---

## 15. Sources

- EO 658: https://www.mass.gov/executive-orders/no-658-establishing-requirements-for-responsible-data-center-development-and-operations-in-massachusetts-to-protect-and-support-ratepayers-communities-and-the-environment
- EO 658 summary: https://taiyangnews.info/markets/massachusetts-sets-clean-energy-rules-for-data-centers
- MA tax exemption pause and framework: https://blog.greenenergyconsumers.org/blog/data-centers-ma
- MassGIS 2020 EJ Populations: https://www.mass.gov/info-details/massgis-data-2020-us-census-environmental-justice-populations
- MassGIS Protected and Recreational OpenSpace: https://www.mass.gov/info-details/massgis-data-protected-and-recreational-openspace
- MassGIS 2016 Land Cover/Land Use: https://www.mass.gov/info-details/massgis-data-2016-land-coverland-use
- Stressed Basins report: https://www.mass.gov/stressed-basins-in-massachusetts-report
- HIFLD transmission lines archive: https://www.datalumos.org/datalumos/project/240591/version/V1/view
- MGHPCC: https://en.wikipedia.org/wiki/Massachusetts_Green_High_Performance_Computing_Center
- Prior art, dc-siting (H3 suitability map): https://github.com/ajay1808/dc-siting


---

## 16. Expanded Atlas: real parcel discovery and development intelligence

### 16.1 Product modes and clear evidence labels

**Explore mode (MVP):** existing statewide H3 screening heat map. Hexes are geographic screening cells, **not** legal parcels or land advertised for sale.

**Parcel mode (stretch):** load a limited number of actual cadastral parcel polygons in a selected Massachusetts county. Display acreage, land-use, assessed value (where available), owner or assessor metadata if lawfully available, zoning review status, and listing evidence. Never infer `for_sale=true` from vacancy, land cover, ownership, or assessed value.

**Listing mode (optional):** attach a verified active sale listing from an authorized feed or manually reviewed URL. Show asking price, acreage, listing date, URL, verified-at timestamp, and stale/unverified status. Avoid unlicensed scraping and do not imply that Crexi/LoopNet/LandWatch provide an open nationwide listing API.

**Site comparison:** compare two to five candidate parcels or hexes, showing feasibility, economic, environmental, community, and data-confidence tradeoffs.

### 16.2 Data source and API catalog

| Domain | Source / documentation | Key fields | Integration method | Limitations / MVP priority |
| --- | --- | --- | --- | --- |
| MA boundary, municipalities, land cover | [MassGIS](https://www.mass.gov/orgs/massgis-bureau-of-geographic-information) | geometry, town, land-cover class | download GIS / ArcGIS REST where published | High; land-cover year may be older |
| Parcel boundaries and assessor data | [MassGIS standardized assessor parcels](https://www.mass.gov/info-details/massgis-data-property-tax-parcels) or county/municipal assessors | parcel ID, polygon, lot area, land use, assessed value | GIS files / service | High for selected towns; not live availability |
| Commercial parcel data | [Regrid API](https://regrid.com/api) | parcel geometry, acreage, land use and available attributes | licensed REST API | Optional; credentials, pricing and field coverage vary |
| Active listings | [Crexi](https://www.crexi.com/), [LoopNet](https://www.loopnet.com/), [LandWatch](https://www.landwatch.com/) | asking price, acres, listing URL/status | authorized feed or manually curated URLs | Optional; public search sites are not general-purpose open listing APIs |
| Electricity prices, generation mix | [EIA API](https://www.eia.gov/opendata/) | industrial retail price, electricity generation, fuel mix | REST API / CSV | High; state/utility averages are not negotiated hyperscale tariffs |
| Power plants and generation technology | [EIA-860](https://www.eia.gov/electricity/data/eia860/) | plant coordinates, capacity, fuel, status | annual CSV | Medium; nearby clean generation does not imply contracted access |
| Grid emissions | [EPA eGRID](https://www.epa.gov/egrid) | regional CO2e emission rate | spreadsheet/CSV spatial join | High; average emissions are not marginal emissions |
| Transmission network | [OpenStreetMap/Overpass](https://overpass-api.de/) and [HIFLD archive](https://www.datalumos.org/datalumos/project/240591/version/V1/view) | line geometry, tagged voltage | OSM query / GIS | High; mapping incomplete; distance is NOT grid capacity |
| Climate normals | [NOAA NCEI](https://www.ncei.noaa.gov/) | temperature, precipitation, humidity, degree days | API or downloadable data | High; use nearest station or gridded data with coverage flags |
| Water stress | [WRI Aqueduct](https://www.wri.org/aqueduct) | baseline water stress | GIS download/spatial join | Medium; not a permit or utility service capacity determination |
| Water supply / stressed basins | [MassDEP / MassGIS](https://www.mass.gov/orgs/massachusetts-department-of-environmental-protection) | basin status, drinking-water zones | GIS download/service | High for exclusions; coverage varies |
| Flood hazards | [FEMA NFHL](https://hazards.fema.gov/nfhl/) | flood zone, annual-chance hazard | GIS service/spatial join | High; confirm mapped coverage and effective dates |
| Wetlands and protected land | [MassGIS](https://www.mass.gov/orgs/massgis-bureau-of-geographic-information) | protected status, wetlands | GIS layer | High; screening, not legal boundary adjudication |
| Environmental justice | [MassGIS EJ populations](https://www.mass.gov/info-details/massgis-data-2020-us-census-environmental-justice-populations) | EJ block groups, population | GIS layer | High; do not treat population characteristics as property-value proxies |
| Population and labor | [US Census API](https://www.census.gov/data/developers/data-sets.html), [BLS](https://www.bls.gov/developers/) | residents, workforce, wage statistics | REST/CSV | Medium; align geographies and years |
| Road access and fiber proxy | [OpenStreetMap](https://www.openstreetmap.org/) | roads, mapped telecom infrastructure | Overpass/OSM extract | Medium; highways are NOT a valid direct fiber-distance measure |
| Wildfire / seismic risk | [USFS](https://wildfirerisk.org/), [USGS](https://earthquake.usgs.gov/hazards/) | hazard indices | raster/GIS | Optional in MA MVP |
| Solar potential | [NREL](https://developer.nrel.gov/) | solar resource | API/download | Optional; resource potential is not deliverable clean power |
| Local zoning and permits | Town planning / GIS portals | zoning district, special permit rules | municipal GIS, manual review | Optional; fragmented and requires human confirmation |

**Acquisition rule:** store URL, publisher, dataset vintage, fetch date, license/access status, geographic resolution, and missingness for every data field. Never ship paid API credentials to the browser. Cache and precompute GIS layers to keep map interaction fast.

### 16.3 Candidate parcel schema (`public/data/parcels.geojson`, optional)

```json
{
  "type": "Feature",
  "geometry": {"type": "Polygon", "coordinates": []},
  "properties": {
    "parcel_id": "EXAMPLE-ONLY",
    "town": "EXAMPLE",
    "acreage": null,
    "land_use": null,
    "zoning": null,
    "zoning_verified": false,
    "assessed_value_usd": null,
    "asking_price_usd": null,
    "for_sale": "unknown",
    "listing_url": null,
    "listing_checked_at": null,
    "vacancy_status": "unknown",
    "distance_transmission_km": null,
    "grid_capacity_verified": false,
    "source_ids": [],
    "last_updated": null
  }
}
```

Valid `for_sale` values: `verified_active`, `verified_inactive`, `unknown`. An assessed value is not an asking price. `coordinates: []` is a schema placeholder, not valid production GeoJSON geometry.

### 16.4 Additional scoring inputs (retain existing eight factors for MVP)

| Dimension | Proposed field | Unit | Data availability | How used |
| --- | --- | --- | --- | --- |
| Land | `acreage` | acres | parcel data | configurable minimum area, e.g. 100 acres as exploratory filter for 100 MW |
| Land | `price_per_acre` | USD/acre | verified sale listing only | acquisition cost comparison |
| Land | `zoning_verified` | boolean | municipal verification | unresolved constraint if false |
| Grid | `electricity_price_kwh` | USD/kWh | EIA | estimated annual electricity bill |
| Grid | `grid_carbon_kg_mwh` | kg CO2e/MWh | eGRID | estimated location-based emissions |
| Grid | `interconnection_status` | enum | developer/utility evidence | unknown, under-study, confirmed, rejected |
| Climate | `cooling_degree_days` | degree-days | NOAA | cooling demand proxy |
| Water | `water_stress_index` | normalized | WRI | water impact / risk |
| Risk | `flood_zone` | code | FEMA | site screening |
| People | `pop_1km` | persons | Census/MassGIS | community context, not a measure of consent |
| Evidence | `confidence` | 0–1 | source metadata | coverage and reliability badge, not site desirability |

**Hard feasibility vs scoring:** verified zoning conflicts, legal exclusions, inadequate acreage and documented interconnection impossibility should not be hidden by a high weighted score. Unverified grid capacity is `unknown`, not `feasible` or `fatal`.

**Scoring fix:** in the original formula, `X=0` can still produce a positive score because the bonus is added after multiplying by X. Implement `if excluded: return 0` before applying bonuses. Also handle `B=0` or `C=0` explicitly. A low score should not be described as proof that a community will oppose a project. The score bands are model labels, not predicted public sentiment.

**Proxy fixes:** `d_clean_km` is proximity to generation, not clean electricity procurement. Municipal light plant presence does not establish clean-energy access. `d_fiber_km` derived from highway distance must be renamed `d_highway_km` and excluded from fiber scoring unless actual fiber data is available. Model unknown values transparently instead of awarding automatic favorable scores.

### 16.5 Economics and environmental model

For an assumed IT demand `IT_MW`, operating hours `hours`, facility PUE and electricity price:

```text
annual_facility_mwh = IT_MW * hours * PUE
annual_electricity_usd = annual_facility_mwh * 1000 * electricity_price_kwh
annual_location_based_tco2e = annual_facility_mwh * grid_carbon_kg_mwh / 1000
annual_water_liters = annual_facility_mwh * 1000 * WUE_liters_per_kwh
```

Assumptions: `IT_MW` refers to IT load, not total site demand; 8,760 hours implies continuous full utilization; PUE and WUE are scenario inputs unless verified facility measurements exist. WUE must use a consistent facility-energy denominator and declared system boundary. Carbon results are approximate location-based emissions, not verified Scope 2 market-based accounting. Include a range/sensitivity analysis rather than pretending estimates are exact.

**Optional cost breakdown:** land asking price, illustrative construction cost per MW, annual electricity, annual water, and risk/connection contingency; show separate one-time capex and recurring opex. Never present statewide averages as a project quote.

### 16.6 Regression / ML: research extension, not a fake prediction

- Candidate target: observed facility PUE or observed cooling electricity (kWh) from a genuine labeled operational dataset.
- Candidate predictors: weather, cooling technology, utilization, equipment characteristics, IT load, and cooling degree days.
- Compare a transparent baseline to linear regression and XGBoost; use time- or facility-held-out validation to avoid leakage.
- Do **not** train a regression to predict a suitability score that the team itself invented, then claim independent AI validation.
- If there is no labeled dataset, keep PUE as a documented scenario assumption and use deterministic cost formulas. AI may explain verified facts, not invent coefficients or grid capacity.

### 16.7 New application flows

**Find parcels:** choose county/town, minimum acreage, land use, flood exclusions and `verified_active` versus `all parcels`. Show parcel polygons, listing links and data freshness. For the six-hour demo, seed 5–20 manually verified example parcels or a small public parcel subset; if listing rights are unavailable, show `for_sale: unknown` clearly.

**Analyze site:** select a parcel or H3 hex; show 8 core factors plus electricity price, modeled annual electricity spend, modeled emissions, acreage, sale evidence, feasibility warnings and confidence badge.

**Compare sites:** pin up to three locations and compare buildability, community, land cost, power assumptions, flood/water risk and unresolved requirements. Allow sensitivity controls for PUE, electricity price and weight presets.

**AI reports:** two Bedrock tools/templates: `generate_community_brief` (existing town-meeting focus) and `generate_developer_screening_report` (parcel facts, exclusions, grid uncertainties, cost assumptions, source links, next due-diligence steps). All quantitative statements must come from a structured tool result. No hallucinated permits, listing prices or interconnection approvals.

### 16.8 Additional API contracts (optional)

```text
GET  /api/parcels?bbox=...&min_acres=100&sale_status=verified_active
GET  /api/site/:id/evidence
POST /api/compare  {"site_ids": ["a", "b"], "it_mw": 100, "pue": 1.3}
POST /api/report   {"site_id": "a", "audience": "developer"}
```

Server endpoints must validate input, rate limit paid upstream API calls, and cache third-party results. Return source metadata, nulls and data-confidence indicators with all computed fields.

### 16.9 Revised build priorities for the original six-hour constraint

**P0 (must ship):** existing map, eight-factor scoring, corrected fatal-exclusion logic, reliable MA GIS layers, data source attribution, 100 MW selector, town-meeting brief, three calibration demos.

**P1 (only after P0):** EIA electricity prices, eGRID emissions, annual electricity cost and emissions scenario card, compare two locations, small parcel polygon overlay with explicit sale-status labels.

**P2 (future):** Regrid paid API integration, authorized live listings, verified zoning and grid studies, PostGIS parcel indexing, cooling regression, permit agent, full statewide parcel search.

**Acceptance tests:** no excluded location scores above zero; no `unknown` listing is labeled for sale; no transmission proximity is labeled available MW; no highway distance is labeled fiber access; changing price/PUE changes estimated costs but not measured source facts; all site report numbers trace to source data or labeled assumptions; API outages degrade gracefully to cached data.

### 16.10 Key due-diligence corrections to original spec

1. Independently verify Massachusetts Executive Order 658, its effective date, exact applicability thresholds and implementing rules using the primary official document before using its claims in the demo or compliance checklist. Do not rely on an unverified narrative or treat a checklist as legal advice.
2. Do not tune calibration weights solely to force predetermined outcomes at Holyoke, Chelsea and Quabbin. Tests should validate verified underlying layer classifications and invariant behavior, not predetermined marketing scores.
3. A data center's proximity to a transmission line does not demonstrate that it can interconnect, and transmission voltage alone does not define a universally sufficient 100 MW or 300 MW connection.
4. Flood, wetlands, protected-land and drinking-water polygon intersections are preliminary geospatial screens; parcel-specific legal status requires professional confirmation.
5. Never call a site `available for sale` without a currently verified listing or owner-confirmed availability.
