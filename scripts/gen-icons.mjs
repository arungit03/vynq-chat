// Generates Vynq-chat brand icons (SVG + PNG). Run: node scripts/gen-icons.mjs
import { writeFileSync, mkdirSync, readFile } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#60b0fa"/>
      <stop offset="1" stop-color="#2272eb"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <path d="M150 150h212a34 34 0 0 1 34 34v146a34 34 0 0 1-34 34H236l-66 58a18 18 0 0 1-30-14v-44H150a34 34 0 0 1-34-34V184a34 34 0 0 1 34-34z" fill="#ffffff" opacity="0.96"/>
  <path d="M196 214l60 72 60-72" fill="none" stroke="#2272eb" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

writeFileSync(resolve(outDir, "vynq.svg"), svg(512));
writeFileSync(resolve(outDir, "vynq-192.svg"), svg(192));
writeFileSync(resolve(outDir, "vynq-512.svg"), svg(512));

// PNG generation (best-effort; uses sharp if available)
try {
  const sharp = (await import("sharp")).default;
  const buf = Buffer.from(svg(512));
  for (const s of [192, 512]) {
    const png = await sharp(buf).resize(s, s).png().toBuffer();
    writeFileSync(resolve(outDir, `vynq-${s}.png`), png);
  }
  console.log("Vynq icons (SVG + PNG) written to public/icons/");
} catch (e) {
  console.warn(
    "sharp not installed — wrote SVG icons only. Run `npm i -D sharp` then re-run to also emit PNGs (needed for full PWA installability on iOS/Android).",
  );
}
