"use client";

import * as React from "react";
import {
  ChevronRight,
  Columns2,
  Command,
  Database,
  Download,
  Keyboard,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAtlas } from "./atlas-provider";
import { Button, Kbd, SegmentedControl, Select } from "./ui/primitives";
import { Hint, InfoDot } from "./ui/info";
import { titleCase } from "@/lib/format";
import { COOLING_LABEL, LENS_LABEL, MW_PRESETS } from "@/lib/weights";
import type { Cooling, Lens } from "@/lib/types";

export function TopBar({
  explorerOpen,
  onToggleExplorer,
  onOpenCompare,
  onOpenProvenance,
  onExport,
  onOpenCommand,
  onOpenShortcuts,
}: {
  explorerOpen: boolean;
  onToggleExplorer: () => void;
  onOpenCompare: () => void;
  onOpenProvenance: () => void;
  onExport: () => void;
  onOpenCommand: () => void;
  onOpenShortcuts: () => void;
}) {
  const { mw, setMw, cooling, setCooling, lens, setLens, pinned, meta, selected, select, resetView } =
    useAtlas();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-3">
      <Hint
        side="bottom"
        content={
          <span className="flex items-center gap-2">
            {explorerOpen ? "Hide the site explorer" : "Show the site explorer"} <Kbd>[</Kbd>
          </span>
        }
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleExplorer}
          aria-label={explorerOpen ? "Hide the site explorer" : "Show the site explorer"}
          aria-expanded={explorerOpen}
          className="h-8 w-8 px-0"
        >
          {explorerOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </Button>
      </Hint>

      {/* Breadcrumb: product / scope / selected town / cell */}
      <nav aria-label="Breadcrumb" className="min-w-0 shrink">
        <ol className="flex min-w-0 items-center gap-1.5">
          <li className="text-[19px] font-semibold tracking-tight text-fg">Atlas</li>
          <Crumb>
            <Hint side="bottom" content={<span className="flex items-center gap-2">Reset to the statewide view <Kbd>R</Kbd></span>}>
              <button
                onClick={resetView}
                aria-current={selected ? undefined : "page"}
                className={`rounded-[6px] px-1 text-[13px] hover:bg-raised hover:text-fg ${
                  selected ? "text-muted" : "text-fg"
                }`}
              >
                Massachusetts
              </button>
            </Hint>
          </Crumb>
          {selected && (
            <>
              <Crumb className="hidden min-[1440px]:flex">
                <button
                  onClick={() => select(selected.h3, { fly: true })}
                  title="Zoom to the selected cell (Z)"
                  className="max-w-[140px] truncate rounded-[6px] px-1 text-[13px] text-muted hover:bg-raised hover:text-fg"
                >
                  {titleCase(selected.town)}
                </button>
              </Crumb>
              <Crumb className="hidden 2xl:flex">
                <span aria-current="page" className="num truncate text-[11px] text-subtle">
                  {selected.h3}
                </span>
              </Crumb>
            </>
          )}
        </ol>
      </nav>

      <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="eyebrow hidden min-[1600px]:inline">Size</span>
          <SegmentedControl
            label="Peak demand preset"
            value={mw}
            onChange={setMw}
            options={MW_PRESETS.map((p, i) => ({
              value: p.mw,
              label: `${p.mw} MW`,
              hint: `${p.name} — assumes a ${p.requiredKv} kV or higher connection; EO 658 ${
                p.eo658Applies ? "applies" : "does not apply"
              }. Shortcut: ${i + 1}`,
            }))}
          />
          <InfoDot
            side="bottom"
            content={
              <>
                Peak electric demand drives the required transmission voltage, the
                residents-nearby threshold and whether Executive Order 658 is engaged.
                The voltage thresholds are an Atlas modelling assumption, not an
                engineering rule. Keys <Kbd>1</Kbd>–<Kbd>4</Kbd> switch presets.
              </>
            }
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="eyebrow hidden min-[1600px]:inline">Cooling</span>
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

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="eyebrow hidden min-[1600px]:inline">Lens</span>
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
        <button
          onClick={onOpenCommand}
          aria-label="Open the command menu"
          className="flex h-7 items-center gap-1.5 rounded-[6px] border border-line bg-raised/60 px-2 text-[11px] text-subtle transition-colors duration-100 hover:border-subtle hover:text-fg"
        >
          <Command size={12} aria-hidden />
          <span className="hidden min-[1600px]:inline">Commands</span>
          <Kbd>mod</Kbd>
          <Kbd>K</Kbd>
        </button>
        <Hint side="bottom" content={<span className="flex items-center gap-2">Keyboard shortcuts <Kbd>?</Kbd></span>}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenShortcuts}
            aria-label="Keyboard shortcuts"
            className="hidden h-7 w-7 px-0 min-[1440px]:inline-flex"
          >
            <Keyboard size={14} aria-hidden />
          </Button>
        </Hint>
        <div aria-hidden className="mx-0.5 hidden h-5 w-px bg-line min-[1440px]:block" />
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
              : `Compare ${pinned.length} pinned sites (C)`
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
          title="Download the selected site's evidence as JSON (E)"
        >
          <Download size={14} aria-hidden />
          <span className="hidden md:inline">Export</span>
        </Button>
      </div>
    </header>
  );
}

function Crumb({ children, className = "flex" }: { children: React.ReactNode; className?: string }) {
  return (
    <li className={`${className} min-w-0 items-center gap-1.5`}>
      <ChevronRight size={12} aria-hidden className="shrink-0 text-subtle" />
      {children}
    </li>
  );
}
