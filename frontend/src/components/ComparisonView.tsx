/**
 * Side-by-side comparison of candidate sites.
 * Placeholder UI for the comparison feature.
 */

import type { SiteScore } from "@/types/models";

interface ComparisonViewProps {
  scores: SiteScore[];
}

export function ComparisonView({ scores }: ComparisonViewProps) {
  if (scores.length < 2) {
    return (
      <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500">
        Add at least two candidates to compare them.
      </div>
    );
  }

  const ranked = [...scores].sort((a, b) => b.overall_score - a.overall_score);

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h2 className="mb-3 text-lg font-semibold text-atlas-ink">Comparison</h2>
      <ol className="space-y-1">
        {ranked.map((s, i) => (
          <li key={s.site_id} className="flex justify-between text-sm text-slate-700">
            <span>
              {i + 1}. {s.site_id}
            </span>
            <span className="font-medium tabular-nums">{s.overall_score.toFixed(1)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
