<!--
  Fail / File: docs/LOCAL-HISTORY-ATTACHMENTS.md
  Pembangun / Developer: Zrain
  Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
  Dikemas kini / Last updated: 2026-11-04
  BM: Mendokumenkan sejarah lokal dan had penyimpanan lampiran.
  EN: Document local history and attachment storage boundaries.
-->
# Zrain AI: local conversation history and attachments

This feature update keeps the project in `Downloads\Zrain\Projects\zrain-ai`. It adds **no paid APIs**, no D1 schema changes, no new npm dependencies, and no changes to Wrangler bindings, secrets, frontend/config.js or the official Zrain logo.

## Conversation history
- Up to 35 conversations with up to 80 recent messages in each, subject to browser storage availability.
- Chat titles are created automatically from the first user message. Use `...` to rename or delete a conversation.
- Chats are saved in this browser's local storage, not in D1. They do not sync across browsers or devices.
- On mobile, tap the menu icon in the header to open chat history.
- Export downloads a JSON copy; Clear all deletes all saved conversations from this browser.
- Chat data and session tokens remain in the browser until cleared. Avoid confidential information.
- Images are not saved locally as original image data. The filename is displayed in history and the image cannot be re-examined from history after reload without reattaching it.

## File support
- Choose file, drag and drop, and paste screenshots from the clipboard.
- Text/code formats: TXT, MD, CSV, JSON, JS, TS, TSX, JSX, PY, JAVA, HTML, CSS, XML, LOG, SQL, YAML, YML, SH, PS1 (1 MB file max).
- PDFs containing extractable text (1 MB file max, up to 12 pages, 6,900 extracted characters). Uses PDF.js from cdnjs in the browser. Scanned/image-only PDFs have no OCR support.
- Images: JPG, PNG or WebP, up to 5 MB before browser resizing/compression. Sent as JPEG up to 260,000 data-URL characters.
- One attachment per AI request. Do not upload private information.
- Only a text excerpt or processed image is transmitted for inference; raw files are not uploaded to D1 or file storage.

## AI models
- Normal chat continues using the configured Qwen3 model.
- Image requests use `@cf/meta/llama-4-scout-17b-16e-instruct`, which Cloudflare documents as vision-capable. Model availability, license acceptance and inference on the user's Free account require a real integration smoke test after deployment.
- No paid provider fallback is configured. Requests fail safely if the Free quota or model availability is exhausted.
- Daily allowance remains 100 per visitor (subject to shared quota), configured in Worker vars.

## Production deployment
1. Run `npm run check` from the `zrain-ai` project directory.
2. Run `npm run setup:check` to verify public configuration.
3. Deploy the Worker: `cd worker`, `npx wrangler deploy`.
4. Deploy the frontend: `cd ../frontend`, `npx firebase-tools deploy --only hosting --project zrain-ai`.
5. Open `https://zrain-ai.web.app` and hard refresh.
6. Test text chat, chat history after page refresh, delete/export and text attachment, then test an image with a simple description prompt, and PDF with readable text.
7. Check Cloudflare Workers AI usage. Do not upgrade to Workers Paid.

## Privacy notes
- History is local to the device and can be lost if browser storage is cleared.
- D1 continues to store only quota metadata, not transcripts or attachments.
- File text and images are transferred to Cloudflare Workers AI only while processing the specific request. PDF.js loads from cdnjs only when a PDF is selected.
- This release provides no cloud backups, cross-device sync, DOCX/XLSX support, PDF OCR, or multiple attachments in one message.
- When a user deletes chat history, that action does not delete quota metadata, which has its own short retention period.
