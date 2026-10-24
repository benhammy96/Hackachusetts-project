"use client";

import * as React from "react";
import {
  Map as MlMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type MapMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import { MapLibreOverlay } from "@deck.gl/maplibre";
import { ArcLayer, GeoJsonLayer, PathLayer, PolygonLayer, TextLayer } from "@deck.gl/layers";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { cellToBoundary } from "h3-js";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import type { Feature, FeatureCollection, LineString } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

/** deck.gl accessors want fixed-length tuples, not GeoJSON's number[]. */
type LngLat = [number, number];

import { useAtlas } from "./atlas-provider";
import { useGeoJson, prefersReducedMotion } from "./use-geojson";
import { MapLegend } from "./map-legend";
import { HexTooltip } from "./hex-tooltip";
import { colorForScore } from "@/lib/score";
import { presetFor } from "@/lib/weights";
import type { HexRecord } from "@/lib/types";

const ATTRIBUTION = [
  'Basemap and screening layers: <a href="https://www.mass.gov/orgs/massgis-bureau-of-geographic-information" target="_blank" rel="noreferrer">MassGIS</a>, FEMA NFHL, US Census',
  'Transmission: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors (ODbL)',
];

/**
 * There is no tile service behind this map.
 *
 * UI_DESIGN.md section 6 asks for a custom low-noise dark basemap, and
 * ATLAS.md requires the demo to work without a live external API. So the
 * basemap is drawn from the same MassGIS geometry the pipeline already
 * downloads — water, town boundaries and the state outline — shipped as static
 * GeoJSON. Nothing here needs a key, and the map renders fully offline.
 */
const STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#0B0F14" } }],
};

/* Basemap palette: muted charcoal land, darker desaturated water. */
const LAND_FILL: [number, number, number, number] = [23, 30, 38, 255];
const LAND_LINE: [number, number, number, number] = [45, 58, 70, 220];
const WATER_FILL: [number, number, number, number] = [15, 23, 32, 255];
const WATER_LINE: [number, number, number, number] = [36, 52, 66, 180];
const STATE_LINE: [number, number, number, number] = [86, 104, 120, 235];

const MA_CENTER: [number, number] = [-71.8, 42.15];

// maplibre-gl 6 resolves its worker with `new URL(..., import.meta.url)`, which
// Turbopack cannot trace. scripts/copy-maplibre-worker.mjs stages the shipped
// worker bundle in public/vendor so we can point maplibre straight at it.
setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

export function AtlasMap() {
  const {
    index,
    loading,
    mw,
    lens,
    cooling,
    selected,
    camera,
    selectAt,
    scoreFor,
    layers,
  } = useAtlas();

  const container = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MlMap | null>(null);
  const overlayRef = React.useRef<MapLibreOverlay | null>(null);
  const [ready, setReady] = React.useState(false);
  const [zoom, setZoom] = React.useState(7.6);
  const [hover, setHover] = React.useState<{ hex: HexRecord; x: number; y: number } | null>(
    null,
  );
  const flownIn = React.useRef(false);

  // Transmission is needed both as an overlay and to draw the arc from a
  // selected site to the nearest qualifying line, so it loads up front.
  const transmission = useGeoJson("/data/layers/transmission.geojson", true);
  const boundary = useGeoJson("/data/layers/ma-boundary.geojson", true);
  const towns = useGeoJson("/data/layers/towns.geojson", true);
  const water = useGeoJson("/data/layers/water.geojson", true);
  const ej = useGeoJson("/data/layers/ej.geojson", layers.ej);
  const protectedLand = useGeoJson("/data/layers/protected.geojson", layers.protected);
  const flood = useGeoJson("/data/layers/flood.geojson", layers.flood);

  /* ------------------------------------------------------------ map setup */
  React.useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new MlMap({
      container: container.current,
      style: STYLE,
      center: MA_CENTER,
      zoom: 7.1,
      pitch: 0,
      bearing: 0,
      maxZoom: 15,
      minZoom: 5.5,
      attributionControl: { compact: true, customAttribution: ATTRIBUTION },
      dragRotate: true,
    });
    mapRef.current = map;

    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    const overlay = new MapLibreOverlay({ interleaved: false, layers: [] });
    overlayRef.current = overlay;
    map.addControl(overlay);

    map.on("load", () => setReady(true));
    map.on("zoom", () => setZoom(map.getZoom()));

    return () => {
      overlayRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  /* -------------------------------------------------- click + hover wiring */
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const onClick = (e: MapMouseEvent) => {
      const result = selectAt(e.lngLat.lat, e.lngLat.lng);
      if (result === "outside") {
        import("sonner").then(({ toast }) =>
          toast("Pick a spot inside Massachusetts", {
            description: "The screening grid only covers the Commonwealth.",
          }),
        );
      }
    };

    const onMove = (e: MapMouseEvent) => {
      if (!index) return;
      const hex = index.at(e.lngLat.lat, e.lngLat.lng);
      setHover(hex ? { hex, x: e.point.x, y: e.point.y } : null);
    };

    const onLeave = () => setHover(null);

    map.on("click", onClick);
    map.on("mousemove", onMove);
    map.on("mouseout", onLeave);
    map.getCanvas().style.cursor = "crosshair";
    return () => {
      map.off("click", onClick);
      map.off("mousemove", onMove);
      map.off("mouseout", onLeave);
    };
  }, [ready, index, selectAt]);

  /* ----------------------------------------------------- opening fly-in */
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !index || flownIn.current) return;
    flownIn.current = true;
    if (prefersReducedMotion()) {
      map.jumpTo({ center: [-71.4, 42.25], zoom: 7.9, pitch: 0 });
      return;
    }
    // Berkshires to Boston, as specified in ATLAS.md 6.1, but at a shallower
    // pitch so the map still reads as a plan drawing rather than a flythrough.
    map.jumpTo({ center: [-73.1, 42.45], zoom: 7.6, pitch: 32, bearing: 12 });
    map.easeTo({
      center: [-71.4, 42.25],
      zoom: 7.9,
      pitch: 24,
      bearing: 0,
      duration: 3600,
      essential: true,
    });
  }, [ready, index]);

  /* ----------------------------------------------------- camera requests */
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !camera) return;
    const reduce = prefersReducedMotion();
    map.easeTo({
      center: [camera.lng, camera.lat],
      zoom: camera.zoom ?? map.getZoom(),
      duration: reduce ? 0 : 520,
      essential: true,
    });
  }, [camera, ready]);

  /* ------------------------------------------------------------- layers */
  const scored = React.useMemo(() => {
    if (!index) return [];
    return index.all;
  }, [index]);

  const nearestLinePoint = React.useMemo<LngLat | null>(() => {
    if (!selected || !transmission.data) return null;
    const requiredKv = presetFor(mw).requiredKv;
    let best: { d: number; pos: LngLat } | null = null;
    const origin: LngLat = [selected.lng, selected.lat];
    for (const f of transmission.data.features as Feature<LineString>[]) {
      const kv = (f.properties?.kv as number) ?? 0;
      if (kv < requiredKv) continue;
      if (f.geometry?.type !== "LineString") continue;
      // Cheap reject before the exact nearest-point computation.
      const [x0, y0] = f.geometry.coordinates[0];
      if (Math.abs(x0 - selected.lng) > 0.8 || Math.abs(y0 - selected.lat) > 0.8) continue;
      try {
        const snapped = nearestPointOnLine(f.geometry, origin, { units: "kilometers" });
        const d = snapped.properties?.dist ?? Infinity;
        if (!best || d < best.d) {
          const c = snapped.geometry.coordinates;
          best = { d, pos: [c[0], c[1]] };
        }
      } catch {
        /* skip malformed geometry */
      }
    }
    return best?.pos ?? null;
  }, [selected, transmission.data, mw]);

  const deckLayers = React.useMemo(() => {
    const out: unknown[] = [];

    /* --- basemap, drawn from local MassGIS geometry --------------------- */
    if (towns.data) {
      out.push(
        new GeoJsonLayer({
          id: "basemap-land",
          data: towns.data,
          stroked: true,
          filled: true,
          getFillColor: LAND_FILL,
          getLineColor: LAND_LINE,
          getLineWidth: 0.6,
          lineWidthUnits: "pixels",
          lineWidthMinPixels: 0.5,
        }),
      );
    }

    if (water.data) {
      out.push(
        new GeoJsonLayer({
          id: "basemap-water",
          data: water.data,
          stroked: true,
          filled: true,
          getFillColor: WATER_FILL,
          getLineColor: WATER_LINE,
          getLineWidth: 0.5,
          lineWidthUnits: "pixels",
        }),
      );
    }

    if (boundary.data) {
      out.push(
        new GeoJsonLayer({
          id: "ma-boundary",
          data: boundary.data,
          stroked: true,
          filled: false,
          getLineColor: STATE_LINE,
          getLineWidth: 1.4,
          lineWidthUnits: "pixels",
        }),
      );
    }

    if (layers.flood && flood.data) {
      out.push(
        new GeoJsonLayer({
          id: "flood",
          data: flood.data,
          stroked: true,
          filled: true,
          getFillColor: [226, 125, 119, 46],
          getLineColor: [226, 125, 119, 120],
          getLineWidth: 0.6,
          lineWidthUnits: "pixels",
        }),
      );
    }

    if (layers.protected && protectedLand.data) {
      out.push(
        new GeoJsonLayer({
          id: "protected",
          data: protectedLand.data,
          stroked: true,
          filled: true,
          getFillColor: [104, 196, 154, 40],
          getLineColor: [104, 196, 154, 110],
          getLineWidth: 0.6,
          lineWidthUnits: "pixels",
        }),
      );
    }

    if (layers.ej && ej.data) {
      out.push(
        new GeoJsonLayer({
          id: "ej",
          data: ej.data,
          stroked: true,
          filled: true,
          getFillColor: [230, 183, 101, 42],
          getLineColor: [230, 183, 101, 130],
          getLineWidth: 0.7,
          lineWidthUnits: "pixels",
        }),
      );
    }

    if (layers.hexes && scored.length) {
      out.push(
        new H3HexagonLayer({
          id: "suitability",
          data: scored,
          pickable: false,
          highPrecision: false,
          extruded: layers.extrude,
          elevationScale: 26,
          coverage: 0.94,
          getHexagon: (d: HexRecord) => d.h3,
          getFillColor: (d: HexRecord) => {
            const r = scoreFor(d);
            const [cr, cg, cb] = colorForScore(r.score, r.excluded);
            return [cr, cg, cb, r.excluded ? 52 : layers.extrude ? 190 : 104];
          },
          getElevation: (d: HexRecord) => {
            const r = scoreFor(d);
            return r.excluded ? 0 : (r.score ?? 0) * 10;
          },
          updateTriggers: {
            getFillColor: [mw, lens, cooling, layers.extrude],
            getElevation: [mw, lens, cooling],
          },
        }),
      );
    }

    if (layers.transmission && transmission.data) {
      out.push(
        new GeoJsonLayer({
          id: "transmission",
          data: transmission.data,
          stroked: true,
          filled: false,
          getLineColor: (f: Feature) => {
            const kv = (f.properties?.kv as number) ?? 0;
            if (kv >= 345) return [122, 198, 230, 235];
            if (kv >= 115) return [90, 150, 190, 205];
            return [76, 112, 140, 175];
          },
          getLineWidth: (f: Feature) => {
            const kv = (f.properties?.kv as number) ?? 0;
            return kv >= 345 ? 2 : kv >= 115 ? 1.3 : 0.8;
          },
          lineWidthUnits: "pixels",
          lineWidthMinPixels: 0.8,
        }),
      );
    }

    /* Town names, kept out of the way until the view is local enough that
       they aid orientation rather than add noise. */
    if (towns.data && zoom >= 9) {
      const labels = (towns.data.features as Feature[])
        .map((f) => ({
          name: (f.properties?.town as string) ?? "",
          position: [f.properties?.lng as number, f.properties?.lat as number] as LngLat,
        }))
        .filter((d) => d.name && Number.isFinite(d.position[0]));
      out.push(
        new TextLayer<{ name: string; position: LngLat }>({
          id: "town-labels",
          data: labels,
          getPosition: (d) => d.position,
          getText: (d) => d.name,
          getSize: 11,
          sizeUnits: "pixels",
          getColor: [156, 170, 182, 190],
          fontFamily: "Inter, system-ui, sans-serif",
          characterSet: "auto",
          getTextAnchor: "middle",
          getAlignmentBaseline: "center",
          outlineWidth: 2,
          outlineColor: [11, 15, 20, 220],
          fontSettings: { sdf: true },
        }),
      );
    }

    if (selected) {
      const ring = cellToBoundary(selected.h3).map(([lat, lng]) => [lng, lat] as LngLat);
      out.push(
        new PolygonLayer({
          id: "selected-cell",
          data: [{ polygon: ring }],
          stroked: true,
          filled: false,
          getPolygon: (d: { polygon: LngLat[] }) => d.polygon,
          getLineColor: [86, 201, 213, 255],
          getLineWidth: 2,
          lineWidthUnits: "pixels",
        }),
      );

      // Footprint scaled to the MW preset, as a plan figure rather than a tower.
      const sideM = Math.sqrt(mw * 1200);
      const dLat = sideM / 2 / 111_320;
      const dLng = dLat / Math.cos((selected.lat * Math.PI) / 180);
      out.push(
        new PolygonLayer({
          id: "footprint",
          data: [
            {
              polygon: [
                [selected.lng - dLng, selected.lat - dLat],
                [selected.lng + dLng, selected.lat - dLat],
                [selected.lng + dLng, selected.lat + dLat],
                [selected.lng - dLng, selected.lat + dLat],
              ] as LngLat[],
            },
          ],
          extruded: true,
          wireframe: true,
          getPolygon: (d: { polygon: LngLat[] }) => d.polygon,
          getElevation: Math.min(70, 14 + mw / 8),
          getFillColor: [86, 201, 213, 92],
          getLineColor: [86, 201, 213, 220],
        }),
      );

      // 1 km context ring.
      const circle: LngLat[] = Array.from({ length: 65 }, (_, i) => {
        const t = (i / 64) * Math.PI * 2;
        const km = 1;
        return [
          selected.lng + (km / 111.32 / Math.cos((selected.lat * Math.PI) / 180)) * Math.cos(t),
          selected.lat + (km / 110.574) * Math.sin(t),
        ];
      });
      out.push(
        new PathLayer<{ path: LngLat[] }>({
          id: "context-ring",
          data: [{ path: circle }],
          getPath: (d) => d.path,
          getColor: [156, 170, 182, 150],
          getWidth: 1,
          widthUnits: "pixels",
        }),
      );

      if (nearestLinePoint) {
        out.push(
          new ArcLayer<{ from: LngLat; to: LngLat }>({
            id: "grid-arc",
            data: [{ from: [selected.lng, selected.lat] as LngLat, to: nearestLinePoint }],
            getSourcePosition: (d) => d.from,
            getTargetPosition: (d) => d.to,
            getSourceColor: [86, 201, 213, 230],
            getTargetColor: [122, 198, 230, 230],
            getWidth: 1.6,
            getHeight: 0.35,
          }),
        );
      }
    }

    return out;
  }, [
    boundary.data,
    towns.data,
    water.data,
    zoom,
    layers,
    flood.data,
    protectedLand.data,
    ej.data,
    scored,
    transmission.data,
    selected,
    nearestLinePoint,
    mw,
    lens,
    cooling,
    scoreFor,
  ]);

  React.useEffect(() => {
    overlayRef.current?.setProps({ layers: deckLayers as never });
  }, [deckLayers]);

  return (
    <div className="relative min-w-0 flex-1">
      {/* Sized explicitly rather than with `absolute inset-0`: maplibre adds a
          `.maplibregl-map { position: relative }` rule to this node, which wins
          over the utility class and would leave the container zero-height. */}
      <div
        ref={container}
        className="h-full w-full"
        aria-label="Massachusetts screening map"
      />

      {hover && <HexTooltip hex={hover.hex} x={hover.x} y={hover.y} />}

      <MapLegend
        basemapFailed={Boolean(towns.error || water.error || boundary.error)}
        overlayState={{
          transmission: transmission,
          ej,
          protected: protectedLand,
          flood,
        }}
      />

      {(loading || !ready) && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[8px] border border-line bg-panel/95 px-4 py-3 text-[12px] text-muted">
          Loading the statewide screening grid…
        </div>
      )}
    </div>
  );
}

export type OverlayState = ReturnType<typeof useGeoJson>;
export type { FeatureCollection };
