/** Reader-facing names for the raw fields in hexes.json / meta.json. */

export const FIELD_LABEL: Record<string, string> = {
  town: "Town",
  land_class: "Land readiness class",
  land_use_name: "Land use",
  land_cover_name: "Land cover",
  d_tx69_km: "Distance to a 69 kV+ line",
  d_tx115_km: "Distance to a 115 kV+ line",
  d_tx345_km: "Distance to a 345 kV+ line",
  d_clean_km: "Distance to non-emitting generation",
  mlp_town: "Municipal light plant town",
  d_highway_km: "Distance to a major highway (road access)",
  d_fiber_km: "Distance to a fiber route",
  pop_1km: "Residents within 1 km",
  school_or_hospital_500m: "School or hospital within 500 m",
  in_ej: "Inside an EJ block group",
  near_ej_1mi: "Within 1 mile of an EJ block group",
  d_ej_km: "Distance to an EJ block group",
  ej_criteria: "EJ criteria met",
  water_stress: "Water stress index",
  in_sw_supply_watershed: "Inside a surface water supply watershed",
  d_dw_zone2_km: "Distance to a drinking water Zone II",
  flood_100yr: "1% annual chance floodplain",
  flood_500yr: "0.2% annual chance floodplain",
  coastal_slr: "Sea level rise inundation, up to 3 ft",
  developed_frac_1km: "Developed share within 1 km",
  brownfield: "Previously developed site with an AUL",
  aul_site_500m: "AUL site within 500 m",
  excluded: "Hard exclusion",
  exclude_reason: "Exclusion reason",
};

/**
 * Fields that are only set where they apply, so partial coverage is expected
 * and is not a data gap.
 */
export const CONDITIONAL_FIELD: Record<string, string> = {
  ej_criteria: "set only for cells inside an EJ block group",
  exclude_reason: "set only for excluded cells",
};

/** What a source with no direct field is used for. */
export const SOURCE_ROLE_LABEL: Record<string, string> = {
  basemap: "Draws the basemap only. Not used in any score.",
  exclusion: "Used in the hard exclusion screen. A cell that overlaps it scores 0.",
};

export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field;
}
