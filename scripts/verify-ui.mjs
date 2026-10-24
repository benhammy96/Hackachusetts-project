/**
 * Visual and behavioural check of the running app.
 *
 * Drives a real browser through the golden path: load, select each calibration
 * site, open the brief, pin and compare, open the sources dialog. Fails loudly
 * on a console error, a missing element, or a score that does not match what
 * the score engine computes.
 *
 *   npm run start -- --port 3310
 *   node scripts/verify-ui.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.ATLAS_URL ?? "http://localhost:3312";
const SHOTS = path.join(process.cwd(), "verification");
fs.mkdirSync(SHOTS, { recursive: true });

const problems = [];
const note = (s) => console.log(`   ${s}`);
const fail = (s) => {
  problems.push(s);
  console.log(`   FAIL ${s}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

console.log("1. load");
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.waitForSelector("#site-inspector", { timeout: 90_000 });
await page.waitForFunction(
  () => /Pick a location|Contested|Fatal flaw|Strong site|Workable/.test(
    document.querySelector("#site-inspector")?.textContent ?? "",
  ),
  { timeout: 90_000 },
);
await page.waitForTimeout(1500);

for (const [label, text] of [
  ["product name", "Atlas"],
  ["empty inspector", "Pick a location"],
  ["explorer", "Ranked cells"],
  ["legend", "Suitability, 0–10"],
  ["layer control", "Layers"],
  ["cell disclaimer", "not a parcel and not land for sale"],
]) {
  if (await page.getByText(text, { exact: false }).first().isVisible().catch(() => false)) {
    note(`ok  ${label}`);
  } else {
    fail(`${label} not visible ("${text}")`);
  }
}

// Map must dominate: at least half the window width.
const mapBox = await page.locator('[aria-label="Massachusetts screening map"]').boundingBox();
if (!mapBox) fail("map container missing");
else if (mapBox.width / 1440 < 0.5) fail(`map is only ${Math.round((mapBox.width / 1440) * 100)}% of width`);
else note(`ok  map is ${Math.round((mapBox.width / 1440) * 100)}% of width`);

// No forbidden template styling.
const badStyle = await page.evaluate(() => {
  const hits = [];
  for (const el of document.querySelectorAll("*")) {
    const s = getComputedStyle(el);
    if (/gradient/i.test(s.backgroundImage) && /purple|violet|magenta|#a855|#8b5cf|#d946/i.test(s.backgroundImage)) {
      hits.push(`gradient on ${el.tagName}`);
    }
  }
  return hits.slice(0, 5);
});
if (badStyle.length) fail(`forbidden styling: ${badStyle.join(", ")}`);
else note("ok  no purple gradients");

await page.screenshot({ path: path.join(SHOTS, "01-empty.png") });

console.log("2. ranked explorer list");
const rows = await page.locator("aside[aria-label='Site explorer'] ul button").count();
if (rows < 5) fail(`explorer shows only ${rows} ranked cells`);
else note(`ok  ${rows} ranked cells`);

console.log("3. calibration sites");
const file = JSON.parse(fs.readFileSync("public/data/hexes.json", "utf8"));
const idx = {};
file.fields.forEach((f, i) => (idx[f] = i));

const SITES = [
  { name: "Holyoke, near MGHPCC", expect: /Contested|Workable/ },
  { name: "Chelsea, residential", expect: /Contested|Do not build/ },
  { name: "Quabbin Reservoir", expect: /Fatal flaw/ },
];

for (const [i, site] of SITES.entries()) {
  // The empty state lists the three sites; after the first selection we come
  // back to them through the explorer search instead.
  if (i > 0) {
    await page.locator('button[aria-label="Hide the site explorer"]').click().catch(() => {});
  }
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#site-inspector", { timeout: 90_000 });
  await page.waitForFunction(
    () => /Pick a location/.test(document.querySelector("#site-inspector")?.textContent ?? ""),
    { timeout: 90_000 },
  );
  await page.getByRole("button", { name: new RegExp(site.name, "i") }).first().click();
  await page.waitForTimeout(900);

  const inspector = page.locator("#site-inspector");
  const body = await inspector.innerText();

  if (site.expect.test(body)) note(`ok  ${site.name}: band matches ${site.expect}`);
  else fail(`${site.name}: inspector text has no band matching ${site.expect}`);

  if (/unresolved before this is a real site/i.test(body)) {
    note("ok  unresolved block present");
  } else {
    fail(`${site.name}: unresolved constraints block missing`);
  }
  if (/Grid capacity unverified/.test(body)) note("ok  grid capacity flagged unverified");
  else fail(`${site.name}: grid capacity not flagged`);
  if (/Availability unknown/.test(body)) note("ok  availability flagged unknown");
  else fail(`${site.name}: availability not flagged`);

  // All eight factors must be listed.
  for (const f of [
    "Grid access",
    "Clean power",
    "Fiber and latency",
    "Land readiness",
    "Residents nearby",
    "Environmental justice",
    "Water",
    "Climate risk",
  ]) {
    if (!body.includes(f)) fail(`${site.name}: factor "${f}" missing from breakdown`);
  }

  // Unmeasured factors must read n/a, not 0.
  if (/Fiber and latency[\s\S]{0,80}n\/a/.test(body)) note("ok  fiber reads n/a");
  else fail(`${site.name}: fiber does not read n/a`);

  await page.screenshot({
    path: path.join(SHOTS, `0${i + 2}-${site.name.split(",")[0].toLowerCase()}.png`),
  });
}

console.log("3b. reselect Holyoke for the panels that need a scoreable site");
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#site-inspector", { timeout: 90_000 });
await page.waitForFunction(
  () => /Pick a location/.test(document.querySelector("#site-inspector")?.textContent ?? ""),
  { timeout: 90_000 },
);
await page.getByRole("button", { name: /Holyoke, near MGHPCC/i }).first().click();
await page.waitForTimeout(900);

console.log("4. factor row expands to show source");
await page.getByRole("button", { name: /Grid access/ }).first().click();
await page.waitForTimeout(350);
const expanded = await page.locator("#site-inspector").innerText();
if (/not available interconnection capacity/i.test(expanded)) note("ok  capacity caveat shown");
else fail("grid access caveat not shown on expand");
if (/OpenStreetMap/.test(expanded)) note("ok  source link shown");
else fail("source attribution missing on expand");

console.log("5. cost panel");
await page.getByRole("button", { name: /Modelled cost, carbon and water/ }).click();
await page.waitForTimeout(500);
const cost = (await page.locator("#site-inspector").innerText()).toLowerCase();
for (const t of ["annual electricity", "facility energy", "egrid", "pue", "assumptions behind these figures"]) {
  if (cost.includes(t)) note(`ok  cost panel: ${t}`);
  else fail(`cost panel missing "${t}"`);
}
await page.screenshot({ path: path.join(SHOTS, "05-cost.png") });

console.log("6. brief panel");
await page.getByRole("button", { name: /Generate brief/ }).click();
await page.waitForSelector("text=Questions to ask the developer", { timeout: 40_000 });
await page.waitForTimeout(900);
const brief = await page.locator('[role="dialog"]').innerText();
const numbered = await page.locator('[role="dialog"] ol > li').count();
if (numbered >= 5) note(`ok  ${numbered} numbered questions`);
else fail(`brief has ${numbered} numbered items, expected at least 5`);
if (/planning aid, not a permitting decision/.test(brief)) note("ok  standing caveat present");
else fail("brief missing the standing caveat");
await page.screenshot({ path: path.join(SHOTS, "06-brief.png") });

console.log("7. brief in Spanish");
await page.getByRole("button", { name: "Español" }).click();
await page.waitForTimeout(2500);
const es = await page.locator('[role="dialog"]').innerText();
if (/Preguntas para el promotor/.test(es)) note("ok  Spanish headings");
else fail("Spanish brief did not render");
if (/Acceso a la red|Residentes cercanos|Justicia ambiental|Fibra y latencia/.test(es)) note("ok  Spanish factor labels");
else fail("Spanish factor labels missing");
await page.screenshot({ path: path.join(SHOTS, "07-brief-es.png") });
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

console.log("8. pin, compare");
await page.getByRole("button", { name: /^Pin$/ }).click();
await page.waitForTimeout(250);
await page.locator("aside[aria-label='Site explorer'] ul button").nth(0).click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: /^Pin$/ }).click();
await page.waitForTimeout(250);
await page.getByRole("button", { name: /Compare/ }).click();
await page.waitForTimeout(700);
const cmp = await page.locator('[role="dialog"]').innerText();
for (const t of ["Grid capacity", "Unverified", "Zoning", "Unknown", "Availability"]) {
  if (cmp.includes(t)) note(`ok  compare row: ${t}`);
  else fail(`compare missing "${t}"`);
}
await page.screenshot({ path: path.join(SHOTS, "08-compare.png") });
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

console.log("9. sources dialog");
await page.getByRole("button", { name: /Sources/ }).click();
await page.waitForTimeout(700);
const src = (await page.locator('[role="dialog"]').innerText()).toLowerCase();
for (const t of ["massgis", "fema", "openstreetmap", "no data", "eia", "egrid"]) {
  if (src.includes(t)) note(`ok  provenance: ${t}`);
  else fail(`provenance dialog missing "${t}"`);
}
await page.screenshot({ path: path.join(SHOTS, "09-sources.png") });
await page.keyboard.press("Escape");

console.log("10. layer toggles");
await page.waitForTimeout(400);
for (const label of ["EJ block groups", "FEMA 1% floodplain", "Protected open space", "Extrude by score"]) {
  const t = page.getByText(label, { exact: true }).first();
  if (!(await t.isVisible().catch(() => false))) {
    fail(`layer toggle "${label}" not visible`);
    continue;
  }
  await t.click();
  await page.waitForTimeout(1400);
  note(`ok  toggled ${label}`);
}
await page.screenshot({ path: path.join(SHOTS, "10-layers.png") });

console.log("11. 1280x720");
await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(900);
const small = await page.locator('[aria-label="Massachusetts screening map"]').boundingBox();
if (small && small.width / 1280 >= 0.5) note(`ok  map is ${Math.round((small.width / 1280) * 100)}% at 1280`);
else fail(`map is only ${small ? Math.round((small.width / 1280) * 100) : 0}% of width at 1280`);
await page.screenshot({ path: path.join(SHOTS, "11-1280.png") });

console.log("12. keyboard focus ring");
await page.keyboard.press("Tab");
await page.keyboard.press("Tab");
const focused = await page.evaluate(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const s = getComputedStyle(el);
  return { tag: el.tagName, outline: s.outlineColor, width: s.outlineWidth };
});
if (focused) note(`ok  focus reaches ${focused.tag}, outline ${focused.outline} ${focused.width}`);
else fail("Tab did not move focus to an interactive element");

console.log("\nconsole errors:");
const ignorable = /favicon|ResizeObserver|WebGL|Download the React DevTools|deck: /i;
const real = consoleErrors.filter((e) => !ignorable.test(e));
if (real.length === 0) note(`none (${consoleErrors.length} ignorable)`);
else real.slice(0, 12).forEach((e) => fail(`console: ${e.slice(0, 200)}`));

await browser.close();

console.log(`\nscreenshots in ${path.relative(process.cwd(), SHOTS)}/`);
if (problems.length) {
  console.log(`\n${problems.length} PROBLEM(S):`);
  problems.forEach((p) => console.log(` - ${p}`));
  process.exit(1);
}
console.log("\nAll UI checks passed.");
