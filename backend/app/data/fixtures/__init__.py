"""Cached example results for three Massachusetts locations.

These fixtures guarantee a working hackathon demo even with no network access or
when an external API is down/rate-limited. Each file is a serialized
:class:`~app.data.models.LocationMetrics` captured from a real run of the live
aggregator — so the values are genuine, not invented, and match the exact output
schema a live call would produce.

Use :func:`get_fixture` for an exact (rounded) coordinate match, or
:func:`nearest_fixture` to snap an arbitrary click to the closest demo city.
These are a *fallback/demo* convenience; the live pipeline in ``aggregator.py``
remains the primary path for arbitrary coordinates statewide.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.data.geo import haversine_meters
from app.data.models import LocationMetrics
from app.models.site import Coordinates

_FIXTURE_DIR = Path(__file__).resolve().parent

# Demo anchor points. Loaders snap nearby clicks to these.
DEMO_LOCATIONS: dict[str, Coordinates] = {
    "boston": Coordinates(lat=42.3601, lng=-71.0589),
    "worcester": Coordinates(lat=42.2626, lng=-71.8023),
    "springfield": Coordinates(lat=42.1015, lng=-72.5898),
}

# Snap radius: clicks within this distance of a demo city reuse its fixture.
_SNAP_RADIUS_M = 5000.0


def _load_file(name: str) -> LocationMetrics | None:
    path = _FIXTURE_DIR / f"{name}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    model = LocationMetrics.model_validate(data)
    model.from_fixture = True
    return model


def get_fixture(name: str) -> LocationMetrics | None:
    """Return a demo fixture by city name (e.g. 'boston'), or None."""
    return _load_file(name.lower())


def all_fixtures() -> dict[str, LocationMetrics]:
    """Return every available demo fixture keyed by city name."""
    out: dict[str, LocationMetrics] = {}
    for name in DEMO_LOCATIONS:
        model = _load_file(name)
        if model is not None:
            out[name] = model
    return out


def nearest_fixture(coords: Coordinates, max_distance_m: float = _SNAP_RADIUS_M) -> LocationMetrics | None:
    """Return the demo fixture nearest to ``coords`` within ``max_distance_m``.

    Returns None if no demo city is close enough — in that case the caller
    should use the live aggregator.
    """
    best_name: str | None = None
    best_dist = float("inf")
    for name, anchor in DEMO_LOCATIONS.items():
        dist = haversine_meters(coords, anchor)
        if dist < best_dist:
            best_dist, best_name = dist, name

    if best_name is not None and best_dist <= max_distance_m:
        return _load_file(best_name)
    return None
