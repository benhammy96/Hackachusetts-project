# Design — Atlas Foundation

## Overview

Atlas is a two-tier application: a React/TypeScript single-page app talking to a
FastAPI backend over JSON. The backend owns the scoring pipeline, AI
explanations, and external data integration. The design optimizes for four
independent workstreams (frontend, data integration, scoring, backend/AI) by
making the shared data models the central contract.

## Architecture

```
┌─────────────────────────────┐        JSON / HTTP        ┌──────────────────────────────┐
│          Frontend           │  ───────────────────────▶ │            Backend             │
│  React + Vite + Tailwind    │     /api proxy (dev)       │           FastAPI              │
│  MapLibre GL JS             │                            │                                │
│                             │                            │  routers/ ── thin HTTP layer   │
│  components/  lib/api.ts     │ ◀───────────────────────   │  services/ ── scoring, ai,     │
│  types/models.ts (contract) │                            │              data_sources      │
└─────────────────────────────┘                            │  models/   ── Pydantic (contract)│
                                                            └──────────────────────────────┘
                                                                       │
                                        ┌──────────────────────────────┼─────────────────────────┐
                                        ▼              ▼                ▼                          ▼
                                     OSM/Overpass    FEMA           US Census              Energy APIs
```

## Components and Interfaces

### Shared data models (the contract)

Defined twice and kept in sync: `backend/app/models/*.py` (Pydantic) and
`frontend/src/types/models.ts` (TypeScript). Key types: `Coordinates`,
`SiteCandidate`, `ScoreCategory`, `ScoreBreakdown`, `SiteScore`,
`SiteScoreRequest`, `ExplanationRequest/Response`, `ComparisonRequest/Response`.

### Backend

- **routers/health.py** — `GET /health`, `GET /`.
- **routers/sites.py** — `POST /sites/score`, `POST /sites/compare`.
- **routers/explanations.py** — `POST /explanations`.
- **services/scoring.py** — weight normalization + per-category scoring. Stable
  public functions `score_candidate` / `score_candidates`.
- **services/data_sources.py** — async typed adapters for OSM, FEMA, Census,
  energy. Placeholder returns now.
- **services/ai.py** — `generate_explanation`; offline fallback when no key.
- **config.py** — env-driven `Settings` (CORS, API keys, data endpoints).

### Frontend

- **MapView** — MapLibre basemap, reports clicks as `Coordinates`.
- **ScorePanel** — renders a `SiteScore` breakdown.
- **ExplanationCard** — renders an `ExplanationResponse`.
- **ComparisonView** — ranks a list of `SiteScore`.
- **lib/api.ts** — typed `fetch` wrapper; dev requests proxied `/api → :8000`.

## Data Models

Overall score = Σ (raw_score × weight) over the five categories, with weights
summing to 1.0. Default weights: community 0.25, energy 0.25, environmental
0.20, infrastructure 0.15, land 0.15.

## Error Handling

- API client throws on non-2xx with status context.
- AI service degrades gracefully to an offline explanation when unconfigured.
- Weight overrides that are empty or non-positive fall back to defaults.

## Testing Strategy

- Backend: FastAPI `TestClient` smoke tests for each route (scaffold verifies
  import + 200 responses). Unit tests for scoring math as logic lands.
- Frontend: `tsc --noEmit` type check in CI; component tests as UI lands.
- Each PR keeps the frontend build and backend import check green.
