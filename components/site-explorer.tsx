"use client";

import * as React from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useAtlas } from "./atlas-provider";
import { Button, Separator, Skeleton, Toggle } from "./ui/primitives";
import { InfoDot } from "./ui/info";
import { rankSites } from "@/lib/alternatives";
import { fmtKm, titleCase } from "@/lib/format";
import { LAND_CLASS_LABEL } from "@/lib/weights";
import type { LandClass } from "@/lib/types";

const LAND_FILTERS: LandClass[] = [
  "industrial",
  "commercial",
  "other_developed",
  "open_land",
  "agriculture",
];

export function SiteExplorer() {
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

  const [showFilters, setShowFilters] = React.useState(true);
  const [debounced, setDebounced] = React.useState(filters.query);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(filters.query), 180);
    return () => clearTimeout(t);
  }, [filters.query]);

  const ranked = React.useMemo(() => {
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
      limit: 60,
    });
  }, [index, mw, cooling, lens, debounced, filters]);

  const toggleLand = (c: LandClass) => {
    setFilters({
      landClasses: filters.landClasses.includes(c)
        ? filters.landClasses.filter((x) => x !== c)
        : [...filters.landClasses, c],
    });
  };

  const activeFilters =
    filters.landClasses.length +
    (filters.excludeFloodplain ? 1 : 0) +
    (filters.excludeEj ? 1 : 0) +
    (filters.maxGridKm !== null ? 1 : 0);

  return (
    <aside
      aria-label="Site explorer"
      className="flex w-[280px] shrink-0 flex-col border-r border-line bg-panel"
    >
      {/* Search */}
      <div className="shrink-0 p-2.5">
        <label className="relative block">
          <span className="sr-only">Search by municipality</span>
          <Search
            size={13}
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle"
          />
          <input
            value={filters.query}
            onChange={(e) => setFilters({ query: e.target.value })}
            placeholder="Search a town, e.g. Holyoke"
            className="h-8 w-full rounded-[6px] border border-line bg-raised pl-7 pr-7 text-[12px] text-fg placeholder:text-subtle hover:border-subtle"
          />
          {filters.query && (
            <button
              onClick={() => setFilters({ query: "" })}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-fg"
            >
              <X size={12} aria-hidden />
            </button>
          )}
        </label>
      </div>

      <Separator />

      {/* Filters */}
      <div className="shrink-0">
        <button
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className="flex w-full items-center justify-between px-2.5 py-2 text-left"
        >
          <span className="eyebrow flex items-center gap-1.5">
            <SlidersHorizontal size={11} aria-hidden /> Filters
            {activeFilters > 0 && (
              <span className="num text-accent">{activeFilters}</span>
            )}
          </span>
          <span className="text-[11px] text-subtle">
            {showFilters ? "Hide" : "Show"}
          </span>
        </button>

        {showFilters && (
          <div className="px-2.5 pb-2.5">
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
                    className={`rounded-full border px-2 py-[3px] text-[10.5px] transition-colors ${
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

            <div className="mt-2">
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

            <div className="mt-1.5 flex items-center gap-2 px-1.5">
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
                className="min-w-0 flex-1 accent-[#56C9D5]"
              />
              <span className="num w-[44px] shrink-0 text-right text-[11px] text-fg">
                {filters.maxGridKm === null ? "any" : `${filters.maxGridKm} km`}
              </span>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Ranked results */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-baseline justify-between px-2.5 py-2">
          <span className="eyebrow">Ranked cells</span>
          <span className="num text-[10px] text-subtle">
            {loading ? "—" : `top ${ranked.length}`}
          </span>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {loading &&
            Array.from({ length: 10 }).map((_, i) => (
              <li key={i} className="px-1 py-1.5">
                <Skeleton className="h-[30px] w-full" />
              </li>
            ))}

          {!loading && ranked.length === 0 && (
            <li className="px-2.5 py-4 text-[11.5px] leading-snug text-subtle">
              No cell matches these filters. Hard exclusions remove{" "}
              {index
                ? index.all.filter((h) => h.excluded).length.toLocaleString()
                : "—"}{" "}
              of {index ? index.size.toLocaleString() : "—"} cells before
              ranking starts.
            </li>
          )}

          {!loading &&
            ranked.map((row, i) => {
              const isSel = selected?.h3 === row.hex.h3;
              return (
                <li key={row.hex.h3}>
                  <button
                    onClick={() => {
                      select(row.hex.h3);
                      flyTo(row.hex.lat, row.hex.lng, 14.5);
                    }}
                    className={`mb-px w-full rounded-[6px] px-2 py-1.5 text-left transition-colors ${
                      isSel ? "bg-accent-muted" : "hover:bg-raised"
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="num w-[18px] shrink-0 text-[10px] text-subtle">
                        {i + 1}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-[12px] ${isSel ? "text-accent" : "text-fg"}`}
                      >
                        {titleCase(row.hex.town)}
                      </span>
                      <span
                        className="num shrink-0 text-[12px] font-semibold"
                        style={{ color: row.result.band.color }}
                      >
                        {(row.result.score ?? 0).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 pl-[26px]">
                      <span className="truncate text-[10px] text-subtle">
                        {row.hex.land_class
                          ? LAND_CLASS_LABEL[row.hex.land_class]
                          : "Land class n/a"}
                        {" · "}
                        {fmtKm(row.hex.d_tx115_km)} to 115 kV
                        {row.hex.in_ej ? " · EJ" : ""}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
        </ul>

        <p className="shrink-0 border-t border-line px-2.5 py-2 text-[10px] leading-snug text-subtle">
          Ranking covers screening cells, not parcels or listings. Every cell
          shown still has unverified grid capacity and unknown zoning.
        </p>
      </div>
    </aside>
  );
}
