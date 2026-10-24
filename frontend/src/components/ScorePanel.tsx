/**
 * Displays the weighted score breakdown for a single site.
 * Placeholder UI — the scoring teammate will refine the visualization.
 */

import type { SiteScore } from "@/types/models";

interface ScorePanelProps {
  score?: SiteScore;
}

export function ScorePanel({ score }: ScorePanelProps) {
  if (!score) {
    return (
      <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500">
        Select a location on the map to see its suitability score.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-atlas-ink">Suitability</h2>
        <span className="text-2xl font-bold text-atlas-primary">
          {score.overall_score.toFixed(1)}
        </span>
      </div>
      <ul className="space-y-2">
        {score.breakdown.map((b) => (
          <li key={b.category} className="text-sm">
            <div className="flex justify-between capitalize text-slate-700">
              <span>{b.category}</span>
              <span className="tabular-nums">{b.raw_score.toFixed(0)}/100</span>
            </div>
            <div className="mt-1 h-2 w-full rounded bg-slate-100">
              <div
                className="h-2 rounded bg-atlas-accent"
                style={{ width: `${b.raw_score}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
