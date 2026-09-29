/**
 * HealThaali — brand asset extraction
 * ----------------------------------
 *   npm run assets
 *
 * The website does not invent branding. This script derives every image the
 * site ships from the *supplied* brand kit, so the whole asset pipeline is
 * reproducible and reviewable:
 *
 *   INPUT  (read-only, not committed — see the root .gitignore)
 *     ../../asset/HealThaali Assets/HealThaali UIUX  V3.png   product design board
 *     ../../asset/HealThaali Assets/HealThaali.png            HT monogram (checkerboard source)
 *     ../../asset/HealThaali Assets/optimized/logo-transparent.png  keyed monogram
 *     ../../asset/HealThaali Assets/HealThaali Banner.png     brand banner
 *     ../../asset/HealThaali Assets/HealThaali Social Square.png
 *
 *   OUTPUT (committed)
 *     src/assets/screens/*.png      the 12 app screens, cut from the design board
 *     src/assets/brand/*          logo mark, banner, social square
 *     public/favicon.svg, favicon-32.png, apple-touch-icon.png, icon-*.png
 *     public/og-image.jpg          1200x630 social card
 *
 * The board is 1536x1024, so each app screen is roughly 196x358 px — that is
 * the largest source that exists. Screens are upscaled 2x with Lanczos and
 * lightly sharpened so they stay smooth when displayed in a device mockup.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const ASSETS = path.resolve(root, "..", "asset", "HealThaali Assets");

const OUT_SCREENS = path.join(root, "src", "assets", "screens");
const OUT_BRAND = path.join(root, "src", "assets", "brand");
const OUT_PUBLIC = path.join(root, "public");

/** Brand colours, sampled from the supplied logo (see tokens.css). */
const BRAND = {
  green: "#2a8a33",
  greenDark: "#1f6b28",
  orange: "#f06000",
  gold: "#e0a93a",
  cream: "#fdfbf5",
  ink: "#16241b",
};

const BOARD = path.join(ASSETS, "HealThaali UIUX  V3.png");

/**
 * Screen boxes read off the design board with a coordinate-grid overlay.
 * Row 1 is true phone proportions; row 2 mockups are drawn wider, so they are
 * shipped as screenshot cards rather than phone frames.
 */
const SCREENS = [
  // row 1 — true phone proportions, frames measured at x 25/223/431/643/858/1100/1325
  // and y 135-493 on the board.
  { id: "splash", l: 24, t: 134, w: 200, h: 360, device: "phone" },
  { id: "welcome", l: 222, t: 134, w: 200, h: 360, device: "phone" },
  { id: "create-profile", l: 430, t: 134, w: 200, h: 360, device: "phone" },
  { id: "profile-setup", l: 642, t: 134, w: 200, h: 360, device: "phone" },
  { id: "dashboard", l: 857, t: 134, w: 200, h: 360, device: "phone" },
  { id: "meal-plan", l: 1099, t: 134, w: 200, h: 360, device: "phone" },
  { id: "recipe-detail", l: 1324, t: 134, w: 200, h: 360, device: "phone" },
  // row 2 — the board draws these wider (210 x 262); frames measured at
  // y 522-782. Shipped as screenshot cards, not phone frames.
  { id: "food-log", l: 24, t: 520, w: 210, h: 264, device: "screen" },
  { id: "scan-food", l: 264, t: 520, w: 210, h: 264, device: "screen" },
  { id: "ai-suggestions", l: 490, t: 520, w: 210, h: 264, device: "screen" },
  { id: "progress", l: 750, t: 520, w: 210, h: 264, device: "screen" },
  { id: "food-memory", l: 1018, t: 520, w: 210, h: 264, device: "screen" },
  { id: "settings", l: 1290, t: 520, w: 210, h: 264, device: "screen" },
];

const UPSCALE = 2;

const log = (msg) => console.log(msg);

async function extractScreens() {
  await mkdir(OUT_SCREENS, { recursive: true });
  for (const s of SCREENS) {
    const out = path.join(OUT_SCREENS, `${s.id}.png`);
    await sharp(BOARD)
      .extract({ left: s.l, top: s.t, width: s.w, height: s.h })
      .resize(s.w * UPSCALE, s.h * UPSCALE, { kernel: "lanczos3" })
      .sharpen({ sigma: 0.8 })
      .png({ compressionLevel: 9, palette: false })
      .toFile(out);
  }
  log(`  screens      ${SCREENS.length} files -> src/assets/screens/`);
  const expected = ["splash", "welcome", "create-profile", "profile-setup", "dashboard", "meal-plan", "recipe-detail", "food-log", "scan-food", "ai-suggestions", "progress", "food-memory", "settings"];
  const missing = expected.filter((id) => !SCREENS.some((s) => s.id === id));
  if (missing.length) throw new Error(`Screen list is incomplete: ${missing.join(", ")}`);
}

async function brandMark() {
  await mkdir(OUT_BRAND, { recursive: true });

  const keyed = path.join(ASSETS, "optimized", "logo-transparent.png");
  const source = existsSync(keyed) ? keyed : path.join(ASSETS, "HealThaali.png");

  // Trim the transparent margin so the mark fills its box in the header.
  const trimmed = await sharp(source)
    .ensureAlpha()
    .trim({ threshold: 12 })
    .png()
    .toBuffer();

  const { width = 512 } = await sharp(trimmed).metadata();

  // Website mark: generated at 2x the largest on-page size, transparent.
  await sharp(trimmed)
    .resize({ width: 640, withoutEnlargement: false, kernel: "lanczos3" })
    .sharpen({ sigma: 0.6 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_BRAND, "logo-mark.png"));
  log(`  logo mark    640px wide (trimmed from ${width}px source)`);

  // Square, cream-backed icon for launchers / manifests (no alpha).
  const makeSquare = async (size, name) => {
    const inner = Math.round(size * 0.74);
    const mark = await sharp(trimmed)
      .resize({ width: inner, height: inner, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: BRAND.cream } })
      .composite([{ input: mark, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT_PUBLIC, name));
    return `${name} ${size}x${size}`;
  };

  const squares = [
    await makeSquare(32, "favicon-32.png"),
    await makeSquare(180, "apple-touch-icon.png"),
    await makeSquare(192, "icon-192.png"),
    await makeSquare(512, "icon-512.png"),
  ];
  log(`  public icons  ${squares.join(", ")}`);

  // Brand photography for content sections (committed, so resize once here).
  await sharp(path.join(ASSETS, "HealThaali Banner.png"))
    .resize({ width: 1600, kernel: "lanczos3" })
    .jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(path.join(OUT_BRAND, "banner.jpg"));

  await sharp(path.join(ASSETS, "HealThaali Social Square.png"))
    .resize({ width: 900, kernel: "lanczos3" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(OUT_BRAND, "social-square.jpg"));

  log("  brand images  banner.jpg, social-square.jpg");
  return { trimmed };
}

/** A crisp vector favicon: the leaf from the monogram, on the brand green. */
async function faviconSvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="HealThaali">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND.green}"/>
      <stop offset="1" stop-color="${BRAND.greenDark}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="15" fill="url(#g)"/>
  <path d="M45.5 16.5C30.6 16.5 21 24.2 21 33.4a6.6 6.6 0 0 0 6.6 6.6c10.2 0 17.9-8.6 17.9-23.5Z" fill="#ffffff"/>
  <path d="M20.5 47.5 37 31" stroke="${BRAND.orange}" stroke-width="6" stroke-linecap="round" fill="none"/>
</svg>`;
  await writeFile(path.join(OUT_PUBLIC, "favicon.svg"), svg, "utf8");
  log("  favicon.svg   vector leaf mark");
}

/** 1200x630 Open Graph card built from the real mark, palette and a real screen. */
async function ogImage(trimmed) {
  const W = 1200;
  const H = 630;
  const FONT = "'Segoe UI', Arial, Helvetica, sans-serif";

  const backdrop = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND.cream}"/>
      <stop offset="1" stop-color="#f2f6ec"/>
    </linearGradient>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND.green}"/>
      <stop offset="1" stop-color="${BRAND.greenDark}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.78" cy="0.15" r="0.7">
      <stop offset="0" stop-color="${BRAND.orange}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${BRAND.orange}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${W}" height="10" fill="url(#band)"/>
  <text x="72" y="196" font-family="${FONT}" font-size="76" font-weight="700" fill="${BRAND.ink}" letter-spacing="-2">HealThaali</text>
  <text x="74" y="252" font-family="${FONT}" font-size="30" font-weight="600" fill="${BRAND.green}">Healthy Food. Happier You.</text>
  <text x="74" y="316" font-family="${FONT}" font-size="25" fill="#5e7267">Personalized meals, nutrition tracking and zero-oil</text>
  <text x="74" y="352" font-family="${FONT}" font-size="25" fill="#5e7267">Indian recipes — plan, log, cook and see your progress.</text>
  <rect x="72" y="404" width="196" height="52" rx="14" fill="${BRAND.green}"/>
  <text x="170" y="437" font-family="${FONT}" font-size="21" font-weight="600" fill="#ffffff" text-anchor="middle">Android + Web</text>
  <text x="288" y="437" font-family="${FONT}" font-size="21" font-weight="600" fill="${BRAND.orange}">healthaali.in</text>
  <text x="74" y="536" font-family="${FONT}" font-size="21" fill="#8a9a90">Zero-oil recipes · Weight loss · Healthy lifestyle · Better you</text>
</svg>`;

  const mark = await sharp(trimmed).resize({ width: 116 }).png().toBuffer();
  const phone = await sharp(BOARD)
    .extract({ left: 857, top: 134, width: 200, height: 360 })
    .resize({ width: 330, kernel: "lanczos3" })
    .sharpen({ sigma: 0.8 })
    .png()
    .toBuffer();

  await sharp({ create: { width: W, height: H, channels: 4, background: BRAND.cream } })
    .composite([
      { input: Buffer.from(backdrop), top: 0, left: 0 },
      { input: mark, top: 74, left: 986 },
      { input: phone, top: 176, left: 880 },
    ])
    .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(path.join(OUT_PUBLIC, "og-image.jpg"));

  log("  og-image.jpg  1200x630 social card");
}

async function main() {
  if (!existsSync(BOARD)) {
    console.error(
      `\nBrand kit not found at:\n  ${ASSETS}\n\n` +
        "This step reads the read-only asset drop next to the repository, which is\n" +
        "git-ignored. Re-run it from a checkout that still has ../asset/ in place,\n" +
        "or regenerate the committed images under src/assets by hand.\n"
    );
    process.exit(1);
  }

  log("\nExtracting HealThaali brand assets\n");
  await extractScreens();
  const { trimmed } = await brandMark();
  await faviconSvg();
  await ogImage(trimmed);
  log("\nDone.\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
