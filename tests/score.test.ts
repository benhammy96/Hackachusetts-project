import { describe, expect, it } from "vitest";
import {
  clamp01,
  cleanPowerFactor,
  climateRiskFactor,
  environmentalJusticeFactor,
  fiberFactor,
  gridAccessFactor,
  landReadinessFactor,
  residentsFactor,
  score,
  waterFactor,
} from "../lib/score";
import { BONUS, FACTORS, LAND_READINESS, presetFor } from "../lib/weights";
import { makeHex } from "./fixtures";

describe("clamp01", () => {
  it("bounds to [0,1]", () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(9)).toBe(1);
  });
});

describe("grid access factor", () => {
  it("is 1.0 within 1 km of a qualifying line", () => {
    const f = gridAccessFactor(makeHex({ d_tx115_km: 0.4 }), 100);
    expect(f.value).toBe(1);
    expect(f.raw).toContain("115 kV");
  });

  it("decays linearly to 0 at 15 km", () => {
    expect(gridAccessFactor(makeHex({ d_tx115_km: 8 }), 100).value).toBeCloseTo(0.5, 6);
    expect(gridAccessFactor(makeHex({ d_tx115_km: 15 }), 100).value).toBe(0);
    expect(gridAccessFactor(makeHex({ d_tx115_km: 40 }), 100).value).toBe(0);
  });

  it("reads the voltage tier the MW preset requires", () => {
    const hex = makeHex({ d_tx69_km: 1, d_tx115_km: 5, d_tx345_km: 15 });
    expect(gridAccessFactor(hex, 5).value).toBe(1);
    expect(gridAccessFactor(hex, 25).value).toBe(1);
    expect(gridAccessFactor(hex, 100).value).toBeCloseTo(1 - 4 / 14, 6);
    expect(gridAccessFactor(hex, 300).value).toBe(0);
  });

  it("is unavailable, not zero, when no line is mapped", () => {
    const f = gridAccessFactor(makeHex({ d_tx345_km: null }), 300);
    expect(f.value).toBeNull();
    expect(f.status).toBe("unavailable");
  });

  it("always warns that distance is not capacity", () => {
    expect(gridAccessFactor(makeHex(), 100).note).toMatch(/not available interconnection capacity/i);
  });
});

describe("clean power factor", () => {
  it("decays to 0 at 30 km", () => {
    expect(cleanPowerFactor(makeHex({ d_clean_km: 0 }), 100).value).toBe(1);
    expect(cleanPowerFactor(makeHex({ d_clean_km: 15 }), 100).value).toBeCloseTo(0.5, 6);
    expect(cleanPowerFactor(makeHex({ d_clean_km: 30 }), 100).value).toBe(0);
  });

  it("adds 0.2 in a municipal light plant town", () => {
    const plain = cleanPowerFactor(makeHex({ d_clean_km: 15, mlp_town: false }), 100);
    const mlp = cleanPowerFactor(makeHex({ d_clean_km: 15, mlp_town: true }), 100);
    expect((mlp.value as number) - (plain.value as number)).toBeCloseTo(0.2, 6);
  });

  it("floors at 0.6 when EO 658 is not triggered", () => {
    expect(cleanPowerFactor(makeHex({ d_clean_km: 29 }), 25).value).toBe(0.6);
    expect(cleanPowerFactor(makeHex({ d_clean_km: 29 }), 100).value).toBeLessThan(0.6);
  });

  it("is labelled a proxy for procurement", () => {
    const f = cleanPowerFactor(makeHex(), 100);
    expect(f.status).toBe("proxy");
    expect(f.note).toMatch(/not a clean-energy procurement pathway/i);
  });
});

describe("fiber factor", () => {
  it("is unavailable when no fiber dataset is loaded", () => {
    const f = fiberFactor(makeHex({ d_fiber_km: null, d_highway_km: 2.4 }));
    expect(f.value).toBeNull();
    expect(f.status).toBe("unavailable");
  });

  it("never presents highway distance as fiber access", () => {
    const f = fiberFactor(makeHex({ d_fiber_km: null, d_highway_km: 2.4 }));
    expect(f.raw).toBe("Not available");
    expect(f.note).toMatch(/not fiber access/i);
  });

  it("scores real fiber distance when present", () => {
    expect(fiberFactor(makeHex({ d_fiber_km: 10 })).value).toBeCloseTo(0.5, 6);
    expect(fiberFactor(makeHex({ d_fiber_km: 20 })).value).toBe(0);
  });
});

describe("land readiness factor", () => {
  it("follows the class table", () => {
    for (const [cls, expected] of Object.entries(LAND_READINESS)) {
      const f = landReadinessFactor(makeHex({ land_class: cls as never }));
      expect(f.value).toBe(expected);
    }
  });

  it("is unavailable for an unmapped class", () => {
    const f = landReadinessFactor(makeHex({ land_class: null }));
    expect(f.value).toBeNull();
    expect(f.status).toBe("unavailable");
  });
});

describe("residents factor", () => {
  it("uses the population threshold for the size", () => {
    expect(residentsFactor(makeHex({ pop_1km: 0 }), 100).value).toBe(1);
    expect(residentsFactor(makeHex({ pop_1km: 1500 }), 100).value).toBeCloseTo(0.5, 6);
    expect(residentsFactor(makeHex({ pop_1km: 3000 }), 100).value).toBe(0);
    expect(residentsFactor(makeHex({ pop_1km: 1500 }), 300).value).toBe(0);
  });

  it("subtracts 0.3 for a school or hospital within 500 m", () => {
    const a = residentsFactor(makeHex({ pop_1km: 0, school_or_hospital_500m: false }), 100);
    const b = residentsFactor(makeHex({ pop_1km: 0, school_or_hospital_500m: true }), 100);
    expect((a.value as number) - (b.value as number)).toBeCloseTo(0.3, 6);
  });

  it("does not claim to measure consent", () => {
    expect(residentsFactor(makeHex(), 100).note).toMatch(/not a measure of consent/i);
  });
});

describe("environmental justice factor", () => {
  it("is 0 inside an EJ block group", () => {
    const f = environmentalJusticeFactor(makeHex({ in_ej: true, ej_criteria: "Minority" }));
    expect(f.value).toBe(0);
    expect(f.raw).toContain("Minority");
  });

  it("is 0.4 within a mile", () => {
    expect(environmentalJusticeFactor(makeHex({ near_ej_1mi: true, d_ej_km: 1.2 })).value).toBe(0.4);
  });

  it("rises with distance beyond a mile and caps at 1.0", () => {
    expect(environmentalJusticeFactor(makeHex({ d_ej_km: 0 })).value).toBe(0.6);
    expect(environmentalJusticeFactor(makeHex({ d_ej_km: 4 })).value).toBeCloseTo(0.8, 6);
    expect(environmentalJusticeFactor(makeHex({ d_ej_km: 8 })).value).toBe(1);
    expect(environmentalJusticeFactor(makeHex({ d_ej_km: 50 })).value).toBe(1);
  });
});

describe("water factor", () => {
  it("uses the basin stress index when it exists", () => {
    const f = waterFactor(makeHex({ water_stress: 0.7, d_dw_zone2_km: 9 }), 100, "closed_loop");
    expect(f.value).toBeCloseTo(0.3, 6);
    expect(f.status).toBe("verified");
  });

  it("penalises a drinking water Zone II within 1 km", () => {
    const near = waterFactor(makeHex({ water_stress: 0, d_dw_zone2_km: 0.5 }), 100, "closed_loop");
    const far = waterFactor(makeHex({ water_stress: 0, d_dw_zone2_km: 5 }), 100, "closed_loop");
    expect((far.value as number) - (near.value as number)).toBeCloseTo(0.3, 6);
  });

  it("penalises evaporative cooling in proportion to size", () => {
    const closed = waterFactor(makeHex({ water_stress: 0 }), 300, "closed_loop").value as number;
    const evap = waterFactor(makeHex({ water_stress: 0 }), 300, "evaporative").value as number;
    expect(closed - evap).toBeCloseTo(0.3, 6);
    const evapSmall = waterFactor(makeHex({ water_stress: 0 }), 100, "evaporative")
      .value as number;
    expect(closed - evapSmall).toBeCloseTo(0.1, 6);
  });

  it("is dropped, not defaulted to favourable, when no stress index exists", () => {
    // Starting from 1.0 would turn "stress was not measured" into "no water
    // concern here", which ATLAS.md 16.4 rules out.
    const f = waterFactor(
      makeHex({ water_stress: null, in_sw_supply_watershed: false }),
      100,
      "evaporative",
    );
    expect(f.value).toBeNull();
    expect(f.status).toBe("unavailable");
    expect(f.note).toMatch(/rather than defaulted to favourable/i);
  });

  it("still reports the water evidence it does hold", () => {
    const f = waterFactor(
      makeHex({ water_stress: null, in_sw_supply_watershed: true, d_dw_zone2_km: 0.4 }),
      300,
      "evaporative",
    );
    expect(f.value).toBeNull();
    expect(f.note).toMatch(/surface water supply watershed/i);
    expect(f.note).toMatch(/Zone II within 1 km/i);
    expect(f.note).toMatch(/evaporative cooling/i);
  });
});

describe("lens coverage", () => {
  it("reports how much of each lens is actually measured", () => {
    // The shipped build has no fiber dataset and no basin stress index, so a
    // quarter of each lens is unmeasured. That has to be visible.
    const r = score({
      hex: makeHex({ d_fiber_km: null, water_stress: null }),
      mw: 100,
      cooling: "evaporative",
      lens: "balanced",
    });
    expect(r.coverage.buildabilityWeight).toBeCloseTo(0.8, 6);
    expect(r.coverage.communityWeight).toBeCloseTo(0.8, 6);
    expect(r.coverage.withData).toBe(6);
  });

  it("reports full coverage when every factor has data", () => {
    const r = score({
      hex: makeHex({ d_fiber_km: 5, water_stress: 0.3 }),
      mw: 100,
      cooling: "evaporative",
      lens: "balanced",
    });
    expect(r.coverage.buildabilityWeight).toBe(1);
    expect(r.coverage.communityWeight).toBe(1);
    expect(r.coverage.withData).toBe(8);
  });
});

describe("climate risk factor", () => {
  it("is 1.0 with both hazards screened and absent", () => {
    expect(climateRiskFactor(makeHex({ flood_500yr: false, coastal_slr: false })).value).toBe(1);
  });

  it("takes the minimum of the applicable hazards", () => {
    expect(climateRiskFactor(makeHex({ flood_500yr: true })).value).toBe(0.5);
    expect(climateRiskFactor(makeHex({ coastal_slr: true })).value).toBe(0.4);
    expect(climateRiskFactor(makeHex({ flood_500yr: true, coastal_slr: true })).value).toBe(0.4);
  });

  it("is unavailable when neither hazard was screened", () => {
    const f = climateRiskFactor(makeHex({ flood_500yr: null, coastal_slr: null }));
    expect(f.value).toBeNull();
    expect(f.status).toBe("unavailable");
  });
});

describe("score aggregation", () => {
  const base = { mw: 100, cooling: "closed_loop" as const, lens: "balanced" as const };

  it("returns exactly 0 for an excluded site, before any bonus", () => {
    const r = score({
      hex: makeHex({
        excluded: true,
        exclude_reason: "Drinking water protection Zone A (Quabbin)",
        land_class: "industrial",
        brownfield: true,
      }),
      ...base,
    });
    expect(r.score).toBe(0);
    expect(r.band.key).toBe("fatal");
    expect(r.bonuses).toHaveLength(0);
    expect(r.bonusTotal).toBe(0);
    expect(r.exclusionReasons[0]).toContain("Zone A");
  });

  it("still reports factor detail for an excluded site", () => {
    const r = score({ hex: makeHex({ excluded: true }), ...base });
    expect(r.factors).toHaveLength(8);
    expect(r.buildability).not.toBeNull();
  });

  it("drops a missing factor from numerator and denominator", () => {
    const withFiber = score({ hex: makeHex({ d_fiber_km: 0 }), ...base });
    const withoutFiber = score({ hex: makeHex({ d_fiber_km: null }), ...base });
    // A perfect fiber score would lift buildability; its absence must not be
    // treated as a zero, so the remaining factors keep their relative weight.
    expect(withFiber.buildability).toBeGreaterThan(withoutFiber.buildability as number);
    const b = withoutFiber.factors.filter((f) => f.group === "buildability" && f.value !== null);
    const wsum = b.reduce((s, f) => s + f.weight, 0);
    expect(wsum).toBe(FACTORS.grid_access.weight + FACTORS.clean_power.weight + FACTORS.land_readiness.weight);
  });

  it("is the geometric mean of the two lenses under the balanced lens", () => {
    const r = score({ hex: makeHex(), ...base });
    const expected = Math.sqrt((r.buildability as number) * (r.community as number));
    expect(r.score as number).toBeCloseTo(
      Math.min(10, Math.round((expected + r.bonusTotal) * 10) / 10),
      1,
    );
  });

  it("weights the community lens more under the resident lens", () => {
    const hex = makeHex({ pop_1km: 2800, d_tx115_km: 1 });
    const dev = score({ hex, ...base, lens: "developer" });
    const res = score({ hex, ...base, lens: "resident" });
    expect(res.score as number).toBeLessThan(dev.score as number);
    expect(res.alpha).toBe(0.35);
    expect(dev.alpha).toBe(0.65);
  });

  it("caps total bonuses at +1.0", () => {
    const r = score({
      hex: makeHex({ land_class: "industrial", brownfield: true, developed_frac_1km: 0.9 }),
      ...base,
      cooling: "air",
    });
    expect(r.bonusTotal).toBeLessThanOrEqual(BONUS.cap);
    expect(r.bonuses.length).toBe(3);
  });

  it("never exceeds 10", () => {
    const r = score({
      hex: makeHex({
        land_class: "industrial",
        brownfield: true,
        developed_frac_1km: 1,
        d_tx69_km: 0,
        d_tx115_km: 0,
        d_tx345_km: 0,
        d_clean_km: 0,
        d_fiber_km: 0,
        pop_1km: 0,
        d_ej_km: 50,
        d_dw_zone2_km: 50,
      }),
      ...base,
      cooling: "air",
    });
    expect(r.score as number).toBeLessThanOrEqual(10);
  });

  it("flags lens divergence and names the weakest factor", () => {
    const r = score({
      hex: makeHex({
        d_tx115_km: 1,
        d_clean_km: 0,
        land_class: "industrial",
        pop_1km: 2900,
        in_ej: true,
      }),
      ...base,
    });
    expect(r.divergence).not.toBeNull();
    expect(r.divergence?.gap).toBeGreaterThanOrEqual(3);
    expect(r.divergence?.weakest?.label).toBeTruthy();
  });

  it("always surfaces the unverifiable constraints", () => {
    const r = score({ hex: makeHex(), ...base });
    const keys = r.unresolved.map((u) => u.key);
    expect(keys).toContain("interconnection");
    expect(keys).toContain("zoning");
    expect(keys).toContain("availability");
  });

  it("keeps critical warnings visible on a high-scoring site", () => {
    const r = score({
      hex: makeHex({
        land_class: "industrial",
        d_tx115_km: 0.5,
        d_clean_km: 0,
        pop_1km: 0,
        d_ej_km: 40,
      }),
      ...base,
    });
    expect(r.score as number).toBeGreaterThan(7);
    expect(r.unresolved.filter((u) => u.severity === "critical").length).toBeGreaterThan(0);
  });

  it("uses the preset population threshold table", () => {
    expect(presetFor(5).popThreshold).toBe(8000);
    expect(presetFor(300).popThreshold).toBe(1500);
    expect(presetFor(300).requiredKv).toBe(345);
  });
});
