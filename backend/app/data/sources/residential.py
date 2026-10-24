"""Residential proximity source (PRIORITY).

Uses the OpenStreetMap Overpass API to find nearby residential buildings around
a point and derive proximity metrics:

* ``residential_count`` — number of residential buildings within the radius.
* ``nearest_residential_m`` — distance to the closest one, in meters.
* ``residential_density_per_km2`` — count normalized by the search area.

OSM coverage in Massachusetts is good but not uniform. When Overpass returns no
residential features we report a count of 0 (a real, meaningful answer) but mark
the *distance* as missing with ``no coverage`` rather than inventing a number.
"""

from __future__ import annotations

import math

from app.config import get_settings
from app.data.geo import haversine_meters
from app.data.http import FetchError, fetch_json
from app.data.models import DataSourceName, Metric, MetricGroup, MetricStatus
from app.data.sources.base import cached_fetch
from app.models.site import Coordinates

GROUP_NAME = "residential"
DEFAULT_RADIUS_M = 1000  # 1 km search radius around the clicked point.


def _overpass_query(coords: Coordinates, radius_m: int) -> str:
    """Build an Overpass QL query for residential buildings near a point."""
    lat, lng = coords.lat, coords.lng
    around = f"around:{radius_m},{lat},{lng}"
    # Match both explicitly residential buildings and generic buildings inside
    # residential land use. nwr = nodes + ways + relations.
    return (
        "[out:json][timeout:25];"
        "("
        f'nwr["building"~"residential|house|apartments|detached|terrace"]({around});'
        f'nwr["landuse"="residential"]({around});'
        ");"
        "out center;"
    )


def _element_latlng(el: dict) -> Coordinates | None:
    """Extract a representative lat/lng from an Overpass element."""
    if "lat" in el and "lon" in el:
        return Coordinates(lat=el["lat"], lng=el["lon"])
    center = el.get("center")
    if center and "lat" in center and "lon" in center:
        return Coordinates(lat=center["lat"], lng=center["lon"])
    return None


class ResidentialSource:
    """OSM Overpass residential proximity adapter."""

    name = GROUP_NAME

    def __init__(self, radius_m: int = DEFAULT_RADIUS_M) -> None:
        self.radius_m = radius_m

    async def fetch(self, coords: Coordinates) -> MetricGroup:
        return await cached_fetch(f"{GROUP_NAME}_{self.radius_m}", coords, lambda: self._fetch(coords))

    async def _fetch(self, coords: Coordinates) -> MetricGroup:
        url = get_settings().osm_overpass_url
        query = _overpass_query(coords, self.radius_m)

        try:
            # Overpass can be slow; give it a generous timeout and let the
            # shared retry handle transient 5xx from the public instance.
            payload = await fetch_json(
                url, method="POST", data={"data": query}, timeout=40.0, retries=3
            )
        except FetchError as exc:
            return self._all_missing(exc)

        elements = payload.get("elements", []) if isinstance(payload, dict) else []

        distances: list[float] = []
        for el in elements:
            pos = _element_latlng(el)
            if pos is not None:
                distances.append(haversine_meters(coords, pos))

        count = len(distances)
        area_km2 = math.pi * (self.radius_m / 1000.0) ** 2

        count_metric = Metric.ok(
            key="residential_count",
            label=f"Residential features within {self.radius_m} m",
            value=count,
            unit="count",
            source=DataSourceName.OSM_OVERPASS,
        )
        density_metric = Metric.ok(
            key="residential_density_per_km2",
            label="Residential features per km²",
            value=round(count / area_km2, 2) if area_km2 else 0.0,
            unit="features/km^2",
            source=DataSourceName.OSM_OVERPASS,
        )

        if distances:
            nearest_metric = Metric.ok(
                key="nearest_residential_m",
                label="Distance to nearest residential feature",
                value=round(min(distances), 1),
                unit="m",
                source=DataSourceName.OSM_OVERPASS,
            )
        else:
            nearest_metric = Metric.missing(
                key="nearest_residential_m",
                label="Distance to nearest residential feature",
                status=MetricStatus.MISSING_NO_COVERAGE,
                reason=(
                    f"No residential features found in OSM within {self.radius_m} m. "
                    "This may reflect a genuinely undeveloped area or incomplete OSM coverage."
                ),
                unit="m",
                source=DataSourceName.OSM_OVERPASS,
            )

        return MetricGroup(
            name=GROUP_NAME,
            source=DataSourceName.OSM_OVERPASS,
            metrics=[count_metric, nearest_metric, density_metric],
        )

    def _all_missing(self, exc: FetchError) -> MetricGroup:
        """Build a fully-missing group when the Overpass call fails."""
        status = (
            MetricStatus.MISSING_TIMEOUT
            if exc.kind == "timeout"
            else MetricStatus.MISSING_API_ERROR
        )
        reason = f"OSM Overpass request failed ({exc})."
        keys = [
            ("residential_count", "Residential features within radius", "count"),
            ("nearest_residential_m", "Distance to nearest residential feature", "m"),
            ("residential_density_per_km2", "Residential features per km²", "features/km^2"),
        ]
        return MetricGroup(
            name=GROUP_NAME,
            source=DataSourceName.OSM_OVERPASS,
            error=reason,
            metrics=[
                Metric.missing(
                    key=k, label=lbl, status=status, reason=reason, unit=unit,
                    source=DataSourceName.OSM_OVERPASS,
                )
                for k, lbl, unit in keys
            ],
        )
