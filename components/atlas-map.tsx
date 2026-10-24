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
import {
  GeoJsonLayer,
  PathLayer,
  PolygonLayer,
  TextLayer,
} from "@deck.gl/layers";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { cellToBoundary } from "h3-js";
import type { Feature, FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

/** deck.gl accessors want fixed-length tuples, not GeoJSON's number[]. */
type LngLat = [number, number];
type ElevatedLngLat = [number, number, number];

import { useAtlas } from "./atlas-provider";
import { useGeoJson, prefersReducedMotion } from "./use-geojson";
import { MapLegend } from "./map-legend";
import { MapStatusBar } from "./map-status-bar";
import {
  BUILDINGS_MIN_ZOOM,
  STREETS_GLYPHS,
  STREETS_GROUND_BEFORE,
  STREETS_LABEL_BEFORE,
  STREETS_SOURCE_ID,
  ensureStreetLayers,
  setStreetLayersVisible,
} from "./street-basemap";
import { colorForScore } from "@/lib/score";
import { titleCase } from "@/lib/format";
import type { HexRecord } from "@/lib/types";

const ATTRIBUTION = [
  '<a href="https://www.mass.gov/orgs/massgis-bureau-of-geographic-information" target="_blank" rel="noreferrer">MassGIS</a> · FEMA NFHL · US Census',
  'Transmission © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
];

/**
 * The default 2D map has no tile-service dependency.
 *
 * UI_DESIGN.md section 6 asks for a custom low-noise dark basemap, and
 * ATLAS.md requires the demo to work without a live external API. So the
 * basemap is drawn from the same MassGIS geometry the pipeline downloads:
 * water, town boundaries and the state outline, all shipped as static GeoJSON.
 * Nothing here needs a key.
 *
 * One optional 3D view uses live OpenStreetMap roads, place names and
 * buildings, falling back to this basemap if they cannot load. `glyphs` is
 * fetched only when those street labels render.
 */
const STYLE: StyleSpecification = {
  version: 8,
  glyphs: STREETS_GLYPHS,
  sources: {},
  layers: [
    // The canvas outside Massachusetts is predominantly Atlantic water. Town
    // polygons paint the Commonwealth's land above this background.
    { id: "bg", type: "background", paint: { "background-color": "#0D2230" } },
  ],
};

/** Back Bay to the Financial District: the Prudential, Copley and State Street. */
const BOSTON_3D: { center: LngLat; zoom: number } = {
  center: [-71.068, 42.3535],
  zoom: 15.1,
};
const PITCH_3D = 58;
const BEARING_3D = -24;

/**
 * Flat layers all lie on the ground plane. Sharing MapLibre's depth buffer,
 * coplanar polygons z-fight and the grid speckles, so they skip the depth test
 * and draw in stack order. Only extruded geometry is depth-tested.
 */
const FLAT = {
  parameters: { depthCompare: "always", depthWriteEnabled: false },
} as const;

/* Basemap palette: charcoal land and clearly visible, subdued blue water. */
const LAND_FILL: [number, number, number, number] = [23, 30, 38, 255];
const LAND_LINE: [number, number, number, number] = [45, 58, 70, 220];
const WATER_FILL: [number, number, number, number] = [18, 55, 75, 255];
const WATER_LINE: [number, number, number, number] = [83, 158, 190, 245];
const STATE_LINE: [number, number, number, number] = [86, 104, 120, 235];

const MA_CENTER: [number, number] = [-71.8, 42.15];

/** Below this zoom the map labels counties; at or above it, towns. */
const TOWN_LABEL_ZOOM = 9;
/** Below this zoom, with nothing hovered or selected, the readout says "statewide". */
const STATEWIDE_ZOOM = 8.2;
const WATER_LABEL_ZOOM = 11;

interface TownInfo {
  name: string;
  county: string | null;
  feature: Feature;
}

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
    pinned,
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
  const [hover, setHover] = React.useState<HexRecord | null>(null);
  const flownIn = React.useRef(false);
  const [cursor, setCursor] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [view, setView] = React.useState({ pitch: 0, bearing: 0 });
  /** Town under the map centre, kept for the location readout. */
  const [centerTown, setCenterTown] = React.useState<string | null | undefined>(
    undefined,
  );

  /* 3D street view state. Refs mirror values the camera effects read without
     re-running on every selection change. */
  const [streetsAdded, setStreetsAdded] = React.useState(false);
  const [streetsFailed, setStreetsFailed] = React.useState(false);
  const streetsLoadedOnce = React.useRef(false);
  const mode3dRef = React.useRef(layers.mode3d);
  const prevMode3d = React.useRef(layers.mode3d);
  const selectedRef = React.useRef(selected);
  mode3dRef.current = layers.mode3d;
  selectedRef.current = selected;

  // The 3D view's OpenStreetMap tiles replace the local basemap only once they
  // are in the style and have not failed; otherwise the offline basemap stays.
  const osmStreets = layers.mode3d && streetsAdded && !streetsFailed;

  // Transmission is needed both as an overlay and to draw the arc from a
  // selected site to the nearest qualifying line, so it loads up front.
  const transmission = useGeoJson("/data/layers/transmission.geojson", true);
  const boundary = useGeoJson("/data/layers/ma-boundary.geojson", true);
  const towns = useGeoJson("/data/layers/towns.geojson", true);
  const water = useGeoJson("/data/layers/water.geojson", true);
  const ej = useGeoJson("/data/layers/ej.geojson", layers.ej);
  const protectedLand = useGeoJson(
    "/data/layers/protected.geojson",
    layers.protected,
  );
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
      maxZoom: 18,
      minZoom: 5.5,
      attributionControl: { compact: true, customAttribution: ATTRIBUTION },
      dragRotate: true,
    });
    mapRef.current = map;

    map.addControl(
      new NavigationControl({ visualizePitch: true }),
      "bottom-right",
    );
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    // Interleaved so deck layers share MapLibre's depth buffer: the grid can sit
    // beneath roads and labels, and 3D buildings correctly hide what is behind
    // them. If the browser cannot share a WebGL2 context, fall back to drawing
    // deck on its own canvas over the map, which is how the 2D map always worked.
    let overlay: MapLibreOverlay;
    try {
      overlay = new MapLibreOverlay({ interleaved: true, layers: [] });
      map.addControl(overlay);
    } catch {
      overlay = new MapLibreOverlay({ interleaved: false, layers: [] });
      map.addControl(overlay);
    }
    overlayRef.current = overlay;

    map.on("load", () => setReady(true));
    map.on("zoom", () => setZoom(map.getZoom()));
    let viewFrame = 0;
    map.on("move", () => {
      if (viewFrame) return;
      viewFrame = requestAnimationFrame(() => {
        viewFrame = 0;
        setView({ pitch: map.getPitch(), bearing: map.getBearing() });
      });
    });
    // Frames can be skipped while a tab is in the background; settle exactly.
    map.on("moveend", () =>
      setView({ pitch: map.getPitch(), bearing: map.getBearing() }),
    );

    // A street tile failure before any tile has loaded means the service is
    // unreachable, so fall back to the offline basemap. A later one-off tile
    // error just leaves a gap and is not worth abandoning the view over.
    map.on("sourcedata", (e) => {
      if (e.sourceId === STREETS_SOURCE_ID && e.tile)
        streetsLoadedOnce.current = true;
    });
    map.on("error", (e) => {
      const sourceId = (e as unknown as { sourceId?: string }).sourceId;
      if (sourceId === STREETS_SOURCE_ID && !streetsLoadedOnce.current) {
        setStreetsFailed(true);
        setStreetLayersVisible(map, false);
      }
    });

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
      setHover(index.at(e.lngLat.lat, e.lngLat.lng) ?? null);
      setCursor({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    };

    const onLeave = () => {
      setHover(null);
      setCursor(null);
    };

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

  /* ------------------------------------------- town under the map centre */
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !index) return;
    const update = () => {
      const c = map.getCenter();
      setCenterTown(index.at(c.lat, c.lng)?.town ?? null);
    };
    update();
    map.on("moveend", update);
    return () => {
      map.off("moveend", update);
    };
  }, [ready, index]);

  /* ----------------------------------------------------- opening fly-in */
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !index || flownIn.current) return;
    flownIn.current = true;
    // Someone already took the camera to 3D before the grid finished loading;
    // the statewide fly-in would only drag it back.
    if (mode3dRef.current) return;
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

  /* ------------------------------------------------------ 3D street view */
  // Switching to 3D adds the street tiles and buildings (once), shows them
  // and tilts the camera toward something worth seeing:
  // the selected cell, the area already in view, or downtown Boston. Switching
  // back hides them and returns to a plan view. Selection, tooltips and
  // overlays work from lng/lat and the H3 index, so tilt does not affect them.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (prevMode3d.current === layers.mode3d) return; // not on first load
    prevMode3d.current = layers.mode3d;
    const reduce = prefersReducedMotion();

    if (layers.mode3d) {
      if (!streetsFailed) {
        try {
          ensureStreetLayers(map);
          setStreetLayersVisible(map, true);
          setStreetsAdded(true);
        } catch {
          setStreetsFailed(true);
        }
      }
      const sel = selectedRef.current;
      const z = map.getZoom();
      const target = sel
        ? { center: [sel.lng, sel.lat] as LngLat, zoom: Math.max(z, 15.4) }
        : z >= 10
          ? {
              center: map.getCenter().toArray() as LngLat,
              zoom: Math.max(z, 15),
            }
          : BOSTON_3D;
      const view = { ...target, pitch: PITCH_3D, bearing: BEARING_3D };
      if (reduce) map.jumpTo(view);
      else map.flyTo({ ...view, duration: 1400, essential: true });
      return;
    }

    setStreetLayersVisible(map, false);
    const flat = { pitch: 0, bearing: 0 };
    if (reduce) map.jumpTo(flat);
    else map.easeTo({ ...flat, duration: 520, essential: true });
  }, [layers.mode3d, ready, streetsFailed]);

  /* ----------------------------------------------------- camera requests */
  // Declared after the 3D effect on purpose. When one action both leaves 3D and
  // asks for a view (reset to statewide), this runs last, so its camera wins.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !camera) return;
    const reduce = prefersReducedMotion();
    // In 3D, selections land close enough to see the buildings around the cell.
    const requested = camera.zoom ?? map.getZoom();
    map.easeTo({
      center: [camera.lng, camera.lat],
      zoom: mode3dRef.current ? Math.max(requested, 15.2) : requested,
      // Selections level the camera in 2D; 3D keeps its tilt. An explicit
      // request (reset to statewide) always wins.
      ...(camera.pitch !== undefined
        ? { pitch: camera.pitch }
        : mode3dRef.current
          ? {}
          : { pitch: 0 }),
      ...(camera.bearing !== undefined
        ? { bearing: camera.bearing }
        : mode3dRef.current
          ? {}
          : { bearing: 0 }),
      duration: reduce ? 0 : 520,
      essential: true,
    });
  }, [camera, ready]);

  /* ------------------------------------------------------------- layers */
  const scored = React.useMemo(() => {
    if (!index) return [];
    return index.all;
  }, [index]);

  /* Town polygons keyed by the upper-case name the grid uses, plus one label
     point per county (the mean of its town label points). */
  const townLookup = React.useMemo(() => {
    const byName = new Map<string, TownInfo>();
    const counties = new Map<string, { sx: number; sy: number; n: number }>();
    for (const f of (towns.data?.features ?? []) as Feature[]) {
      const name = f.properties?.town as string | undefined;
      if (!name) continue;
      const county = (f.properties?.county as string | undefined) ?? null;
      byName.set(name.toUpperCase(), { name, county, feature: f });
      const lng = f.properties?.lng as number;
      const lat = f.properties?.lat as number;
      if (county && Number.isFinite(lng) && Number.isFinite(lat)) {
        const c = counties.get(county) ?? { sx: 0, sy: 0, n: 0 };
        c.sx += lng;
        c.sy += lat;
        c.n += 1;
        counties.set(county, c);
      }
    }
    const countyLabels = [...counties.entries()].map(([county, c]) => ({
      name: county.toUpperCase(),
      position: [c.sx / c.n, c.sy / c.n, 100] as ElevatedLngLat,
    }));
    const waterLabels = [...((water.data?.features ?? []) as Feature[])]
      .map((f) => ({
        name: (f.properties?.name as string | null) ?? "",
        position: featureLabelPosition(f, 100),
      }))
      .filter((d): d is { name: string; position: ElevatedLngLat } =>
        Boolean(d.name && d.position),
      );
    return { byName, countyLabels, waterLabels };
  }, [towns.data, water.data]);

  const hoverTownKey = hover?.town ?? null;
  const hoveredH3 = hover?.h3 ?? null;
  const selectedTownKey = selected?.town ?? null;

  const deckLayers = React.useMemo(() => {
    const out: unknown[] = [];

    // With street tiles showing, ground-level layers go beneath the roads and
    // 3D layers beneath the labels, so the map reads like a map and names stay
    // legible. `beforeId` is the interleaved overlay's slot in MapLibre's stack.
    const ground = osmStreets ? { beforeId: STREETS_GROUND_BEFORE } : {};
    const belowLabels = osmStreets ? { beforeId: STREETS_LABEL_BEFORE } : {};

    /* --- basemap, drawn from local MassGIS geometry --------------------- */
    // Replaced by the street tiles in 3D; kept as the fallback if they fail.
    if (towns.data && !osmStreets) {
      out.push(
        new GeoJsonLayer({
          id: "basemap-land",
          ...FLAT,
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

    if (layers.flood && flood.data) {
      out.push(
        new GeoJsonLayer({
          id: "flood",
          ...FLAT,
          ...ground,
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
          ...FLAT,
          ...ground,
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
          ...FLAT,
          ...ground,
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
          // Flat, it is a ground tint beneath the roads; extruded, it stands with
          // the buildings and is depth-tested against them.
          ...(layers.extrude ? belowLabels : { ...ground, ...FLAT }),
          data: scored,
          pickable: false,
          highPrecision: false,
          extruded: layers.extrude,
          // Among real buildings, columns are kept to building scale (≤150 m)
          // rather than the kilometre-tall statewide presentation.
          elevationScale: osmStreets ? 1.5 : 26,
          // Seamless at state zoom so the grid reads as one surface, with fine
          // gaps once individual cells are worth telling apart.
          coverage: zoom < 10 ? 1 : 0.94,
          material: {
            ambient: 0.6,
            diffuse: 0.55,
            shininess: 24,
            specularColor: [40, 52, 62],
          },
          getHexagon: (d: HexRecord) => d.h3,
          getFillColor: (d: HexRecord) => {
            const r = scoreFor(d);
            const [cr, cg, cb] = colorForScore(r.score, r.excluded);
            if (r.excluded) return [cr, cg, cb, osmStreets ? 44 : 52];
            return [cr, cg, cb, layers.extrude ? 205 : osmStreets ? 86 : 104];
          },
          getElevation: (d: HexRecord) => {
            const r = scoreFor(d);
            // Fatal flaws stay flat (ATLAS.md: an exclusion scores exactly 0).
            if (r.excluded || r.score === null) return 0;
            // A gentle power curve spreads the top of the range so strong sites
            // stand clearly above workable ones instead of a near-linear ramp.
            return Math.pow(r.score / 10, 1.35) * 100;
          },
          updateTriggers: {
            getFillColor: [mw, lens, cooling, layers.extrude, osmStreets],
            getElevation: [mw, lens, cooling],
          },
        }),
      );
    }

    if (water.data && !osmStreets) {
      // Redraw water above the score grid. Water cells remain hoverable because
      // pointer lookup uses H3 coordinates rather than deck.gl picking.
      out.push(
        new GeoJsonLayer({
          id: "water-detail",
          ...FLAT,
          data: water.data,
          stroked: true,
          filled: true,
          getFillColor: WATER_FILL,
          getLineColor: WATER_LINE,
          getLineWidth: 0.85,
          lineWidthUnits: "pixels",
          lineWidthMinPixels: 0.65,
          lineJointRounded: true,
          lineCapRounded: true,
        }),
      );
    }

    if (towns.data) {
      out.push(
        new GeoJsonLayer({
          id: "town-boundaries",
          ...FLAT,
          ...ground,
          data: towns.data,
          stroked: true,
          filled: false,
          getLineColor: LAND_LINE,
          getLineWidth: 0.8,
          lineWidthUnits: "pixels",
          lineWidthMinPixels: 0.6,
        }),
      );
    }

    if (boundary.data) {
      out.push(
        new GeoJsonLayer({
          id: "ma-boundary",
          ...FLAT,
          ...ground,
          data: boundary.data,
          stroked: true,
          filled: false,
          getLineColor: STATE_LINE,
          getLineWidth: 1.4,
          lineWidthUnits: "pixels",
        }),
      );
    }

    if (layers.transmission && transmission.data) {
      out.push(
        new GeoJsonLayer({
          id: "transmission",
          ...FLAT,
          ...belowLabels,
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

    if (pinned.length) {
      const pinnedCells = pinned.map((h3) => ({
        h3,
        polygon: cellToBoundary(h3).map(([lat, lng]) => [lng, lat] as LngLat),
      }));
      out.push(
        new PolygonLayer<{ h3: string; polygon: LngLat[] }>({
          id: "pinned-cells",
          ...FLAT,
          ...belowLabels,
          data: pinnedCells,
          stroked: true,
          filled: true,
          getPolygon: (d) => d.polygon,
          getFillColor: [86, 201, 213, 70],
          getLineColor: [86, 201, 213, 255],
          getLineWidth: 2,
          lineWidthUnits: "pixels",
        }),
      );
    }

    /* Outline only the town under the pointer. Selection is indicated by the
       footprint and inspector, without a persistent blue boundary. */
    const hoverTown =
      hoverTownKey && hoverTownKey !== selectedTownKey
        ? townLookup.byName.get(hoverTownKey)
        : undefined;
    if (hoverTown) {
      out.push(
        new GeoJsonLayer({
          id: "town-hover",
          ...FLAT,
          ...belowLabels,
          data: [hoverTown.feature],
          stroked: true,
          filled: true,
          getFillColor: [240, 243, 245, 16],
          getLineColor: [240, 243, 245, 170],
          getLineWidth: 1.4,
          lineWidthUnits: "pixels",
        }),
      );
    }

    if (hoveredH3) {
      const ring = cellToBoundary(hoveredH3).map(
        ([lat, lng]) => [lng, lat] as LngLat,
      );
      out.push(
        new PolygonLayer({
          id: "hovered-cell",
          ...FLAT,
          ...belowLabels,
          data: [{ polygon: ring }],
          stroked: true,
          filled: true,
          getPolygon: (d: { polygon: LngLat[] }) => d.polygon,
          getFillColor: [240, 243, 245, 28],
          getLineColor: [240, 243, 245, 245],
          getLineWidth: 2.5,
          lineWidthUnits: "pixels",
        }),
      );
    }

    const labelStyle = {
      sizeUnits: "pixels" as const,
      fontFamily: "Inter, system-ui, sans-serif",
      characterSet: "auto" as const,
      getTextAnchor: "middle" as const,
      getAlignmentBaseline: "center" as const,
      billboard: true,
      outlineWidth: 3,
      outlineColor: [11, 15, 20, 230] as [number, number, number, number],
      fontSettings: { sdf: true },
    };

    /* Statewide: county names give regional orientation. Local: town names.
       Never both, so the map stays quiet. The 3D view's street tiles carry
       their own place and water names, so these step aside while it shows. */
    if (
      zoom < TOWN_LABEL_ZOOM &&
      townLookup.countyLabels.length &&
      !osmStreets
    ) {
      out.push(
        new TextLayer<{ name: string; position: ElevatedLngLat }>({
          id: "county-labels",
          ...FLAT,
          data: townLookup.countyLabels,
          getPosition: (d) => d.position,
          getText: (d) => d.name,
          getSize: 10.5,
          getColor: [156, 170, 182, 165],
          fontWeight: 600,
          ...labelStyle,
        }),
      );
    }

    if (towns.data && zoom >= TOWN_LABEL_ZOOM && !osmStreets) {
      const labels = (towns.data.features as Feature[])
        .map((f) => ({
          key: ((f.properties?.town as string) ?? "").toUpperCase(),
          name: (f.properties?.town as string) ?? "",
          position: [
            f.properties?.lng as number,
            f.properties?.lat as number,
            100,
          ] as ElevatedLngLat,
        }))
        .filter((d) => d.name && Number.isFinite(d.position[0]));
      out.push(
        new TextLayer<{
          key: string;
          name: string;
          position: ElevatedLngLat;
        }>({
          id: "town-labels",
          ...FLAT,
          data: labels,
          getPosition: (d) => d.position,
          getText: (d) => d.name,
          getSize: (d) =>
            d.key === selectedTownKey || d.key === hoverTownKey ? 13 : 11.5,
          getColor: (d) =>
            d.key === selectedTownKey
              ? [86, 201, 213, 255]
              : d.key === hoverTownKey
                ? [240, 243, 245, 245]
                : [156, 170, 182, 200],
          updateTriggers: {
            getSize: [selectedTownKey, hoverTownKey],
            getColor: [selectedTownKey, hoverTownKey],
          },
          ...labelStyle,
        }),
      );
    }

    if (
      zoom >= WATER_LABEL_ZOOM &&
      townLookup.waterLabels.length &&
      !osmStreets
    ) {
      out.push(
        new TextLayer<{ name: string; position: ElevatedLngLat }>({
          id: "water-labels",
          ...FLAT,
          data: townLookup.waterLabels,
          getPosition: (d) => d.position,
          getText: (d) => d.name,
          getSize: 10.5,
          getColor: [123, 190, 216, 225],
          maxWidth: 160,
          ...labelStyle,
        }),
      );
    }

    if (selected) {
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
          wireframe: false,
          getPolygon: (d: { polygon: LngLat[] }) => d.polygon,
          getElevation: Math.min(70, 14 + mw / 8),
          getFillColor: [86, 201, 213, 92],
        }),
      );

      // 1 km context ring.
      const circle: LngLat[] = Array.from({ length: 65 }, (_, i) => {
        const t = (i / 64) * Math.PI * 2;
        const km = 1;
        return [
          selected.lng +
            (km / 111.32 / Math.cos((selected.lat * Math.PI) / 180)) *
              Math.cos(t),
          selected.lat + (km / 110.574) * Math.sin(t),
        ];
      });
      out.push(
        new PathLayer<{ path: LngLat[] }>({
          id: "context-ring",
          ...FLAT,
          data: [{ path: circle }],
          getPath: (d) => d.path,
          getColor: [156, 170, 182, 150],
          getWidth: 1,
          widthUnits: "pixels",
        }),
      );
    }

    return out;
  }, [
    boundary.data,
    towns.data,
    townLookup,
    hoveredH3,
    selectedTownKey,
    water.data,
    zoom,
    layers,
    flood.data,
    protectedLand.data,
    ej.data,
    scored,
    transmission.data,
    selected,
    pinned,
    mw,
    lens,
    cooling,
    scoreFor,
    osmStreets,
  ]);

  React.useEffect(() => {
    const overlay = overlayRef.current;
    const map = mapRef.current;
    overlay?.setProps({ layers: deckLayers as never });
    // The interleaved overlay can only slot its layer groups into MapLibre's
    // stack while the style is fully loaded. Right after the street tiles are
    // added it is not, so place them again once the map has settled.
    if (!overlay || !map || map.isStyleLoaded()) return;
    const resync = () => overlay.setProps({ layers: [...deckLayers] as never });
    map.once("idle", resync);
    return () => {
      map.off("idle", resync);
    };
  }, [deckLayers]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        {/* Sized explicitly rather than with `absolute inset-0`: maplibre adds a
            `.maplibregl-map { position: relative }` rule to this node, which wins
            over the utility class and would leave the container zero-height. */}
        <div
          ref={container}
          className="h-full w-full"
          aria-label="Massachusetts screening map"
        />

        {ready && index && (
          <LocationReadout
            {...(hover
              ? {
                  context: "",
                  town: lookupTown(townLookup.byName, hover.town),
                }
              : selected
                ? {
                    context: "Selected site",
                    town: lookupTown(townLookup.byName, selected.town),
                  }
                : zoom < STATEWIDE_ZOOM
                  ? { context: "Statewide view", town: null, statewide: true }
                  : {
                      context: "Map centre",
                      town: lookupTown(townLookup.byName, centerTown ?? null),
                    })}
          />
        )}

        {osmStreets && zoom < BUILDINGS_MIN_ZOOM && (
          <div
            role="status"
            className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-[6px] border border-line bg-panel/95 px-2.5 py-1 text-[11px] text-muted"
          >
            Zoom in to see buildings
          </div>
        )}

        <MapLegend
          basemapFailed={Boolean(towns.error || water.error || boundary.error)}
          streetsFailed={layers.mode3d && streetsFailed}
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

      <MapStatusBar
        mode={layers.mode3d ? (streetsFailed ? "3d-offline" : "3d") : "2d"}
        cursor={cursor}
        hoverHex={hover}
        zoom={zoom}
        pitch={view.pitch}
        bearing={view.bearing}
      />
    </div>
  );
}

function featureLabelPosition(
  feature: Feature,
  elevation = 0,
): ElevatedLngLat | null {
  const bounds = {
    minLng: Infinity,
    minLat: Infinity,
    maxLng: -Infinity,
    maxLat: -Infinity,
  };
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      bounds.minLng = Math.min(bounds.minLng, value[0]);
      bounds.maxLng = Math.max(bounds.maxLng, value[0]);
      bounds.minLat = Math.min(bounds.minLat, value[1]);
      bounds.maxLat = Math.max(bounds.maxLat, value[1]);
      return;
    }
    value.forEach(visit);
  };
  visit(
    "coordinates" in feature.geometry ? feature.geometry.coordinates : null,
  );
  if (!Number.isFinite(bounds.minLng)) return null;
  return [
    (bounds.minLng + bounds.maxLng) / 2,
    (bounds.minLat + bounds.maxLat) / 2,
    elevation,
  ];
}

function lookupTown(
  byName: Map<string, TownInfo>,
  key: string | null,
): { name: string; county: string | null } | null {
  if (!key) return null;
  const t = byName.get(key);
  return t
    ? { name: t.name, county: t.county }
    : { name: titleCase(key), county: null };
}

/** Top-left "you are here": the town and county the map is showing. */
function LocationReadout({
  context,
  town,
  statewide,
}: {
  context: string;
  town: { name: string; county: string | null } | null;
  statewide?: boolean;
}) {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[min(280px,calc(100%-276px))] rounded-[8px] sm:min-w-[188px] border border-line bg-panel/95 px-3 py-2">
      {context && <div className="eyebrow">{context}</div>}
      {town ? (
        <div className="mt-0.5 flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-[15px] font-semibold text-fg">
            {town.name}
          </span>
          {town.county && (
            <span className="shrink-0 text-[12px] text-muted">
              {town.county} County
            </span>
          )}
        </div>
      ) : (
        <div className="mt-0.5 text-[15px] font-semibold text-fg">
          {statewide ? "Massachusetts" : "Outside the screening grid"}
        </div>
      )}
    </div>
  );
}

export type OverlayState = ReturnType<typeof useGeoJson>;
export type { FeatureCollection };
