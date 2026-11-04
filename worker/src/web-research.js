/**
 * Fail / File: worker/src/web-research.js
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Mengambil bukti daripada Wikipedia dan halaman yang dibenarkan sahaja tanpa redirect.
 * EN: Fetch evidence only from Wikipedia and allowlisted pages without redirects.
 */
// Zero-paid-search research: Wikipedia's public Action API and tightly allowlisted public pages.
// Never send user-controlled URLs to unrestricted fetch. Never follow redirects.
const READER_HOSTS = new Set([
  "zrain.web.app", "guesstheflag-zrain.web.app", "memoryrush-zrain.web.app",
  "developer.mozilla.org", "docs.github.com", "developers.cloudflare.com",
  "en.wikipedia.org", "ms.wikipedia.org", "www.mediawiki.org"
]);
const AGENT = "ZrainAIResearch/1.0 (https://zrain-ai.web.app/; zrain.dev@gmail.com)";
const FETCH_TIMEOUT_MS = 6500;
const MAX_HTML = 90000;
const MAX_CONTEXT = 4400;

// BM: Benarkan URL HTTPS daripada host tepat yang disenaraikan, tanpa port atau credential.
// EN: Allow only HTTPS URLs on exact approved hosts without ports or credentials.
export function safeReadUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !READER_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (url.pathname.length > 550 || url.search.length > 550) return null;
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

// BM: Kenal pasti URL pertama daripada prompt sambil membuang tanda baca di hujung.
// EN: Extract the first user URL while trimming trailing punctuation.
export function firstUrl(message) {
  const found = String(message).match(/https?:\/\/[^\s<>"'`]+/);
  return found ? found[0].replace(/[),.;!?]+$/, "") : null;
}

// BM: Kenal pasti arahan penyelidikan yang jelas tanpa melakukan carian setiap masa.
// EN: Detect explicit research intent instead of searching on every request.
export function wantsResearch(message) {
  return /(?:\bsearch\s+(?:the\s+)?web\b|\bsearch online\b|\bonline search\b|\bwikipedia\b|\blatest\b|\brecent (?:news|updates?)\b|\blook (?:it )?up\b|\bcurrent (?:news|events|status|information)\b|\bcari\s+(?:di\s+)?(?:internet|web|wikipedia)\b|\bsemak (?:di\s+)?(?:internet|web)\b|\bberita (?:terkini|terbaru)\b|\bmaklumat terkini\b)/i.test(message);
}

// BM: Ringkaskan kandungan sumber kepada petikan teks yang terhad.
// EN: Reduce source content to a bounded plain-text excerpt.
function snippet(text, size = 750) {
  return String(text || "").replace(/<[^>]*>/g, " ").replace(/&(?:amp|lt|gt|quot|nbsp);/g, " ").replace(/\s+/g, " ").trim().slice(0, size);
}

// BM: Ambil sumber awam dengan timeout dan redirect manual untuk mengelak bypass allowlist.
// EN: Fetch public sources with a timeout and manual redirects to protect the allowlist.
async function shortFetch(url, fetchImpl) {
  const response = await fetchImpl(url, {
    method: "GET", redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "Accept": "application/json, text/html;q=0.9, text/plain;q=0.8", "User-Agent": AGENT }
  });
  // All redirects are blocked: they could bypass the allowlist.
  if (!response.ok || (response.status >= 300 && response.status < 400)) throw new Error("Public source is unavailable");
  return response;
}

// BM: Hadkan jumlah data yang dibaca daripada sumber luaran sebelum parsing.
// EN: Limit external response bytes before parsing.
async function readLimitedBody(response, maxBytes = MAX_HTML) {
  const size = Number(response.headers.get("content-length"));
  if (Number.isFinite(size) && size > maxBytes) throw new Error("Page is too large");
  if (!response.body?.getReader) return (await response.text()).slice(0, maxBytes);
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); break; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const out = new Uint8Array(chunks.reduce((n, item) => n + item.length, 0));
  let pos = 0;
  for (const item of chunks) { out.set(item, pos); pos += item.length; }
  return new TextDecoder().decode(out);
}

// BM: Ekstrak isi teks daripada halaman yang benar-benar dibenarkan dan tersedia.
// EN: Extract text only from genuinely available allowlisted pages.
export async function readApprovedPage(url, fetchImpl = fetch) {
  const safe = safeReadUrl(url);
  if (!safe) return null;
  const response = await shortFetch(safe, fetchImpl);
  const mime = response.headers.get("content-type") || "";
  if (!/text\/(?:html|plain)|application\/xhtml\+xml/i.test(mime)) throw new Error("Page is not readable text");
  const body = await readLimitedBody(response);
  const title = snippet((body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || new URL(safe).hostname, 160);
  const readable = body.replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(?:script|style|noscript|svg|nav|footer|header)[^>]*>[\s\S]*?<\/\s*(?:script|style|noscript|svg|nav|footer|header)\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  const text = snippet(readable, 2300);
  if (text.length < 30) throw new Error("Page text is not available");
  return { title, url: safe, excerpt: text, provider: "Public page" };
}

// BM: Buang arahan umum supaya kata kunci carian Wikipedia kekal relevan.
// EN: Remove generic commands to keep Wikipedia search terms relevant.
function searchTerms(message) {
  return String(message).replace(/https?:\/\/\S+/g, " ")
    .replace(/\b(?:search (?:the )?web(?: for)?|search online|look up|wikipedia|latest|recent|please|find|cari (?:di )?(?:internet|web|wikipedia)?|tolong|semak(?: di internet)?|tentang|mengenai)\b/gi, " ")
    .replace(/[\n\r!?]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 170);
}

// Wikimedia Action API first, followed by REST search when the public Action API
// is unavailable or its search results do not include a readable excerpt.
// Each returned source must contain text actually received from Wikimedia.
// BM: Cari dan sahkan petikan Wikipedia melalui API rasmi serta fallback terhad.
// EN: Search and verify Wikipedia excerpts using public APIs and bounded fallbacks.
export async function searchWikipedia(message, fetchImpl = fetch) {
  const query = searchTerms(message);
  if (query.length < 2) return [];
  const host = "en.wikipedia.org";
  const endpoint = new URL(`https://${host}/w/api.php`);
  for (const [key, value] of Object.entries({
    action: "query", generator: "search", gsrsearch: query, gsrlimit: "3",
    prop: "extracts", exintro: "1", explaintext: "1", format: "json", formatversion: "2", maxlag: "5"
  })) endpoint.searchParams.set(key, value);
  let responded = false;
  try {
    const response = await shortFetch(endpoint.toString(), fetchImpl);
    responded = true;
    const data = JSON.parse(await readLimitedBody(response, 60000));
    const results = (data?.query?.pages || []).slice(0, 3)
      .filter(page => typeof page.title === "string")
      .map(page => ({
        title: page.title.slice(0, 160),
        url: `https://${host}/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
        excerpt: snippet(page.extract, 800),
        provider: "Wikipedia", evidenceType: "article-extract"
      })).filter(page => page.excerpt.length > 30);
    if (results.length) return results;
  } catch { /* Continue with independent public APIs. */ }

  // Fallback 1: OpenSearch titles + a real article summary.
  const titlesUrl = new URL(`https://${host}/w/api.php`);
  for (const [key, value] of Object.entries({
    action: "opensearch", search: query, limit: "2", namespace: "0", format: "json"
  })) titlesUrl.searchParams.set(key, value);
  try {
    const response = await shortFetch(titlesUrl.toString(), fetchImpl);
    responded = true;
    const data = JSON.parse(await readLimitedBody(response, 20000));
    const title = Array.isArray(data?.[1]) ? data[1].find(t => typeof t === "string" && t.trim()) : null;
    if (title) {
      const summaryUrl = `https://${host}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
      const summaryResponse = await shortFetch(summaryUrl, fetchImpl);
      const summary = JSON.parse(await readLimitedBody(summaryResponse, 20000));
      const excerpt = snippet(summary?.extract, 800);
      if (excerpt.length >= 30) {
        const safeTitle = String(summary?.title || title).slice(0, 160);
        return [{ title: safeTitle, url: `https://${host}/wiki/${encodeURIComponent(safeTitle.replace(/ /g, "_"))}`,
          excerpt, provider: "Wikipedia", evidenceType: "article-summary" }];
      }
    }
  } catch { /* Use the documented Wikimedia REST page-search endpoint. */ }

  // Fallback 2: REST search returns grounded summaries/snippets. These are
  // labelled search previews, not falsely described as fully read articles.
  const rest = new URL(`https://${host}/w/rest.php/v1/search/page`);
  rest.searchParams.set("q", query);
  rest.searchParams.set("limit", "3");
  try {
    const response = await shortFetch(rest.toString(), fetchImpl);
    responded = true;
    const data = JSON.parse(await readLimitedBody(response, 60000));
    const results = (data?.pages || []).slice(0, 3).flatMap(page => {
      if (typeof page?.title !== "string") return [];
      const excerpt = snippet([page.description, page.excerpt].filter(Boolean).join(". "), 650);
      if (excerpt.length < 30) return [];
      const title = page.title.slice(0, 160);
      return [{ title, url: `https://${host}/wiki/${encodeURIComponent((page.key || title).replace(/ /g, "_"))}`,
        excerpt, provider: "Wikipedia", evidenceType: "search-preview" }];
    });
    if (results.length) return results;
    return [];
  } catch {
    // Do not invent search results when the APIs are inaccessible.
    if (!responded) throw new Error("Wikipedia public APIs are unavailable");
    return [];
  }
}

// BM: Kumpulkan sumber yang disahkan atau pulangkan status gagal secara jujur.
// EN: Collect verified sources or return an honest unavailable status.
export async function gatherResearch({ message, research = false }, fetchImpl = fetch) {
  const requestedUrl = firstUrl(message);
  // Explicit Research is always attempted. Normal chat only fetches a URL
  // or performs research when the user explicitly asks to search the web.
  const shouldSearch = research || wantsResearch(message);
  if (!shouldSearch && !requestedUrl) return { status: "off", sources: [], context: "" };
  let sources = [];
  let status = "unavailable";
  if (requestedUrl) {
    if (!safeReadUrl(requestedUrl)) return {
      status: "link-not-readable", sources: [], context: "", attempted: true,
      checkedAt: new Date().toISOString(), scope: "Wikipedia and selected public websites",
      notice: "The link can be opened in your browser, but reading is limited to approved public websites."
    };
    try { sources = [await readApprovedPage(requestedUrl, fetchImpl)]; status = "read"; }
    catch { status = "unavailable"; }
  } else if (shouldSearch) {
    try { sources = await searchWikipedia(message, fetchImpl); status = sources.length ? "wikipedia" : "no-results"; }
    catch { status = "unavailable"; }
  }
  const context = sources.map((s, i) => `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\nEvidence type: ${s.evidenceType || "read-page"}\nExcerpt: ${s.excerpt}`).join("\n\n").slice(0, MAX_CONTEXT);
  const attempted = shouldSearch || !!requestedUrl;
  const notice = sources.length ? "" : status === "link-not-readable"
    ? "That URL is outside the approved reading list. You can still open it yourself."
    : status === "no-results" ? "No relevant Wikipedia excerpts were found. This response has no verified web sources."
    : "The public research sources could not be reached. The response is not web-verified.";
  return { status, sources, context, attempted, checkedAt: new Date().toISOString(),
    scope: "Wikipedia and selected public websites", ...(notice ? { notice } : {}) };
}
