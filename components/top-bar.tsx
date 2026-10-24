"use client";

import * as React from "react";
import { Columns2, Database, Download, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAtlas } from "./atlas-provider";
import { Button, SegmentedControl, Select } from "./ui/primitives";
import { InfoDot } from "./ui/info";
import { COOLING_LABEL, LENS_LABEL, MW_PRESETS } from "@/lib/weights";
import type { Cooling, Lens } from "@/lib/types";

export function TopBar({
  explorerOpen,
  onToggleExplorer,
  onOpenCompare,
  onOpenProvenance,
  onExport,
}: {
  explorerOpen: boolean;
  onToggleExplorer: () => void;
  onOpenCompare: () => void;
  onOpenProvenance: () => void;
  onExport: () => void;
}) {
  const { mw, setMw, cooling, setCooling, lens, setLens, pinned, meta } = useAtlas();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleExplorer}
        aria-label={explorerOpen ? "Hide the site explorer" : "Show the site explorer"}
        className="h-8 w-8 px-0"
      >
        {explorerOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
      </Button>

      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-[19px] font-semibold tracking-tight text-fg">Atlas</span>
        <span aria-hidden className="text-subtle">
          /
        </span>
        <span className="truncate text-[13px] text-muted">Massachusetts</span>
      </div>

      <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          <span className="overline hidden lg:inline">Size</span>
          <SegmentedControl
            label="Peak demand preset"
            value={mw}
            onChange={setMw}
            options={MW_PRESETS.map((p) => ({
              value: p.mw,
              label: `${p.mw} MW`,
              hint: `${p.name} — assumes a ${p.requiredKv} kV or higher connection; EO 658 ${
                p.eo658Applies ? "applies" : "does not apply"
              }`,
            }))}
          />
          <InfoDot
            side="bottom"
            content={
              <>
                Peak electric demand drives the required transmission voltage, the
                residents-nearby threshold and whether Executive Order 658 is engaged.
                The voltage thresholds are an Atlas modelling assumption, not an
                engineering rule.
              </>
            }
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="overline hidden lg:inline">Cooling</span>
          <Select<Cooling>
            label="Cooling design"
            value={cooling}
            onChange={setCooling}
            options={(Object.keys(COOLING_LABEL) as Cooling[]).map((c) => ({
              value: c,
              label: COOLING_LABEL[c],
            }))}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="overline hidden lg:inline">Lens</span>
          <SegmentedControl
            label="Scoring lens"
            value={lens}
            onChange={setLens}
            options={(Object.keys(LENS_LABEL) as Lens[]).map((l) => ({
              value: l,
              label: LENS_LABEL[l],
              hint:
                l === "balanced"
                  ? "Geometric mean of the two lenses"
                  : l === "resident"
                    ? "Weights community impact more heavily"
                    : "Weights buildability more heavily",
            }))}
          />
          <InfoDot
            side="bottom"
            content={
              <>
                The lens sets the exponent in <span className="num">B^a × C^(1−a)</span>:
                0.35 resident, 0.50 balanced, 0.65 developer. It never changes a
                measurement, only how the two lenses are combined.
              </>
            }
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={onOpenProvenance}>
          <Database size={14} aria-hidden />
          <span className="hidden md:inline">Sources</span>
        </Button>
        <Button
          variant={pinned.length >= 2 ? "primary" : "default"}
          size="sm"
          onClick={onOpenCompare}
          disabled={pinned.length < 2}
          title={
            pinned.length < 2
              ? "Pin at least two sites from the inspector to compare them"
              : `Compare ${pinned.length} pinned sites`
          }
        >
          <Columns2 size={14} aria-hidden />
          <span className="hidden md:inline">Compare</span>
          {pinned.length > 0 && <span className="num text-[11px]">{pinned.length}</span>}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onExport}
          disabled={!meta}
          title="Download the selected site's evidence as JSON"
        >
          <Download size={14} aria-hidden />
          <span className="hidden md:inline">Export</span>
        </Button>
      </div>
    </header>
  );
}
