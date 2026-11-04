/**
 * Fail / File: worker/src/quota.js
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menguatkuasakan kuota harian dan kadar penggunaan dalam Cloudflare D1.
 * EN: Enforce daily and short-window consumption quotas in Cloudflare D1.
 */
// BM: Baca tetapan kuota integer yang sah atau kembalikan default selamat.
// EN: Read valid integer quota settings or fall back to safe defaults.
export function numberSetting(value, fallback, { min = 0, max = 100000 } = {}) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : fallback;
}

// BM: Satukan had pengguna, IP, global dan per minit daripada konfigurasi.
// EN: Collect user, IP, global and per-minute limits from configuration.
export function limits(env) {
  return {
    user: numberSetting(env.DAILY_USER_LIMIT, 100), // 0 = no personal cap
    global: numberSetting(env.GLOBAL_DAILY_LIMIT, 250, { min: 1 }),
    ip: numberSetting(env.DAILY_IP_LIMIT, 180, { min: 1 }),
    minuteVisitor: numberSetting(env.PER_MINUTE_VISITOR_LIMIT, 6, { min: 1 }),
    minuteIp: numberSetting(env.PER_MINUTE_IP_LIMIT, 15, { min: 1 })
  };
}

// Each counter is atomic under concurrent requests. We only reserve the shared
// global quota LAST, after per-visitor and per-network caps have passed, so
// spamming an already-capped visitor cannot drain everyone's global allowance.
// Reservation is intentionally conservative: a failed inference may still use
// an allowance. Cloudflare Free is the final hard limit for inference cost.
// BM: Tingkatkan kiraan D1 secara atomic hanya apabila cap masih belum penuh.
// EN: Atomically increment a D1 counter only when capacity is available.
async function reserveCounter(db, day, scope, cap) {
  await db.prepare("INSERT INTO usage_counters(day,scope,used) VALUES(?,?,0) ON CONFLICT(day,scope) DO NOTHING")
    .bind(day, scope).run();
  const changed = await db.prepare("UPDATE usage_counters SET used=used+1 WHERE day=? AND scope=? AND used < ?")
    .bind(day, scope, cap).run();
  return changed.meta?.changes === 1;
}

// BM: Sahkan had rangkaian dan pengguna sebelum menolak had global yang dikongsi.
// EN: Check network and visitor limits before reserving shared global capacity.
export async function reserveQuota({ db, day, minute = new Date().toISOString().slice(11, 16), visitorHash, ipHash, caps }) {
  if (caps.minuteIp && !await reserveCounter(db, day, `minute-ip:${minute}:${ipHash}`, caps.minuteIp)) return { ok: false, reason: "slowdown" };
  if (caps.minuteVisitor && !await reserveCounter(db, day, `minute-visitor:${minute}:${visitorHash}`, caps.minuteVisitor)) return { ok: false, reason: "slowdown" };
  if (caps.user !== 0 && !await reserveCounter(db, day, `visitor:${visitorHash}`, caps.user)) return { ok: false, reason: "user" };
  if (!await reserveCounter(db, day, `ip:${ipHash}`, caps.ip)) return { ok: false, reason: "ip" };
  if (!await reserveCounter(db, day, "global", caps.global)) return { ok: false, reason: "global" };
  return { ok: true };
}

// BM: Baca penggunaan harian tetamu tanpa mendedahkan ID peribadi.
// EN: Read guest daily usage without revealing a personal identifier.
export async function readQuota(db, day, visitorHash, caps) {
  const result = await db.prepare("SELECT used FROM usage_counters WHERE day=? AND scope=?")
    .bind(day, `visitor:${visitorHash}`).first();
  return { dailyLimit: caps.user || null, used: result?.used || 0 };
}

// BM: Pulangkan baki kuota global yang dirizab dalam D1.
// EN: Return remaining global capacity reserved in D1.
export async function readSharedCapacity(db, day, caps) {
  const result = await db.prepare("SELECT used FROM usage_counters WHERE day=? AND scope=?")
    .bind(day, "global").first();
  const used = result?.used || 0;
  return { dailyLimit: caps.global, used, remaining: Math.max(0, caps.global - used) };
}
