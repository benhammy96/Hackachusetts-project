"use client";

import * as React from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  AlertTriangle,
  ChevronDown,
  Ban,
  Copy,
  Crosshair,
  FileText,
  MapPin,
  Navigation,
  Pin,
  Target,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAtlas } from "./atlas-provider";
import { Button, EmptyState, Kbd, KeyCombo, Separator, StatusTag } from "./ui/primitives";
import { InfoDot, Hint } from "./ui/info";
import { ScoreBreakdown } from "./score-breakdown";
import { CostEstimate } from "./cost-estimate";
import { findAlternatives } from "@/lib/alternatives";
import { eo658Checklist } from "@/lib/eo658";
import { fmtKm, fmtInt, fmtLatLng, fmtScore, fmtUsd, titleCase } from "@/lib/format";
import { COOLING_LABEL, LENS_LABEL, presetFor } from "@/lib/weights";
import { estimate } from "@/lib/economics";
import type { HexRecord, ScoreResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXAMPLES: { label: string; detail: string; lat: number; lng: number }[] = [
  {
    label: "Holyoke, near MGHPCC",
    detail: "On the grid and next to river hydro, inside an EJ block group",
    lat: 42.2025,
    lng: -72.6079,
  },
  {
    label: "Chelsea, residential",
    detail: "Dense housing, EJ block group, no developable land class",
    lat: 42.3918,
    lng: -71.0328,
  },
  {
    label: "Quabbin Reservoir",
    detail: "A fatal flaw: open water in a drinking water supply watershed",
    lat: 42.38,
    lng: -72.29,
  },
];

export function SiteInspector({
  onOpenBrief,
  findBetterSignal = 0,
}: {
  onOpenBrief: () => void;
  /** Bumped by the F shortcut and the command menu to run "Find better". */
  findBetterSignal?: number;
}) {
  const {
    index,
    selected,
    selectedScore,
    loading,
    mw,
    cooling,
    lens,
    pinned,
    togglePin,
    select,
    flyTo,
    scenario,
    meta,
  } = useAtlas();

  const [alternatives, setAlternatives] = React.useState<
    { h3: string; town: string | null; score: number; distanceKm: number; reason: string }[] | null
  >(null);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    setAlternatives(null);
  }, [selected?.h3, mw, cooling, lens]);

  const findBetter = () => {
    if (!index || !selected) return;
    setSearching(true);
    // Deferred so the button's pressed state paints before the scan runs.
    requestAnimationFrame(() => {
      const found = findAlternatives(index, selected, { mw, cooling, lens, radiusKm: 25, k: 3 });
      setAlternatives(
        found.map((a) => ({
          h3: a.hex.h3,
          town: a.hex.town,
          score: a.result.score ?? 0,
          distanceKm: a.distanceKm,
          reason: a.reason,
        })),
      );
      setSearching(false);
    });
  };

  const lastSignal = React.useRef(findBetterSignal);
  React.useEffect(() => {
    if (findBetterSignal === lastSignal.current) return;
    lastSignal.current = findBetterSignal;
    findBetter();
    // findBetter reads the current selection; only the signal should trigger it.
  }, [findBetterSignal]);

  if (loading) {
    return (
      <Aside>
        <div className="space-y-3 p-4">
          <div className="h-3 w-24 animate-pulse rounded bg-[#1b2631]" />
          <div className="h-12 w-32 animate-pulse rounded bg-[#1b2631]" />
          <div className="h-2 w-full animate-pulse rounded bg-[#1b2631]" />
          <div className="h-2 w-full animate-pulse rounded bg-[#1b2631]" />
        </div>
      </Aside>
    );
  }

  if (!selected || !selectedScore) {
    return (
      <Aside>
        <EmptyState title="Pick a location">
          <p>
            Click anywhere in Massachusetts to screen a {mw} MW {COOLING_LABEL[cooling].toLowerCase()}{" "}
            data centre at that spot. Atlas snaps the click to a{" "}
            {meta ? meta.hex_area_km2.toFixed(2) : "0.74"} km² screening cell and shows the
            evidence behind the score.
          </p>
          <p className="text-subtle">
            A cell is a geographic screening unit, not a parcel and not land for sale.
          </p>
          <Separator className="my-3" />
          <p className="overline">Start from a known site</p>
          <ul className="space-y-1">
            {EXAMPLES.map((ex) => (
              <li key={ex.label}>
                <button
                  onClick={() => {
                    const hex = index?.at(ex.lat, ex.lng);
                    if (hex) {
                      select(hex.h3);
                      flyTo(ex.lat, ex.lng, 12.5);
                    }
                  }}
                  className="w-full rounded-[6px] border border-line bg-raised/40 px-2.5 py-2 text-left transition-colors hover:border-subtle hover:bg-raised"
                >
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-fg">
                    <MapPin size={11} aria-hidden className="text-accent" />
                    {ex.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-subtle">
                    {ex.detail}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </EmptyState>
      </Aside>
    );
  }

  const r: ScoreResult = selectedScore;
  const preset = presetFor(mw);
  const eo = eo658Checklist(mw);
  const isPinned = pinned.includes(selected.h3);
  const cost = scenario ? estimate(scenario) : null;
  const critical = r.unresolved.filter((u) => u.severity === "critical");

  return (
    <Aside>
      {/* Action toolbar */}
      <div
        role="toolbar"
        aria-label="Site actions"
        className="sticky top-0 z-10 flex h-9 shrink-0 items-center gap-0.5 border-b border-line bg-panel px-2"
      >
        <ToolButton
          label={isPinned ? "Unpin" : "Pin"}
          hint={isPinned ? "Unpin from comparison" : "Pin for comparison"}
          keys={["P"]}
          pressed={isPinned}
          onClick={() => togglePin(selected.h3)}
          disabled={!isPinned && pinned.length >= 3}
          disabledHint="Three sites are pinned already. Unpin one first."
        >
          <Pin size={12} aria-hidden />
        </ToolButton>
        <ToolButton
          label="Zoom to"
          hint="Zoom the map to this cell"
          keys={["Z"]}
          onClick={() => select(selected.h3, { fly: true })}
        >
          <Crosshair size={12} aria-hidden />
        </ToolButton>
        <ToolButton
          label="Copy ID"
          hint="Copy the H3 cell ID"
          onClick={() => copy(selected.h3, "Cell ID copied")}
        >
          <Copy size={12} aria-hidden />
        </ToolButton>
        <ToolButton
          label="Copy coords"
          hint="Copy the cell centre as latitude, longitude"
          onClick={() => copy(`${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}`, "Coordinates copied")}
        >
          <MapPin size={12} aria-hidden />
        </ToolButton>
        <ToolButton
          label="Close"
          hint="Clear the selection"
          keys={["Esc"]}
          onClick={() => select(null)}
          iconOnly
          className="ml-auto"
        >
          <X size={13} aria-hidden />
        </ToolButton>
      </div>

      {/* 1. Where */}
      <div className="px-4 pt-3">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-fg">
            {titleCase(selected.town)}
          </h2>
          <p className="num mt-0.5 text-[10.5px] text-subtle">
            {fmtLatLng(selected.lat, selected.lng)} · cell {selected.h3}
          </p>
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
          <span>
            {meta ? meta.hex_area_km2.toFixed(2) : "0.74"} km² screening cell
          </span>
          <span aria-hidden className="text-subtle">
            ·
          </span>
          <Hint
            content={
              <>
                Atlas holds no ownership or listing record for this cell. Nothing here
                indicates that land is available, and a vacant cell is not a site for sale.
              </>
            }
          >
            <span className="cursor-help border-b border-dotted border-subtle text-warn">
              Availability unknown
            </span>
          </Hint>
          {meta && (
            <>
              <span aria-hidden className="text-subtle">
                ·
              </span>
              <span className="text-subtle">
                data built {new Date(meta.generated_at).toISOString().slice(0, 10)}
              </span>
            </>
          )}
        </p>
      </div>

      {/* 2. Score */}
      <div className="px-4 pt-3">
        {r.excluded ? (
          <div className="rounded-[8px] border border-unknown/50 bg-raised/60 p-3">
            <div className="flex items-center gap-2">
              <Ban size={16} className="shrink-0 text-unknown" aria-hidden />
              <span className="text-[14px] font-semibold text-fg">Fatal flaw</span>
              <span className="num ml-auto text-[26px] font-semibold text-unknown">0.0</span>
            </div>
            <ul className="mt-2 space-y-1">
              {r.exclusionReasons.map((reason) => (
                <li key={reason} className="text-[11.5px] leading-snug text-muted">
                  {reason}
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-line pt-1.5 text-[10.5px] leading-snug text-subtle">
              A hard screen returns zero before any bonus is applied. This is a preliminary
              geospatial screen from published polygons, not a legal determination for a
              specific parcel.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-end gap-2.5">
              <span
                className="num text-[46px] font-semibold leading-none"
                style={{ color: r.band.color }}
              >
                {fmtScore(r.score)}
              </span>
              <span className="num pb-1 text-[14px] text-subtle">/ 10</span>
              <div className="ml-auto pb-1 text-right">
                <div className="text-[12px] font-medium" style={{ color: r.band.color }}>
                  {r.band.label}
                </div>
                <div className="overline">Screening estimate</div>
              </div>
            </div>

            <div className="mt-2.5 space-y-1.5">
              <LensRow
                label="Buildability"
                value={r.buildability}
                coverage={r.coverage.buildabilityWeight}
              />
              <LensRow
                label="Community"
                value={r.community}
                coverage={r.coverage.communityWeight}
              />
            </div>

            {r.bonuses.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {r.bonuses.map((b) => (
                  <li key={b.key} className="flex items-baseline gap-1.5 text-[11px] text-ok">
                    <span className="num shrink-0">+{b.amount.toFixed(1)}</span>
                    <span className="min-w-0 text-muted">{b.label}</span>
                  </li>
                ))}
                {r.bonusTotal < r.bonuses.reduce((s, b) => s + b.amount, 0) && (
                  <li className="text-[10px] text-subtle">
                    Capped at +{r.bonusTotal.toFixed(1)}
                  </li>
                )}
              </ul>
            )}

            {r.divergence && (
              <div className="mt-2 rounded-[6px] border border-warn/35 bg-warn/5 px-2.5 py-2">
                <p className="text-[11.5px] leading-snug text-fg">
                  The two lenses disagree by{" "}
                  <span className="num">{r.divergence.gap.toFixed(1)}</span> points.
                  {r.divergence.weakest && (
                    <>
                      {" "}
                      The weakest factor is{" "}
                      <span className="font-medium">
                        {r.divergence.weakest.label.toLowerCase()}
                      </span>
                      : {r.divergence.weakest.raw}.
                    </>
                  )}
                </p>
                <p className="mt-1 text-[10.5px] text-subtle">
                  Current lens: {LENS_LABEL[lens]} (α = {r.alpha.toFixed(2)}). A low score is a
                  model label, not a prediction of how anyone will vote.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Critical warnings — never hidden behind a good score. The titles
          always show; only the longer explanations sit behind a disclosure. */}
      <div className="px-4 pt-3">
        <Unresolved items={critical} />
      </div>

      {/* 4. Three high-signal metrics */}
      <dl className="mx-4 mt-3 divide-y divide-line rounded-[6px] border border-line bg-raised/40">
        <KeyMetric
          label={`Nearest ${preset.requiredKv} kV+ line`}
          value={fmtKm(
            preset.requiredKv === 345
              ? selected.d_tx345_km
              : preset.requiredKv === 115
                ? selected.d_tx115_km
                : selected.d_tx69_km,
          )}
          note="mapped line, not capacity"
        />
        <KeyMetric
          label="Annual power cost"
          value={cost ? fmtUsd(cost.annualElectricityUsd) : "Not available"}
          note="modelled"
        />
        <KeyMetric
          label="Flood"
          value={
            selected.flood_100yr === null
              ? "Not screened"
              : selected.flood_100yr
                ? "1% hazard"
                : selected.flood_500yr
                  ? "0.2% hazard"
                  : "Outside mapped zones"
          }
          note="FEMA NFHL"
          tone={selected.flood_100yr ? "bad" : selected.flood_500yr ? "warn" : undefined}
        />
      </dl>

      {/* 5–6. Evidence. Factors are the default tab, so all eight stay visible. */}
      <Tabs.Root defaultValue="factors" className="mt-3">
        <Tabs.List
          aria-label="Site evidence"
          className="sticky top-9 z-10 flex h-8 items-stretch gap-1 border-y border-line bg-panel px-3"
        >
          <InspectorTab value="factors">Factors</InspectorTab>
          <InspectorTab value="measurements">Measurements</InspectorTab>
          <InspectorTab value="eo658">EO 658</InspectorTab>
          <InspectorTab value="cost">Cost</InspectorTab>
        </Tabs.List>

        <Tabs.Content value="factors" className="px-4 pt-3 outline-none">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-fg">Why this score</h3>
            <InfoDot
              side="left"
              content={
                <>
                  Each factor is normalised to 0–1 where 1 is most favourable, then weighted
                  inside its lens. A factor with no data is dropped from both the numerator
                  and the denominator, so missing data cannot read as a bad site or a good
                  one. Expand a row for the measurement and its source.
                </>
              }
            />
          </div>
          <ScoreBreakdown result={r} />
        </Tabs.Content>

        <Tabs.Content value="measurements" className="px-4 pt-2 outline-none">
          <MeasurementsTable hex={selected} />
        </Tabs.Content>

        <Tabs.Content value="eo658" className="px-4 pt-3 outline-none">
          <p className="text-[11.5px] leading-snug text-muted">{eo.summary}</p>
          {eo.items.length > 0 && (
            <ul className="mt-2 space-y-2">
              {eo.items.map((item) => (
                <li key={item.section}>
                  <p className="text-[11.5px] font-medium leading-snug text-fg">
                    <span className="num text-subtle">{item.section}</span> — {item.title}
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-subtle">{item.detail}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 border-t border-line pt-1.5 text-[10.5px] leading-snug text-warn/80">
            {eo.disclaimer}
          </p>
          <a
            href={eo.primarySourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-[10.5px] text-accent hover:underline"
          >
            Read Executive Order 658 →
          </a>
        </Tabs.Content>

        <Tabs.Content value="cost" className="px-4 pt-3 outline-none">
          <CostEstimate />
        </Tabs.Content>
      </Tabs.Root>

      {/* 7. Actions */}
      <div className="sticky bottom-0 mt-4 border-t border-line bg-panel px-4 py-3">
        <div className="flex gap-1.5">
          <Button variant="primary" onClick={onOpenBrief} className="flex-1">
            <FileText size={13} aria-hidden />
            Generate brief
            <Kbd className="ml-1">B</Kbd>
          </Button>
          <Button onClick={findBetter} disabled={searching} title="Scan 25 km for better cells (F)">
            <Target size={13} aria-hidden />
            {searching ? "Scanning…" : "Find better"}
            <Kbd className="ml-1">F</Kbd>
          </Button>
        </div>

        {alternatives !== null && (
          <div className="mt-2">
            {alternatives.length === 0 ? (
              <p className="text-[11px] text-subtle">
                No non-excluded cell within 25 km scores higher at {mw} MW under the{" "}
                {LENS_LABEL[lens]} lens.
              </p>
            ) : (
              <ul className="space-y-1">
                {alternatives.map((a) => (
                  <li key={a.h3}>
                    <button
                      onClick={() => {
                        select(a.h3, { fly: true });
                      }}
                      className="w-full rounded-[6px] border border-line bg-raised/50 px-2 py-1.5 text-left transition-colors hover:border-accent/50"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1 text-[11.5px] font-medium text-fg">
                          <Navigation size={10} aria-hidden className="shrink-0 text-accent" />
                          <span className="truncate">{titleCase(a.town)}</span>
                          <span className="num shrink-0 text-subtle">
                            {a.distanceKm.toFixed(1)} km
                          </span>
                        </span>
                        <span className="num shrink-0 text-[12px] font-semibold text-ok">
                          {a.score.toFixed(1)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[10.5px] text-subtle">
                        {a.reason}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="mt-2 text-[10px] leading-snug text-subtle">
          Scores are a planning aid, not a permitting decision.
        </p>
      </div>
    </Aside>
  );
}

function Aside({ children }: { children: React.ReactNode }) {
  return (
    <aside
      id="site-inspector"
      aria-label="Site inspector"
      className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-l border-line bg-panel"
    >
      {children}
      <div className="h-2 shrink-0" />
    </aside>
  );
}

function LensRow({
  label,
  value,
  coverage,
}: {
  label: string;
  value: number | null;
  coverage: number;
}) {
  const pct = value === null ? 0 : (value / 10) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="w-[76px] shrink-0 text-[11.5px] text-muted">{label}</span>
      <div className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#1b2631]">
        <div
          className="h-full rounded-full bg-accent/80 transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      {coverage < 1 && (
        <span className="overline shrink-0 text-warn">{Math.round(coverage * 100)}%</span>
      )}
      <span className="num w-[28px] shrink-0 text-right text-[12px] font-medium text-fg">
        {value === null ? "—" : value.toFixed(1)}
      </span>
    </div>
  );
}

function KeyMetric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "warn" | "bad";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-2.5 py-1.5">
      <dt className="min-w-0">
        <span className="block text-[11.5px] text-muted">{label}</span>
        <span className="block text-[10px] text-subtle">{note}</span>
      </dt>
      <dd
        className={`num shrink-0 text-right text-[12.5px] font-semibold ${
          tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-fg"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Unresolved({ items }: { items: ScoreResult["unresolved"] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-[6px] border border-line bg-raised/40 p-2.5">
      <div className="flex items-center gap-1.5">
        <AlertTriangle size={12} className="shrink-0 text-warn" aria-hidden />
        <span className="overline text-warn">
          {items.length} unresolved before this is a real site
        </span>
      </div>
      <ul className={`mt-1.5 ${open ? "space-y-1.5" : "space-y-0.5"}`}>
        {items.map((u) => (
          <li key={u.key}>
            <p className="text-[11.5px] font-medium leading-snug text-fg">{u.label}</p>
            {open && <p className="text-[10.5px] leading-snug text-subtle">{u.detail}</p>}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-1.5 flex items-center gap-0.5 rounded-[4px] text-[10.5px] text-subtle hover:text-fg"
      >
        {open ? "Hide the reasons" : "Why these are open"}
        <ChevronDown
          size={11}
          aria-hidden
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}

function boolLabel(v: boolean | null): string {
  return v === null ? "Not available" : v ? "Yes" : "No";
}

function InspectorTab({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Tabs.Trigger
      value={value}
      className="-mb-px border-b-2 border-transparent px-1.5 text-[12px] font-medium text-muted transition-colors duration-100 hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg"
    >
      {children}
    </Tabs.Trigger>
  );
}

function ToolButton({
  label,
  hint,
  keys,
  onClick,
  pressed,
  disabled,
  disabledHint,
  iconOnly,
  className,
  children,
}: {
  label: string;
  hint: string;
  keys?: string[];
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  iconOnly?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Hint
      side="bottom"
      content={
        <span className="flex items-center gap-2">
          {disabled && disabledHint ? disabledHint : hint}
          {keys && <KeyCombo keys={keys} />}
        </span>
      }
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={pressed}
        aria-label={iconOnly ? label : undefined}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-[6px] px-1.5 text-[11px] font-medium transition-colors duration-100",
          "disabled:cursor-not-allowed disabled:opacity-45",
          pressed ? "bg-accent-muted text-accent" : "text-muted hover:bg-raised hover:text-fg",
          className,
        )}
      >
        {children}
        {!iconOnly && <span>{label}</span>}
      </button>
    </Hint>
  );
}

function copy(text: string, message: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(message, { description: text }))
    .catch(() => toast("Copy failed", { description: "The browser blocked clipboard access." }));
}

/** Every raw measurement behind the score, as a two-column table. */
function MeasurementsTable({ hex }: { hex: HexRecord }) {
  const rows: [string, string | null][] = [
    ["Land use (MassGIS 2016)", hex.land_use_name],
    ["Land cover (MassGIS 2016)", hex.land_cover_name],
    ["Residents within 1 km", fmtInt(hex.pop_1km)],
    ["School or hospital within 500 m", boolLabel(hex.school_or_hospital_500m)],
    [
      "EJ block group",
      hex.in_ej
        ? `Yes — ${hex.ej_criteria ?? "designated"}`
        : hex.near_ej_1mi
          ? `Within 1 mile (${fmtKm(hex.d_ej_km)})`
          : `Nearest ${fmtKm(hex.d_ej_km)}`,
    ],
    ["Nearest 69 kV+ line", fmtKm(hex.d_tx69_km)],
    ["Nearest 115 kV+ line", fmtKm(hex.d_tx115_km)],
    ["Nearest 345 kV+ line", fmtKm(hex.d_tx345_km)],
    ["Nearest non-emitting generator", `${fmtKm(hex.d_clean_km)} (proximity, not supply)`],
    ["Municipal light plant town", boolLabel(hex.mlp_town)],
    ["Drinking water Zone II", fmtKm(hex.d_dw_zone2_km)],
    ["Surface water supply watershed", boolLabel(hex.in_sw_supply_watershed)],
    ["Sea level rise exposure (≤3 ft)", boolLabel(hex.coastal_slr)],
    ["Activity and Use Limitation site within 500 m", boolLabel(hex.aul_site_500m)],
    [
      "Developed share within 1 km",
      hex.developed_frac_1km === null ? "Not available" : `${Math.round(hex.developed_frac_1km * 100)}%`,
    ],
    ["Nearest major highway", `${fmtKm(hex.d_highway_km)} — road access, not fiber`],
    ["Fiber route", "Not available in this build"],
    ["Basin water stress index", "Not available in this build"],
  ];
  return (
    <table className="w-full table-fixed border-collapse text-[11px]">
      <caption className="sr-only">Raw measurements for this screening cell</caption>
      <colgroup>
        <col />
        <col className="w-[44%]" />
      </colgroup>
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className="overline py-1 text-left font-semibold">
            Measure
          </th>
          <th scope="col" className="overline py-1 text-right font-semibold">
            Value
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, value]) => {
          const missing = value === null || value.startsWith("Not available");
          return (
            <tr key={label} className="border-b border-line/50">
              <th scope="row" className="py-1 pr-3 text-left align-top font-normal text-subtle">
                {label}
              </th>
              <td className={`num py-1 text-right align-top ${missing ? "text-unknown" : "text-muted"}`}>
                {value ?? "Not available"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export { StatusTag };
