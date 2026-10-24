/**
 * Copies maplibre-gl's web worker into public/vendor/.
 *
 * maplibre-gl 6 loads its worker through `new URL(..., import.meta.url)`, which
 * Turbopack cannot trace, so the worker fails at runtime with "Worker failed to
 * load". Serving the shipped worker bundle as a static asset and pointing
 * `setWorkerUrl` at it avoids the bundler entirely.
 *
 * Runs automatically via the predev and prebuild scripts.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const pkg = path.dirname(require.resolve("maplibre-gl/package.json"));
const version = JSON.parse(fs.readFileSync(path.join(pkg, "package.json"), "utf8")).version;
const src = path.join(pkg, "dist", "maplibre-gl-worker.mjs");
const destDir = path.join(process.cwd(), "public", "vendor");
const dest = path.join(destDir, "maplibre-gl-worker.mjs");

if (!fs.existsSync(src)) {
  console.error(`maplibre worker not found at ${src}`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
fs.writeFileSync(
  path.join(destDir, "README.md"),
  [
    "# vendor",
    "",
    "`maplibre-gl-worker.mjs` is copied verbatim from the installed `maplibre-gl`",
    "package by `scripts/copy-maplibre-worker.mjs` (predev / prebuild).",
    "",
    `Current copy: maplibre-gl ${version}.`,
    "",
    "Do not edit it by hand. maplibre-gl is 3-Clause BSD licensed; see",
    "https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt",
    "",
  ].join("\n"),
);

const kb = (fs.statSync(dest).size / 1024).toFixed(0);
console.log(`copied maplibre-gl ${version} worker -> public/vendor/maplibre-gl-worker.mjs (${kb} kB)`);
