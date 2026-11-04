/**
 * Fail / File: frontend/app.js
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Mengurus sesi, chat, kuota, sejarah setempat dan tindakan pengguna.
 * EN: Manage sessions, chat, quotas, local history and user actions.
 */
import { API_BASE_URL } from "./config.js";
import { renderMarkdown, renderUserLinks } from "./markdown.js";
import { readConversations, saveConversations, makeConversation, conversationTitle, upsertConversation } from "./history.js";
import { prepareAttachment } from "./attachments.js";
import { saveLocalPreview, getLocalPreview, deleteLocalPreviews, clearLocalPreviews } from "./local-previews.js";

// BM: Dapatkan elemen UI yang sudah tersedia berdasarkan ID.
// EN: Resolve an existing UI element by ID.
const el = id => document.getElementById(id);
const state = {
  token: "", messages: [], conversations: readConversations(), activeId: null,
  pending: false, preparing: false, attachments: [],
  demo: false, configured: false, sitekey: "", widgetId: null, research: false,
  used: 0, limit: 100, shared: null
};
const ui = {
  form: el("chat-form"), input: el("message"), send: el("send"),
  conversation: el("conversation"), notice: el("notice"), welcome: el("welcome"),
  quota: el("quota-label"), progress: el("quota-progress"),
  inlineQuota: el("quota-inline-label"), inlineProgress: el("quota-progress-inline"),
  inlineShared: el("shared-inline"), mode: el("mode-pill"), latest: el("scroll-latest"),
  history: el("chat-history"), file: el("attachment-file"), filePreview: el("attachment-preview"),
  sidebar: document.querySelector(".sidebar"), backdrop: el("drawer-backdrop"),
  researchToggle: el("research-toggle")
};
// BM: Bina URL endpoint berasaskan konfigurasi Worker semasa.
// EN: Build endpoint URLs from the configured Worker origin.
const api = path => `${API_BASE_URL.replace(/\/$/, "")}${path}`;
// BM: Papar mesej ralat atau status melalui textContent yang selamat.
// EN: Show errors and status messages using safe textContent.
const setNotice = message => { ui.notice.textContent = message || ""; };

// BM: Hantar permintaan API berautorisasi, hadapi status gagal dan elak caching.
// EN: Make authenticated API calls, handle failure statuses and avoid caching.
async function request(path, options = {}) {
  const headers = { "content-type": "application/json", ...(state.token ? { authorization: `Bearer ${state.token}` } : {}) };
  const response = await fetch(api(path), { ...options, headers, cache: "no-store" });
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) { const error = new Error(data.error || `Request failed (${response.status})`); error.status = response.status; throw error; }
  return data;
}

// BM: Selaraskan kuota sidebar dan komposer dengan respons backend.
// EN: Synchronize sidebar and composer quota indicators from backend responses.
function updateQuota() {
  const label = state.limit ? `${state.used} of ${state.limit} messages used today` : "No personal daily message cap";
  const percentage = state.limit ? Math.min(100, 100 * state.used / state.limit) : 0;
  ui.quota.textContent = label;
  ui.inlineQuota.textContent = label;
  ui.progress.style.width = `${percentage}%`;
  ui.inlineProgress.style.width = `${percentage}%`;
  const bar = ui.inlineProgress.parentElement;
  bar.setAttribute("aria-valuenow", String(state.used));
  bar.setAttribute("aria-valuemax", String(state.limit || Math.max(state.used, 1)));
  const capacityText = state.shared && Number.isFinite(state.shared.remaining)
    ? `${state.shared.remaining} shared AI messages left today` : "Shared AI capacity is limited";
  ui.inlineShared.textContent = capacityText;
  el("shared-capacity").textContent = capacityText + " (subject to model quota).";
}

// Real-size composer docking avoids clipping on short screens and mobile keyboards.
const composerDock = document.querySelector(".composer-wrap");
const shell = document.querySelector(".chat-shell");
// BM: Ukur tinggi komposer sebenar supaya mesej tidak tersorok di belakang input.
// EN: Measure actual composer height so messages do not hide beneath the input.
function syncComposerHeight() {
  const height = Math.ceil(composerDock.getBoundingClientRect().height);
  if (height > 0) shell.style.setProperty("--composer-height", `${height}px`);
}
// BM: Guna VisualViewport untuk mengelakkan papan kekunci menutup input pada telefon.
// EN: Use VisualViewport so the mobile keyboard cannot obscure the composer.
function syncViewportHeight() {
  const viewport = window.visualViewport;
  const height = viewport ? viewport.height : window.innerHeight;
  if (height > 0) document.documentElement.style.setProperty("--app-height", `${height}px`);
  requestAnimationFrame(syncComposerHeight);
}
if (typeof ResizeObserver !== "undefined") new ResizeObserver(syncComposerHeight).observe(composerDock);
window.addEventListener("resize", syncViewportHeight);
window.visualViewport?.addEventListener("resize", syncViewportHeight);
window.visualViewport?.addEventListener("scroll", syncViewportHeight);
syncViewportHeight();

// BM: Periksa sama ada pengguna membaca bahagian mesej terkini.
// EN: Check whether the user is already reading the latest messages.
function isNearBottom() { return ui.conversation.scrollHeight - ui.conversation.scrollTop - ui.conversation.clientHeight < 110; }
// BM: Tatal ke balasan terakhir atas permintaan atau apabila mesej baru masuk.
// EN: Scroll to the latest reply on request or when a new message arrives.
function scrollToLatest(behavior = "auto") {
  ui.conversation.scrollTo({ top: ui.conversation.scrollHeight, behavior });
  ui.latest.hidden = true;
}
// BM: Tunjukkan butang ke mesej terkini hanya apabila diperlukan.
// EN: Display the latest-message shortcut only when needed.
function updateScrollButton() { ui.latest.hidden = !ui.welcome.hidden || isNearBottom(); }
// BM: Laraskan tinggi textarea berdasarkan kandungan tanpa menutup bahagian chat.
// EN: Resize the textarea for its content without obscuring the chat.
function resizeInput() {
  ui.input.style.height = "auto";
  ui.input.style.height = `${Math.min(ui.input.scrollHeight, 100, Math.max(40, Math.floor(window.innerHeight * 0.18)))}px`;
  requestAnimationFrame(syncComposerHeight);
}

// BM: Paparkan mesej sebagai nod DOM selamat serta lampiran/sumber yang berkaitan.
// EN: Render safe message DOM nodes with any associated attachments and sources.
function addMessage(role, content, { loading = false, attachment = null, attachments = null, sources = [], researchStatus = "off", researchAttempted = false, researchMode = "off", researchNotice = "",
  researchCheckedAt = "", incomplete = false } = {}) {
  const shouldScroll = isNearBottom() || role === "user";
  ui.welcome.hidden = true;
  const row = document.createElement("article");
  row.className = `message-row ${role}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.setAttribute("aria-hidden", "true");
  if (role === "assistant") {
    const logo = document.createElement("img");
    logo.src = "./zrain-logo.webp";
    logo.alt = "";
    logo.width = 25; logo.height = 25;
    logo.onerror = () => { logo.onerror = null; logo.src = "https://zrain.web.app/zrain-logo.webp"; };
    avatar.append(logo);
  } else avatar.textContent = "You";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const label = document.createElement("div");
  label.className = "message-role";
  label.textContent = role === "assistant" ? "Zrain AI" : "You";
  const body = document.createElement("div");
  body.className = "message-content";
  const attachmentList = Array.isArray(attachments) ? attachments : (attachment ? [attachment] : []);
  if (attachmentList.length) {
    const indicators = document.createElement("div");
    indicators.className = "message-attachments";
    for (const item of attachmentList) {
      const indicator = document.createElement("button");
      indicator.type = "button";
      indicator.className = "message-attachment";
      indicator.textContent = `${item.kind === "image" ? "Image" : "Document"}: ${item.name}`;
      indicator.title = `Preview ${item.name}`;
      indicator.setAttribute("aria-label", `Preview attached ${item.name}`);
      indicator.addEventListener("click", () => openAttachmentPreview(item));
      indicators.append(indicator);
    }
    body.append(indicators);
    if (content) { const msg = document.createElement("div"); renderUserLinks(msg, content); body.append(msg); }
  } else if (loading) {
    body.classList.add("typing");
    body.setAttribute("aria-label", "Zrain AI is thinking");
    const dots = document.createElement("span");
    dots.className = "thinking-dots";
    for (let i = 0; i < 3; i++) dots.append(document.createElement("i"));
    body.append(dots);
  } else if (role === "assistant") renderMarkdown(body, content);
  else renderUserLinks(body, content);
  bubble.append(label, body);
  // Research audit is visible even when the public source lookup failed.
  // Ordinary model-generated links are NOT treated as verified citations.
  if (role === "assistant" && !loading && (researchAttempted || (Array.isArray(sources) && sources.length))) {
    const box = document.createElement("section"); box.className = "research-sources";
    box.setAttribute("aria-label", "Research verification details");
    const heading = document.createElement("div"); heading.className = "research-sources-title";
    const fetched = Array.isArray(sources) ? sources.slice(0, 3) : [];
    const previewsOnly = fetched.length > 0 && fetched.every(source => source.evidenceType === "search-preview");
    heading.textContent = fetched.length
      ? researchAttempted
        ? `Research ${researchMode === "automatic" ? "(auto)" : "(on)"}: ${fetched.length} verified ${fetched.length === 1 ? "source" : "sources"}${previewsOnly ? " · search excerpts" : ""}`
        : `Saved sources: ${fetched.length} ${fetched.length === 1 ? "link" : "links"} from an earlier chat`
      : "Research: no verified sources";
    box.append(heading);
    const summary = document.createElement("p"); summary.className = "research-summary";
    summary.textContent = fetched.length
      ? researchAttempted
        ? "These links were returned by an approved source. The response uses their available excerpts, not unrestricted web browsing."
        : "These links were saved with an earlier chat. Re-run Research to verify current information."
      : (researchNotice || "No external source was verified. Any answer above is based on general model knowledge.");
    box.append(summary);
    if (researchCheckedAt) {
      const checked = document.createElement("small"); checked.className = "research-checked";
      const time = new Date(researchCheckedAt);
      if (!Number.isNaN(time.getTime())) checked.textContent = `Checked ${time.toLocaleString()}`;
      box.append(checked);
    }
    for (const source of fetched) {
      try {
        const url = new URL(source.url);
        if (url.protocol !== "https:" || url.username || url.password) continue;
        const item = document.createElement("div"); item.className = "research-source-item";
        const anchor = document.createElement("a");
        anchor.href = url.toString(); anchor.target = "_blank";
        anchor.rel = "noopener noreferrer nofollow";
        anchor.textContent = source.title || url.hostname;
        item.append(anchor);
        if (source.excerpt) {
          const excerpt = document.createElement("p"); excerpt.className = "research-source-excerpt";
          excerpt.textContent = source.excerpt;
          item.append(excerpt);
        }
        box.append(item);
      } catch { /* Invalid links cannot become research citations. */ }
    }
    bubble.append(box);
  }
  if (role === "assistant" && !loading) {
    const tools = document.createElement("div");
    tools.className = "message-tools";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy response";
    copy.setAttribute("aria-label", "Copy Zrain AI response");
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(content); copy.textContent = "Copied"; }
      catch { setNotice("Your browser could not copy the answer."); }
    });
    tools.append(copy);
    if (incomplete || content.length >= 650) {
      const continueButton = document.createElement("button");
      continueButton.type = "button";
      continueButton.textContent = "Continue answer";
      continueButton.title = "Ask Zrain AI to finish its previous answer";
      continueButton.addEventListener("click", () => {
        if (state.pending || state.preparing) return;
        if (state.attachments.length || ui.input.value.trim()) {
          setNotice("Please send or clear your current draft before continuing the previous answer."); return;
        }
        sendMessage("Continue the previous answer from exactly where it stopped. Complete the remaining explanation without repeating earlier sections.");
      });
      tools.append(continueButton);
      const label = document.createElement("p");
      label.className = "answer-continuation-note";
      label.textContent = "This answer reached the current free-model generation limit. You can continue it.";
      bubble.append(label);
    }
    bubble.append(tools);
  }
  row.append(avatar, bubble); ui.conversation.append(row);
  if (shouldScroll) requestAnimationFrame(() => scrollToLatest());
  else updateScrollButton();
  return row;
}
// BM: Kunci tindakan penghantaran ketika permintaan aktif untuk elak submit berganda.
// EN: Disable submission while a request is pending to prevent duplicate sends.
function setPending(pending) {
  state.pending = pending;
  ui.input.disabled = pending;
  ui.send.disabled = pending || state.preparing || !state.configured;
  ui.file.disabled = pending || state.preparing;
  ui.send.setAttribute("aria-busy", String(pending));
  document.querySelectorAll("[data-suggest]").forEach(button => { button.disabled = pending || !state.configured; });
}
// BM: Tutup sidebar sejarah mobile dan pulihkan keadaan overlay.
// EN: Close mobile history and reset its backdrop.
function closeDrawer() {
  ui.sidebar.classList.remove("drawer-open");
  ui.backdrop.hidden = true;
}
// BM: Paparkan sejarah perbualan mobile tanpa mengubah data chat.
// EN: Open mobile chat history without modifying conversation data.
function openDrawer() {
  ui.sidebar.classList.add("drawer-open");
  ui.backdrop.hidden = false;
}

// BM: Bina senarai perbualan daripada sejarah tempatan yang telah disanitasi.
// EN: Render the sanitized local conversation list.
function renderChatList() {
  ui.history.replaceChildren();
  if (!state.conversations.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Your conversations will be saved here, on this device.";
    ui.history.append(empty); return;
  }
  for (const conversation of state.conversations) {
    const item = document.createElement("div");
    item.className = "history-entry" + (state.activeId === conversation.id ? " active" : "");
    const open = document.createElement("button");
    open.type = "button"; open.className = "history-open";
    open.title = conversation.title;
    const title = document.createElement("span"); title.textContent = conversation.title;
    const date = document.createElement("small");
    date.textContent = new Date(conversation.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    open.append(title, date);
    open.addEventListener("click", () => switchChat(conversation.id));
    const menu = document.createElement("button");
    menu.type = "button"; menu.className = "history-menu";
    menu.setAttribute("aria-label", `Rename or delete ${conversation.title}`);
    menu.title = "Rename or delete";
    menu.textContent = "⋯";
    menu.addEventListener("click", () => manageChat(conversation.id));
    item.append(open, menu); ui.history.append(item);
  }
}
// BM: Simpan kandungan aktif ke browser apabila mesej berubah.
// EN: Persist the active conversation locally after message changes.
function persistChat() {
  if (!state.messages.length) return;
  const existing = state.conversations.find(c => c.id === state.activeId);
  const conversation = existing || makeConversation();
  if (!state.activeId) state.activeId = conversation.id;
  const first = state.messages.find(message => message.role === "user");
  conversation.title = existing?.title && existing.title !== "New conversation" ? existing.title : conversationTitle(first?.content || first?.attachments?.[0]?.name || first?.attachment?.name);
  conversation.updatedAt = Date.now();
  conversation.messages = state.messages;
  state.conversations = upsertConversation(state.conversations, conversation);
  if (!saveConversations(state.conversations)) setNotice("Your browser storage is full. This conversation could not be saved locally.");
  renderChatList();
}
// BM: Tukar perbualan dan muatkan mesej setempat yang dipilih.
// EN: Switch conversations and restore the selected local messages.
function switchChat(id) {
  if (state.pending) return;
  const chat = state.conversations.find(c => c.id === id);
  if (!chat) return;
  if (ui.input.value.trim() && !window.confirm("Leave your unsent draft and open another chat?")) return;
  state.activeId = id;
  state.messages = chat.messages.map(item => ({ ...item }));
  ui.conversation.replaceChildren(ui.welcome);
  ui.welcome.hidden = state.messages.length > 0;
  for (const message of state.messages) addMessage(message.role, message.content, { attachments: message.attachments, attachment: message.attachment, sources: message.sources, researchStatus: message.researchStatus,
    researchAttempted: message.researchAttempted, researchMode: message.researchMode,
    researchNotice: message.researchNotice, researchCheckedAt: message.researchCheckedAt, incomplete: message.incomplete });
  ui.input.value = ""; clearAttachment(); setNotice(""); resizeInput();
  renderChatList(); closeDrawer(); requestAnimationFrame(() => scrollToLatest());
}
// BM: Urus tindakan senarai sejarah dengan pengesahan yang sesuai.
// EN: Handle conversation-management actions with appropriate confirmation.
function manageChat(id) {
  if (state.pending) return;
  const chat = state.conversations.find(item => item.id === id);
  if (!chat) return;
  const option = window.prompt(`Chat: ${chat.title}\nType R to rename or D to delete.`, "R");
  if (!option) return;
  if (option.trim().toLowerCase() === "r") {
    const name = window.prompt("Rename conversation", chat.title);
    if (name?.trim()) { chat.title = name.trim().slice(0, 72); chat.updatedAt = Date.now(); }
    else return;
  } else if (option.trim().toLowerCase() === "d") {
    if (!window.confirm(`Delete conversation "${chat.title}" from this browser?`)) return;
    const ids = chat.messages.flatMap(message => (message.attachments || []).map(file => file.id).filter(Boolean));
    deleteLocalPreviews(ids).catch(() => {});
    state.conversations = state.conversations.filter(item => item.id !== id);
    if (state.activeId === id) { state.activeId = null; resetChatUI(); }
  } else return;
  saveConversations(state.conversations); renderChatList();
}
// BM: Kosongkan UI chat aktif untuk sesi perbualan baharu.
// EN: Reset the current chat UI for a new conversation.
function resetChatUI() {
  state.messages = [];
  ui.conversation.replaceChildren(ui.welcome);
  ui.welcome.hidden = false;
  ui.conversation.scrollTop = 0;
  ui.latest.hidden = true;
  ui.input.value = "";
  clearAttachment(); setNotice(""); resizeInput();
}
// BM: Cipta perbualan baharu sambil melindungi draf yang belum dihantar.
// EN: Start a new conversation while protecting unsent drafts.
function newChat() {
  if (state.pending) return;
  if (ui.input.value.trim() && !window.confirm("Discard the unsent draft and start a new conversation?")) return;
  state.activeId = null;
  resetChatUI(); renderChatList(); closeDrawer(); ui.input.focus();
}

// BM: Buang lampiran yang tidak lagi dipilih daripada komposer.
// EN: Remove an unselected attachment from the composer.
function clearAttachment() {
  state.attachments = [];
  ui.file.value = "";
  ui.filePreview.replaceChildren(); ui.filePreview.hidden = true;
  requestAnimationFrame(syncComposerHeight);
}
// BM: Keluarkan lampiran yang dipilih tanpa mengubah fail asal pengguna.
// EN: Remove a selected attachment without changing the original user file.
function removeAttachment(index) {
  state.attachments.splice(index, 1);
  showAttachment();
}
// BM: Buka pratonton fail daripada storan browser apabila tersedia.
// EN: Open an attachment preview from browser storage when available.
async function openAttachmentPreview(attachment) {
  // Saved chats contain metadata only. Actual preview is stored in IndexedDB on this device.
  const dialog = document.createElement("dialog");
  dialog.className = "attachment-dialog";
  dialog.setAttribute("aria-label", `Preview ${attachment.name}`);
  const header = document.createElement("div"); header.className = "attachment-dialog-header";
  const title = document.createElement("strong"); title.textContent = attachment.name;
  const close = document.createElement("button"); close.type = "button"; close.textContent = "Close";
  close.addEventListener("click", () => dialog.close());
  header.append(title, close);
  const note = document.createElement("p"); note.className = "attachment-dialog-note";
  note.textContent = "Local preview. The AI receives only a limited text excerpt, not the entire document.";
  const area = document.createElement("div"); area.className = "attachment-dialog-content";
  const waiting = document.createElement("p"); waiting.textContent = "Opening local preview...";
  area.append(waiting);
  dialog.append(header, note, area);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  document.body.append(dialog);
  dialog.showModal();
  const data = (attachment.fullPreview || attachment.preview || attachment.data) ? attachment :
    (attachment.id ? await getLocalPreview(attachment.id) : null);
  if (!dialog.isConnected) return;
  area.replaceChildren();
  if (!data) {
    const unavailable = document.createElement("p");
    unavailable.textContent = "Preview unavailable for this older attachment or after local browser data was cleared. Please attach the original file again.";
    area.append(unavailable); return;
  }
  const isImage = attachment.kind === "image";
  const content = document.createElement(isImage ? "img" : "pre");
  if (isImage) {
    content.src = data.preview || data.image || data.data;
    content.alt = attachment.name;
  } else {
    content.textContent = data.fullPreview || data.text || "No readable text found.";
  }
  area.append(content);
}
// BM: Paparkan fail terpilih dan tahap kandungan yang boleh dilihat model.
// EN: Show a chosen attachment and the amount of its content sent to the model.
function showAttachment() {
  ui.filePreview.replaceChildren();
  const attachments = state.attachments;
  if (!attachments.length) { ui.filePreview.hidden = true; return; }
  for (const [index, attachment] of attachments.entries()) {
    const card = document.createElement("div"); card.className = "attachment-card";
    if (attachment.kind === "image" && attachment.preview) {
      const image = document.createElement("img"); image.src = attachment.preview; image.alt = attachment.name; image.loading = "lazy";
      card.append(image);
    } else {
      const placeholder = document.createElement("div");
      placeholder.textContent = attachment.name.slice(0, 1).toUpperCase();
      placeholder.style.cssText = "width:54px;height:54px;border-radius:10px;border:1px solid #efddd2;background:#fff7f1;display:grid;place-items:center;color:#a44b33;font-weight:800;flex:none";
      card.append(placeholder);
    }
    const meta = document.createElement("div"); meta.className = "attachment-meta";
    const name = document.createElement("span"); name.className = "attachment-name"; name.textContent = attachment.name;
    const description = document.createElement("span"); description.className = "attachment-kind";
    description.textContent = attachment.kind === "image" ? "Image ready for analysis" : "Text document excerpt";
    meta.append(name, description);
    if (attachment.kind === "document" && attachment.previewText) {
      const excerpt = document.createElement("span"); excerpt.className = "attachment-excerpt"; excerpt.textContent = attachment.previewText; meta.append(excerpt);
    }
    const preview = document.createElement("button");
    preview.type = "button"; preview.className = "attachment-open";
    preview.textContent = "Preview"; preview.title = `Preview ${attachment.name}`;
    preview.addEventListener("click", () => openAttachmentPreview(attachment));
    meta.append(preview);
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "attachment-remove"; remove.textContent = "×";
    remove.title = `Remove ${attachment.name}`; remove.setAttribute("aria-label", `Remove ${attachment.name}`);
    remove.addEventListener("click", () => removeAttachment(index));
    card.append(meta, remove);
    ui.filePreview.append(card);
  }
  ui.filePreview.hidden = false; requestAnimationFrame(syncComposerHeight);
}
// BM: Proses fail baharu dan laporkan kegagalan saiz atau jenis dengan jelas.
// EN: Process new files and report type or size failures clearly.
async function loadAttachment(files) {
  const list = Array.from(files || []).filter(Boolean);
  if (!list.length || state.pending || state.preparing) return;
  const maxAttachments = 4;
  const spaceLeft = Math.max(0, maxAttachments - state.attachments.length);
  if (!spaceLeft) { setNotice("You can attach up to 4 files at once."); return; }
  state.preparing = true; setNotice("Reading attachments on your device..."); setPending(false);
  const next = [...state.attachments];
  try {
    for (const file of list.slice(0, spaceLeft)) next.push(await prepareAttachment(file));
    state.attachments = next;
    showAttachment();
    setNotice(list.length > spaceLeft ? "Only the first 4 attachments were kept." : "");
  } catch (error) { setNotice(error.message || "Could not read attachment."); }
  finally { state.preparing = false; ui.file.value = ""; setPending(false); }
}

// BM: Baca token verifikasi sah tanpa membenarkan permintaan tanpa pemeriksaan.
// EN: Read a valid verification token without bypassing the bot check.
async function turnstileToken() {
  if (state.demo) return "demo-only";
  if (!window.turnstile || state.widgetId === null) return "";
  return window.turnstile.getResponse(state.widgetId) || "";
}
// BM: Set semula widget selepas penghantaran agar token tidak digunakan semula.
// EN: Reset the verification widget after submission so tokens are not reused.
function resetTurnstile() {
  if (!state.demo && window.turnstile && state.widgetId !== null) window.turnstile.reset(state.widgetId);
}
// BM: Sahkan input, sediakan konteks, hantar ke Worker dan simpan balasan lokal.
// EN: Validate input, prepare context, send to Worker and save replies locally.
async function sendMessage(message) {
  if (state.pending || state.preparing || !state.configured) return;
  if (typeof message !== "string") return;
  message = message.trim().slice(0, 2000);
  const attachments = state.attachments.slice();
  if (!message && !attachments.length) return;
  const turnstile = await turnstileToken();
  if (!turnstile) { setNotice("Complete the verification check before sending your message."); return; }
  setPending(true); setNotice("");
  const docs = attachments.filter(item => item.kind === "document");
  const images = attachments.filter(item => item.kind === "image");
  if (images.length > 3 || attachments.length > 4) {
    setNotice("You can send up to four attachments, including at most three images.");
    setPending(false);
    return;
  }
  // Fit multiple documents into one Worker request without deleting complete local previews.
  const perDocLimit = docs.length ? Math.min(12_000, Math.floor(16_000 / docs.length)) : 0;
  const promptDocs = docs.map(item => ({ ...item, text: item.text.slice(0, perDocLimit) }));
  const sizeOfDocs = promptDocs.reduce((count, item) => count + item.text.length, 0);
  const history = state.messages.slice(-8).map(({ role, content, contextText }) => ({ role, content: (contextText || content).slice(-7_500) }));
  // BM: Kira konteks perbualan yang boleh dihantar tanpa melebihi had Worker.
  // EN: Measure sendable conversation context within Worker limits.
  const historySize = () => history.reduce((count, item) => count + item.content.length, 0);
  while (history.length && historySize() + message.length + sizeOfDocs > 20_000) history.shift();
  const content = message || (images.length && !docs.length
    ? images.length === 1 ? "Please describe this image." : "Please compare and describe these images."
    : "Please explain these attachments.");
  const payload = { message: content, history, turnstileToken: turnstile, research: state.research };
  if (images.length === 1) payload.image = images[0].data;
  else if (images.length) payload.images = images.map(item => item.data);
  if (promptDocs.length === 1) payload.document = { name: promptDocs[0].name, text: promptDocs[0].text };
  else if (promptDocs.length) payload.documents = promptDocs.map(item => ({ name: item.name, text: item.text }));
  const docContext = promptDocs.map(item => `[Attached document: ${item.name}]\n${item.text}\n[End document]`).join("\n\n");
  const contextText = docContext ? `${content}\n\n${docContext}` : content;
  const visibleAttachments = attachments.map(item => ({ id: item.id, name: item.name, kind: item.kind }));
  const userMessage = {
    role: "user", content, contextText,
    ...(visibleAttachments.length ? { attachments: visibleAttachments } : {})
  };
  state.messages.push(userMessage);
  const userRow = addMessage("user", content, { attachments: visibleAttachments });
  ui.input.value = ""; resizeInput();
  const loading = addMessage("assistant", "", { loading: true });
  try {
    const result = await request("/api/chat", { method: "POST", body: JSON.stringify(payload) });
    loading.remove();
    const researchInfo = result.researchAttempted ? {
      researchAttempted: true, researchStatus: result.researchStatus,
      researchMode: result.researchMode, researchNotice: result.researchNotice,
      researchCheckedAt: result.researchCheckedAt
    } : {};
    state.messages.push({ role: "assistant", content: result.answer,
      ...(result.incomplete ? { incomplete: true } : {}),
      ...(result.sources?.length ? { sources: result.sources } : {}), ...researchInfo });
    addMessage("assistant", result.answer, { sources: result.sources,
      ...researchInfo, incomplete: result.incomplete });
    const previewResults = await Promise.allSettled(attachments.map(item => saveLocalPreview(item)));
    const previewNotSaved = previewResults.some(entry => entry.status === "rejected" || entry.value !== true);
    if (previewNotSaved) {
      setNotice("Some attachment previews could not be saved on this device. Keep the original files to reattach after refreshing.");
    } else if (result.researchAttempted && !result.sources?.length) {
      setNotice("Research could not verify a public source. See the status beneath the answer.");
    }
    clearAttachment(); persistChat();
    if (result.quota) { state.used = result.quota.used; state.limit = result.quota.dailyLimit; }
    if (result.sharedCapacity) state.shared = result.sharedCapacity;
    updateQuota();
  } catch (error) {
    loading.remove(); userRow.remove(); state.messages.pop();
    ui.input.value = message; resizeInput();
    setNotice(error.message || "Something went wrong. Try again.");
    if (state.messages.length === 0) { ui.welcome.hidden = false; }
  } finally {
    resetTurnstile(); setPending(false); ui.input.focus(); updateScrollButton();
  }
}
// BM: Pasang widget Turnstile dengan action yang disahkan backend.
// EN: Render Turnstile with the action expected by server verification.
function renderTurnstile() {
  if (state.demo || !state.sitekey || !window.turnstile || state.widgetId !== null) return;
  state.widgetId = window.turnstile.render("#turnstile-container", { sitekey: state.sitekey, action: "chat", theme: "light", size: "flexible" });
}
// BM: Muat skrip verifikasi sekali dan laporkan kegagalan muat secara selamat.
// EN: Load the verification script once and report load failure safely.
function loadTurnstile() {
  if (state.demo || !state.sitekey) return;
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true; script.onload = renderTurnstile;
  script.onerror = () => setNotice("Human verification is unavailable. Please try again later.");
  document.head.append(script);
}
// BM: Periksa konfigurasi dan sesi permulaan tanpa memadam sejarah browser.
// EN: Initialize configuration and session without deleting local history.
async function init() {
  renderChatList();
  if (state.conversations.length) switchChat(state.conversations[0].id);
  setPending(true);
  try {
    const config = await request("/api/config");
    state.demo = config.demoMode === true;
    state.configured = config.configured === true;
    state.sitekey = config.turnstileSiteKey;
    state.limit = config.dailyLimit;
    ui.mode.textContent = state.demo ? "UI DEMO" : state.configured ? "AI READY" : "SETUP NEEDED";
    ui.mode.className = "mode-pill" + (state.demo ? " demo" : state.configured ? "" : " offline");
    if (!state.configured) { setNotice("Connect and configure your Cloudflare Worker before chatting."); return; }
    state.token = localStorage.getItem("zrain_ai_session") || "";
    if (state.token && !state.demo) {
      try {
        const usage = await request("/api/usage");
        state.used = usage.quota.used;
        state.limit = usage.quota.dailyLimit;
        state.shared = usage.sharedCapacity || null;
      } catch (error) {
        if (error.status !== 401) throw error;
        state.token = ""; localStorage.removeItem("zrain_ai_session");
      }
    }
    if (!state.token) {
      const session = await request("/api/session", { method: "POST", body: "{}" });
      state.token = session.token;
      localStorage.setItem("zrain_ai_session", state.token);
    }
    if (!state.demo && !state.shared) {
      const usage = await request("/api/usage");
      state.used = usage.quota.used;
      state.limit = usage.quota.dailyLimit;
      state.shared = usage.sharedCapacity || null;
    }
    loadTurnstile(); updateQuota();
    if (state.demo) setNotice("Local UI demo. Answers are examples, not generated by a real AI model.");
  } catch (error) {
    ui.mode.textContent = "OFFLINE"; ui.mode.className = "mode-pill offline";
    setNotice(error.message || "Cannot connect to the AI backend.");
  } finally { setPending(false); }
}

ui.form.addEventListener("submit", event => { event.preventDefault(); sendMessage(ui.input.value); });
ui.input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); ui.form.requestSubmit(); }
});
ui.input.addEventListener("input", resizeInput);
ui.researchToggle.addEventListener("click", () => {
  state.research = !state.research;
  ui.researchToggle.setAttribute("aria-pressed", String(state.research));
  ui.researchToggle.classList.toggle("is-active", state.research);
  ui.researchToggle.setAttribute("aria-label", state.research ? "Turn off web research" : "Turn on web research");
  ui.researchToggle.title = state.research ? "Research ON: check Wikipedia and approved websites, show verified sources" : "Research OFF: answer from model knowledge; click to verify public sources";
});
ui.conversation.addEventListener("scroll", updateScrollButton, { passive: true });
ui.latest.addEventListener("click", () => scrollToLatest("smooth"));
el("new-chat").addEventListener("click", newChat);
el("mobile-new-chat").addEventListener("click", newChat);
el("mobile-history").addEventListener("click", openDrawer);
ui.backdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", event => { if (event.key === "Escape") closeDrawer(); });
el("attach-trigger").addEventListener("click", () => { if (!ui.file.disabled) ui.file.click(); });
ui.file.addEventListener("change", event => loadAttachment(event.target.files));
// Zrain upload convention: Choose file, drag/drop and image paste from clipboard.
document.addEventListener("dragover", event => { if (event.dataTransfer?.types.includes("Files")) { event.preventDefault(); document.body.classList.add("drop-active"); } });
document.addEventListener("dragleave", event => { if (!event.relatedTarget) document.body.classList.remove("drop-active"); });
document.addEventListener("drop", event => {
  if (event.dataTransfer?.files?.length) {
    event.preventDefault(); document.body.classList.remove("drop-active");
    loadAttachment(event.dataTransfer.files);
  }
});
document.addEventListener("paste", event => {
  const files = Array.from(event.clipboardData?.files || []).filter(f => f.type.startsWith("image/"));
  if (files.length) {
    event.preventDefault();
    const renamed = files.map((file, index) => new File([file], `pasted-image-${index + 1}.${file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1]}`, { type: file.type }));
    loadAttachment(renamed);
  }
});
el("export-chats").addEventListener("click", () => {
  if (!state.conversations.length) { setNotice("No saved conversations to export."); return; }
  const blob = new Blob([JSON.stringify({ app: "Zrain AI", exportedAt: new Date().toISOString(), chats: state.conversations }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "zrain-ai-chat-history.json"; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
el("clear-chats").addEventListener("click", () => {
  if (!state.conversations.length || state.pending) return;
  if (!window.confirm("Delete all saved conversations from this browser? This cannot be undone.")) return;
  state.conversations = []; state.activeId = null; saveConversations([]); clearLocalPreviews().catch(() => {}); resetChatUI(); renderChatList(); closeDrawer();
});
document.querySelectorAll("[data-suggest]").forEach(button => button.addEventListener("click", () => {
  ui.input.value = button.dataset.suggest; resizeInput(); ui.input.focus();
}));
resizeInput(); updateQuota(); syncViewportHeight(); init();
