/**
 * Fail / File: tests/demo-server.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menguji regresi fungsi dan kontrak produk bagi modul berkaitan.
 * EN: Test feature regressions and product contracts for the relevant module.
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { isInsideDirectory } from "../demo-paths.mjs";

const script = fileURLToPath(new URL("../demo-server.mjs", import.meta.url));

test("demo static path is allowed on Windows and rejects sibling traversal", () => {
  const root = String.raw`C:\Users\someone\Downloads\zrain-ai\frontend`;
  assert.equal(isInsideDirectory(root, path.win32.join(root, "index.html"), path.win32), true);
  assert.equal(isInsideDirectory(root, path.win32.join(root, "style.css"), path.win32), true);
  assert.equal(isInsideDirectory(root, String.raw`C:\Users\someone\Downloads\zrain-ai\frontend-old\index.html`, path.win32), false);
  assert.equal(isInsideDirectory(root, String.raw`D:\secret\index.html`, path.win32), false);
});

test("demo static path works on POSIX and rejects sibling traversal", () => {
  const root = "/tmp/zrain-ai/frontend";
  assert.equal(isInsideDirectory(root, path.posix.join(root, "index.html"), path.posix), true);
  assert.equal(isInsideDirectory(root, "/tmp/zrain-ai/frontend-other/index.html", path.posix), false);
  assert.equal(isInsideDirectory(root, "/etc/passwd", path.posix), false);
});

async function unusedPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

test("demo server returns HTML even when URL includes a tracking query", { timeout: 10000 }, async () => {
  const port = await unusedPort();
  const child = spawn(process.execPath, [script], { env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error("Demo exited unexpectedly");
      try {
        const response = await fetch(`http://127.0.0.1:${port}/?utm_source=chatgpt.com`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type"), /text\/html/);
        assert.match(await response.text(), /Zrain AI/);
        const css = await fetch(`http://127.0.0.1:${port}/style.css`);
        assert.equal(css.status, 200);
        const cfg = await fetch(`http://127.0.0.1:${port}/api/config`);
        assert.deepEqual((await cfg.json()).demoMode, true);
        ready = true;
        break;
      } catch (error) {
        if (error.name === "AssertionError") throw error;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    assert.equal(ready, true, "Demo must serve the frontend");
  } finally {
    child.kill();
  }
});
