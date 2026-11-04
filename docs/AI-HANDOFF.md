<!--
  Fail / File: docs/AI-HANDOFF.md
  Pembangun / Developer: Zrain
  Dicipta / Created: 2026-11-04
  Dikemas kini / Last updated: 2026-11-04
  BM: Panduan sambungan kerja yang tidak memerlukan sejarah chat.
  EN: Standalone continuation guide that needs no prior chat history.
-->
# Zrain AI, AI / Developer Handoff

## Intended design / Reka bentuk

BM: Zrain AI ialah laman Firebase Hosting statik dengan Cloudflare Worker, D1 bagi kuota, Workers AI dan Turnstile. Sejarah chat dan pratonton lampiran disimpan di browser. Research terhad kepada Wikipedia serta halaman dalam allowlist. Setiap projek Zrain kekal bebas dari sudut identity/backend/database.

EN: Zrain AI is a static Firebase Hosting site with a Cloudflare Worker, D1 for quotas, Workers AI and Turnstile. Chat history and attachment previews remain browser-local. Research is limited to Wikipedia and allowlisted pages. Every Zrain product keeps independent identity, backend and storage.

## Workstation steps / Windows PowerShell

```powershell
cd "$env:USERPROFILE\Downloads\Zrain\Projects\zrain-ai"
npm run check
npm run setup:check
npm run demo
```

BM: `npm run demo` hanyalah simulasi UI; jangan anggap jawapan itu inferens AI sebenar. Semak `SETUP-CLOUDFLARE.md` untuk deployment yang memerlukan akses pemilik akaun. Jangan masukkan secret ke fail, ZIP, log atau chat.

EN: `npm run demo` is a UI simulation only. Read `SETUP-CLOUDFLARE.md` before deploying with the account owner's credentials. Do not put secrets in files, ZIPs, logs or chat.

## File map / Peta fail

- `frontend/index.html`, `privacy.html`, `terms.html`: pages.
- `frontend/app.js`: chat state and requests; `history.js`, `local-previews.js`, `attachments.js`: browser content lifecycle.
- `frontend/zrain-ui/{zrain-ui.js,brand.css,brand-init.js}`: pinned shared brand. Update together only after checking `@zrain/ui` compatibility.
- `frontend/brand-integration.css`: compact shell adapter; do not loosen fixed composer or mobile footer constraints.
- `worker/src/index.js`: API, quotas and routing; `security.js`: session/origin/Turnstile; `quota.js`: D1 limits; `chat.js`: approved models; `web-research.js`: source allowlist.
- `worker/migrations/0001_usage.sql`: required historical D1 migration. Never delete it just for a clean folder.
- `tests/`: offline regression tests; `FILE_PROVENANCE.json`: source metadata registry.

## Non-negotiable contract / Kontrak kekal

- `frontend/config.js` production API URL and `worker/wrangler.toml` current Cloudflare/D1 bindings must be reviewed, not silently replaced.
- No paid services, automatic billing or unrestricted retrieval.
- Never relocate browser files without updating import URLs and Firebase public-directory paths.
- Preserve exact brand text `Developed by Zrain` and footer tagline `Made for people. Built with purpose.`
- `zrain-logo.webp` is provided with the shipped package. No external image dependency needed for normal display.

## Verification status / Status

BM: Ujian Node ialah bukti source; bukan bukti deployment. Visual Chromium dalam persekitaran audit terhalang oleh polisi pentadbir. Laksanakan ujian manual desktop/mobile dan semakan Cloudflare Free sebelum menerbitkan.

EN: Node tests verify local source only. Static local HTML/CSS was rendered in Chromium at five viewport sizes, without observed document overflow; live navigation was blocked by administrator policy. Interactive desktop/mobile and Cloudflare Free checks are still required before publishing.

See `docs/ENGINEERING-AUDIT-2026-11-04.md` for the detailed report and rollback conditions.
