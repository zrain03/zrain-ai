/**
 * Fail / File: scripts/preflight.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Memeriksa kelengkapan setup sebelum deploy tanpa memanggil perkhidmatan berbayar.
 * EN: Check setup completeness before deployment without calling paid services.
 */
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = await readFile(resolve(project, "worker/wrangler.toml"), "utf8");
const config = await readFile(resolve(project, "frontend/config.js"), "utf8");
const issues = [];
const checks = [
  ["Cloudflare D1 database ID", !wrangler.includes("REPLACE_WITH_REAL_D1_DATABASE_ID") && /database_id\s*=\s*"[0-9a-f-]{36}"/i.test(wrangler)],
  ["Cloudflare Turnstile public sitekey", /TURNSTILE_SITE_KEY\s*=\s*"[^"\s]+"/.test(wrangler)],
  ["Frontend Worker API address", /API_BASE_URL\s*=\s*"https:\/\/[^"\s]+"/.test(config)],
  ["Anonymous daily allowance is 100", /DAILY_USER_LIMIT\s*=\s*"100"/.test(wrangler)],
  ["Shared daily safety limit configured", /GLOBAL_DAILY_LIMIT\s*=\s*"[1-9][0-9]*"/.test(wrangler)],
  ["Workers AI binding configured", /\[ai\]\s+binding\s*=\s*"AI"/m.test(wrangler)],
  ["Paid provider fallback is not configured", !/\b(?:openai_api_key|anthropic_api_key|stripe_secret_key)\b/i.test(wrangler)],
];
let logoExists = false;
try { await access(resolve(project, "frontend/zrain-logo.webp")); logoExists = true; } catch {}

console.log("Zrain AI | Cloudflare Free setup checklist\n");
for (const [label, pass] of checks) {
  console.log(`${pass ? "[OK]" : "[SETUP]"} ${label}`);
  if (!pass) issues.push(label);
}
console.log(`${logoExists ? "[OK]" : "[INFO]"} Local Zrain logo ${logoExists ? "is present" : "will fall back to official hosted logo"}`);
console.log("[MANUAL] Cloudflare account is on Workers Free and no paid AI billing is enabled");
console.log("[MANUAL] SESSION_SECRET and TURNSTILE_SECRET are set using Wrangler secrets");
console.log("[MANUAL] Cloudflare D1 migration and real Turnstile verification have been tested");
console.log(`\n${issues.length ? "Status: SETUP REQUIRED" : "Status: STATIC CONFIG COMPLETE"}`);
console.log("This local check cannot confirm a live Cloudflare plan, remote database, secret or AI response.");
