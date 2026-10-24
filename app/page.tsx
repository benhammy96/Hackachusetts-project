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
import { eo658Checklist } from "@/lib/eo658";

// MapLibre and deck.gl touch the DOM and WebGL on import.
const AtlasMap = dynamic(() => import("@/components/atlas-map").then((m) => m.AtlasMap), {
  ssr: false,
  loading: () => (
    <div className="relative min-w-0 flex-1 bg-bg">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[12px] text-subtle">
        Preparing the map…
      </div>
    </div>
  ),
});

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
  const { error, selected, selectedScore, meta, mw, cooling, lens, scenario } = useAtlas();
  const [explorerOpen, setExplorerOpen] = React.useState(true);
  const [briefOpen, setBriefOpen] = React.useState(false);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [sourcesOpen, setSourcesOpen] = React.useState(false);

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
        description: "Export writes the selected cell's evidence and its sources.",
      });
      return;
    }
    const payload = {
      exported_at: new Date().toISOString(),
      disclaimer:
        "Atlas screening output. Preliminary geospatial screens, not legal or engineering determinations. Scores are a planning aid, not a permitting decision.",
      settings: { mw, cooling, lens },
      cell: selected,
      score: selectedScore,
      cost_scenario: scenario,
      eo658: eo658Checklist(mw),
      data_vintage: meta
        ? { generated_at: meta.generated_at, sources: meta.sources, fields: meta.fields }
        : null,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-${selected.town?.toLowerCase().replace(/\s+/g, "-") ?? "site"}-${selected.h3}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Evidence exported", { description: "Includes every source and vintage." });
  };

  if (error) {
    return (
      <main className="flex h-screen items-center justify-center p-6">
        <div className="panel max-w-[460px] p-4">
          <h1 className="text-[15px] font-semibold text-fg">The screening grid did not load</h1>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{error}</p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-subtle">
            Atlas reads <code className="num">public/data/hexes.json</code>. Build it with{" "}
            <code className="num">python pipeline/build_hexes.py</code>, then reload.
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
      />

      <div className="flex min-h-0 flex-1">
        {explorerOpen && <SiteExplorer />}
        <AtlasMap />
        <SiteInspector onOpenBrief={() => setBriefOpen(true)} />
      </div>

      <BriefPanel open={briefOpen} onOpenChange={setBriefOpen} />
      <SiteCompare open={compareOpen} onOpenChange={setCompareOpen} />
      <DataProvenance open={sourcesOpen} onOpenChange={setSourcesOpen} />
    </main>
  );
}
