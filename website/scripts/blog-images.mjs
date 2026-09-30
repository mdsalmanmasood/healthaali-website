/**
 * HealThaali — blog cover images
 * ------------------------------
 *   npm run blog:images                 convert what exists, report what does not
 *   npm run blog:images -- --prompts    (re)write src/assets/blog/PROMPTS.md
 *   npm run blog:images -- --force      re-encode even when already up to date
 *
 * Every post is written before its cover image exists. Rather than committing
 * placeholder art, this script waits for the real image:
 *
 *   INPUT  (read-only, not committed — see the root .gitignore)
 *     ../../asset/blog/<slug>.png       or .jpg / .jpeg / .webp / .avif
 *                                       `<slug>` is the post's file name
 *
 *   OUTPUT (committed)
 *     src/assets/blog/<slug>.webp       WebP, quality 75, resized to 1600 wide
 *     src/content/blog/<slug>.md        `cover:` and `coverAlt:` added for it
 *     src/assets/blog/PROMPTS.md        the image prompts (--prompts)
 *
 * Three things are deliberate:
 *
 *   1. **WebP at quality 75, always.** The format and the setting live here
 *      rather than in a note somebody has to remember. Astro re-encodes covers
 *      per size at build time, so what is committed is the master copy — and a
 *      master that is a 6 MB PNG is a repository problem, not a page problem.
 *   2. **A missing image is not a failure.** Until the artwork exists the post
 *      simply has no cover, which the blog already handles (the card renders
 *      without media, the post page without a hero image, and no `og:image`
 *      override). The exit code says so instead of pretending otherwise.
 *   3. **The alt text is written before the image is.** It lives next to the
 *      prompt in the manifest below, so the two are decided together and the
 *      frontmatter is never filled in with `coverAlt: ""` by hand. If the image
 *      you generate shows something different from the prompt, change the alt
 *      text here and re-run — the description has to match the picture.
 *
 * Exit code 0 = nothing unexpected happened, 1 = a conversion or patch failed.
 */

import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const SOURCE_DIR = path.resolve(root, "..", "asset", "blog");
const OUT_DIR = path.join(root, "src", "assets", "blog");
const CONTENT_DIR = path.join(root, "src", "content", "blog");
const PROMPTS_FILE = path.join(OUT_DIR, "PROMPTS.md");

/** Every cover is 16:9, because that is the card's aspect ratio. */
const WIDTH = 1600;
const QUALITY = 75;
const EXTENSIONS = ["png", "jpg", "jpeg", "webp", "avif"];

/**
 * One entry per post.
 *
 * `prompt` is written for any text-to-image model: subject first, then light,
 * composition and the exclusions. Every prompt ends with the same three
 * exclusions on purpose — a generated brand mark or a wall of gibberish text is
 * the failure mode that makes an image unusable on a page that also has to be
 * accessible and honest.
 *
 * `alt` describes what the image is *for*, in the terms a person who cannot see
 * it needs: the objects, the arrangement, and nothing about style or mood.
 */
const COVERS = [
  {
    slug: "how-much-protein-do-you-need-indian-diet",
    subject: "protein on an ordinary Indian plate",
    prompt:
      "Top-down photograph of a simple Indian meal on a cream linen cloth: a small steel katori of thick yellow dal, two soft whole-wheat rotis stacked to one side, a bowl of plain curd with a steel spoon, and two halved boiled eggs showing orange yolks. Soft natural window light from the left, warm neutral tones, gentle shadows, shallow depth of field, a few scattered cumin seeds on the cloth. Photographic, 50mm lens. No text, no logos, no packaging, no people.",
    alt: "A top-down view of dal in a steel katori, two rotis, a bowl of curd and two halved boiled eggs arranged on a cream cloth.",
  },
  {
    slug: "cooking-with-less-oil-tadka",
    subject: "a dry tempering in an iron kadai",
    prompt:
      "Photograph of a black cast-iron kadai on a dark kitchen counter, whole cumin seeds and two dried red chillies dry-roasting in it with no oil visible, a thin wisp of aromatic steam rising, a small steel bowl holding one teaspoon of mustard oil beside the pan. Warm directional light from the upper right, cream and deep-green cloth in the background, visible texture on the pan, droplets of water on the seeds. Photographic, 50mm lens, close and appetising. No text, no logos, no people, no hands.",
    alt: "Cumin seeds and dried red chillies dry-roasting in a black iron kadai, with a small bowl of mustard oil beside it.",
  },
  {
    slug: "how-to-build-a-balanced-thaali",
    subject: "four parts of a balanced thali",
    prompt:
      "A polished steel thali photographed at 45 degrees on cream cotton cloth, holding four clearly separate parts: a small katori of dal, a portion of steamed rice, a green vegetable sabzi, and a bowl of thick curd, with one folded roti at the edge of the plate. Even diffused daylight, fresh bright vegetables, no oil sheen, muted cream and terracotta background, everything in focus. Photographic, 35mm lens. No text, no logos, no people.",
    alt: "A steel thali holding separate portions of dal, rice, a green vegetable sabzi and curd, with a folded roti at the edge.",
  },
  {
    slug: "why-home-cooked-food-is-hard-to-track",
    subject: "a kitchen counter just after cooking",
    prompt:
      "Overhead photograph of an ordinary Indian home kitchen counter immediately after cooking: a half-finished katori of dal with a spoon resting in it, a stack of fresh rotis in a checked cloth, a small bowl of chopped onion with a lemon wedge, and a single steel teaspoon of oil catching the light. Warm late-afternoon light, lived-in and unstyled, cream and green cloth, faint steam over the dal. Photographic, 35mm lens. No text, no logos, no packaging, no people, no hands.",
    alt: "A kitchen counter after cooking: a half-finished katori of dal, a stack of rotis in a cloth, chopped onion with lemon, and one teaspoon of oil.",
  },
  {
    slug: "weight-loss-with-indian-food-without-banning-rice",
    subject: "a measured portion of rice, not a small one",
    prompt:
      "Photograph on a cream linen cloth of an Indian place setting: a generous bowl of steamed rice next to a katori of yellow dal, a plate of sliced cucumber, tomato and onion with a lemon wedge, and a second, much smaller empty bowl beside the first for comparison. Soft diffused daylight, clean and calm composition, warm neutral palette, slight steam rising from the rice. Photographic, 50mm lens, eye-level. No text, no logos, no scales, no measuring tape, no people.",
    alt: "A bowl of steamed rice beside a katori of dal and a plate of sliced salad vegetables on a cream cloth.",
  },
  {
    slug: "high-protein-meals-under-15-minutes",
    subject: "a ten-minute paneer pocket on the tawa",
    prompt:
      "Angled photograph of a dark flat tawa on a gas stove with two golden stuffed paneer pockets crisping on it, a small bowl of chopped coriander and a lemon wedge just behind the stove, a clean steel plate waiting beside it. Warm evening kitchen light from a window at the left, cream tiles, faint steam, oil barely visible. Photographic, 50mm lens, close and appetising. No text, no logos, no packaging, no people, no hands.",
    alt: "Two golden stuffed paneer pockets crisping on a dark flat tawa, with chopped coriander and a lemon wedge behind it.",
  },
  {
    slug: "how-much-protein-in-dal",
    subject: "the same dal, thick and thin, side by side",
    prompt:
      "Overhead photograph on cream linen of two identical steel katoris of toor dal: the left one thick enough to hold the shape of the spoon, the right one thin and watery, with a small steel bowl of dry yellow toor dal and a folded stack of two rotis beside them. Soft natural window light from the upper left, warm neutral tones, visible texture in the dal, a few cumin seeds on the cloth. Photographic, 50mm lens. No text, no logos, no packaging, no people, no hands.",
    alt: "Two steel katoris of the same dal, one thick and one thin, beside a bowl of dry toor dal and a stack of two rotis.",
  },
  {
    slug: "fibre-in-an-indian-diet",
    subject: "the parts of a plate that carry the fibre",
    prompt:
      "Top-down photograph on cream linen cloth of a katori of green sabzi, a katori of cooked rajma, a small bowl of raw cucumber, onion and tomato salad with a lemon wedge, one apple cut in half showing the skin, and a small steel bowl of peanuts. Bright diffused daylight, fresh vegetables, no oil sheen, muted cream and terracotta background, everything in focus. Photographic, 35mm lens. No text, no logos, no packaging, no people.",
    alt: "A katori of sabzi, a katori of rajma, a bowl of raw salad, a halved apple and a bowl of peanuts arranged on cream cloth.",
  },
  {
    slug: "sugar-in-an-ordinary-indian-day",
    subject: "one day's sugar, laid out on a tray",
    prompt:
      "Overhead photograph of a plain steel tray on a cream cloth holding an ordinary day's sugar: three small glasses of chai, a saucer with four plain biscuits, a small bowl of tomato ketchup with a spoon, a tall glass of orange juice, one piece of light-coloured mithai, and a small steel bowl of loose white sugar with a teaspoon in it. Soft even daylight, unstyled and lived-in, warm neutral palette. Photographic, 35mm lens. No text, no logos, no packaging, no brand marks, no people, no hands.",
    alt: "A steel tray holding three glasses of chai, four biscuits on a saucer, a bowl of ketchup, a glass of juice, a piece of mithai and a bowl of sugar.",
  },
  {
    slug: "soya-chunks-cheapest-protein",
    subject: "soya chunks before and after the soak",
    prompt:
      "Photograph on a cream cloth of two steel bowls side by side: the left holding dry, pale soya chunks, the right holding the same chunks after soaking, plump and drained, with a folded cotton kitchen towel and a small bowl of crushed black pepper beside them, and a dark kadai just behind. Cool diffused daylight from a window at the right, clean and calm composition, shallow depth of field, visible texture on the chunks. Photographic, 50mm lens. No text, no logos, no packaging, no people, no hands.",
    alt: "Two steel bowls side by side, one of dry soya chunks and one of soaked, drained chunks, with a cloth and a bowl of crushed pepper.",
  },
  {
    slug: "eating-out-without-losing-the-plan",
    subject: "a restaurant table ordered well",
    prompt:
      "Photograph at 45 degrees of an Indian restaurant table with a dark wooden top and white plates: a tandoori platter of chicken and paneer tikka with onion rings and lemon, a small bowl of dal, two rotis in a cloth, a bowl of raita, a glass of buttermilk, and a tall glass of water. Warm restaurant lighting from above, softly out-of-focus room behind, appetising and clean, no menu visible in frame. Photographic, 35mm lens. No text, no logos, no packaging, no people, no hands.",
    alt: "A restaurant table set with a tandoori platter, a bowl of dal, two rotis, raita, buttermilk and a glass of water.",
  },
  {
    slug: "protein-at-breakfast-indian-food",
    subject: "an Indian breakfast with the protein on the plate",
    prompt:
      "Overhead photograph on cream cloth of an Indian breakfast: a plate of poha with a small bowl of plain curd beside it, two boiled eggs halved to show the yolks, a small steel bowl of roasted peanuts, a steel tumbler of chai, and a lemon wedge. Bright morning light from a window at the left, unstyled family kitchen, warm cream and green palette, faint steam from the chai. Photographic, 35mm lens. No text, no logos, no packaging, no people, no hands.",
    alt: "A plate of poha with a bowl of curd, two halved boiled eggs, roasted peanuts and a tumbler of chai on cream cloth.",
  },
];

/* ── helpers ──────────────────────────────────────────────────────────────── */

const log = (message) => console.log(message);

/** A YAML-safe double-quoted scalar. Alt text often contains commas and colons. */
const yamlString = (value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** The source image for a post, whichever supported extension it was saved as. */
const findSource = (slug) => {
  for (const extension of EXTENSIONS) {
    const candidate = path.join(SOURCE_DIR, `${slug}.${extension}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
};

const isFresh = (source, output) =>
  existsSync(output) && statSync(output).mtimeMs >= statSync(source).mtimeMs;

/* ── the three things this script does ───────────────────────────────────── */

async function convert(entry, { force }) {
  const source = findSource(entry.slug);
  if (!source) return { state: "missing" };

  const output = path.join(OUT_DIR, `${entry.slug}.webp`);
  if (!force && isFresh(source, output)) return { state: "current", output };

  const { width: sourceWidth } = await sharp(source).metadata();

  await sharp(source)
    // Never upscale: a smaller source stays the size it is rather than being
    // stretched into a softer cover.
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(output);

  return {
    state: "converted",
    output,
    detail: `${sourceWidth ?? "?"}px -> ${Math.min(sourceWidth ?? WIDTH, WIDTH)}px`,
  };
}

/**
 * Add `cover:` and `coverAlt:` to the post's frontmatter, once, and only when
 * the image really exists.
 *
 * Deliberately not a general frontmatter editor: it inserts two lines before
 * the closing `---` of the block at the top of the file, and does nothing at all
 * if the post already declares a cover. Anything cleverer would eventually
 * rewrite a file a person had edited by hand.
 */
async function patchFrontmatter(entry) {
  const file = path.join(CONTENT_DIR, `${entry.slug}.md`);
  if (!existsSync(file)) return { state: "no-post" };

  const markdown = await readFile(file, "utf8");
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!block) return { state: "no-frontmatter" };
  if (/^cover:/m.test(block[1])) return { state: "already" };

  const insertAt = block.index + 4 + block[1].length;
  const addition = `\ncover: ${entry.slug}.webp\ncoverAlt: ${yamlString(entry.alt)}`;

  await writeFile(
    file,
    markdown.slice(0, insertAt) + addition + markdown.slice(insertAt),
    "utf8",
  );

  return { state: "patched" };
}

async function writePrompts() {
  const sections = COVERS.map(
    (entry, index) => `## ${index + 1}. ${entry.slug}

**Subject:** ${entry.subject}

**Prompt**

\`\`\`text
${entry.prompt}
\`\`\`

**Save the result as** \`asset/blog/${entry.slug}.png\` (any of .png, .jpg, .jpeg,
.webp or .avif — the name is what matters).

**Alt text** (already written for this image; adjust it if the picture differs)

\`\`\`text
${entry.alt}
\`\`\`
`,
  );

  const document = `# Blog cover images — generation prompts

${COVERS.length} covers, one for every post on this blog. Nothing here is
published yet: the posts ship without images, and each one gets a cover the
moment its file appears.

## How to use this

1. Generate an image from a prompt below with any text-to-image model.
2. Save it as \`asset/blog/<slug>.png\` — the folder next to the repository, which
   is git-ignored, using the post's file name as the file name.
3. Run \`npm run blog:images\`. It converts the file to WebP at quality 75,
   1600 px wide, writes it to \`src/assets/blog/\`, and adds \`cover:\` and
   \`coverAlt:\` to that post's frontmatter. Nothing else needs editing.
4. Run \`npm run verify\` — the accessibility, link and weight gates all run
   against pages that now have images.

## The rules these prompts follow

- **16:9, at least 1600 px wide.** That is the card's aspect ratio, so nothing
  is cropped in a way the photographer did not choose.
- **No text, no logos, no packaging.** The site has its own type and its own
  marks; a generated wordmark would be a second, wrong one, and generated text
  is unreadable at card size.
- **Natural light, real crockery, unstyled food.** The photography on the rest
  of the site is real cooking in a real kitchen, and a cover that looks like a
  stock library would be the odd one out.
- **Alt text first.** Each entry below has its description already written. If
  the image you end up using shows something else, change the alt text in
  \`scripts/blog-images.mjs\` and re-run the script — an alt text that does not
  match the picture is worse than no picture.

---

${sections.join("\n---\n\n")}`;

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(PROMPTS_FILE, document, "utf8");
  return PROMPTS_FILE;
}

/* ── main ─────────────────────────────────────────────────────────────────── */

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes("--force");

  if (argv.includes("--prompts")) {
    const file = await writePrompts();
    log(`\n✓ Wrote ${path.relative(root, file).split(path.sep).join("/")} (${COVERS.length} prompts)\n`);
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });

  log("\nBlog covers (WebP, quality 75, 1600px wide)\n");

  let converted = 0;
  let missing = 0;
  let patched = 0;

  for (const entry of COVERS) {
    const result = await convert(entry, { force });

    if (result.state === "missing") {
      missing += 1;
      log(`  ·  ${entry.slug} — no source yet, post ships without a cover`);
      continue;
    }

    if (result.state === "converted") {
      converted += 1;
      log(`  ✓  ${entry.slug}.webp — ${result.detail}`);
    } else {
      log(`  =  ${entry.slug}.webp — already up to date`);
    }

    const patch = await patchFrontmatter(entry);
    if (patch.state === "patched") {
      patched += 1;
      log(`     frontmatter: cover + coverAlt added to src/content/blog/${entry.slug}.md`);
    } else if (patch.state === "already") {
      log("     frontmatter: already declares a cover");
    } else {
      log(`     frontmatter: not edited (${patch.state})`);
    }
  }

  log(
    `\n${converted} converted, ${patched} post(s) updated, ${missing} awaiting artwork.\n` +
      (missing > 0
        ? `  Prompts for the missing ${missing}: src/assets/blog/PROMPTS.md\n` +
          `  (regenerate that file with: npm run blog:images -- --prompts)\n`
        : "") +
      "\n",
  );
}

main().catch((error) => {
  console.error(
    `\n✗ Blog cover conversion failed — ${error?.message ?? error}\n` +
      `  Nothing was changed for the images that had not been processed yet.\n`,
  );
  process.exit(1);
});
