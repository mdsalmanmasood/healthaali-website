/**
 * HealThaali — blog dating gate
 * -----------------------------
 *   npm run check:blog-dates
 *   npm run check:blog-dates -- --max-gap 3
 *
 * One rule: **a published post is never dated before a video it embeds.**
 *
 * A post here exists to explain cooking that has already been filmed, so
 * `publishedAt` follows the video out. That gives the archive a floor: a post
 * cannot be dated earlier than the newest video it shows, because it cannot
 * have explained a video that had not been uploaded yet. The floor is easy to
 * break by accident — re-date a post, or swap one embed for another, and the
 * page quietly claims to predate its own evidence. Nothing in a build would
 * notice: a date is a valid date whatever it says.
 *
 * The second thing checked is the lookup itself. An id that is not in
 * `src/data/recipes.json` has no upload date to compare against, so it fails
 * here rather than passing quietly — a typo in one `data-yt` would otherwise
 * take the whole rule out of play for that post. The snapshot merges by video
 * id and never drops an entry (see "The snapshot never shrinks on its own" in
 * README.md), so an id it does not know is an id that was never there.
 *
 * `--max-gap <days>` optionally enforces the other half of the convention: a
 * post is usually dated one or two days after its newest video, and a much
 * wider gap is worth a look — a re-date, or an embed that was meant to be the
 * anchor. It is off by default, because the size of the gap is an editorial
 * choice rather than an error, and the table prints it either way.
 *
 * Why this is a script and not a rule in `src/data/blog.ts`: same reasoning as
 * `scripts/check-blog-links.mjs`. That module fails a build and also runs in
 * `astro dev`, and a half-written draft should not be able to stop the dev
 * server. Drafts are skipped here for the same reason.
 *
 * It reads the Markdown and not `dist/`, so a post that breaks the rule is
 * named by the file that needs the edit.
 *
 * Exit code 0 = the rule holds, 1 = at least one post breaks it.
 */

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");

/* ── arguments ────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const POSTS_DIR = path.resolve(ROOT, option("--dir", path.join("src", "content", "blog")));
const RECIPES_FILE = path.resolve(ROOT, option("--recipes", path.join("src", "data", "recipes.json")));

const gapOption = option("--max-gap", "");
const MAX_GAP = gapOption === "" ? null : Number.parseInt(gapOption, 10);

if (MAX_GAP !== null && (!Number.isInteger(MAX_GAP) || MAX_GAP < 0)) {
  console.error(`\n✗ --max-gap must be a whole number of days, received "${gapOption}"\n`);
  process.exit(1);
}

/* ── the snapshot ─────────────────────────────────────────────────────────── */

const refuse = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

if (!existsSync(RECIPES_FILE)) {
  refuse(
    `No recipe snapshot at ${path.relative(ROOT, RECIPES_FILE).split(path.sep).join("/")}.\n` +
      "  Pass --recipes <path> if it lives somewhere else. Refusing to pass without\n" +
      "  it: every embed would look like an unknown video, and the rule this script\n" +
      "  exists for would go unchecked.",
  );
}

const snapshot = JSON.parse(await readFile(RECIPES_FILE, "utf8"));
const recipes = Array.isArray(snapshot.recipes) ? snapshot.recipes : [];

if (recipes.length === 0) {
  refuse(
    "The recipe snapshot holds no recipes.\n" +
      "  An empty snapshot would leave every embed undatable, so this is treated as\n" +
      "  a broken input rather than as a blog with nothing to check.",
  );
}

/**
 * A single day, at UTC midnight, so a timestamp and a date compare cleanly.
 * A value that does not parse is NaN, which is checked for below rather than
 * left to compare quietly as false against everything.
 */
const startOfDay = (value) => Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`);

const undatable = recipes.filter((recipe) => !Number.isFinite(startOfDay(recipe.published)));
if (undatable.length > 0) {
  refuse(
    `${undatable.length} recipe(s) in the snapshot have no usable published timestamp:\n` +
      undatable
        .map((recipe) => `    ${recipe.id} — published: ${JSON.stringify(recipe.published)}`)
        .join("\n") +
      "\n  Every rule here is a comparison against that timestamp, so a value that\n" +
      "  does not parse would let the check pass without checking anything.",
  );
}

/** Video id -> the snapshot entry, which carries the upload timestamp. */
const uploads = new Map(recipes.map((recipe) => [recipe.id, recipe]));

/* ── reading the posts ────────────────────────────────────────────────────── */

/** Frontmatter block at the top of the file, or null. */
const frontmatter = (markdown) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  return match ? match[1] : null;
};

/** The body, with the frontmatter removed. Only the body can contain an embed. */
const body = (markdown) => {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(markdown);
  return match ? markdown.slice(match[0].length) : markdown;
};

/**
 * A draft is not published, so the rule does not apply to it yet — and a draft
 * being re-dated while it is still being written is the normal state of a
 * draft.
 */
const isDraft = (markdown) => /^draft:\s*true\s*$/m.test(frontmatter(markdown) ?? "");

/** `publishedAt` as `YYYY-MM-DD`, or null if the frontmatter has no date. */
const publishedOn = (markdown) => {
  const match = /^publishedAt:\s*["']?(\d{4}-\d{2}-\d{2})/m.exec(frontmatter(markdown) ?? "");
  return match ? match[1] : null;
};

/**
 * Every video id the body declares, in the order it declares them.
 *
 * Deliberately thin. Whether the `<figure class="yt-embed">` around an id is
 * well formed — a title, a caption, a fallback link, a valid 11-character id —
 * is `parseVideos`' job in `src/data/blog.ts`, at build time. All this needs is
 * which videos the post claims to show, because those are the dates the post
 * has to sit after.
 */
const embedIds = (markdown) =>
  [...(body(markdown) ?? "").matchAll(/data-yt="([^"]*)"/g)].map((match) => match[1].trim());

const posts = [];

async function readPosts() {
  const relative = path.relative(ROOT, POSTS_DIR).split(path.sep).join("/");

  if (!existsSync(POSTS_DIR)) {
    refuse(
      `No blog directory at ${relative}.\n` +
        "  Pass --dir <path> if the posts live somewhere else. Refusing to pass on a\n" +
        "  directory that does not exist: an empty scan would look identical to a blog\n" +
        "  whose dates are all fine.",
    );
  }

  const files = (await readdir(POSTS_DIR)).filter((name) => /\.mdx?$/.test(name)).sort();

  if (files.length === 0) {
    refuse(
      `${relative} contains no Markdown files.\n` +
        "  Either the posts live somewhere else (pass --dir) or something moved them\n" +
        "  without this script being told.",
    );
  }

  for (const file of files) {
    const markdown = await readFile(path.join(POSTS_DIR, file), "utf8");
    if (isDraft(markdown)) continue;

    const date = publishedOn(markdown);
    const ids = [...new Set(embedIds(markdown))];
    const dated = ids.map((id) => ({ id, recipe: uploads.get(id) }));
    const known = dated.filter((entry) => entry.recipe);

    // The newest embed is the floor: the post has to be dated after the last of
    // the videos it shows, not merely after the first one.
    const newest = known.reduce(
      (latest, entry) =>
        !latest || startOfDay(entry.recipe.published) > startOfDay(latest.recipe.published)
          ? entry
          : latest,
      undefined,
    );

    posts.push({
      file,
      slug: file.replace(/\.mdx?$/, ""),
      date,
      embeds: ids.length,
      unknown: dated.filter((entry) => !entry.recipe).map((entry) => entry.id),
      newest,
      gap:
        newest && date
          ? Math.round((startOfDay(date) - startOfDay(newest.recipe.published)) / 86_400_000)
          : null,
    });
  }

  if (posts.length === 0) {
    console.log(
      `\n  ${files.length} file(s) in ${relative}, all drafts — there is nothing published to check.\n`,
    );
    process.exit(0);
  }
}

await readPosts();

/* ── the rules ────────────────────────────────────────────────────────────── */

const undated = posts.filter((post) => !post.date);
const unknownIds = posts.filter((post) => post.unknown.length > 0);
const tooEarly = posts.filter((post) => post.gap !== null && post.gap < 0);
const tooWide = posts.filter((post) => post.gap !== null && MAX_GAP !== null && post.gap > MAX_GAP);

/* ── report ───────────────────────────────────────────────────────────────── */

const width = Math.min(48, Math.max(...posts.map((post) => post.slug.length), "post".length));

console.log(
  `\n  Blog dates — ${posts.length} published post(s) against ${recipes.length} video(s)` +
    (MAX_GAP === null ? "" : `, ceiling of ${MAX_GAP} day(s)`) +
    "\n",
);
console.log(`  ${"post".padEnd(width)}  posted      newest embed  gap`);
console.log(`  ${"-".repeat(width)}  ----------  ------------  ----`);

for (const post of [...posts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))) {
  const gap = post.gap === null ? "  --" : `${post.gap > 0 ? "+" : ""}${post.gap}`.padStart(4);
  const newest = post.newest ? startOfDay(post.newest.recipe.published) : null;
  const embed = newest === null ? "none" : new Date(newest).toISOString().slice(0, 10);
  const flag = post.unknown.length > 0 ? "   <- video not in the snapshot" : "";

  console.log(
    `  ${post.slug.padEnd(width)}  ${String(post.date ?? "(no date)").padEnd(10)}  ` +
      `${embed.padEnd(12)}  ${gap}${flag}`,
  );
}

let failed = false;

if (undated.length > 0) {
  failed = true;
  console.error(`\n✗ ${undated.length} post(s) have no publishedAt:\n`);
  for (const post of undated) console.error(`  ${post.file}`);
  console.error(
    "\n  The date is what the blog sorts, links and feeds by, so a post without one\n" +
      "  is not a post yet. See src/content.config.ts for the frontmatter shape.\n",
  );
}

if (unknownIds.length > 0) {
  failed = true;
  console.error(`\n✗ ${unknownIds.length} post(s) embed a video that is not in the recipe snapshot:\n`);
  for (const post of unknownIds) {
    console.error(`  ${post.file} — ${post.unknown.map((id) => `data-yt="${id}"`).join(", ")}`);
  }
  console.error(
    `\n  Without an entry in ${path.relative(ROOT, RECIPES_FILE).split(path.sep).join("/")} there is no\n` +
      "  upload date to compare the post against, so this rule cannot be checked for\n" +
      "  that embed. The snapshot merges by video id and never removes an entry, so\n" +
      "  an id it does not know was never in the feed: check it for a typo.\n",
  );
}

if (tooEarly.length > 0) {
  failed = true;
  console.error(`\n✗ ${tooEarly.length} post(s) are dated before a video they embed:\n`);
  for (const post of tooEarly) {
    const recipe = post.newest.recipe;
    console.error(
      `  ${post.file} — publishedAt ${post.date}, but it embeds ${recipe.id}\n` +
        `      uploaded ${String(recipe.published).slice(0, 10)} ("${recipe.title}"),\n` +
        `      which is ${Math.abs(post.gap)} day(s) later.`,
    );
  }
  console.error(
    "\n  A post explains cooking that has already been filmed, so it cannot be dated\n" +
      "  before the newest video it shows. Move the date forward — the convention here\n" +
      "  is the following day or the one after.\n",
  );
}

if (tooWide.length > 0) {
  failed = true;
  console.error(`\n✗ ${tooWide.length} post(s) are dated more than ${MAX_GAP} day(s) after their newest video:\n`);
  for (const post of tooWide) {
    console.error(
      `  ${post.file} — ${post.gap} day(s) after ${post.newest.recipe.id} ` +
        `(${String(post.newest.recipe.published).slice(0, 10)})`,
    );
  }
  console.error(
    "\n  Either the date drifted or the wrong video is the anchor. Raise --max-gap if\n" +
      "  the distance is what you meant.\n",
  );
}

if (failed) {
  console.error("");
  process.exit(1);
}

const gaps = posts.filter((post) => post.gap !== null).map((post) => post.gap);
const widest = gaps.length > 0 ? Math.max(...gaps) : 0;
const undatedEmbeds = posts.filter((post) => post.embeds === 0).length;

console.log(
  `\n✓ Blog date check passed — every post is dated on or after the newest video it\n` +
    `  embeds (${gaps.length} post(s) with a video${undatedEmbeds > 0 ? `, ${undatedEmbeds} with none` : ""}, ` +
    `widest gap +${widest} day(s)).\n`,
);
