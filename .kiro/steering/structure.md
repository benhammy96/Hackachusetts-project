# Repository map

```
.kiro/
  steering/   product.md  tech.md  structure.md  scoring.md  data-sources.md  design.md
  hooks/      *.json  (v1 agent hooks)
pipeline/
  build_hexes.py        statewide H3 grid -> public/data/hexes.json + meta.json + layers/
  build_assumptions.py  EIA price + eGRID carbon -> public/data/assumptions.json
  build_briefs_cache.py offline briefs for the calibration sites
  arcgis.py             polite ArcGIS REST + Overpass client
  geo.py                EPSG:26986 projection, Esri JSON -> shapely
  sources.py            dataset registry; drives meta.json provenance
public/data/
  hexes.json            columnar grid, decoded by lib/hexes.ts
  meta.json             per-field source, status, coverage; generated from sources.py
  assumptions.json      economic inputs with provenance
  briefs-cache.json     offline demo briefs
  layers/*.geojson      display overlays (generalised)
lib/
  score.ts        the eight factors and the aggregate. Pure.
  weights.ts      every scoring constant
  eo658.ts        the checklist, with section citations
  hexes.ts        columnar decode, H3 lookup, HexIndex
  economics.ts    energy, cost, carbon, water, sensitivity band
  alternatives.ts find-a-better-spot and explorer ranking
  brief.ts        deterministic brief composer + Bedrock system prompt
  brief-i18n.ts   translated labels and questions for 7 languages
  format.ts       number and unit formatting
  server-data.ts  filesystem loader for the API route
app/
  page.tsx            shell: explorer | map | inspector
  api/brief/route.ts  tool-grounded SSE brief
components/
  atlas-provider.tsx  single state container
  atlas-map.tsx  hex-tooltip.tsx  map-legend.tsx
  site-explorer.tsx  site-inspector.tsx  score-breakdown.tsx
  cost-estimate.tsx  data-provenance.tsx  brief-panel.tsx  site-compare.tsx
  markdown.tsx        element-building markdown renderer (no HTML injection)
  ui/                 primitives.tsx  info.tsx
tests/
  score.test.ts  score.property.test.ts  calibration.test.ts  fixtures.ts
```

## Where to add things

- A new measurement: add a stage to `pipeline/build_hexes.py`, an entry to
  `pipeline/sources.py` (`SOURCES` + `FIELD_SOURCES`), a field to
  `lib/types.ts` `HexRecord`, and a decode line in `lib/hexes.ts`. The
  provenance dialog picks it up from `meta.json` automatically.
- A new factor: `lib/weights.ts` table, a factor function in `lib/score.ts`,
  unit tests, and a property test if it introduces a monotonic relationship.
- A new overlay: emit the GeoJSON from the pipeline, add it to `OVERLAYS` in
  `components/map-legend.tsx` and a `useGeoJson` call in `atlas-map.tsx`.
