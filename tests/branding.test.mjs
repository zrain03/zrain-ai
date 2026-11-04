/**
 * Fail / File: tests/branding.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menguji regresi fungsi dan kontrak produk bagi modul berkaitan.
 * EN: Test feature regressions and product contracts for the relevant module.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const root = new URL("../frontend/", import.meta.url);
test("Zrain AI mounts the Golden Reference identity and retains its official logo", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const mount = await readFile(new URL("zrain-ui/brand-init.js", root), "utf8");
  assert.match(html, /class="site-header zrain-header"/);
  assert.match(html, /class="brand zrain-brand"/);
  assert.match(html, /class="zrain-brand__product"[^>]*>AI<\/a>/);
  assert.match(html, /class="welcome-mark"[^>]*>[\s\S]*?zrain-logo\.webp/);
  assert.match(html, /class="zrain-footer__home"[^>]*>[\s\S]*?Developed by Zrain/);
  assert.match(mount, /mountZrainUI\(\{ product: "AI", logoSrc: "\.\/zrain-logo\.webp"/);
  assert.doesNotMatch(html, /✦/);
});
test("Zrain AI chat avatar uses the brand logo, not a generic star", async () => {
  const js = await readFile(new URL("app.js", root), "utf8");
  assert.match(js, /avatar\.append\(logo\)/);
  assert.doesNotMatch(js, /✦/);
});
