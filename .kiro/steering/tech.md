# Atlas — Tech & Conventions

## Stack

- **Frontend**: React 18, TypeScript, Vite 5, Tailwind CSS 3, MapLibre GL JS
- **Backend**: Python 3.12, FastAPI, Pydantic v2, Uvicorn
- **AI**: Anthropic Claude API (`anthropic` SDK)
- **Data**: OpenStreetMap (Overpass), FEMA, US Census, energy APIs

## Commands

Frontend (`frontend/`):

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run lint     # tsc --noEmit
```

Backend (`backend/`):

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000, docs at /docs
```

## Conventions

- **Shared models are the contract.** Backend Pydantic models in
  `backend/app/models/` and frontend types in `frontend/src/types/models.ts`
  must stay in sync. Change both when the API contract changes.
- **Category weights** are defined once per side (`DEFAULT_WEIGHTS`) and must
  sum to 1.0.
- Backend: type-hinted, `from __future__ import annotations`, services hold
  business logic, routers stay thin.
- Frontend: function components, `@/` path alias for `src/`, Tailwind for
  styling, typed API access through `src/lib/api.ts`.
- Secrets live in `.env` / `.env.local` (git-ignored). Never commit real keys.
- Placeholder logic returns deterministic stub data so both apps run before
  real implementations land.
