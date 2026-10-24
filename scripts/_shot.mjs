import { chromium } from "playwright";
const b = await chromium.launch({ args: ["--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForSelector("#site-inspector");
await p.waitForTimeout(12000);
const layers = await p.evaluate(() => {
  const panel = [...document.querySelectorAll("*")].find(e => e.textContent?.trim() === "Layers");
  return document.body.innerText.includes("Transmission lines");
});
console.log("Transmission lines text present anywhere:", layers);
await p.screenshot({ path: "verification/no-transmission.png" });
await b.close();
