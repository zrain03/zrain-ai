/**
 * Fail / File: tests/footer-layout.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menguji regresi fungsi dan kontrak produk bagi modul berkaitan.
 * EN: Test feature regressions and product contracts for the relevant module.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const here = new URL('../frontend/', import.meta.url);
const html = readFileSync(new URL('index.html', here), 'utf8');
const css = readFileSync(new URL('chat-studio.css', here), 'utf8');
test('The chat uses the shared footer without clipping the composer', () => {
  assert.match(html, /href="\.\/chat-studio\.css(?:\?[^"]*)?"/);
  assert.match(html, /\/ui\/v2\/layout\.js/);
  assert.doesNotMatch(html, /<footer|footer-layout\.css/);
  assert.match(css, /html:has\(\.zrain-ai-workspace\)[^}]*height: auto[^}]*overflow: visible/);
  assert.match(css, /\.composer-wrap\s*\{\s*position: relative/);
  assert.match(css, /\.welcome-mark[^}]*height: var\(--mascot-size\)/);
});
