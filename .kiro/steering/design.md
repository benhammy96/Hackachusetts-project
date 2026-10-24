# Design rules

Authority: `UI_DESIGN.md` at the repo root. This file is the working checklist.

Atlas should read like an institutional research terminal and a map instrument.
Not a chat app, not a template dashboard, not a landing page.

## Tokens — use these, never a literal

Defined in `app/globals.css` under `@theme`, consumed as Tailwind utilities.

`bg #0B0F14` · `panel #111820` · `raised #17212B` · `line #283541` ·
`fg #F0F3F5` · `muted #9CAAB6` · `subtle #657684` · `accent #56C9D5` ·
`accent-muted #163B43` · `ok #68C49A` · `warn #E6B765` · `bad #E27D77` ·
`unknown #7B8794`

- Radius: 6 px controls, 8 px panels, 10 px overlays. Nothing else.
- Spacing on a 4 px base. Panel padding 16–20 px. Controls 32–36 px.
- 1 px borders. Almost no shadows. Solid panels, not translucent blur.
- Inter for UI, IBM Plex Mono with tabular numerals for every figure (`.num`).
- Sizes: page label 18–20, panel heading 13–15, body 13, metadata 10–12, the
  one big score 46.
- Accent is for selection and primary action only. Risk colours mean risk.

## Layout

Top bar 56 px. Then explorer 280 px | map | inspector 360 px. The map keeps at
least half the width at 1440×900 and 1280×720 — collapse the explorer first.
Mobile: full-screen map with the inspector as a bottom sheet.

## Hard noes

No purple or pink gradients, aurora, neon glow, blobs, robot or sparkle art,
fake terminal text, emoji in product UI, four identical KPI cards, arbitrary
animation, fake or disabled-looking-but-dead buttons, layout-shifting
skeletons, marketing copy in the workflow.

## Motion

Panel enter/exit 160–220 ms. Selection 180–260 ms. Hover 100–150 ms. Map camera
300–550 ms eased. The score animates only after a real calculation. Honour
`prefers-reduced-motion`; the opening fly-in becomes a jump.

## Map

Quiet dark basemap, labels on a separate layer at ~0.42 opacity, attribution
always visible. Draw order: base → labels → constraint overlays → suitability
hexes → transmission → selection. Hexes are flat and low-opacity by default;
extrusion is an opt-in presentation layer. Tile failure must not break the
screen — the state outline and the grid are local, and a notice says so.

## Honesty in the interface

- Never colour alone. Every band shows its label text.
- Every number has a unit. Every derived number has its assumptions reachable.
- `StatusTag` on anything that is not a direct measurement.
- Missing data reads `Not available`, never `0`.
- A risk flag or an unresolved constraint is never hidden behind a good score.
  The inspector shows the critical-unresolved block above the factor table.
- `Near transmission` is never `grid capacity available`. `Vacant` is never
  `for sale`. Show the measured share of each lens whenever it is below 100%.

## Accessibility

Keyboard reachable with a visible accent focus ring. 4.5:1 text contrast on the
dark background. Real `<table>` semantics in compare with `scope` attributes.
`aria-expanded` on every disclosure, `aria-pressed` on every chip. Brief text at
a 6th–8th grade reading level.
