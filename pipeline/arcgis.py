"""Thin, polite client for ArcGIS REST and Overpass.

Three access patterns are used by the pipeline:

1. `query_all`      - page a whole (small) layer down with geometry.
2. `ids_for_points` - one multipoint request returns the object ids of every
                      feature in the layer that contains at least one of the
                      points. Cheap, and it is the only variant the MassGIS
                      servers answer reliably for very large layers.
3. `by_ids`         - fetch geometry + attributes for a known id list.

(2) + (3) + a local shapely index gives exact per-point answers for layers that
are far too large to download (MassGIS 2016 Land Cover/Land Use is 22.8 million
polygons).
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request

UA = "atlas-site-screening/0.1 (Hackachusetts climate-tech project)"
DEG_PER_M = 1.0 / 111320.0


class HttpError(RuntimeError):
    pass


def _request(url: str, body: dict | None = None, timeout: int = 180) -> dict:
    data = urllib.parse.urlencode(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def post_json(url: str, body: dict, timeout: int = 180, retries: int = 4) -> dict:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            out = _request(url, body, timeout)
            if isinstance(out, dict) and "error" in out:
                raise HttpError(str(out["error"])[:300])
            return out
        except Exception as e:  # noqa: BLE001 - network layer, retry everything
            last = e
            time.sleep(min(2**attempt, 12))
    raise HttpError(f"{url}: {last}")


def get_json(url: str, timeout: int = 120, retries: int = 4) -> dict:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            return _request(url, None, timeout)
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(min(2**attempt, 12))
    raise HttpError(f"{url}: {last}")


def query_all(
    layer_url: str,
    out_fields: str = "*",
    where: str = "1=1",
    page: int = 1000,
    generalize_m: float | None = None,
    geometry: bool = True,
    timeout: int = 180,
) -> list[dict]:
    """Page an entire layer, returning Esri-JSON features."""
    ids = post_json(
        f"{layer_url}/query",
        {"f": "json", "where": where, "returnIdsOnly": "true"},
        timeout=timeout,
    )
    oids = ids.get("objectIds") or []
    features: list[dict] = []
    for i in range(0, len(oids), page):
        chunk = oids[i : i + page]
        body = {
            "f": "json",
            "objectIds": ",".join(str(o) for o in chunk),
            "outFields": out_fields,
            "returnGeometry": "true" if geometry else "false",
            "outSR": "4326",
            "geometryPrecision": "6",
        }
        if generalize_m:
            body["maxAllowableOffset"] = str(generalize_m * DEG_PER_M)
        d = post_json(f"{layer_url}/query", body, timeout=timeout)
        features.extend(d.get("features", []))
        time.sleep(0.05)
    return features


def ids_for_points(
    layer_url: str,
    points: list[tuple[float, float]],
    where: str = "1=1",
    timeout: int = 180,
) -> list[int]:
    """Object ids of features intersecting any of `points` (lng, lat)."""
    geom = json.dumps(
        {
            "points": [[round(p[0], 6), round(p[1], 6)] for p in points],
            "spatialReference": {"wkid": 4326},
        }
    )
    d = post_json(
        f"{layer_url}/query",
        {
            "f": "json",
            "geometry": geom,
            "geometryType": "esriGeometryMultipoint",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "where": where,
            "returnIdsOnly": "true",
        },
        timeout=timeout,
    )
    return list(d.get("objectIds") or [])


def by_ids(
    layer_url: str,
    oids: list[int],
    out_fields: str,
    generalize_m: float | None = 15,
    page: int = 500,
    timeout: int = 180,
) -> list[dict]:
    features: list[dict] = []
    for i in range(0, len(oids), page):
        chunk = oids[i : i + page]
        body = {
            "f": "json",
            "objectIds": ",".join(str(o) for o in chunk),
            "outFields": out_fields,
            "returnGeometry": "true",
            "outSR": "4326",
            "geometryPrecision": "6",
        }
        if generalize_m:
            body["maxAllowableOffset"] = str(generalize_m * DEG_PER_M)
        d = post_json(f"{layer_url}/query", body, timeout=timeout)
        features.extend(d.get("features", []))
        time.sleep(0.05)
    return features


def point_query(
    layer_url: str,
    lng: float,
    lat: float,
    out_fields: str,
    where: str = "1=1",
    timeout: int = 60,
) -> list[dict]:
    d = post_json(
        f"{layer_url}/query",
        {
            "f": "json",
            "geometry": f"{lng},{lat}",
            "geometryType": "esriGeometryPoint",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "where": where,
            "outFields": out_fields,
            "returnGeometry": "false",
        },
        timeout=timeout,
    )
    return [f.get("attributes", {}) for f in d.get("features", [])]


def overpass(query: str, url: str, timeout: int = 600, retries: int = 3) -> dict:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url, data=urllib.parse.urlencode({"data": query}).encode(),
                headers={"User-Agent": UA},
            )
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(10 * (attempt + 1))
    raise HttpError(f"overpass: {last}")
