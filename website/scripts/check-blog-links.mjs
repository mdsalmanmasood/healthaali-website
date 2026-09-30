/**
 * HealThaali — blog internal-linking gate
 * ---------------------------------------
 *   npm run check:blog-links
 *   npm run check:blog-links -- --min 3
 *
 * Two rules, both about the links *between* posts:
 *
 *   1. **Every published post links to at least `--min` (default 2) others.**
 *      A post that links nowhere is a page a reader reaches once and leaves.
 *      Two is the floor rather than the goal — the posts here usually carry
 *      three to five — but a floor is what a gate can enforce.
 *   2. **Every published post is linked from at least one other.** A post with
 *      no inbound links is reachable only from the blog index and the tags,
 *      which is the definition of an orphan.
 *
 * Why this is a script and not a rule in `src/data/blog.ts`: that module fails
 * a build, and the same module runs in `astro dev`. A writer half-way through a
 * draft with one link in it would be unable to run the dev server. This gate
 * runs where the other gates run — in CI, against the sources — and reports the
 * whole graph rather than the first failure, which is the thing a person
 * actually needs when the answer is "add a link somewhere".
 *
 * It reads the Markdown, not `dist/`, for two reasons: the rule is about what a
 * writer wrote, and a broken cross-link should be reported against the file that
 * contains it rather than against a built page that happens to include it.
 * Whether a link *resolves* is already `npm run check:links`' job, on the built
 * site; this catches a link to a slug that does not exist at authoring time,
 * which is a different failure with a different fix.
 *
 * Deliberately not counted as "another post": `/blog` itself, `/blog/tag/…`,
 * `/blog/author/…` and `/blog/rss.xml`. Those are generated pages, and linking
 * to a topic page is not the same as linking to a post a reader can read next.
 *
 * Exit code 0 = both rules hold, 1 = at least one post breaks one of them.
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
const MIN_OUTBOUND = Number.parseInt(option("--min", "2"), 10);

if (!Number.isInteger(MIN_OUTBOUND) || MIN_OUTBOUND < 1) {
  console.error(`\n✗ --min must be a positive whole number, received "${option("--min", "")}"\n`);
  process.exit(1);
}

/* ── reading the posts ────────────────────────────────────────────────────── */

/** Frontmatter block at the top of the file, or null. */
const frontmatter = (markdown) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  return match ? match[1] : null;
};

/** The body, with the frontmatter removed. Only the body can contain a link. */
const body = (markdown) => {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(markdown);
  return match ? markdown.slice(match[0].length) : markdown;
};

/**
 * A draft is not published, so neither rule applies to it — a half-written post
 * with no links yet is the normal state of a half-written post.
 */
const isDraft = (markdown) => /^draft:\s*true\s*$/m.test(frontmatter(markdown) ?? "");

/**
 * Markdown links to another post: `](/blog/<slug>)`, with or without the
 * trailing slash the site also serves. The negative lookahead keeps the
 * generated routes (`/blog/tag/…`, `/blog/author/…`) and the feed out of the
 * count, and `/blog` with no slug is the index rather than a post.
 */
const POST_LINK = /\]\(\/blog\/(?!tag\/|author\/)([a-z0-9-]+)\/?\)/gi;

const posts = [];

async function readPosts() {
  const relative = path.relative(ROOT, POSTS_DIR).split(path.sep).join("/");

  if (!existsSync(POSTS_DIR)) {
    console.error(
      `\n✗ No blog directory at ${relative}.\n` +
        `  Pass --dir <path> if the posts live somewhere else.\n\n` +
        "  Refusing to pass on a directory that does not exist: an empty scan\n" +
        "  would look identical to a blog whose links are all fine.\n",
    );
    process.exit(1);
  }

  const files = (await readdir(POSTS_DIR)).filter((name) => /\.mdx?$/.test(name)).sort();

  if (files.length === 0) {
    console.error(
      `\n✗ ${relative} contains no Markdown files.\n` +
        "  Either the posts live somewhere else (pass --dir) or something moved\n" +
        "  them without this script being told.\n",
    );
    process.exit(1);
  }

  for (const file of files) {
    const markdown = await readFile(path.join(POSTS_DIR, file), "utf8");
    if (isDraft(markdown)) continue;

    const slug = file.replace(/\.mdx?$/, "");
    const targets = [...body(markdown).matchAll(POST_LINK)].map((match) => match[1].toLowerCase());

    posts.push({ file, slug, targets: [...new Set(targets)] });
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

const slugSet = new Set(posts.map((post) => post.slug));

/** Links to a slug no post has. Almost always a typo, and always a 404. */
const dangling = posts.flatMap((post) =>
  post.targets.filter((target) => !slugSet.has(target)).map((target) => ({ from: post, target })),
);

/** Every post, with how many *other* posts it points at. */
const outbound = posts.map((post) => ({
  post,
  links: post.targets.filter((target) => slugSet.has(target) && target !== post.slug),
}));

/** Inbound links, counted per post. Self-links are ignored on both sides. */
const inbound = new Map(posts.map((post) => [post.slug, []]));
for (const { post, links } of outbound) {
  for (const target of links) inbound.get(target).push(post.slug);
}

const tooFew = outbound.filter((entry) => entry.links.length < MIN_OUTBOUND);
const orphans = posts.filter((post) => inbound.get(post.slug).length === 0);

/* ── report ───────────────────────────────────────────────────────────────── */

const width = Math.min(
  56,
  Math.max(...posts.map((post) => post.slug.length), "post".length),
);

console.log(
  `\n  Blog internal links — ${posts.length} published post(s), floor of ${MIN_OUTBOUND} per post\n`,
);
console.log(`  ${"post".padEnd(width)}  out  in`);
console.log(`  ${"-".repeat(width)}  ---  --`);

for (const { post, links } of [...outbound].sort((a, b) => a.links.length - b.links.length)) {
  const count = inbound.get(post.slug).length;
  const flag = links.length < MIN_OUTBOUND ? "   <- below the floor" : "";
  console.log(
    `  ${post.slug.padEnd(width)}  ${String(links.length).padStart(3)}  ${String(count).padStart(2)}${flag}`,
  );
}

let failed = false;

if (dangling.length > 0) {
  failed = true;
  console.error(`\n✗ ${dangling.length} link(s) point at a post that does not exist:\n`);
  for (const { from, target } of dangling) {
    console.error(`  ${from.file} -> /blog/${target}`);
  }
  console.error(`\n  The available slugs are: ${[...slugSet].sort().join(", ")}\n`);
}

if (tooFew.length > 0) {
  failed = true;
  console.error(`\n✗ ${tooFew.length} post(s) link to fewer than ${MIN_OUTBOUND} other posts:\n`);
  for (const { post, links } of tooFew) {
    console.error(
      `  ${post.file} — ${links.length} link(s) to other posts` +
        (links.length > 0 ? `: ${links.join(", ")}` : ""),
    );
  }
  console.error(
    "\n  A post earns its place by what it leads to next. Link it to the posts it\n" +
      "  continues, or that continue it.\n",
  );
}

if (orphans.length > 0) {
  failed = true;
  console.error(`\n✗ ${orphans.length} post(s) are not linked from any other post:\n`);
  for (const post of orphans) {
    console.error(`  ${post.file}`);
  }
  console.error(
    "\n  Nothing but the blog index points at them. Add the link where it belongs —\n" +
      "  an edit to one older post is the usual fix, not a change to this one.\n",
  );
}

if (failed) {
  console.error("");
  process.exit(1);
}

const links = outbound.reduce((total, entry) => total + entry.links.length, 0);
const average = (links / posts.length).toFixed(1);

console.log(
  `\n✓ Blog link check passed — every post links to at least ${MIN_OUTBOUND} others ` +
    `(${links} links, ${average} per post) and no post is an orphan.\n`,
);
