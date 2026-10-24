"""Population density source (PRIORITY).

Computes census-tract population density for any Massachusetts coordinate using
two public, keyless-capable services:

1. **Census TIGERweb GeoServices REST API** — a point (lat/lng) query against
   the Tracts layer returns the containing tract's ``GEOID`` (state+county+tract
   FIPS) *and* its ``AREALAND`` in square meters. This gives us a real land area
   so density is computed, never estimated.
2. **Census ACS 5-year API** — tract total population (variable
   ``B01003_001E``). An optional ``CENSUS_API_KEY`` raises the daily rate limit
   but is not required under the free threshold.

Density (people/km²) = tract population ÷ (AREALAND / 1e6).

If either call fails or a tract can't be resolved (e.g. the point is over water
or outside US coverage), the affected metrics are returned as missing with an
explanation — we do not fabricate a value.
"""

from __future__ import annotations

from app.config import get_settings
from app.data.http import FetchError, fetch_json
from app.data.models import DataSourceName, Metric, MetricGroup, MetricStatus
from app.data.sources.base import cached_fetch
from app.models.site import Coordinates

GROUP_NAME = "population"

# TIGERweb "Tracts and Blocks" map service; layer 0 is Census Tracts (current
# vintage). A point geometry query returns attributes incl. GEOID + AREALAND.
TIGERWEB_TRACTS_URL = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
    "Tracts_Blocks/MapServer/0/query"
)

CENSUS_ACS5_YEAR = 2022  # Most recent stable ACS 5-year vintage at build time.
CENSUS_ACS5_URL = f"https://api.census.gov/data/{CENSUS_ACS5_YEAR}/acs/acs5"
POP_VARIABLE = "B01003_001E"  # Total population.


class PopulationSource:
    """US Census tract population density adapter."""

    name = GROUP_NAME

    async def fetch(self, coords: Coordinates) -> MetricGroup:
        return await cached_fetch(GROUP_NAME, coords, lambda: self._fetch(coords))

    async def _fetch(self, coords: Coordinates) -> MetricGroup:
        # Step 1: resolve the tract (GEOID + land area) for this point.
        try:
            tract = await self._resolve_tract(coords)
        except FetchError as exc:
            return self._all_missing(exc, "TIGERweb tract lookup failed")

        if tract is None:
            return self._all_missing(
                FetchError("http_error", "no tract"),
                "No Census tract contains this coordinate (likely over water or outside US)",
                status=MetricStatus.MISSING_NO_COVERAGE,
            )

        geoid, state, county, tract_code, land_area_m2 = tract

        # Step 2: tract population from ACS5.
        settings = get_settings()
        params = {
            "get": f"NAME,{POP_VARIABLE}",
            "for": f"tract:{tract_code}",
            "in": f"state:{state} county:{county}",
        }
        if settings.census_api_key:
            params["key"] = settings.census_api_key

        try:
            rows = await fetch_json(CENSUS_ACS5_URL, params=params)
        except FetchError as exc:
            # The Census API redirects keyless requests to an HTML "Missing Key"
            # page, which surfaces here as a JSON decode error. Translate that
            # into an actionable message instead of a cryptic parse failure.
            if exc.kind == "decode" and not settings.census_api_key:
                return self._all_missing(
                    FetchError("http_error", "Census API key required"),
                    "Census ACS5 now requires an API key — set CENSUS_API_KEY "
                    "(free at https://api.census.gov/data/key_signup.html)",
                    status=MetricStatus.MISSING_API_ERROR,
                    geoid=geoid,
                )
            return self._all_missing(exc, "Census ACS5 request failed", geoid=geoid)

        population = _parse_population(rows)
        if population is None:
            return self._all_missing(
                FetchError("decode", "null population"),
                "Census reported no population for this tract",
                status=MetricStatus.MISSING_NO_COVERAGE,
                geoid=geoid,
            )

        metrics = [
            Metric.ok(
                key="tract_population",
                label="Census tract total population (ACS 5-yr)",
                value=population,
                unit="people",
                source=DataSourceName.US_CENSUS,
            ),
            Metric.ok(
                key="tract_fips",
                label="Census tract FIPS / GEOID",
                value=geoid,
                unit=None,
                source=DataSourceName.US_CENSUS,
            ),
        ]

        if land_area_m2 and land_area_m2 > 0:
            density = population / (land_area_m2 / 1_000_000.0)
            metrics.insert(
                0,
                Metric.ok(
                    key="population_density_per_km2",
                    label="Population density",
                    value=round(density, 1),
                    unit="people/km^2",
                    source=DataSourceName.US_CENSUS,
                ),
            )
        else:
            metrics.insert(
                0,
                Metric.missing(
                    key="population_density_per_km2",
                    label="Population density",
                    status=MetricStatus.MISSING_NO_COVERAGE,
                    reason="TIGERweb returned no land area for the tract; density not computed.",
                    unit="people/km^2",
                    source=DataSourceName.US_CENSUS,
                ),
            )

        return MetricGroup(name=GROUP_NAME, source=DataSourceName.US_CENSUS, metrics=metrics)

    async def _resolve_tract(
        self, coords: Coordinates
    ) -> tuple[str, str, str, str, float | None] | None:
        """Query TIGERweb for the tract containing the point.

        Returns ``(geoid, state, county, tract, area_land_m2)`` or ``None`` when
        no tract matches.
        """
        params = {
            "geometry": f"{coords.lng},{coords.lat}",
            "geometryType": "esriGeometryPoint",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "GEOID,STATE,COUNTY,TRACT,AREALAND",
            "returnGeometry": "false",
            "f": "json",
        }
        payload = await fetch_json(TIGERWEB_TRACTS_URL, params=params)
        features = (payload or {}).get("features", []) if isinstance(payload, dict) else []
        if not features:
            return None

        attrs = features[0].get("attributes", {})
        geoid = str(attrs.get("GEOID", ""))
        state = str(attrs.get("STATE", ""))
        county = str(attrs.get("COUNTY", ""))
        tract = str(attrs.get("TRACT", ""))
        area = attrs.get("AREALAND")
        try:
            area_land = float(area) if area is not None else None
        except (TypeError, ValueError):
            area_land = None

        if not (len(state) == 2 and len(county) == 3 and len(tract) == 6):
            # Fall back to slicing GEOID if discrete fields are absent.
            if len(geoid) >= 11:
                state, county, tract = geoid[0:2], geoid[2:5], geoid[5:11]
            else:
                return None

        return geoid or f"{state}{county}{tract}", state, county, tract, area_land

    def _all_missing(
        self,
        exc: FetchError,
        reason: str,
        status: MetricStatus | None = None,
        geoid: str | None = None,
    ) -> MetricGroup:
        resolved_status = status or (
            MetricStatus.MISSING_TIMEOUT
            if exc.kind == "timeout"
            else MetricStatus.MISSING_API_ERROR
        )
        full_reason = f"{reason} ({exc})."
        keys = [
            ("population_density_per_km2", "Population density", "people/km^2"),
            ("tract_population", "Census tract total population (ACS 5-yr)", "people"),
            ("tract_fips", "Census tract FIPS / GEOID", None),
        ]
        return MetricGroup(
            name=GROUP_NAME,
            source=DataSourceName.US_CENSUS,
            error=full_reason,
            metrics=[
                Metric.missing(
                    key=k, label=lbl, status=resolved_status, reason=full_reason,
                    unit=unit, source=DataSourceName.US_CENSUS,
                )
                for k, lbl, unit in keys
            ],
        )


def _parse_population(rows: object) -> int | None:
    """Extract total population from an ACS5 ``[[header],[values]]`` response."""
    if not isinstance(rows, list) or len(rows) < 2:
        return None
    header, values = rows[0], rows[1]
    record = dict(zip(header, values))
    raw = record.get(POP_VARIABLE)
    try:
        return int(raw) if raw is not None else None
    except (TypeError, ValueError):
        return None
