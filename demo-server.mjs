/**
 * Fail / File: demo-server.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Memberikan pratonton UI lokal dengan respons simulasi yang bukan inferens sebenar.
 * EN: Provide a local UI preview with mock responses, not real inference.
 */
// LOCAL UI DEMO ONLY. This server deliberately does not claim to run an AI model.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { isInsideDirectory } from "./demo-paths.mjs";
const root = resolve(fileURLToPath(new URL("./frontend/", import.meta.url)));
const port = Number(process.env.PORT || 8766);
const count = new Map();
// BM: Hantar JSON pada laluan demo tanpa menyamar sebagai output AI production.
// EN: Return JSON on demo routes without presenting mock responses as live inference.
const json = (res, code, data) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(data)); };
const replies = [
  "This is a local interface demonstration. In production, Zrain AI will connect to Cloudflare Workers AI and generate a real response to your question.",
  "Demo response: I can follow a conversation and respond in multiple languages once the live AI backend is configured. This preview does not run a language model.",
  "Respons demonstrasi: Antaramuka Zrain AI telah disediakan. Sambungkan model Cloudflare Workers AI untuk menerima jawapan AI sebenar."
];
createServer(async (req, res) => {
  const path = new URL(req.url, `http://localhost:${port}`).pathname;
  if (path === "/api/config") return json(res, 200, { configured: true, demoMode: true, dailyLimit: 100, turnstileSiteKey: "" });
  if (path === "/api/session" && req.method === "POST") return json(res, 200, { token: `local-demo-${randomUUID()}` });
  if (path === "/api/chat" && req.method === "POST") {
    const token = req.headers.authorization?.slice(7) || "";
    if (!token.startsWith("local-demo-")) return json(res, 401, { error: "Invalid demo session" });
    let raw = "";
    for await (const part of req) { raw += part; if (raw.length > 15000) return json(res, 400, { error: "Message too large" }); }
    let body; try { body = JSON.parse(raw); } catch { return json(res, 400, { error: "Invalid JSON" }); }
    if (typeof body.message !== "string" || body.message.length > 2000 || !body.message.trim()) return json(res, 400, { error: "Invalid message" });
    const used = count.get(token) || 0;
    if (used >= 100) return json(res, 429, { error: "Demo message limit reached" });
    count.set(token, used + 1);
    return json(res, 200, { answer: replies[used % replies.length], model: "LOCAL_DEMO_ONLY", quota: { used: used + 1, dailyLimit: 100 } });
  }
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const safePath = path === "/" ? "/index.html" : path;
  const filepath = resolve(join(root, safePath.replace(/^\//, "")));
  if (!isInsideDirectory(root, filepath)) return json(res, 403, { error: "Forbidden" });
  try {
    const bytes = await readFile(filepath);
    const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".webp": "image/webp" };
    res.writeHead(200, { "content-type": `${mime[extname(filepath)] || "application/octet-stream"}; charset=utf-8`, "x-content-type-options": "nosniff" });
    res.end(bytes);
  } catch { json(res, 404, { error: "File not found" }); }
}).listen(port, "127.0.0.1", () => console.log(`Zrain AI UI demo running at http://127.0.0.1:${port}`));
