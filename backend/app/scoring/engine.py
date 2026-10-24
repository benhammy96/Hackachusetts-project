"""The scoring engine: deterministic, dependency-free orchestration.

``score_location`` is the single public entry point. Given normalized metrics
(and optional custom weights / config) it:

1. Normalizes weights to sum to 1.0.
2. Runs each category scorer (transparent rules, 0-100).
3. Computes the overall weighted average.
4. Aggregates data completeness, missing metrics, and warnings.
5. Detects *verified* disqualifying constraints and reports them separately
   from the numeric score.

The engine depends only on the shared ``app.models.site`` enums and this
package. It has no knowledge of HTTP, external APIs, the frontend, or Claude,
and it is a pure function: identical inputs always produce identical outputs.
"""

from __future__ import annotations

from app.models.site import ScoreCategory
from app.scoring.categories import CATEGORY_SCORERS
from app.scoring.config import DEFAULT_CONFIG, ScoringConfig
from app.scoring.contract import NormalizedMetrics
from app.scoring.models import (
    CategoryResult,
    DisqualifyingConstraint,
    SuitabilityResult,
)
from app.scoring.weights import normalize_weights


def _detect_disqualifiers(
    m: NormalizedMetrics, config: ScoringConfig
) -> list[DisqualifyingConstraint]:
    """Return verified disqualifying constraints (never from missing data).

    Only data that is explicitly present and True can disqualify. A missing
    value is never treated as a disqualifier.
    """
    constraints: list[DisqualifyingConstraint] = []
    t = config.thresholds

    if t.disqualify_in_sfha and m.in_special_flood_hazard_area is True:
        constraints.append(
            DisqualifyingConstraint(
                code="in_sfha",
                message=(
                    "Location is within a FEMA Special Flood Hazard Area (1%-annual-chance "
                    "floodplain). Flagged as a screening disqualifier; this is a shortlisting "
                    "assumption, not a regulatory determination."
                ),
                category=ScoreCategory.ENVIRONMENTAL,
            )
        )

    return constraints


def score_location(
    metrics: NormalizedMetrics,
    weights: dict[ScoreCategory, float] | None = None,
    config: ScoringConfig = DEFAULT_CONFIG,
    site_id: str | None = None,
) -> SuitabilityResult:
    """Score a single location. Pure and deterministic.

    Args:
        metrics: normalized geographic metrics (missing fields are ``None``).
        weights: optional custom weights (any scale; normalized to sum to 1.0).
        config: scoring configuration (thresholds). Defaults to ``DEFAULT_CONFIG``.
        site_id: optional identifier echoed back on the result.
    """
    resolved_weights = normalize_weights(weights)
    thresholds = config.thresholds

    categories: list[CategoryResult] = []
    overall = 0.0
    for category in ScoreCategory:  # deterministic enum order
        scorer = CATEGORY_SCORERS[category]
        result = scorer(metrics, thresholds)
        weight = resolved_weights[category]
        result.weight = round(weight, 6)
        result.weighted_score = round(result.score * weight, 4)
        overall += result.score * weight
        categories.append(result)

    # --- Aggregate completeness & missing metrics across categories. ---
    all_expected: list[str] = []
    all_used: list[str] = []
    all_missing: list[str] = []
    for c in categories:
        all_used.extend(c.used_metrics)
        all_missing.extend(c.missing_metrics)
    all_expected = all_used + all_missing
    data_completeness = (len(all_used) / len(all_expected)) if all_expected else 1.0

    # --- Warnings: surface low-confidence categories transparently. ---
    warnings: list[str] = []
    for c in categories:
        if c.completeness == 0.0:
            warnings.append(
                f"Category '{c.category.value}' had no available data; scored neutrally."
            )
        elif c.completeness < 1.0:
            warnings.append(
                f"Category '{c.category.value}' is {int(c.completeness * 100)}% complete."
            )

    # --- Disqualifying constraints: separate from the numeric score. ---
    disqualifiers = _detect_disqualifiers(metrics, config)

    return SuitabilityResult(
        site_id=site_id,
        overall_score=round(overall, 2),
        categories=categories,
        data_completeness=round(data_completeness, 4),
        missing_metrics=sorted(set(all_missing)),
        warnings=warnings,
        disqualifying_constraints=disqualifiers,
        is_disqualified=bool(disqualifiers),
    )
