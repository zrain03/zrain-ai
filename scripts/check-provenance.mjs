/**
 * Fail / File: scripts/check-provenance.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: 2026-11-04
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Mengesahkan semua fail sumber disenarai dan memiliki metadata yang sepadan.
 * EN: Verify all source files are inventoried and have matching format-safe metadata.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// BM: Gunakan akar package sebenar agar skrip boleh digunakan daripada mana-mana direktori kerja.
// EN: Resolve the actual package root so this checker works regardless of working directory.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(await readFile(join(root, "FILE_PROVENANCE.json"), "utf8"));

// BM: Senaraikan fail secara rekursif, tetapi abaikan direktori hasil jana yang tidak dihantar.
// EN: Walk source recursively while excluding generated directories never included in a release.
// BM: Bina inventori rekursif dan kecualikan hanya output automatik.
// EN: Recursively inventory source while ignoring generated outputs.
async function list(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if ([".git", ".firebase", ".wrangler", "node_modules", "dist", "coverage"].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await list(path, files);
    else if (entry.isFile()) files.push(relative(root, path).split("\\").join("/"));
  }
  return files;
}

// BM: Fail tanpa komen sah menggunakan registry; fail teks berkomen wajib mempunyai header BM/EN.
// EN: Commentless files use the registry; comment-capable text files require bilingual headers.
const files = (await list(root)).sort();
const records = registry.files;
let mistakes = [];
for (const name of files) {
  const info = records[name];
  if (!info) { mistakes.push(`Missing registry record: ${name}`); continue; }
  if (info.developer !== "Zrain" || !info.purpose_bm || !info.purpose_en ||
      !(info.created === null || /^\d{4}-\d{2}-\d{2}$/.test(info.created)) ||
      !(info.last_updated === null || /^\d{4}-\d{2}-\d{2}$/.test(info.last_updated))) {
    mistakes.push(`Invalid provenance fields: ${name}`);
  }
  if (/\.(?:js|mjs|css|html|md|sql|toml)$/.test(name) || name === ".gitignore") {
    const content = await readFile(join(root, name), "utf8");
    if (!content.includes("Pembangun / Developer: Zrain") || !content.includes("Dicipta / Created") ||
        !content.includes("Dikemas kini / Last updated:") || !content.includes("BM:") || !content.includes("EN:")) {
      mistakes.push(`Incomplete source header: ${name}`);
    }
  }
}
for (const name of Object.keys(records)) if (!files.includes(name)) mistakes.push(`Stale provenance record: ${name}`);
if (mistakes.length) { console.error(mistakes.join("\n")); process.exitCode = 1; }
else console.log(`Provenance verified: ${files.length} files; all inventory and headers valid.`);
