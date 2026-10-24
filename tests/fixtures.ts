import { cellToLatLng, latLngToCell } from "h3-js";
import type { HexRecord } from "../lib/types";

/**
 * A deliberately neutral hex: every field populated, nothing excluded, no
 * hazard flags. Tests override only the fields they care about.
 */
export function makeHex(over: Partial<HexRecord> = {}): HexRecord {
  const h3 = over.h3 ?? latLngToCell(42.2025, -72.6079, 8);
  const [lat, lng] = cellToLatLng(h3);
  return {
    h3,
    lat,
    lng,
    town: "TESTVILLE",
    land_class: "commercial",
    land_use_name: "Commercial",
    land_cover_name: "Impervious",
    d_tx69_km: 2,
    d_tx115_km: 4,
    d_tx345_km: 8,
    d_clean_km: 6,
    d_highway_km: 3,
    d_fiber_km: null,
    d_ej_km: 10,
    d_dw_zone2_km: 5,
    pop_1km: 500,
    developed_frac_1km: 0.2,
    water_stress: null,
    mlp_town: false,
    school_or_hospital_500m: false,
    in_ej: false,
    near_ej_1mi: false,
    in_sw_supply_watershed: false,
    flood_100yr: false,
    flood_500yr: false,
    coastal_slr: false,
    brownfield: false,
    aul_site_500m: false,
    excluded: false,
    ej_criteria: null,
    exclude_reason: null,
    ...over,
  };
}
