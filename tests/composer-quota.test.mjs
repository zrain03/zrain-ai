/**
 * Fail / File: tests/composer-quota.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menguji regresi fungsi dan kontrak produk bagi modul berkaitan.
 * EN: Test feature regressions and product contracts for the relevant module.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = file => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("input is pinned above the viewport bottom, with only conversation scrolling", async () => {
  const css = await read("frontend/style.css");
  assert.match(css, /\.chat-shell\{[^}]*position:relative;display:block;overflow:hidden/);
  assert.match(css, /\.conversation\{[^}]*position:absolute;[^}]*bottom:var\(--composer-height/);
  assert.match(css, /\.composer-wrap\{[^}]*position:absolute;[^}]*bottom:0;/);
  assert.match(css, /body\{[^}]*max-height:var\(--app-height,100dvh\);overflow:hidden/);
});

test("real composer height is measured after Turnstile and notices resize", async () => {
  const app = await read("frontend/app.js");
  assert.match(app, /function syncComposerHeight\(\)/);
  assert.match(app, /ResizeObserver\(syncComposerHeight\)/);
  assert.match(app, /window\.visualViewport\?\.addEventListener\("resize", syncViewportHeight\)/);
  assert.match(app, /style\.setProperty\("--composer-height"/);
});

test("quota summary is next to composer on both desktop and mobile", async () => {
  const html = await read("frontend/index.html");
  const css = await read("frontend/style.css");
  const app = await read("frontend/app.js");
  assert.match(html, /id="quota-inline-label"/);
  assert.match(html, /id="shared-inline"/);
  assert.match(html, /id="quota-progress-inline"/);
  assert.match(css, /\.composer-quota\{/);
  assert.doesNotMatch(css, /\.composer-quota\{[^}]*display:none/);
  assert.match(app, /ui\.inlineQuota\.textContent = label/);
  assert.match(app, /ui\.inlineShared\.textContent = capacityText/);
});

test("Turnstile comes before the message input, not beneath its quota", async () => {
  const html = await read("frontend/index.html");
  const verification = html.indexOf('class="verification"');
  const form = html.indexOf('id="chat-form"');
  const quota = html.indexOf('class="composer-quota"');
  assert.ok(verification > 0 && form > verification && quota > form);
});
