"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Trash2, X } from "lucide-react";
import { useAtlas } from "./atlas-provider";
import { Button, StatusTag } from "./ui/primitives";
import { fmtInt, fmtKm, fmtUsd, titleCase } from "@/lib/format";
import {
  COOLING_LABEL,
  LAND_CLASS_LABEL,
  LENS_LABEL,
  presetFor,
} from "@/lib/weights";
import { defaultScenario, estimate } from "@/lib/economics";
import type { HexRecord, ScoreResult } from "@/lib/types";

interface Row {
  label: string;
  get: (h: HexRecord, r: ScoreResult, cost: number | null) => string;
  /** Lower raw value is better, for highlighting the difference. */
  compare?: (h: HexRecord, r: ScoreResult) => number | null;
  higherIsBetter?: boolean;
  tone?: (h: HexRecord, r: ScoreResult) => "warn" | "bad" | undefined;
}

const ROWS: Row[] = [
  {
    label: "Suitability",
    get: (_h, r) =>
      r.excluded ? "0.0 — fatal flaw" : `${(r.score ?? 0).toFixed(1)} / 10`,
    compare: (_h, r) => r.score,
    higherIsBetter: true,
  },
  {
    label: "Band",
    get: (_h, r) => r.band.label,
  },
  {
    label: "Buildability",
    get: (_h, r) => (r.buildability === null ? "—" : r.buildability.toFixed(1)),
    compare: (_h, r) => r.buildability,
    higherIsBetter: true,
  },
  {
    label: "Community",
    get: (_h, r) => (r.community === null ? "—" : r.community.toFixed(1)),
    compare: (_h, r) => r.community,
    higherIsBetter: true,
  },
  {
    label: "Nearest qualifying line",
    get: (h, r) => {
      const kv = presetFor(r.mw).requiredKv;
      const d =
        kv === 345 ? h.d_tx345_km : kv === 115 ? h.d_tx115_km : h.d_tx69_km;
      return `${fmtKm(d)} (${kv} kV+)`;
    },
    compare: (h, r) => {
      const kv = presetFor(r.mw).requiredKv;
      return kv === 345
        ? h.d_tx345_km
        : kv === 115
          ? h.d_tx115_km
          : h.d_tx69_km;
    },
  },
  {
    label: "Grid capacity",
    get: () => "Unverified",
    tone: () => "warn",
  },
  {
    label: "Land class, 2016",
    get: (h) =>
      h.land_class ? LAND_CLASS_LABEL[h.land_class] : "Not available",
  },
  {
    label: "Zoning",
    get: () => "Unknown",
    tone: () => "warn",
  },
  {
    label: "Availability",
    get: () => "Unknown — not a parcel",
    tone: () => "warn",
  },
  {
    label: "Residents within 1 km",
    get: (h) => fmtInt(h.pop_1km),
    compare: (h) => h.pop_1km,
  },
  {
    label: "EJ block group",
    get: (h) =>
      h.in_ej
        ? `Yes — ${h.ej_criteria ?? "designated"}`
        : h.near_ej_1mi
          ? `Within 1 mile (${fmtKm(h.d_ej_km)})`
          : `Nearest ${fmtKm(h.d_ej_km)}`,
    tone: (h) => (h.in_ej ? "bad" : h.near_ej_1mi ? "warn" : undefined),
  },
  {
    label: "Flood hazard",
    get: (h) =>
      h.flood_100yr === null
        ? "Not screened"
        : h.flood_100yr
          ? "1% annual chance"
          : h.flood_500yr
            ? "0.2% annual chance"
            : "Outside mapped hazard",
    tone: (h) => (h.flood_100yr ? "bad" : h.flood_500yr ? "warn" : undefined),
  },
  {
    label: "Sea level rise ≤3 ft",
    get: (h) =>
      h.coastal_slr === null
        ? "Not screened"
        : h.coastal_slr
          ? "Exposed"
          : "Outside",
    tone: (h) => (h.coastal_slr ? "warn" : undefined),
  },
  {
    label: "Drinking water Zone II",
    get: (h) => fmtKm(h.d_dw_zone2_km),
    compare: (h) => h.d_dw_zone2_km,
    higherIsBetter: true,
  },
  {
    label: "Modelled annual power",
    get: (_h, _r, cost) => (cost === null ? "—" : fmtUsd(cost)),
  },
  {
    label: "Unresolved, critical",
    get: (_h, r) =>
      String(r.unresolved.filter((u) => u.severity === "critical").length),
    tone: () => "warn",
  },
];

export function SiteCompare({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const {
    index,
    pinned,
    togglePin,
    clearPins,
    scoreFor,
    mw,
    cooling,
    lens,
    assumptions,
    select,
  } = useAtlas();

  const sites = React.useMemo(() => {
    if (!index) return [];
    return pinned
      .map((h3) => index.get(h3))
      .filter((h): h is HexRecord => Boolean(h))
      .map((hex) => ({
        hex,
        result: scoreFor(hex),
        cost: assumptions
          ? estimate(
              defaultScenario(assumptions, mw, cooling === "evaporative"),
            ).annualElectricityUsd
          : null,
      }));
  }, [index, pinned, scoreFor, assumptions, mw, cooling]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[86vh] w-[min(900px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[10px] border border-line bg-panel shadow-2xl outline-none">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <Dialog.Title className="text-[14px] font-semibold text-fg">
                Compare sites
              </Dialog.Title>
              <p className="mt-0.5 text-[11px] text-subtle">
                Same units, same rows, same {mw} MW{" "}
                {COOLING_LABEL[cooling].toLowerCase()} design under the{" "}
                {LENS_LABEL[lens]} lens. Unresolved constraints stay visible for
                every site.
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button variant="ghost" size="sm" onClick={clearPins}>
                <Trash2 size={12} aria-hidden /> Clear
              </Button>
              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 px-0"
                  aria-label="Close"
                >
                  <X size={14} aria-hidden />
                </Button>
              </Dialog.Close>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-[12px]">
              <caption className="sr-only">
                Side-by-side comparison of pinned screening cells
              </caption>
              <thead className="sticky top-0 z-10 bg-panel">
                <tr>
                  <th
                    scope="col"
                    className="w-[190px] border-b border-line px-3 py-2 text-left"
                  >
                    <span className="eyebrow">Measure</span>
                  </th>
                  {sites.map((s) => (
                    <th
                      key={s.hex.h3}
                      scope="col"
                      className="border-b border-line px-3 py-2 text-left align-top"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => {
                            select(s.hex.h3, { fly: true });
                            onOpenChange(false);
                          }}
                          className="min-w-0 text-left"
                        >
                          <span className="block truncate text-[13px] font-semibold text-fg hover:text-accent">
                            {titleCase(s.hex.town)}
                          </span>
                        </button>
                        <button
                          onClick={() => togglePin(s.hex.h3)}
                          aria-label={`Unpin ${s.hex.town ?? "site"}`}
                          className="shrink-0 text-subtle hover:text-bad"
                        >
                          <X size={12} aria-hidden />
                        </button>
                      </div>
                      <span
                        className="num mt-1 block text-[20px] font-semibold"
                        style={{ color: s.result.band.color }}
                      >
                        {s.result.excluded
                          ? "0.0"
                          : (s.result.score ?? 0).toFixed(1)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const values = sites.map(
                    (s) => row.compare?.(s.hex, s.result) ?? null,
                  );
                  const valid = values.filter((v): v is number => v !== null);
                  const best =
                    valid.length > 1
                      ? row.higherIsBetter
                        ? Math.max(...valid)
                        : Math.min(...valid)
                      : null;
                  return (
                    <tr key={row.label} className="border-b border-line/60">
                      <th
                        scope="row"
                        className="px-3 py-1.5 text-left align-top font-normal text-subtle"
                      >
                        {row.label}
                      </th>
                      {sites.map((s, i) => {
                        const tone = row.tone?.(s.hex, s.result);
                        const isBest = best !== null && values[i] === best;
                        return (
                          <td
                            key={s.hex.h3}
                            className={`num px-3 py-1.5 align-top ${
                              tone === "bad"
                                ? "text-bad"
                                : tone === "warn"
                                  ? "text-warn"
                                  : isBest
                                    ? "font-semibold text-ok"
                                    : "text-muted"
                            }`}
                          >
                            {row.get(s.hex, s.result, s.cost)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="shrink-0 border-t border-line px-4 py-2.5">
            <div className="flex items-center gap-2">
              <StatusTag status="modeled" />
              <p className="text-[10.5px] leading-snug text-subtle">
                Green marks the better value on rows where a direction is
                meaningful. It does not mean the site is suitable. Scores are a
                planning aid, not a permitting decision.
              </p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
