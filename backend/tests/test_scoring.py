"""Tests for the Atlas scoring engine (``app.scoring``).

Covers weighted-average correctness, default and custom weights, score bounds,
missing-data handling, determinism, disqualifying constraints, invalid inputs,
and the all-available / all-missing extremes. Property-based tests via Hypothesis
assert invariants across randomized inputs.
"""

from __future__ import annotations

import math

import pytest

from app.models.site import ScoreCategory
from app.scoring import (
    NormalizedMetrics,
    ScoringConfig,
    ScoringThresholds,
    normalize_weights,
    score_location,
)

try:
    from hypothesis import given, settings
    from hypothesis import strategies as st

    HAS_HYPOTHESIS = True
except ImportError:  # pragma: no cover
    HAS_HYPOTHESIS = False


# A fully-populated, "good" site used across several tests.
FULL_METRICS = NormalizedMetrics(
    population_density_per_km2=120.0,
    nearest_residential_m=800.0,
    residential_count=40,
    grid_capacity_mw=150.0,
    renewable_share=0.4,
    in_special_flood_hazard_area=False,
    flood_risk_category="low",
    max_temp_c=33.0,
    residential_density_per_km2=35.0,
    tract_population=4000,
    land_use_code="COMMERCIAL",
    parcel_area_m2=50000.0,
)


# --- Weighted-average correctness -----------------------------------------


def test_overall_is_weighted_average_of_categories():
    result = score_location(FULL_METRICS)
    expected = sum(c.score * c.weight for c in result.categories)
    assert result.overall_score == pytest.approx(round(expected, 2), abs=0.01)


def test_weighted_scores_sum_to_overall():
    result = score_location(FULL_METRICS)
    assert result.overall_score == pytest.approx(
        sum(c.weighted_score for c in result.categories), abs=0.05
    )


# --- Default weights -------------------------------------------------------


def test_default_weights_match_spec():
    result = score_location(FULL_METRICS)
    by_cat = {c.category: c.weight for c in result.categories}
    assert by_cat[ScoreCategory.COMMUNITY] == pytest.approx(0.25)
    assert by_cat[ScoreCategory.ENERGY] == pytest.approx(0.25)
    assert by_cat[ScoreCategory.ENVIRONMENTAL] == pytest.approx(0.20)
    assert by_cat[ScoreCategory.INFRASTRUCTURE] == pytest.approx(0.15)
    assert by_cat[ScoreCategory.LAND] == pytest.approx(0.15)


def test_default_weights_sum_to_one():
    result = score_location(FULL_METRICS)
    assert sum(c.weight for c in result.categories) == pytest.approx(1.0)


# --- Custom weight normalization ------------------------------------------


def test_custom_weights_as_percentages_are_normalized():
    weights = {
        ScoreCategory.COMMUNITY: 50,
        ScoreCategory.ENERGY: 50,
        ScoreCategory.ENVIRONMENTAL: 0,
        ScoreCategory.INFRASTRUCTURE: 0,
        ScoreCategory.LAND: 0,
    }
    result = score_location(FULL_METRICS, weights=weights)
    by_cat = {c.category: c.weight for c in result.categories}
    assert by_cat[ScoreCategory.COMMUNITY] == pytest.approx(0.5)
    assert by_cat[ScoreCategory.ENERGY] == pytest.approx(0.5)
    assert sum(c.weight for c in result.categories) == pytest.approx(1.0)


def test_custom_weights_as_fractions_are_normalized():
    weights = {ScoreCategory.COMMUNITY: 0.1, ScoreCategory.LAND: 0.1}
    resolved = normalize_weights(weights)
    assert sum(resolved.values()) == pytest.approx(1.0)
    assert resolved[ScoreCategory.COMMUNITY] == pytest.approx(0.5)


def test_empty_or_zero_weights_fall_back_to_defaults():
    assert normalize_weights(None)[ScoreCategory.COMMUNITY] == pytest.approx(0.25)
    all_zero = {c: 0 for c in ScoreCategory}
    assert normalize_weights(all_zero)[ScoreCategory.COMMUNITY] == pytest.approx(0.25)


def test_negative_weights_are_clamped():
    weights = {ScoreCategory.COMMUNITY: -5, ScoreCategory.ENERGY: 5}
    resolved = normalize_weights(weights)
    assert resolved[ScoreCategory.COMMUNITY] == pytest.approx(0.0)
    assert resolved[ScoreCategory.ENERGY] == pytest.approx(1.0)


# --- Score boundaries ------------------------------------------------------


def test_scores_within_bounds_for_full_metrics():
    result = score_location(FULL_METRICS)
    assert 0.0 <= result.overall_score <= 100.0
    for c in result.categories:
        assert 0.0 <= c.score <= 100.0
        assert 0.0 <= c.weighted_score <= 100.0


def test_extreme_bad_site_stays_in_bounds():
    bad = NormalizedMetrics(
        population_density_per_km2=999999.0,
        nearest_residential_m=0.0,
        flood_risk_category="high",
        max_temp_c=100.0,
        residential_density_per_km2=0.0,
        parcel_area_m2=0.0,
    )
    result = score_location(bad)
    assert 0.0 <= result.overall_score <= 100.0
    for c in result.categories:
        assert 0.0 <= c.score <= 100.0


# --- Missing-data handling -------------------------------------------------


def test_missing_data_does_not_invent_values():
    partial = NormalizedMetrics(nearest_residential_m=800.0)  # most fields None
    result = score_location(partial)
    assert result.data_completeness < 1.0
    assert result.missing_metrics  # reported, not silently zeroed
    # Energy had no data -> neutral and flagged.
    energy = next(c for c in result.categories if c.category == ScoreCategory.ENERGY)
    assert energy.completeness == 0.0


def test_missing_value_not_treated_as_zero():
    # A site with only a great buffer distance should not be dragged to ~0 by
    # missing fields; missing is routed to completeness, not a 0 score.
    partial = NormalizedMetrics(nearest_residential_m=1000.0)
    community = next(
        c for c in score_location(partial).categories
        if c.category == ScoreCategory.COMMUNITY
    )
    assert community.score > 50.0  # driven by the one available, good signal


# --- Determinism -----------------------------------------------------------


def test_identical_inputs_produce_identical_outputs():
    a = score_location(FULL_METRICS).model_dump()
    b = score_location(FULL_METRICS).model_dump()
    assert a == b


def test_determinism_with_custom_weights():
    w = {ScoreCategory.COMMUNITY: 30, ScoreCategory.ENERGY: 70}
    a = score_location(FULL_METRICS, weights=w).model_dump()
    b = score_location(FULL_METRICS, weights=w).model_dump()
    assert a == b


# --- Disqualifying constraints --------------------------------------------


def test_verified_sfha_is_disqualifying_and_separate():
    m = NormalizedMetrics(in_special_flood_hazard_area=True, flood_risk_category="high")
    result = score_location(m)
    assert result.is_disqualified is True
    assert any(d.code == "in_sfha" for d in result.disqualifying_constraints)
    # The numeric score is still computed independently of the flag.
    assert 0.0 <= result.overall_score <= 100.0


def test_missing_sfha_is_not_disqualifying():
    m = NormalizedMetrics(in_special_flood_hazard_area=None)
    result = score_location(m)
    assert result.is_disqualified is False


def test_false_sfha_is_not_disqualifying():
    m = NormalizedMetrics(in_special_flood_hazard_area=False)
    assert score_location(m).is_disqualified is False


def test_disqualifier_can_be_configured_off():
    cfg = ScoringConfig(thresholds=ScoringThresholds(disqualify_in_sfha=False))
    m = NormalizedMetrics(in_special_flood_hazard_area=True)
    assert score_location(m, config=cfg).is_disqualified is False


# --- Invalid inputs --------------------------------------------------------


def test_unknown_flood_category_scored_neutrally_not_crash():
    m = NormalizedMetrics(flood_risk_category="banana")
    env = next(
        c for c in score_location(m).categories
        if c.category == ScoreCategory.ENVIRONMENTAL
    )
    assert 0.0 <= env.score <= 100.0


def test_non_numeric_metric_via_adapter_is_ignored(monkeypatch):
    from app.scoring.contract import _num

    assert _num("not-a-number") is None
    assert _num(None) is None
    assert _num("42") == 42.0


# --- All available / all unavailable --------------------------------------


def test_all_metrics_available_gives_full_completeness():
    result = score_location(FULL_METRICS)
    assert result.data_completeness == pytest.approx(1.0)
    assert result.missing_metrics == []
    for c in result.categories:
        assert c.completeness == pytest.approx(1.0)


def test_all_metrics_unavailable():
    empty = NormalizedMetrics()
    result = score_location(empty)
    assert result.data_completeness == pytest.approx(0.0)
    # Every category neutral, overall neutral, still in bounds.
    assert result.overall_score == pytest.approx(50.0, abs=0.01)
    assert 0.0 <= result.overall_score <= 100.0
    assert result.warnings  # low-confidence warnings surfaced


# --- Property-based tests (Hypothesis) ------------------------------------

if HAS_HYPOTHESIS:

    _optional_float = st.one_of(st.none(), st.floats(min_value=0, max_value=1e6, allow_nan=False))

    @settings(max_examples=200)
    @given(
        pop=_optional_float,
        near=_optional_float,
        maxt=st.one_of(st.none(), st.floats(min_value=-50, max_value=120, allow_nan=False)),
        resdens=_optional_float,
        parcel=_optional_float,
        flood=st.one_of(st.none(), st.sampled_from(["low", "moderate", "high", "undetermined", "weird"])),
    )
    def test_property_scores_always_in_bounds(pop, near, maxt, resdens, parcel, flood):
        m = NormalizedMetrics(
            population_density_per_km2=pop,
            nearest_residential_m=near,
            max_temp_c=maxt,
            residential_density_per_km2=resdens,
            parcel_area_m2=parcel,
            flood_risk_category=flood,
        )
        result = score_location(m)
        assert 0.0 <= result.overall_score <= 100.0
        for c in result.categories:
            assert 0.0 <= c.score <= 100.0
            assert 0.0 <= c.weighted_score <= 100.0
        assert 0.0 <= result.data_completeness <= 1.0

    @settings(max_examples=100)
    @given(
        w1=st.floats(min_value=0, max_value=1000, allow_nan=False),
        w2=st.floats(min_value=0, max_value=1000, allow_nan=False),
        w3=st.floats(min_value=0, max_value=1000, allow_nan=False),
    )
    def test_property_weights_always_sum_to_one(w1, w2, w3):
        weights = {
            ScoreCategory.COMMUNITY: w1,
            ScoreCategory.ENERGY: w2,
            ScoreCategory.ENVIRONMENTAL: w3,
        }
        resolved = normalize_weights(weights)
        # Either defaults (if all zero) or normalized; both sum to 1.0.
        assert math.isclose(sum(resolved.values()), 1.0, abs_tol=1e-9)

    @settings(max_examples=100)
    @given(
        pop=_optional_float,
        near=_optional_float,
        parcel=_optional_float,
    )
    def test_property_determinism(pop, near, parcel):
        m = NormalizedMetrics(
            population_density_per_km2=pop, nearest_residential_m=near, parcel_area_m2=parcel
        )
        assert score_location(m).model_dump() == score_location(m).model_dump()
