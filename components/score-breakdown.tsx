"use client";

import * as React from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { useAtlas } from "./atlas-provider";
import { Bar, StatusTag, describeStatus } from "./ui/primitives";
import { Hint } from "./ui/info";
import { fmtPercent } from "@/lib/format";
import type { FactorResult, ScoreResult } from "@/lib/types";

/** The eight core factors, always all visible (UI_DESIGN.md section 7). */
export function ScoreBreakdown({ result }: { result: ScoreResult }) {
  const build = result.factors.filter((f) => f.group === "buildability");
  const community = result.factors.filter((f) => f.group === "community");

  return (
    <div className="space-y-3">
      <Group
        title="Buildability"
        value={result.buildability}
        coverage={result.coverage.buildabilityWeight}
        factors={build}
      />
      <Group
        title="Community"
        value={result.community}
        coverage={result.coverage.communityWeight}
        factors={community}
      />
    </div>
  );
}

function Group({
  title,
  value,
  coverage,
  factors,
}: {
  title: string;
  value: number | null;
  coverage: number;
  factors: FactorResult[];
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h4 className="eyebrow">{title}</h4>
        <div className="flex items-baseline gap-2">
          {coverage < 1 && (
            <Hint
              content={
                <>
                  Only {fmtPercent(coverage)} of this lens&apos;s weight is measured in this
                  build. The unmeasured factors are dropped from the average rather than
                  filled with a default, so the sub-score describes what is known, not the
                  whole picture.
                </>
              }
            >
              <span className="eyebrow cursor-help text-warn">
                {fmtPercent(coverage)} measured
              </span>
            </Hint>
          )}
          <span className="num text-[13px] font-semibold text-fg">
            {value === null ? "—" : value.toFixed(1)}
          </span>
        </div>
      </div>
      <ul className="space-y-px">
        {factors.map((f) => (
          <FactorRow key={f.key} factor={f} />
        ))}
      </ul>
    </section>
  );
}

export function FactorRow({ factor: f }: { factor: FactorResult }) {
  const [open, setOpen] = React.useState(false);
  const { meta } = useAtlas();
  const source = f.sourceId ? meta?.sources[f.sourceId] : undefined;
  const missing = f.value === null;

  return (
    <li className="rounded-[4px] hover:bg-raised/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-1.5 py-[7px] text-left"
      >
        <ChevronRight
          size={11}
          aria-hidden
          className={`shrink-0 text-subtle transition-transform duration-100 ${open ? "rotate-90" : ""}`}
        />
        <span
          className={`w-[112px] shrink-0 truncate text-[12px] ${missing ? "text-subtle" : "text-fg"}`}
        >
          {f.label}
        </span>
        <div className="min-w-0 flex-1">
          <Bar
            value={f.value}
            color={missing ? "var(--color-unknown)" : barColor(f.value as number)}
          />
        </div>
        <span
          className={`num w-[34px] shrink-0 text-right text-[12px] ${missing ? "text-unknown" : "text-fg"}`}
        >
          {missing ? "n/a" : (f.value as number).toFixed(2)}
        </span>
        <span className="num w-[26px] shrink-0 text-right text-[10px] text-subtle">
          ×{f.weight}
        </span>
      </button>

      {open && (
        <div className="space-y-1.5 border-t border-line/70 px-1.5 pb-2 pt-1.5 pl-[22px]">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-[11.5px] leading-snug text-muted">{f.raw}</p>
            <Hint content={describeStatus(f.status)}>
              <span className="cursor-help">
                <StatusTag status={f.status} />
              </span>
            </Hint>
          </div>
          {f.note && (
            <p className="text-[11px] leading-snug text-subtle">{f.note}</p>
          )}
          {source && (
            <a
              href={source.landing_page ?? source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10.5px] text-accent hover:underline"
            >
              {source.name} · {source.vintage}
              <ExternalLink size={9} aria-hidden />
            </a>
          )}
        </div>
      )}
    </li>
  );
}

function barColor(v: number): string {
  if (v >= 0.8) return "#68C49A";
  if (v >= 0.6) return "#A8C977";
  if (v >= 0.4) return "#E6B765";
  return "#E27D77";
}
