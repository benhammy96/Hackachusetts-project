"""Historical temperature source.

Uses the Open-Meteo Archive API (keyless) to retrieve historical daily
temperatures for a coordinate and summarize them. Open-Meteo has global
coverage, so this source works for any Massachusetts point.

Metrics:

* ``mean_temp_c`` — mean of daily mean temperatures over the sample window.
* ``max_temp_c`` / ``min_temp_c`` — extremes over the window.
* ``sample_days`` — how many days were actually returned (transparency).

Defaults to the most recent full year available. On failure/timeout, all
metrics are returned missing with a reason.
"""

from __future__ import annotations

from datetime import date, timedelta

from app.data.http import FetchError, fetch_json
from app.data.models import DataSourceName, Metric, MetricGroup, MetricStatus
from app.data.sources.base import cached_fetch
from app.models.site import Coordinates

GROUP_NAME = "temperature"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

# Open-Meteo archive lags ~5 days behind real time; sample a recent full year
# ending a week ago to stay safely within available data.
_SAMPLE_DAYS = 365
_LAG_DAYS = 7


class TemperatureSource:
    """Open-Meteo historical temperature adapter."""

    name = GROUP_NAME

    async def fetch(self, coords: Coordinates) -> MetricGroup:
        return await cached_fetch(GROUP_NAME, coords, lambda: self._fetch(coords))

    async def _fetch(self, coords: Coordinates) -> MetricGroup:
        end = date.today() - timedelta(days=_LAG_DAYS)
        start = end - timedelta(days=_SAMPLE_DAYS)
        params = {
            "latitude": coords.lat,
            "longitude": coords.lng,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "daily": "temperature_2m_mean,temperature_2m_max,temperature_2m_min",
            "timezone": "America/New_York",
        }

        try:
            payload = await fetch_json(OPEN_METEO_ARCHIVE_URL, params=params)
        except FetchError as exc:
            return self._all_missing(exc)

        daily = (payload or {}).get("daily", {}) if isinstance(payload, dict) else {}
        means = [v for v in daily.get("temperature_2m_mean", []) if v is not None]
        maxes = [v for v in daily.get("temperature_2m_max", []) if v is not None]
        mins = [v for v in daily.get("temperature_2m_min", []) if v is not None]

        if not means:
            return self._all_missing(
                FetchError("decode", "no daily temperatures returned"),
                status=MetricStatus.MISSING_NO_COVERAGE,
                reason="Open-Meteo returned no daily temperature data for this location/window.",
            )

        return MetricGroup(
            name=GROUP_NAME,
            source=DataSourceName.OPEN_METEO,
            metrics=[
                Metric.ok(
                    key="mean_temp_c",
                    label="Mean daily temperature (trailing ~1yr)",
                    value=round(sum(means) / len(means), 2),
                    unit="°C",
                    source=DataSourceName.OPEN_METEO,
                ),
                Metric.ok(
                    key="max_temp_c",
                    label="Max daily temperature (trailing ~1yr)",
                    value=round(max(maxes), 2) if maxes else round(max(means), 2),
                    unit="°C",
                    source=DataSourceName.OPEN_METEO,
                ),
                Metric.ok(
                    key="min_temp_c",
                    label="Min daily temperature (trailing ~1yr)",
                    value=round(min(mins), 2) if mins else round(min(means), 2),
                    unit="°C",
                    source=DataSourceName.OPEN_METEO,
                ),
                Metric.ok(
                    key="sample_days",
                    label="Number of days sampled",
                    value=len(means),
                    unit="days",
                    source=DataSourceName.OPEN_METEO,
                ),
            ],
        )

    def _all_missing(
        self,
        exc: FetchError,
        status: MetricStatus | None = None,
        reason: str | None = None,
    ) -> MetricGroup:
        resolved = status or (
            MetricStatus.MISSING_TIMEOUT
            if exc.kind == "timeout"
            else MetricStatus.MISSING_API_ERROR
        )
        full_reason = reason or f"Open-Meteo request failed ({exc})."
        keys = [
            ("mean_temp_c", "Mean daily temperature (trailing ~1yr)", "°C"),
            ("max_temp_c", "Max daily temperature (trailing ~1yr)", "°C"),
            ("min_temp_c", "Min daily temperature (trailing ~1yr)", "°C"),
            ("sample_days", "Number of days sampled", "days"),
        ]
        return MetricGroup(
            name=GROUP_NAME,
            source=DataSourceName.OPEN_METEO,
            error=full_reason,
            metrics=[
                Metric.missing(
                    key=k, label=lbl, status=resolved, reason=full_reason, unit=unit,
                    source=DataSourceName.OPEN_METEO,
                )
                for k, lbl, unit in keys
            ],
        )
