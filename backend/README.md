# Atlas Backend

FastAPI service powering Atlas site scoring, comparison, and AI explanations.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in keys
```

## Run

```bash
uvicorn app.main:app --reload
```

- API root: http://localhost:8000/
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Structure

```
backend/
├── app/
│   ├── main.py            # FastAPI app factory + entrypoint
│   ├── config.py          # Settings loaded from env / .env
│   ├── models/            # Shared Pydantic models (site, explanation, comparison)
│   ├── routers/           # API routes (health, sites, explanations)
│   └── services/          # Business logic (scoring, ai, data_sources)
└── requirements.txt
```

## Ownership (modular work split)

- **Scoring** — `app/services/scoring.py`, `app/routers/sites.py`
- **Data integration** — `app/services/data_sources.py`
- **AI** — `app/services/ai.py`, `app/routers/explanations.py`
- **Backend/API** — `app/main.py`, `app/config.py`, routing, shared models

All placeholder logic returns deterministic stub data so the pipeline runs
end-to-end before real implementations land.
