/** Consistent number and unit formatting (UI_DESIGN.md section 4). */

export const NOT_AVAILABLE = "Not available";

export function fmtKm(v: number | null | undefined): string {
  if (v === null || v === undefined) return NOT_AVAILABLE;
  if (v < 1) return `${(v * 1000).toFixed(0)} m`;
  if (v < 10) return `${v.toFixed(1)} km`;
  return `${Math.round(v)} km`;
}

export function fmtScore(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : v.toFixed(1);
}

export function fmtMw(v: number): string {
  return `${v} MW`;
}

export function fmtUsdPerKwh(v: number): string {
  return `$${v.toFixed(3)}/kWh`;
}

export function fmtUsd(v: number): string {
  if (!isFinite(v)) return NOT_AVAILABLE;
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${Math.round(v / 1e3)}k`;
  return `$${Math.round(v)}`;
}

export function fmtInt(v: number | null | undefined): string {
  return v === null || v === undefined ? NOT_AVAILABLE : Math.round(v).toLocaleString("en-US");
}

export function fmtMwh(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M MWh`;
  if (v >= 1e3) return `${Math.round(v / 1e3).toLocaleString("en-US")}k MWh`;
  return `${Math.round(v).toLocaleString("en-US")} MWh`;
}

export function fmtTonnes(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M t CO2e`;
  if (v >= 1e3) return `${Math.round(v / 1e3).toLocaleString("en-US")}k t CO2e`;
  return `${Math.round(v).toLocaleString("en-US")} t CO2e`;
}

export function fmtPercent(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return NOT_AVAILABLE;
  return `${(v * 100).toFixed(digits)}%`;
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return NOT_AVAILABLE;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** A plain figure with grouping and up to four decimals, e.g. 0.2003, 8,760. */
export function fmtNumber(v: number | null | undefined): string {
  if (v === null || v === undefined || !isFinite(v)) return NOT_AVAILABLE;
  return v.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/** "24 Oct 2026, 19:27 UTC". Fixed to UTC so it matches the build log. */
export function fmtUtcDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return NOT_AVAILABLE;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

export function fmtLatLng(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export const STATUS_LABEL: Record<string, string> = {
  verified: "Verified",
  modeled: "Modeled",
  proxy: "Proxy",
  unavailable: "Unavailable",
  assumption: "Assumption",
};
