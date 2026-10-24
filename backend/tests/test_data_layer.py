"""Tests for the Massachusetts geographic data layer (``app.data``).

These tests avoid live network calls. Source fetches are monkeypatched so we can
assert on validation, aggregation, missing-value handling, caching, and the
demo fixtures deterministically.
"""

from __future__ import annotations

import asyncio

import pytest

from app.data import (
    DEMO_LOCATIONS,
    MetricStatus,
    all_fixtures,
    get_location_metrics,
    is_in_massachusetts,
    nearest_fixture,
)
from app.data.cache import TTLCache, coord_key
from app.data.geo import haversine_meters
from app.data.models import DataSourceName, Metric, MetricGroup
from app.models.site import Coordinates


# --- Coordinate validation -------------------------------------------------


def test_boston_is_in_massachusetts():
    assert is_in_massachusetts(Coordinates(lat=42.3601, lng=-71.0589)).is_valid


@pytest.mark.parametrize(
    "lat,lng",
    [
        (40.7128, -74.0060),  # New York City — well south/west of MA
        (43.6591, -70.2568),  # Portland, ME — north of MA
        (42.0, -75.0),        # central NY — west of MA
        (41.0, -71.0),        # Atlantic south of MA
    ],
)
def test_clearly_out_of_state_is_rejected(lat, lng):
    result = is_in_massachusetts(Coordinates(lat=lat, lng=lng))
    assert not result.is_valid
    assert result.reason  # a human-readable explanation is always present


def test_near_border_point_passes_bounding_box():
    """Documented limitation: validation is a bounding box, not the true state
    polygon, so points just outside the border (e.g. Hartford, CT) can pass.
    See ``app.data.geo`` for the rationale. This test pins that behavior so it
    is a conscious choice, not an accident.
    """
    hartford = Coordinates(lat=41.7658, lng=-72.6734)
    assert is_in_massachusetts(hartford).is_valid is True


def test_out_of_state_short_circuits_without_sources():
    result = asyncio.run(get_location_metrics(40.7128, -74.0060))
    assert result.in_massachusetts is False
    assert result.groups == []
    assert result.warnings  # explains why nothing was queried


# --- Metric model ----------------------------------------------------------


def test_missing_metric_never_invents_a_value():
    m = Metric.missing(
        key="x",
        label="X",
        status=MetricStatus.MISSING_NO_COVERAGE,
        reason="no coverage here",
    )
    assert m.value is None
    assert m.status == MetricStatus.MISSING_NO_COVERAGE
    assert m.missing_reason == "no coverage here"


# --- Aggregation with mocked sources --------------------------------------


def test_aggregator_isolates_source_failures(monkeypatch):
    """A single source failing must not break the whole response."""

    async def ok_group(self, coords):
        return MetricGroup(
            name="residential",
            source=DataSourceName.OSM_OVERPASS,
            metrics=[Metric.ok("residential_count", "n", 5, "count", DataSourceName.OSM_OVERPASS)],
        )

    async def failing_group(self, coords):
        return MetricGroup(
            name="flood",
            source=DataSourceName.FEMA_NFHL,
            error="boom",
            metrics=[],
        )

    from app.data import aggregator

    monkeypatch.setattr(aggregator.ResidentialSource, "fetch", ok_group)
    monkeypatch.setattr(aggregator.FloodSource, "fetch", failing_group)
    # Keep the others cheap too.
    monkeypatch.setattr(aggregator.PopulationSource, "fetch", failing_group)
    monkeypatch.setattr(aggregator.LandUseSource, "fetch", failing_group)
    monkeypatch.setattr(aggregator.TemperatureSource, "fetch", ok_group)

    result = asyncio.run(aggregator.get_location_metrics(42.3601, -71.0589))
    assert result.in_massachusetts is True
    # Residential succeeded; flood recorded a warning; object still complete.
    assert result.group("residential") is not None
    assert any("flood" in w for w in result.warnings)


# --- Caching ---------------------------------------------------------------


def test_coord_key_rounds_nearby_points_together():
    a = coord_key("flood", 42.36011, -71.05892)
    b = coord_key("flood", 42.36013, -71.05894)  # ~a couple meters away
    assert a == b


def test_ttl_cache_roundtrip(tmp_path):
    cache = TTLCache(ttl_seconds=100, persist=True, cache_dir=tmp_path)
    cache.set("k", {"hello": "world"})
    assert cache.get("k") == {"hello": "world"}


def test_ttl_cache_expiry(tmp_path):
    cache = TTLCache(ttl_seconds=0, persist=False, cache_dir=tmp_path)
    cache.set("k", 123)
    assert cache.get("k") is None  # already expired


# --- Fixtures --------------------------------------------------------------


def test_three_demo_fixtures_exist_and_load():
    fixtures = all_fixtures()
    assert set(fixtures) == set(DEMO_LOCATIONS)
    for name, model in fixtures.items():
        assert model.from_fixture is True
        assert model.in_massachusetts is True
        assert model.groups, f"{name} fixture has no groups"


def test_demo_fixtures_have_priority_metrics_present():
    """Residential proximity and flood are priority metrics; the demo must show them."""
    for name, model in all_fixtures().items():
        res = model.group("residential")
        assert res is not None and res.error is None, f"{name} residential missing"
        assert res.as_dict()["residential_count"].value is not None


def test_nearest_fixture_snaps_near_demo_city():
    # A point ~1km from downtown Boston should snap to the Boston fixture.
    near_boston = Coordinates(lat=42.3680, lng=-71.0590)
    snapped = nearest_fixture(near_boston)
    assert snapped is not None
    assert snapped.from_fixture is True


def test_nearest_fixture_returns_none_when_far():
    # Far western MA, nowhere near a demo city.
    far = Coordinates(lat=42.70, lng=-73.20)
    assert nearest_fixture(far) is None


# --- Geo helpers -----------------------------------------------------------


def test_haversine_known_distance():
    # Boston Common to Worcester City Hall ~61 km.
    boston = Coordinates(lat=42.3550, lng=-71.0656)
    worcester = Coordinates(lat=42.2626, lng=-71.8023)
    dist_km = haversine_meters(boston, worcester) / 1000
    assert 55 < dist_km < 70
