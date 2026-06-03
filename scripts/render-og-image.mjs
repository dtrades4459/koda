// scripts/render-og-image.mjs
// ═══════════════════════════════════════════════════════════════════════════════
// One-off renderer: public/og-image.svg → public/og-image.png (1200×630)
//
// Twitter / iMessage / Slack often skip SVG OG previews. PNG is universal.
// Run: node scripts/render-og-image.mjs
// ═══════════════════════════════════════════════════════════════════════════════

import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const svg = readFileSync(join(root, "public/og-image.svg"), "utf8");

const html = `<!doctype html><html><head><style>
  html,body{margin:0;padding:0;background:#13110E;overflow:hidden}
  svg{display:block;width:1200px;height:630px}
</style></head><body>${svg}</body></html>`;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.setContent(html, { waitUntil: "load" });
// Give Geist webfonts time to load — they don't; we ship them via CDN at runtime
// but for OG we accept whatever the headless Chrome bundles. Geist falls back to
// system sans, which is close enough at OG size.
await page.waitForTimeout(300);

const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();

writeFileSync(join(root, "public/og-image.png"), png);
console.log(`✓ wrote public/og-image.png (${png.length.toLocaleString()} bytes)`);
