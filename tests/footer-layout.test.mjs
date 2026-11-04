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
const css = readFileSync(new URL('footer-layout.css', here), 'utf8');
test('Footer fix is linked to chat page only', () => {
  assert.match(html, /href="\.\/footer-layout\.css\?v=20261103"/);
  assert.match(html, /class="site-footer zrain-footer"/);
  assert.match(css, /body:not\(\.policy-body\)/);
});
test('Viewport allocates fixed footer height and keeps flexible chat row', () => {
  assert.match(css, /grid-template-rows:\s*64px\s+minmax\(0,\s*1fr\)\s+44px\s*!important/);
  assert.match(css, /> \.site-footer\s*\{[\s\S]*?display:\s*block\s*!important/);
  assert.match(css, /\.conversation\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /\.chat-shell\s*\{[\s\S]*?height:\s*100%\s*!important/);
});
test('Mobile footer stays available, legal pages remain independent', () => {
  assert.match(css, /@media \(max-width:\s*780px\)/);
  assert.match(css, /grid-template-rows:\s*58px\s+minmax\(0,\s*1fr\)\s+56px/);
  assert.doesNotMatch(css, /body\.policy-body\s*\{[\s\S]*?overflow:\s*hidden/);
});
