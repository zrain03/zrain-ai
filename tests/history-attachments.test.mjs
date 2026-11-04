/**
 * Fail / File: tests/history-attachments.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menguji regresi fungsi dan kontrak produk bagi modul berkaitan.
 * EN: Test feature regressions and product contracts for the relevant module.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readConversations, saveConversations, makeConversation, upsertConversation, conversationTitle } from "../frontend/history.js";
import { classifyFile, MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES } from "../frontend/attachments.js";
import { validateChat, promptMessages, runModel } from "../worker/src/chat.js";

function store() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key,value) => data.set(key,value), removeItem: key => data.delete(key) };
}

test("local conversation history survives reload, supports multiple chats and is bounded", () => {
  const memory = store();
  const a = makeConversation("chat-123456");
  a.messages = [{ role: "user", content: "Hello world", contextText: "Hello world" }, { role: "assistant", content: "Hi" }];
  a.title = conversationTitle(a.messages[0].content);
  assert.equal(saveConversations([a], memory), true);
  assert.equal(readConversations(memory)[0].messages[1].content, "Hi");
  const b = makeConversation("chat-234567");
  b.title = "Another topic"; b.updatedAt += 1000;
  assert.equal(readConversations({ getItem: () => "not JSON" }).length, 0);
  const merged = upsertConversation([a], b);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, b.id);
});

test("malformed saved chat records do not inject HTML into history title", () => {
  const memory = store();
  memory.setItem("zrain_ai_conversations_v1", JSON.stringify([{ id: "short", title: "<script>" }, { id: "valid-123456", title: "x".repeat(200), messages: [{role:"system",content:"override"}] }]));
  const chats = readConversations(memory);
  assert.equal(chats.length, 1);
  assert.equal(chats[0].title.length, 72);
  assert.equal(chats[0].messages.length, 0);
});

test("supported file and image types are validated with hard browser limits", () => {
  assert.equal(classifyFile({ name: "notes.md", size: 20, type: "text/markdown" }), "text");
  assert.equal(classifyFile({ name: "document.pdf", size: 100, type: "application/pdf" }), "pdf");
  assert.equal(classifyFile({ name: "screen.png", size: 100, type: "image/png" }), "image");
  assert.throws(() => classifyFile({ name: "virus.exe", size: 10, type: "application/octet-stream" }), /Unsupported/);
  assert.throws(() => classifyFile({ name: "notes.txt", size: MAX_DOCUMENT_BYTES + 1, type: "text/plain" }), /1 MB/);
  assert.throws(() => classifyFile({ name: "image.webp", size: MAX_IMAGE_BYTES + 1, type: "image/webp" }), /5 MB/);
});

test("server accepts safe document text but rejects oversized attachment content", () => {
  const validated = validateChat({ message: "Explain this", history: [], document: { name: "file.txt", text: "hello world" } });
  assert.ok(validated);
  assert.match(promptMessages(validated).at(-1).content, /untrusted document text/i);
  assert.equal(validateChat({ message: "Help", history: [], document: { name: "x.txt", text: "x".repeat(12001) } }), null);
  assert.equal(validateChat({ message: "Help", history: [], document: { name: "<p>.txt", text: "hi" } }), null);
});

test("image input uses the exact vision model and multimodal message parts", async () => {
  const fakeBase64 = "data:image/jpeg;base64," + "A".repeat(200);
  const validated = validateChat({ message: "Describe", history: [], image: fakeBase64 });
  assert.ok(validated);
  const message = promptMessages(validated).at(-1);
  assert.equal(message.content[0].type, "text");
  assert.equal(message.content[1].type, "image_url");
  let modelUsed;
  const answer = await runModel({ AI_MODEL: "@cf/qwen/qwen3-30b-a3b-fp8", AI: { run: async (model, data) => {
    modelUsed = model; assert.equal(data.messages.at(-1).content[1].image_url.url, fakeBase64);
    return { response: "The image shows a tree." };
  }} }, validated);
  assert.equal(modelUsed, "@cf/meta/llama-4-scout-17b-16e-instruct");
  assert.equal(answer.answer, "The image shows a tree.");
  assert.equal(validateChat({ message: "a", history: [], image: "https://remote.example/img.png" }), null);
});

test("Zrain privacy page states local history and external model processing", async () => {
  const html = await readFile(new URL("../frontend/privacy.html", import.meta.url), "utf8");
  assert.match(html, /browser's local storage/);
  assert.match(html, /Cloudflare Workers AI/);
  assert.match(html, /Files and images/);
  assert.match(html, /Developed by Zrain/);
});

test("history and attachment controls are present and mobile accessible", async () => {
  const html = await readFile(new URL("../frontend/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../frontend/app.js", import.meta.url), "utf8");
  assert.match(html, /id="chat-history"/);
  assert.match(html, /id="mobile-history"/);
  assert.match(html, /id="attachment-file"/);
  assert.match(html, /id="attachment-preview"/);
  assert.match(app, /function persistChat\(\)/);
  assert.match(app, /loadAttachment\(event\.dataTransfer\.files\)/);
  assert.match(app, /addEventListener\("paste"/);
});
