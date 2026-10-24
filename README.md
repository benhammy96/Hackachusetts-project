# Atlas 🌍

**Explainable data center site screening for Massachusetts.**

Click anywhere in Massachusetts, pick a data center size, and get a transparent
0–10 suitability score with the reasons behind it — grid access, clean power,
water, climate risk, land readiness, community impact, and environmental
justice. Built for the Hackachusetts 2026 Climate Tech track.

> No tool lets a resident, town, or developer click a spot in Massachusetts and
> see whether it is a good or bad place for a data center, and why. Atlas does.

---

## What it does

- **Click-to-score map** — pick any location in MA and get an explainable score
  in milliseconds. Scoring runs in the browser, so sliders update instantly.
- **Two lenses** — see the site through a **Buildability** lens and a
  **Community** lens, and where they disagree.
- **Fatal-flaw screening** — hard exclusions (protected land, wetlands,
  floodplain, drinking-water zones) are called out with the reason.
- **EO 658 awareness** — flags Massachusetts Executive Order 658 obligations for
  large loads (community approval, clean-energy matching) based on the chosen size.
- **Town-meeting briefs** — generates a plain-language brief (optionally written
  by Claude on Amazon Bedrock, with a deterministic offline fallback).

> **Screening tool, not an engineering verdict.** Scores are a transparent
> shortlisting signal built on modeling assumptions, not regulatory or
> engineering determinations. Legal and dataset claims should be verified
> against primary sources before being treated as fact. See `ATLAS.md`.

## Tech stack

| Layer     | Technology                                                |
| --------- | --------------------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19, TypeScript             |
| Mapping   | MapLibre GL + deck.gl, H3 hex grid, Turf.js               |
| Styling   | Tailwind CSS 4, Radix UI primitives                       |
| AI briefs | Amazon Bedrock (Claude) — optional, with offline fallback |
| Data prep | Python pipeline (H3 hexes from public GIS sources)        |
| Testing   | Vitest + fast-check (property-based)                      |

## Quick start

Requires **Node.js ≥ 20.9**.

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. The app runs fully offline — the basemap and all
scoring data are served from local files, and no API key is required for the
core experience.

### Other commands

```bash
npm run build       # production build
npm start           # serve the production build
npm run typecheck   # tsc --noEmit
npm test            # run the Vitest suite
```

## Project structure

```
.
├── app/                  # Next.js App Router
│   ├── page.tsx          # main screen (map + panels)
│   ├── layout.tsx
│   └── api/brief/        # streaming brief endpoint (Bedrock or offline)
├── components/           # UI: atlas-map, score-breakdown, brief-panel, ...
├── lib/                  # scoring, EO 658 checklist, formatting, hex helpers
├── pipeline/             # Python: build H3 hex data from public GIS sources
├── public/data/          # prebuilt hex grid + map layers (GeoJSON/JSON)
├── scripts/              # build helpers (maplibre worker, briefs cache)
├── ATLAS.md              # full product + scoring spec
└── UI_DESIGN.md          # UI design notes
```

## How scoring works

Each candidate location is scored on factors grouped into two lenses, each factor
normalized to `[0, 1]` where 1 is best. Missing data is dropped from the average
rather than counted as "bad", so gaps never unfairly sink a site.

**Buildability:** grid access (35), clean power access (25), fiber/latency (20),
land readiness (20).
**Community:** residents nearby (30), environmental justice (30), water (20),
climate risk (20).

The two lens scores are combined with a geometric mean (tunable by audience), any
hard exclusion forces the score to 0, and small bonuses (e.g. brownfield reuse,
closed-loop cooling) are capped at +1.0.

| Score   | Label                    |
| ------- | ------------------------ |
| 8.0–10  | Strong site              |
| 6.0–7.9 | Workable with conditions |
| 4.0–5.9 | Contested site           |
| 0.1–3.9 | Do not build here        |
| 0       | Fatal flaw               |

**Design principle:** environmental justice is a protection, never an advantage —
a burdened neighborhood always lowers the score. Full formulas, invariants, and
calibration sites are in [`ATLAS.md`](./ATLAS.md).

## Data pipeline (optional)

The app ships with prebuilt data in `public/data/`, so you don't need to run the
pipeline to use Atlas. To regenerate the H3 hex grid from source GIS data:

```bash
npm run setup:pipeline   # create venv + install pipeline/requirements.txt
npm run pipeline         # build hex grid
npm run assumptions      # build assumptions/metadata
```

## AI briefs (optional)

Town-meeting briefs work with no setup — a deterministic composer produces them
offline. To have them written by Claude on Amazon Bedrock instead, set:

```bash
BEDROCK_MODEL_ID=<your-model-id>
AWS_REGION=<your-region>
```

with AWS credentials available in the environment. Without these, Atlas quietly
falls back to the offline brief and labels it as such.

## License

Built for Hackachusetts 2026. See repository for license details.
