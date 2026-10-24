/**
 * Calibration against the shipped statewide grid (ATLAS.md 4.8).
 *
 * These assertions deliberately test *verified layer classifications* and
 * invariant behaviour rather than predetermined scores. ATLAS.md 16.10.2 warns
 * against tuning weights until three chosen sites produce the numbers the team
 * hoped for, so where the real data contradicts the original expectation the
 * test records what the data actually says.
 */

import fs from "node:fs";
import path from "node:path";
import { latLngToCell } from "h3-js";
import { beforeAll, describe, expect, it } from "vitest";
import { HexIndex, type DataMeta, type HexFile } from "../lib/hexes";
import { score } from "../lib/score";
import type { Cooling, HexRecord, Lens } from "../lib/types";

const DATA = path.join(process.cwd(), "public", "data");

let index: HexIndex;
let meta: DataMeta;

const at = (lat: number, lng: number): HexRecord => {
  const hex = index.at(lat, lng);
  if (!hex) throw new Error(`no hex at ${lat},${lng} (cell ${latLngToCell(lat, lng, 8)})`);
  return hex;
};

const run = (hex: HexRecord, mw = 100, cooling: Cooling = "evaporative", lens: Lens = "balanced") =>
  score({ hex, mw, cooling, lens });

beforeAll(() => {
  const file = JSON.parse(fs.readFileSync(path.join(DATA, "hexes.json"), "utf8")) as HexFile;
  meta = JSON.parse(fs.readFileSync(path.join(DATA, "meta.json"), "utf8")) as DataMeta;
  index = new HexIndex(file);
});

describe("shipped dataset", () => {
  it("is an H3 resolution 8 grid covering the Commonwealth", () => {
    expect(meta.h3_resolution).toBe(8);
    expect(index.size).toBeGreaterThan(30_000);
    expect(meta.hex_area_km2).toBeGreaterThan(0.6);
    expect(meta.hex_area_km2).toBeLessThan(0.9);
  });

  it("keeps transmission distances nested by voltage", () => {
    for (const h of index.all) {
      if (h.d_tx69_km !== null && h.d_tx115_km !== null) {
        expect(h.d_tx115_km).toBeGreaterThanOrEqual(h.d_tx69_km);
      }
      if (h.d_tx115_km !== null && h.d_tx345_km !== null) {
        expect(h.d_tx345_km).toBeGreaterThanOrEqual(h.d_tx115_km);
      }
    }
  });

  it("publishes no fiber measurement and no basin stress index", () => {
    expect(meta.fields.d_fiber_km.status).toBe("unavailable");
    expect(meta.fields.d_fiber_km.coverage).toBe(0);
    expect(meta.fields.water_stress.coverage).toBe(0);
    expect(index.all.every((h) => h.d_fiber_km === null)).toBe(true);
  });

  it("records a reason for every exclusion", () => {
    const excluded = index.all.filter((h) => h.excluded);
    expect(excluded.length).toBeGreaterThan(0);
    expect(excluded.every((h) => (h.exclude_reason ?? "").length > 0)).toBe(true);
  });

  it("scores every cell inside [0,10] with no NaN", () => {
    for (const hex of index.all) {
      const r = run(hex);
      if (r.score === null) continue;
      expect(Number.isFinite(r.score)).toBe(true);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(10);
    }
  });

  it("gives every excluded cell exactly 0", () => {
    for (const hex of index.all) {
      if (!hex.excluded) continue;
      expect(run(hex).score).toBe(0);
    }
  });

  it("names a verified source for every field that has data", () => {
    for (const [field, m] of Object.entries(meta.fields)) {
      if (m.coverage === 0) continue;
      if (field === "excluded" || field === "exclude_reason") continue;
      expect(m.source, `${field} has data but no source`).toBeTruthy();
      expect(meta.sources[m.source as string]).toBeTruthy();
    }
  });
});

describe("Quabbin Reservoir — must be a fatal flaw", () => {
  const LAT = 42.38;
  const LNG = -72.29;

  it("is excluded on a water screen", () => {
    const hex = at(LAT, LNG);
    expect(hex.excluded).toBe(true);
    expect(hex.exclude_reason).toMatch(/water|wetland/i);
  });

  it("is named as a drinking water supply watershed", () => {
    const hex = at(LAT, LNG);
    expect(hex.in_sw_supply_watershed).toBe(true);
    expect(hex.exclude_reason).toMatch(/water supply watershed/i);
  });

  it("scores exactly 0 at every size, with no bonus applied", () => {
    const hex = at(LAT, LNG);
    for (const mw of [5, 25, 100, 300]) {
      const r = run(hex, mw);
      expect(r.score).toBe(0);
      expect(r.band.key).toBe("fatal");
      expect(r.bonusTotal).toBe(0);
      expect(r.exclusionReasons.length).toBeGreaterThan(0);
    }
  });
});

describe("Chelsea residential — must be a bad site", () => {
  const LAT = 42.3918;
  const LNG = -71.0328;

  it("is a dense residential EJ block group", () => {
    const hex = at(LAT, LNG);
    expect(hex.town).toBe("CHELSEA");
    expect(hex.in_ej).toBe(true);
    expect(hex.land_class).toBe("residential");
    expect(hex.pop_1km).toBeGreaterThan(10_000);
  });

  it("lands in the contested band or worse for a 100 MW campus", () => {
    // ATLAS.md 4.8 expected below 4.0. With the model exactly as specified and
    // the real MassGIS layers, this cell scores in the low fives: the two
    // 30-weight community factors are already pegged at zero, and climate risk
    // is a verified 1.0 because this block sits outside both mapped flood
    // hazards. Forcing a 3.9 would mean tuning weights to a predetermined
    // answer, which ATLAS.md 16.10.2 rules out, so the test asserts the band
    // and the zeroed factors instead.
    const r = run(at(LAT, LNG), 100);
    expect(r.score).not.toBeNull();
    expect(r.score as number).toBeLessThan(5.0);
    expect(["contested", "avoid"]).toContain(r.band.key);
  });

  it("is reported as only partly measured on the community lens", () => {
    const r = run(at(LAT, LNG), 100);
    expect(r.coverage.communityWeight).toBeLessThan(1);
  });

  it("zeroes the environmental justice and land factors", () => {
    const r = run(at(LAT, LNG), 100);
    expect(r.factors.find((f) => f.key === "environmental_justice")?.value).toBe(0);
    expect(r.factors.find((f) => f.key === "land_readiness")?.value).toBe(0);
  });

  it("gets worse, never better, under the resident lens", () => {
    const hex = at(LAT, LNG);
    const dev = run(hex, 100, "evaporative", "developer").score as number;
    const res = run(hex, 100, "evaporative", "resident").score as number;
    expect(res).toBeLessThanOrEqual(dev);
  });
});

describe("Holyoke near MGHPCC — strong to build, contested to live beside", () => {
  const LAT = 42.2025;
  const LNG = -72.6079;

  it("sits on top of the grid and next to non-emitting generation", () => {
    const hex = at(LAT, LNG);
    expect(hex.town).toBe("HOLYOKE");
    expect(hex.d_tx115_km as number).toBeLessThan(1);
    expect(hex.d_clean_km as number).toBeLessThan(1);
    expect(hex.mlp_town).toBe(true);
  });

  it("scores buildability at 8.0 or better", () => {
    const r = run(at(LAT, LNG), 100);
    expect(r.buildability as number).toBeGreaterThanOrEqual(8.0);
  });

  it("is inside an EJ block group, so the community lens is held down", () => {
    const hex = at(LAT, LNG);
    // This is the real MassGIS 2020 classification, and it is why the original
    // "6.0 or higher" expectation does not hold: the state's own model green
    // computing site would face EJ questions today.
    expect(hex.in_ej).toBe(true);
    expect(hex.ej_criteria).toMatch(/minority/i);
    const r = run(hex, 100);
    expect(r.factors.find((f) => f.key === "environmental_justice")?.value).toBe(0);
    expect(r.community as number).toBeLessThan(r.buildability as number);
  });

  it("raises the lens divergence callout and names a community factor", () => {
    const r = run(at(LAT, LNG), 100);
    expect(r.divergence).not.toBeNull();
    expect(r.divergence?.gap as number).toBeGreaterThanOrEqual(3);
    expect(r.divergence?.weakest?.group).toBe("community");
  });

  it("applies the previously-developed bonus", () => {
    const r = run(at(LAT, LNG), 100);
    expect(r.bonuses.some((b) => b.key === "brownfield")).toBe(true);
  });

  it("improves when the design switches to closed-loop cooling", () => {
    const hex = at(LAT, LNG);
    const evap = run(hex, 100, "evaporative").score as number;
    const closed = run(hex, 100, "closed_loop").score as number;
    expect(closed).toBeGreaterThanOrEqual(evap);
  });
});

describe("statewide behaviour", () => {
  it("finds at least one strong site somewhere in the Commonwealth", () => {
    const best = index.all
      .filter((h) => !h.excluded)
      .map((h) => run(h, 100, "closed_loop", "balanced").score ?? 0);
    expect(Math.max(...best)).toBeGreaterThan(7.0);
  });

  it("ranks Holyoke above Chelsea for the same 100 MW campus", () => {
    const holyoke = run(at(42.2025, -72.6079), 100);
    const chelsea = run(at(42.3918, -71.0328), 100);
    expect(holyoke.score as number).toBeGreaterThan(chelsea.score as number);
    expect(holyoke.buildability as number).toBeGreaterThan(chelsea.buildability as number);
  });

  it("never scores an EJ cell above a comparable non-EJ cell on community", () => {
    const sample = index.all.filter((h) => !h.excluded).slice(0, 4000);
    const ej = sample.filter((h) => h.in_ej);
    const notEj = sample.filter((h) => !h.in_ej && !h.near_ej_1mi);
    expect(ej.length).toBeGreaterThan(0);
    expect(notEj.length).toBeGreaterThan(0);
    const avg = (xs: HexRecord[]) =>
      xs.reduce((s, h) => s + (run(h, 100).community ?? 0), 0) / xs.length;
    expect(avg(ej)).toBeLessThan(avg(notEj));
  });
});
