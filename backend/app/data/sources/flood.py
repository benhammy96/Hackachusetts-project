"""Flood-hazard source (PRIORITY).

Queries FEMA's public National Flood Hazard Layer (NFHL) ArcGIS REST service for
the flood zone at a coordinate. Layer 28 ("Flood Hazard Zones") carries the
``FLD_ZONE`` designation (e.g. ``AE``, ``X``, ``VE``) and the Special Flood
Hazard Area flag (``SFHA_TF``).

We translate the FEMA zone code into:

* ``flood_zone`` — the raw FEMA designation (string).
* ``in_special_flood_hazard_area`` — boolean-ish (1/0) for the 1%-annual-chance
  floodplain.
* ``flood_risk_category`` — a coarse low/moderate/high label derived from the
  zone code, for convenience. (The scoring team decides how to weight it.)

MassGIS hosts equivalent FEMA NFHL data for Massachusetts; the public FEMA
service is used here because it is nationally consistent and keyless. If FEMA
has not mapped the area (common for some inland parcels), we return the zone as
missing with ``no coverage`` rather than assuming "no risk".
"""

from __future__ import annotations

from app.config import get_settings
from app.data.http import FetchError, fetch_json
from app.data.models import DataSourceName, Metric, MetricGroup, MetricStatus
from app.data.sources.base import cached_fetch
from app.models.site import Coordinates

GROUP_NAME = "flood"

# High-risk zones (Special Flood Hazard Areas): A-prefixed and V-prefixed.
_HIGH_RISK_PREFIXES = ("A", "V")
# Moderate/undetermined.
_MODERATE_ZONES = {"X", "B", "C"}  # shaded X is moderate; D is undetermined.


def _risk_category(zone: str) -> str:
    """Map a FEMA zone code to a coarse low/moderate/high label."""
    z = zone.upper().strip()
    if z.startswith(_HIGH_RISK_PREFIXES):
        return "high"
    if z == "D":
        return "undetermined"
    if z in _MODERATE_ZONES:
        return "low"
    return "unknown"


class FloodSource:
    """FEMA NFHL flood-zone adapter."""

    name = GROUP_NAME

    async def fetch(self, coords: Coordinates) -> MetricGroup:
        return await cached_fetch(GROUP_NAME, coords, lambda: self._fetch(coords))

    async def _fetch(self, coords: Coordinates) -> MetricGroup:
        base = get_settings().fema_nfhl_url
        url = f"{base}/28/query"
        params = {
            "geometry": f"{coords.lng},{coords.lat}",
            "geometryType": "esriGeometryPoint",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "FLD_ZONE,SFHA_TF,ZONE_SUBTY",
            "returnGeometry": "false",
            "f": "json",
        }

        try:
            payload = await fetch_json(url, params=params)
        except FetchError as exc:
            return self._all_missing(exc)

        features = (payload or {}).get("features", []) if isinstance(payload, dict) else []
        if not features:
            # No mapped flood polygon here. That is NOT the same as "no risk" —
            # FEMA simply may not have mapped this location.
            return MetricGroup(
                name=GROUP_NAME,
                source=DataSourceName.FEMA_NFHL,
                metrics=[
                    Metric.missing(
                        key="flood_zone",
                        label="FEMA flood zone",
                        status=MetricStatus.MISSING_NO_COVERAGE,
                        reason=(
                            "No FEMA NFHL flood polygon intersects this point. The area "
                            "may be unmapped; absence of a polygon does not imply zero risk."
                        ),
                        source=DataSourceName.FEMA_NFHL,
                    ),
                    Metric.missing(
                        key="in_special_flood_hazard_area",
                        label="Within Special Flood Hazard Area",
                        status=MetricStatus.MISSING_NO_COVERAGE,
                        reason="No FEMA NFHL coverage at this point.",
                        source=DataSourceName.FEMA_NFHL,
                    ),
                    Metric.missing(
                        key="flood_risk_category",
                        label="Coarse flood-risk category",
                        status=MetricStatus.MISSING_NO_COVERAGE,
                        reason="No FEMA NFHL coverage at this point.",
                        source=DataSourceName.FEMA_NFHL,
                    ),
                ],
            )

        attrs = features[0].get("attributes", {})
        zone = str(attrs.get("FLD_ZONE", "")).strip()
        sfha_tf = str(attrs.get("SFHA_TF", "")).strip().upper()
        in_sfha = 1 if sfha_tf == "T" else 0

        return MetricGroup(
            name=GROUP_NAME,
            source=DataSourceName.FEMA_NFHL,
            metrics=[
                Metric.ok(
                    key="flood_zone",
                    label="FEMA flood zone",
                    value=zone or "UNKNOWN",
                    unit=None,
                    source=DataSourceName.FEMA_NFHL,
                ),
                Metric.ok(
                    key="in_special_flood_hazard_area",
                    label="Within Special Flood Hazard Area",
                    value=in_sfha,
                    unit="boolean(1/0)",
                    source=DataSourceName.FEMA_NFHL,
                ),
                Metric.ok(
                    key="flood_risk_category",
                    label="Coarse flood-risk category",
                    value=_risk_category(zone),
                    unit=None,
                    source=DataSourceName.FEMA_NFHL,
                ),
            ],
        )

    def _all_missing(self, exc: FetchError) -> MetricGroup:
        status = (
            MetricStatus.MISSING_TIMEOUT
            if exc.kind == "timeout"
            else MetricStatus.MISSING_API_ERROR
        )
        reason = f"FEMA NFHL request failed ({exc})."
        keys = [
            ("flood_zone", "FEMA flood zone", None),
            ("in_special_flood_hazard_area", "Within Special Flood Hazard Area", "boolean(1/0)"),
            ("flood_risk_category", "Coarse flood-risk category", None),
        ]
        return MetricGroup(
            name=GROUP_NAME,
            source=DataSourceName.FEMA_NFHL,
            error=reason,
            metrics=[
                Metric.missing(
                    key=k, label=lbl, status=status, reason=reason, unit=unit,
                    source=DataSourceName.FEMA_NFHL,
                )
                for k, lbl, unit in keys
            ],
        )
