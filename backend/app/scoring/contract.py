"""Input contract for the scoring engine.

The scoring engine does **not** depend on the data-integration layer's internal
shape. Instead it consumes a small, explicit, typed view — :class:`NormalizedMetrics`
— in which every field is optional (``None`` means "not available"). This keeps
scoring:

* independent of external APIs, FastAPI, the frontend, and Claude;
* able to run before every data source is live; and
* deterministic and easy to test with plain values.

An adapter, :func:`from_location_metrics`, maps the data layer's
``LocationMetrics`` onto this contract by reading documented metric keys. If the
data layer changes a key, only this adapter needs updating — the scoring rules
stay put. The adapter imports ``LocationMetrics`` lazily/typed-only so the core
engine has no hard runtime dependency on ``app.data``.
"""

from __future__ import annotations

from dataclasses import dataclass, fields
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # avoid a runtime dependency on the data layer
    from app.data.models import LocationMetrics


@dataclass(frozen=True)
class NormalizedMetrics:
    """A flat, typed view of the geographic metrics scoring consumes.

    Every field is optional. ``None`` is a first-class "missing" signal and is
    never treated as zero — the engine routes missing inputs into completeness
    accounting rather than inventing a value.

    Fields are grouped by the scoring category that primarily consumes them.
    """

    # --- Community ---
    population_density_per_km2: float | None = None
    nearest_residential_m: float | None = None
    residential_count: int | None = None

    # --- Energy / grid (no live data source yet; see docs) ---
    grid_capacity_mw: float | None = None
    renewable_share: float | None = None

    # --- Environmental ---
    in_special_flood_hazard_area: bool | None = None
    flood_risk_category: str | None = None  # "low" | "high" | "undetermined" | ...
    max_temp_c: float | None = None

    # --- Infrastructure ---
    residential_density_per_km2: float | None = None
    tract_population: int | None = None

    # --- Land / development ---
    land_use_code: str | None = None
    parcel_area_m2: float | None = None

    def available_fields(self) -> list[str]:
        """Names of fields that have a value."""
        return [f.name for f in fields(self) if getattr(self, f.name) is not None]

    def missing_fields(self) -> list[str]:
        """Names of fields that are None (unavailable)."""
        return [f.name for f in fields(self) if getattr(self, f.name) is None]


def _num(value: object) -> float | None:
    """Coerce a metric value to float, or None if not numeric."""
    if value is None:
        return None
    try:
        return float(value)  # handles int/float/str-number
    except (TypeError, ValueError):
        return None


def from_location_metrics(location: "LocationMetrics") -> NormalizedMetrics:
    """Adapt the data layer's ``LocationMetrics`` to the scoring contract.

    Reads documented metric keys from each group. Unknown/missing keys stay
    ``None`` so the engine's completeness logic handles them. This function is
    the single integration seam with ``app.data``.
    """
    flat = location.flat()  # {"group.key": value_or_None}

    def g(key: str) -> object:
        return flat.get(key)

    sfha_raw = _num(g("flood.in_special_flood_hazard_area"))
    in_sfha = None if sfha_raw is None else bool(int(sfha_raw))

    flood_cat = g("flood.flood_risk_category")
    flood_cat_str = str(flood_cat) if isinstance(flood_cat, str) else None

    land_code = g("landuse.land_use_code")
    land_code_str = str(land_code) if isinstance(land_code, str) else None

    pop = _num(g("population.tract_population"))
    res_count = _num(g("residential.residential_count"))

    return NormalizedMetrics(
        population_density_per_km2=_num(g("population.population_density_per_km2")),
        nearest_residential_m=_num(g("residential.nearest_residential_m")),
        residential_count=int(res_count) if res_count is not None else None,
        # No live energy/grid source yet — intentionally left None (never invented).
        grid_capacity_mw=_num(g("energy.grid_capacity_mw")),
        renewable_share=_num(g("energy.renewable_share")),
        in_special_flood_hazard_area=in_sfha,
        flood_risk_category=flood_cat_str,
        max_temp_c=_num(g("temperature.max_temp_c")),
        residential_density_per_km2=_num(g("residential.residential_density_per_km2")),
        tract_population=int(pop) if pop is not None else None,
        land_use_code=land_code_str,
        parcel_area_m2=_num(g("landuse.parcel_area_m2")),
    )
