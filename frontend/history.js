/**
 * Fail / File: frontend/history.js
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menyimpan sejarah perbualan pada browser pengguna, tanpa server sync.
 * EN: Store conversation history in the user browser without server sync.
 */
// Local, per-browser conversation library. No cloud sync or server-side chat storage.
const STORAGE_KEY = "zrain_ai_conversations_v1";
const MAX_CONVERSATIONS = 35;
const MAX_MESSAGES = 80;
const MAX_SAVED_MESSAGE = 150_000; // Prevent old 8,500 character truncation on reload

export const localChatStorageKey = STORAGE_KEY;
// BM: Hadkan panjang teks yang akan disimpan tanpa menukar jenis input kepada HTML.
// EN: Bound stored text and coerce inputs without interpreting them as HTML.
const safeText = (value, length) => String(value ?? "").slice(0, length);

// BM: Tapis rekod mesej dan metadata lampiran/sumber supaya data localStorage tidak dipercayai secara buta.
// EN: Sanitize saved messages, attachments and source metadata instead of trusting localStorage.
function sanitizeMessage(item) {
  if (!item || !["user", "assistant"].includes(item.role)) return null;
  const content = safeText(item.content, MAX_SAVED_MESSAGE);
  if (!content) return null;
  const attachment = item.attachment && typeof item.attachment === "object" ? {
    name: safeText(item.attachment.name, 100),
    kind: ["image", "document"].includes(item.attachment.kind) ? item.attachment.kind : "document"
  } : null;
  const attachments = Array.isArray(item.attachments) ? item.attachments.slice(0, 4).flatMap(value => {
    if (!value || typeof value.name !== "string" || !["image", "document"].includes(value.kind)) return [];
    return [{ name: safeText(value.name, 100), kind: value.kind, ...(typeof value.id === "string" && /^[\w-]{8,90}$/.test(value.id) ? { id: value.id } : {}) }];
  }) : [];
  const sources = item.role === "assistant" && Array.isArray(item.sources) ? item.sources.slice(0, 3).flatMap(source => {
    try {
      const url = new URL(source.url);
      if (url.protocol !== "https:" || url.username || url.password) return [];
      return [{ title: safeText(source.title, 160), url: url.toString().slice(0, 600), provider: safeText(source.provider, 40),
        evidenceType: safeText(source.evidenceType || "read-page", 25), excerpt: safeText(source.excerpt || "", 240) }];
    } catch { return []; }
  }) : [];
  return {
    role: item.role, content,
    contextText: item.role === "user" ? safeText(item.contextText || content, MAX_SAVED_MESSAGE) : content,
    ...(attachment ? { attachment } : {}),
    ...(attachments.length ? { attachments } : {}),
    ...(item.role === "assistant" && item.incomplete === true ? { incomplete: true } : {}),
    ...(sources.length ? { sources } : {}),
    ...(item.role === "assistant" && item.researchAttempted === true ? {
      researchAttempted: true,
      researchStatus: safeText(item.researchStatus || "unavailable", 24),
      researchMode: ["manual", "automatic"].includes(item.researchMode) ? item.researchMode : "manual",
      researchNotice: safeText(item.researchNotice || "", 230),
      researchCheckedAt: safeText(item.researchCheckedAt || "", 35)
    } : {})
  };
}
// BM: Sahkan ID, timestamp dan jumlah mesej bagi rekod sejarah yang dibaca.
// EN: Validate conversation IDs, timestamps and message count for loaded history.
function sanitizeConversation(item) {
  if (!item || typeof item.id !== "string" || !/^[\w-]{6,80}$/.test(item.id)) return null;
  return {
    id: item.id,
    title: safeText(item.title || "New conversation", 72),
    updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
    createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
    messages: Array.isArray(item.messages) ? item.messages.map(sanitizeMessage).filter(Boolean).slice(-MAX_MESSAGES) : []
  };
}
// BM: Baca sejarah browser secara defensif; pulangkan senarai kosong jika storan rosak atau disekat.
// EN: Read browser history defensively; return an empty list for malformed or unavailable storage.
export function readConversations(store = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeConversation).filter(Boolean)
      .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS);
  } catch { return []; }
}
// BM: Simpan hanya sejarah yang telah disanitasi dan terhad kepada kuota browser.
// EN: Persist only sanitized history within browser storage limits.
export function saveConversations(items, store = globalThis.localStorage) {
  const clean = items.map(sanitizeConversation).filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS);
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(clean));
    return true;
  } catch { return false; }
}
// BM: Bina rekod chat kosong dengan ID dan masa setempat tanpa menghantar data ke server.
// EN: Create a new local chat record with an ID and timestamps without a server request.
export function makeConversation(id = crypto.randomUUID()) {
  const time = Date.now();
  return { id, title: "New conversation", createdAt: time, updatedAt: time, messages: [] };
}
// BM: Jana tajuk ringkas daripada prompt pertama supaya senarai chat mudah diimbas.
// EN: Derive a short title from the opening prompt for readable history navigation.
export function conversationTitle(message) {
  const text = safeText(message, 72).replace(/\s+/g, " ").trim();
  return text.length > 60 ? text.slice(0, 57) + "..." : text || "New conversation";
}
// BM: Kemas kini chat aktif tanpa menyimpan rekod dengan ID yang sama dua kali.
// EN: Update the active chat without duplicating records sharing the same ID.
export function upsertConversation(items, next) {
  const valid = sanitizeConversation(next);
  if (!valid) return items;
  return [valid, ...items.filter(item => item.id !== valid.id)].sort((a,b) => b.updatedAt-a.updatedAt).slice(0,MAX_CONVERSATIONS);
}
