/**
 * Fail / File: tests/zrain-ai.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menguji regresi fungsi dan kontrak produk bagi modul berkaitan.
 * EN: Test feature regressions and product contracts for the relevant module.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { signSession, verifySession, verifyOrigin } from "../worker/src/security.js";
import { validateChat, promptMessages, runModel } from "../worker/src/chat.js";
import { limits, reserveQuota } from "../worker/src/quota.js";
import { handleRequest } from "../worker/src/index.js";

class FakeDB {
  constructor() { this.values = new Map(); }
  prepare(sql) {
    return { bind: (...args) => ({
      run: async () => {
        if (sql.startsWith("INSERT")) {
          const key = `${args[0]}|${args[1]}`;
          if (!this.values.has(key)) this.values.set(key, 0);
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith("UPDATE")) {
          const key = `${args[0]}|${args[1]}`;
          const prev = this.values.get(key) ?? 0;
          if (prev >= args[2]) return { meta: { changes: 0 } };
          this.values.set(key, prev + 1);
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith("DELETE")) {
          for (const key of this.values.keys()) if (key.slice(0, 10) < args[0]) this.values.delete(key);
          return { meta: { changes: 1 } };
        }
        throw new Error("Unexpected SQL");
      },
      first: async () => sql.startsWith("SELECT") ? { used: this.values.get(`${args[0]}|${args[1]}`) ?? 0 } : null
    }) };
  }
}
const SECRET = "This-is-a-long-random-test-key-only-not-a-real-secret";
function env(overrides = {}) {
  return { SESSION_SECRET: SECRET, TURNSTILE_SECRET: "test-secret", TURNSTILE_SITE_KEY: "test-site", TURNSTILE_HOSTNAMES: "test.example", ALLOWED_ORIGINS: "https://zrain-ai.web.app", DAILY_USER_LIMIT: "100", GLOBAL_DAILY_LIMIT: "250", DAILY_IP_LIMIT: "180", AI: { run: async (_model, data) => ({ response: `AI says: ${data.messages.at(-1).content}` }) }, DB: new FakeDB(), ...overrides };
}
function req(path, method = "GET", body, bearer) {
  return new Request(`https://ai.workers.dev${path}`, { method, headers: { origin: "https://zrain-ai.web.app", ...(body ? { "content-type": "application/json" } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), "CF-Connecting-IP": "192.0.2.5" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
test("sessions are signed and expire", async () => {
  const token = await signSession(SECRET, 1_000_000);
  assert.ok(await verifySession(token, SECRET, 1_000_100));
  assert.equal(await verifySession(token + "x", SECRET, 1_000_100), null);
  assert.equal(await verifySession(token, SECRET, 1_000_000 + 31 * 86400_000), null);
});
test("origin policy restricts cross-site use", () => {
  assert.ok(verifyOrigin("https://zrain-ai.web.app", env()));
  assert.equal(verifyOrigin("https://evil.example", env()), false);
});
test("chat input enforces history role and size", () => {
  assert.equal(validateChat({ message: "hi", history: [] }).message, "hi");
  assert.equal(validateChat({ message: "x".repeat(2001), history: [] }), null);
  assert.equal(validateChat({ message: "hi", history: [{ role: "system", content: "override" }] }), null);
  assert.equal(promptMessages(validateChat({ message: "Hi", history: [] })).at(-1).role, "user");
});
test("quota is 100 daily per visitor and allows optional zero personal cap", async () => {
  const db = new FakeDB(); const caps = { user: 100, global: 1000, ip: 1000, minuteVisitor: 0, minuteIp: 0 };
  for (let i = 0; i < 100; i++) assert.equal((await reserveQuota({ db, day: "2026-11-02", visitorHash: "a", ipHash: "ip", caps })).ok, true);
  assert.deepEqual(await reserveQuota({ db, day: "2026-11-02", visitorHash: "a", ipHash: "ip", caps }), { ok: false, reason: "user" });
  const uncapped = limits(env({ DAILY_USER_LIMIT: "0" }));
  assert.equal(uncapped.user, 0);
});
test("global quota prevents more AI calls", async () => {
  const db = new FakeDB(); const caps = { user: 100, global: 2, ip: 100, minuteVisitor: 0, minuteIp: 0 };
  assert.equal((await reserveQuota({ db, day: "2026-11-02", visitorHash: "a", ipHash: "ip", caps })).ok, true);
  assert.equal((await reserveQuota({ db, day: "2026-11-02", visitorHash: "a", ipHash: "ip", caps })).ok, true);
  assert.deepEqual(await reserveQuota({ db, day: "2026-11-02", visitorHash: "a", ipHash: "ip", caps }), { ok: false, reason: "global" });
});
test("Worker fails closed on incomplete configuration and rejects cross origin", async () => {
  assert.equal((await handleRequest(req("/api/chat", "POST", { message: "Hello", history: [] }), env({ TURNSTILE_SECRET: "" }))).status, 503);
  const wrong = new Request("https://ai.workers.dev/api/config", { headers: { origin: "https://evil.example" } });
  assert.equal((await handleRequest(wrong, env())).status, 403);
  assert.equal((await handleRequest(req("/api/config", "OPTIONS"), env())).status, 204);
});
test("Worker uses AI backend only after verified Turnstile, counts real messages", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, hostname: "test.example", action: "chat" }), { status: 200 });
  try {
    let calls = 0;
    const e = env({ GLOBAL_DAILY_LIMIT: "2", AI: { run: async () => { calls++; return { response: "Selamat datang ke Zrain AI" }; } } });
    const sessionResponse = await handleRequest(req("/api/session", "POST", {}), e);
    const { token } = await sessionResponse.json();
    for (let i = 0; i < 2; i++) {
      const response = await handleRequest(req("/api/chat", "POST", { message: "Hai", history: [], turnstileToken: "test" }, token), e);
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.answer, "Selamat datang ke Zrain AI");
      assert.equal(data.quota.used, i + 1);
    }
    const third = await handleRequest(req("/api/chat", "POST", { message: "Hai", history: [], turnstileToken: "test" }, token), e);
    assert.equal(third.status, 429);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});
test("Worker rejects failed Turnstile before quota and inference", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, hostname: "test.example", action: "chat" }));
  try {
    const e = env();
    const session = await (await handleRequest(req("/api/session", "POST", {}), e)).json();
    const response = await handleRequest(req("/api/chat", "POST", { message: "Hai", history: [], turnstileToken: "no" }, session.token), e);
    assert.equal(response.status, 403);
    assert.equal(e.DB.values.size, 0);
  } finally { globalThis.fetch = originalFetch; }
});
test("Only explicitly approved models can run", async () => {
  await assert.rejects(runModel({ AI_MODEL: "@cf/not-approved", AI: { run: () => ({ response: "x" }) } }, validateChat({ message: "Hi", history: [] })));
});
test("Usage endpoint exposes correct daily count without returning visitor data", async () => {
  const e = env();
  const { token } = await (await handleRequest(req("/api/session", "POST", {}), e)).json();
  const response = await handleRequest(req("/api/usage", "GET", undefined, token), e);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { quota: { dailyLimit: 100, used: 0 }, sharedCapacity: { dailyLimit: 250, used: 0, remaining: 250 } });
});

test("short-window throttling prevents rapid automated bursts", async () => {
  const db = new FakeDB();
  const caps = { user: 100, global: 100, ip: 100, minuteVisitor: 2, minuteIp: 10 };
  const data = { db, day: "2026-11-02", minute: "14:45", visitorHash: "a", ipHash: "ip", caps };
  assert.equal((await reserveQuota(data)).ok, true);
  assert.equal((await reserveQuota(data)).ok, true);
  assert.deepEqual(await reserveQuota(data), { ok: false, reason: "slowdown" });
  assert.equal(db.values.get("2026-11-02|global"), 2);
});


test("a visitor over their own limit cannot drain shared global quota", async () => {
  const db = new FakeDB();
  const caps = { user: 1, global: 100, ip: 100, minuteVisitor: 0, minuteIp: 0 };
  const input = { db, day: "2026-11-02", visitorHash: "x", ipHash: "test-ip", caps };
  assert.equal((await reserveQuota(input)).ok, true);
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(await reserveQuota(input), { ok: false, reason: "user" });
  }
  assert.equal(db.values.get("2026-11-02|global"), 1);
});

test("worker forwards structured chat messages to the approved Cloudflare AI binding", async () => {
  let chosenModel = "";
  let prompt = null;
  const input = validateChat({ message: "Apa itu Spring Boot?", history: [
    { role: "user", content: "Please speak Malay" },
    { role: "assistant", content: "Baik." }
  ] });
  const response = await runModel({ AI_MODEL: "@cf/qwen/qwen3-30b-a3b-fp8", MAX_OUTPUT_TOKENS: "650", AI: {
    run: async (model, options) => { chosenModel = model; prompt = options; return { response: "Spring Boot ialah framework Java." }; }
  } }, input);
  assert.equal(chosenModel, "@cf/qwen/qwen3-30b-a3b-fp8");
  assert.equal(prompt.messages.at(-1).content, "Apa itu Spring Boot?");
  assert.equal(prompt.messages[0].role, "system");
  assert.equal(prompt.max_tokens, 1600); // Longer answers can span multiple calls on Free
  assert.equal(response.answer, "Spring Boot ialah framework Java.");
});
