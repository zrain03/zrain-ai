/**
 * Fail / File: frontend/local-previews.js
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menyimpan pratonton lampiran sementara dalam IndexedDB pada browser.
 * EN: Keep short-lived attachment previews in browser IndexedDB.
 */
// Browser-only attachments preview library. Never sends stored previews to Zrain servers.
const DB_NAME = "zrain_ai_attachment_previews_v1";
const STORE = "previews";
const FALLBACK_PREFIX = "zrain_ai_local_preview_";
const FALLBACK_MAX_CHARS = 65_000;
const MAX_RECORDS = 120;
const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// BM: Buka IndexedDB untuk cache pratonton lokal dan urus keserasian skema.
// EN: Open IndexedDB for local previews and handle schema compatibility.
function openDb() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return new Promise(resolve => {
    let finished = false;
    // BM: Tunggu penyelesaian transaksi IndexedDB sebelum menganggap simpanan berjaya.
    // EN: Wait for IndexedDB transaction completion before reporting a successful write.
    const done = result => { if (!finished) { finished = true; resolve(result); } };
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => done(req.result);
      req.onerror = () => done(null);
      req.onblocked = () => done(null);
    } catch { done(null); }
  });
}

// BM: Baca pratonton sementara daripada fallback browser jika IndexedDB gagal.
// EN: Read temporary previews from a browser fallback if IndexedDB is unavailable.
function fallbackRead(id) {
  try {
    const raw = globalThis.localStorage?.getItem(FALLBACK_PREFIX + id);
    if (!raw) return null;
    const row = JSON.parse(raw);
    return row?.id === id && Date.now() - row.savedAt <= EXPIRY_MS ? row : null;
  } catch { return null; }
}
// BM: Simpan fallback tempatan sahaja apabila IndexedDB tidak tersedia.
// EN: Write only to local fallback storage when IndexedDB cannot be used.
function fallbackWrite(row) {
  // Small text documents only. Images and large PDFs use IndexedDB, not localStorage.
  if (row.kind !== "document" || row.text.length > FALLBACK_MAX_CHARS) return false;
  try {
    const storage = globalThis.localStorage;
    if (!storage) return false;
    storage.setItem(FALLBACK_PREFIX + row.id, JSON.stringify(row));
    return storage.getItem(FALLBACK_PREFIX + row.id) !== null;
  } catch { return false; }
}
// BM: Bersihkan rekod fallback tanpa menyentuh data perbualan lain.
// EN: Clear fallback records without touching unrelated conversation data.
function fallbackDelete(id) {
  try { globalThis.localStorage?.removeItem(FALLBACK_PREFIX + id); } catch {}
}
const memory = new Map();
// BM: Terima ID pratonton yang mengikuti corak terhad sahaja.
// EN: Accept only preview identifiers matching the bounded format.
function validId(id) { return typeof id === "string" && /^[a-zA-Z0-9_-]{8,90}$/.test(id); }
// BM: Jalankan operasi storan dalam transaksi yang ditentukan.
// EN: Run the storage operation in its requested transaction.
function transaction(db, mode, task) {
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = task(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
      tx.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

// BM: Simpan pratonton yang dibenarkan supaya boleh dibuka semula pada peranti ini.
// EN: Save an allowed preview for later access on the same device.
export async function saveLocalPreview(item) {
  if (!validId(item?.id)) return false;
  const row = {
    id: item.id,
    kind: item.kind === "image" ? "image" : "document",
    name: String(item.name || "File").slice(0, 100),
    text: typeof item.fullPreview === "string" ? item.fullPreview.slice(0, 150_000) : "",
    image: item.kind === "image" && /^data:image\/jpeg;base64,/.test(item.preview || "") ? item.preview : "",
    savedAt: Date.now()
  };
  memory.set(row.id, row);
  const db = await openDb();
  if (!db) return fallbackWrite(row);
  const saved = await transaction(db, "readwrite", store => store.put(row));
  // Put returns the key, so null means failure.
  if (saved === null) { db.close(); return fallbackWrite(row); }
  try {
    const rows = await transaction(db, "readonly", store => store.getAll());
    if (Array.isArray(rows)) {
      const old = rows.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)).filter((entry, index) => index >= MAX_RECORDS || Date.now() - (entry.savedAt || 0) > EXPIRY_MS);
      for (const entry of old) await transaction(db, "readwrite", store => store.delete(entry.id));
    }
  } catch { /* Retention cleanup is best effort. */ }
  db.close();
  return true;
}
// BM: Ambil kandungan lampiran setempat dengan ID yang telah disahkan.
// EN: Retrieve local attachment content using a validated identifier.
export async function getLocalPreview(id) {
  if (!validId(id)) return null;
  if (memory.has(id)) return memory.get(id);
  const db = await openDb();
  if (!db) return fallbackRead(id);
  const record = await transaction(db, "readonly", store => store.get(id));
  db.close();
  const available = record && Date.now() - (record.savedAt || 0) <= EXPIRY_MS ? record : fallbackRead(id);
  if (!available) return null;
  memory.set(id, available);
  return available;
}
// BM: Buang pratonton yang berkaitan dengan perbualan yang telah dipadam.
// EN: Delete previews associated with a removed conversation.
export async function deleteLocalPreviews(ids) {
  const good = [...new Set(ids)].filter(validId);
  for (const id of good) { memory.delete(id); fallbackDelete(id); }
  const db = await openDb();
  if (!db) return;
  for (const id of good) await transaction(db, "readwrite", store => store.delete(id));
  db.close();
}
// BM: Padam semua rekod pratonton aplikasi tanpa menjejaskan aplikasi lain.
// EN: Clear all this app’s preview records without touching other apps.
export async function clearLocalPreviews() {
  memory.clear();
  try {
    const keys = [];
    for (let i = 0; i < (globalThis.localStorage?.length || 0); i++) {
      const key = globalThis.localStorage?.key(i);
      if (key?.startsWith(FALLBACK_PREFIX)) keys.push(key);
    }
    keys.forEach(key => globalThis.localStorage?.removeItem(key));
  } catch {}
  const db = await openDb();
  if (!db) return;
  await transaction(db, "readwrite", store => store.clear());
  db.close();
}
