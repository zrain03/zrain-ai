/**
 * Fail / File: tests/provenance.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: 2026-11-04
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Pastikan metadata inventori kekal konsisten selepas perubahan.
 * EN: Keep provenance records consistent across future changes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
const root = new URL("../", import.meta.url);

// BM: Skrip semakan fail mesti lulus pada setiap release sumber.
// EN: The source inventory checker must pass for every source release.
test("all sources are inventoried with date provenance and bilingual headers", () => {
  // BM: fileURLToPath mengelakkan laluan Windows berawalan /C:/ daripada menjadi C:\C:\... .
  // EN: fileURLToPath converts file URLs to native Windows paths before spawning Node.
  const checker = fileURLToPath(new URL("../scripts/check-provenance.mjs", import.meta.url));
  const output = execFileSync(process.execPath, [checker], { cwd: fileURLToPath(root) });
  assert.match(output.toString(), /Provenance verified:/);
});

// BM: Aset logo rasmi dan komponen bersama wajib disertakan bersama frontend.
// EN: The official logo asset and shared component must ship with the frontend.
test("local Golden Reference files are present and nonempty", () => {
  for (const file of ["frontend/zrain-logo.webp", "frontend/zrain-ui/zrain-ui.js", "frontend/zrain-ui/brand.css", "frontend/zrain-ui/brand-init.js", "frontend/brand-integration.css"]) {
    assert.equal(existsSync(new URL(`../${file}`, import.meta.url)), true, `${file} is required`);
  }
  const logo = readFileSync(new URL("../frontend/zrain-logo.webp", import.meta.url));
  assert.equal(logo.toString("ascii", 8, 12), "WEBP");
});
