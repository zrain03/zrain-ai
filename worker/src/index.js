/**
 * Fail / File: worker/src/index.js
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menyediakan API dengan sesi, Turnstile, pemeriksaan origin, kuota dan tindak balas selamat.
 * EN: Provide APIs with sessions, Turnstile, origin checks, quotas and safe responses.
 */
import { allowedOrigins, keyedHash, signSession, verifyOrigin, verifySession, verifyTurnstile } from "./security.js";
import { limits, readQuota, readSharedCapacity, reserveQuota } from "./quota.js";
import { runModel, validateChat } from "./chat.js";
import { gatherResearch } from "./web-research.js";

const COMMON_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "vary": "Origin"
};

// BM: Bina respons JSON dengan header keselamatan dan CORS yang dibenarkan sahaja.
// EN: Build JSON responses with security headers and origin-validated CORS.
function reply(payload, status, origin, env) {
  const headers = { ...COMMON_HEADERS, "content-type": "application/json; charset=utf-8" };
  if (verifyOrigin(origin, env)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
    headers["access-control-allow-headers"] = "content-type, authorization";
    headers["access-control-max-age"] = "600";
  }
  return new Response(JSON.stringify(payload), { status, headers });
}
// BM: Tukarkan mesej gagal kepada bentuk API yang konsisten.
// EN: Convert failure messages into the consistent API error shape.
function messageError(error, status, origin, env) { return reply({ error }, status, origin, env); }
// BM: Gagal tertutup jika binding atau secret production tidak lengkap.
// EN: Fail closed when required production bindings or secrets are missing.
function ready(env) {
  return !!(env.AI && env.DB && env.SESSION_SECRET?.length >= 32 && env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY && env.TURNSTILE_HOSTNAMES && allowedOrigins(env.ALLOWED_ORIGINS).length);
}
// BM: Baca IP dari Cloudflare untuk menghasilkan pengenal kuota terhash.
// EN: Read the Cloudflare IP for deriving hashed quota identifiers.
function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}
// BM: Baca JSON dengan had saiz sebelum memproses input yang tidak dipercayai.
// EN: Read JSON with a size limit before processing untrusted input.
async function bodyJson(request) {
  if (!(request.headers.get("content-type") || "").startsWith("application/json")) return null;
  if (Number(request.headers.get("content-length")) > 1500000) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.length > 1500000) { await reader.cancel(); return null; }
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  if (text.length > 1500000) return null;
  try { return JSON.parse(text); } catch { return null; }
}
// BM: Lalukan semua route melalui pemeriksaan origin, sesi, Turnstile dan kuota.
// EN: Route all requests through origin, session, Turnstile and quota gates.
export async function handleRequest(request, env) {
  const origin = request.headers.get("origin");
  const path = new URL(request.url).pathname;
  if (path === "/api/health" && request.method === "GET") {
    return reply({ ok: true, configured: ready(env) }, 200, origin, env);
  }
  if (!verifyOrigin(origin, env)) return messageError("Origin not allowed.", 403, origin, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...COMMON_HEADERS, "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, authorization", "access-control-max-age": "600" } });
  if (path === "/api/config" && request.method === "GET") {
    return reply({ configured: ready(env), turnstileSiteKey: ready(env) ? env.TURNSTILE_SITE_KEY : "", dailyLimit: limits(env).user || null, maxMessageChars: 2000 }, 200, origin, env);
  }
  if (!ready(env)) return messageError("Zrain AI is not configured yet.", 503, origin, env);
  if (path === "/api/session" && request.method === "POST") {
    return reply({ token: await signSession(env.SESSION_SECRET) }, 200, origin, env);
  }
  if (!((path === "/api/chat" && request.method === "POST") || (path === "/api/usage" && request.method === "GET"))) return messageError("Route not found.", 404, origin, env);
  const bearer = request.headers.get("authorization") || "";
  const session = bearer.startsWith("Bearer ") ? await verifySession(bearer.slice(7), env.SESSION_SECRET) : null;
  if (!session) return messageError("Session expired. Refresh and try again.", 401, origin, env);
  if (path === "/api/usage") {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const hash = await keyedHash(env.SESSION_SECRET, `visitor:${session.id}`);
      const caps = limits(env);
      const [quota, sharedCapacity] = await Promise.all([readQuota(env.DB, date, hash, caps), readSharedCapacity(env.DB, date, caps)]);
      return reply({ quota, sharedCapacity }, 200, origin, env);
    } catch { return messageError("Usage unavailable.", 503, origin, env); }
  }
  const body = await bodyJson(request);
  const valid = validateChat(body);
  if (!valid) return messageError("Invalid message or conversation length.", 400, origin, env);
  const ip = clientIp(request);
  let turnstileOk = false;
  try { turnstileOk = await verifyTurnstile({ token: body.turnstileToken, ip, env }); }
  catch { return messageError("Verification unavailable. Try again later.", 503, origin, env); }
  if (!turnstileOk) return messageError("Human verification failed. Complete the check and try again.", 403, origin, env);
  const day = new Date().toISOString().slice(0, 10); // UTC aligns with Cloudflare AI reset
  const caps = limits(env);
  const visitorHash = await keyedHash(env.SESSION_SECRET, `visitor:${session.id}`);
  const ipHash = await keyedHash(env.SESSION_SECRET, `ip:${day}:${ip}`);
  try {
    const reservation = await reserveQuota({ db: env.DB, day, visitorHash, ipHash, caps });
    if (!reservation.ok) {
      const error = reservation.reason === "slowdown" ? "Please slow down before sending another message." :
        reservation.reason === "global" ? "Today's free AI capacity is full. Please try again tomorrow." :
        reservation.reason === "user" ? `You have reached your ${caps.user} messages for today. Please try again tomorrow.` :
        "Too many requests from this network today. Please try again tomorrow.";
      return messageError(error, 429, origin, env);
    }
    // Free research only. Wikimedia fallback is bounded to a few public API requests.
    // Failure never triggers a paid search provider.
    const research = await gatherResearch(valid);
    const output = await runModel(env, { ...valid,
      researchContext: research.context, researchStatus: research.status });
    const [quota, sharedCapacity] = await Promise.all([readQuota(env.DB, day, visitorHash, caps), readSharedCapacity(env.DB, day, caps)]);
    return reply({ ...output, quota, sharedCapacity,
      researchStatus: research.status,
      researchAttempted: research.attempted === true,
      researchMode: research.status === "off" ? "off" : valid.research ? "manual" : "automatic",
      researchCheckedAt: research.checkedAt || null,
      researchScope: research.scope || "",
      sources: research.sources.map(({ title, url, provider, evidenceType, excerpt }) =>
        ({ title, url, provider, evidenceType: evidenceType || "read-page", excerpt: String(excerpt || "").slice(0, 240) })),
      ...(research.notice ? { researchNotice: research.notice } : {})
    }, 200, origin, env);
  } catch {
    // Do not leak data, secrets, prompts or provider errors to clients.
    return messageError("AI is unavailable right now. No paid fallback will be used.", 503, origin, env);
  }
}

export default {
  fetch: handleRequest,
  async scheduled(_event, env) {
    if (!env.DB) return;
    const cutoff = new Date(Date.now() - 4 * 86400_000).toISOString().slice(0, 10);
    await env.DB.prepare("DELETE FROM usage_counters WHERE day < ?").bind(cutoff).run();
  }
};
