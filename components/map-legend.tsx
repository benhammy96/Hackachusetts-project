"use client";

import * as React from "react";
import { AlertTriangle, ChevronDown, Layers, WifiOff } from "lucide-react";
import { useAtlas, type LayerToggles } from "./atlas-provider";
import { SegmentedControl, Toggle } from "./ui/primitives";
import { InfoDot } from "./ui/info";
import { BANDS, FATAL_BAND } from "@/lib/weights";

interface OverlayStatus {
  loading: boolean;
  error: string | null;
  data: unknown;
}

const OVERLAYS: {
  key: keyof LayerToggles;
  label: string;
  swatch: string;
  state?: keyof OverlayStateMap;
  note: string;
}[] = [
  {
    key: "ej",
    label: "EJ block groups",
    swatch: "#E6B765",
    state: "ej",
    note: "MassGIS 2020 Environmental Justice Populations. The layer contains only designated EJ block groups.",
  },
  {
    key: "protected",
    label: "Protected open space",
    swatch: "#68C49A",
    state: "protected",
    note: "MassGIS Protected and Recreational OpenSpace, permanently protected or Article 97. Generalised for display; the per-cell exclusion uses full resolution.",
  },
  {
    key: "flood",
    label: "FEMA 1% floodplain",
    swatch: "#E27D77",
    state: "flood",
    note: "FEMA National Flood Hazard Layer special flood hazard areas. Generalised for display; a preliminary screen, not a flood determination.",
  },
];

interface OverlayStateMap {
  transmission: OverlayStatus;
  ej: OverlayStatus;
  protected: OverlayStatus;
  flood: OverlayStatus;
}

type MapView = "2d" | "3d";

export function MapLegend({
  basemapFailed,
  streetsFailed,
  overlayState,
}: {
  basemapFailed: boolean;
  streetsFailed: boolean;
  overlayState: OverlayStateMap;
}) {
  const { layers, setLayer, meta } = useAtlas();
  // Closed by default: the map is the instrument, the layer list is a tool.
  const [open, setOpen] = React.useState(false);
  const [legendOpen, setLegendOpen] = React.useState(true);
  const activeOverlays = OVERLAYS.filter((o) => layers[o.key]).length;

  return (
    <>
      {(basemapFailed || streetsFailed) && (
        <div className="absolute left-3 top-3 z-10 flex max-w-[320px] flex-col gap-1.5">
          {basemapFailed && (
            <Notice>
              Part of the basemap geometry did not load. Scores are unaffected — they come
              from the grid file, not the basemap.
            </Notice>
          )}
          {streetsFailed && (
            <Notice>
              Street and building tiles could not load, so the 3D view is using the offline
              basemap. Scores are unaffected.
            </Notice>
          )}
        </div>
      )}

      {/* Score ramp. Colour is always paired with its label. */}
      <div className="absolute bottom-3 left-3 z-10 w-[244px] rounded-[8px] border border-line bg-panel/95">
        <div className="flex items-center justify-between gap-1 px-2.5 py-1.5">
          <button
            type="button"
            onClick={() => setLegendOpen((v) => !v)}
            aria-expanded={legendOpen}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <span className="overline">Suitability, 0–10</span>
            <ChevronDown
              size={12}
              aria-hidden
              className={`shrink-0 text-subtle transition-transform duration-150 ${legendOpen ? "" : "-rotate-90"}`}
            />
          </button>
          <InfoDot
            side="top"
            content={
              <>
                Colour and label both encode the band, so colour is never the only
                signal. Scores are a planning aid, not a permitting decision.
                {meta && (
                  <>
                    {" "}
                    The grid has {meta.hex_count.toLocaleString()} cells at H3 resolution{" "}
                    {meta.h3_resolution}; {meta.excluded_count.toLocaleString()} are excluded
                    by a hard screen.
                  </>
                )}
              </>
            }
          />
        </div>
        {legendOpen && (
          <ul className="space-y-1 px-2.5 pb-2">
            {BANDS.map((b) => (
              <LegendRow
                key={b.key}
                color={b.color}
                range={`${b.min.toFixed(1)}–${b.key === "strong" ? "10" : b.max.toFixed(1)}`}
                label={b.label}
              />
            ))}
            <LegendRow color={FATAL_BAND.color} range="0" label={FATAL_BAND.label} />
          </ul>
        )}
      </div>

      {/* View switch and layer control */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          <SegmentedControl<MapView>
            label="Map view"
            value={layers.mode3d ? "3d" : "2d"}
            onChange={(v) => setLayer("mode3d", v === "3d")}
            className="bg-panel/95"
            options={[
              { value: "2d", label: "2D", hint: "Flat screening map, works offline" },
              {
                value: "3d",
                label: "3D",
                hint: "Streets, place names and 3D buildings from OpenStreetMap",
              },
            ]}
          />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="map-layer-panel"
            className={`inline-flex h-8 items-center gap-1.5 rounded-[6px] border px-2.5 text-[12px] font-medium transition-colors duration-100 ${
              open
                ? "border-subtle bg-raised text-fg"
                : "border-line bg-panel/95 text-muted hover:border-subtle hover:text-fg"
            }`}
          >
            <Layers size={13} aria-hidden />
            Layers
            {activeOverlays > 0 && <span className="num text-[11px] text-accent">{activeOverlays}</span>}
            <ChevronDown
              size={12}
              aria-hidden
              className={`text-subtle transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {open && (
          <div
            id="map-layer-panel"
            className="w-[246px] rounded-[8px] border border-line bg-panel/95 p-1.5"
          >
            <Toggle
              label="Suitability grid"
              checked={layers.hexes}
              onChange={(v) => setLayer("hexes", v)}
            />
            <Toggle
              label="Extrude by score"
              checked={layers.extrude}
              onChange={(v) => setLayer("extrude", v)}
            />
            <div className="my-1 h-px bg-line" />
            {OVERLAYS.map((o) => {
              const st = o.state ? overlayState[o.state] : undefined;
              const on = layers[o.key];
              const detail =
                on && st?.loading ? "loading" : on && st?.error ? "failed" : undefined;
              return (
                <div key={o.key} className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <Toggle
                      label={o.label}
                      swatch={o.swatch}
                      checked={on}
                      onChange={(v) => setLayer(o.key, v)}
                      detail={detail}
                    />
                  </div>
                  <InfoDot side="left" content={o.note} label={`About ${o.label}`} />
                </div>
              );
            })}
            {OVERLAYS.some((o) => o.state && layers[o.key] && overlayState[o.state!].error) && (
              <p className="mt-1 flex items-start gap-1.5 px-1.5 pb-1 text-[10px] leading-snug text-warn">
                <AlertTriangle size={11} className="mt-px shrink-0" aria-hidden />
                An overlay failed to load. Scores are unaffected — they come from the
                grid file, not the overlays.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function LegendRow({ color, range, label }: { color: string; range: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-[11px]">
      <span aria-hidden className="h-2.5 w-4 shrink-0 rounded-[2px]" style={{ background: color }} />
      <span className="num w-[48px] shrink-0 whitespace-nowrap text-[10.5px] text-subtle">{range}</span>
      <span className="whitespace-nowrap text-muted">{label}</span>
    </li>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-[8px] border border-warn/40 bg-panel/97 px-2.5 py-2">
      <WifiOff size={13} className="mt-0.5 shrink-0 text-warn" aria-hidden />
      <p className="text-[11px] leading-snug text-muted">{children}</p>
    </div>
  );
}
