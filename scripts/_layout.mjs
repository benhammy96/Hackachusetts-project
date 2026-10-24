import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://localhost:3312", { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(9000);
const chain = await p.evaluate(() => {
  let el = document.querySelector('[aria-label="Massachusetts screening map"]');
  const out = [];
  while (el && el !== document.documentElement) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || "").toString().slice(0, 72),
      w: Math.round(r.width), h: Math.round(r.height),
      display: s.display, flex: s.flex, align: s.alignItems, pos: s.position,
      minH: s.minHeight, height: s.height,
    });
    el = el.parentElement;
  }
  return out;
});
chain.forEach(c => console.log(JSON.stringify(c)));
await b.close();
