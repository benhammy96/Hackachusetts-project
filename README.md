# Atlas 

**AI-powered data center site selection** — Hackachusetts 2026, Climate Tech track.

Atlas helps teams identify suitable data center locations by scoring candidate
sites across environmental, infrastructure, energy, land, and community factors,
and explaining each score in plain language with the Claude API.

## Features

- **Interactive map** — select potential locations on a MapLibre map.
- **Weighted scoring** — community (25%), energy (25%), environmental (20%),
  infrastructure (15%), land (15%).
- **Comparison** — rank candidate sites side by side.
- **AI explanations** — Claude explains why a site scores the way it does.

> **Status:** scaffold. Placeholder components and routes are in place and both
> apps run end-to-end. Real map interaction, scoring, data integration, and AI
> explanations are tracked in `.kiro/specs/atlas-foundation/tasks.md`.

## Tech stack

| Layer    | Technology                                             |
| -------- | ------------------------------------------------------ |
| Frontend | React, TypeScript, Vite, Tailwind CSS, MapLibre GL JS  |
| Backend  | Python, FastAPI, Pydantic                              |
| AI       | Anthropic Claude API                                   |
| Data     | OpenStreetMap, FEMA, US Census, energy APIs            |

## Project structure

```
Hackachusetts-project/
├── frontend/     # React + Vite app          (see frontend/README.md)
├── backend/      # FastAPI service           (see backend/README.md)
└── .kiro/
    ├── steering/ # project guidance (product, tech, structure)
    └── specs/atlas-foundation/  # requirements, design, tasks
```

## Quick start

Run the backend and frontend in two terminals.

**Backend** (http://localhost:8000, docs at `/docs`):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # add API keys when available
uvicorn app.main:app --reload
```

**Frontend** (http://localhost:5173):

```bash
cd frontend
npm install
npm run dev
```

The frontend proxies `/api/*` to the backend, so start both.

## Working as a team

Four workstreams are designed to progress independently on separate branches:

| Workstream        | Primary files                                               |
| ----------------- | ----------------------------------------------------------- |
| Frontend          | `frontend/src/`                                             |
| Data integration  | `backend/app/services/data_sources.py`                      |
| Scoring           | `backend/app/services/scoring.py`, `backend/app/routers/sites.py` |
| Backend / AI      | `backend/app/main.py`, `config.py`, `routers/`, `services/ai.py` |

The shared data models (`backend/app/models/` ↔ `frontend/src/types/models.ts`)
are the API contract — change both sides together. See `.kiro/steering/` for
conventions.

## Environment variables

Copy the example files and fill in keys (never commit real secrets):

- `backend/.env.example` → `backend/.env` — Claude + data API keys, CORS.
- `frontend/.env.example` → `frontend/.env.local` — API base URL, map style.
