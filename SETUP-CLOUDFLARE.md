<!--
  Fail / File: SETUP-CLOUDFLARE.md
  Pembangun / Developer: Zrain
  Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
  Dikemas kini / Last updated: 2026-11-04
  BM: Panduan deployment dengan kawalan free-tier dan pengesahan Cloudflare.
  EN: Deployment instructions with free-tier controls and Cloudflare checks.
-->
# Zrain AI: Activate real AI on Cloudflare Free

This process requires an eligible account owner to confirm the provider's terms. **There is no real Cloudflare AI call in the offline demo.** All steps below use the free-tier configuration without providing payment details.

## 0. Check cost first

Before ANY deployment, check in the Cloudflare dashboard:

- Your account is on **Workers Free**, with Workers AI Free and D1 Free available.
- No Workers Paid plan and no AI Gateway unified paid billing / prepaid paid model routing are in use.
- Your chosen model is offered on Workers Free. The initial model is `@cf/qwen/qwen3-30b-a3b-fp8`.
- Free AI allocation and all other shared Cloudflare workloads have sufficient headroom.

Documentation: https://developers.cloudflare.com/workers-ai/platform/pricing/

If any condition is unclear, stop. Do not select an upgrade, enter a credit card or enable auto-billing for this project.

## 1. Prepare Cloudflare D1 (Free)

```powershell
cd "$env:USERPROFILE\Downloads\Zrain\Projects\zrain-ai\worker"
npx wrangler login
npx wrangler d1 create zrain-ai
```

Copy the real `database_id` (UUID) shown by Cloudflare. If D1 `zrain-ai` already exists, inspect it rather than creating duplicates.

## 2. Prepare Cloudflare Turnstile (Free)

Create a Turnstile widget for the **actual** site hostname, for example `zrain-ai.web.app` only if Firebase has assigned it to you. Configure it for normal production usage and copy the **public sitekey**. Keep the **private secret key** private. Turnstile is verified on the backend for every chat request.

Documentation: https://developers.cloudflare.com/turnstile/get-started/

## 3. Set non-secret configuration

Run from the project root. Replace the placeholders with the actual values shown in your dashboards:

```powershell
cd "$env:USERPROFILE\Downloads\Zrain\Projects\zrain-ai"
node scripts/configure.mjs --database-id=YOUR-REAL-D1-UUID --sitekey=YOUR-PUBLIC-SITEKEY --hostname=YOUR-REAL-FIREBASE-HOSTNAME
npm run setup:check
```

The script will not accept a Turnstile demo key for production setup. It sets `ALLOWED_ORIGINS` to your HTTPS frontend hostname and keeps the global quota. It **does not** accept or save private secrets.

## 4. Create remote database tables

```powershell
cd "$env:USERPROFILE\Downloads\Zrain\Projects\zrain-ai\worker"
npx wrangler d1 migrations apply zrain-ai --remote
```

Review the target database name before confirming.

## 5. Deploy the Worker only on Workers Free

```powershell
npx wrangler deploy
```

After successful deployment, the Worker prints an address like `https://zrain-ai-api.YOUR_ACCOUNT.workers.dev`. Copy the actual address. The API will correctly show `configured: false` until secrets are installed.

## 6. Enter private secrets without putting them in source code

```powershell
npx wrangler secret put SESSION_SECRET
npx wrangler secret put TURNSTILE_SECRET
```

For `SESSION_SECRET`, generate a long cryptographically random key offline. For example, execute this in PowerShell and copy the generated value **only into the Wrangler prompt**:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Keep that value private. `TURNSTILE_SECRET` is the Turnstile widget's private secret key. Never commit `.dev.vars`, local environment files or keys to a public repository. Do not paste secrets in conversations or screenshots.

## 7. Link the frontend to the Worker

```powershell
cd "$env:USERPROFILE\Downloads\Zrain\Projects\zrain-ai"
node scripts/configure.mjs --worker-url=https://YOUR-REAL-WORKER.workers.dev
npm run setup:check
```

Check the deployed Worker health endpoint in a browser, for example `https://YOUR-REAL-WORKER.workers.dev/api/health`. It should report `configured: true`. This only verifies configuration, not AI model quality.

## 8. Publish the frontend on Firebase Spark (Free)

Use a Firebase Hosting site you actually own and have confirmed to be **Spark**. Ensure the origin above matches its exact hostname and its Turnstile hostname.

The `frontend/firebase.json` file already specifies the `frontend` folder as its public directory when the command is run inside `frontend`.

```powershell
cd "$env:USERPROFILE\Downloads\Zrain\Projects\zrain-ai\frontend"
npx firebase-tools login
npx firebase-tools deploy --only hosting --project YOUR_REAL_FIREBASE_PROJECT_ID
```

Firebase can require you to explicitly choose a project/site. Do not reuse the project's identity from another Zrain product by mistake. The suggested `zrain-ai.web.app` is not guaranteed to be available.

## 9. Real-world verification, before public launch

1. Open the actual Firebase URL and verify the official Zrain logo and `Zrain AI` header.
2. Confirm `AI READY`, solve any Cloudflare Turnstile challenge and ask a question in Bahasa Melayu.
3. Ask a follow-up to verify conversational context, and another question in English.
4. Verify the sidebar shows personal quota and the remaining shared request allowance.
5. Confirm bad requests, invalid verification, expired session and exhausted quotas return safe errors.
6. Check Cloudflare's actual **neuron consumption dashboard** before inviting more users.
7. Test desktop and mobile. Inspect Privacy and Terms pages.
8. Only then consider integrating the Ecosystem search shortcut, in a separate reviewed change.

If the Free plan or real model does not work, do not activate a paid fallback. Keep the local demo and report the precise non-sensitive error.

## Provider references

- Cloudflare Workers AI Pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare Qwen3 model: https://developers.cloudflare.com/ai/models/%40cf/qwen/qwen3-30b-a3b-fp8/
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/get-started/
- Cloudflare D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
