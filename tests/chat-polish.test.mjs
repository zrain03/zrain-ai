/**
 * Fail / File: tests/chat-polish.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menguji regresi fungsi dan kontrak produk bagi modul berkaitan.
 * EN: Test feature regressions and product contracts for the relevant module.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makePreviewSource } from '../frontend/code-preview.js';
const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Composer keeps independent Attach and Research controls with visible labels', async () => {
  const html = await read('frontend/index.html');
  assert.match(html, /id="attach-trigger"[^>]*type="button"/);
  assert.match(html, /id="research-toggle"[^>]*aria-pressed="false"/);
  assert.match(html, /class="research-label">Research</);
  assert.match(html, /class="research-status-dot"/);
  assert.match(html, /chat-polish\.css\?v=/);
});

test('Research mode does not overwrite button markup when toggled', async () => {
  const app = await read('frontend/app.js');
  assert.match(app, /researchToggle\.classList\.toggle\("is-active", state\.research\)/);
  assert.match(app, /researchToggle\.setAttribute\("aria-label", state\.research/);
  assert.doesNotMatch(app, /researchToggle\.textContent\s*=/);
  assert.match(app, /el\("attach-trigger"\)\.addEventListener\("click"/);
});

test('Composer polish preserves footer, scroll, quota and narrow screen affordances', async () => {
  const css = await read('frontend/chat-polish.css');
  const footer = await read('frontend/footer-layout.css');
  assert.match(css, /\.composer-actions\s*\{[^}]*flex-wrap:wrap/);
  assert.match(css, /\.research-toggle\[aria-pressed="true"\]/);
  assert.match(css, /max-width:370px/);
  assert.match(css, /max-height:580px/);
  assert.match(footer, /grid-template-rows: 64px minmax\(0, 1fr\) 44px/);
  assert.match(await read('frontend/index.html'), /quota-inline-label/);
});

test('Code preview provides device viewport controls and refreshed sandbox', async () => {
  const code = await read('frontend/code-preview.js');
  assert.match(code, /\["desktop", "Desktop"\]/);
  assert.match(code, /\["tablet", "Tablet"\]/);
  assert.match(code, /\["mobile", "Mobile"\]/);
  assert.match(code, /zrain-preview-reload/);
  assert.match(code, /zrain-preview-console-pane/);
  assert.match(code, /frame\.srcdoc = markup/);
  assert.match(code, /setAttribute\("sandbox", "allow-scripts"\)/);
  assert.doesNotMatch(code, /allow-same-origin/);
});

test('Preview stays network isolated and never inserts model HTML into parent', async () => {
  const code = await read('frontend/code-preview.js');
  const html = makePreviewSource({ html:'<html><head></head><body>Hi</body></html>', css:'body{color:red}', js:'console.log("ready")' });
  assert.match(html,/default-src 'none'/);
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/frame-src 'none'/);
  assert.match(code,/event\.source !== frame\.contentWindow/);
  assert.doesNotMatch(code,/\.innerHTML\s*=/);
  assert.doesNotMatch(code,/eval\(/);
});

test('Polish UI text does not introduce em dash', async () => {
  for (const file of ['frontend/chat-polish.css','frontend/code-preview.js','frontend/index.html']) {
    assert.doesNotMatch(await read(file), /—/,file);
  }
});
