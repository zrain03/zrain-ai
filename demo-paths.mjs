/**
 * Fail / File: demo-paths.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menolak traversal path semasa pelayan demo menghidangkan fail statik.
 * EN: Reject path traversal while the demo server serves static files.
 */
// Keep local file serving inside its configured directory on Windows, Linux and macOS.
import * as nativePath from "node:path";

// BM: Pastikan fail yang diminta berada di bawah root statik yang dipercayai.
// EN: Ensure the requested static file remains within the trusted public root.
export function isInsideDirectory(directory, file, pathApi = nativePath) {
  const relativePath = pathApi.relative(directory, file);
  return relativePath !== ".." &&
    !relativePath.startsWith(`..${pathApi.sep}`) &&
    !pathApi.isAbsolute(relativePath);
}
