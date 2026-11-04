<!--
  Fail / File: docs/WEB-RESEARCH-PREVIEW.md
  Pembangun / Developer: Zrain
  Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
  Dikemas kini / Last updated: 2026-11-04
  BM: Menjelaskan penyelidikan terhad serta pratonton kod yang terasing.
  EN: Explain limited research and isolated code previews.
-->
# Zrain AI: Web Research & Live Code Preview

Developed by Zrain. Made for people. Built with purpose.

## Functions

1. **Links:** HTTP(S) links in AI replies and user messages become clickable and open the destination in a separate browser tab. The app does not automatically navigate the user away from a chat.
2. **Research beta:** The `Research` control requests limited Wikipedia sources. Queries with clear web-search intent may also trigger research. If a user includes an allowed public URL, the backend attempts to read its page text. Sources appear as clickable links below the answer. This is NOT general web search, and not all websites can be read.
3. **Live Web Preview:** AI replies with fenced `html`, `css`, `js` or `javascript` code show a `Preview web` button. It opens an isolated rendering window with a simple Console tab. When the same AI reply includes HTML, CSS and JavaScript fences, these are combined into one preview. It supports only browser-renderable code.

## Supported page reader domains

`zrain.web.app`, `guesstheflag-zrain.web.app`, `memoryrush-zrain.web.app`, `developer.mozilla.org`, `docs.github.com`, `developers.cloudflare.com`, `en.wikipedia.org`, `ms.wikipedia.org`, and `www.mediawiki.org`.

The page reader allows HTTPS only, rejects credentials or non-standard ports, never follows redirects, caps page size, rejects non-text responses, and imposes short timeouts. It is not a crawler and cannot run JavaScript from websites.

Wikipedia searches use the public Wikimedia Action API. Wikimedia applies its own rate limits and policies. Some queries may fail or return no good matches. The model must not claim to have verified unsupported claims. The assistant may still answer from general knowledge without a current source, with a clear limitation notice if research failed.

## Preview security

The preview runs in an iframe with `sandbox="allow-scripts"` and **without** `allow-same-origin`, form submission, pop-ups or top navigation. An in-document Content Security Policy blocks outgoing requests, external scripts, stylesheets, fonts, frames, and third-party calls. Only inline CSS and JavaScript from the snippet are allowed. Console messages are passed to the parent window and displayed with `textContent` only.

The preview is NOT a localhost server. Backend applications, database connections, Python, Java, compiled React/Vite projects, npm packages or network-loaded frameworks are not executed. Complex programs can still be incorrect or stall the browser; do not treat AI-generated code as safe without review.

## Zero-cost operation

No paid search API or AI Gateway Web Search integration is enabled. The existing Cloudflare Workers Free deployment, AI model, Turnstile, quota controls, and Firebase Spark Hosting are retained. Each research-enabled chat call still consumes one normal Zrain AI message and model inference within the shared free quota. An external source may independently be unavailable or rate limited.

## Privacy

When research is used, the source service receives the search query or requested URL. The backend sends a short source excerpt to Workers AI. Conversation content continues to be saved only in the browser, with any citation titles and links stored alongside the AI response. No web page text is written to Cloudflare D1 by this feature.

## Deployment

Run `npm run check` and `npm run setup:check` from the Zrain AI project root, then deploy the Worker and Firebase Hosting. No new database migration, API key or paid plan is required. Use the included automatic installer for Windows.
