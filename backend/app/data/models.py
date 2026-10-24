"""Standardized output models for the geographic data integration layer.

Every value the layer produces is wrapped in a :class:`Metric` so a consumer
always knows four things: the raw number, its unit, where it came from, and —
when the value is missing — *why*. We never invent a measurement; an
unavailable metric is ``value=None`` with a human-readable ``missing_reason``.

These models are intentionally self-contained within ``app.data`` and reuse the
shared :class:`app.models.site.Coordinates` for input. If the scoring/backend
teammates want these surfaced through the API, that is a contract change to be
coordinated — see ``app/data/README.md``.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class DataSourceName(str, Enum):
    """Identifiers for the external data providers we integrate."""

    OSM_OVERPASS = "osm_overpass"
    US_CENSUS = "us_census"
    FEMA_NFHL = "fema_nfhl"
    MASSGIS = "massgis"
    OPEN_METEO = "open_meteo"
    FIXTURE = "fixture"


class MetricStatus(str, Enum):
    """Why a metric does or does not have a value."""

    OK = "ok"
    MISSING_NO_COVERAGE = "missing_no_coverage"
    MISSING_API_ERROR = "missing_api_error"
    MISSING_TIMEOUT = "missing_timeout"
    MISSING_NOT_IMPLEMENTED = "missing_not_implemented"


class Metric(BaseModel):
    """A single measurement with provenance and explicit missing-value handling.

    ``value`` is ``None`` whenever the measurement could not be obtained. In
    that case ``status`` and ``missing_reason`` explain the gap. A present value
    always has ``status == MetricStatus.OK``.
    """

    key: str = Field(..., description="Stable machine name, e.g. 'population_density'")
    label: str = Field(..., description="Human-readable name")
    value: float | int | str | None = Field(
        default=None, description="Raw measurement, or None when unavailable"
    )
    unit: str | None = Field(default=None, description="Unit of measure, e.g. 'people/km^2'")
    source: DataSourceName | None = Field(
        default=None, description="Provider the value came from"
    )
    status: MetricStatus = Field(default=MetricStatus.OK)
    missing_reason: str | None = Field(
        default=None, description="Plain-language explanation when value is None"
    )

    @classmethod
    def ok(
        cls,
        key: str,
        label: str,
        value: float | int | str,
        unit: str | None,
        source: DataSourceName,
    ) -> "Metric":
        """Construct a present metric."""
        return cls(
            key=key, label=label, value=value, unit=unit, source=source, status=MetricStatus.OK
        )

    @classmethod
    def missing(
        cls,
        key: str,
        label: str,
        status: MetricStatus,
        reason: str,
        unit: str | None = None,
        source: DataSourceName | None = None,
    ) -> "Metric":
        """Construct an explicitly-missing metric (never an invented value)."""
        return cls(
            key=key,
            label=label,
            value=None,
            unit=unit,
            source=source,
            status=status,
            missing_reason=reason,
        )


class MetricGroup(BaseModel):
    """A named collection of metrics from one logical domain (one source)."""

    name: str = Field(..., description="Group name, e.g. 'residential', 'flood'")
    source: DataSourceName
    metrics: list[Metric] = Field(default_factory=list)
    error: str | None = Field(
        default=None, description="Group-level failure note, if the whole source failed"
    )

    def as_dict(self) -> dict[str, Metric]:
        """Return metrics keyed by their ``key`` for convenient lookup."""
        return {m.key: m for m in self.metrics}


class LocationMetrics(BaseModel):
    """The single standardized object returned for one Massachusetts location.

    Contains every metric group, keyed access helpers, and metadata about the
    retrieval (timestamp, whether results came from cache or demo fixtures).
    """

    lat: float
    lng: float
    in_massachusetts: bool
    retrieved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    from_fixture: bool = False
    groups: list[MetricGroup] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    def group(self, name: str) -> MetricGroup | None:
        """Return a metric group by name, or None."""
        for g in self.groups:
            if g.name == name:
                return g
        return None

    def flat(self) -> dict[str, Any]:
        """Flatten to ``{group.key: value}`` — handy for quick inspection/tests."""
        out: dict[str, Any] = {}
        for g in self.groups:
            for m in g.metrics:
                out[f"{g.name}.{m.key}"] = m.value
        return out
