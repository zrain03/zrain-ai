/**
 * Fail / File: tests/chat-ux.test.mjs
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
const read = path => readFile(new URL(path, root), "utf8");

test("Zrain AI chat uses a viewport-height layout without a second page scrollbar", async () => {
  const css = await read("frontend/style.css");
  assert.match(css, /body\{[^}]*height:100dvh/);
  assert.match(css, /\.conversation\{[^}]*overflow:auto/);
  assert.match(css, /\.chat-shell\{[^}]*min-height:0/);
  assert.doesNotMatch(css, /max-height:calc\(100dvh - 198px\)/);
});

test("AI Markdown is rendered by safe DOM construction, not raw response HTML", async () => {
  const renderer = await read("frontend/markdown.js");
  const frontend = await read("frontend/app.js");
  assert.match(frontend, /import \{ renderMarkdown(?:, renderUserLinks)? \}/);
  assert.match(frontend, /renderMarkdown\(body, content\)/);
  assert.match(renderer, /document\.createElement\("strong"\)/);
  assert.match(renderer, /document\.createElement\("code"\)/);
  assert.match(renderer, /document\.createTextNode/);
  assert.doesNotMatch(renderer, /innerHTML\s*=/);
  assert.match(renderer, /\["http:", "https:"\]/);
});

test("mobile new conversation and back-to-latest controls exist", async () => {
  const html = await read("frontend/index.html");
  const js = await read("frontend/app.js");
  assert.match(html, /id="mobile-new-chat"/);
  assert.match(html, /id="scroll-latest"/);
  assert.match(js, /mobile-new-chat"\)\.addEventListener\("click", newChat\)/);
  assert.match(js, /scrollToLatest\("smooth"\)/);
});

test("AI conversational instructions are accurate and avoid em dash", async () => {
  const prompt = await read("worker/src/chat.js");
  assert.match(prompt, /Cloudflare Workers AI/);
  assert.match(prompt, /Bahasa Melayu/);
  assert.match(prompt, /without exaggerated enthusiasm/);
  assert.doesNotMatch(prompt, /—/);
});
