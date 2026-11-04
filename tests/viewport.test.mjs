/**
 * Fail / File: tests/viewport.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menguji regresi fungsi dan kontrak produk bagi modul berkaitan.
 * EN: Test feature regressions and product contracts for the relevant module.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("document cannot scroll behind the chat window", async () => {
  const css = await read("frontend/style.css");
  assert.match(css, /html\{[^}]*overflow:hidden/);
  assert.match(css, /body\{[^}]*overflow:hidden/);
  assert.match(css, /grid-template-rows:auto minmax\(0,1fr\) auto/);
  assert.match(css, /\.layout\{[^}]*min-height:0[^}]*overflow:hidden/);
});

test("message pane scrolls while input remains in its own grid row", async () => {
  const css = await read("frontend/style.css");
  assert.match(css, /\.chat-shell\{[^}]*grid-template-rows:minmax\(0,1fr\) auto/);
  assert.match(css, /\.conversation\{[^}]*overflow:auto/);
  assert.match(css, /\.composer-wrap\{[^}]*position:relative/);
});

test("desktop has one visible New conversation control and mobile plus has a label", async () => {
  const css = await read("frontend/style.css");
  const html = await read("frontend/index.html");
  assert.match(css, /@media\(min-width:781px\)\{\.mobile-new-chat\{display:none!important\}\}/);
  assert.match(html, /id="mobile-new-chat"[^>]*aria-label="Start a new conversation"/);
  assert.match(html, /id="new-chat"[^>]*title="Start a new conversation/);
});

test("starting a new conversation preserves history but protects unsent drafts", async () => {
  const js = await read("frontend/app.js");
  assert.match(js, /function newChat\(\) \{/);
  assert.match(js, /ui\.input\.value\.trim\(\)/);
  assert.match(js, /window\.confirm\("Discard the unsent draft/);
  assert.match(js, /persistChat\(\)/);
});
