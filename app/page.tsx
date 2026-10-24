"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { AtlasProvider, useAtlas } from "@/components/atlas-provider";
import { TooltipProvider } from "@/components/ui/info";
import { TopBar } from "@/components/top-bar";
import { SiteExplorer } from "@/components/site-explorer";
import { SiteInspector } from "@/components/site-inspector";
import { BriefPanel } from "@/components/brief-panel";
import { SiteCompare } from "@/components/site-compare";
import { DataProvenance } from "@/components/data-provenance";
import { CommandMenu, type Command } from "@/components/command-menu";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { useHotkeys } from "@/components/use-hotkeys";
import { eo658Checklist } from "@/lib/eo658";
import { COOLING_LABEL, LENS_LABEL, MW_PRESETS } from "@/lib/weights";
import type { Cooling } from "@/lib/types";

// MapLibre and deck.gl touch the DOM and WebGL on import.
const AtlasMap = dynamic(
  () => import("@/components/atlas-map").then((m) => m.AtlasMap),
  {
    ssr: false,
    loading: () => (
      <div className="relative min-w-0 flex-1 bg-bg">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[12px] text-subtle">
          Preparing the map…
        </div>
      </div>
    ),
  },
);

export default function Page() {
  return (
    <AtlasProvider>
      <TooltipProvider>
        <Shell />
      </TooltipProvider>
    </AtlasProvider>
  );
}

function Shell() {
  const atlas = useAtlas();
  const { error, selected, selectedScore, meta, mw, cooling, lens, scenario } =
    atlas;
  const [explorerOpen, setExplorerOpen] = React.useState(true);
  const [briefOpen, setBriefOpen] = React.useState(false);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [sourcesOpen, setSourcesOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  // Bumped to ask a panel to do something it owns: run "Find better" in the
  // inspector, or focus the explorer's town search.
  const [findBetterSignal, setFindBetterSignal] = React.useState(0);
  const [searchSignal, setSearchSignal] = React.useState(0);

  // The map must keep at least half the width, and the explorer gives way
  // before the map does (UI_DESIGN.md section 5). At 1280 the explorer plus
  // inspector would leave the map exactly at the floor, so collapse below 1360.
  React.useEffect(() => {
    const check = () => setExplorerOpen(window.innerWidth >= 1360);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const onExport = () => {
    if (!selected || !selectedScore) {
      toast("Select a site first", {
        description:
          "Export writes the selected cell's evidence and its sources.",
      });
      return;
    }
    const payload = {
      exported_at: new Date().toISOString(),
      disclaimer:
        "Atlas screening output. Preliminary geospatial screens, not legal or engineering determinations.",
      settings: { mw, cooling, lens },
      cell: selected,
      score: selectedScore,
      cost_scenario: scenario,
      eo658: eo658Checklist(mw),
      data_vintage: meta
        ? {
            generated_at: meta.generated_at,
            sources: meta.sources,
            fields: meta.fields,
          }
        : null,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-${selected.town?.toLowerCase().replace(/\s+/g, "-") ?? "site"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Evidence exported", {
      description: "Includes every source and vintage.",
    });
  };

  /* ---------------------------------------------------------- actions */
  const focusSearch = () => {
    if (!explorerOpen) setExplorerOpen(true);
    // After the explorer has mounted, so the input exists.
    setTimeout(() => setSearchSignal((n) => n + 1), 0);
  };
  const need = (fn: () => void) => () => {
    if (selected) fn();
    else
      toast("Select a site first", {
        description: "Click a cell on the map or a row in the explorer.",
      });
  };
  const zoomToSelected = need(() => atlas.select(selected!.h3, { fly: true }));
  const pinSelected = need(() => atlas.togglePin(selected!.h3));
  const findBetter = need(() => setFindBetterSignal((n) => n + 1));
  const openBrief = need(() => setBriefOpen(true));
  const openCompare = () => {
    if (atlas.pinned.length >= 2) setCompareOpen(true);
    else
      toast("Pin at least two sites", {
        description: "Press P on a selected site to pin it.",
      });
  };
  const toggle3d = () => atlas.setLayer("mode3d", !atlas.layers.mode3d);
  const toggleGrid = () => atlas.setLayer("hexes", !atlas.layers.hexes);

  useHotkeys({
    "mod+k": () => setCommandOpen((v) => !v),
    "/": focusSearch,
    "?": () => setShortcutsOpen(true),
    "[": () => setExplorerOpen((v) => !v),
    escape: () => atlas.select(null),
    "1": () => atlas.setMw(MW_PRESETS[0].mw),
    "2": () => atlas.setMw(MW_PRESETS[1].mw),
    "3": () => atlas.setMw(MW_PRESETS[2].mw),
    "4": () => atlas.setMw(MW_PRESETS[3].mw),
    v: toggle3d,
    g: toggleGrid,
    r: atlas.resetView,
    z: zoomToSelected,
    p: pinSelected,
    f: findBetter,
    b: openBrief,
    c: openCompare,
    e: onExport,
  });

  const noSite = selected ? undefined : "Select a site first";
  const commands: Command[] = [
    {
      id: "search",
      group: "General",
      label: "Search towns in the explorer",
      keys: ["/"],
      run: focusSearch,
    },
    {
      id: "explorer",
      group: "General",
      label: explorerOpen ? "Hide the site explorer" : "Show the site explorer",
      keys: ["["],
      run: () => setExplorerOpen((v) => !v),
    },
    {
      id: "sources",
      group: "General",
      label: "Open data sources and vintages",
      keywords: "provenance",
      run: () => setSourcesOpen(true),
    },
    {
      id: "shortcuts",
      group: "General",
      label: "Show keyboard shortcuts",
      keys: ["?"],
      run: () => setShortcutsOpen(true),
    },

    ...MW_PRESETS.map((p, i) => ({
      id: `mw-${p.mw}`,
      group: "Scenario",
      label: `Size: ${p.mw} MW ${p.name.toLowerCase()}${p.mw === mw ? " (current)" : ""}`,
      keywords: "mw size preset demand",
      keys: [String(i + 1)],
      run: () => atlas.setMw(p.mw),
    })),
    ...(["resident", "developer"] as const).map((l) => ({
      id: `lens-${l}`,
      group: "Scenario",
      label: `Lens: ${LENS_LABEL[l]}${l === lens ? " (current)" : ""}`,
      keywords: "scoring lens weighting",
      run: () => atlas.setLens(l),
    })),
    ...(Object.keys(COOLING_LABEL) as Cooling[]).map((c) => ({
      id: `cooling-${c}`,
      group: "Scenario",
      label: `Cooling: ${COOLING_LABEL[c]}${c === cooling ? " (current)" : ""}`,
      keywords: "cooling water design",
      run: () => atlas.setCooling(c),
    })),

    {
      id: "view",
      group: "Map",
      label: atlas.layers.mode3d
        ? "Switch to the 2D plan view"
        : "Switch to the 3D street view",
      keywords: "buildings streets tilt",
      keys: ["V"],
      run: toggle3d,
    },
    {
      id: "grid",
      group: "Map",
      label: atlas.layers.hexes
        ? "Hide the suitability grid"
        : "Show the suitability grid",
      keywords: "hex layer",
      keys: ["G"],
      run: toggleGrid,
    },
    {
      id: "extrude",
      group: "Map",
      label: atlas.layers.extrude
        ? "Flatten the grid"
        : "Extrude the grid by score",
      keywords: "3d columns height",
      run: () => atlas.setLayer("extrude", !atlas.layers.extrude),
    },
    ...(
      [
        ["ej", "EJ block groups"],
        ["protected", "protected open space"],
        ["flood", "FEMA 1% floodplain"],
      ] as const
    ).map(([k, label]) => ({
      id: `layer-${k}`,
      group: "Map",
      label: `${atlas.layers[k] ? "Hide" : "Show"} the ${label} overlay`,
      keywords: "layer overlay",
      run: () => atlas.setLayer(k, !atlas.layers[k]),
    })),
    {
      id: "reset",
      group: "Map",
      label: "Reset to the statewide view",
      keys: ["R"],
      run: atlas.resetView,
    },

    {
      id: "zoom",
      group: "Selected site",
      label: "Zoom to the selected cell",
      keys: ["Z"],
      disabledReason: noSite,
      run: zoomToSelected,
    },
    {
      id: "pin",
      group: "Selected site",
      label:
        selected && atlas.pinned.includes(selected.h3)
          ? "Unpin the selected site"
          : "Pin the selected site",
      keys: ["P"],
      disabledReason: noSite,
      run: pinSelected,
    },
    {
      id: "better",
      group: "Selected site",
      label: "Find better cells within 25 km",
      keys: ["F"],
      disabledReason: noSite,
      run: findBetter,
    },
    {
      id: "brief",
      group: "Selected site",
      label: "Generate the town-meeting brief",
      keys: ["B"],
      disabledReason: noSite,
      run: openBrief,
    },
    {
      id: "export",
      group: "Selected site",
      label: "Export the evidence as JSON",
      keys: ["E"],
      disabledReason: noSite,
      run: onExport,
    },
    {
      id: "compare",
      group: "Selected site",
      label: `Compare pinned sites (${atlas.pinned.length})`,
      keys: ["C"],
      disabledReason:
        atlas.pinned.length < 2 ? "Pin at least two sites" : undefined,
      run: openCompare,
    },
    ...(atlas.pinned.length
      ? [
          {
            id: "clear-pins",
            group: "Selected site",
            label: "Clear all pinned sites",
            run: atlas.clearPins,
          },
        ]
      : []),
    ...(selected
      ? [
          {
            id: "deselect",
            group: "Selected site",
            label: "Clear the selection",
            keys: ["Esc"],
            run: () => atlas.select(null),
          },
        ]
      : []),
  ];

  if (error) {
    return (
      <main className="flex h-screen items-center justify-center p-6">
        <div className="panel max-w-[460px] p-4">
          <h1 className="text-[15px] font-semibold text-fg">
            The screening grid did not load
          </h1>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
            {error}
          </p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-subtle">
            Atlas reads <code className="num">public/data/hexes.json</code>.
            Build it with{" "}
            <code className="num">python pipeline/build_hexes.py</code>, then
            reload.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <TopBar
        explorerOpen={explorerOpen}
        onToggleExplorer={() => setExplorerOpen((v) => !v)}
        onOpenCompare={() => setCompareOpen(true)}
        onOpenProvenance={() => setSourcesOpen(true)}
        onExport={onExport}
        onOpenCommand={() => setCommandOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        {explorerOpen && (
          <SiteExplorer
            onOpenCompare={() => setCompareOpen(true)}
            searchSignal={searchSignal}
          />
        )}
        <AtlasMap />
        <SiteInspector
          onOpenBrief={() => setBriefOpen(true)}
          findBetterSignal={findBetterSignal}
        />
      </div>

      <BriefPanel open={briefOpen} onOpenChange={setBriefOpen} />
      <SiteCompare open={compareOpen} onOpenChange={setCompareOpen} />
      <DataProvenance open={sourcesOpen} onOpenChange={setSourcesOpen} />
      <CommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        commands={commands}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </main>
  );
}
