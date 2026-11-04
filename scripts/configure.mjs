/**
 * Fail / File: scripts/configure.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Membantu mengkonfigurasi tetapan awam tanpa menyimpan secrets.
 * EN: Help configure non-secret public settings without storing secrets.
 */
// Edits only public, non-sensitive configuration values. Secrets belong in Wrangler.
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([a-z-]+)=(.+)$/.exec(arg);
  if (!match) throw new Error(`Invalid option: ${arg}`);
  return [match[1], match[2]];
}));
const supported = ["worker-url", "database-id", "sitekey", "hostname"];
if (!Object.keys(args).length || Object.keys(args).some(x => !supported.includes(x))) {
  console.error("Usage: node scripts/configure.mjs --worker-url=https://YOUR_WORKER.workers.dev --database-id=YOUR_D1_ID --sitekey=YOUR_PUBLIC_TURNSTILE_SITEKEY --hostname=zrain-ai.web.app");
  process.exit(1);
}
const worker = resolve(root, "worker/wrangler.toml");
const frontend = resolve(root, "frontend/config.js");
let wrangler = await readFile(worker, "utf8");
let config = await readFile(frontend, "utf8");
if (args["worker-url"]) {
  const url = new URL(args["worker-url"]);
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Worker URL must be https://hostname without a path or query.");
  }
  config = `// Zrain AI backend hosted on a Cloudflare Workers Free account.\nexport const API_BASE_URL = ${JSON.stringify(url.origin)};\n`;
}
if (args["database-id"]) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(args["database-id"])) throw new Error("Invalid D1 ID format.");
  wrangler = wrangler.replace(/database_id\s*=\s*"[^"]*"/, `database_id = "${args["database-id"]}"`);
}
if (args.sitekey) {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(args.sitekey)) throw new Error("Invalid public Turnstile sitekey format.");
  if (/^[123]x0{5,}/.test(args.sitekey)) throw new Error("Test Turnstile sitekeys are not allowed for public production setup.");
  wrangler = wrangler.replace(/TURNSTILE_SITE_KEY\s*=\s*"[^"]*"/, `TURNSTILE_SITE_KEY = "${args.sitekey}"`);
}
if (args.hostname) {
  if (!/^[a-z0-9.-]+$/i.test(args.hostname) || args.hostname.startsWith(".") || args.hostname.includes("..")) throw new Error("Invalid hostname.");
  wrangler = wrangler.replace(/TURNSTILE_HOSTNAMES\s*=\s*"[^"]*"/, `TURNSTILE_HOSTNAMES = "${args.hostname}"`);
  const origin = `https://${args.hostname}`;
  wrangler = wrangler.replace(/ALLOWED_ORIGINS\s*=\s*"[^"]*"/, `ALLOWED_ORIGINS = "${origin}"`);
}
await writeFile(worker, wrangler);
await writeFile(frontend, config);
console.log("Public configuration updated. Do not store SESSION_SECRET or TURNSTILE_SECRET in these files.");
