/**
 * Fail / File: tests/research-compatible-index.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menguji regresi fungsi dan kontrak produk bagi modul berkaitan.
 * EN: Test feature regressions and product contracts for the relevant module.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../worker/src/index.js',import.meta.url),'utf8');
test('Research response metadata keeps increased upload size for multiple image attachments',()=>{
  assert.equal((src.match(/1500000/g)||[]).length,3);
  assert.doesNotMatch(src,/410000/);
  assert.match(src,/researchAttempted: research\.attempted === true/);
  assert.match(src,/researchCheckedAt: research\.checkedAt \|\| null/);
  assert.match(src,/evidenceType: evidenceType \|\| "read-page"/);
});
