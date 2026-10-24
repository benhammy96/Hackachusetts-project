"""Weighted scoring service.

This is a placeholder implementation. The scoring teammate will replace the
stub category scorers with real logic backed by the data integration layer.
The public surface (``score_candidate`` / ``score_candidates``) is stable so
the API routes and frontend can be built against it now.
"""

from __future__ import annotations

from app.models.site import (
    DEFAULT_WEIGHTS,
    ScoreBreakdown,
    ScoreCategory,
    SiteCandidate,
    SiteScore,
)


def normalize_weights(
    weights: dict[ScoreCategory, float] | None,
) -> dict[ScoreCategory, float]:
    """Return weights that sum to 1.0, falling back to defaults."""
    if not weights:
        return dict(DEFAULT_WEIGHTS)

    total = sum(weights.values())
    if total <= 0:
        return dict(DEFAULT_WEIGHTS)

    # Ensure every category is present, defaulting missing ones to 0.
    merged = {cat: weights.get(cat, 0.0) for cat in ScoreCategory}
    return {cat: value / total for cat, value in merged.items()}


def _raw_category_score(candidate: SiteCandidate, category: ScoreCategory) -> float:
    """Placeholder per-category scorer.

    TODO(scoring): replace with real metrics derived from FEMA, Census, energy
    and OSM data. For now this returns a deterministic pseudo-score so the
    pipeline is exercisable end-to-end.
    """
    seed = abs(hash((candidate.id, category.value))) % 1000
    return round(seed / 10.0, 2)  # 0.0 - 99.9


def score_candidate(
    candidate: SiteCandidate,
    weights: dict[ScoreCategory, float] | None = None,
) -> SiteScore:
    """Compute a weighted suitability score for a single candidate."""
    resolved = normalize_weights(weights)

    breakdown: list[ScoreBreakdown] = []
    overall = 0.0
    for category in ScoreCategory:
        raw = _raw_category_score(candidate, category)
        weight = resolved[category]
        weighted = round(raw * weight, 2)
        overall += weighted
        breakdown.append(
            ScoreBreakdown(
                category=category,
                raw_score=raw,
                weight=weight,
                weighted_score=weighted,
            )
        )

    return SiteScore(
        site_id=candidate.id,
        overall_score=round(overall, 2),
        breakdown=breakdown,
    )


def score_candidates(
    candidates: list[SiteCandidate],
    weights: dict[ScoreCategory, float] | None = None,
) -> list[SiteScore]:
    """Compute scores for a batch of candidates."""
    return [score_candidate(candidate, weights) for candidate in candidates]
