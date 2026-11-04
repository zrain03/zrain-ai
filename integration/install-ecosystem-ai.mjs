/**
 * Fail / File: integration/install-ecosystem-ai.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menambah pautan optional pada Ecosystem dengan semakan anchor dan dry run.
 * EN: Optionally add an Ecosystem shortcut using anchor checks and a dry run.
 */
// Explicit opt-in integration. Run only AFTER the standalone AI is deployed.
// Does not change the existing Ecosystem search implementation.
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const folder = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!folder) { console.error('Usage: node integration/install-ecosystem-ai.mjs "C:\\path\\to\\zrain-ecosystem" [--dry-run]'); process.exit(1); }
const root = resolve(folder);
const indexPath = join(root, "public", "index.html");
const productsPath = join(root, "public", "console-products.js");
const linkPath = join(root, "public", "zrain-ai-link.js");
const stylePath = join(root, "public", "zrain-ai-link.css");
const index = await readFile(indexPath, "utf8");
const products = await readFile(productsPath, "utf8");
if (!index.includes('data-open-search') || !index.includes('src="/ecosystem-search.js')) throw new Error("Expected Ecosystem search anchors not found. No changes made.");
if (!products.includes('export const PRODUCTS = Object.freeze({')) throw new Error("Expected Console product registry not found. No changes made.");
if (!index.includes('id="zrain-console"')) throw new Error("Zrain Console is missing. No changes made.");
const scriptTag = '  <script type="module" src="/zrain-ai-link.js?v=1"></script>';
const withScript = index.includes(scriptTag) ? index : index.replace(/(\s*<script type="module" src="\/ecosystem-search\.js\?v=[^\"]+"><\/script>)/, `$1\n${scriptTag}`);
const styleTag = '  <link rel="stylesheet" href="/zrain-ai-link.css?v=1">';
const updatedIndex = withScript.includes(styleTag) ? withScript : withScript.replace('</head>', `${styleTag}\n</head>`);
if (!updatedIndex.includes(scriptTag)) throw new Error("Could not install integration script. No changes made.");
const registration = `  "zrain-ai": Object.freeze({
    name: "Zrain AI", kind: "web",
    icon: "/zrain-logo.webp",
    description: "Chat with a multilingual AI assistant. Shared free AI capacity applies.",
    webUrl: "https://zrain-ai.web.app/"
  }),
`;
const updatedProducts = products.includes('"zrain-ai": Object.freeze') ? products : products.replace('export const PRODUCTS = Object.freeze({\n', `export const PRODUCTS = Object.freeze({\n${registration}`);
const linkSource = `// Non-invasive AI shortcut. Existing search button remains untouched.
const searchButton = document.querySelector(".header-project-search[data-open-search]");
if (searchButton && !document.querySelector("[data-console='zrain-ai'].header-ai-link")) {
  const shortcut = document.createElement("button");
  shortcut.type = "button";
  shortcut.className = "header-ai-link";
  shortcut.dataset.console = "zrain-ai";
  shortcut.title = "Chat with Zrain AI";
  shortcut.setAttribute("aria-label", "Open Zrain AI in Zrain Console");
  shortcut.textContent = "✦";
  searchButton.insertAdjacentElement("afterend", shortcut);
}
`;
if (dryRun) { console.log("Dry run successful. Two existing files would be updated. One JS and one CSS file would be created."); process.exit(0); }
// This installer intentionally modifies only three known files, idempotently.
await writeFile(indexPath, updatedIndex, "utf8");
await writeFile(productsPath, updatedProducts, "utf8");
await writeFile(linkPath, linkSource, "utf8");
await writeFile(stylePath, `.header-ai-link{flex:0 0 auto;min-width:42px;height:42px;border-radius:11px;border:1px solid #edcbb9;background:#fff2e9;color:#b54d32;font-size:23px;font-weight:850;cursor:pointer;box-shadow:0 3px 10px #b94f330b}.header-ai-link:hover{background:#ffe7d7;border-color:#c97859}.header-ai-link:focus-visible{outline:3px solid #90c5ba;outline-offset:3px}@media(max-width:540px){.header-ai-link{min-width:39px;height:39px;font-size:21px}}`, "utf8");
console.log("Zrain AI shortcut installed. Search and Console functionality preserved by design. Run the Ecosystem release tests before deployment.");
