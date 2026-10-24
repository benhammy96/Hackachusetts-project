/**
 * Pre-renders briefs for the calibration sites into public/data/briefs-cache.json.
 *
 * This is the demo fallback described in ATLAS.md 6.3: if the model is
 * unreachable on stage, the panel still has real, grounded text for Holyoke,
 * Chelsea and Quabbin. The script drives the live /api/brief route, so cached
 * text is produced by exactly the same code path as a live request and cannot
 * drift from the score card.
 *
 * Usage:
 *   npm run build && npm run start -- --port 3310   # one terminal
 *   npm run briefs-cache                            # another
 *
 * Env: ATLAS_URL (default http://localhost:3310)
 */

import fs from "node:fs";
import path from "node:path";
import { latLngToCell } from "h3-js";

const BASE = process.env.ATLAS_URL ?? "http://localhost:3310";
const DATA = path.join(process.cwd(), "public", "data");

const LANGS = ["en", "es", "pt", "ht", "vi", "zh", "sq"];
const SITES = [
  { name: "Holyoke, near MGHPCC", lat: 42.2025, lng: -72.6079 },
  { name: "Chelsea, residential", lat: 42.3918, lng: -71.0328 },
  { name: "Quabbin Reservoir", lat: 42.38, lng: -72.29 },
];

const MW = 100;
const COOLING = "evaporative";
const LENS = "balanced";

/** Reads one SSE brief response into { text, source }. */
async function readBrief(h3, lang, audience) {
  const res = await fetch(`${BASE}/api/brief`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ h3, mw: MW, cooling: COOLING, lens: LENS, lang, audience }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const raw = await res.text();
  let text = "";
  let source = null;
  for (const frame of raw.split("\n\n")) {
    const ev = /^event: (.+)$/m.exec(frame)?.[1];
    const data = /^data: (.*)$/m.exec(frame)?.[1];
    if (!ev || data === undefined) continue;
    if (ev === "delta") text += JSON.parse(data);
    if (ev === "meta") source = JSON.parse(data).source;
  }
  if (!text.trim()) throw new Error("empty brief");
  return { text, source };
}

const file = JSON.parse(fs.readFileSync(path.join(DATA, "hexes.json"), "utf8"));
const resolution = file.h3_resolution;

const out = {
  generated_at: new Date().toISOString(),
  note:
    `Offline briefs for the three calibration sites at ${MW} MW, ${COOLING} cooling, ` +
    `${LENS} lens. Generated through /api/brief so they match the live path.`,
  settings: { mw: MW, cooling: COOLING, lens: LENS },
  briefs: {},
};

for (const site of SITES) {
  const h3 = latLngToCell(site.lat, site.lng, resolution);
  for (const lang of LANGS) {
    const { text, source } = await readBrief(h3, lang, "community");
    out.briefs[`${h3}|${lang}|community`] = text;
    if (lang === "en") {
      console.log(`  ${site.name.padEnd(22)} ${h3}  ${source}  ${text.length} chars`);
    }
  }
  const dev = await readBrief(h3, "en", "developer");
  out.briefs[`${h3}|en|developer`] = dev.text;
}

fs.writeFileSync(path.join(DATA, "briefs-cache.json"), JSON.stringify(out, null, 1));
console.log(`wrote public/data/briefs-cache.json (${Object.keys(out.briefs).length} briefs)`);
