"""Aggregator: the single public entry point for the data layer.

``get_location_metrics(lat, lng)`` validates that the coordinate is in
Massachusetts, runs every data source concurrently, and assembles one
:class:`~app.data.models.LocationMetrics` object. Any individual source failure
is captured inside its group (as missing metrics) rather than failing the whole
request, so a consumer always gets a complete, well-formed object.

Source priority (per spec): residential proximity, population density, and
flood risk are primary; land use and temperature are secondary. All run, but
priority ordering is preserved in the output ``groups`` list.
"""

from __future__ import annotations

import asyncio

from app.data.geo import is_in_massachusetts
from app.data.models import DataSourceName, LocationMetrics, MetricGroup
from app.data.sources import (
    FloodSource,
    LandUseSource,
    PopulationSource,
    ResidentialSource,
    TemperatureSource,
)
from app.models.site import Coordinates

# Ordered by priority: primary sources first.
_PRIMARY_SOURCES = [ResidentialSource(), PopulationSource(), FloodSource()]
_SECONDARY_SOURCES = [LandUseSource(), TemperatureSource()]
_ALL_SOURCES = _PRIMARY_SOURCES + _SECONDARY_SOURCES


async def get_location_metrics(lat: float, lng: float) -> LocationMetrics:
    """Retrieve all geographic/environmental metrics for a MA coordinate.

    Validates Massachusetts membership first. For out-of-state coordinates the
    object is returned immediately with ``in_massachusetts=False`` and no source
    calls, since none of our datasets apply.
    """
    coords = Coordinates(lat=lat, lng=lng)
    validation = is_in_massachusetts(coords)

    if not validation.is_valid:
        return LocationMetrics(
            lat=lat,
            lng=lng,
            in_massachusetts=False,
            groups=[],
            warnings=[
                validation.reason or "Coordinate is outside Massachusetts.",
                "No data sources were queried because the point is out of coverage.",
            ],
        )

    groups = await _gather_groups(coords)
    warnings = [
        f"Source '{g.name}' failed: {g.error}" for g in groups if g.error is not None
    ]

    return LocationMetrics(
        lat=lat,
        lng=lng,
        in_massachusetts=True,
        from_fixture=False,
        groups=groups,
        warnings=warnings,
    )


async def _gather_groups(coords: Coordinates) -> list[MetricGroup]:
    """Run all sources concurrently, preserving priority order in the result."""
    results = await asyncio.gather(
        *(src.fetch(coords) for src in _ALL_SOURCES),
        return_exceptions=True,
    )

    groups: list[MetricGroup] = []
    for src, result in zip(_ALL_SOURCES, results):
        if isinstance(result, MetricGroup):
            groups.append(result)
        else:
            # A source raised unexpectedly (should be rare — sources are meant
            # to self-handle failures). Capture it as a group-level error so the
            # overall request still succeeds.
            groups.append(
                MetricGroup(
                    name=src.name,
                    source=_source_enum_for(src.name),
                    error=f"Unexpected error: {result!r}",
                    metrics=[],
                )
            )
    return groups


def _source_enum_for(name: str) -> DataSourceName:
    """Best-effort map a group name to its DataSourceName for error groups."""
    return {
        "residential": DataSourceName.OSM_OVERPASS,
        "population": DataSourceName.US_CENSUS,
        "flood": DataSourceName.FEMA_NFHL,
        "landuse": DataSourceName.MASSGIS,
        "temperature": DataSourceName.OPEN_METEO,
    }.get(name, DataSourceName.FIXTURE)
