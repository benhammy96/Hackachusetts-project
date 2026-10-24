"use client";

import * as React from "react";
import {
  loadAssumptions,
  defaultScenario,
  type Assumptions,
  type Scenario,
} from "@/lib/economics";
import { loadHexData, type DataMeta, type HexIndex } from "@/lib/hexes";
import { score } from "@/lib/score";
import type { Cooling, HexRecord, Lens, ScoreResult } from "@/lib/types";

export interface LayerToggles {
  hexes: boolean;
  extrude: boolean;
  transmission: boolean;
  ej: boolean;
  protected: boolean;
  flood: boolean;
}

export interface ExplorerFilters {
  query: string;
  landClasses: string[];
  excludeFloodplain: boolean;
  excludeEj: boolean;
  maxGridKm: number | null;
}

export interface CameraTarget {
  lat: number;
  lng: number;
  zoom?: number;
  nonce: number;
}

interface AtlasState {
  /* data */
  index: HexIndex | null;
  meta: DataMeta | null;
  assumptions: Assumptions | null;
  loading: boolean;
  error: string | null;

  /* screening settings */
  mw: number;
  cooling: Cooling;
  lens: Lens;
  setMw: (v: number) => void;
  setCooling: (v: Cooling) => void;
  setLens: (v: Lens) => void;

  /* selection */
  selected: HexRecord | null;
  selectedScore: ScoreResult | null;
  select: (h3: string | null, opts?: { fly?: boolean }) => void;
  selectAt: (lat: number, lng: number) => "selected" | "outside";

  /* pins for comparison */
  pinned: string[];
  togglePin: (h3: string) => void;
  clearPins: () => void;

  /* layers and camera */
  layers: LayerToggles;
  setLayer: (k: keyof LayerToggles, v: boolean) => void;
  camera: CameraTarget | null;
  flyTo: (lat: number, lng: number, zoom?: number) => void;

  /* explorer */
  filters: ExplorerFilters;
  setFilters: (f: Partial<ExplorerFilters>) => void;

  /* cost scenario */
  scenario: Scenario | null;
  setScenarioOverride: (patch: Partial<Scenario>) => void;

  scoreFor: (hex: HexRecord) => ScoreResult;
}

const Ctx = React.createContext<AtlasState | null>(null);

export function useAtlas(): AtlasState {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useAtlas must be used inside <AtlasProvider>");
  return v;
}

export function AtlasProvider({ children }: { children: React.ReactNode }) {
  const [index, setIndex] = React.useState<HexIndex | null>(null);
  const [meta, setMeta] = React.useState<DataMeta | null>(null);
  const [assumptions, setAssumptions] = React.useState<Assumptions | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [mw, setMw] = React.useState(100);
  const [cooling, setCooling] = React.useState<Cooling>("evaporative");
  const [lens, setLens] = React.useState<Lens>("balanced");

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pinned, setPinned] = React.useState<string[]>([]);
  const [camera, setCamera] = React.useState<CameraTarget | null>(null);
  const nonce = React.useRef(0);

  const [layers, setLayers] = React.useState<LayerToggles>({
    hexes: true,
    extrude: false,
    // No UI toggle any more; the transmission overlay stays off. The grid-access
    // arc to the nearest qualifying line is driven separately by the selection.
    transmission: false,
    ej: false,
    protected: false,
    flood: false,
  });

  const [filters, setFiltersState] = React.useState<ExplorerFilters>({
    query: "",
    landClasses: [],
    excludeFloodplain: false,
    excludeEj: false,
    maxGridKm: null,
  });

  const [override, setOverride] = React.useState<Partial<Scenario>>({});

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [data, a] = await Promise.all([loadHexData(), loadAssumptions()]);
        if (!alive) return;
        setIndex(data.index);
        setMeta(data.meta);
        setAssumptions(a);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const flyTo = React.useCallback((lat: number, lng: number, zoom?: number) => {
    nonce.current += 1;
    setCamera({ lat, lng, zoom, nonce: nonce.current });
  }, []);

  const select = React.useCallback(
    (h3: string | null, opts?: { fly?: boolean }) => {
      setSelectedId(h3);
      if (h3 && opts?.fly && index) {
        const hex = index.get(h3);
        if (hex) flyTo(hex.lat, hex.lng, 12.5);
      }
    },
    [index, flyTo],
  );

  const selectAt = React.useCallback(
    (lat: number, lng: number): "selected" | "outside" => {
      if (!index) return "outside";
      const hex = index.at(lat, lng);
      if (!hex) return "outside";
      setSelectedId(hex.h3);
      return "selected";
    },
    [index],
  );

  const selected = selectedId && index ? (index.get(selectedId) ?? null) : null;

  const scoreFor = React.useCallback(
    (hex: HexRecord) => score({ hex, mw, cooling, lens }),
    [mw, cooling, lens],
  );

  const selectedScore = React.useMemo(
    () => (selected ? scoreFor(selected) : null),
    [selected, scoreFor],
  );

  const scenario = React.useMemo<Scenario | null>(() => {
    if (!assumptions) return null;
    return { ...defaultScenario(assumptions, mw, cooling === "evaporative"), ...override };
  }, [assumptions, mw, cooling, override]);

  const value: AtlasState = {
    index,
    meta,
    assumptions,
    loading,
    error,
    mw,
    cooling,
    lens,
    setMw,
    setCooling,
    setLens,
    selected,
    selectedScore,
    select,
    selectAt,
    pinned,
    togglePin: React.useCallback((h3: string) => {
      setPinned((p) =>
        p.includes(h3) ? p.filter((x) => x !== h3) : p.length >= 3 ? p : [...p, h3],
      );
    }, []),
    clearPins: React.useCallback(() => setPinned([]), []),
    layers,
    setLayer: React.useCallback(
      (k, v) => setLayers((s) => ({ ...s, [k]: v })),
      [],
    ),
    camera,
    flyTo,
    filters,
    setFilters: React.useCallback(
      (f) => setFiltersState((s) => ({ ...s, ...f })),
      [],
    ),
    scenario,
    setScenarioOverride: React.useCallback(
      (patch) => setOverride((o) => ({ ...o, ...patch })),
      [],
    ),
    scoreFor,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
