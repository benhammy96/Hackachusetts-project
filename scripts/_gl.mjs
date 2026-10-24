import { chromium } from "playwright";
for (const opts of [
  { label: "headless-shell", launch: {} },
  { label: "swiftshader", launch: { args: ["--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] } },
  { label: "chromium-channel", launch: { channel: "chromium", args: ["--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] } },
]) {
  let b;
  try { b = await chromium.launch(opts.launch); } catch (e) { console.log(`${opts.label}: launch failed: ${e.message.slice(0,80)}`); continue; }
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const tiles = { ok: 0, fail: 0 };
  p.on("response", r => { if (r.url().includes("cartocdn")) (r.ok() ? tiles.ok++ : tiles.fail++); });
  p.on("requestfailed", r => { if (r.url().includes("cartocdn")) tiles.fail++; });
  await p.goto("http://localhost:3312", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(12000);
  const info = await p.evaluate(() => {
    const c = document.createElement("canvas");
    const g = c.getContext("webgl2") || c.getContext("webgl");
    const d = g && g.getExtension("WEBGL_debug_renderer_info");
    const box = document.querySelector('[aria-label="Massachusetts screening map"]')?.getBoundingClientRect();
    const canvases = [...document.querySelectorAll("canvas")].map(x => {
      const r = x.getBoundingClientRect();
      return { cw: x.width, ch: x.height, w: Math.round(r.width), h: Math.round(r.height), cls: x.className.slice(0,40) };
    });
    return {
      renderer: g ? (d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : "unknown") : "NO WEBGL",
      mapBox: box ? { w: Math.round(box.width), h: Math.round(box.height) } : null,
      canvases,
    };
  });
  await p.screenshot({ path: `/tmp/gl-${opts.label}.png` });
  console.log(`\n${opts.label}\n  renderer: ${info.renderer}\n  tiles ok=${tiles.ok} fail=${tiles.fail}\n  mapBox: ${JSON.stringify(info.mapBox)}\n  canvases: ${JSON.stringify(info.canvases)}`);
  await b.close();
}
