/**
 * Atlas application shell.
 *
 * Lays out the map alongside the scoring, explanation, and comparison panels.
 * State wiring is intentionally minimal here — this is a scaffold. Each panel
 * is a placeholder owned by a different workstream.
 */

import { useState } from "react";

import { ComparisonView } from "@/components/ComparisonView";
import { ExplanationCard } from "@/components/ExplanationCard";
import { MapView } from "@/components/MapView";
import { ScorePanel } from "@/components/ScorePanel";
import type { Coordinates } from "@/types/models";

export default function App() {
  const [lastPick, setLastPick] = useState<Coordinates | null>(null);

  return (
    <div className="flex h-full flex-col bg-white text-atlas-ink">
      <header className="border-b border-slate-200 px-6 py-4">
        <h1 className="text-xl font-bold">
          Atlas <span className="font-normal text-slate-400">· Site Selection</span>
        </h1>
        <p className="text-sm text-slate-500">
          AI-powered data center siting for a sustainable grid.
        </p>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <section className="relative flex-1">
          <MapView onPickLocation={setLastPick} />
          {lastPick && (
            <div className="pointer-events-none absolute bottom-4 left-4 rounded bg-white/90 px-3 py-2 text-xs shadow">
              Selected: {lastPick.lat.toFixed(4)}, {lastPick.lng.toFixed(4)}
            </div>
          )}
        </section>

        <aside className="w-96 space-y-4 overflow-y-auto border-l border-slate-200 p-4">
          <ScorePanel />
          <ExplanationCard />
          <ComparisonView scores={[]} />
        </aside>
      </main>
    </div>
  );
}
