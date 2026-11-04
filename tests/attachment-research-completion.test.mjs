/**
 * Fail / File: tests/attachment-research-completion.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menguji regresi fungsi dan kontrak produk bagi modul berkaitan.
 * EN: Test feature regressions and product contracts for the relevant module.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../frontend/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../frontend/app.js", import.meta.url), "utf8");
const researchCss = readFileSync(new URL("../frontend/research-preview.css", import.meta.url), "utf8");
const workerChat = readFileSync(new URL("../worker/src/chat.js", import.meta.url), "utf8");
const workerResearch = readFileSync(new URL("../worker/src/web-research.js", import.meta.url), "utf8");

test("attachments allow multiple files and preview cards", () => {
  assert.match(html, /type="file"[^>]*multiple/);
  assert.match(app, /state\.attachments = \[\]/);
  assert.match(app, /attachment-card/);
  assert.match(app, /payload\.images =/);
  assert.match(app, /payload\.documents =/);
});

test("research toggle uses one explicit status dot", () => {
  assert.match(html, /research-status-dot/);
  assert.ok(!researchCss.includes('aria-pressed="true"]::after'));
});

test("worker can continue long answers and supports multiple attachments", () => {
  assert.match(workerChat, /Continue from exactly where you stopped/);
  assert.match(workerChat, /body\.images/);
  assert.match(workerChat, /body\.documents/);
  assert.match(workerChat, /maxTokens/);
});

test("research has Wikipedia fallback search", () => {
  assert.match(workerResearch, /opensearch/);
  assert.match(workerResearch, /api\/rest_v1\/page\/summary/);
});
