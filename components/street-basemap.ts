/**
 * Opt-in street basemap for the 3D view: roads, street names, places and
 * extruded OpenStreetMap buildings.
 *
 * The default 2D map stays fully offline (see atlas-map.tsx). This layer set is
 * only added to the style the first time someone switches to 3D, so no tile
 * request is made until then. Tiles come from OpenFreeMap's public instance,
 * which needs no key or account. If it cannot be reached, the map falls back to
 * the local MassGIS basemap and says so.
 *
 * Colours are the Atlas tokens shifted a few steps, so the basemap stays a quiet
 * backdrop and the suitability colours remain the only strong signal.
 */

import type { LayerSpecification, Map as MlMap } from "maplibre-gl";

export const STREETS_SOURCE_ID = "atlas-streets";
const STREETS_TILEJSON = "https://tiles.openfreemap.org/planet";
export const STREETS_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const STREETS_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

/**
 * Ground-level deck layers (grid, overlays) are drawn just beneath water, so
 * water and roads stay readable above the score tint, as in the 2D map.
 */
export const STREETS_GROUND_BEFORE = "st-water";
/** 3D deck layers are drawn beneath the first label so names stay on top. */
export const STREETS_LABEL_BEFORE = "st-label-water";

/** Buildings appear from this zoom; below it the 3D view is roads and places only. */
export const BUILDINGS_MIN_ZOOM = 13.5;

const SRC = { source: STREETS_SOURCE_ID } as const;
const HIDDEN = { visibility: "none" } as const;
const FONT_REGULAR = ["Noto Sans Regular"];
const FONT_BOLD = ["Noto Sans Bold"];
const FONT_ITALIC = ["Noto Sans Italic"];
const HALO = "#0B0F14";

/** Line width that grows with zoom, roughly doubling every zoom level. */
const width = (stops: [number, number][]) =>
  ["interpolate", ["exponential", 1.5], ["zoom"], ...stops.flat()] as never;

const name = ["coalesce", ["get", "name:en"], ["get", "name"]] as never;

function poiLayer(id: string, minzoom: number, rankFilter: unknown[]): LayerSpecification {
  return {
    id,
    type: "symbol",
    source: STREETS_SOURCE_ID,
    "source-layer": "poi",
    minzoom,
    filter: ["all", ["has", "name"], ["!=", ["get", "class"], "bus"], rankFilter] as never,
    layout: {
      visibility: "none",
      "text-field": name,
      "text-font": ["Noto Sans Regular"],
      "text-size": 10.5,
      "text-max-width": 8,
      "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
    },
    paint: { "text-color": "#7F8E9B", "text-halo-color": "#0B0F14", "text-halo-width": 1.2 },
  };
}

const LAYERS: LayerSpecification[] = [
  {
    id: "st-background",
    type: "background",
    layout: HIDDEN,
    paint: { "background-color": "#10161D" },
  },
  {
    id: "st-landuse",
    type: "fill",
    ...SRC,
    "source-layer": "landuse",
    layout: HIDDEN,
    paint: {
      "fill-color": [
        "match",
        ["get", "class"],
        ["industrial", "railway"],
        "#151B22",
        ["commercial", "retail"],
        "#141B23",
        ["residential", "suburb", "neighbourhood"],
        "#131A21",
        "#121920",
      ],
    },
  },
  {
    id: "st-landcover",
    type: "fill",
    ...SRC,
    "source-layer": "landcover",
    filter: ["in", ["get", "class"], ["literal", ["wood", "grass", "wetland", "farmland"]]],
    layout: HIDDEN,
    paint: {
      "fill-color": ["match", ["get", "class"], "wetland", "#111A1F", "#121D1A"],
      "fill-opacity": 0.85,
    },
  },
  {
    id: "st-park",
    type: "fill",
    ...SRC,
    "source-layer": "park",
    layout: HIDDEN,
    paint: { "fill-color": "#13201B", "fill-opacity": 0.9 },
  },
  {
    id: "st-aeroway",
    type: "fill",
    ...SRC,
    "source-layer": "aeroway",
    minzoom: 11,
    filter: ["==", ["geometry-type"], "Polygon"],
    layout: HIDDEN,
    paint: { "fill-color": "#161E27" },
  },

  {
    id: "st-water",
    type: "fill",
    ...SRC,
    "source-layer": "water",
    layout: HIDDEN,
    paint: { "fill-color": "#12374B", "fill-outline-color": "#539EBE" },
  },
  {
    id: "st-waterway",
    type: "line",
    ...SRC,
    "source-layer": "waterway",
    minzoom: 10,
    layout: HIDDEN,
    paint: { "line-color": "#1F5A75", "line-width": width([[10, 0.5], [18, 4]]) },
  },
  /* --- roads ----------------------------------------------------------- */
  {
    id: "st-road-path",
    type: "line",
    ...SRC,
    "source-layer": "transportation",
    minzoom: 15,
    filter: ["in", ["get", "class"], ["literal", ["path", "track"]]],
    layout: { ...HIDDEN, "line-cap": "round" },
    paint: {
      "line-color": "#1F2933",
      "line-width": width([[15, 0.6], [18, 1.6]]),
      "line-dasharray": [2, 2],
    },
  },
  {
    id: "st-road-service",
    type: "line",
    ...SRC,
    "source-layer": "transportation",
    minzoom: 14,
    filter: ["==", ["get", "class"], "service"],
    layout: { ...HIDDEN, "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#1E2832", "line-width": width([[14, 0.5], [18, 5]]) },
  },
  {
    id: "st-road-minor",
    type: "line",
    ...SRC,
    "source-layer": "transportation",
    minzoom: 11,
    filter: ["==", ["get", "class"], "minor"],
    layout: { ...HIDDEN, "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#24303B",
      "line-width": width([[11, 0.4], [14, 1.6], [18, 11]]),
    },
  },
  {
    id: "st-rail",
    type: "line",
    ...SRC,
    "source-layer": "transportation",
    minzoom: 12,
    filter: ["in", ["get", "class"], ["literal", ["rail", "transit"]]],
    layout: HIDDEN,
    paint: {
      "line-color": "#2B3541",
      "line-width": width([[12, 0.6], [18, 2]]),
      "line-dasharray": [3, 2],
    },
  },
  {
    id: "st-road-major",
    type: "line",
    ...SRC,
    "source-layer": "transportation",
    minzoom: 7,
    filter: ["in", ["get", "class"], ["literal", ["primary", "secondary", "tertiary", "trunk"]]],
    layout: { ...HIDDEN, "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["match", ["get", "class"], ["primary", "trunk"], "#33414F", "#2B3845"],
      "line-width": width([[7, 0.4], [12, 1.6], [18, 16]]),
    },
  },
  {
    id: "st-road-motorway",
    type: "line",
    ...SRC,
    "source-layer": "transportation",
    minzoom: 5,
    filter: ["==", ["get", "class"], "motorway"],
    layout: { ...HIDDEN, "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#3E4E5D",
      "line-width": width([[5, 0.5], [10, 1.6], [18, 20]]),
    },
  },

  /* --- buildings ------------------------------------------------------- */
  {
    id: "st-building-3d",
    type: "fill-extrusion",
    ...SRC,
    "source-layer": "building",
    minzoom: BUILDINGS_MIN_ZOOM,
    filter: ["!=", ["get", "hide_3d"], true],
    layout: HIDDEN,
    paint: {
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "render_height"], 0],
        0,
        "#1C2631",
        25,
        "#222E3A",
        90,
        "#2A3847",
        220,
        "#344658",
      ],
      // Grow from the ground over the first zoom level so buildings rise in
      // rather than popping on.
      "fill-extrusion-height": [
        "interpolate",
        ["linear"],
        ["zoom"],
        BUILDINGS_MIN_ZOOM,
        0,
        BUILDINGS_MIN_ZOOM + 1,
        ["coalesce", ["get", "render_height"], 0],
      ],
      "fill-extrusion-base": [
        "interpolate",
        ["linear"],
        ["zoom"],
        BUILDINGS_MIN_ZOOM,
        0,
        BUILDINGS_MIN_ZOOM + 1,
        ["coalesce", ["get", "render_min_height"], 0],
      ],
      "fill-extrusion-opacity": 0.92,
    },
  },

  /* --- labels ---------------------------------------------------------- */
  {
    id: "st-label-water",
    type: "symbol",
    ...SRC,
    "source-layer": "water_name",
    minzoom: 11,
    filter: ["==", ["geometry-type"], "Point"],
    layout: {
      ...HIDDEN,
      "text-field": name,
      "text-font": FONT_ITALIC,
      "text-size": 11,
      "text-max-width": 8,
    },
    paint: { "text-color": "#7BBED8", "text-halo-color": HALO, "text-halo-width": 1.2 },
  },
  {
    id: "st-label-road",
    type: "symbol",
    ...SRC,
    "source-layer": "transportation_name",
    minzoom: 13,
    filter: [
      "in",
      ["get", "class"],
      // Service roads are left unnamed: in Boston they are mostly "Public Alley"s.
      ["literal", ["primary", "secondary", "tertiary", "minor", "trunk"]],
    ],
    layout: {
      ...HIDDEN,
      "symbol-placement": "line",
      "text-field": name,
      "text-font": FONT_REGULAR,
      "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 18, 13],
      "text-max-angle": 30,
      "symbol-spacing": 320,
    },
    paint: { "text-color": "#93A1AD", "text-halo-color": HALO, "text-halo-width": 1.4 },
  },
  {
    id: "st-label-highway",
    type: "symbol",
    ...SRC,
    "source-layer": "transportation_name",
    minzoom: 9,
    filter: [
      "all",
      ["in", ["get", "class"], ["literal", ["motorway", "trunk"]]],
      ["has", "ref"],
    ],
    layout: {
      ...HIDDEN,
      "symbol-placement": "line",
      "text-field": ["get", "ref"],
      "text-font": FONT_BOLD,
      "text-size": 10,
      "symbol-spacing": 420,
    },
    paint: { "text-color": "#AEB9C2", "text-halo-color": HALO, "text-halo-width": 1.6 },
  },
  // Landmarks only at first (OpenMapTiles rank ≤ 6 is the most notable few per
  // tile), more as you zoom in. Bus stops are left out: they are the bulk of
  // the POI layer in a city and turn the map into a timetable.
  poiLayer("st-label-poi", 15.5, ["<=", ["coalesce", ["get", "rank"], 99], 6]),
  poiLayer("st-label-poi-minor", 17, [">", ["coalesce", ["get", "rank"], 99], 6]),
  {
    id: "st-label-neighbourhood",
    type: "symbol",
    ...SRC,
    "source-layer": "place",
    minzoom: 12,
    filter: [
      "in",
      ["get", "class"],
      ["literal", ["suburb", "quarter", "neighbourhood", "hamlet", "locality"]],
    ],
    layout: {
      ...HIDDEN,
      "text-field": name,
      "text-font": FONT_REGULAR,
      "text-size": 10.5,
      "text-transform": "uppercase",
      "text-letter-spacing": 0.08,
      "text-max-width": 7,
    },
    paint: { "text-color": "#7A8996", "text-halo-color": HALO, "text-halo-width": 1.4 },
  },
  {
    id: "st-label-place",
    type: "symbol",
    ...SRC,
    "source-layer": "place",
    minzoom: 6,
    filter: ["in", ["get", "class"], ["literal", ["city", "town", "village"]]],
    layout: {
      ...HIDDEN,
      "text-field": name,
      "text-font": ["match", ["get", "class"], "city", ["literal", FONT_BOLD], ["literal", FONT_REGULAR]] as never,
      "text-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        ["match", ["get", "class"], "city", 13, "town", 11, 10],
        14,
        ["match", ["get", "class"], "city", 17, "town", 14, 12],
      ],
      "text-max-width": 8,
      "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
    },
    paint: { "text-color": "#C5CED6", "text-halo-color": HALO, "text-halo-width": 1.6 },
  },
];

const LAYER_IDS = LAYERS.map((l) => l.id);

/**
 * Adds the street source and layers once, hidden, beneath any deck.gl layer
 * groups already in the stack so the overlay keeps drawing on top.
 */
export function ensureStreetLayers(map: MlMap): void {
  if (!map.getSource(STREETS_SOURCE_ID)) {
    map.addSource(STREETS_SOURCE_ID, {
      type: "vector",
      url: STREETS_TILEJSON,
      attribution: STREETS_ATTRIBUTION,
    });
  }
  const deckGroup = map.getLayersOrder().find((id) => id.startsWith("deck-maplibre-layer-group"));
  for (const layer of LAYERS) {
    if (!map.getLayer(layer.id)) map.addLayer(layer, deckGroup);
  }
}

export function setStreetLayersVisible(map: MlMap, visible: boolean): void {
  for (const id of LAYER_IDS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}
