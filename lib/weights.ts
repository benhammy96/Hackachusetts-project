/**
 * Scoring constants. Mirrors ATLAS.md section 4 and .kiro/steering/scoring.md.
 *
 * Edit the tables here (or the steering file, which the `scoring-weights` hook
 * checks against this file) rather than scattering magic numbers through
 * lib/score.ts.
 */

import type { Band, Cooling, FactorKey, LandClass, Lens, LensGroup } from "./types";

export const FACTORS: Record<
  FactorKey,
  { label: string; group: LensGroup; weight: number }
> = {
  grid_access: { label: "Grid access", group: "buildability", weight: 35 },
  clean_power: { label: "Clean power proximity", group: "buildability", weight: 25 },
  fiber: { label: "Fiber and latency", group: "buildability", weight: 20 },
  land_readiness: { label: "Land readiness", group: "buildability", weight: 20 },
  residents: { label: "Residents nearby", group: "community", weight: 30 },
  environmental_justice: {
    label: "Environmental justice",
    group: "community",
    weight: 30,
  },
  water: { label: "Water", group: "community", weight: 20 },
  climate_risk: { label: "Climate risk", group: "community", weight: 20 },
};

export const FACTOR_ORDER: FactorKey[] = [
  "grid_access",
  "clean_power",
  "fiber",
  "land_readiness",
  "residents",
  "environmental_justice",
  "water",
  "climate_risk",
];

/** Exponent applied to Buildability in `B^a * C^(1-a)`. */
export const LENS_ALPHA: Record<Lens, number> = {
  resident: 0.35,
  balanced: 0.5,
  developer: 0.65,
};

export const LENS_LABEL: Record<Lens, string> = {
  resident: "Resident",
  balanced: "Balanced",
  developer: "Developer",
};

export const COOLING_LABEL: Record<Cooling, string> = {
  evaporative: "Evaporative",
  closed_loop: "Closed loop",
  air: "Air cooled",
};

export interface MwPreset {
  mw: number;
  name: string;
  /** Modelling assumption, not an engineering rule (ATLAS.md 4.3). */
  requiredKv: 69 | 115 | 345;
  /** Residents-within-1km threshold used by the residents factor. */
  popThreshold: number;
  eo658Applies: boolean;
}

export const MW_PRESETS: MwPreset[] = [
  { mw: 5, name: "Edge", requiredKv: 69, popThreshold: 8000, eo658Applies: false },
  { mw: 25, name: "Enterprise", requiredKv: 69, popThreshold: 5000, eo658Applies: false },
  { mw: 100, name: "Campus", requiredKv: 115, popThreshold: 3000, eo658Applies: true },
  { mw: 300, name: "Hyperscale", requiredKv: 345, popThreshold: 1500, eo658Applies: true },
];

export function presetFor(mw: number): MwPreset {
  return MW_PRESETS.find((p) => p.mw === mw) ?? MW_PRESETS[2];
}

/** Land readiness values by class (ATLAS.md 4.2). `open_land` is an Atlas
 *  extension: MassGIS land cover distinguishes grassland and scrub, which the
 *  original table did not list. It is scored like agriculture. */
export const LAND_READINESS: Record<LandClass, number> = {
  industrial: 1.0,
  commercial: 0.8,
  other_developed: 0.5,
  open_land: 0.3,
  agriculture: 0.3,
  forest: 0.1,
  residential: 0.0,
};

export const LAND_CLASS_LABEL: Record<LandClass, string> = {
  industrial: "Industrial",
  commercial: "Commercial",
  other_developed: "Other developed",
  open_land: "Open land",
  agriculture: "Agriculture",
  forest: "Forest",
  residential: "Residential",
};

export const BANDS: Band[] = [
  { key: "strong", label: "Strong site", color: "#68C49A", min: 8.0, max: 10 },
  { key: "workable", label: "Workable with conditions", color: "#A8C977", min: 6.0, max: 7.99 },
  { key: "contested", label: "Contested site", color: "#E6B765", min: 4.0, max: 5.99 },
  { key: "avoid", label: "Do not build here", color: "#E27D77", min: 0, max: 3.99 },
];

export const FATAL_BAND: Band = {
  key: "fatal",
  label: "Fatal flaw",
  color: "#7B8794",
  min: 0,
  max: 0,
};

export function bandFor(score: number | null, excluded: boolean): Band {
  if (excluded) return FATAL_BAND;
  if (score === null) return { ...FATAL_BAND, key: "fatal", label: "Not enough data" };
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
}

/** Bonus amounts, capped in total at +1.0 (ATLAS.md 4.5). */
export const BONUS = {
  brownfield: 0.5,
  closedLoop: 0.3,
  wasteHeat: 0.2,
  cap: 1.0,
};

/** Building density within 1 km above which waste-heat reuse is plausible. */
export const WASTE_HEAT_DENSITY_THRESHOLD = 0.35;
