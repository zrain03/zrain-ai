/**
 * Fail / File: frontend/zrain-ui/brand-init.js
 * Pembangun / Developer: Zrain
 * Dicipta / Created: 2026-11-04
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Pasang identiti Golden Reference pada halaman Zrain AI tanpa mengambil alih state chat.
 * EN: Mount the Golden Reference identity on Zrain AI pages without owning chat state.
 */
import { mountZrainUI } from "./zrain-ui.js";

// BM: Header mengekalkan butang sejarah, perbualan baharu dan status API yang dimiliki aplikasi.
// EN: Leave the application's history, new-chat and API-status controls untouched.
// BM: Footer mengekalkan pautan Chat, Privacy, Terms dan Contact mengikut setiap halaman.
// EN: Preserve each page's own Chat, Privacy, Terms and Contact footer links.
mountZrainUI({ product: "AI", logoSrc: "./zrain-logo.webp", productHref: "./" });
