/** Shared types for the Atlas screening model. */

export type Lens = "resident" | "balanced" | "developer";
export type Cooling = "evaporative" | "closed_loop" | "air";

/** Land readiness classes, derived from MassGIS 2016 Land Cover / Land Use. */
export type LandClass =
  | "industrial"
  | "commercial"
  | "other_developed"
  | "open_land"
  | "agriculture"
  | "forest"
  | "residential";

/**
 * How much a displayed number can be trusted (UI_DESIGN.md section 12).
 * `proxy` means the value measures something adjacent to, but not the same as,
 * the thing the label implies.
 */
export type DataStatus = "verified" | "modeled" | "proxy" | "unavailable";

export type FactorKey =
  | "grid_access"
  | "clean_power"
  | "fiber"
  | "land_readiness"
  | "residents"
  | "environmental_justice"
  | "water"
  | "climate_risk";

export type LensGroup = "buildability" | "community";

/** One hex of the statewide screening grid. Raw measurements only. */
export interface HexRecord {
  h3: string;
  lat: number;
  lng: number;
  town: string | null;
  land_class: LandClass | null;
  land_use_name: string | null;
  land_cover_name: string | null;
  /** Distance to the nearest mapped line of at least this voltage, km. */
  d_tx69_km: number | null;
  d_tx115_km: number | null;
  d_tx345_km: number | null;
  d_clean_km: number | null;
  d_highway_km: number | null;
  /** Null unless a real fiber-route dataset is wired in. Never highway distance. */
  d_fiber_km: number | null;
  d_ej_km: number | null;
  d_dw_zone2_km: number | null;
  pop_1km: number | null;
  developed_frac_1km: number | null;
  water_stress: number | null;
  mlp_town: boolean | null;
  school_or_hospital_500m: boolean | null;
  in_ej: boolean | null;
  near_ej_1mi: boolean | null;
  in_sw_supply_watershed: boolean | null;
  flood_100yr: boolean | null;
  flood_500yr: boolean | null;
  coastal_slr: boolean | null;
  brownfield: boolean | null;
  aul_site_500m: boolean | null;
  excluded: boolean;
  ej_criteria: string | null;
  exclude_reason: string | null;
}

export interface FactorResult {
  key: FactorKey;
  label: string;
  group: LensGroup;
  weight: number;
  /** Normalised 0..1 where 1 is most favourable. Null means no data; the
   *  factor is then dropped from both numerator and denominator. */
  value: number | null;
  /** The underlying measurement, written for a human. */
  raw: string;
  status: DataStatus;
  sourceId: string | null;
  /** A caveat that must stay visible next to the number. */
  note?: string;
}

export interface Bonus {
  key: string;
  label: string;
  amount: number;
}

/** A question the screen cannot answer. Never hidden behind a good score. */
export interface Unresolved {
  key: string;
  label: string;
  detail: string;
  severity: "critical" | "open";
}

export interface Band {
  key: "strong" | "workable" | "contested" | "avoid" | "fatal";
  label: string;
  color: string;
  min: number;
  max: number;
}

export interface ScoreResult {
  h3: string;
  town: string | null;
  mw: number;
  cooling: Cooling;
  lens: Lens;
  alpha: number;
  excluded: boolean;
  exclusionReasons: string[];
  /** Null only when no factor in either lens has data. */
  score: number | null;
  band: Band;
  buildability: number | null;
  community: number | null;
  factors: FactorResult[];
  bonuses: Bonus[];
  bonusTotal: number;
  /** Set when the two lenses disagree by 3 points or more. */
  divergence: { gap: number; weakest: FactorResult | null } | null;
  unresolved: Unresolved[];
  coverage: {
    withData: number;
    total: number;
    /** Share of each lens's weight that is actually measured, 0..1. */
    buildabilityWeight: number;
    communityWeight: number;
  };
}
