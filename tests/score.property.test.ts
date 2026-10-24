/**
 * Property tests for the invariants in ATLAS.md 4.7. These are the rules the
 * model must not break for any input, including inputs the pipeline has never
 * produced.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { score } from "../lib/score";
import type { Cooling, HexRecord, LandClass, Lens } from "../lib/types";
import { makeHex } from "./fixtures";

const LAND_CLASSES: (LandClass | null)[] = [
  "industrial",
  "commercial",
  "other_developed",
  "open_land",
  "agriculture",
  "forest",
  "residential",
  null,
];
const LENSES: Lens[] = ["resident", "balanced", "developer"];
const COOLINGS: Cooling[] = ["evaporative", "closed_loop", "air"];
const MWS = [5, 25, 100, 300];

const maybe = <T,>(a: fc.Arbitrary<T>) => fc.oneof(a, fc.constant(null));
const dist = () => fc.double({ min: 0, max: 80, noNaN: true });
const tri = fc
  .tuple(dist(), dist(), dist())
  .map(([a, b, c]) => [a, b, c].sort((x, y) => x - y) as [number, number, number]);

/** Hexes that satisfy the data contract: nested transmission distances. */
const hexArb: fc.Arbitrary<HexRecord> = fc
  .record({
    tx: tri,
    d_clean_km: maybe(dist()),
    d_highway_km: maybe(dist()),
    d_fiber_km: maybe(fc.double({ min: 0, max: 40, noNaN: true })),
    d_ej_km: maybe(dist()),
    d_dw_zone2_km: maybe(dist()),
    pop_1km: maybe(fc.integer({ min: 0, max: 40000 })),
    developed_frac_1km: maybe(fc.double({ min: 0, max: 1, noNaN: true })),
    water_stress: maybe(fc.double({ min: 0, max: 1, noNaN: true })),
    land_class: fc.constantFrom(...LAND_CLASSES),
    mlp_town: maybe(fc.boolean()),
    school_or_hospital_500m: maybe(fc.boolean()),
    in_ej: fc.boolean(),
    near_ej_1mi: fc.boolean(),
    in_sw_supply_watershed: maybe(fc.boolean()),
    flood_100yr: maybe(fc.boolean()),
    flood_500yr: maybe(fc.boolean()),
    coastal_slr: maybe(fc.boolean()),
    brownfield: maybe(fc.boolean()),
    aul_site_500m: maybe(fc.boolean()),
    excluded: fc.boolean(),
  })
  .map((r) =>
    makeHex({
      d_tx69_km: r.tx[0],
      d_tx115_km: r.tx[1],
      d_tx345_km: r.tx[2],
      d_clean_km: r.d_clean_km,
      d_highway_km: r.d_highway_km,
      d_fiber_km: r.d_fiber_km,
      d_ej_km: r.d_ej_km,
      d_dw_zone2_km: r.d_dw_zone2_km,
      pop_1km: r.pop_1km,
      developed_frac_1km: r.developed_frac_1km,
      water_stress: r.water_stress,
      land_class: r.land_class,
      mlp_town: r.mlp_town,
      school_or_hospital_500m: r.school_or_hospital_500m,
      in_ej: r.in_ej,
      near_ej_1mi: r.near_ej_1mi,
      in_sw_supply_watershed: r.in_sw_supply_watershed,
      flood_100yr: r.flood_100yr,
      flood_500yr: r.flood_500yr,
      coastal_slr: r.coastal_slr,
      brownfield: r.brownfield,
      aul_site_500m: r.aul_site_500m,
      excluded: r.excluded,
      exclude_reason: r.excluded ? "Synthetic exclusion" : null,
    }),
  );

const settingsArb = fc.record({
  mw: fc.constantFrom(...MWS),
  cooling: fc.constantFrom(...COOLINGS),
  lens: fc.constantFrom(...LENSES),
});

const RUNS = { numRuns: 600 };

describe("invariants", () => {
  it("score is always within [0, 10] or null", () => {
    fc.assert(
      fc.property(hexArb, settingsArb, (hex, s) => {
        const r = score({ hex, ...s });
        if (r.score === null) return;
        expect(Number.isFinite(r.score)).toBe(true);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(10);
      }),
      RUNS,
    );
  });

  it("every factor value is within [0, 1] or null", () => {
    fc.assert(
      fc.property(hexArb, settingsArb, (hex, s) => {
        for (const f of score({ hex, ...s }).factors) {
          if (f.value === null) continue;
          expect(f.value).toBeGreaterThanOrEqual(0);
          expect(f.value).toBeLessThanOrEqual(1);
        }
      }),
      RUNS,
    );
  });

  it("any exclusion gives exactly 0", () => {
    fc.assert(
      fc.property(hexArb, settingsArb, (hex, s) => {
        const r = score({ hex: { ...hex, excluded: true }, ...s });
        expect(r.score).toBe(0);
        expect(r.band.key).toBe("fatal");
        expect(r.bonusTotal).toBe(0);
      }),
      RUNS,
    );
  });

  it("moving a site into an EJ block group never raises the score", () => {
    fc.assert(
      fc.property(hexArb, settingsArb, (hex, s) => {
        const before = score({ hex: { ...hex, excluded: false, in_ej: false }, ...s });
        const after = score({ hex: { ...hex, excluded: false, in_ej: true }, ...s });
        if (before.score === null || after.score === null) return;
        expect(after.score).toBeLessThanOrEqual(before.score + 1e-9);
      }),
      RUNS,
    );
  });

  it("increasing MW never raises the grid factor or the residents factor", () => {
    fc.assert(
      fc.property(hexArb, fc.constantFrom(...COOLINGS), fc.constantFrom(...LENSES), (hex, cooling, lens) => {
        let prevGrid = Infinity;
        let prevPop = Infinity;
        for (const mw of MWS) {
          const r = score({ hex: { ...hex, excluded: false }, mw, cooling, lens });
          const grid = r.factors.find((f) => f.key === "grid_access")?.value;
          const pop = r.factors.find((f) => f.key === "residents")?.value;
          if (grid !== null && grid !== undefined) {
            expect(grid).toBeLessThanOrEqual(prevGrid + 1e-9);
            prevGrid = grid;
          }
          if (pop !== null && pop !== undefined) {
            expect(pop).toBeLessThanOrEqual(prevPop + 1e-9);
            prevPop = pop;
          }
        }
      }),
      RUNS,
    );
  });

  it("switching from evaporative to closed loop never lowers the score", () => {
    fc.assert(
      fc.property(hexArb, fc.constantFrom(...MWS), fc.constantFrom(...LENSES), (hex, mw, lens) => {
        const h = { ...hex, excluded: false };
        const evap = score({ hex: h, mw, cooling: "evaporative", lens });
        const closed = score({ hex: h, mw, cooling: "closed_loop", lens });
        if (evap.score === null || closed.score === null) return;
        expect(closed.score).toBeGreaterThanOrEqual(evap.score - 1e-9);
      }),
      RUNS,
    );
  });

  it("a hazard flag never improves the score", () => {
    fc.assert(
      fc.property(hexArb, settingsArb, (hex, s) => {
        const clean = score({
          hex: { ...hex, excluded: false, flood_500yr: false, coastal_slr: false },
          ...s,
        });
        for (const flag of ["flood_500yr", "coastal_slr"] as const) {
          const risky = score({
            hex: { ...hex, excluded: false, flood_500yr: false, coastal_slr: false, [flag]: true },
            ...s,
          });
          if (clean.score === null || risky.score === null) continue;
          expect(risky.score).toBeLessThanOrEqual(clean.score + 1e-9);
        }
      }),
      RUNS,
    );
  });

  it("more residents nearby never raises the score", () => {
    fc.assert(
      fc.property(
        hexArb,
        settingsArb,
        fc.integer({ min: 0, max: 20000 }),
        fc.integer({ min: 0, max: 20000 }),
        (hex, s, a, b) => {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          const few = score({ hex: { ...hex, excluded: false, pop_1km: lo }, ...s });
          const many = score({ hex: { ...hex, excluded: false, pop_1km: hi }, ...s });
          if (few.score === null || many.score === null) return;
          expect(many.score).toBeLessThanOrEqual(few.score + 1e-9);
        },
      ),
      RUNS,
    );
  });

  it("missing data never scores worse than the worst real value", () => {
    fc.assert(
      fc.property(hexArb, settingsArb, (hex, s) => {
        const h = { ...hex, excluded: false };
        const missing = score({ hex: { ...h, land_class: null }, ...s });
        const worst = score({ hex: { ...h, land_class: "residential" }, ...s });
        if (missing.score === null || worst.score === null) return;
        expect(missing.score).toBeGreaterThanOrEqual(worst.score - 1e-9);
      }),
      RUNS,
    );
  });

  it("the unresolved list always names grid capacity, zoning and availability", () => {
    fc.assert(
      fc.property(hexArb, settingsArb, (hex, s) => {
        const keys = score({ hex, ...s }).unresolved.map((u) => u.key);
        expect(keys).toContain("interconnection");
        expect(keys).toContain("zoning");
        expect(keys).toContain("availability");
      }),
      { numRuns: 120 },
    );
  });
});
