# Atlas Frontend

React + TypeScript + Vite + Tailwind CSS + MapLibre GL JS.

## Setup

```bash
cd frontend
npm install
cp .env.example .env.local   # optional overrides
```

## Run

```bash
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check + production build
npm run lint     # tsc --noEmit type check
```

The dev server proxies `/api/*` to the FastAPI backend on port 8000
(see `vite.config.ts`), so run the backend alongside it.

## Structure

```
frontend/src/
├── main.tsx                 # entry point
├── App.tsx                  # layout shell
├── components/              # placeholder UI components
│   ├── MapView.tsx          # MapLibre map (frontend)
│   ├── ScorePanel.tsx       # score breakdown (scoring)
│   ├── ExplanationCard.tsx  # AI explanation (ai)
│   └── ComparisonView.tsx   # site comparison (frontend)
├── lib/api.ts               # typed backend client
└── types/models.ts          # shared models mirroring backend Pydantic
```
