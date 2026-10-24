# Requirements — Atlas Foundation

## Introduction

Atlas is an AI-powered data center site selection platform for Hackachusetts
2026's Climate Tech track. This spec covers the full feature set; the current
milestone is the **scaffold** — a clean, modular, runnable foundation that four
teammates can build on in parallel. Later milestones implement the real map
interaction, scoring, data integration, comparison, and AI explanations.

## Requirements

### Requirement 1 — Project foundation

**User Story:** As a developer on the team, I want a modular, runnable
scaffold, so that four workstreams can progress independently without merge
conflicts.

#### Acceptance Criteria

1. WHEN the repo is cloned THEN it SHALL contain separate `frontend/` and
   `backend/` projects with their own dependencies and READMEs.
2. WHEN the frontend build runs THEN it SHALL complete without type errors.
3. WHEN the backend app is imported THEN it SHALL expose working health,
   scoring, comparison, and explanation routes.
4. WHEN the repo is inspected THEN it SHALL include `.gitignore`, root README,
   and `.env.example` files for both apps.

### Requirement 2 — Interactive map site selection

**User Story:** As a user, I want to select potential data center locations on
a map, so that I can evaluate candidate sites.

#### Acceptance Criteria

1. WHEN the app loads THEN it SHALL display an interactive MapLibre map.
2. WHEN the user clicks the map THEN the app SHALL capture the coordinates as a
   candidate location.

### Requirement 3 — Weighted suitability scoring

**User Story:** As a user, I want each site scored across weighted categories,
so that I can judge overall suitability.

#### Acceptance Criteria

1. WHEN a candidate is scored THEN the system SHALL produce category scores for
   community (25%), energy (25%), environmental (20%), infrastructure (15%),
   and land (15%).
2. WHEN category weights are overridden THEN the system SHALL normalize them to
   sum to 1.0.
3. WHEN scoring completes THEN the system SHALL return an overall 0–100 score
   with a per-category breakdown.

### Requirement 4 — Site comparison

**User Story:** As a user, I want to compare candidate sites, so that I can
pick the best one.

#### Acceptance Criteria

1. WHEN two or more scored sites are submitted THEN the system SHALL return them
   ranked best to worst with a designated best site.

### Requirement 5 — AI-generated explanations

**User Story:** As a user, I want a plain-language explanation of a site's
score, so that I understand the reasoning.

#### Acceptance Criteria

1. WHEN an explanation is requested for a scored site THEN the system SHALL
   return a summary and detailed narrative.
2. IF no Claude API key is configured THEN the system SHALL return a
   deterministic offline explanation so the app remains runnable.

### Requirement 6 — External data integration

**User Story:** As the scoring engine, I want typed access to external data,
so that category scores reflect real-world conditions.

#### Acceptance Criteria

1. WHEN the data layer is called THEN it SHALL expose typed adapters for
   OpenStreetMap, FEMA, Census, and energy data.
2. WHILE adapters are placeholders THEY SHALL return typed stub data without
   requiring network access.
