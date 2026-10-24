# ATLAS — UI Design System and Frontend Implementation Rules

> Design authority for Kiro and all frontend agents. Follow this document when implementing ATLAS. Product/data requirements remain in `ATLAS.md`. This file overrides generic component-library defaults when they conflict with the design language.

## 1. Product character
ATLAS is a professional geospatial site-intelligence tool for evaluating potential AI data-center locations. It should feel like an institutional research terminal, an infrastructure planning console, and a precise map instrument—not an AI chat app, template dashboard, or marketing landing page.

Keywords: precise, restrained, cartographic, credible, calm, high-density, deliberate.

**The product hero is the map and the evidence, not a glowing AI assistant.**

## 2. Visual references (principles, not copies)
- Bloomberg/financial terminals: numerical hierarchy, compact but legible metadata, clear units.
- Professional GIS: map-first workflow, meaningful legend, inspectable layers, persistent spatial context.
- Architectural software: precise boundaries, restrained palettes, carefully aligned panels.

## 3. Hard anti-template rules
- No purple/pink gradients, aurora backgrounds, neon glows, glassmorphism everywhere, floating blobs, generic robot/brain/sparkle illustrations, or fake terminal text.
- No four identical KPI cards across the top. The selected site and map must dominate.
- No arbitrary animation. Movement must communicate selection, filtering, scoring, or navigation.
- No emojis in product UI. Use one icon family (Lucide), consistently sized.
- No fabricated metrics, scores, parcel listings, source badges, or false precision.
- No unlabeled scores: always show what is measured, its unit, data vintage, and confidence when available.
- No random border radii, shadows, or typography sizes. Use tokens below.
- No overly large headings in analytical panels. No marketing copy in the core workflow.
- No fake buttons. Every visible interactive control must work, or be clearly disabled.
- Avoid loading skeletons that change the overall layout. Reserve panel space.

## 4. Design tokens
Use CSS custom properties in `app/globals.css` and map to Tailwind theme tokens.

### Color (dark-first)
- `--bg: #0B0F14` app background
- `--panel: #111820` solid sidebar/panel background
- `--panel-raised: #17212B` raised/hover surfaces
- `--border: #283541` hairline borders
- `--text: #F0F3F5` primary text
- `--muted: #9CAAB6` secondary text
- `--subtle: #657684` tertiary metadata
- `--accent: #56C9D5` active selections and primary actions
- `--accent-muted: #163B43` accent surface
- `--success: #68C49A` favorable/suitable
- `--warning: #E6B765` caution/unverified
- `--danger: #E27D77` hazards/exclusions
- `--unknown: #7B8794` missing data

Use accent sparingly. Risk colors communicate risk, not brand decoration. Do not color all text cyan.

### Typography
- UI font: `Inter` or `Geist Sans` (choose one and use everywhere).
- Numbers/IDs: `Geist Mono` or `IBM Plex Mono` with tabular numerals.
- Main page label 18–20 px / 600; panel heading 13–15 px / 600; body 13–14 px; metadata 11–12 px; key site score 42–52 px / 600.
- Labels in sentence case, not ALL CAPS everywhere. All-caps may be used for tiny section overlines only.
- Format numbers consistently: `100 MW`, `$0.112/kWh`, `2.4 km`, `87 acres`, `8.2 / 10`. Avoid meaningless decimal places.

### Spacing and geometry
- 4 px spacing base: 4, 8, 12, 16, 24, 32.
- Panel padding: 16–20 px. Row heights: 36–44 px. Controls: 32–36 px.
- Border radius: 6 px controls, 8 px panels, 10 px overlays. No giant pill-shaped cards.
- Borders: 1 px subtle, almost no shadows. Use solid panels, not heavy translucent blur.
- Desktop target: 1440×900, functional at 1280×720. Responsive fallback at tablet/mobile.

## 5. Layout specification
Desktop is a three-region map-first workspace:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ATLAS  /  Massachusetts      [100 MW ▾] [Cooling ▾]    [Compare] [Export]│  56px
├───────────────┬────────────────────────────────────────┬───────────────────┤
│ SITE EXPLORER │                                        │ SITE INSPECTOR    │
│ 280px         │              MAP CANVAS                │ 360px             │
│               │                                        │                   │
│ Search        │  transmission / parcels / risk layers  │ Site location     │
│ Filters       │                                        │ 8.2 / 10          │
│ - Acres       │  [selected parcel outline]             │ Buildability      │
│ - Land type   │                                        │ Community         │
│ - For sale    │                                        │ Cost estimate     │
│ - Risks       │                                        │ Evidence/factors  │
│               │                                        │                   │
│ Ranked sites  │ [Legend]                [Layers] [+/-]  │ [Generate brief]  │
└───────────────┴────────────────────────────────────────┴───────────────────┘
```

- Center map must occupy at least 50% of desktop width; collapse left explorer before shrinking the map.
- Top bar 56 px, no oversized hero area.
- Left explorer may be collapsed; right inspector appears after a site is selected.
- No site selected: right panel shows concise instructions and three example sites; do not show fake scores.
- On mobile: full-screen map with bottom-sheet site inspector and compact filter drawer.
- Support keyboard and screen-reader navigation; never use color as the only indicator.

## 6. Map visual language
Use MapLibre GL JS with deck.gl. Prefer a custom low-noise dark basemap; de-emphasize labels, roads, and POIs while preserving geographic orientation. Ensure attribution.

Layers in visual order:
1. Base map: muted charcoal land, dark desaturated water, quiet roads.
2. Optional suitability H3 overlay: low-opacity fill, no extrusion by default at far zoom.
3. Infrastructure: transmission lines as thin cool blue lines, differentiated by voltage with legend.
4. Environmental constraints: red/amber hatching or semi-transparent overlays, never obscure the base map.
5. Parcels: fine borders only at close zoom; selected parcel 2 px cyan outline and subtle fill.
6. Selected location: precise pin or footprint with unobtrusive 1 km context ring.

Interaction:
- Hover parcel -> lightweight tooltip: acreage, classification, data status.
- Click -> right inspector with site evidence and score; selected outline persists.
- Fit map to selection with 300–550 ms eased camera movement; honor reduced-motion preference.
- Layer toggles must have visible on/off state, explanatory legend, and loading/error states.
- Do not render every hex as a towering 3D bar at every zoom; use extrusions as an optional presentation layer only. Preserve legibility.
- Distinguish `for sale (verified listing)` from `potentially developable (not verified for sale)`.

## 7. Site inspector information hierarchy
Order information by user decision priority:
1. Town/county, coordinates or parcel ID, acreage, listing status and last-checked date.
2. Overall suitability score /10 plus Buildability and Community subscores; `screening estimate` label.
3. Critical feasibility warnings: grid capacity unverified, zoning unknown, protected land, flood exposure.
4. Three high-signal metrics: nearest mapped transmission line, estimated annual power cost, flood status.
5. Factor evidence table: factor, raw measurement, normalized score, source, vintage, missing-data marker.
6. Expandable `Why this site?` explanation grounded in factors.
7. Actions: compare, find better site, generate town-meeting brief, view original source/listing.

Keep all eight existing ATLAS core factors visible; use progressive disclosure for expanded metrics. A risk flag must never be hidden behind a positive aggregate score.

## 8. Charts and analytical components
- Prefer ranked horizontal bars, compact comparison tables, and a clear 0–10 factor bar over gauge/speedometer charts.
- Use Recharts (via shadcn/ui chart components) for cost breakdown and site comparisons.
- Every chart needs units, baseline, source/vintage where applicable, and a legend if multiple series.
- Distinguish modeled cost from observed price. Add assumptions disclosure beside estimates.
- Avoid charts for values that are better communicated as text.

## 9. Motion and feedback
Use Motion for React selectively:
- Panel enter/exit: 160–220 ms, opacity + translate 8 px.
- Site-selection transition: 180–260 ms.
- Score update: subtle numerical transition only after real calculation completes; never imply a fabricated computation.
- Hover states: 100–150 ms CSS transitions.
- Map camera: 300–550 ms, ease-in-out.
- Honor `prefers-reduced-motion` and avoid scroll-jacking, infinite shimmer, parallax, and autoplay animation.
- Loading: skeleton or spinner only for actual network work; stale data must be labeled.

## 10. Component implementation stack
Use a small, coherent stack rather than several overlapping UI kits:
- `shadcn/ui`: Button, Sheet, Dialog, Tabs, Select, Slider, Tooltip, Separator, ScrollArea, Sidebar, Table, Skeleton.
- `@radix-ui/*` or shadcn's chosen accessible primitives; don't install a second full design system.
- `lucide-react`: all interface icons, default 16 px, stroke 1.75–2.
- `maplibre-gl` + `@deck.gl/maplibre` + `@deck.gl/layers` + `@deck.gl/geo-layers`: map, parcels, geospatial layers.
- `h3-js` and `@turf/turf`: cell IDs and spatial utilities where appropriate.
- `recharts`: analytical plots.
- `motion`: panel and state transitions.
- `cmdk`: optional command search for sites/locations; not required for MVP.
- `sonner`: understated notifications.
- `react-resizable-panels`: optional adjustable inspector/explorer widths; avoid if time constrained.
- `next/font`: consistent font loading.

Install only packages actually used. Use compatible versions per current official docs and lock them in the project lockfile.

## 11. Component contracts
- `AtlasShell`: responsive regions and navigation.
- `SiteExplorer`: location search, filters, ranked results.
- `AtlasMap`: layers, hover, selection, legends, map controls.
- `SiteInspector`: evidence, scoring, risk warnings, actions.
- `ScoreBreakdown`: exact core-factor breakdown and raw values.
- `DataProvenance`: dataset name, source URL, vintage, confidence/availability.
- `SiteCompare`: two sites in the same units with aligned rows.
- `BriefPanel`: generated text with source grounding and disclosure.

Each component must have real empty, loading, error, partial-data, and success states where relevant.

## 12. Trust and data quality rules
- Show `Verified`, `Modeled`, `Proxy`, `Unavailable` as small textual status indicators where appropriate (not colorful badges everywhere).
- `Near transmission` is never represented as `Grid capacity available`.
- `Vacant parcel` is never represented as `For sale` unless an active listing has been verified.
- `Cost estimate` always states PUE, MW, hours/year, price source, and assumptions.
- Regulatory guidance is labeled informational, not legal advice.
- AI text must cite evidence and must not overwrite measured values.
- If data is missing, show `Not available`; do not silently substitute zero.

## 13. Hackathon demo choreography (90 seconds)
1. **0–10s**: Land on Massachusetts map. One-line product promise: `Find viable land for the next generation of AI infrastructure.`
2. **10–30s**: Filter for a 100 MW campus; reveal ranked candidate areas/parcels. Explicitly distinguish for-sale listings if verified.
3. **30–50s**: Select a site. Map zooms to parcel, shows transmission and flood overlays. Inspector exposes score and critical risks.
4. **50–70s**: Compare another site. Show tradeoff between cost, grid proximity, and community impact.
5. **70–90s**: Generate evidence-grounded brief; close with clear explanation and data provenance.

Never depend on a live external API during the on-stage demo. Cache real preprocessed data and label its vintage; preserve a fallback demo path.

## 14. Acceptance checklist
- [ ] App looks like one product, not multiple templates stitched together.
- [ ] Map is the dominant element at 1440×900 and 1280×720.
- [ ] No purple gradients, gratuitous glow, generic AI illustrations, or repeated KPI cards.
- [ ] Spacing, radii, typography, colors follow the tokens.
- [ ] Every interactive element has a meaningful action and feedback.
- [ ] All important numbers have units; sources and assumptions are discoverable.
- [ ] Risks and missing data remain visible even when a site scores well.
- [ ] No fake listings, no unverified grid capacity claims.
- [ ] Keyboard, contrast, responsive and reduced-motion checks pass.
- [ ] Demo works without external API availability.

## 15. Agent instruction
Before building any page, identify its primary user decision and the minimum evidence needed to support it. Implement the map and inspector first. Reuse design tokens and existing components. Do not add decorative UI that does not help the user decide whether a site is suitable. If unsure between visual spectacle and clarity, choose clarity; add one deliberate map interaction as the demo moment.
