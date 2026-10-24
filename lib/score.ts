/**
 * The Atlas screening score. Pure, synchronous, no I/O — the browser recomputes
 * it on every lens / MW / cooling change, and the brief agent calls the same
 * code server-side so the narrative can never drift from the number.
 *
 * Implements ATLAS.md section 4 with the corrections from section 16.4:
 *   * an excluded site returns exactly 0 *before* bonuses are applied;
 *   * a factor with no data is dropped from numerator and denominator, so
 *     missing data never reads as a bad site and never as a good one;
 *   * highway distance is never presented as fiber access;
 *   * proximity to generation is labelled a proxy, not procurement.
 */

import {
  BANDS,
  BONUS,
  FACTORS,
  FACTOR_ORDER,
  LAND_READINESS,
  LAND_CLASS_LABEL,
  LENS_ALPHA,
  WASTE_HEAT_DENSITY_THRESHOLD,
  bandFor,
  presetFor,
} from "./weights";
import type {
  Bonus,
  Cooling,
  FactorKey,
  FactorResult,
  HexRecord,
  Lens,
  ScoreResult,
  Unresolved,
} from "./types";

export interface ScoreInput {
  hex: HexRecord;
  mw: number;
  cooling: Cooling;
  lens: Lens;
}

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

const km = (v: number | null): string =>
  v === null ? "not available" : v < 10 ? `${v.toFixed(1)} km` : `${Math.round(v)} km`;

const NOT_AVAILABLE = "Not available";

function factor(
  key: FactorKey,
  value: number | null,
  raw: string,
  status: FactorResult["status"],
  sourceId: string | null,
  note?: string,
): FactorResult {
  const meta = FACTORS[key];
  return {
    key,
    label: meta.label,
    group: meta.group,
    weight: meta.weight,
    value: value === null ? null : clamp01(value),
    raw,
    status,
    sourceId,
    note,
  };
}

// --- individual factors -----------------------------------------------------

export function gridAccessFactor(h: HexRecord, mw: number): FactorResult {
  const { requiredKv } = presetFor(mw);
  const d =
    requiredKv === 345 ? h.d_tx345_km : requiredKv === 115 ? h.d_tx115_km : h.d_tx69_km;
  const value = d === null ? null : clamp01(1 - (d - 1) / 14);
  return factor(
    "grid_access",
    value,
    d === null
      ? `No mapped line at ${requiredKv} kV or above`
      : `Nearest mapped ${requiredKv} kV+ line: ${km(d)}`,
    d === null ? "unavailable" : "verified",
    "osm_power_lines",
    `Distance to a line mapped in OpenStreetMap. Voltage threshold for ${mw} MW is an Atlas modelling assumption, and distance is not available interconnection capacity.`,
  );
}

export function cleanPowerFactor(h: HexRecord, mw: number): FactorResult {
  let value = h.d_clean_km === null ? null : clamp01(1 - h.d_clean_km / 30);
  const bits: string[] = [];
  if (value !== null && h.mlp_town) {
    value = clamp01(value + 0.2);
    bits.push("municipal light plant town");
  }
  if (value !== null && mw <= 25) {
    value = Math.max(value, 0.6);
    bits.push("EO 658 clean-energy duty not triggered at this size");
  }
  return factor(
    "clean_power",
    value,
    h.d_clean_km === null
      ? NOT_AVAILABLE
      : `Nearest mapped non-emitting generator: ${km(h.d_clean_km)}` +
        (bits.length ? ` (${bits.join("; ")})` : ""),
    h.d_clean_km === null ? "unavailable" : "proxy",
    "osm_power_plants",
    "Proximity to generation is not a clean-energy procurement pathway. A municipal light plant does not by itself establish Clean Energy Standard eligible supply.",
  );
}

export function fiberFactor(h: HexRecord): FactorResult {
  if (h.d_fiber_km === null) {
    return factor(
      "fiber",
      null,
      NOT_AVAILABLE,
      "unavailable",
      null,
      h.d_highway_km === null
        ? "No fiber-route dataset is loaded, so this factor is dropped from the score rather than guessed."
        : `No fiber-route dataset is loaded, so this factor is dropped from the score. Nearest major highway is ${km(h.d_highway_km)}, which is a road measurement and not fiber access.`,
    );
  }
  return factor(
    "fiber",
    clamp01(1 - h.d_fiber_km / 20),
    `Nearest mapped fiber route: ${km(h.d_fiber_km)}`,
    "verified",
    null,
  );
}

export function landReadinessFactor(h: HexRecord): FactorResult {
  if (h.land_class === null) {
    return factor(
      "land_readiness",
      null,
      NOT_AVAILABLE,
      "unavailable",
      "massgis_lclu2016",
      h.land_cover_name
        ? `Land cover is "${h.land_cover_name}", which Atlas does not map to a readiness class.`
        : "No MassGIS land cover record at this cell centre.",
    );
  }
  const uses = [h.land_use_name, h.land_cover_name].filter(Boolean).join(" / ");
  return factor(
    "land_readiness",
    LAND_READINESS[h.land_class],
    `${LAND_CLASS_LABEL[h.land_class]}${uses ? ` — MassGIS 2016: ${uses}` : ""}`,
    "verified",
    "massgis_lclu2016",
    "Land cover vintage is 2016 and says nothing about zoning or whether the parcel is available.",
  );
}

export function residentsFactor(h: HexRecord, mw: number): FactorResult {
  const { popThreshold } = presetFor(mw);
  if (h.pop_1km === null) {
    return factor("residents", null, NOT_AVAILABLE, "unavailable", "massgis_census_blocks");
  }
  let value = clamp01(1 - h.pop_1km / popThreshold);
  const extra: string[] = [];
  if (h.school_or_hospital_500m) {
    value = clamp01(value - 0.3);
    extra.push("school or hospital within 500 m");
  }
  return factor(
    "residents",
    value,
    `${h.pop_1km.toLocaleString()} residents within 1 km (threshold ${popThreshold.toLocaleString()} at ${mw} MW)` +
      (extra.length ? ` — ${extra.join("; ")}` : ""),
    "modeled",
    "massgis_census_blocks",
    "Population count is a measure of who is nearby. It is not a measure of consent or opposition.",
  );
}

export function environmentalJusticeFactor(h: HexRecord): FactorResult {
  if (h.in_ej) {
    return factor(
      "environmental_justice",
      0,
      `Inside a designated EJ block group${h.ej_criteria ? ` (${h.ej_criteria})` : ""}`,
      "verified",
      "massgis_ej2020",
      "Environmental justice is a protection in this model, never an advantage.",
    );
  }
  if (h.near_ej_1mi) {
    return factor(
      "environmental_justice",
      0.4,
      `Within 1 mile of an EJ block group (${km(h.d_ej_km)})`,
      "verified",
      "massgis_ej2020",
      "Environmental justice is a protection in this model, never an advantage.",
    );
  }
  if (h.d_ej_km === null) {
    return factor(
      "environmental_justice",
      null,
      NOT_AVAILABLE,
      "unavailable",
      "massgis_ej2020",
    );
  }
  return factor(
    "environmental_justice",
    0.6 + 0.4 * clamp01(h.d_ej_km / 8),
    `Nearest EJ block group: ${km(h.d_ej_km)}`,
    "verified",
    "massgis_ej2020",
  );
}

export function waterFactor(h: HexRecord, mw: number, cooling: Cooling): FactorResult {
  // The factor is anchored on basin water stress. Without that index there is no
  // honest base: starting from 1.0 would turn "we did not measure stress" into
  // "there is no water concern", which is the automatic-favourable-score failure
  // ATLAS.md 16.4 rules out. The verified water evidence Atlas does hold
  // (drinking water zones, supply watersheds, modelled draw) is reported as
  // evidence and as an unresolved question instead of being scored.
  if (h.water_stress === null) {
    const evidence: string[] = [];
    if (h.in_sw_supply_watershed === true) {
      evidence.push("inside a public surface water supply watershed");
    }
    if (h.d_dw_zone2_km !== null && h.d_dw_zone2_km <= 1) {
      evidence.push(`drinking water Zone II within 1 km (${km(h.d_dw_zone2_km)})`);
    }
    if (cooling === "evaporative") {
      evidence.push(`evaporative cooling selected at ${mw} MW`);
    }
    return factor(
      "water",
      null,
      NOT_AVAILABLE,
      "unavailable",
      null,
      "No basin water stress index is loaded in this build, so this factor is dropped from the score rather than defaulted to favourable." +
        (evidence.length ? ` Measured water context: ${evidence.join("; ")}.` : ""),
    );
  }

  let base = 1 - h.water_stress;
  const parts = [`basin water stress ${h.water_stress.toFixed(2)}`];
  if (h.d_dw_zone2_km !== null && h.d_dw_zone2_km <= 1) {
    base -= 0.3;
    parts.push(`drinking water Zone II within 1 km (${km(h.d_dw_zone2_km)})`);
  }
  if (cooling === "evaporative") {
    base -= (0.3 * mw) / 300;
    parts.push(`evaporative cooling at ${mw} MW`);
  }
  return factor("water", clamp01(base), parts.join("; "), "verified", null);
}

export function climateRiskFactor(h: HexRecord): FactorResult {
  const candidates: { v: number; why: string }[] = [];
  if (h.flood_500yr === true) {
    candidates.push({ v: 0.5, why: "in the FEMA 0.2% annual chance (500-year) floodplain" });
  }
  if (h.coastal_slr === true) {
    candidates.push({ v: 0.4, why: "within NOAA sea level rise inundation extent (up to 3 ft)" });
  }
  const unknown = h.flood_500yr === null && h.coastal_slr === null;
  if (unknown) {
    return factor("climate_risk", null, NOT_AVAILABLE, "unavailable", "fema_nfhl");
  }
  if (candidates.length === 0) {
    const checked: string[] = [];
    if (h.flood_500yr === false) checked.push("outside the 0.2% annual chance floodplain");
    if (h.coastal_slr === false) checked.push("outside mapped sea level rise inundation");
    return factor("climate_risk", 1.0, checked.join("; "), "verified", "fema_nfhl");
  }
  const worst = candidates.reduce((a, b) => (a.v <= b.v ? a : b));
  return factor(
    "climate_risk",
    worst.v,
    candidates.map((c) => c.why).join("; "),
    "verified",
    "fema_nfhl",
    "Mapped flood and inundation extents are preliminary screens, not a flood determination for a specific parcel.",
  );
}

// --- aggregate --------------------------------------------------------------

interface LensOutcome {
  value: number | null;
  /** Share of the lens weight that is actually measured. */
  measuredWeight: number;
  totalWeight: number;
}

function lensScore(factors: FactorResult[]): LensOutcome {
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const withData = factors.filter((f) => f.value !== null);
  const measuredWeight = withData.reduce((s, f) => s + f.weight, 0);
  if (measuredWeight === 0) return { value: null, measuredWeight, totalWeight };
  const num = withData.reduce((s, f) => s + f.weight * (f.value as number), 0);
  return { value: (10 * num) / measuredWeight, measuredWeight, totalWeight };
}

function collectUnresolved(h: HexRecord, factors: FactorResult[], mw: number): Unresolved[] {
  const out: Unresolved[] = [];
  out.push({
    key: "interconnection",
    label: "Grid capacity unverified",
    detail:
      `Atlas knows the distance to the nearest mapped ${presetFor(mw).requiredKv} kV+ line. ` +
      "It does not know whether the utility can deliver this load, and no interconnection study is referenced.",
    severity: "critical",
  });
  out.push({
    key: "zoning",
    label: "Zoning unknown",
    detail:
      "No municipal zoning district or special-permit status is loaded. Local bylaws decide whether this use is allowed at all.",
    severity: "critical",
  });
  out.push({
    key: "availability",
    label: "Land availability unknown",
    detail:
      "This is a 0.74 km² screening cell, not a parcel, and nothing here indicates ownership or that any land is for sale.",
    severity: "critical",
  });
  for (const f of factors) {
    if (f.status === "unavailable") {
      out.push({
        key: `missing_${f.key}`,
        label: `${f.label}: no data`,
        detail:
          (f.note ? `${f.note} ` : "") +
          `The factor is dropped from the score rather than filled with a default, so ${f.weight} of the weight in its lens is not being measured.`,
        severity: "open",
      });
    }
  }
  if (h.flood_100yr === null) {
    out.push({
      key: "flood_unknown",
      label: "Flood hazard not screened",
      detail: "No FEMA flood zone result for this cell, so the floodplain exclusion could not be tested.",
      severity: "critical",
    });
  }
  return out;
}

export function score(input: ScoreInput): ScoreResult {
  const { hex: h, mw, cooling, lens } = input;
  const alpha = LENS_ALPHA[lens];

  const factors: FactorResult[] = [
    gridAccessFactor(h, mw),
    cleanPowerFactor(h, mw),
    fiberFactor(h),
    landReadinessFactor(h),
    residentsFactor(h, mw),
    environmentalJusticeFactor(h),
    waterFactor(h, mw, cooling),
    climateRiskFactor(h),
  ].sort((a, b) => FACTOR_ORDER.indexOf(a.key) - FACTOR_ORDER.indexOf(b.key));

  const bOut = lensScore(factors.filter((f) => f.group === "buildability"));
  const cOut = lensScore(factors.filter((f) => f.group === "community"));
  const buildability = bOut.value;
  const community = cOut.value;
  const unresolved = collectUnresolved(h, factors, mw);
  const exclusionReasons = h.excluded
    ? (h.exclude_reason ?? "Excluded by a hard screen").split("; ").filter(Boolean)
    : [];
  const coverage = {
    withData: factors.filter((f) => f.value !== null).length,
    total: factors.length,
    buildabilityWeight: bOut.measuredWeight / bOut.totalWeight,
    communityWeight: cOut.measuredWeight / cOut.totalWeight,
  };

  // A hard exclusion short-circuits everything, before bonuses (ATLAS.md 16.4).
  if (h.excluded) {
    return {
      h3: h.h3,
      town: h.town,
      mw,
      cooling,
      lens,
      alpha,
      excluded: true,
      exclusionReasons,
      score: 0,
      band: bandFor(0, true),
      buildability,
      community,
      factors,
      bonuses: [],
      bonusTotal: 0,
      divergence: null,
      unresolved,
      coverage,
    };
  }

  const bonuses: Bonus[] = [];
  if (h.land_class === "industrial" || h.brownfield) {
    bonuses.push({
      key: "brownfield",
      label: h.brownfield
        ? "Previously developed site with a recorded Activity and Use Limitation"
        : "Industrial land (previously developed)",
      amount: BONUS.brownfield,
    });
  }
  if (cooling === "closed_loop" || cooling === "air") {
    bonuses.push({
      key: "cooling",
      label: cooling === "air" ? "Air cooling selected" : "Closed-loop cooling selected",
      amount: BONUS.closedLoop,
    });
  }
  if (
    h.developed_frac_1km !== null &&
    h.developed_frac_1km >= WASTE_HEAT_DENSITY_THRESHOLD
  ) {
    bonuses.push({
      key: "waste_heat",
      label: `Waste heat reuse plausible (${Math.round(h.developed_frac_1km * 100)}% developed within 1 km)`,
      amount: BONUS.wasteHeat,
    });
  }
  const bonusTotal = Math.min(
    BONUS.cap,
    bonuses.reduce((s, b) => s + b.amount, 0),
  );

  let base: number | null;
  if (buildability === null && community === null) base = null;
  else if (buildability === null) base = community;
  else if (community === null) base = buildability;
  else base = Math.pow(buildability, alpha) * Math.pow(community, 1 - alpha);

  const total = base === null ? null : Math.min(10, round1(base + bonusTotal));

  let divergence: ScoreResult["divergence"] = null;
  if (buildability !== null && community !== null) {
    const gap = Math.abs(buildability - community);
    if (gap >= 3) {
      const weakGroup = buildability < community ? "buildability" : "community";
      const candidates = factors.filter(
        (f) => f.group === weakGroup && f.value !== null,
      );
      const weakest = candidates.length
        ? candidates.reduce((a, b) =>
            (a.value as number) * a.weight <= (b.value as number) * b.weight ? a : b,
          )
        : null;
      divergence = { gap: round1(gap), weakest };
    }
  }

  return {
    h3: h.h3,
    town: h.town,
    mw,
    cooling,
    lens,
    alpha,
    excluded: false,
    exclusionReasons: [],
    score: total,
    band: bandFor(total, false),
    buildability: buildability === null ? null : round1(buildability),
    community: community === null ? null : round1(community),
    factors,
    bonuses,
    bonusTotal: round1(bonusTotal),
    divergence,
    unresolved,
    coverage,
  };
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** Colour for the map ramp. Mirrors the band table. */
export function colorForScore(score: number | null, excluded: boolean): [number, number, number] {
  if (excluded) return [96, 104, 115];
  if (score === null) return [80, 86, 94];
  const band = BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
  const hex = band.color.replace("#", "");
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}
