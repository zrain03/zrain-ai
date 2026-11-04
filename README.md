<!--
  Fail / File: README.md
  Pembangun / Developer: Zrain
  Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
  Dikemas kini / Last updated: 2026-11-04
  BM: Dokumentasi pengguna dan pembangun untuk menjalankan serta menyerahkan Zrain AI.
  EN: User and developer instructions for running and handing off Zrain AI.
-->
# Zrain AI

**Current review (2026-11-04):** The attached source was audited and tested offline. The existing project configuration points at the production Cloudflare Worker and Firebase site, but this review does **not** establish the live deployment state or confirm inference/billing configuration in the Cloudflare account.

**Product:** A public multilingual AI chat assistant. The official Zrain logo and the name `Zrain AI` are used throughout the interface. The existing Zrain Ecosystem search remains separate and unchanged.

**Workspace:** `C:\Users\<username>\Downloads\Zrain\Projects\zrain-ai`

## Quick start

Run from Windows PowerShell:

```powershell
cd "$env:USERPROFILE\Downloads\Zrain\Projects\zrain-ai"
npm run check
npm run setup:check
npm run demo
```

Visit `http://127.0.0.1:8766/` for a UI demo. Its answers are simulated and clearly labeled. Stop the demo with `Ctrl + C`.

## What's in this update

1. Backend is connected in source code to Cloudflare's `env.AI.run(...)` binding using Qwen3 30B A3B by default. It does not require an OpenAI or Gemini paid API key.
2. Anonymous daily limit stays at 100. Set `DAILY_USER_LIMIT = "0"` if you deliberately want no personal limit. Shared budget, network caps and per-minute caps must remain enabled.
3. Shared daily capacity is returned by the API and shown in the chat sidebar. This number is an internal request budget, **not a prediction of the remaining Cloudflare neurons**.
4. Requests rejected by a user's personal or network limit no longer consume the shared global counter.
5. New offline deployment preflight script, public setup configuration script, and regression tests.
6. Existing local branding, `frontend/config.js` and `worker/wrangler.toml` are preserved by the update installer. No other Zrain projects are modified.

## Zero cost rules

Only proceed if the actual Cloudflare account is on **Workers Free**, D1 Free and Workers AI Free, with no paid credits, paid models, Paid Workers upgrade or chargeable fallback configured. Cloudflare's Free allowance is 10,000 neurons/day shared across the Cloudflare account. The selected model, prompt length, response length and any other Workers AI usage determine how long the free daily allocation lasts. When free inference is exhausted, the service must stop rather than bill the developer.

Do not claim unlimited availability. 100 messages per guest per day is a maximum when capacity remains, not a guaranteed amount. Anonymous visitors can reset cookies or change networks, so these are best-effort personal caps; the global cap is the primary shared safety control. If the account ever moves to a paid plan, the app's own D1 counters are **not** a monetary budget monitor. Review the provider billing configuration first and keep Zrain AI on Free.

## Connect to real Cloudflare Workers AI

Read **`SETUP-CLOUDFLARE.md`** from start to finish. Cloudflare and Firebase account settings must be entered by the account owner. Never share private secrets in screenshots or chat messages.

## Project contents

- `frontend/`: responsive chat UI, official branding, Privacy/Terms, Firebase configuration.
- `worker/src/`: signed anonymous sessions, Turnstile verification, Cloudflare AI call, free-tier quotas.
- `worker/migrations/`: D1 usage counters only. Message content is not written to D1.
- `scripts/`: non-secret public configuration and preflight verification.
- `tests/`: offline Node.js integration and regression tests.
- `integration/`: optional Ecosystem search button installer; **do not run until live chat has been tested**.

## Current capabilities and limitations (source verified)

- Multilingual chat, safe Markdown/code rendering, copy/continuation, local conversation history, multiple text/PDF/image attachments, image understanding through an approved AI binding, limited Wikipedia/allowlisted public-page research, and browser-only HTML/CSS/JS previews. Exact behavior depends on free provider availability.
- Research is **not** unrestricted web search. Scanned PDFs or PDF extraction via a third-party browser library may fail; file processing has limits. Code preview runs in an isolated browser iframe with network access blocked, not as a backend or a full framework build.
- Chats and attachment previews reside on the user's browser, with no transcript persistence in the Zrain D1 quota database. They are not backed up or synchronized across devices.
- No voice chat, unified accounts, or unlimited free AI inference. AI responses can be incomplete, incorrect or outdated.
- The live production service and account-side billing, quotas, Cloudflare usage and Turnstile must be checked by the owner before any release.

## Golden Reference and engineering audit

- The header/footer use a pinned, local copy of `@zrain/ui` 1.0.0 from the reference ZIP provided for the 2026-11-04 review; the chat header keeps all existing conversation controls and adapts the footer to the fixed-height composer.
- `frontend/zrain-logo.webp` is the original official logo from that same reference. A local copy prevents dependence on remote image fallback.
- File metadata and the `FILE_PROVENANCE.json` inventory follow the master standard. Existing creation dates are recorded as **Unknown** because the source ZIP contains no reliable original Git history. See `docs/ENGINEERING-AUDIT-2026-11-04.md` and `docs/AI-HANDOFF.md`.
- Run `npm run check` and `npm run setup:check`; do not treat passing offline tests as production deployment verification.

## Changes and safety

This deliverable is a complete source ZIP, **not** an auto-installer. Back up the current local project first, review file differences, then replace or merge only the Zrain AI project contents. No other Zrain project is changed. Configuration was preserved from the supplied ZIP, and deployment is manual.

**Developed by Zrain**  
*Made for people. Built with purpose.*  
Contact: `zrain.dev@gmail.com`
