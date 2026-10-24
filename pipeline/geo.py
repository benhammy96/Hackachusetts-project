"""Geometry helpers for the Atlas pipeline.

Distances are computed in EPSG:26986 (NAD83 / Massachusetts Mainland, Lambert
Conformal Conic, metres) as specified in ATLAS.md section 5.4. The projection is
implemented here with Snyder's two-standard-parallel formulas so the pipeline
only needs shapely, not a full PROJ install.
"""

from __future__ import annotations

import math
from typing import Iterable, Sequence

from shapely.geometry import LineString, MultiPolygon, Polygon, shape
from shapely.ops import unary_union

# --- EPSG:26986 parameters (NAD83 / Massachusetts Mainland) ------------------
_A = 6378137.0  # GRS80 semi-major axis, metres
_F = 1 / 298.257222101
_E2 = 2 * _F - _F * _F
_E = math.sqrt(_E2)

_LAT1 = math.radians(42.68333333333333)
_LAT2 = math.radians(41.71666666666667)
_LAT0 = math.radians(41.0)
_LON0 = math.radians(-71.5)
_X0 = 200000.0
_Y0 = 750000.0


def _m(phi: float) -> float:
    return math.cos(phi) / math.sqrt(1 - _E2 * math.sin(phi) ** 2)


def _t(phi: float) -> float:
    s = math.sin(phi)
    return math.tan(math.pi / 4 - phi / 2) / ((1 - _E * s) / (1 + _E * s)) ** (_E / 2)


_M1, _M2 = _m(_LAT1), _m(_LAT2)
_T0, _T1, _T2 = _t(_LAT0), _t(_LAT1), _t(_LAT2)
_N = math.log(_M1 / _M2) / math.log(_T1 / _T2)
_BIGF = _M1 / (_N * _T1**_N)
_RHO0 = _A * _BIGF * _T0**_N


def project(lng: float, lat: float) -> tuple[float, float]:
    """lng/lat (degrees, NAD83 ~ WGS84) -> EPSG:26986 metres."""
    phi = math.radians(lat)
    rho = _A * _BIGF * _t(phi) ** _N
    theta = _N * (math.radians(lng) - _LON0)
    return (_X0 + rho * math.sin(theta), _Y0 + _RHO0 - rho * math.cos(theta))


def unproject(x: float, y: float) -> tuple[float, float]:
    """EPSG:26986 metres -> lng/lat degrees."""
    dx, dy = x - _X0, _RHO0 - (y - _Y0)
    rho = math.copysign(math.hypot(dx, dy), _N)
    theta = math.atan2(dx, dy)
    t = (rho / (_A * _BIGF)) ** (1 / _N)
    chi = math.pi / 2 - 2 * math.atan(t)
    phi = chi
    for _ in range(8):
        s = math.sin(phi)
        phi_new = chi + (
            (_E2 / 2 + 5 * _E2**2 / 24 + _E2**3 / 12) * math.sin(2 * phi)
            + (7 * _E2**2 / 48 + 29 * _E2**3 / 240) * math.sin(4 * phi)
            + (7 * _E2**3 / 120) * math.sin(6 * phi)
        )
        if abs(phi_new - phi) < 1e-12:
            phi = phi_new
            break
        phi = phi_new
    lon = theta / _N + _LON0
    return (math.degrees(lon), math.degrees(phi))


def project_coords(coords: Iterable[Sequence[float]]) -> list[tuple[float, float]]:
    return [project(c[0], c[1]) for c in coords]


# --- Esri JSON -> shapely ----------------------------------------------------
def _signed_area(ring: Sequence[Sequence[float]]) -> float:
    a = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[i + 1][0], ring[i + 1][1]
        a += x1 * y2 - x2 * y1
    return a / 2.0


def esri_polygon_to_shapely(geom: dict, do_project: bool = True):
    """Convert an Esri polygon (rings) to a shapely (Multi)Polygon.

    Esri encodes outer rings clockwise and holes counter-clockwise. Holes are
    attached to the smallest outer ring that contains them.
    """
    rings = geom.get("rings") or []
    outers: list[list] = []
    holes: list[list] = []
    for r in rings:
        if len(r) < 4:
            continue
        pts = project_coords(r) if do_project else [(c[0], c[1]) for c in r]
        if pts[0] != pts[-1]:
            pts.append(pts[0])
        if len(pts) < 4:
            continue
        (holes if _signed_area(pts) > 0 else outers).append(pts)

    if not outers:
        outers, holes = holes, []
    if not outers:
        return None

    shells = []
    for o in outers:
        try:
            shells.append(Polygon(o))
        except Exception:
            continue
    if not shells:
        return None
    shells.sort(key=lambda p: p.area)

    assigned: dict[int, list] = {i: [] for i in range(len(shells))}
    for h in holes:
        try:
            hp = Polygon(h)
        except Exception:
            continue
        for i, s in enumerate(shells):
            if s.area > hp.area and s.contains(hp.representative_point()):
                assigned[i].append(h)
                break

    polys = []
    for i, s in enumerate(shells):
        try:
            polys.append(Polygon(s.exterior.coords, assigned[i]))
        except Exception:
            polys.append(s)
    out = polys[0] if len(polys) == 1 else MultiPolygon([p for p in polys if p.is_valid or True])
    if not out.is_valid:
        out = out.buffer(0)
    return out


def esri_polyline_to_shapely(geom: dict, do_project: bool = True):
    paths = geom.get("paths") or []
    lines = []
    for p in paths:
        if len(p) < 2:
            continue
        pts = project_coords(p) if do_project else [(c[0], c[1]) for c in p]
        try:
            lines.append(LineString(pts))
        except Exception:
            continue
    if not lines:
        return None
    return lines[0] if len(lines) == 1 else unary_union(lines)


def geojson_to_shapely(geom: dict, do_project: bool = True):
    g = shape(geom)
    return project_geom(g) if do_project else g


def project_geom(g):
    """Project a lat/lng shapely geometry into EPSG:26986."""
    from shapely.ops import transform

    def _fn(x, y, z=None):
        return project(x, y)

    return transform(_fn, g)
