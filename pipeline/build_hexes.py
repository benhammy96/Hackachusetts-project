#!/usr/bin/env python3
"""Build public/data/hexes.json — the raw-value H3 grid Atlas scores in the browser.

Implements ATLAS.md section 5. Every value written here is a *measurement*, not
a score: the browser computes scores from these raw values so that lens, MW and
cooling changes are instant and so that the scoring model stays inspectable.

Design rules this script follows:
  * Missing data is written as null. It is never filled with a favourable
    default (ATLAS.md 4.1 and 16.4).
  * `d_fiber_km` stays null unless a real fiber dataset is wired in. Highway
    distance is published separately as `d_highway_km` and is NOT a fiber
    measurement (ATLAS.md 16.4).
  * Nested transmission distances are forced monotonic
    (d_tx69 <= d_tx115 <= d_tx345) because each is "distance to a line of at
    least this voltage".
  * Every stage caches to pipeline/.cache so a rerun is cheap.

Usage:
    .venv-pipeline/bin/python pipeline/build_hexes.py [--res 8] [--stage NAME]
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import math
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import h3
from shapely.geometry import MultiPolygon, Point, Polygon, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

sys.path.insert(0, str(Path(__file__).resolve().parent))

import arcgis  # noqa: E402
import geo  # noqa: E402
from sources import FIELD_SOURCES, MASSGIS_REST, NOTES, OVERPASS, SOURCES, TIGERWEB  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "pipeline" / ".cache"
OUT_DATA = ROOT / "public" / "data"
OUT_LAYERS = OUT_DATA / "layers"
CACHE.mkdir(parents=True, exist_ok=True)
OUT_LAYERS.mkdir(parents=True, exist_ok=True)

RES = 8
START = time.time()


def log(msg: str) -> None:
    print(f"[{time.time() - START:7.1f}s] {msg}", flush=True)


def cached(name: str, fn, force: bool = False):
    """Run `fn` once and cache its JSON-serialisable result."""
    p = CACHE / f"{name}.json"
    if p.exists() and not force:
        log(f"cache hit  {name}")
        return json.loads(p.read_text())
    log(f"fetching   {name} ...")
    val = fn()
    p.write_text(json.dumps(val))
    log(f"cached     {name}")
    return val


# ---------------------------------------------------------------------------
# 1. Massachusetts boundary + hex grid
# ---------------------------------------------------------------------------
def fetch_boundary() -> dict:
    d = arcgis.post_json(
        f"{TIGERWEB}/query",
        {
            "f": "geojson",
            "where": "STATE='25'",
            "outFields": "NAME,STATE",
            "returnGeometry": "true",
            "outSR": "4326",
            "geometryPrecision": "5",
        },
    )
    return d


def build_grid(boundary_geojson: dict, res: int) -> list[str]:
    geoms = [shape(f["geometry"]) for f in boundary_geojson["features"]]
    poly = unary_union(geoms)
    cells: set[str] = set()
    parts = poly.geoms if isinstance(poly, MultiPolygon) else [poly]
    for part in parts:
        gj = json.loads(json.dumps(part.__geo_interface__))
        shp = h3.geo_to_h3shape(gj)
        cells.update(h3.h3shape_to_cells(shp, res))
    return sorted(cells)


# ---------------------------------------------------------------------------
# helpers shared by the attribute stages
# ---------------------------------------------------------------------------
def nearest_km(tree: STRtree, geoms: list, pts_proj: list[Point]) -> list[float | None]:
    """Distance in km from each projected point to the nearest geometry."""
    if not geoms:
        return [None] * len(pts_proj)
    out: list[float | None] = []
    for p in pts_proj:
        idx = tree.query_nearest(p, return_distance=False, all_matches=False)
        i = int(idx if not hasattr(idx, "__len__") else idx[0])
        out.append(round(geoms[i].distance(p) / 1000.0, 3))
    return out


def flags_from_polygons(
    layer_url: str,
    where: str,
    out_fields: str,
    pts: list[tuple[float, float]],
    pts_proj: list[Point],
    batch: int = 300,
    workers: int = 4,
    generalize_m: float = 10,
    collect_geoms: bool = False,
    label: str = "",
):
    """Per-point attributes for a layer too large to download.

    Returns (list of attribute dicts or None, {oid: (attrs, latlng-shapely)}).
    """
    order = sorted(range(len(pts)), key=lambda i: (pts[i][0] // 0.25, pts[i][1]))
    batches = [order[i : i + batch] for i in range(0, len(order), batch)]
    results: list[dict | None] = [None] * len(pts)
    geom_store: dict[object, tuple[dict, object]] = {}
    overlay: dict[object, dict] = {}
    done = 0

    def run(bidx: int):
        idxs = batches[bidx]
        subset = [pts[i] for i in idxs]
        oids = arcgis.ids_for_points(layer_url, subset, where=where)
        if not oids:
            return idxs, [], []
        feats = arcgis.by_ids(layer_url, oids, out_fields, generalize_m=generalize_m)
        return idxs, oids, feats

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(run, b): b for b in range(len(batches))}
        for fut in concurrent.futures.as_completed(futures):
            done += 1
            try:
                idxs, oids, feats = fut.result()
            except Exception as e:  # noqa: BLE001
                log(f"  !! {label} batch {futures[fut]} failed: {e}")
                continue
            if done % 20 == 0 or done == len(batches):
                log(f"  {label}: {done}/{len(batches)} batches")
            if not feats:
                continue
            polys, attrs = [], []
            for f in feats:
                g = geo.esri_polygon_to_shapely(f.get("geometry") or {}, do_project=True)
                if g is None or g.is_empty:
                    continue
                polys.append(g)
                a = f.get("attributes", {})
                attrs.append(a)
                key = a.get("OBJECTID")
                if collect_geoms and key is not None and key not in geom_store:
                    ll = geo.esri_polygon_to_shapely(f.get("geometry") or {}, do_project=False)
                    if ll is not None and not ll.is_empty:
                        geom_store[key] = (a, ll)
                        overlay[key] = {
                            "attributes": a,
                            "geometry": json.loads(json.dumps(
                                ll.simplify(0.0006).__geo_interface__)),
                            "area_deg2": ll.area,
                        }
            if not polys:
                continue
            tree = STRtree(polys)
            for i in idxs:
                p = pts_proj[i]
                for j in tree.query(p):
                    if polys[int(j)].covers(p):
                        results[i] = attrs[int(j)]
                        break
    return {"results": results, "overlay": list(overlay.values())}


def write_geojson(path: Path, features: list[dict], note: str) -> None:
    fc = {
        "type": "FeatureCollection",
        "atlas_note": note,
        "features": features,
    }
    path.write_text(json.dumps(fc, separators=(",", ":")))
    log(f"wrote {path.relative_to(ROOT)}  {path.stat().st_size / 1e6:.2f} MB  ({len(features)} features)")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--res", type=int, default=RES)
    ap.add_argument("--limit", type=int, default=0, help="debug: only N hexes")
    ap.add_argument("--skip-slr", action="store_true")
    args = ap.parse_args()
    res = args.res

    boundary = cached("ma_boundary", fetch_boundary)
    cells = cached(f"grid_res{res}", lambda: build_grid(boundary, res))
    if args.limit:
        cells = cells[:: max(1, len(cells) // args.limit)][: args.limit]
    log(f"hex grid: {len(cells)} cells at res {res} "
        f"({h3.cell_area(cells[0], unit='km^2'):.3f} km^2 each)")

    centro = [h3.cell_to_latlng(c) for c in cells]
    pts = [(lng, lat) for lat, lng in centro]
    pts_proj = [Point(*geo.project(lng, lat)) for lng, lat in pts]
    n = len(cells)

    rec: dict[str, list] = {
        k: [None] * n
        for k in (
            "town", "d_tx69_km", "d_tx115_km", "d_tx345_km", "d_clean_km", "mlp_town",
            "d_highway_km", "d_fiber_km", "land_class", "land_use_name",
            "land_cover_name", "pop_1km", "school_or_hospital_500m", "in_ej",
            "near_ej_1mi", "d_ej_km", "ej_criteria", "water_stress",
            "in_sw_supply_watershed", "d_dw_zone2_km", "flood_100yr", "flood_500yr",
            "coastal_slr", "developed_frac_1km", "brownfield", "aul_site_500m",
        )
    }
    exclusions: list[list[str]] = [[] for _ in range(n)]
    layer_out: dict[str, list[dict]] = {}

    # ---- towns -------------------------------------------------------------
    towns = cached(
        "towns",
        lambda: arcgis.query_all(
            f"{MASSGIS_REST}/AGOL/Census2020_Towns/MapServer/2",
            out_fields="TOWN20,COUNTY20,TOWN_ID", generalize_m=30,
        ),
    )
    tgeo, tname = [], []
    for f in towns:
        g = geo.esri_polygon_to_shapely(f.get("geometry") or {})
        if g is None or g.is_empty:
            continue
        tgeo.append(g)
        a = f["attributes"]
        tname.append((a.get("TOWN20"), a.get("COUNTY20")))
    ttree = STRtree(tgeo)
    for i, p in enumerate(pts_proj):
        hit = None
        for j in ttree.query(p):
            if tgeo[int(j)].covers(p):
                hit = int(j)
                break
        if hit is None:  # coastal cell whose centroid falls outside any town
            idx = ttree.query_nearest(p, return_distance=False, all_matches=False)
            hit = int(idx if not hasattr(idx, "__len__") else idx[0])
        rec["town"][i] = tname[hit][0]
    log(f"towns assigned ({len({t for t in rec['town'] if t})} distinct)")

    # ---- municipal light plant towns --------------------------------------
    elec = cached(
        "elec_providers",
        lambda: arcgis.query_all(
            f"{MASSGIS_REST}/AGOL/ElectricityProviders/MapServer/0",
            out_fields="TOWN,ELEC", geometry=False,
        ),
    )
    MLP_WORDS = ("municipal", "light department", "light plant", "light board",
                 "gas & electric", "gas and electric", "electric light",
                 "light & power", "light and power", "municipal light")
    mlp_towns = set()
    providers: dict[str, str] = {}
    for f in elec:
        a = f["attributes"]
        town, prov = a.get("TOWN"), (a.get("ELEC") or "")
        if town:
            providers[town.upper()] = prov
            if any(w in prov.lower() for w in MLP_WORDS):
                mlp_towns.add(town.upper())
    for i, t in enumerate(rec["town"]):
        rec["mlp_town"][i] = bool(t and t.upper() in mlp_towns)
    log(f"municipal light plant towns detected: {len(mlp_towns)}")

    # ---- environmental justice + population -------------------------------
    ej = cached(
        "ej2020",
        lambda: arcgis.query_all(
            f"{MASSGIS_REST}/AGOL/EJ2020/MapServer/0",
            out_fields="GEOID,MUNICIPALITY,TOTAL_POP,EJ,EJ_CRITERIA,EJ_CRIT_DESC",
            generalize_m=15,
        ),
    )
    # NOTE: the MassGIS EJ2020 layer contains ONLY designated EJ block groups.
    # It answers "is this an EJ block group" but cannot supply total population,
    # so population comes from the Census 2020 block layer below.
    ej_geo, ej_attr = [], []
    for f in ej:
        g = geo.esri_polygon_to_shapely(f.get("geometry") or {})
        if g is None or g.is_empty:
            continue
        ej_geo.append(g)
        ej_attr.append(f["attributes"])
    ej_tree = STRtree(ej_geo) if ej_geo else None
    log(f"EJ2020: {len(ej_geo)} designated EJ block groups")

    MILE_KM = 1.609344
    for i, p in enumerate(pts_proj):
        inside = None
        if ej_tree is not None:
            for j in ej_tree.query(p):
                if ej_geo[int(j)].covers(p):
                    inside = int(j)
                    break
        rec["in_ej"][i] = inside is not None
        rec["ej_criteria"][i] = (
            ej_attr[inside].get("EJ_CRIT_DESC") or ej_attr[inside].get("EJ_CRITERIA")
            if inside is not None else None
        )
        if ej_tree is not None:
            idx = ej_tree.query_nearest(p, return_distance=False, all_matches=False)
            k = int(idx if not hasattr(idx, "__len__") else idx[0])
            d = ej_geo[k].distance(p) / 1000.0
            rec["d_ej_km"][i] = round(d, 3)
            rec["near_ej_1mi"][i] = bool(d <= MILE_KM)
    log("environmental justice done")

    # ---- population from Census 2020 blocks -------------------------------
    blocks = cached(
        "census_blocks_2020",
        lambda: arcgis.query_all(
            f"{MASSGIS_REST}/AGOL/Census2020_Base_Geography/MapServer/1",
            out_fields="GEOID20,POP20,INTPTLAT20,INTPTLON20",
            geometry=False, page=2000,
        ),
    )
    bpts, bpop = [], []
    for f in blocks:
        a = f["attributes"]
        try:
            lat = float(a["INTPTLAT20"])
            lng = float(a["INTPTLON20"])
        except (TypeError, ValueError, KeyError):
            continue
        bpts.append(Point(*geo.project(lng, lat)))
        bpop.append(a.get("POP20") or 0)
    log(f"census blocks: {len(bpts)} internal points, "
        f"{int(sum(bpop)):,} people total")
    if bpts:
        btree = STRtree(bpts)
        for i, p in enumerate(pts_proj):
            buf = p.buffer(1000.0)
            rec["pop_1km"][i] = int(round(sum(
                bpop[int(j)] for j in btree.query(buf) if bpts[int(j)].within(buf)
            )))
        log("pop_1km done")

    ej_features = []
    for f in ej:
        g = geo.esri_polygon_to_shapely(f.get("geometry") or {}, do_project=False)
        if g is None or g.is_empty:
            continue
        a = f["attributes"]
        ej_features.append({
            "type": "Feature",
            "properties": {
                "geoid": a.get("GEOID"), "municipality": a.get("MUNICIPALITY"),
                "pop": a.get("TOTAL_POP"),
                "criteria": a.get("EJ_CRIT_DESC") or a.get("EJ_CRITERIA"),
            },
            "geometry": json.loads(json.dumps(g.simplify(0.0004).__geo_interface__)),
        })
    layer_out["ej"] = ej_features

    # ---- basemap geometry (local, so the demo needs no tile service) ------
    town_features = []
    for f, (name, county) in zip(towns, tname):
        g = geo.esri_polygon_to_shapely(f.get("geometry") or {}, do_project=False)
        if g is None or g.is_empty:
            continue
        simple = g.simplify(0.0012)
        if simple.is_empty:
            continue
        c = g.representative_point()
        town_features.append({
            "type": "Feature",
            "properties": {
                "town": (name or "").title(),
                "county": (county or "").title(),
                "lat": round(c.y, 5),
                "lng": round(c.x, 5),
            },
            "geometry": json.loads(json.dumps(simple.__geo_interface__)),
        })
    layer_out["towns"] = town_features

    water = cached(
        "hydrography_detail_v2",
        lambda: (
            arcgis.query_all(f"{MASSGIS_REST}/AGOL/Hydro_Major/MapServer/2",
                             out_fields="NAME,TYPE,FEATURE", generalize_m=8)
        ),
    )
    water_features = []
    for f in water:
        g = geo.esri_polygon_to_shapely(f.get("geometry") or {}, do_project=False)
        if g is None or g.is_empty or g.area < 2e-6:
            continue
        water_features.append({
            "type": "Feature",
            "properties": {"name": f["attributes"].get("NAME")},
            "geometry": json.loads(json.dumps(g.simplify(0.00008).__geo_interface__)),
        })
    layer_out["water"] = water_features
    log(f"basemap: {len(town_features)} towns, {len(water_features)} water bodies")

    # ---- transmission lines (OpenStreetMap) -------------------------------
    def fetch_lines():
        q = (
            "[out:json][timeout:600];"
            'area["ISO3166-2"="US-MA"][admin_level=4]->.ma;'
            'way["power"="line"]["voltage"](area.ma);'
            "out geom;"
        )
        return arcgis.overpass(q, OVERPASS)

    osm_lines = cached("osm_power_lines", fetch_lines)

    def max_voltage(tag: str) -> float | None:
        best = None
        for part in str(tag).replace(",", ";").split(";"):
            part = part.strip()
            if not part:
                continue
            try:
                v = float(part)
            except ValueError:
                continue
            if v < 1000:  # some mappers use kV
                v *= 1000
            best = v if best is None else max(best, v)
        return best

    from shapely.geometry import LineString

    tx: dict[int, list] = {69: [], 115: [], 345: []}
    tx_display: list[dict] = []
    for el in osm_lines.get("elements", []):
        g = el.get("geometry") or []
        if len(g) < 2:
            continue
        v = max_voltage(el.get("tags", {}).get("voltage", ""))
        if v is None:
            continue
        kv = v / 1000.0
        ll = [(p["lon"], p["lat"]) for p in g]
        try:
            line_proj = LineString([geo.project(x, y) for x, y in ll])
            line_ll = LineString(ll)
        except Exception:
            continue
        for thresh in (69, 115, 345):
            if kv >= thresh:
                tx[thresh].append(line_proj)
        band = "345kV+" if kv >= 345 else "115-344kV" if kv >= 115 else "69-114kV" if kv >= 69 else "<69kV"
        tx_display.append({
            "type": "Feature",
            "properties": {"kv": round(kv, 1), "band": band, "osm_id": el.get("id")},
            "geometry": json.loads(json.dumps(line_ll.simplify(0.0003).__geo_interface__)),
        })
    log(f"OSM transmission: {len(tx_display)} ways  (>=69kV {len(tx[69])}, "
        f">=115kV {len(tx[115])}, >=345kV {len(tx[345])})")
    layer_out["transmission"] = tx_display

    for thresh, field in ((69, "d_tx69_km"), (115, "d_tx115_km"), (345, "d_tx345_km")):
        geoms = tx[thresh]
        if not geoms:
            log(f"  !! no lines at >={thresh}kV; {field} left null")
            continue
        tree = STRtree(geoms)
        rec[field] = nearest_km(tree, geoms, pts_proj)
        log(f"  {field} done")

    # enforce the nested-subset contract
    for i in range(n):
        a, b, c = rec["d_tx69_km"][i], rec["d_tx115_km"][i], rec["d_tx345_km"][i]
        if a is not None and b is not None:
            rec["d_tx115_km"][i] = b = max(a, b)
        if b is not None and c is not None:
            rec["d_tx345_km"][i] = max(b, c)

    # ---- non-emitting generation (OpenStreetMap) --------------------------
    def fetch_plants():
        q = (
            "[out:json][timeout:600];"
            'area["ISO3166-2"="US-MA"][admin_level=4]->.ma;'
            "("
            'nwr["power"="plant"]["plant:source"~"hydro|wind|solar|nuclear"](area.ma);'
            'nwr["power"="generator"]["generator:source"~"hydro|wind|solar|nuclear"](area.ma);'
            ");"
            "out center tags;"
        )
        return arcgis.overpass(q, OVERPASS)

    plants = cached("osm_clean_generation", fetch_plants)
    pg, pg_attr = [], []
    for el in plants.get("elements", []):
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue
        pg.append(Point(*geo.project(lon, lat)))
        t = el.get("tags", {})
        pg_attr.append(t.get("plant:source") or t.get("generator:source"))
    log(f"OSM non-emitting generation: {len(pg)} features")
    if pg:
        tree = STRtree(pg)
        rec["d_clean_km"] = nearest_km(tree, pg, pts_proj)

    # ---- highways (NOT fiber) ---------------------------------------------
    hw = cached(
        "major_highways",
        lambda: arcgis.query_all(
            f"{MASSGIS_REST}/AGOL/MajorHighways/MapServer/0",
            out_fields="RT_NUMBER,ADMIN_TYPE", generalize_m=30,
        ),
    )
    hg = []
    for f in hw:
        g = geo.esri_polyline_to_shapely(f.get("geometry") or {})
        if g is not None and not g.is_empty:
            hg.append(g)
    if hg:
        rec["d_highway_km"] = nearest_km(STRtree(hg), hg, pts_proj)
    log(f"highways: {len(hg)} features")

    # ---- schools + hospitals ----------------------------------------------
    def fetch_sens():
        out = []
        for lid in range(0, 9):
            try:
                out += arcgis.query_all(
                    f"{MASSGIS_REST}/AGOL/Schools_PK12/MapServer/{lid}",
                    out_fields="NAME,TYPE_DESC",
                )
            except Exception as e:  # noqa: BLE001
                log(f"  schools layer {lid}: {e}")
        out += arcgis.query_all(
            f"{MASSGIS_REST}/AGOL/Hospitals/MapServer/0",
            out_fields="FACILITY_NAME,FACILITY_TYPE",
        )
        return out

    sens = cached("schools_hospitals", fetch_sens)
    sg = []
    for f in sens:
        g = f.get("geometry") or {}
        if g.get("x") is None:
            continue
        sg.append(Point(*geo.project(g["x"], g["y"])))
    log(f"schools + hospitals: {len(sg)} points")
    if sg:
        stree = STRtree(sg)
        for i, p in enumerate(pts_proj):
            rec["school_or_hospital_500m"][i] = len(stree.query(p.buffer(500.0))) > 0

    # ---- AUL (previously contaminated / developed) sites ------------------
    aul = cached(
        "aul_sites",
        lambda: arcgis.query_all(f"{MASSGIS_REST}/AGOL/AUL_Sites/MapServer/0", out_fields="*"),
    )
    ag = []
    for f in aul:
        g = f.get("geometry") or {}
        if g.get("x") is None:
            continue
        ag.append(Point(*geo.project(g["x"], g["y"])))
    log(f"AUL sites: {len(ag)} points")
    if ag:
        atree = STRtree(ag)
        for i, p in enumerate(pts_proj):
            rec["aul_site_500m"][i] = len(atree.query(p.buffer(500.0))) > 0

    # ---- drinking water: Zone I / Zone A exclusions, Zone II distance -----
    z1 = cached(
        "zone1",
        lambda: arcgis.query_all(f"{MASSGIS_REST}/AGOL/Zone1/MapServer/0",
                                 out_fields="SITE_NAME,SUPPLIER", generalize_m=5),
    )
    za = cached(
        "zoneA",
        lambda: arcgis.query_all(f"{MASSGIS_REST}/AGOL/ZoneABC/MapServer/0",
                                 out_fields="SITE_NAME,SUPPLIER,SWPZONE",
                                 where="SWPZONE='A'", generalize_m=10),
    )
    dw_excl, dw_names = [], []
    for f in z1 + za:
        g = geo.esri_polygon_to_shapely(f.get("geometry") or {})
        if g is None or g.is_empty:
            continue
        dw_excl.append(g)
        a = f["attributes"]
        dw_names.append((a.get("SWPZONE") and "Zone A" or "Zone I", a.get("SITE_NAME")))
    log(f"drinking water Zone I + Zone A polygons: {len(dw_excl)}")
    if dw_excl:
        dtree = STRtree(dw_excl)
        for i, p in enumerate(pts_proj):
            for j in dtree.query(p):
                if dw_excl[int(j)].covers(p):
                    zone, site = dw_names[int(j)]
                    exclusions[i].append(
                        f"Drinking water protection {zone}"
                        + (f" ({site.title()})" if site else "")
                    )
                    break

    z2 = cached(
        "zone2_iwpa",
        lambda: (
            arcgis.query_all(f"{MASSGIS_REST}/AGOL/IWPA_Zone2/MapServer/0",
                             out_fields="SUPPLIER,TOWN", generalize_m=10)
            + arcgis.query_all(f"{MASSGIS_REST}/AGOL/IWPA_Zone2/MapServer/1",
                               out_fields="SUPPLIER,TOWN", generalize_m=10)
        ),
    )
    z2g = []
    for f in z2:
        g = geo.esri_polygon_to_shapely(f.get("geometry") or {})
        if g is not None and not g.is_empty:
            z2g.append(g)
    log(f"Zone II / IWPA polygons: {len(z2g)}")
    if z2g:
        rec["d_dw_zone2_km"] = nearest_km(STRtree(z2g), z2g, pts_proj)

    # ---- surface water supply watersheds (water sensitivity proxy) --------
    sws = cached(
        "sw_supply_watersheds",
        lambda: arcgis.query_all(
            f"{MASSGIS_REST}/AGOL/Surface_Water_Supply_Watersheds/MapServer/0",
            out_fields="SITE_NAME,SUPPLIER", generalize_m=30,
        ),
    )
    swg = []
    for f in sws:
        g = geo.esri_polygon_to_shapely(f.get("geometry") or {})
        if g is not None and not g.is_empty:
            swg.append(g)
    if swg:
        swtree = STRtree(swg)
        for i, p in enumerate(pts_proj):
            rec["in_sw_supply_watershed"][i] = any(
                swg[int(j)].covers(p) for j in swtree.query(p)
            )
    log(f"surface water supply watersheds: {len(swg)}")

    tag = f"res{res}_n{n}"

    # ---- protected open space (exclusion) ---------------------------------
    os_out = cached(f"probe_openspace_{tag}", lambda: flags_from_polygons(
        f"{MASSGIS_REST}/AGOL/openspace/MapServer/0",
        where="LEV_PROT='P' OR ARTICLE97=1",
        out_fields="OBJECTID,SITE_NAME,LEV_PROT,ARTICLE97,OWNER_TYPE,FEE_OWNER",
        pts=pts, pts_proj=pts_proj, batch=300, workers=4, generalize_m=10,
        collect_geoms=True, label="openspace",
    ))
    os_attrs = os_out["results"]
    for i, a in enumerate(os_attrs):
        if not a:
            continue
        name = (a.get("SITE_NAME") or "protected open space").title()
        art = " (Article 97)" if a.get("ARTICLE97") in (1, "1", "Y", "y") else ""
        exclusions[i].append(f"Permanently protected open space{art}: {name}")
    log(f"protected open space: {sum(1 for a in os_attrs if a)} hexes excluded")
    layer_out["protected"] = [
        {"type": "Feature",
         "properties": {"name": o["attributes"].get("SITE_NAME"),
                        "article97": o["attributes"].get("ARTICLE97"),
                        "owner": o["attributes"].get("FEE_OWNER")},
         "geometry": o["geometry"]}
        for o in os_out["overlay"] if o["area_deg2"] > 2e-5
    ]

    # ---- wetlands (exclusion) ---------------------------------------------
    wet_attrs = cached(f"probe_wetlands_{tag}", lambda: flags_from_polygons(
        f"{MASSGIS_REST}/AGOL/DEP_Wetlands_FieldMaps/MapServer/1",
        where="1=1", out_fields="WETCODE,IT_VALDESC",
        pts=pts, pts_proj=pts_proj, batch=250, workers=4, generalize_m=10,
        label="wetlands",
    ))["results"]
    for i, a in enumerate(wet_attrs):
        if not a:
            continue
        desc = (a.get("IT_VALDESC") or "wetland").title()
        exclusions[i].append(f"MassDEP mapped wetland or open water: {desc}")
    log(f"wetlands: {sum(1 for a in wet_attrs if a)} hexes excluded")

    # ---- FEMA flood hazard -------------------------------------------------
    fema = f"{MASSGIS_REST}/FEMA/FEMA_National_Flood_Hazard_Layer/MapServer/0"
    f100_out = cached(f"probe_fema100_{tag}", lambda: flags_from_polygons(
        fema, where="SFHA_TF='T'", out_fields="OBJECTID,FLD_ZONE,ZONE_SUBTY,SFHA_TF",
        pts=pts, pts_proj=pts_proj, batch=250, workers=4, generalize_m=10,
        collect_geoms=True, label="fema-100yr",
    ))
    f100_attrs = f100_out["results"]
    for i, a in enumerate(f100_attrs):
        rec["flood_100yr"][i] = bool(a)
        if a:
            exclusions[i].append(
                f"FEMA 1% annual chance floodplain (zone {a.get('FLD_ZONE')})"
            )
    log(f"FEMA 1% floodplain: {sum(1 for a in f100_attrs if a)} hexes excluded")
    layer_out["flood"] = [
        {"type": "Feature",
         "properties": {"zone": o["attributes"].get("FLD_ZONE"),
                        "subtype": o["attributes"].get("ZONE_SUBTY")},
         "geometry": o["geometry"]}
        for o in f100_out["overlay"] if o["area_deg2"] > 1e-5
    ]

    f500_attrs = cached(f"probe_fema500_{tag}", lambda: flags_from_polygons(
        fema, where="ZONE_SUBTY LIKE '%0.2 PCT%'", out_fields="FLD_ZONE,ZONE_SUBTY",
        pts=pts, pts_proj=pts_proj, batch=250, workers=4, generalize_m=10,
        label="fema-500yr",
    ))["results"]
    for i, a in enumerate(f500_attrs):
        rec["flood_500yr"][i] = bool(a)
    log(f"FEMA 0.2% floodplain: {sum(1 for a in f500_attrs if a)} hexes")

    # ---- sea level rise ----------------------------------------------------
    if args.skip_slr:
        log("sea level rise: skipped (--skip-slr); coastal_slr stays null")
    else:
        try:
            slr_out = cached(f"probe_slr_{tag}", lambda: flags_from_polygons(
                f"{MASSGIS_REST}/AGOL/CZM_NOAA_SLR_Data_Combined/MapServer/0",
                where=(
                    "SEA_LVL_RS IN ('Current Mean Higher High Water',"
                    "'1 ft Sea Level Rise','2 ft Sea Level Rise','3 ft Sea Level Rise')"
                ),
                out_fields="OBJECTID,SEA_LVL_RS",
                pts=pts, pts_proj=pts_proj, batch=120, workers=3, generalize_m=15,
                label="slr",
            ))
            slr_attrs = slr_out["results"]
            for i, a in enumerate(slr_attrs):
                rec["coastal_slr"][i] = bool(a)
            log(f"sea level rise (<=3 ft): {sum(1 for a in slr_attrs if a)} hexes")
        except Exception as e:  # noqa: BLE001
            log(f"sea level rise unavailable: {e}")

    # ---- land cover / land use --------------------------------------------
    lclu = f"{MASSGIS_REST}/AGOL/LandCoverLandUse2016/MapServer/0"

    def lclu_one(i: int):
        try:
            rows = arcgis.point_query(lclu, pts[i][0], pts[i][1],
                                      "COVERNAME,USEGENNAME,USE_CODE")
            if rows:
                return i, ("ok", rows[0])
            return i, ("empty", None)
        except Exception:
            return i, ("error", None)

    def lclu_all():
        log(f"land cover: {n} point queries ...")
        status: list[str] = ["error"] * n
        rows: list[dict | None] = [None] * n
        done = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
            for i, (st, row) in ex.map(lclu_one, range(n)):
                done += 1
                status[i] = st
                rows[i] = row
                if done % 4000 == 0:
                    log(f"  land cover {done}/{n}")
        return {"status": status, "rows": rows}

    lclu_out = cached(f"probe_lclu_{tag}", lclu_all)
    lclu_status = lclu_out["status"]
    for i, row in enumerate(lclu_out["rows"]):
        if row:
            rec["land_use_name"][i] = row.get("USEGENNAME")
            rec["land_cover_name"][i] = row.get("COVERNAME")
    log(f"land cover done (ok={lclu_status.count('ok')} "
        f"no-coverage={lclu_status.count('empty')} error={lclu_status.count('error')})")

    USE_MAP = {
        "Industrial": "industrial",
        "Commercial": "commercial",
        "Mixed use, primarily commercial": "commercial",
        "Residential - single family": "residential",
        "Residential - multi-family": "residential",
        "Residential - other": "residential",
        "Mixed use, primarily residential": "residential",
        "Agriculture": "agriculture",
        "Forest": "forest",
    }
    COVER_MAP = {
        "Impervious": "other_developed",
        "Developed Open Space": "other_developed",
        "Bare Land": "open_land",
        "Cultivated": "agriculture",
        "Pasture/Hay": "agriculture",
        "Grassland": "open_land",
        "Scrub/Shrub": "open_land",
        "Deciduous Forest": "forest",
        "Evergreen Forest": "forest",
        "Water": "water",
        "Palustrine Aquatic Bed": "wetland",
        "Palustrine Emergent Wetland": "wetland",
        "Palustrine Forested Wetland": "wetland",
        "Palustrine Scrub/Shrub Wetland": "wetland",
    }
    DEVELOPED = {"industrial", "commercial", "other_developed", "residential"}
    for i in range(n):
        use, cover = rec["land_use_name"][i], rec["land_cover_name"][i]
        cls = USE_MAP.get(use or "")
        if cls is None:
            cls = COVER_MAP.get(cover or "")
        if cls in ("water", "wetland"):
            label = "Open water" if cls == "water" else "Wetland cover"
            if not any("wetland" in e.lower() or "water" in e.lower() for e in exclusions[i]):
                exclusions[i].append(f"{label} (MassGIS 2016 land cover)")
            cls = None
        elif lclu_status[i] == "empty":
            # The 2016 Land Cover/Land Use layer covers all Massachusetts land, so
            # a successful query with no result means the cell centre is offshore.
            if not any("water" in e.lower() for e in exclusions[i]):
                exclusions[i].append("Open water (no mapped Massachusetts land cover)")
        rec["land_class"][i] = cls
        rec["brownfield"][i] = bool(
            rec["aul_site_500m"][i] and cls in ("industrial", "commercial", "other_developed")
        )

    # developed fraction within ~1 km, from the land class of the k-ring
    cls_by_cell = {c: rec["land_class"][i] for i, c in enumerate(cells)}
    for i, c in enumerate(cells):
        ring = [cls_by_cell.get(x) for x in h3.grid_disk(c, 1)]
        known = [x for x in ring if x is not None]
        rec["developed_frac_1km"][i] = (
            round(sum(1 for x in known if x in DEVELOPED) / len(known), 3) if known else None
        )

    # Quabbin and the Wachusett basins are excluded as open water; say so in the
    # language a town would use by naming the drinking water supply watershed.
    for i in range(n):
        if (
            exclusions[i]
            and rec["in_sw_supply_watershed"][i]
            and any("water" in e.lower() or "wetland" in e.lower() for e in exclusions[i])
        ):
            exclusions[i].insert(
                1, "Inside a public surface water supply watershed (MassDEP)"
            )

    # ---- finalise ----------------------------------------------------------
    excluded = [len(e) > 0 for e in exclusions]
    reason = [("; ".join(e[:2]) if e else None) for e in exclusions]
    log(f"excluded hexes: {sum(excluded)} / {n} ({100 * sum(excluded) / n:.1f}%)")

    # boundary layer for the offline basemap
    bnd = unary_union([shape(f["geometry"]) for f in boundary["features"]])
    layer_out["ma-boundary"] = [
        {"type": "Feature", "properties": {"name": "Massachusetts"},
         "geometry": json.loads(json.dumps(bnd.simplify(0.002).__geo_interface__))}
    ]

    FIELDS = [
        "h3", "town", "land_class", "land_use_name", "land_cover_name",
        "d_tx69_km", "d_tx115_km", "d_tx345_km", "d_clean_km", "d_highway_km",
        "d_fiber_km", "d_ej_km", "d_dw_zone2_km", "pop_1km", "developed_frac_1km",
        "water_stress", "mlp_town", "school_or_hospital_500m", "in_ej",
        "near_ej_1mi", "in_sw_supply_watershed", "flood_100yr", "flood_500yr",
        "coastal_slr", "brownfield", "aul_site_500m", "excluded",
        "ej_criteria", "exclude_reason",
    ]
    BOOLS = {"mlp_town", "school_or_hospital_500m", "in_ej", "near_ej_1mi",
             "in_sw_supply_watershed", "flood_100yr", "flood_500yr", "coastal_slr",
             "brownfield", "aul_site_500m", "excluded"}

    # dictionary-encode the repeated strings
    dicts: dict[str, list[str]] = {}
    def encode(field: str, values: list):
        vocab: list[str] = []
        index: dict[str, int] = {}
        out = []
        for v in values:
            if v is None:
                out.append(None)
                continue
            if v not in index:
                index[v] = len(vocab)
                vocab.append(v)
            out.append(index[v])
        dicts[field] = vocab
        return out

    col: dict[str, list] = {
        "h3": cells,
        "town": encode("town", rec["town"]),
        "land_class": encode("land_class", rec["land_class"]),
        "land_use_name": encode("land_use_name", rec["land_use_name"]),
        "land_cover_name": encode("land_cover_name", rec["land_cover_name"]),
        "ej_criteria": encode("ej_criteria", rec["ej_criteria"]),
        "exclude_reason": encode("exclude_reason", reason),
        "excluded": excluded,
    }
    for f in FIELDS:
        if f in col:
            continue
        col[f] = rec[f]

    rows = []
    for i in range(n):
        row = []
        for f in FIELDS:
            v = col[f][i]
            if f in BOOLS:
                # null is preserved: an unknown flag must never read as "false",
                # because false is the favourable answer for every hazard flag.
                row.append(None if v is None else (1 if v else 0))
            elif isinstance(v, float):
                row.append(round(v, 3))
            else:
                row.append(v)
        rows.append(row)

    nulls = {f: sum(1 for i in range(n) if col[f][i] is None) for f in FIELDS}
    fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    payload = {
        "format": "atlas-hex-columnar-1",
        "generated_at": fetched_at,
        "h3_resolution": res,
        "count": n,
        "fields": FIELDS,
        "bool_fields": sorted(BOOLS),
        "dictionaries": dicts,
        "rows": rows,
    }
    out = OUT_DATA / "hexes.json"
    out.write_text(json.dumps(payload, separators=(",", ":")))
    log(f"wrote {out.relative_to(ROOT)}  {out.stat().st_size / 1e6:.2f} MB")

    meta = {
        "generated_at": fetched_at,
        "h3_resolution": res,
        "hex_count": n,
        "hex_area_km2": round(h3.cell_area(cells[0], unit="km^2"), 4),
        "projection": "EPSG:26986 (NAD83 / Massachusetts Mainland) for all distances",
        "excluded_count": sum(excluded),
        "sources": SOURCES,
        "fields": {
            f: {
                "source": FIELD_SOURCES.get(f, (None, "modeled"))[0],
                "status": FIELD_SOURCES.get(f, (None, "modeled"))[1],
                "null_count": nulls.get(f, 0),
                "coverage": round(1 - nulls.get(f, 0) / n, 4),
            }
            for f in FIELDS if f != "h3"
        },
        "notes": NOTES,
    }
    (OUT_DATA / "meta.json").write_text(json.dumps(meta, indent=2))
    log("wrote public/data/meta.json")

    for name, feats in layer_out.items():
        write_geojson(OUT_LAYERS / f"{name}.geojson", feats,
                      "Generalised for display. Authoritative per-hex flags are in hexes.json.")

    log("null counts per field:")
    for f in FIELDS:
        if nulls.get(f):
            log(f"   {f:26} {nulls[f]:6} null ({100 * nulls[f] / n:5.1f}%)")
    log("done")


if __name__ == "__main__":
    main()
