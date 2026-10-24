"use client";

import * as React from "react";
import { useAtlas } from "./atlas-provider";
import { LAND_CLASS_LABEL } from "@/lib/weights";
import { fmtKm, fmtScore, titleCase } from "@/lib/format";
import type { HexRecord } from "@/lib/types";

/** Lightweight hover readout: where, what, and how trustworthy. */
export function HexTooltip({ hex, x, y }: { hex: HexRecord; x: number; y: number }) {
  const { scoreFor, meta } = useAtlas();
  const r = scoreFor(hex);
  const areaKm2 = meta?.hex_area_km2 ?? 0.74;
  const acres = areaKm2 * 247.105;

  return (
    <div
      className="pointer-events-none absolute z-20 w-[246px] rounded-[8px] border border-line bg-panel/97 px-2.5 py-2 shadow-xl"
      style={{
        left: Math.min(x + 14, (typeof window !== "undefined" ? window.innerWidth : 1440) - 300),
        top: y + 14,
      }}
      role="status"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[12px] font-semibold text-fg">
          {titleCase(hex.town)}
        </span>
        <span className="num shrink-0 text-[13px] font-semibold" style={{ color: r.band.color }}>
          {r.excluded ? "0.0" : fmtScore(r.score)}
        </span>
      </div>
      <div className="mt-0.5 text-[11px]" style={{ color: r.band.color }}>
        {r.band.label}
      </div>

      <dl className="mt-1.5 space-y-0.5 text-[11px]">
        <Row label="Screening cell" value={`${areaKm2.toFixed(2)} km² · ${Math.round(acres)} acres`} />
        <Row
          label="Land use"
          value={
            hex.land_class
              ? `${LAND_CLASS_LABEL[hex.land_class]} (2016)`
              : (hex.land_cover_name ?? "Not available")
          }
        />
        <Row label="Nearest 115 kV+" value={fmtKm(hex.d_tx115_km)} />
        {hex.in_ej && <Row label="Environmental justice" value="EJ block group" tone="warn" />}
      </dl>

      {r.excluded && (
        <p className="mt-1.5 border-t border-line pt-1.5 text-[11px] text-unknown">
          {hex.exclude_reason}
        </p>
      )}
      <p className="mt-1.5 border-t border-line pt-1 text-[10px] text-subtle">
        Screening estimate · not a parcel · click to inspect
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-subtle">{label}</dt>
      <dd className={`num truncate text-right ${tone === "warn" ? "text-warn" : "text-muted"}`}>
        {value}
      </dd>
    </div>
  );
}
