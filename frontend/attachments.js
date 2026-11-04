/**
 * Fail / File: frontend/attachments.js
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Mengesahkan fail pengguna serta mengekstrak kandungan mengikut had saiz dan jenis yang dibenarkan.
 * EN: Validate attachments and extract content within supported type and size limits.
 */
// Browser-side text extraction and image compression. Files are never uploaded as raw files.
export const MAX_DOCUMENT_BYTES = 1024 * 1024; // only short excerpt is sent to AI
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_TEXT = 12000;
export const MAX_LOCAL_PREVIEW = 150_000;
export const MAX_IMAGE_DATA_URL = 210_000;
const ALLOWED_EXTENSIONS = new Set(["txt","md","csv","json","js","ts","tsx","jsx","py","java","html","css","xml","log","sql","yaml","yml","sh","ps1","pdf"]);
const IMAGE_MIMES = new Set(["image/jpeg","image/png","image/webp"]);
// BM: Kenal pasti extension untuk had jenis fail yang dibenarkan.
// EN: Identify the extension for file-type allowlisting.
const fileExtension = name => String(name).split(".").pop().toLowerCase();

// BM: Bezakan dokumen dan imej sebelum membaca kandungannya.
// EN: Classify documents and images before content processing.
export function classifyFile(file) {
  if (!file || typeof file.name !== "string" || typeof file.size !== "number") throw new Error("Invalid file.");
  if (IMAGE_MIMES.has(file.type) && ["jpg","jpeg","png","webp"].includes(fileExtension(file.name))) {
    if (file.size > MAX_IMAGE_BYTES) throw new Error("Image is too large. Maximum 5 MB.");
    return "image";
  }
  if (!ALLOWED_EXTENSIONS.has(fileExtension(file.name))) throw new Error("Unsupported file. Use PNG/JPG/WebP, PDF or a text/code document.");
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("Document is too large. Maximum 1 MB.");
  return fileExtension(file.name) === "pdf" ? "pdf" : "text";
}

// BM: Ekstrak teks PDF secara setempat dengan dependency pembaca browser.
// EN: Extract PDF text locally using a browser PDF reader dependency.
async function extractPdf(file) {
  // Browser-only extraction. Scanned PDFs need OCR and are not supported yet.
  let library;
  try { library = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"); }
  catch { throw new Error("PDF reader unavailable. Try a text document or check your internet connection."); }
  library.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  let document;
  try { document = await library.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; }
  catch { throw new Error("Could not read this PDF. It may be encrypted or damaged."); }
  let output = "";
  try {
    for (let i = 1; i <= Math.min(document.numPages, 12); i++) {
      const page = await document.getPage(i);
      const text = await page.getTextContent();
      output += `\n[Page ${i}]\n` + text.items.map(item => item.str || "").join(" ");
      if (output.length >= MAX_LOCAL_PREVIEW) break;
    }
  } finally { await document.destroy(); }
  if (!output.trim()) throw new Error("This PDF has no extractable text. Scanned PDFs are not supported yet.");
  return output.slice(0, MAX_LOCAL_PREVIEW);
}
// BM: Kecilkan imej dalam browser supaya payload AI terkawal.
// EN: Resize and compress images in-browser to bound AI payload size.
async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const maxEdge = 760;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is not available in this browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let data = "";
    for (const quality of [0.72, 0.53, 0.38, 0.26]) {
      data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= MAX_IMAGE_DATA_URL) break;
    }
    if (data.length > MAX_IMAGE_DATA_URL) throw new Error("This image cannot be compressed enough. Try a smaller image.");
    return data;
  } finally { bitmap.close(); }
}
// BM: Sahkan saiz/jenis lalu hasilkan kandungan terhad dan metadata untuk setiap lampiran.
// EN: Validate type and size before preparing bounded content and metadata for each attachment.
export async function prepareAttachment(file) {
  const kind = classifyFile(file);
  const name = file.name.slice(0, 100);
  if (kind === "image") {
    const data = await compressImage(file);
    return { id: crypto.randomUUID(), name, kind: "image", mime: "image/jpeg", data, preview: data };
  }
  const text = kind === "pdf" ? await extractPdf(file) : (await file.text()).slice(0, MAX_LOCAL_PREVIEW);
  if (!text.trim()) throw new Error("This document has no readable text.");
  const clean = text.slice(0, MAX_DOCUMENT_TEXT);
  return { id: crypto.randomUUID(), name, kind: "document", text: clean, fullPreview: text, previewText: text.slice(0, 220), mime: "text/plain" };
}
