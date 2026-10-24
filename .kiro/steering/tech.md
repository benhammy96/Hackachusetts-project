# Stack and conventions

## Versions

| Layer | Choice |
| --- | --- |
| Runtime | Node 24 LTS (`.toolchain/node`, created by `scripts/setup-node.sh`) |
| App | Next.js 16 App Router, React 19, TypeScript 5.9 strict |
| Styling | Tailwind CSS 4 (CSS-first `@theme` in `app/globals.css`) |
| Map | maplibre-gl 6, deck.gl 9.4 (`@deck.gl/maplibre` → `MapLibreOverlay`) |
| Geo | h3-js 4, @turf/turf 7 |
| UI | hand-written components on Radix primitives, lucide-react icons, recharts, sonner |
| AI | Amazon Bedrock Converse stream (`@aws-sdk/client-bedrock-runtime`) |
| Tests | Vitest 5, fast-check 4 |
| Pipeline | Python 3.13, shapely 2, h3 4, openpyxl, stdlib urllib |

Pitfalls already hit, do not reintroduce:

- maplibre-gl 6 has **no default export**. Use named imports.
- deck.gl 9.4 exports `MapLibreOverlay`, not `MapboxOverlay`.
- `parameters: { depthTest }` is not a luma.gl v9 key. Omit it; defaults are right.
- Do not add `transpilePackages: ["maplibre-gl"]`. Turbopack then fails on
  maplibre's dynamic worker URL.
- Node must be ≥ 20.19 or ≥ 22.12 or Vitest 5's bundler binary will not install.

## Layout rules

- `lib/` is pure and isomorphic. No DOM, no `fetch` at module scope, no React.
  The brief agent imports the same `lib/score.ts` the browser uses, so a number
  can never differ between the card and the narrative.
- `components/` is all client-side. The map is `dynamic(..., { ssr: false })`.
- `app/api/` validates every input and never trusts a request body.
- `pipeline/` writes `public/data/`. The app only reads it.

## Commands

```bash
npm run dev         # dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run test        # unit + property + calibration
npm run pipeline    # rebuild public/data/hexes.json (stages are cached)
npm run assumptions # refresh EIA price and eGRID carbon
```

## Conventions

- Named exports from `lib/`. No default exports except Next.js route/page files.
- Format numbers through `lib/format.ts`; never inline `toFixed` in a component.
- Anything shown to a user that is not a direct measurement carries a
  `StatusTag` of `verified | modeled | proxy | unavailable | assumption`.
- `Not available` is the string for missing data. Never `0`, never `—` alone,
  never an empty cell.
