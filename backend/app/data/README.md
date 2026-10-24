# `app.data` — Massachusetts Geographic Data Layer

Owned by the **data engineering** workstream. Self-contained: it depends only on
the shared `app.models.site.Coordinates` and does not implement scoring,
weights, API routes, or UI.

## What it does

Given a latitude/longitude anywhere in Massachusetts, it returns one
standardized object (`LocationMetrics`) with geographic and environmental
metrics from several external sources. Every value carries its **unit**,
**source**, and — when unavailable — an explicit **missing reason**. We never
invent a measurement.

## Public API

```python
from app.data import get_location_metrics, get_location_metrics_with_fallback

metrics = await get_location_metrics(42.3601, -71.0589)   # Boston
print(metrics.in_massachusetts)       # True
print(metrics.flat())                 # {"residential.residential_count": 163, ...}

for group in metrics.groups:
    for m in group.metrics:
        print(m.key, m.value, m.unit, m.source, m.missing_reason)
```

- `get_location_metrics(lat, lng)` — validate MA, query all sources concurrently,
  return `LocationMetrics`.
- `get_location_metrics_with_fallback(lat, lng)` — same, but falls back to a
  cached demo fixture near the three demo cities if live sources are down.
- `is_in_massachusetts(coords)` — bounding-box validation.

## Sources

| Group         | Provider                | Priority  | Key needed?                    |
| ------------- | ----------------------- | --------- | ------------------------------ |
| `residential` | OSM Overpass            | ★ primary | no                             |
| `population`  | US Census (TIGERweb+ACS)| ★ primary | **ACS requires `CENSUS_API_KEY`** |
| `flood`       | FEMA NFHL (ArcGIS)      | ★ primary | no                             |
| `landuse`     | MassGIS parcels         | secondary | no (needs `MASSGIS_LANDUSE_URL`) |
| `temperature` | Open-Meteo archive      | secondary | no                             |

## Design

- **Standardized output** (`models.py`): `Metric` (value/unit/source/status/
  reason) → `MetricGroup` → `LocationMetrics`.
- **Resilience** (`http.py`): shared async client with timeout, retry+backoff on
  timeouts/5xx, redirect following, and a descriptive User-Agent (OSM rejects
  requests without one). Failures become typed `FetchError`s that each source
  converts into missing metrics — a source never crashes the aggregator.
- **Caching** (`cache.py`): TTL cache, in-memory + on-disk JSON, keyed by
  source + coordinate rounded to ~110 m so nearby clicks reuse results.
- **Validation** (`geo.py`): fast MA bounding-box check + haversine helpers.
- **Fixtures** (`fixtures/`): real captured results for Boston, Worcester, and
  Springfield guarantee a working demo offline. Regenerate with
  `python -m app.data.fixtures.generate`.

## Configuration

Set in `backend/.env` (see `.env.example`):

- `CENSUS_API_KEY` — free, required by the Census ACS API. Without it,
  population density returns missing with an actionable reason; tract geography
  (from TIGERweb) still resolves.
- `OSM_OVERPASS_URL`, `FEMA_NFHL_URL` — defaulted to public endpoints.
- `MASSGIS_LANDUSE_URL` — optional; land-use degrades gracefully when unset.

## Known limitations (honest notes for teammates)

1. **MA validation is a bounding box, not the true polygon.** Points just over
   the border (e.g. Hartford, CT) can pass. Fine for the demo; swap in a polygon
   check if precision matters. Pinned by a test.
2. **Census needs a key.** The ACS API now redirects keyless requests to a
   "Missing Key" page. Population density is live only once `CENSUS_API_KEY` is
   set. The demo fixtures were generated without a key, so their `population`
   group is missing-with-reason until regenerated with a key.
3. **MassGIS land-use endpoint is not pinned.** The exact ArcGIS layer URL/field
   names vary by published version; the adapter is configurable and degrades
   cleanly. Confirm the layer and set `MASSGIS_LANDUSE_URL` to enable it.
4. **Public Overpass/FEMA instances are rate-limited and occasionally flaky.**
   Retries + caching smooth this out; for heavy use, point at a dedicated
   Overpass mirror.

## Integration seam (coordinate before changing)

The scaffold's `app/services/data_sources.py` still holds the original stub
adapters that return flat `dict[str, float]`. This richer layer lives separately
in `app.data` by design. Wiring `app.data` into scoring or the HTTP API is a
**shared contract change** — coordinate with the scoring and backend owners
before exposing `LocationMetrics` through a route or feeding it to the scorer.

## Tests

```bash
pip install -r requirements-dev.txt
python -m pytest tests/test_data_layer.py -q
```

Tests are offline (sources are mocked), covering validation, failure isolation,
caching, missing-value handling, and the demo fixtures.
