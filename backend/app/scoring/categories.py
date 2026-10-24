"""Per-category scorers.

Each scorer takes the :class:`NormalizedMetrics` contract plus thresholds and
returns a :class:`CategoryResult` (score 0-100, plus which inputs it used, which
were missing, and notes). All rules are transparent and documented inline.

Design rules shared by every scorer:

* Higher score = better suitability (0 worst, 100 best).
* A missing input is never treated as 0 or invented. Instead the scorer scores
  only the sub-signals it has data for and reports completeness = available /
  expected. If *no* input is available, completeness is 0 and the score falls
  back to a neutral 50 (explicitly flagged in notes) so a totally-unknown
  category neither rewards nor punishes a site — the low completeness is the
  honest signal, surfaced separately.
* Scorers are pure functions: identical inputs -> identical outputs.

Thresholds are configurable screening assumptions (see ``config.py``), not
validated regulatory limits.
"""

from __future__ import annotations

from app.models.site import ScoreCategory
from app.scoring.config import ScoringThresholds
from app.scoring.contract import NormalizedMetrics
from app.scoring.models import CategoryResult

# Score used when a category has no available inputs at all. Neutral by design.
NEUTRAL_SCORE = 50.0


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _lerp_descending(value: float, best_at: float, worst_at: float) -> float:
    """Map a value to 0-100 where <= best_at -> 100 and >= worst_at -> 0.

    Used when a *lower* raw value is better (e.g. hazard, density near homes).
    """
    if worst_at == best_at:
        return 100.0 if value <= best_at else 0.0
    frac = (value - best_at) / (worst_at - best_at)
    return _clamp(100.0 * (1.0 - frac))


def _lerp_ascending(value: float, worst_at: float, best_at: float) -> float:
    """Map a value to 0-100 where <= worst_at -> 0 and >= best_at -> 100.

    Used when a *higher* raw value is better (e.g. buffer distance, parcel size).
    """
    if best_at == worst_at:
        return 100.0 if value >= best_at else 0.0
    frac = (value - worst_at) / (best_at - worst_at)
    return _clamp(100.0 * frac)


def _assemble(
    category: ScoreCategory,
    sub_scores: list[tuple[str, float | None]],
    expected: list[str],
    notes: list[str],
) -> CategoryResult:
    """Combine available sub-scores into a CategoryResult.

    ``sub_scores`` is a list of (metric_name, score_or_None). Available ones are
    averaged. Completeness = available expected inputs / all expected inputs.
    """
    used = [name for name, s in sub_scores if s is not None]
    missing = [name for name in expected if name not in used]
    present_scores = [s for _, s in sub_scores if s is not None]

    completeness = (len(used) / len(expected)) if expected else 1.0

    if present_scores:
        score = sum(present_scores) / len(present_scores)
    else:
        score = NEUTRAL_SCORE
        notes = notes + [
            "No inputs available for this category; using a neutral score. "
            "See data_completeness for the honest confidence signal."
        ]

    return CategoryResult(
        category=category,
        score=round(_clamp(score), 2),
        weight=0.0,  # filled in by the engine after normalization
        weighted_score=0.0,  # filled in by the engine
        completeness=round(completeness, 4),
        used_metrics=used,
        missing_metrics=missing,
        notes=notes,
    )


def score_community(m: NormalizedMetrics, t: ScoringThresholds) -> CategoryResult:
    """Community impact: distance from residents and local population density.

    More buffer from the nearest home and lower surrounding population density
    mean lower community impact -> higher suitability.
    """
    sub: list[tuple[str, float | None]] = []
    expected = ["nearest_residential_m", "population_density_per_km2"]

    if m.nearest_residential_m is not None:
        sub.append((
            "nearest_residential_m",
            _lerp_ascending(
                m.nearest_residential_m,
                worst_at=t.min_residential_buffer_m,
                best_at=t.ideal_residential_buffer_m,
            ),
        ))
    else:
        sub.append(("nearest_residential_m", None))

    if m.population_density_per_km2 is not None:
        sub.append((
            "population_density_per_km2",
            _lerp_descending(
                m.population_density_per_km2,
                best_at=t.low_pop_density_per_km2,
                worst_at=t.high_pop_density_per_km2,
            ),
        ))
    else:
        sub.append(("population_density_per_km2", None))

    return _assemble(ScoreCategory.COMMUNITY, sub, expected, notes=[])


def score_energy(m: NormalizedMetrics, t: ScoringThresholds) -> CategoryResult:
    """Energy / grid suitability.

    There is no live grid-capacity data source in the project yet, and we must
    not invent grid capacity. If present (future data), higher capacity and a
    higher renewable share score better; otherwise this category reports no
    inputs and relies on the neutral/completeness mechanism.
    """
    sub: list[tuple[str, float | None]] = []
    expected = ["grid_capacity_mw", "renewable_share"]

    if m.grid_capacity_mw is not None:
        # 0 MW -> 0, >= 200 MW -> 100 (screening assumption).
        sub.append(("grid_capacity_mw", _lerp_ascending(m.grid_capacity_mw, 0.0, 200.0)))
    else:
        sub.append(("grid_capacity_mw", None))

    if m.renewable_share is not None:
        # renewable_share expected 0..1 -> 0..100.
        sub.append(("renewable_share", _clamp(m.renewable_share * 100.0)))
    else:
        sub.append(("renewable_share", None))

    notes = [
        "No live grid-capacity data source exists yet; energy suitability is "
        "unscored until that data is integrated. Values are never invented."
    ]
    return _assemble(ScoreCategory.ENERGY, sub, expected, notes=notes)


def score_environmental(m: NormalizedMetrics, t: ScoringThresholds) -> CategoryResult:
    """Environmental risk: flood hazard and cooling/heat stress.

    Lower flood risk and lower peak temperatures -> higher suitability. A
    verified Special Flood Hazard Area is additionally surfaced as a *separate*
    disqualifying constraint by the engine; here it only informs the score.
    """
    sub: list[tuple[str, float | None]] = []
    expected = ["flood_risk_category", "max_temp_c"]

    if m.flood_risk_category is not None:
        cat = m.flood_risk_category.lower()
        flood_score = {
            "low": 90.0,
            "moderate": 60.0,
            "undetermined": 50.0,
            "high": 10.0,
        }.get(cat, 50.0)
        sub.append(("flood_risk_category", flood_score))
    else:
        sub.append(("flood_risk_category", None))

    if m.max_temp_c is not None:
        sub.append((
            "max_temp_c",
            _lerp_descending(m.max_temp_c, best_at=t.benign_max_temp_c, worst_at=t.severe_max_temp_c),
        ))
    else:
        sub.append(("max_temp_c", None))

    return _assemble(ScoreCategory.ENVIRONMENTAL, sub, expected, notes=[])


def score_infrastructure(m: NormalizedMetrics, t: ScoringThresholds) -> CategoryResult:
    """Infrastructure accessibility.

    Without a dedicated roads/fiber/utility data source yet, surrounding
    development density is used as a transparent proxy: some nearby development
    signals existing access to roads and services. This is a screening proxy,
    documented as such, not a measured infrastructure inventory.
    """
    sub: list[tuple[str, float | None]] = []
    expected = ["residential_density_per_km2"]

    if m.residential_density_per_km2 is not None:
        sub.append((
            "residential_density_per_km2",
            _lerp_ascending(
                m.residential_density_per_km2,
                worst_at=0.0,
                best_at=t.developed_density_per_km2,
            ),
        ))
    else:
        sub.append(("residential_density_per_km2", None))

    notes = [
        "Infrastructure uses surrounding development density as a proxy; no "
        "dedicated road/fiber/utility data source is integrated yet."
    ]
    return _assemble(ScoreCategory.INFRASTRUCTURE, sub, expected, notes=notes)


def score_land(m: NormalizedMetrics, t: ScoringThresholds) -> CategoryResult:
    """Land and development suitability: parcel size.

    Larger parcels better accommodate a data center footprint. Zoning/approval
    is NOT scored — we do not have verified zoning data and must not invent it.
    """
    sub: list[tuple[str, float | None]] = []
    expected = ["parcel_area_m2"]

    if m.parcel_area_m2 is not None:
        sub.append((
            "parcel_area_m2",
            _lerp_ascending(
                m.parcel_area_m2,
                worst_at=t.min_parcel_area_m2,
                best_at=t.ample_parcel_area_m2,
            ),
        ))
    else:
        sub.append(("parcel_area_m2", None))

    notes = [
        "Land suitability scores parcel size only; zoning/approval is not "
        "scored because no verified zoning data is available."
    ]
    return _assemble(ScoreCategory.LAND, sub, expected, notes=notes)


# Registry mapping each category to its scorer, for the engine to iterate.
CATEGORY_SCORERS = {
    ScoreCategory.COMMUNITY: score_community,
    ScoreCategory.ENERGY: score_energy,
    ScoreCategory.ENVIRONMENTAL: score_environmental,
    ScoreCategory.INFRASTRUCTURE: score_infrastructure,
    ScoreCategory.LAND: score_land,
}
