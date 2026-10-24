/**
 * "Find a better spot" (ATLAS.md 6.4) and site ranking for the explorer list.
 *
 * Pure and synchronous so it runs identically in the browser and inside the
 * brief agent's `find_alternatives` tool.
 */

import { haversineKm, type HexIndex } from "./hexes";
import { score } from "./score";
import { presetFor } from "./weights";
import type { Cooling, HexRecord, Lens, ScoreResult } from "./types";

export interface Alternative {
  hex: HexRecord;
  result: ScoreResult;
  distanceKm: number;
  /** One line explaining why this cell scores better than the origin. */
  reason: string;
}

export interface SearchOptions {
  mw: number;
  cooling: Cooling;
  lens: Lens;
  radiusKm?: number;
  k?: number;
}

function biggestGains(from: ScoreResult, to: ScoreResult): string {
  const gains = to.factors
    .map((f) => {
      const before = from.factors.find((g) => g.key === f.key);
      if (!before || before.value === null || f.value === null) return null;
      return { label: f.label, delta: (f.value - before.value) * f.weight, raw: f.raw };
    })
    .filter((x): x is { label: string; delta: number; raw: string } => x !== null)
    .sort((a, b) => b.delta - a.delta);

  if (from.excluded && !to.excluded) return "Clears the hard exclusions that rule out the current cell";
  const top = gains[0];
  if (!top || top.delta <= 0) return "Slightly better balance across the same factors";
  return `Better ${top.label.toLowerCase()} — ${top.raw}`;
}

export function findAlternatives(
  index: HexIndex,
  origin: HexRecord,
  opts: SearchOptions,
): Alternative[] {
  const radiusKm = opts.radiusKm ?? 25;
  const k = opts.k ?? 3;
  const base = score({ hex: origin, mw: opts.mw, cooling: opts.cooling, lens: opts.lens });
  const baseScore = base.score ?? 0;

  // Cheap bounding box before the exact distance test.
  const dLat = radiusKm / 110.574;
  const dLng = radiusKm / (111.32 * Math.cos((origin.lat * Math.PI) / 180));

  const out: Alternative[] = [];
  for (const hex of index.all) {
    if (hex.h3 === origin.h3 || hex.excluded) continue;
    if (Math.abs(hex.lat - origin.lat) > dLat) continue;
    if (Math.abs(hex.lng - origin.lng) > dLng) continue;
    const distanceKm = haversineKm(origin, hex);
    if (distanceKm > radiusKm) continue;
    const result = score({ hex, mw: opts.mw, cooling: opts.cooling, lens: opts.lens });
    if (result.score === null || result.score <= baseScore) continue;
    out.push({ hex, result, distanceKm, reason: biggestGains(base, result) });
  }

  // Prefer the nearest of equally-scoring cells: a 25 km suggestion that is
  // 4 km away is more useful than one at the edge of the search.
  out.sort((a, b) => {
    const ds = (b.result.score ?? 0) - (a.result.score ?? 0);
    if (Math.abs(ds) > 1e-9) return ds;
    return a.distanceKm - b.distanceKm;
  });
  return out.slice(0, k);
}

export interface RankedSite {
  hex: HexRecord;
  result: ScoreResult;
}

export interface RankFilters {
  mw: number;
  cooling: Cooling;
  lens: Lens;
  /** Case-insensitive town name match. */
  town?: string;
  landClasses?: string[];
  excludeFloodplain?: boolean;
  excludeEj?: boolean;
  maxGridKm?: number;
  limit?: number;
}

/** Distance to a line at the voltage this size needs, for tie-breaking. */
function gridDistance(hex: HexRecord, mw: number): number {
  const kv = presetFor(mw).requiredKv;
  const d = kv === 345 ? hex.d_tx345_km : kv === 115 ? hex.d_tx115_km : hex.d_tx69_km;
  return d ?? Number.POSITIVE_INFINITY;
}

/**
 * Score first, then break ties on measured evidence rather than arbitrarily.
 * At the top of the range a number of cells reach the ceiling, so without this
 * the ranked list would be ordered by H3 index, which means nothing.
 */
function compareSites(a: RankedSite, b: RankedSite, mw: number): number {
  const ds = (b.result.score ?? 0) - (a.result.score ?? 0);
  if (Math.abs(ds) > 1e-9) return ds;
  const dg = gridDistance(a.hex, mw) - gridDistance(b.hex, mw);
  if (Math.abs(dg) > 1e-9) return dg;
  const dp = (a.hex.pop_1km ?? 0) - (b.hex.pop_1km ?? 0);
  if (dp !== 0) return dp;
  return a.hex.h3 < b.hex.h3 ? -1 : 1;
}

export function rankSites(index: HexIndex, f: RankFilters): RankedSite[] {
  const limit = f.limit ?? 40;
  const town = f.town?.trim().toUpperCase();
  const out: RankedSite[] = [];

  for (const hex of index.all) {
    if (hex.excluded) continue;
    if (town && !(hex.town ?? "").toUpperCase().includes(town)) continue;
    if (f.landClasses?.length && (!hex.land_class || !f.landClasses.includes(hex.land_class)))
      continue;
    if (f.excludeFloodplain && (hex.flood_500yr === true || hex.flood_100yr === true)) continue;
    if (f.excludeEj && (hex.in_ej === true || hex.near_ej_1mi === true)) continue;
    if (f.maxGridKm !== undefined) {
      const d = hex.d_tx115_km ?? hex.d_tx69_km;
      if (d === null || d > f.maxGridKm) continue;
    }
    const result = score({ hex, mw: f.mw, cooling: f.cooling, lens: f.lens });
    if (result.score === null) continue;
    out.push({ hex, result });
  }

  out.sort((a, b) => compareSites(a, b, f.mw));
  return out.slice(0, limit);
}
