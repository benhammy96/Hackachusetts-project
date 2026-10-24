"use client";

import * as React from "react";
import { AlertTriangle, Layers, WifiOff } from "lucide-react";
import { useAtlas, type LayerToggles } from "./atlas-provider";
import { Button, Toggle } from "./ui/primitives";
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
    key: "streets",
    label: "Streets",
    swatch: "#8193A3",
    note: "Live MassGIS Base Streets vector tiles, shown for map context only. Local streets appear as you zoom in. This layer requires a network connection and does not affect the score.",
  },
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

export function MapLegend({
  basemapFailed,
  overlayState,
}: {
  basemapFailed: boolean;
  overlayState: OverlayStateMap;
}) {
  const { layers, setLayer, meta } = useAtlas();
  const [open, setOpen] = React.useState(true);

  return (
    <>
      {basemapFailed && (
        <div className="absolute left-3 top-[72px] z-10 flex max-w-[320px] items-start gap-2 rounded-[8px] border border-warn/40 bg-panel/97 px-2.5 py-2">
          <WifiOff
            size={13}
            className="mt-0.5 shrink-0 text-warn"
            aria-hidden
          />
          <p className="text-[11px] leading-snug text-muted">
            Part of the basemap geometry did not load. Scores are unaffected —
            they come from the grid file, not the basemap.
          </p>
        </div>
      )}

      {/* Score ramp */}
      <div className="absolute bottom-3 left-3 z-10 w-[218px] rounded-[8px] border border-line bg-panel/95 p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="eyebrow">Suitability, 0–10</span>
          <InfoDot
            side="top"
            content={
              <>
                Colour and label both encode the band, so colour is never the
                only signal. Scores are a planning aid, not a permitting
                decision.
              </>
            }
          />
        </div>
        <ul className="space-y-1">
          {BANDS.map((b) => (
            <li key={b.key} className="flex items-center gap-2 text-[11px]">
              <span
                aria-hidden
                className="h-2.5 w-4 shrink-0 rounded-[2px]"
                style={{ background: b.color }}
              />
              <span className="num w-[52px] shrink-0 text-subtle">
                {b.min.toFixed(1)}–
                {b.key === "strong" ? "10" : b.max.toFixed(1)}
              </span>
              <span className="truncate text-muted">{b.label}</span>
            </li>
          ))}
          <li className="flex items-center gap-2 text-[11px]">
            <span
              aria-hidden
              className="h-2.5 w-4 shrink-0 rounded-[2px]"
              style={{ background: FATAL_BAND.color }}
            />
            <span className="num w-[52px] shrink-0 text-subtle">0</span>
            <span className="truncate text-muted">{FATAL_BAND.label}</span>
          </li>
        </ul>
        {meta && (
          <p className="mt-2 border-t border-line pt-1.5 text-[10px] leading-snug text-subtle">
            {meta.hex_count.toLocaleString()} cells · H3 res{" "}
            {meta.h3_resolution} · {meta.excluded_count.toLocaleString()}{" "}
            excluded by a hard screen
          </p>
        )}
      </div>

      {/* Layer control */}
      <div className="absolute right-3 top-3 z-10 w-[246px]">
        <div className="rounded-[8px] border border-line bg-panel/95">
          <div className="flex items-center justify-between px-2.5 py-2">
            <span className="eyebrow flex items-center gap-1.5">
              <Layers size={12} aria-hidden /> Layers
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px]"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              {open ? "Hide" : "Show"}
            </Button>
          </div>

          {open && (
            <div className="border-t border-line p-1.5">
              <Toggle
                label="Suitability grid"
                checked={layers.hexes}
                onChange={(v) => setLayer("hexes", v)}
              />
              <Toggle
                label="Extrude by score"
                checked={layers.extrude}
                onChange={(v) => setLayer("extrude", v)}
                detail="3D"
              />
              <div className="flex min-h-[32px] items-center gap-2 px-1.5 py-1">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-[#539ebe] bg-[#12374b]"
                />
                <span className="min-w-0 flex-1 text-[12px] text-fg">
                  Open water
                </span>
                <span className="eyebrow shrink-0">Mapped</span>
              </div>
              <div className="my-1 h-px bg-line" />
              {OVERLAYS.map((o) => {
                const st = o.state ? overlayState[o.state] : undefined;
                const on = layers[o.key];
                const detail =
                  on && st?.loading
                    ? "loading"
                    : on && st?.error
                      ? "failed"
                      : undefined;
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
                    <InfoDot
                      side="left"
                      content={o.note}
                      label={`About ${o.label}`}
                    />
                  </div>
                );
              })}
              {OVERLAYS.some(
                (o) => o.state && layers[o.key] && overlayState[o.state!].error,
              ) && (
                <p className="mt-1 flex items-start gap-1.5 px-1.5 pb-1 text-[10px] leading-snug text-warn">
                  <AlertTriangle
                    size={11}
                    className="mt-px shrink-0"
                    aria-hidden
                  />
                  An overlay failed to load. Scores are unaffected — they come
                  from the grid file, not the overlays.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
