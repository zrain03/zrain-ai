<!--
  Fail / File: docs/ENGINEERING-AUDIT-2026-11-04.md
  Pembangun / Developer: Zrain
  Dicipta / Created: 2026-11-04
  Dikemas kini / Last updated: 2026-11-04
  BM: Merekodkan penemuan audit, pembetulan, bukti, status dan batasan.
  EN: Record audit findings, changes, evidence, statuses and limitations.
-->
# Zrain AI, Engineering Audit, 4 November 2026

## Scope / Skop

BM: Sumber audit ialah `zrain-ai.zip`, `zrain-ui(3).zip` dan edisi draf penyatuan 61 halaman Zrain Ultimate Engineering Master Bilingual bertarikh 4 November 2026. Pelaksanaan mengekalkan business logic, API, database, sesi, quota, model, auth dan URL Cloudflare sedia ada. Produk lain tidak disentuh.

EN: The audit uses those exact uploaded sources. Chat business logic, APIs, D1 schema, sessions, quotas, approved AI models, authorization and existing Cloudflare endpoints remain unchanged. No other product is modified.

## Verified discoveries / Penemuan disahkan

| Severity | Finding | Change |
| --- | --- | --- |
| High (visual asset) | `frontend/zrain-logo.webp` was requested by chat, avatar and footer but absent from the uploaded ZIP. | Added the exact Zrain logo asset supplied in the UI reference ZIP. |
| Medium | Chat, Privacy and Terms implemented custom header/footer rather than the shared Zrain Golden Reference. | Added pinned `@zrain/ui` source/styles and mounted only its brand/header/footer identity. Page-specific controls and links remain local. |
| Medium | Source had no project-wide provenance registry; most source files had no developer/created/updated metadata. | Added file metadata and a per-file registry; documented 118 named functions in BM/EN without editing their executable statements. Historic creation dates remain unknown unless backed by upstream Git evidence. |
| Medium | README asserted now-incorrect limitations (no images, research, PDF, local history) and implied an installer existed. | Reconciled with source and tests; documented actual limitations and manual deployment. |
| Low | Temporary Firebase and Wrangler cache metadata was bundled with the project. | Removed only these two proven generated cache entries; preserved D1 migrations and product files. |
| Medium | Live-page navigation in Chromium was blocked by administrator policy. Static HTML/CSS rendering through Playwright succeeded at five viewport sizes plus two mobile policy pages, but active app interactions remained untested. | Static and Node tests pass; physical browser verification remains required before deploying. |

## Engineering decisions / Keputusan

BM: Struktur `frontend/`, `worker/`, `tests/` dan `docs/` sengaja dikekalkan. Mengalih semua JS/CSS ke folder baharu berisiko memutus import, aset relatif, Firebase dan ujian tanpa manfaat yang jelas. UI reference dibundel dalam `frontend/zrain-ui/` supaya laman statik tidak memerlukan package manager atau shared identity. Fail asal dibekalkan sebagai ZIP sandaran untuk perbandingan/rollback.

EN: Existing directory conventions are preserved to avoid breaking imports, asset URLs, Firebase hosting or tests. The browser-consumable shared UI version is vendored and pinned locally; it does not centralize authentication or databases. The original uploaded ZIP is the rollback baseline.

## Testing / Pengujian

- Before change: `npm run check`: **84 passed / 0 failed**.
- After UI integration: `npm run check`: **84 passed / 0 failed**, with two original markup-specific tests updated to assert the Golden Reference contract rather than the old custom markup.
- After documentation, provenance and Golden Reference regression tests: **89 passed / 0 failed**, source registry verified **59 files**. See `docs/AI-HANDOFF.md` for commands. Passing local tests cannot prove live Cloudflare Workers AI or Firebase behavior.
- Browser static layout: **Partially Verified**. Chromium rendered inlined local HTML/CSS and original logo at 1440×900, 1024×768, 390×844, 320×600 and 375×500, plus mobile Privacy/Terms pages. The static results had no document horizontal overflow, and the visible composer and footer stayed inside the viewport. The browser blocked normal URL navigation (`ERR_BLOCKED_BY_ADMINISTRATOR`), so this is **not** a live-page JavaScript, Turnstile, history, or real hosting test.
- Executable business logic regression: the 11 original chat/backend JavaScript modules were confirmed to preserve every original line in its original order; changes to these modules are comment insertions only.

## Critical invariants / Kontrak mesti kekal

- User daily cap defaults to 100; global cap 250; network and short-window limits remain in `worker/wrangler.toml`.
- No paid provider or fallback; fail closed when budget, model, configuration, Turnstile or D1 is unavailable.
- Separate per-project auth/backend/D1; no user message stored in D1.
- No new privileged routes, shared login service, third-party tracking or paid infrastructure.
- Research allowlist, redirect blocking, safe Markdown, iframe isolation and file size limits stay in place.

## Remaining documentation scope / Dokumentasi berbaki

BM: Metadata dan 118 fungsi bernama mempunyai penerangan BM di atas EN; fail format tanpa komen direkod dalam registry. Ini **bukan** bukti bahawa setiap deklarasi CSS, event callback anonymous atau setiap baris executable sudah memiliki komen penuh. Sebahagian komen lama berbahasa English dikekalkan agar pengubahan source stabil tidak dipaksakan. Pembaikan source dan verifikasi diutamakan berbanding penambahan komen automatik yang tidak bermakna.

EN: Metadata and 118 named functions now have BM-first/EN-second notes; commentless files are in the registry. This does **not** certify that every CSS declaration, anonymous callback or executable line has complete comments. Some legacy English-only comments were retained to avoid unnecessary edits to stable source. Meaningful documentation is preferred over generated comment noise.

## Remaining acceptance checks / Semakan sebelum deploy

1. Review local `git diff` and original project backup; do not overwrite custom changes made since the archive was produced.
2. Run `npm run check` and `npm run setup:check`, verifying all needed configuration without exposing secrets.
3. Preview chat and Privacy/Terms at desktop, tablet and 320px mobile including short-height displays. Confirm logo/header/footer, no unwanted overflow, chat input visibility, history drawer, active controls, legal links and Back navigation.
4. On real Free-tier Cloudflare, independently verify Turnstile, signed session, 100-user and 250-global quotas, model access, research/attachments, denial and quota-exhaustion paths, including current billing status.
5. Deploy Worker and Firebase only after manual approval; monitor usage and have a rollback snapshot.

**Status:** Source-level repair verified by tests; production and real-browser release verification still pending.
