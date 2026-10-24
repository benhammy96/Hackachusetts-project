"""Base contract shared by all data sources.

Every source implements :meth:`DataSource.fetch`, which takes validated
coordinates and returns a :class:`~app.data.models.MetricGroup`. A source must
never raise for an expected failure (timeout, no coverage, API error); instead
it returns a group whose metrics are explicitly missing with a reason. This
keeps the aggregator simple and guarantees we never invent data.
"""

from __future__ import annotations

from typing import Protocol

from app.data.cache import TTLCache, coord_key, default_cache
from app.data.models import MetricGroup
from app.models.site import Coordinates


class DataSource(Protocol):
    """Protocol every data source conforms to."""

    name: str

    async def fetch(self, coords: Coordinates) -> MetricGroup:
        """Return a MetricGroup for the given coordinates."""
        ...


async def cached_fetch(
    namespace: str,
    coords: Coordinates,
    fetcher,
    cache: TTLCache = default_cache,
) -> MetricGroup:
    """Wrap a source fetch with coordinate-keyed caching.

    ``fetcher`` is an async callable taking no args and returning a
    :class:`MetricGroup`. Cached groups are stored as plain dicts and rehydrated
    so they survive the on-disk JSON round-trip.
    """
    key = coord_key(namespace, coords.lat, coords.lng)
    cached = cache.get(key)
    if cached is not None:
        return MetricGroup.model_validate(cached)

    group = await fetcher()

    # Only cache successful groups; transient failures should be retried later.
    if group.error is None:
        cache.set(key, group.model_dump(mode="json"))
    return group
