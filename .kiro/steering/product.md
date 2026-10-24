# Atlas — Product Overview

Atlas is an AI-powered data center site selection platform built for
Hackachusetts 2026's Climate Tech track.

## Problem

Data center siting decisions have large, long-lived environmental and community
impacts. Teams need a way to evaluate candidate locations against environmental
risk, energy availability, infrastructure, land suitability, and community
factors — and to understand *why* a location scores the way it does.

## What Atlas does

1. **Interactive map** — users select potential data center locations.
2. **Weighted scoring** — each site is scored across five categories:
   - Community impact — 25%
   - Energy — 25%
   - Environmental risk — 20%
   - Infrastructure — 15%
   - Land suitability — 15%
3. **Comparison** — candidate locations are ranked side by side.
4. **AI explanations** — Claude explains each suitability score in plain language.

## Data sources

OpenStreetMap (infrastructure/land), FEMA (hazard/flood risk), US Census
(community/demographics), and energy APIs (grid capacity, renewables, price).

## Principles

- Transparency: every score is explainable and traceable to its inputs.
- Sustainability-first: environmental and community impact are weighted heavily.
- Modularity: the four workstreams evolve independently.
