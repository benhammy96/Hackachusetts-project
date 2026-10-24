"""Massachusetts geographic data integration layer.

Public surface for teammates (scoring/backend). Import from here:

    from app.data import get_location_metrics, LocationMetrics

``get_location_metrics(lat, lng)`` is the single entry point: it validates the
coordinate is in Massachusetts, queries all data sources concurrently (with
caching, timeouts, and graceful failure handling), and returns one standardized
:class:`LocationMetrics` object carrying raw values, units, sources, and
explicit missing-value reasons.

For a guaranteed-offline demo, :func:`get_location_metrics_with_fallback` snaps
near a demo city to a cached fixture when live calls are unavailable.

This package is self-contained (owned by data engineering). It depends only on
the shared :class:`app.models.site.Coordinates`. Surfacing these metrics through
the HTTP API or feeding them to scoring is a separate, coordinated change.
"""

from __future__ import annotations

from app.data.aggregator import get_location_metrics
from app.data.fixtures import (
    DEMO_LOCATIONS,
    all_fixtures,
    get_fixture,
    nearest_fixture,
)
from app.data.geo import is_in_massachusetts
from app.data.models import (
    DataSourceName,
    LocationMetrics,
    Metric,
    MetricGroup,
    MetricStatus,
)
from app.models.site import Coordinates

__all__ = [
    "get_location_metrics",
    "get_location_metrics_with_fallback",
    "is_in_massachusetts",
    "LocationMetrics",
    "Metric",
    "MetricGroup",
    "MetricStatus",
    "DataSourceName",
    "Coordinates",
    "DEMO_LOCATIONS",
    "get_fixture",
    "all_fixtures",
    "nearest_fixture",
]


async def get_location_metrics_with_fallback(
    lat: float, lng: float, prefer_live: bool = True
) -> LocationMetrics:
    """Return metrics for a coordinate, falling back to a demo fixture.

    Behavior:

    * If ``prefer_live`` is True, attempt the live aggregator first. If every
      source failed (e.g. no network) and the point is near a demo city, return
      that city's cached fixture instead so the demo still shows real data.
    * If ``prefer_live`` is False, return a nearby fixture when one exists,
      otherwise fall through to the live call.

    This keeps arbitrary-coordinate support intact while guaranteeing the three
    demo cities always produce a result.
    """
    coords = Coordinates(lat=lat, lng=lng)

    if not prefer_live:
        snapped = nearest_fixture(coords)
        if snapped is not None:
            return snapped

    live = await get_location_metrics(lat, lng)

    if prefer_live and live.in_massachusetts:
        all_failed = bool(live.groups) and all(g.error for g in live.groups)
        if all_failed:
            snapped = nearest_fixture(coords)
            if snapped is not None:
                snapped.warnings.append(
                    "Live data sources were unavailable; returning cached demo fixture."
                )
                return snapped

    return live
