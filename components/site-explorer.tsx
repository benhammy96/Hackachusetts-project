"use client";

import * as React from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useAtlas } from "./atlas-provider";
import {
  Button,
  Flag,
  Kbd,
  Separator,
  Skeleton,
  Toggle,
} from "./ui/primitives";
import { Hint, InfoDot } from "./ui/info";
import { rankSites, type RankedSite } from "@/lib/alternatives";
import { fmtKm, fmtScore, titleCase } from "@/lib/format";
import { LAND_CLASS_LABEL, presetFor } from "@/lib/weights";
import type { HexRecord, LandClass } from "@/lib/types";

const LAND_FILTERS: LandClass[] = [
  "industrial",
  "commercial",
  "other_developed",
  "open_land",
  "agriculture",
];

/** Column-width labels; the full label is always in the cell's title. */
const LAND_SHORT: Record<LandClass, string> = {
  industrial: "Ind.",
  commercial: "Comm.",
  other_developed: "Dev.",
  open_land: "Open",
  agriculture: "Agri.",
  forest: "Forest",
  residential: "Res.",
};

const LAND_ORDER: LandClass[] = [
  "industrial",
  "commercial",
  "other_developed",
  "open_land",
  "agriculture",
  "forest",
  "residential",
];

const PAGE_SIZE = 25;

type SortKey = "rank" | "town" | "land" | "grid" | "score";
type SortDir = "asc" | "desc";

interface Row extends RankedSite {
  rank: number;
  gridKm: number | null;
}

/** Distance to a mapped line at the voltage this size needs. */
function gridKm(hex: HexRecord, mw: number): number | null {
  const kv = presetFor(mw).requiredKv;
  return kv === 345
    ? hex.d_tx345_km
    : kv === 115
      ? hex.d_tx115_km
      : hex.d_tx69_km;
}

function compareRows(a: Row, b: Row, key: SortKey): number {
  switch (key) {
    case "rank":
      return a.rank - b.rank;
    case "score":
      return (a.result.score ?? 0) - (b.result.score ?? 0) || b.rank - a.rank;
    case "town":
      return (
        (a.hex.town ?? "").localeCompare(b.hex.town ?? "") || a.rank - b.rank
      );
    case "land": {
      const ia = a.hex.land_class ? LAND_ORDER.indexOf(a.hex.land_class) : 99;
      const ib = b.hex.land_class ? LAND_ORDER.indexOf(b.hex.land_class) : 99;
      return ia - ib || a.rank - b.rank;
    }
    case "grid":
      return (a.gridKm ?? Infinity) - (b.gridKm ?? Infinity) || a.rank - b.rank;
  }
}

export function SiteExplorer({
  onOpenCompare,
  searchSignal = 0,
}: {
  onOpenCompare: () => void;
  /** Bumped by the `/` shortcut and the command menu to focus the town search. */
  searchSignal?: number;
}) {
  const { pinned } = useAtlas();
  const [tab, setTab] = React.useState<"ranked" | "pinned">("ranked");

  const lastSignal = React.useRef(searchSignal);
  React.useEffect(() => {
    if (searchSignal === lastSignal.current) return;
    lastSignal.current = searchSignal;
    setTab("ranked");
    // A timer rather than an animation frame: frames can be withheld while the
    // map is idle, and the input may only mount after the tab switch renders.
    setTimeout(() => {
      const input = document.getElementById(
        "explorer-search",
      ) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }, 0);
  }, [searchSignal]);

  return (
    <aside
      aria-label="Site explorer"
      className="flex w-[280px] shrink-0 flex-col border-r border-line bg-panel"
    >
      <Tabs.Root
        value={tab}
        onValueChange={(v) => setTab(v as "ranked" | "pinned")}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Tabs.List
          aria-label="Explorer views"
          className="flex h-9 shrink-0 items-stretch border-b border-line px-2"
        >
          <TabTrigger value="ranked">Ranked cells</TabTrigger>
          <TabTrigger value="pinned">
            Pinned
            <span className="num text-[10px] text-subtle">
              {pinned.length}/3
            </span>
          </TabTrigger>
        </Tabs.List>

        <Tabs.Content
          value="ranked"
          className="flex min-h-0 flex-1 flex-col outline-none"
        >
          <RankedView />
        </Tabs.Content>
        <Tabs.Content
          value="pinned"
          className="flex min-h-0 flex-1 flex-col outline-none"
        >
          <PinnedView onOpenCompare={onOpenCompare} />
        </Tabs.Content>
      </Tabs.Root>
    </aside>
  );
}

function TabTrigger({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <Tabs.Trigger
      value={value}
      className="-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-2 text-[12px] font-medium text-muted transition-colors duration-100 hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg"
    >
      {children}
    </Tabs.Trigger>
  );
}

/* ------------------------------------------------------------ ranked view */

function RankedView() {
  const {
    index,
    loading,
    mw,
    cooling,
    lens,
    filters,
    setFilters,
    select,
    selected,
    flyTo,
  } = useAtlas();

  const [showFilters, setShowFilters] = React.useState(false);
  const [debounced, setDebounced] = React.useState(filters.query);
  const [sort, setSort] = React.useState<{ key: SortKey; dir: SortDir }>({
    key: "rank",
    dir: "asc",
  });
  const [page, setPage] = React.useState(0);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(filters.query), 180);
    return () => clearTimeout(t);
  }, [filters.query]);

  // Every eligible cell, ranked by score with evidence-based tie-breaks. The
  // table pages through all of them rather than truncating to a top N.
  const ranked = React.useMemo<Row[]>(() => {
    if (!index) return [];
    return rankSites(index, {
      mw,
      cooling,
      lens,
      town: debounced || undefined,
      landClasses: filters.landClasses.length ? filters.landClasses : undefined,
      excludeFloodplain: filters.excludeFloodplain,
      excludeEj: filters.excludeEj,
      maxGridKm: filters.maxGridKm ?? undefined,
      limit: Number.POSITIVE_INFINITY,
    }).map((r, i) => ({ ...r, rank: i + 1, gridKm: gridKm(r.hex, mw) }));
  }, [index, mw, cooling, lens, debounced, filters]);

  const sorted = React.useMemo(() => {
    if (sort.key === "rank" && sort.dir === "asc") return ranked;
    const out = [...ranked].sort((a, b) => compareRows(a, b, sort.key));
    return sort.dir === "desc" ? out.reverse() : out;
  }, [ranked, sort]);

  React.useEffect(() => setPage(0), [ranked, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = sorted.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "score" ? "desc" : "asc" },
    );

  const toggleLand = (c: LandClass) => {
    setFilters({
      landClasses: filters.landClasses.includes(c)
        ? filters.landClasses.filter((x) => x !== c)
        : [...filters.landClasses, c],
    });
  };

  const chips: { key: string; label: string; clear: () => void }[] = [
    ...filters.landClasses.map((c) => ({
      key: `land-${c}`,
      label: LAND_CLASS_LABEL[c as LandClass],
      clear: () => toggleLand(c as LandClass),
    })),
    ...(filters.excludeFloodplain
      ? [
          {
            key: "flood",
            label: "No floodplain",
            clear: () => setFilters({ excludeFloodplain: false }),
          },
        ]
      : []),
    ...(filters.excludeEj
      ? [
          {
            key: "ej",
            label: "No EJ areas",
            clear: () => setFilters({ excludeEj: false }),
          },
        ]
      : []),
    ...(filters.maxGridKm !== null
      ? [
          {
            key: "grid",
            label: `Grid ≤ ${filters.maxGridKm} km`,
            clear: () => setFilters({ maxGridKm: null }),
          },
        ]
      : []),
  ];

  const clearAll = () =>
    setFilters({
      landClasses: [],
      excludeFloodplain: false,
      excludeEj: false,
      maxGridKm: null,
    });

  const excludedCount = index ? index.all.filter((h) => h.excluded).length : 0;
  const kv = presetFor(mw).requiredKv;

  return (
    <>
      {/* Search */}
      <div className="shrink-0 p-2">
        <label className="relative block">
          <span className="sr-only">Search by municipality</span>
          <Search
            size={13}
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle"
          />
          <input
            id="explorer-search"
            value={filters.query}
            onChange={(e) => setFilters({ query: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setFilters({ query: "" });
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Filter by town"
            className="h-8 w-full rounded-[6px] border border-line bg-raised pl-7 pr-8 text-[12px] text-fg placeholder:text-subtle hover:border-subtle"
          />
          {filters.query ? (
            <button
              onClick={() => setFilters({ query: "" })}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-fg"
            >
              <X size={12} aria-hidden />
            </button>
          ) : (
            <Kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
              /
            </Kbd>
          )}
        </label>
      </div>

      {/* Filter bar */}
      <div className="shrink-0 border-t border-line">
        <div className="flex h-8 items-center gap-1 px-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="explorer-filters"
            className="flex h-6 items-center gap-1.5 rounded-[6px] px-1 text-left hover:bg-raised"
          >
            <SlidersHorizontal size={11} aria-hidden className="text-subtle" />
            <span className="eyebrow">Filters</span>
            {chips.length > 0 && (
              <span className="num text-[10px] text-accent">
                {chips.length}
              </span>
            )}
          </button>
          {chips.length > 0 && (
            <button
              onClick={clearAll}
              className="ml-auto rounded-[6px] px-1 text-[11px] text-subtle hover:text-fg"
            >
              Clear all
            </button>
          )}
          {chips.length === 0 && (
            <span className="ml-auto text-[11px] text-subtle">
              {showFilters ? "Hide" : "None"}
            </span>
          )}
        </div>

        {chips.length > 0 && (
          <ul
            aria-label="Active filters"
            className="flex flex-wrap gap-1 px-2 pb-2"
          >
            {chips.map((c) => (
              <li key={c.key}>
                <button
                  onClick={c.clear}
                  aria-label={`Remove filter: ${c.label}`}
                  className="flex h-5 items-center gap-1 rounded-[6px] border border-accent/40 bg-accent-muted px-1.5 text-[10px] text-accent hover:border-accent"
                >
                  {c.label}
                  <X size={10} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        {showFilters && (
          <div
            id="explorer-filters"
            className="border-t border-line px-2 pb-2 pt-1.5"
          >
            <div className="mb-1 flex items-center gap-1.5">
              <span className="eyebrow">Land class, 2016</span>
              <InfoDot
                content={
                  <>
                    MassGIS 2016 Land Cover / Land Use at the cell centre. Land
                    class says nothing about zoning or whether the land is
                    available.
                  </>
                }
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {LAND_FILTERS.map((c) => {
                const on = filters.landClasses.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleLand(c)}
                    aria-pressed={on}
                    className={`h-6 rounded-[6px] border px-2 text-[11px] transition-colors ${
                      on
                        ? "border-accent/60 bg-accent-muted text-accent"
                        : "border-line bg-raised/50 text-muted hover:border-subtle"
                    }`}
                  >
                    {LAND_CLASS_LABEL[c]}
                  </button>
                );
              })}
            </div>

            <div className="mt-1.5">
              <Toggle
                label="Exclude mapped floodplain"
                checked={filters.excludeFloodplain}
                onChange={(v) => setFilters({ excludeFloodplain: v })}
              />
              <Toggle
                label="Exclude EJ block groups"
                checked={filters.excludeEj}
                onChange={(v) => setFilters({ excludeEj: v })}
              />
            </div>
            {filters.excludeEj && (
              <p className="px-1.5 pb-1 text-[10px] leading-snug text-warn/80">
                Filtering EJ areas out of a search is not the same as addressing
                them. The order itself requires a community benefits agreement.
              </p>
            )}

            <div className="mt-1 flex items-center gap-2 px-1.5">
              <span className="shrink-0 text-[11px] text-muted">Grid ≤</span>
              <input
                type="range"
                min={0.5}
                max={15}
                step={0.5}
                value={filters.maxGridKm ?? 15}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFilters({ maxGridKm: v >= 15 ? null : v });
                }}
                aria-label="Maximum distance to a mapped 115 kV line"
                className="min-w-0 flex-1 accent-[var(--color-accent)]"
              />
              <span className="num w-[44px] shrink-0 text-right text-[11px] text-fg">
                {filters.maxGridKm === null ? "any" : `${filters.maxGridKm} km`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Results table */}
      <div className="flex min-h-0 flex-1 flex-col border-t border-line">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full table-fixed border-collapse text-[11px]">
            <caption className="sr-only">
              Screening cells that pass the hard exclusions, ranked by
              suitability at {mw} MW
            </caption>
            <colgroup>
              <col className="w-[30px]" />
              <col />
              <col className="w-[42px]" />
              <col className="w-[50px]" />
              <col className="w-[46px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-panel">
              <tr className="border-b border-line">
                <SortHeader
                  label="#"
                  k="rank"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Town"
                  k="town"
                  sort={sort}
                  onSort={toggleSort}
                  align="left"
                />
                <SortHeader
                  label="Land"
                  k="land"
                  sort={sort}
                  onSort={toggleSort}
                  hint="MassGIS 2016 land class at the cell centre. Not zoning, not availability."
                />
                <SortHeader
                  label="Grid"
                  k="grid"
                  sort={sort}
                  onSort={toggleSort}
                  hint={`Distance to the nearest mapped ${kv} kV+ line, the voltage Atlas assumes ${mw} MW needs. Distance is not capacity.`}
                />
                <SortHeader
                  label="Score"
                  k="score"
                  sort={sort}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 14 }).map((_, i) => (
                  <tr key={i} className="h-7 border-b border-line/50">
                    <td colSpan={5} className="px-2">
                      <Skeleton className="h-3 w-full" />
                    </td>
                  </tr>
                ))}

              {!loading && sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-2.5 py-4 text-[11px] leading-snug text-subtle"
                  >
                    No cell matches these filters. Hard exclusions remove{" "}
                    {excludedCount.toLocaleString()} of{" "}
                    {index ? index.size.toLocaleString() : "—"} cells before
                    ranking starts.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((row) => {
                  const isSel = selected?.h3 === row.hex.h3;
                  const go = () => {
                    select(row.hex.h3);
                    flyTo(row.hex.lat, row.hex.lng, 14.5);
                  };
                  return (
                    <tr
                      key={row.hex.h3}
                      onClick={go}
                      aria-current={isSel ? "true" : undefined}
                      className={`h-7 cursor-pointer border-b border-line/50 transition-colors duration-100 ${
                        isSel ? "bg-accent-muted" : "hover:bg-raised"
                      }`}
                    >
                      <td className="num px-1.5 text-right text-[10px] text-subtle">
                        {row.rank}
                      </td>
                      <td className="px-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            go();
                          }}
                          title={`${titleCase(row.hex.town)} · cell ${row.hex.h3}`}
                          className="flex w-full min-w-0 items-center gap-1 rounded-[6px] text-left"
                        >
                          <span
                            className={`truncate ${isSel ? "text-accent" : "text-fg"}`}
                          >
                            {titleCase(row.hex.town)}
                          </span>
                          <RowFlags hex={row.hex} />
                        </button>
                      </td>
                      <td
                        className="px-1.5 text-muted"
                        title={
                          row.hex.land_class
                            ? LAND_CLASS_LABEL[row.hex.land_class]
                            : "Not available"
                        }
                      >
                        {row.hex.land_class
                          ? LAND_SHORT[row.hex.land_class]
                          : "n/a"}
                      </td>
                      <td className="num px-1.5 text-right text-muted">
                        {row.gridKm === null ? "n/a" : fmtKm(row.gridKm)}
                      </td>
                      <td
                        className="num px-1.5 text-right font-semibold"
                        style={{ color: row.result.band.color }}
                        title={row.result.band.label}
                      >
                        {fmtScore(row.result.score)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex h-8 shrink-0 items-center gap-1 border-t border-line px-2 text-[11px] text-subtle">
          <span className="num">
            {sorted.length === 0
              ? "0 cells"
              : `${(current * PAGE_SIZE + 1).toLocaleString()}–${Math.min(
                  (current + 1) * PAGE_SIZE,
                  sorted.length,
                ).toLocaleString()} of ${sorted.length.toLocaleString()}`}
          </span>
          <span className="num ml-auto">
            {current + 1} / {pages.toLocaleString()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 px-0"
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            aria-label="Previous page"
          >
            <ChevronLeft size={13} aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 px-0"
            onClick={() => setPage(current + 1)}
            disabled={current >= pages - 1}
            aria-label="Next page"
          >
            <ChevronRight size={13} aria-hidden />
          </Button>
        </div>
      </div>
    </>
  );
}

function SortHeader({
  label,
  k,
  sort,
  onSort,
  align = "right",
  hint,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
  hint?: string;
}) {
  const active = sort.key === k;
  const button = (
    <button
      onClick={() => onSort(k)}
      className={`inline-flex h-7 w-full items-center gap-0.5 rounded-[6px] ${
        align === "left" ? "justify-start" : "justify-end"
      } ${active ? "text-fg" : "text-subtle hover:text-muted"}`}
    >
      <span
        className="eyebrow"
        style={active ? { color: "var(--color-fg)" } : undefined}
      >
        {label}
      </span>
      {active &&
        (sort.dir === "asc" ? (
          <ArrowUp size={10} aria-hidden />
        ) : (
          <ArrowDown size={10} aria-hidden />
        ))}
    </button>
  );
  return (
    <th
      scope="col"
      aria-sort={
        active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
      }
      className="px-1.5 font-normal"
    >
      {hint ? <Hint content={hint}>{button}</Hint> : button}
    </th>
  );
}

function RowFlags({ hex }: { hex: HexRecord }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-0.5">
      {hex.in_ej && (
        <Flag tone="warn" title="Inside an Environmental Justice block group">
          EJ
        </Flag>
      )}
      {hex.flood_500yr && (
        <Flag tone="warn" title="Inside the FEMA 0.2% annual chance floodplain">
          0.2%
        </Flag>
      )}
      {hex.coastal_slr && (
        <Flag
          tone="warn"
          title="Inside the ≤3 ft sea level rise inundation extent"
        >
          SLR
        </Flag>
      )}
    </span>
  );
}

/* ------------------------------------------------------------ pinned view */

function PinnedView({ onOpenCompare }: { onOpenCompare: () => void }) {
  const {
    index,
    pinned,
    togglePin,
    clearPins,
    scoreFor,
    select,
    selected,
    mw,
  } = useAtlas();

  const rows = React.useMemo(
    () =>
      index
        ? pinned
            .map((h3) => index.get(h3))
            .filter((h): h is HexRecord => Boolean(h))
            .map((hex) => ({
              hex,
              result: scoreFor(hex),
              gridKm: gridKm(hex, mw),
            }))
        : [],
    [index, pinned, scoreFor, mw],
  );

  if (rows.length === 0) {
    return (
      <div className="px-3 py-4 text-[12px] leading-snug text-muted">
        <p>Nothing pinned yet.</p>
        <p className="mt-1.5 text-[11px] text-subtle">
          Select a cell and press <Kbd>P</Kbd> or use Pin in the inspector. Pin
          two or three to compare them in the same units.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full table-fixed border-collapse text-[11px]">
          <caption className="sr-only">Pinned sites for comparison</caption>
          <colgroup>
            <col />
            <col className="w-[52px]" />
            <col className="w-[44px]" />
            <col className="w-[30px]" />
          </colgroup>
          <thead>
            <tr className="h-7 border-b border-line">
              <th scope="col" className="eyebrow px-2 text-left font-semibold">
                Site
              </th>
              <th
                scope="col"
                className="eyebrow px-1.5 text-right font-semibold"
              >
                Grid
              </th>
              <th
                scope="col"
                className="eyebrow px-1.5 text-right font-semibold"
              >
                Score
              </th>
              <th scope="col">
                <span className="sr-only">Unpin</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ hex, result, gridKm: g }) => {
              const isSel = selected?.h3 === hex.h3;
              return (
                <tr
                  key={hex.h3}
                  aria-current={isSel ? "true" : undefined}
                  className={`border-b border-line/50 ${isSel ? "bg-accent-muted" : "hover:bg-raised"}`}
                >
                  <td className="px-2 py-1">
                    <button
                      onClick={() => select(hex.h3, { fly: true })}
                      className="block w-full min-w-0 rounded-[6px] text-left"
                    >
                      <span
                        className={`block truncate ${isSel ? "text-accent" : "text-fg"}`}
                      >
                        {titleCase(hex.town)}
                      </span>
                      <span className="num block truncate text-[10px] text-subtle">
                        {hex.h3}
                      </span>
                    </button>
                  </td>
                  <td className="num px-1.5 text-right text-muted">
                    {g === null ? "n/a" : fmtKm(g)}
                  </td>
                  <td
                    className="num px-1.5 text-right font-semibold"
                    style={{ color: result.band.color }}
                    title={result.band.label}
                  >
                    {result.excluded ? "0.0" : fmtScore(result.score)}
                  </td>
                  <td className="px-1 text-center">
                    <button
                      onClick={() => togglePin(hex.h3)}
                      aria-label={`Unpin ${titleCase(hex.town)}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-subtle hover:bg-raised hover:text-bad"
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Separator />
      <div className="flex shrink-0 items-center gap-1.5 p-2">
        <Button
          variant={rows.length >= 2 ? "primary" : "default"}
          size="sm"
          className="flex-1"
          onClick={onOpenCompare}
          disabled={rows.length < 2}
          title={
            rows.length < 2
              ? "Pin at least two sites to compare"
              : "Compare pinned sites (C)"
          }
        >
          <Columns2 size={12} aria-hidden />
          Compare {rows.length}
          <Kbd className="ml-1">C</Kbd>
        </Button>
        <Button variant="ghost" size="sm" onClick={clearPins}>
          <Trash2 size={12} aria-hidden />
          Clear
        </Button>
      </div>
      {rows.length < 2 && (
        <p className="px-2 pb-2 text-[10.5px] text-subtle">
          Pin one more site to compare.
        </p>
      )}
    </div>
  );
}
