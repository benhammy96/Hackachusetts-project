# Implementation Plan — Atlas Foundation

Scaffold tasks are complete (marked done). Remaining tasks are grouped by
workstream so the four teammates can work in parallel on separate branches.

## Scaffold (done)

- [x] 1. Initialize monorepo structure with `frontend/` and `backend/`
  - Separate projects, dependencies, READMEs, `.gitignore`, `.env.example`
  - _Requirements: 1.1, 1.4_

- [x] 2. Define shared data models (Pydantic + TypeScript)
  - `backend/app/models/*` and `frontend/src/types/models.ts` in sync
  - _Requirements: 3.1, 3.3, 4.1, 5.1_

- [x] 3. Scaffold FastAPI app with health, sites, explanations routers
  - App factory, CORS, config; placeholder scoring/ai/data services
  - _Requirements: 1.3, 3.1, 4.1, 5.1, 5.2_

- [x] 4. Scaffold React app with map and placeholder panels
  - MapView, ScorePanel, ExplanationCard, ComparisonView, typed API client
  - _Requirements: 1.2, 2.1_

- [x] 5. Author `.kiro/` steering and this spec
  - _Requirements: 1.1_

## Frontend workstream

- [ ] 6. Wire map clicks to candidate state and marker rendering
  - Drop markers on click, manage a candidate list, label candidates
  - _Requirements: 2.1, 2.2_

- [ ] 7. Connect panels to the API client
  - Call `scoreSites`, `explainScore`, `compareSites`; render live results
  - _Requirements: 3.3, 4.1, 5.1_

## Data integration workstream

- [ ] 8. Implement OSM Overpass adapter in `data_sources.py`
  - _Requirements: 6.1_
- [ ] 9. Implement FEMA hazard adapter
  - _Requirements: 6.1_
- [ ] 10. Implement Census community adapter
  - _Requirements: 6.1_
- [ ] 11. Implement energy profile adapter
  - _Requirements: 6.1_

## Scoring workstream

- [ ] 12. Replace stub category scorers with real metrics from the data layer
  - Map raw data into 0–100 per-category scores
  - _Requirements: 3.1, 3.3_
- [ ] 13. Add unit tests for weight normalization and scoring math
  - _Requirements: 3.2, 3.3_

## Backend / AI workstream

- [ ] 14. Implement the real Claude call in `services/ai.py`
  - Prompt design per audience; keep offline fallback
  - _Requirements: 5.1, 5.2_
- [ ] 15. Add request validation and error responses across routers
  - _Requirements: 1.3_
