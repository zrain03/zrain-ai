/**
 * Fail / File: frontend/code-preview.js
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Membina pratonton kod terasing dalam iframe dengan polisi keselamatan ketat.
 * EN: Build isolated code previews inside a tightly restricted iframe.
 */
// Zrain AI sandboxed front-end preview. No server, no network access and no parent DOM access.
const CODE_LANGUAGE = new Set(["html", "htm", "css", "js", "javascript"]);
// BM: Benarkan pratonton hanya bagi bahasa web yang disokong.
// EN: Allow live previews only for supported web languages.
export function isPreviewLanguage(lang) { return CODE_LANGUAGE.has(String(lang).toLowerCase()); }
// BM: Bersihkan label/input sebelum dijadikan kandungan pratonton.
// EN: Normalize labels and inputs before constructing preview content.
const clean = value => String(value ?? "");
// BM: Halang skrip menutup tag yang digunakan untuk membina dokumen iframe.
// EN: Prevent content from prematurely closing the generated iframe script tag.
function escapeClosingScript(value) { return value.replace(/<\/script/gi, "<\\/script"); }
// BM: Halang CSS menutup tag style apabila membina dokumen pratonton.
// EN: Prevent CSS from prematurely closing the generated preview style tag.
function escapeClosingStyle(value) { return value.replace(/<\/style/gi, "<\\/style"); }
const POLICY = "default-src 'none'; base-uri 'none'; form-action 'none'; connect-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'";

// BM: Bina dokumen pratonton dengan CSP dan sandbox untuk kod yang tidak dipercayai.
// EN: Construct a CSP-protected sandbox document for untrusted preview code.
export function makePreviewSource({ html = "", css = "", js = "", id = "preview" }) {
  const safeId = JSON.stringify(clean(id).slice(0, 80)).replace(/</g, "\\u003c");
  const bootstrap = `<script>(function(){const id=${safeId};for(const method of ['log','info','warn','error']){const old=console[method].bind(console);console[method]=function(...v){try{parent.postMessage({zrainPreview:id,type:method,message:v.map(x=>String(x)).join(' ').slice(0,1600)},'*')}catch{}old(...v)}}addEventListener('error',e=>parent.postMessage({zrainPreview:id,type:'error',message:String(e.message).slice(0,1600)},'*'))})();<\/script>`;
  const stylesheet = css ? `<style>${escapeClosingStyle(clean(css))}</style>` : "";
  const script = js ? `<script>${escapeClosingScript(clean(js))}<\/script>` : "";
  let documentText = clean(html);
  if (!documentText.trim()) documentText = `<main id="app" style="font:16px system-ui;padding:22px"><h1>Zrain Preview</h1><p>Your JavaScript console output appears in the Console tab.</p></main>`;
  const prefix = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${POLICY}">`;
  if (/<head(?:\s[^>]*)?>/i.test(documentText)) documentText = documentText.replace(/<head(?:\s[^>]*)?>/i, `$&${prefix}${bootstrap}${stylesheet}`);
  else documentText = `${prefix}${bootstrap}${stylesheet}${documentText}`;
  if (/<\/body\s*>/i.test(documentText)) documentText = documentText.replace(/<\/body\s*>/i, `${script}$&`);
  else documentText += script;
  return documentText;
}

// BM: Cipta elemen antara muka pratonton dengan kelas yang dijangka.
// EN: Create preview UI elements with their required classes.
function create(tag, className, label) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (label != null) node.textContent = label;
  return node;
}

// Developer-friendly preview controls operate only on isolated front-end code.
// BM: Buka dialog pratonton sambil mengasingkan HTML pengguna daripada halaman induk.
// EN: Open the preview dialog while isolating user HTML from the parent page.
export function openCodePreview(originBlock) {
  const content = originBlock.closest(".message-content");
  if (!content) return;
  const snippets = Array.from(content.querySelectorAll(".code-block[data-code-language]"));
  // BM: Dapatkan elemen dialog tanpa membina markup tidak dipercayai.
  // EN: Resolve dialog elements without constructing untrusted markup.
  const find = names => snippets.find(node => names.includes(node.dataset.codeLanguage))?.querySelector("pre code")?.textContent || "";
  const html = find(["html", "htm"]);
  const css = find(["css"]);
  const js = find(["javascript", "js"]);
  const previewId = crypto.randomUUID();
  const dialog = create("dialog", "zrain-preview-dialog");
  dialog.setAttribute("aria-label", "Zrain AI live code preview");

  const head = create("div", "zrain-preview-head");
  const brand = create("div", "zrain-preview-identity");
  const mark = create("span", "zrain-preview-identity-icon", "</>");
  mark.setAttribute("aria-hidden", "true");
  const name = create("div", "zrain-preview-identity-copy");
  const heading = create("strong", "", "Web preview");
  const subheading = create("span", "", "Isolated HTML, CSS & JavaScript");
  name.append(heading, subheading);
  brand.append(mark, name);
  const close = create("button", "zrain-preview-close", "Close ✕");
  close.type = "button";
  close.setAttribute("aria-label", "Close code preview");
  head.append(brand, close);

  const toolbar = create("div", "zrain-preview-toolbar");
  const tabs = create("div", "zrain-preview-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Code preview tabs");
  const viewTab = create("button", "active", "Preview");
  const consoleTab = create("button", "", "Console (0)");
  for (const tab of [viewTab, consoleTab]) { tab.type = "button"; tab.setAttribute("role", "tab"); }
  viewTab.setAttribute("aria-selected", "true");
  consoleTab.setAttribute("aria-selected", "false");
  tabs.append(viewTab, consoleTab);

  const actions = create("div", "zrain-preview-actions");
  const devices = create("div", "zrain-preview-devices");
  devices.setAttribute("role", "group");
  devices.setAttribute("aria-label", "Preview screen size");
  const deviceButtons = new Map();
  for (const [value, label] of [["desktop", "Desktop"], ["tablet", "Tablet"], ["mobile", "Mobile"]]) {
    const button = create("button", value === "desktop" ? "active" : "", label);
    button.type = "button";
    button.dataset.device = value;
    button.setAttribute("aria-pressed", value === "desktop" ? "true" : "false");
    devices.append(button);
    deviceButtons.set(value, button);
  }
  const reload = create("button", "zrain-preview-reload", "↻ Refresh");
  reload.type = "button";
  reload.title = "Restart the preview";
  actions.append(devices, reload);
  toolbar.append(tabs, actions);

  const previewPane = create("div", "zrain-preview-stage");
  const deviceFrame = create("div", "zrain-preview-device is-desktop");
  const frame = create("iframe", "zrain-preview-frame");
  frame.title = "Isolated website code preview";
  frame.setAttribute("sandbox", "allow-scripts");
  frame.referrerPolicy = "no-referrer";
  deviceFrame.append(frame);
  previewPane.append(deviceFrame);

  const consolePane = create("section", "zrain-preview-console-pane");
  consolePane.hidden = true;
  const consoleHeader = create("div", "zrain-preview-console-header");
  const consoleTitle = create("strong", "", "Browser console");
  const clear = create("button", "", "Clear");
  clear.type = "button";
  consoleHeader.append(consoleTitle, clear);
  const logs = create("pre", "zrain-preview-console", "No console output yet. Interact with the preview to see logs here.");
  logs.setAttribute("aria-live", "polite");
  consolePane.append(consoleHeader, logs);

  const note = create("p", "zrain-preview-note", "Preview runs in a restricted sandbox. External scripts, network requests, backend services and localhost are not available.");
  dialog.append(head, toolbar, previewPane, consolePane, note);
  document.body.append(dialog);

  const markup = makePreviewSource({ html, css, js, id: previewId });
  let entries = [];
  const emptyText = "No console output yet. Interact with the preview to see logs here.";
  // BM: Paparkan log diagnostik terhad daripada iframe tanpa menilai kodnya di halaman induk.
  // EN: Show bounded diagnostic logs from the iframe without evaluating code in the parent page.
  function updateLogs() {
    logs.textContent = entries.length ? entries.map(entry => `[${entry.type}] ${entry.message}`).join("\n") : emptyText;
    consoleTab.textContent = `Console (${entries.length})`;
    logs.scrollTop = logs.scrollHeight;
  }
  // BM: Terima mesej iframe hanya daripada sumber pratonton yang sah.
  // EN: Receive iframe messages only from the expected preview source.
  const receive = event => {
    if (event.source !== frame.contentWindow || !event.data || event.data.zrainPreview !== previewId || entries.length >= 80) return;
    if (!["log", "info", "warn", "error"].includes(event.data.type)) return;
    entries.push({ type: event.data.type, message: String(event.data.message || "").slice(0, 1600) });
    updateLogs();
  };
  window.addEventListener("message", receive);

  // BM: Tukar panel log apabila pengguna memilih pratonton console.
  // EN: Toggle the log panel when a user selects the preview console.
  function showConsole(active) {
    previewPane.hidden = active;
    consolePane.hidden = !active;
    viewTab.classList.toggle("active", !active);
    consoleTab.classList.toggle("active", active);
    viewTab.setAttribute("aria-selected", String(!active));
    consoleTab.setAttribute("aria-selected", String(active));
    devices.querySelectorAll("button").forEach(button => { button.disabled = active; });
  }
  viewTab.addEventListener("click", () => showConsole(false));
  consoleTab.addEventListener("click", () => showConsole(true));
  for (const [device, button] of deviceButtons) {
    button.addEventListener("click", () => {
      deviceFrame.className = `zrain-preview-device is-${device}`;
      for (const [key, other] of deviceButtons) {
        other.classList.toggle("active", key === device);
        other.setAttribute("aria-pressed", String(key === device));
      }
    });
  }
  reload.addEventListener("click", () => {
    entries = [];
    updateLogs();
    frame.srcdoc = markup;
  });
  clear.addEventListener("click", () => { entries = []; updateLogs(); });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    frame.removeAttribute("srcdoc");
    window.removeEventListener("message", receive);
    dialog.remove();
  });
  // Register the message handler before the sandbox starts.
  frame.srcdoc = markup;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}
