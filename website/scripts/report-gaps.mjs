/**
 * HealThaali — editorial gap report
 * --------------------------------
 *   npm run report:gaps
 *   npm run report:gaps -- --limit 60
 *   npm run report:gaps -- --dist dist
 *
 * An editor's question, answered from the repository: *what should the site
 * write next?* Two answers, because there are two ways for the library to have
 * a hole in it:
 *
 *   1. **Phrases the channel already publishes that no post answers.** The
 *      channel's own words are the corpus: the title of every video in
 *      `src/data/recipes.json` plus the hashtags in its description. A phrase
 *      counts as answered when it appears *anywhere* in a published post —
 *      title, description, tags or body — which is the generous reading, so a
 *      phrase that survives as a gap is one no post touches at all. Each
 *      finding then says whether any post at least *shows* the video, because
 *      "a post never names this" and "a post has never carried this" are
 *      different jobs.
 *   2. **Which hubs are thinnest.** Every built page that carries a
 *      `CollectionPage` with an `ItemList` is a hub; its dishes come from the
 *      `VideoObject`s it lists and its posts from the `BlogPosting`s. The counts
 *      are read from `dist/` rather than re-derived, so this report cannot
 *      drift from the rules in `src/data/topics.ts` — whatever the build
 *      produced is what is measured, and the build already fails on a hub with
 *      nothing on it.
 *
 * A few smaller findings fall out of the same data and are reported beside
 * them: dishes whose titles match no hub rule, tags no hub is not built on (read
 * as: the tag's posts are exactly some other set), posts filed under no hub, and
 * videos no post embeds.
 *
 * This script owns the report, the command line and the hub reading. The phrase
 * rules themselves live in `scripts/lib/editorial-gaps.mjs`, because the
 * scheduled recipe sync asks the same question about a video the channel has
 * just published (`npm run recipes` → the pull request it opens) and two copies
 * of these rules would eventually disagree about the same video.
 *
 * Where this is deliberately narrow
 * ---------------------------------
 *   - **Titles and hashtags, not descriptions.** A video's description is mostly
 *     prose repeated from the title plus a soup of hashtags; scanning all of it
 *     would let "healthy" and "recipe" arrive as findings. Hashtags are included
 *     because a hashtag is a label the publisher chose; the title is included
 *     because it is a claim in the publisher's own voice — the same argument
 *     `src/data/topics.ts` makes for matching on titles.
 *   - **Exact phrases, not synonyms.** "Chana" and "chickpea" are the same food
 *     and different strings; this report cannot know that, and it does not try.
 *     A plural is tolerated (see `wordRegex`), nothing else is.
 *   - **A phrase finding does not always mean a post is missing.** It can also
 *     mean a post covers the subject and never says so — two of the findings on
 *     1 October 2026 were the channel's own labels for subjects the library
 *     already carried. Only a person can tell which, which is why this is a
 *     report and not a to-do list.
 *   - **It ranks by evidence, not by opportunity.** A phrase published by six
 *     videos is not thereby worth a post; it is only better evidenced than one
 *     published by a single video. Search volume, competition and the app's
 *     roadmap are not in this repository.
 *   - **It changes nothing.** No files are written, no network is used.
 *
 * Exit code 0 = a report was produced, however thin the library is. This is a
 * report, not a gate: it is not in `npm run verify` and no CI job runs it, so an
 * empty phrase list is a finding rather than a failure. Exit 1 only when the
 * sources it reads are missing or empty, because then the report would be
 * silence where a finding belongs.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { embedsByVideo, findGaps, readPosts } from "./lib/editorial-gaps.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");

/* ── arguments ────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const REPO = path.resolve(ROOT, "..");
const relativeTo = (file) => path.relative(REPO, file).split(path.sep).join("/");

const RECIPES_FILE = path.resolve(ROOT, option("--recipes", path.join("src", "data", "recipes.json")));
const POSTS_DIR = path.resolve(ROOT, option("--posts", path.join("src", "content", "blog")));
const DIST = path.resolve(ROOT, option("--dist", "dist"));

/** Most phrase findings to print. `--limit` raises it; the count is never hidden. */
const LIMIT = Math.max(1, Number.parseInt(option("--limit", "30"), 10) || 30);

/** How many publishing videos to name before "… N more". */
const SUPPORTS = 3;

const fail = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

/* ── the snapshot ─────────────────────────────────────────────────────────── */

async function readRecipes() {
  if (!existsSync(RECIPES_FILE)) {
    fail(
      `No recipe snapshot at ${relativeTo(RECIPES_FILE)}.\n` +
        "  Run `npm run recipes` to build one from the channel's feed.",
    );
  }

  const snapshot = JSON.parse(await readFile(RECIPES_FILE, "utf8"));
  const recipes = Array.isArray(snapshot) ? snapshot : snapshot.recipes;

  if (!Array.isArray(recipes) || recipes.length === 0) {
    fail(
      `${relativeTo(RECIPES_FILE)} holds no recipes.\n` +
        "  An empty snapshot would make every phrase below a gap for no reason.",
    );
  }

  return { recipes, updatedAt: snapshot.updatedAt ?? "" };
}

/* ── hubs, read from the build ────────────────────────────────────────────── */

async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

/** `features/index.html` reads as `/features/`, `index.html` as `/`. */
function routeOf(file) {
  const relative = path.relative(DIST, file).split(path.sep).join("/");
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) return `/${relative.slice(0, -"index.html".length)}`;
  return `/${relative}`;
}

const nodesIn = (html) => {
  const nodes = [];
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(json);
      nodes.push(...(parsed["@graph"] ?? [parsed]));
    } catch {
      /* check:seo reports unparseable JSON-LD; here it just means no data. */
    }
  }
  return nodes;
};

/**
 * Every hub the build produced, from its own markup.
 *
 * A hub is a page carrying a `CollectionPage` whose `mainEntity` is an
 * `ItemList` — the shape `TopicPage.astro` emits. Blog tag pages declare their
 * posts as `hasPart` instead, and `/recipes/` is a bare `ItemList`, so neither
 * is mistaken for one. The human name comes from the page's `BreadcrumbList`
 * (Home → the topic), so it is the same label a visitor reads.
 */
async function readHubs() {
  const built = existsSync(path.join(DIST, "index.html"))
    ? (await stat(path.join(DIST, "index.html"))).mtime
    : null;
  if (built === null) return { built: null, hubs: [] };

  const files = (await walk(DIST)).filter((file) => file.endsWith(".html")).sort();
  const hubs = [];

  for (const file of files) {
    const html = await readFile(file, "utf8");
    const nodes = nodesIn(html);
    const collection = nodes.find(
      (node) => node["@type"] === "CollectionPage" && node.mainEntity?.itemListElement,
    );
    if (!collection) continue;

    const crumbs = nodes.find((node) => node["@type"] === "BreadcrumbList")?.itemListElement ?? [];
    const label = crumbs.length > 0 ? crumbs[crumbs.length - 1].name : collection.name ?? "";

    const items = collection.mainEntity.itemListElement.map((entry) => entry.item ?? {});
    const dishIds = [];
    const postSlugs = [];

    for (const item of items) {
      const pathname = new URL(item.url).pathname.replace(/\/$/, "");
      if (item["@type"] === "VideoObject") dishIds.push(pathname.replace("/recipes/", ""));
      else postSlugs.push(pathname.replace("/blog/", ""));
    }

    hubs.push({
      route: routeOf(file),
      label,
      dishIds,
      postSlugs,
      /* Only the posts' dates: the newest *piece of writing* is what an editor
         can add to, and every dish's uploadDate is already in the snapshot. */
      postDates: items
        .filter((item) => item["@type"] === "BlogPosting" && item.datePublished)
        .map((item) => String(item.datePublished).slice(0, 10)),
    });
  }

  return { built, hubs };
}

/* ── small helpers for the report ─────────────────────────────────────────── */

const truncate = (text, limit) =>
  text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;

const dateOf = (value) => (value ? String(value).slice(0, 10) : "—");

/** "3 posts" / "1 post" — a count with its noun. */
const countOf = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** "Dishes" / "Dish" — a bare label, for a heading that carries its own count. */
const label = (count, one, many = `${one}s`) => (count === 1 ? one : many);

/* ── main ─────────────────────────────────────────────────────────────────── */

async function main() {
  const { recipes, updatedAt } = await readRecipes();

  let posts;
  try {
    /* The library resolves paths from the website root, the same way every
       other message in this repository names a file. */
    posts = await readPosts(POSTS_DIR, { root: ROOT });
  } catch (error) {
    fail(error.message);
  }

  const { built, hubs } = await readHubs();

  const { published, gaps } = findGaps({ recipes, posts });

  /* How many posts show each video — the difference between "no post names
     this" and "no post has this at all". */
  const embeds = embedsByVideo(posts);
  const unembedded = recipes.filter((recipe) => !embeds.has(recipe.id));

  const summary = [
    countOf(recipes.length, "video"),
    countOf(posts.length, "published post"),
    hubs.length > 0 ? countOf(hubs.length, "hub") : null,
  ].filter(Boolean);

  console.log(`\n  Editorial gaps — ${summary.join(", ")}`);
  console.log(
    `  snapshot ${dateOf(updatedAt)}` +
      (built ? ` · hub counts read from dist/ (built ${built.toISOString().slice(0, 16).replace("T", " ")})` : " · no build found, hub findings skipped"),
  );
  console.log("");

  /* ── 1. phrases the channel publishes that no post answers ──────────────── */

  console.log(`  Phrases with no post behind them — ${gaps.length} of ${published} published phrase(s)`);
  console.log("");

  if (gaps.length === 0) {
    console.log("    None. Every phrase in the video titles and hashtags appears somewhere in a post.");
    console.log("");
  }

  for (const gap of gaps.slice(0, LIMIT)) {
    console.log(`    ${String(gap.ids.length).padStart(2)}×  ${gap.phrase}`);

    for (const id of gap.ids.slice(0, SUPPORTS)) {
      const recipe = recipes.find((entry) => entry.id === id);
      const on = hubs.filter((hub) => hub.dishIds.includes(id)).map((hub) => hub.label);
      const shown = embeds.get(id) ?? 0;
      const notes = [
        on.length > 0 ? `[${on.join(", ")}]` : null,
        /* The phrase is not in any post's words; say whether the video itself
           is at least on a post, because those are different jobs to do. */
        shown > 0 ? `shown in ${countOf(shown, "post")}` : "no post shows it",
      ].filter(Boolean);

      console.log(
        `         ${id}  ${dateOf(recipe?.published)}  ${truncate(recipe?.title ?? "", 58)}` +
          `  · ${notes.join(" · ")}`,
      );
    }

    if (gap.ids.length > SUPPORTS) {
      console.log(`         … and ${countOf(gap.ids.length - SUPPORTS, "more video")}`);
    }
  }

  if (gaps.length > LIMIT) {
    console.log(`    … ${gaps.length - LIMIT} more — raise --limit to see them`);
  }
  console.log("");

  /* ── 2. hubs, thinnest first ────────────────────────────────────────────── */

  if (hubs.length > 0) {
    const ordered = [...hubs].sort(
      (a, b) => a.dishIds.length + a.postSlugs.length - (b.dishIds.length + b.postSlugs.length),
    );

    const routeWidth = Math.max(...ordered.map((hub) => hub.route.length));
    const column = { entries: 7, dishes: 6, posts: 5 };

    console.log("  Hubs, thinnest first");
    console.log("");
    console.log(
      `    ${"hub".padEnd(routeWidth)}  ${"entries".padStart(column.entries)}  ` +
        `${"dishes".padStart(column.dishes)}  ${"posts".padStart(column.posts)}  newest post  label`,
    );

    for (const hub of ordered) {
      const entries = hub.dishIds.length + hub.postSlugs.length;
      console.log(
        `    ${hub.route.padEnd(routeWidth)}  ${String(entries).padStart(column.entries)}  ` +
          `${String(hub.dishIds.length).padStart(column.dishes)}  ` +
          `${String(hub.postSlugs.length).padStart(column.posts)}  ` +
          `${hub.postDates.sort().at(-1) ?? "—"}  ${hub.label}`,
      );
    }

    const thinnest = ordered[0];
    const fewestPosts = [...ordered].sort((a, b) => a.postSlugs.length - b.postSlugs.length)[0];
    console.log("");
    console.log(
      `    Thinnest: ${thinnest.route} — ${thinnest.dishIds.length} dishes + ${thinnest.postSlugs.length} posts.` +
        (fewestPosts === thinnest
          ? ` It also has the fewest posts.`
          : ` Fewest posts: ${fewestPosts.route} — ${countOf(fewestPosts.postSlugs.length, "post")} ` +
            `to its ${countOf(fewestPosts.dishIds.length, "dish", "dishes")}.`),
    );
    console.log("");

    /* Dishes whose titles match no hub rule at all. */
    const claimed = new Set(hubs.flatMap((hub) => hub.dishIds));
    const unclaimed = recipes.filter((recipe) => !claimed.has(recipe.id));
    if (unclaimed.length > 0) {
      console.log(
        `  ${label(unclaimed.length, "Dish", "Dishes")} no hub claims (${unclaimed.length}) — ` +
          `${unclaimed.length === 1 ? "its title matches" : "their titles match"} no rule in src/data/topics.ts`,
      );
      for (const recipe of unclaimed) {
        console.log(`    ${dateOf(recipe.published)}  ${recipe.id}  ${truncate(recipe.title, 70)}`);
      }
      console.log("");
    }

    /* Tags, against the hubs built on them. A tag is claimed when the posts
       carrying it are exactly the posts some hub lists. */
    const hubPostSets = hubs.map((hub) => [...hub.postSlugs].sort().join(","));
    const byTag = new Map();
    for (const post of posts) {
      for (const tag of post.tags) {
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag).push(post.slug);
      }
    }
    const unclaimedTags = [...byTag]
      .filter(([, slugs]) => !hubPostSets.includes([...slugs].sort().join(",")))
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

    if (unclaimedTags.length > 0) {
      console.log(
        `  ${label(unclaimedTags.length, "Tag", "Tags")} no hub is built on (${unclaimedTags.length})`,
      );
      for (const [tag, slugs] of unclaimedTags) {
        console.log(`    ${tag.padEnd(16)} ${countOf(slugs.length, "post")}`);
      }
      console.log("");
    }

    /* Posts filed under no hub tag. */
    const hubPosts = new Set(hubs.flatMap((hub) => hub.postSlugs));
    const unhubbed = posts.filter((post) => !hubPosts.has(post.slug));
    if (unhubbed.length > 0) {
      console.log(`  Posts filed under no hub (${unhubbed.length})`);
      for (const post of unhubbed) {
        console.log(`    ${dateOf(post.publishedAt)}  ${post.slug}  [${post.tags.join(", ")}]`);
      }
      console.log("");
    }
  } else {
    console.log("  Hubs — skipped: no build found at dist/.");
    console.log("    Run `npm run build` first; the counts come from the pages the build produced, not from a re-derivation of the rules.");
    console.log("");
  }

  /* ── 3. videos no post embeds ───────────────────────────────────────────── */

  console.log(`  Videos no post embeds (${unembedded.length} of ${recipes.length})`);
  console.log("");
  if (unembedded.length === 0) {
    console.log("    None. Every video appears in at least one post.");
  } else {
    for (const recipe of unembedded) {
      console.log(`    ${dateOf(recipe.published)}  ${recipe.id}  ${truncate(recipe.title, 70)}`);
    }
  }
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
