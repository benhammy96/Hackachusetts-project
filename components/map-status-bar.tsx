"use client";

import * as React from "react";
import { useAtlas } from "./atlas-provider";
import { Kbd, StatusTag } from "./ui/primitives";
import { fmtScore } from "@/lib/format";
import type { HexRecord } from "@/lib/types";

export type MapViewMode = "2d" | "3d" | "3d-offline";

const VIEW_LABEL: Record<MapViewMode, string> = {
  "2d": "2D plan",
  "3d": "3D streets",
  "3d-offline": "3D · offline basemap",
};

function fmtCoord(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}° ${
    lng >= 0 ? "E" : "W"
  }`;
}

/**
 * The instrument readout under the map: view mode, cursor position, the cell
 * under the cursor, and the camera. Read-only, so it is a status region rather
 * than a toolbar, and it is not announced on every mouse move.
 */
export function MapStatusBar({
  mode,
  cursor,
  hoverHex,
  zoom,
  pitch,
  bearing,
}: {
  mode: MapViewMode;
  cursor: { lat: number; lng: number } | null;
  hoverHex: HexRecord | null;
  zoom: number;
  pitch: number;
  bearing: number;
}) {
  const { scoreFor } = useAtlas();
  const r = hoverHex ? scoreFor(hoverHex) : null;

  return (
    <div
      role="status"
      aria-live="off"
      aria-label="Map status"
      className="flex h-6 shrink-0 items-stretch border-t border-line bg-panel text-[10.5px] text-subtle"
    >
      <Cell className={mode === "3d-offline" ? "text-warn" : "text-muted"}>{VIEW_LABEL[mode]}</Cell>
      <Cell className="num w-[176px]">{cursor ? fmtCoord(cursor.lat, cursor.lng) : "Cursor off map"}</Cell>
      <Cell className="num min-w-0 flex-1">
        {hoverHex && r ? (
          <span className="truncate">
            cell {hoverHex.h3}
            <span className="ml-2" style={{ color: r.band.color }}>
              {r.excluded ? "0.0 / 10 fatal flaw" : `${fmtScore(r.score)} / 10`}
            </span>
            <StatusTag status="modeled" className="ml-2 text-[10px]" />
          </span>
        ) : (
          <span className="truncate">No cell under cursor</span>
        )}
      </Cell>
      <Cell className="num">
        z {zoom.toFixed(1)} · pitch {Math.round(pitch)}° · bearing {Math.round(((bearing % 360) + 360) % 360)}°
      </Cell>
      <div className="hidden shrink-0 items-center gap-2 px-2 2xl:flex">
        <span className="flex items-center gap-1">
          <Kbd>mod</Kbd>
          <Kbd>K</Kbd>
          <span>commands</span>
        </span>
        <span className="flex items-center gap-1">
          <Kbd>?</Kbd>
          <span>shortcuts</span>
        </span>
      </div>
    </div>
  );
}

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex shrink-0 items-center border-r border-line px-2 ${className}`}>{children}</div>
  );
}
