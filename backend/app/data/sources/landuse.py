"""Land-use / parcel source (MassGIS).

Queries a MassGIS-hosted ArcGIS FeatureServer for the parcel or land-use polygon
at a coordinate and reports land-use characteristics:

* ``land_use_code`` / ``land_use_description`` — the parcel's use classification.
* ``parcel_area_m2`` — the parcel's area, when available.

Endpoint note
-------------
MassGIS publishes standardized "Level 3" assessor parcels and the 2016 Land
Cover/Land Use layer as ArcGIS services. The precise layer URL and attribute
field names vary by published service version, so both are configurable via
settings (``massgis_landuse_url`` and the field map below) rather than hardcoded.
If the configured layer returns nothing or an unexpected shape, every metric is
returned as missing with an explanation — we never fabricate a classification.

This is a secondary source (residential proximity, population density, and flood
risk are the priorities), so it ships with conservative defaults and graceful
degradation, ready for the exact layer to be confirmed and plugged in.
"""

from __future__ import annotations

from app.config import get_settings
from app.data.http import FetchError, fetch_json
from app.data.models import DataSourceName, Metric, MetricGroup, MetricStatus
from app.data.sources.base import cached_fetch
from app.models.site import Coordinates

GROUP_NAME = "landuse"

# Candidate attribute names to look for in a parcel/land-use feature. ArcGIS
# layers differ, so we probe a few common field names before giving up.
_USE_CODE_FIELDS = ("USE_CODE", "LUC", "LU_CODE", "LANDUSE", "use_code")
_USE_DESC_FIELDS = ("USE_DESC", "LU_DESC", "DESCRIPTION", "LANDUSE_DESC", "use_desc")
_AREA_FIELDS = ("SHAPE_Area", "Shape__Area", "AREA", "LOT_SIZE")


def _first_present(attrs: dict, candidates: tuple[str, ...]) -> object | None:
    for name in candidates:
        if name in attrs and attrs[name] not in (None, "", " "):
            return attrs[name]
    return None


class LandUseSource:
    """MassGIS land-use / parcel adapter."""

    name = GROUP_NAME

    async def fetch(self, coords: Coordinates) -> MetricGroup:
        return await cached_fetch(GROUP_NAME, coords, lambda: self._fetch(coords))

    async def _fetch(self, coords: Coordinates) -> MetricGroup:
        base = get_settings().massgis_landuse_url
        if not base:
            return self._all_missing_not_configured()

        url = f"{base}/query"
        params = {
            "geometry": f"{coords.lng},{coords.lat}",
            "geometryType": "esriGeometryPoint",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "*",
            "returnGeometry": "false",
            "f": "json",
        }

        try:
            payload = await fetch_json(url, params=params)
        except FetchError as exc:
            return self._all_missing(exc)

        features = (payload or {}).get("features", []) if isinstance(payload, dict) else []
        if not features:
            return MetricGroup(
                name=GROUP_NAME,
                source=DataSourceName.MASSGIS,
                metrics=[
                    Metric.missing(
                        key="land_use_code",
                        label="Land use code",
                        status=MetricStatus.MISSING_NO_COVERAGE,
                        reason="No MassGIS parcel/land-use polygon intersects this point.",
                        source=DataSourceName.MASSGIS,
                    ),
                    Metric.missing(
                        key="land_use_description",
                        label="Land use description",
                        status=MetricStatus.MISSING_NO_COVERAGE,
                        reason="No MassGIS parcel/land-use polygon intersects this point.",
                        source=DataSourceName.MASSGIS,
                    ),
                    Metric.missing(
                        key="parcel_area_m2",
                        label="Parcel area",
                        status=MetricStatus.MISSING_NO_COVERAGE,
                        reason="No MassGIS parcel/land-use polygon intersects this point.",
                        unit="m^2",
                        source=DataSourceName.MASSGIS,
                    ),
                ],
            )

        attrs = features[0].get("attributes", {})
        code = _first_present(attrs, _USE_CODE_FIELDS)
        desc = _first_present(attrs, _USE_DESC_FIELDS)
        area = _first_present(attrs, _AREA_FIELDS)

        metrics: list[Metric] = []
        metrics.append(
            Metric.ok("land_use_code", "Land use code", str(code), None, DataSourceName.MASSGIS)
            if code is not None
            else Metric.missing(
                "land_use_code", "Land use code", MetricStatus.MISSING_NO_COVERAGE,
                "Parcel found but no recognized land-use code field was present.",
                source=DataSourceName.MASSGIS,
            )
        )
        metrics.append(
            Metric.ok(
                "land_use_description", "Land use description", str(desc), None,
                DataSourceName.MASSGIS,
            )
            if desc is not None
            else Metric.missing(
                "land_use_description", "Land use description",
                MetricStatus.MISSING_NO_COVERAGE,
                "Parcel found but no recognized description field was present.",
                source=DataSourceName.MASSGIS,
            )
        )
        if area is not None:
            try:
                metrics.append(
                    Metric.ok(
                        "parcel_area_m2", "Parcel area", round(float(area), 1), "m^2",
                        DataSourceName.MASSGIS,
                    )
                )
            except (TypeError, ValueError):
                metrics.append(self._area_missing("Area field was non-numeric."))
        else:
            metrics.append(self._area_missing("Parcel found but no area field was present."))

        return MetricGroup(name=GROUP_NAME, source=DataSourceName.MASSGIS, metrics=metrics)

    def _area_missing(self, reason: str) -> Metric:
        return Metric.missing(
            "parcel_area_m2", "Parcel area", MetricStatus.MISSING_NO_COVERAGE, reason,
            unit="m^2", source=DataSourceName.MASSGIS,
        )

    def _all_missing_not_configured(self) -> MetricGroup:
        reason = (
            "MassGIS land-use layer URL is not configured (set MASSGIS_LANDUSE_URL). "
            "Land-use is a secondary source; priority metrics are unaffected."
        )
        return self._build_missing(MetricStatus.MISSING_NOT_IMPLEMENTED, reason, group_error=reason)

    def _all_missing(self, exc: FetchError) -> MetricGroup:
        status = (
            MetricStatus.MISSING_TIMEOUT
            if exc.kind == "timeout"
            else MetricStatus.MISSING_API_ERROR
        )
        reason = f"MassGIS land-use request failed ({exc})."
        return self._build_missing(status, reason, group_error=reason)

    def _build_missing(
        self, status: MetricStatus, reason: str, group_error: str | None
    ) -> MetricGroup:
        keys = [
            ("land_use_code", "Land use code", None),
            ("land_use_description", "Land use description", None),
            ("parcel_area_m2", "Parcel area", "m^2"),
        ]
        return MetricGroup(
            name=GROUP_NAME,
            source=DataSourceName.MASSGIS,
            error=group_error,
            metrics=[
                Metric.missing(
                    key=k, label=lbl, status=status, reason=reason, unit=unit,
                    source=DataSourceName.MASSGIS,
                )
                for k, lbl, unit in keys
            ],
        )
