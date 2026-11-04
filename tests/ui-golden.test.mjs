/**
 * Fail / File: tests/ui-golden.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: 2026-11-04
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Uji kontrak shared header/footer pada semua halaman tanpa memerlukan browser rangkaian.
 * EN: Test shared header/footer contracts on all pages without network browser access.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const root = new URL("../frontend/", import.meta.url);
const read = name => readFileSync(new URL(name, root), "utf8");

// BM: Jangan hilangkan identiti atau pautan dasar ketika menyamakan reka bentuk.
// EN: Do not lose branding or legal links when aligning shared design.
test("chat and legal pages use identical Golden Reference mount points", () => {
  for (const name of ["index.html", "privacy.html", "terms.html"]) {
    const html = read(name);
    for (const fragment of ['class="site-header zrain-header"', 'class="brand zrain-brand"', 'class="site-footer zrain-footer"', 'class="footer-brand zrain-footer__identity"', 'class="footer-links zrain-footer__links"']) {
      assert.ok(html.includes(fragment), `${name}: ${fragment}`);
    }
    assert.match(html, /zrain-ui\/brand\.css\?v=20261104/);
    assert.match(html, /zrain-ui\/brand-init\.js\?v=20261104/);
    assert.match(html, /brand-integration\.css\?v=20261104/);
  }
});

// BM: Butang perbualan dan disclaimer tidak dikawal library visual.
// EN: Chat actions and notices are left under application control.
test("Golden Reference integration preserves chat actions and required local links", () => {
  const html = read("index.html");
  for (const fragment of ['id="mobile-history"', 'id="mobile-new-chat"', 'id="new-chat"', 'id="chat-form"', 'id="research-toggle"', 'id="attach-trigger"', './privacy.html', './terms.html', 'mailto:zrain.dev@gmail.com']) {
    assert.ok(html.includes(fragment), `missing ${fragment}`);
  }
  const init = read("zrain-ui/brand-init.js");
  assert.doesNotMatch(init, /navigation\s*:/);
  assert.doesNotMatch(init, /footerLinks\s*:/);
});

// BM: Satu footer rasmi tidak boleh menceroboh ruang composer pada mobile.
// EN: The shared footer must not intrude into mobile composer space.
test("chat footer remains compact and mobile header keeps conversation controls", () => {
  const adapter = read("brand-integration.css");
  const shell = read("footer-layout.css");
  assert.match(adapter, /margin-top:0/);
  assert.match(adapter, /flex-wrap:nowrap/);
  assert.match(adapter, /grid-template-rows:26px 26px/);
  assert.match(shell, /minmax\(0, 1fr\)/);
  assert.match(shell, /body:not\(\.policy-body\)/);
});
