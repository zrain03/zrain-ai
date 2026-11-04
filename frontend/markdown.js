/**
 * Fail / File: frontend/markdown.js
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Memaparkan Markdown sebagai nod DOM selamat tanpa menyisip HTML tidak dipercayai.
 * EN: Render Markdown as safe DOM nodes without injecting untrusted HTML.
 */
import { isPreviewLanguage, openCodePreview } from "./code-preview.js";
// Small zero-dependency Markdown renderer for AI text.
// It creates DOM nodes and never inserts AI-controlled HTML into the page.
const MAX_MARKDOWN_LENGTH = 18000;

// BM: Tolak URL yang tidak selamat sebelum dibina sebagai pautan.
// EN: Reject unsafe URLs before creating hyperlinks.
function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

// BM: Tukar syntax Markdown inline kepada nod DOM selamat.
// EN: Turn inline Markdown syntax into safe DOM nodes.
function appendInline(parent, text, depth = 0) {
  if (!text) return;
  if (depth > 3) { parent.append(document.createTextNode(text)); return; }
  const token = /\[([^\]\n]{1,180})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>\[\]()"']+)|\*\*(.+?)\*\*|__(.+?)__|`([^`\n]+)`|(?<!\*)\*([^*\n]+)\*(?!\*)|(?<!_)_([^_\n]+)_(?!_)/g;
  let last = 0;
  for (const found of text.matchAll(token)) {
    if (found.index > last) parent.append(document.createTextNode(text.slice(last, found.index)));
    if (found[1] !== undefined) {
      const href = safeUrl(found[2]);
      if (href) {
        const a = document.createElement("a");
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener noreferrer nofollow";
        a.textContent = found[1];
        parent.append(a);
      } else parent.append(document.createTextNode(found[0]));
    } else if (found[3] !== undefined) {
      const raw = found[3];
      const trimmed = raw.replace(/[.,;!?]+$/, "");
      const href = safeUrl(trimmed);
      if (href) {
        const a = document.createElement("a");
        a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer nofollow";
        a.textContent = trimmed; parent.append(a);
        if (trimmed.length < raw.length) parent.append(document.createTextNode(raw.slice(trimmed.length)));
      } else parent.append(document.createTextNode(raw));
    } else if (found[4] !== undefined || found[5] !== undefined) {
      const bold = document.createElement("strong");
      appendInline(bold, found[4] ?? found[5], depth + 1);
      parent.append(bold);
    } else if (found[6] !== undefined) {
      const code = document.createElement("code");
      code.textContent = found[6];
      parent.append(code);
    } else {
      const em = document.createElement("em");
      appendInline(em, found[7] ?? found[8], depth + 1);
      parent.append(em);
    }
    last = found.index + found[0].length;
  }
  if (last < text.length) parent.append(document.createTextNode(text.slice(last)));
}

// BM: Cipta perenggan hasil AI tanpa menggunakan innerHTML tidak dipercayai.
// EN: Create AI response paragraphs without unsafe innerHTML.
function makeParagraph(lines) {
  const paragraph = document.createElement("p");
  lines.forEach((line, index) => {
    if (index) paragraph.append(document.createTextNode(" "));
    appendInline(paragraph, line.trim());
  });
  return paragraph;
}

// BM: Paparkan kod sebagai teks dan sediakan tindakan preview/copy yang dibenarkan.
// EN: Render code as text with permitted preview and copy actions.
function appendCodeBlock(container, language, codeText) {
  const shell = document.createElement("div");
  shell.className = "code-block";
  shell.dataset.codeLanguage = String(language).toLowerCase();
  const heading = document.createElement("div");
  heading.className = "code-heading";
  const label = document.createElement("span");
  label.textContent = language && /^[\w+#.-]{1,20}$/.test(language) ? language : "Code";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy code";
  copy.setAttribute("aria-label", "Copy code block");
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      copy.textContent = "Copied";
    } catch { copy.textContent = "Copy failed"; }
  });
  heading.append(label, copy);
  if (isPreviewLanguage(language)) {
    const preview = document.createElement("button");
    preview.type = "button"; preview.className = "code-preview-trigger";
    preview.textContent = "Preview web";
    preview.setAttribute("aria-label", "Preview this web code in a sandbox");
    preview.addEventListener("click", () => openCodePreview(shell));
    heading.append(preview);
  }
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = codeText;
  pre.append(code);
  shell.append(heading, pre);
  container.append(shell);
}

// BM: Tukar balasan Markdown kepada komponen yang boleh dibaca dengan parser terhad.
// EN: Render Markdown replies as readable components using a bounded parser.
export function renderMarkdown(container, raw) {
  container.replaceChildren();
  const text = String(raw ?? "").replace(/\r\n?/g, "\n").slice(0, MAX_MARKDOWN_LENGTH);
  const lines = text.split("\n");
  let paragraph = [];
  let list = null;
  let listType = "";
  // BM: Selesaikan perenggan terkumpul semasa parsing.
  // EN: Flush accumulated paragraph content during parsing.
  const flushParagraph = () => {
    if (paragraph.length) container.append(makeParagraph(paragraph));
    paragraph = [];
  };
  // BM: Tutup senarai semasa agar turutan kandungan kekal betul.
  // EN: Finish the current list so content order remains correct.
  const flushList = () => { list = null; listType = ""; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s{0,3}```\s*([^\s`]*)\s*$/);
    if (fence) {
      flushParagraph(); flushList();
      const codeLines = [];
      while (++i < lines.length && !/^\s{0,3}```\s*$/.test(lines[i])) codeLines.push(lines[i]);
      appendCodeBlock(container, fence[1], codeLines.join("\n"));
      continue;
    }
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    const heading = line.match(/^\s{0,3}(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const h = document.createElement(`h${Math.min(4, heading[1].length + 1)}`);
      appendInline(h, heading[2].trim());
      container.append(h);
      continue;
    }
    if (/^\s{0,3}(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      flushParagraph(); flushList(); container.append(document.createElement("hr")); continue;
    }
    const quote = line.match(/^\s{0,3}>\s?(.*)$/);
    if (quote) {
      flushParagraph(); flushList();
      const q = document.createElement("blockquote");
      appendInline(q, quote[1]);
      container.append(q);
      continue;
    }
    const unordered = line.match(/^\s{0,3}[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s{0,3}\d{1,3}[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const type = ordered ? "ol" : "ul";
      if (listType !== type) {
        list = document.createElement(type);
        container.append(list);
        listType = type;
      }
      const li = document.createElement("li");
      appendInline(li, (unordered || ordered)[1].trim());
      list.append(li);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
}

// User text is not treated as Markdown, but links are clickable.
// BM: Bina pautan pengguna yang selamat tanpa memaparkan HTML pengguna.
// EN: Create safe user links without interpreting user-supplied HTML.
export function renderUserLinks(container, value) {
  container.replaceChildren();
  const text = String(value ?? "");
  const regex = /https?:\/\/[^\s<>"'`]+/g;
  let previous = 0;
  for (const match of text.matchAll(regex)) {
    container.append(document.createTextNode(text.slice(previous, match.index)));
    const raw = match[0];
    const cleaned = raw.replace(/[),.;!?]+$/, "");
    const href = safeUrl(cleaned);
    if (href) {
      const anchor = document.createElement("a");
      anchor.href = href; anchor.target = "_blank";
      anchor.rel = "noopener noreferrer nofollow"; anchor.textContent = cleaned;
      container.append(anchor);
    } else container.append(document.createTextNode(cleaned));
    if (cleaned.length !== raw.length) container.append(document.createTextNode(raw.slice(cleaned.length)));
    previous = match.index + raw.length;
  }
  container.append(document.createTextNode(text.slice(previous)));
}
