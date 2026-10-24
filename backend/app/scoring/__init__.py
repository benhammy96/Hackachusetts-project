"""Atlas scoring engine (Person 3 — Scoring Algorithm).

A modular, deterministic engine that scores potential data center locations in
Massachusetts across five weighted categories. It is independent of external
APIs, FastAPI routes, the frontend, and Claude.

Typical use:

    from app.scoring import score_location, NormalizedMetrics

    metrics = NormalizedMetrics(
        nearest_residential_m=800,
        population_density_per_km2=120,
        flood_risk_category="low",
        max_temp_c=33,
        residential_density_per_km2=35,
        parcel_area_m2=50000,
    )
    result = score_location(metrics)
    print(result.overall_score, result.data_completeness)

To score the output of the data-integration layer, use the adapter:

    from app.scoring import score_from_location_metrics
    result = score_from_location_metrics(location_metrics, weights=custom)
"""

from __future__ import annotations

from app.models.site import ScoreCategory
from app.scoring.config import (
    DEFAULT_CATEGORY_WEIGHTS,
    DEFAULT_CONFIG,
    ScoringConfig,
    ScoringThresholds,
)
from app.scoring.contract import NormalizedMetrics, from_location_metrics
from app.scoring.engine import score_location
from app.scoring.models import (
    CategoryResult,
    DisqualifyingConstraint,
    SuitabilityResult,
)
from app.scoring.weights import normalize_weights

__all__ = [
    "score_location",
    "score_from_location_metrics",
    "NormalizedMetrics",
    "from_location_metrics",
    "SuitabilityResult",
    "CategoryResult",
    "DisqualifyingConstraint",
    "ScoringConfig",
    "ScoringThresholds",
    "DEFAULT_CONFIG",
    "DEFAULT_CATEGORY_WEIGHTS",
    "normalize_weights",
    "ScoreCategory",
]


def score_from_location_metrics(
    location,  # app.data.models.LocationMetrics (typed loosely to avoid import)
    weights: dict[ScoreCategory, float] | None = None,
    config: ScoringConfig = DEFAULT_CONFIG,
    site_id: str | None = None,
) -> SuitabilityResult:
    """Convenience: adapt ``LocationMetrics`` then score.

    This is the single bridge between the data layer and scoring. Keeping it
    here (rather than inside the data layer) means neither teammate's core code
    depends on the other's.
    """
    metrics = from_location_metrics(location)
    return score_location(metrics, weights=weights, config=config, site_id=site_id)
