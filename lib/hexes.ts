/**
 * Loads and decodes public/data/hexes.json.
 *
 * The file on disk is columnar (field list + row arrays + string dictionaries)
 * so the statewide grid stays small enough to ship as a static asset. This
 * module decodes it into the per-hex object shape described in ATLAS.md 5.2.
 */

import { cellToLatLng, latLngToCell } from "h3-js";
import type { HexRecord, LandClass } from "./types";

export interface HexFile {
  format: string;
  generated_at: string;
  h3_resolution: number;
  count: number;
  fields: string[];
  bool_fields: string[];
  dictionaries: Record<string, string[]>;
  rows: (string | number | null)[][];
}

export interface FieldMeta {
  source: string | null;
  status: "verified" | "modeled" | "proxy" | "unavailable";
  null_count: number;
  coverage: number;
}

export interface SourceMeta {
  name: string;
  publisher: string;
  url: string;
  landing_page?: string;
  vintage: string;
  license: string;
  status: string;
  caveat?: string;
}

export interface DataMeta {
  generated_at: string;
  h3_resolution: number;
  hex_count: number;
  hex_area_km2: number;
  projection: string;
  excluded_count: number;
  sources: Record<string, SourceMeta>;
  fields: Record<string, FieldMeta>;
  notes: string[];
}

export class HexIndex {
  readonly resolution: number;
  readonly generatedAt: string;
  private readonly byId = new Map<string, HexRecord>();
  readonly all: HexRecord[];

  constructor(file: HexFile) {
    this.resolution = file.h3_resolution;
    this.generatedAt = file.generated_at;
    const idx: Record<string, number> = {};
    file.fields.forEach((f, i) => (idx[f] = i));
    const dict = file.dictionaries ?? {};
    const bools = new Set(file.bool_fields ?? []);

    const str = (row: (string | number | null)[], f: string): string | null => {
      const v = row[idx[f]];
      if (v === null || v === undefined) return null;
      if (typeof v === "number") return dict[f]?.[v] ?? null;
      return v;
    };
    const n = (row: (string | number | null)[], f: string): number | null => {
      const v = row[idx[f]];
      return typeof v === "number" ? v : null;
    };
    const b = (row: (string | number | null)[], f: string): boolean | null => {
      const v = row[idx[f]];
      if (v === null || v === undefined) return null;
      return v === 1;
    };

    this.all = file.rows.map((row) => {
      const h3 = row[idx.h3] as string;
      const [lat, lng] = cellToLatLng(h3);
      // Contract: each d_tx* is "distance to a line of at least this voltage",
      // so the sets are nested and the distances must be non-decreasing.
      const d69 = n(row, "d_tx69_km");
      let d115 = n(row, "d_tx115_km");
      let d345 = n(row, "d_tx345_km");
      if (d69 !== null && d115 !== null) d115 = Math.max(d69, d115);
      if (d115 !== null && d345 !== null) d345 = Math.max(d115, d345);

      const rec: HexRecord = {
        h3,
        lat,
        lng,
        town: str(row, "town"),
        land_class: str(row, "land_class") as LandClass | null,
        land_use_name: str(row, "land_use_name"),
        land_cover_name: str(row, "land_cover_name"),
        d_tx69_km: d69,
        d_tx115_km: d115,
        d_tx345_km: d345,
        d_clean_km: n(row, "d_clean_km"),
        d_highway_km: n(row, "d_highway_km"),
        d_fiber_km: n(row, "d_fiber_km"),
        d_ej_km: n(row, "d_ej_km"),
        d_dw_zone2_km: n(row, "d_dw_zone2_km"),
        pop_1km: n(row, "pop_1km"),
        developed_frac_1km: n(row, "developed_frac_1km"),
        water_stress: n(row, "water_stress"),
        mlp_town: b(row, "mlp_town"),
        school_or_hospital_500m: b(row, "school_or_hospital_500m"),
        in_ej: b(row, "in_ej"),
        near_ej_1mi: b(row, "near_ej_1mi"),
        in_sw_supply_watershed: b(row, "in_sw_supply_watershed"),
        flood_100yr: b(row, "flood_100yr"),
        flood_500yr: b(row, "flood_500yr"),
        coastal_slr: b(row, "coastal_slr"),
        brownfield: b(row, "brownfield"),
        aul_site_500m: b(row, "aul_site_500m"),
        excluded: b(row, "excluded") === true,
        ej_criteria: str(row, "ej_criteria"),
        exclude_reason: str(row, "exclude_reason"),
      };
      this.byId.set(h3, rec);
      return rec;
    });
    void bools;
  }

  get(h3: string): HexRecord | undefined {
    return this.byId.get(h3);
  }

  /** Snap a click to its H3 cell. Returns undefined outside the grid. */
  at(lat: number, lng: number): HexRecord | undefined {
    return this.byId.get(latLngToCell(lat, lng, this.resolution));
  }

  get size(): number {
    return this.all.length;
  }
}

let cache: Promise<{ index: HexIndex; meta: DataMeta }> | null = null;

/** Browser-side loader. Cached for the life of the page. */
export function loadHexData(): Promise<{ index: HexIndex; meta: DataMeta }> {
  if (!cache) {
    cache = (async () => {
      const [hexRes, metaRes] = await Promise.all([
        fetch("/data/hexes.json"),
        fetch("/data/meta.json"),
      ]);
      if (!hexRes.ok) throw new Error(`hexes.json: ${hexRes.status}`);
      if (!metaRes.ok) throw new Error(`meta.json: ${metaRes.status}`);
      const file = (await hexRes.json()) as HexFile;
      const meta = (await metaRes.json()) as DataMeta;
      return { index: new HexIndex(file), meta };
    })();
  }
  return cache;
}

export const KM_PER_DEG_LAT = 110.574;

/** Great-circle distance in km, good enough for a 25 km neighbourhood search. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371.0088;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
