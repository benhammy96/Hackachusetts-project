"""Weight handling: defaults, custom overrides, and normalization.

Weights are accepted from the frontend as a mapping of category -> number. The
numbers may be any non-negative scale (percentages like 25 or fractions like
0.25); they are normalized to sum to 1.0. Missing categories default to 0 unless
no weights are supplied at all, in which case the shared defaults are used.
"""

from __future__ import annotations

from app.models.site import ScoreCategory
from app.scoring.config import DEFAULT_CATEGORY_WEIGHTS


def normalize_weights(
    weights: dict[ScoreCategory, float] | None,
) -> dict[ScoreCategory, float]:
    """Return weights for all five categories that sum to 1.0.

    Rules:

    * ``None`` or empty -> the shared default weights.
    * Negative values are clamped to 0 (a negative weight is meaningless).
    * If the provided weights sum to <= 0 (e.g. all zero) -> defaults.
    * Otherwise each weight is divided by the total so the result sums to 1.0,
      regardless of whether the caller passed percentages or fractions.
    """
    if not weights:
        return dict(DEFAULT_CATEGORY_WEIGHTS)

    clamped = {cat: max(0.0, float(weights.get(cat, 0.0))) for cat in ScoreCategory}
    total = sum(clamped.values())
    if total <= 0:
        return dict(DEFAULT_CATEGORY_WEIGHTS)

    return {cat: value / total for cat, value in clamped.items()}
