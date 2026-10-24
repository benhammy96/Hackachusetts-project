# Atlas — Project Structure & Ownership

Monorepo with independent frontend and backend. Four teammates work on separate
branches; the boundaries below keep merges clean.

```
Hackachusetts-project/
├── frontend/              # React + Vite app
│   └── src/
│       ├── components/    # UI (MapView, ScorePanel, ExplanationCard, ComparisonView)
│       ├── lib/api.ts     # typed backend client
│       └── types/         # shared models mirroring backend
├── backend/               # FastAPI app
│   └── app/
│       ├── models/        # Pydantic models (the API contract)
│       ├── routers/       # HTTP endpoints (thin)
│       └── services/      # business logic (scoring, ai, data_sources)
└── .kiro/
    ├── steering/          # always-on project guidance (this folder)
    └── specs/atlas-foundation/  # requirements, design, tasks
```

## Workstream ownership

| Workstream        | Owns                                                        |
| ----------------- | ----------------------------------------------------------- |
| Frontend          | `frontend/` UI, map, layout, API client                     |
| Data integration  | `backend/app/services/data_sources.py`                      |
| Scoring           | `backend/app/services/scoring.py`, `routers/sites.py`       |
| Backend/API & AI  | `app/main.py`, `config.py`, `routers/`, `services/ai.py`    |

## Rules of the road

- Touch your workstream's files; coordinate before changing shared models.
- Keep routers thin — logic belongs in `services/`.
- Update both model definitions (Pydantic + TS) together.
- Each change should keep `npm run build` and the backend import test green.
