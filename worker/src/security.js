/**
 * Fail / File: worker/src/security.js
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Mengesahkan origin, sesi bertandatangan dan token Turnstile.
 * EN: Validate origins, signed sessions and Turnstile tokens.
 */
const encoder = new TextEncoder();

// BM: Kodkan payload token dalam format base64url yang sesuai untuk header HTTP.
// EN: Encode session token bytes using HTTP-safe base64url.
export function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

// BM: Nyahkod hanya payload yang mengikuti format base64url sah.
// EN: Decode only payloads that match the expected base64url format.
function decodeBase64url(data) {
  if (!/^[\w-]+$/.test(data)) throw new Error("Invalid encoding");
  const raw = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

// BM: Derive kunci HMAC daripada secret kuat dan elakkan export material kunci.
// EN: Derive an HMAC key from a strong secret without making key material exportable.
async function signingKey(secret) {
  if (typeof secret !== "string" || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

// BM: Tandatangan sesi tetamu baharu yang mempunyai ID rawak dan timestamp.
// EN: Sign a guest session carrying a random ID and creation timestamp.
export async function signSession(secret, now = Date.now()) {
  const payload = base64url(encoder.encode(JSON.stringify({ id: crypto.randomUUID(), created: now })));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}

// BM: Semak tandatangan serta had umur sesi sebelum membenarkan API digunakan.
// EN: Verify signature and session age before permitting API use.
export async function verifySession(token, secret, now = Date.now()) {
  if (typeof token !== "string" || token.length > 600) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await signingKey(secret), decodeBase64url(parts[1]), encoder.encode(parts[0]));
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(decodeBase64url(parts[0])));
    if (!/^[0-9a-f-]{36}$/i.test(session.id) || !Number.isFinite(session.created)) return null;
    if (session.created > now + 60_000 || now - session.created > 30 * 86400_000) return null;
    return session;
  } catch { return null; }
}

// BM: Terbitkan kunci kuota tidak boleh diterbalikkan daripada ID tetamu atau rangkaian.
// EN: Derive nonreversible quota keys from guest or network identifiers.
export async function keyedHash(secret, text) {
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(text));
  return base64url(new Uint8Array(signature));
}

// BM: Bina senarai origin berasingan tanpa membuka akses wildcard.
// EN: Build the explicit origin list without allowing a wildcard.
export function allowedOrigins(raw = "") {
  return String(raw).split(",").map(x => x.trim()).filter(Boolean);
}

// BM: Hanya benarkan request dari origin production yang dikonfigurasi.
// EN: Permit requests only from configured production origins.
export function verifyOrigin(origin, env) {
  return !!origin && allowedOrigins(env.ALLOWED_ORIGINS).includes(origin);
}

// BM: Hantar token bot check kepada Cloudflare dan sahkan action serta hostname.
// EN: Send the bot-check token to Cloudflare and verify its action and hostname.
export async function verifyTurnstile({ token, ip, env, fetchImpl = fetch }) {
  if (!env.TURNSTILE_SECRET || !env.TURNSTILE_SITE_KEY || !env.TURNSTILE_HOSTNAMES) return false;
  if (typeof token !== "string" || token.length < 1 || token.length > 2048) return false;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  const response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", body, signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) return false;
  const data = await response.json();
  const hostnames = allowedOrigins(env.TURNSTILE_HOSTNAMES);
  return data.success === true && data.action === "chat" && hostnames.includes(data.hostname);
}
