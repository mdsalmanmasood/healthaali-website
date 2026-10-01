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
 * them: dishes whose titles match no hub rule, tags no hub is built on (read as:
 * the tag's posts are exactly some other set), posts filed under no hub, and
 * videos no post embeds.
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

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");

/* ── arguments ────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const RECIPES_FILE = path.resolve(ROOT, option("--recipes", path.join("src", "data", "recipes.json")));
const POSTS_DIR = path.resolve(ROOT, option("--posts", path.join("src", "content", "blog")));
const DIST = path.resolve(ROOT, option("--dist", "dist"));

/** Most phrase findings to print. `--limit` raises it; the count is never hidden. */
const LIMIT = Math.max(1, Number.parseInt(option("--limit", "30"), 10) || 30);

/** How many publishing videos to name before "… N more". */
const SUPPORTS = 3;

/* ── the two word lists ───────────────────────────────────────────────────── */

/**
 * Grammar, not subject: one of these anywhere in a phrase disqualifies it,
 * because "lunch under 500" is a sentence fragment rather than a subject.
 */
const STOP = new Set(
  (
    "a an the is are was were be been being am of in on at to for with and or but if then than " +
    "that this these those it its as by from up out so we you your our their his her they them i " +
    "u no not too very can could should would will just about into over after before under while " +
    "when what which who how why do does did done get got there here all any each other some more " +
    "most only also even own same such than like vs versus between every without plus"
  ).split(" "),
);

/**
 * Words that describe a video rather than a subject: "easy recipes" is about
 * nothing, "crispy" is about a photograph, and "foodshorts" is about a
 * platform. A phrase carries weight only if every word in it is outside this
 * set — which is what keeps boilerplate and adjectives out of the findings.
 */
const NO_SUBJECT = new Set(
  (
    "recipe recipes short shorts video videos youtube subscribe reel reels healthy health healthaali " +
    "food foodshorts easy quick simple minute minutes min best perfect tasty yummy delicious " +
    "homemade watch like share comment link app download free today full new crispy juicy special " +
    "nutrition healthyfood healthyrecipes south indianstyle style pretty keeps approved ideas " +
    "inspiration journey heal thaali vibes anymore"
  ).split(" "),
);

/**
 * One word of a phrase, in a shape that tolerates a plural.
 *
 * "prawns" and "prawn", "eggs" and "egg", "tomatoes" and "tomato" are the same
 * subject; a report that treated them as different findings would be wrong on
 * every other line. So a trailing "s" or "es" is dropped before matching and
 * both forms are accepted back. Nothing else is normalised — see the header.
 */
const stem = (word) => (word.length > 4 ? word.replace(/(?:es|s)$/, "") : word);
const wordRegex = (word) => stem(word).replace(/[^a-z0-9]/g, "") + "(?:s|es)?";

/* ── reading the sources ──────────────────────────────────────────────────── */

/** Frontmatter block at the top of a post, or "". */
const frontmatter = (markdown) => /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1] ?? "";

/** The body, with the frontmatter removed. */
const body = (markdown) =>
  markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

/**
 * The text a reader actually reads, with the markup that is not text removed.
 *
 * `<[^>]*>` drops `data-yt-title="…"` along with every other attribute and tag,
 * while keeping what sits between tags — a figcaption is prose and counts. Link
 * destinations go too: `](…)` is markup, the words in the link are not.
 */
const proseOf = (markdown) =>
  markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1 ")
    .replace(/[|*_`#>~]/g, " ");


/** One frontmatter value, unquoted. Values here are single-line by contract. */
const field = (fm, name) =>
  (fm.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1] ?? "").trim().replace(/^["']|["']$/g, "");

/** `tags: ["High protein", "Indian food"]` — the quoted strings, in order. */
const tagsOf = (fm) => [...(field(fm, "tags").matchAll(/"([^"]*)"/g))].map(([, tag]) => tag);

async function readRecipes() {
  if (!existsSync(RECIPES_FILE)) {
    console.error(
      `\n✗ No recipe snapshot at ${path.relative(ROOT, RECIPES_FILE).split(path.sep).join("/")}.\n` +
        "  Run `npm run recipes` to build one from the channel's feed.\n",
    );
    process.exit(1);
  }

  const snapshot = JSON.parse(await readFile(RECIPES_FILE, "utf8"));
  const recipes = Array.isArray(snapshot) ? snapshot : snapshot.recipes;

  if (!Array.isArray(recipes) || recipes.length === 0) {
    console.error(
      `\n✗ ${path.relative(ROOT, RECIPES_FILE).split(path.sep).join("/")} holds no recipes.\n` +
        "  An empty snapshot would make every phrase below a gap for no reason.\n",
    );
    process.exit(1);
  }

  return { recipes, updatedAt: snapshot.updatedAt ?? "" };
}

async function readPosts() {
  const relative = path.relative(ROOT, POSTS_DIR).split(path.sep).join("/");

  if (!existsSync(POSTS_DIR)) {
    console.error(`\n✗ No blog directory at ${relative}. Pass --posts <path> if it moved.\n`);
    process.exit(1);
  }

  const files = (await readdir(POSTS_DIR)).filter((name) => /\.mdx?$/.test(name)).sort();
  const posts = [];

  for (const file of files) {
    const markdown = await readFile(path.join(POSTS_DIR, file), "utf8");
    const fm = frontmatter(markdown);

    /* Same rule as check:blog-links — a draft is not published, so it cannot
       answer a phrase. */
    if (/^draft:\s*true\s*$/m.test(fm)) continue;

    posts.push({
      file,
      slug: file.replace(/\.mdx?$/, ""),
      title: field(fm, "title"),
      description: field(fm, "description"),
      tags: tagsOf(fm),
      publishedAt: field(fm, "publishedAt"),
      /* The prose a reader sees: tags and link destinations are stripped, so a
         video's title buried in a data-yt-title attribute cannot answer the
         phrase its own video publishes. */
      prose: proseOf(body(markdown)),
      /* Whether a post shows the video, which is the hard half of "behind it". */
      embeds: new Set([...markdown.matchAll(/data-yt="([A-Za-z0-9_-]{11})"/g)].map(([, id]) => id)),
    });
  }

  if (posts.length === 0) {
    console.error(`\n✗ ${relative} holds no published posts, so every phrase would read as a gap.\n`);
    process.exit(1);
  }

  return posts;
}

/* ── phrases ──────────────────────────────────────────────────────────────── */

/** camelCase and PascalCase → separate words, so "#WeightLossRecipes" splits. */
const splitCamel = (text) => text.replace(/([a-z0-9])([A-Z])/g, "$1 $2");

const wordsOf = (text) =>
  splitCamel(text)
    /* A word and a count glued together ("under500") are two words; a count and
       its unit ("40g") are one, which is why only this direction is split. */
    .replace(/([a-z])(\d)/gi, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * A title's clauses, not its punctuation.
 *
 * "Crispy Fish Fry 🐟🔥 | Easy & Healthy Recipe| 5 minutes recipe| zero oil" is
 * four subjects, and the trigram "recipe zero oil" is not one of them. Splitting
 * on the separators a title actually uses (|, ·, dashes, sentence punctuation)
 * before taking n-grams is what stops phrases from straddling clauses.
 */
const segmentsOf = (text) =>
  text
    .split(/[|·•]|[.!?:;]|\s[–—]\s|\s-\s/g)
    .map(wordsOf)
    .filter((segment) => segment.length > 0);

/**
 * Is this run of words something a post could be about?
 *
 * Every word has to carry weight: one stopword or non-subject word anywhere
 * disqualifies the phrase. "tacos for weight" is a caption, not a subject, and
 * "5 minute high" is what is left of "5-Minute High Protein Breakfast" once its
 * middle word is a duration. A bare number is a quantity rather than a subject —
 * "500 calories" is not something to write a post about, while "40g protein"
 * is, because the unit is attached to the number.
 */
const isContent = (gram) =>
  gram.every(
    (word) => !STOP.has(word) && !NO_SUBJECT.has(word) && !/^\d+$/.test(word),
  );

/**
 * Every 2- and 3-word phrase inside one clause, with where each one starts.
 *
 * The windows overlap by construction — "banana leaf", "banana leaf fry" and
 * "leaf fry" all come out of one clause — so all of them are collected here and
 * narrowed later, once it is known which ones a post already contains.
 */
function candidates(clause) {
  const found = [];
  for (let size = 2; size <= 3; size += 1) {
    for (let start = 0; start + size <= clause.length; start += 1) {
      const gram = clause.slice(start, start + size);
      if (isContent(gram)) found.push({ phrase: gram.join(" "), start, size });
    }
  }
  return found;
}

/** The candidates in a clause that no longer candidate from it contains. */
const maximal = (candidates) =>
  candidates.filter(
    (entry) =>
      !candidates.some((other) => other !== entry && ` ${other.phrase} `.includes(` ${entry.phrase} `)),
  );

/**
 * Every phrase the channel publishes, mapped to the videos that publish it,
 * plus the clauses those phrases came from.
 *
 * Titles contribute their clauses. Descriptions contribute their hashtags, with
 * one extra allowance: a one-word hashtag counts when the video's own prose
 * uses that word too ("#Mackerel" beside a sentence about mackerel is a label
 * for a subject; "#Shorts" is not). Hashtags that are words glued without case
 * changes — "#weightlossrecipes" — cannot be split, and are left alone rather
 * than guessed at.
 *
 * The clauses come back because they are what decides which of several
 * overlapping phrases is the finding, and that can only be known after the
 * posts have been read.
 */
function collectPhrases(recipes) {
  const phrases = new Map();
  const clausesByVideo = [];

  const add = (phrase, id) => {
    if (!phrases.has(phrase)) phrases.set(phrase, new Set());
    phrases.get(phrase).add(id);
  };

  for (const recipe of recipes) {
    const clauses = segmentsOf(recipe.title ?? "");

    const description = recipe.description ?? "";
    /* The description without its hashtags, for the one-word allowance. */
    const prose = new Set(wordsOf(description.replace(/#[A-Za-z0-9_]+/g, " ")));

    for (const [, tag] of description.matchAll(/#([A-Za-z][A-Za-z0-9_]*)/g)) {
      const words = wordsOf(tag);

      if (words.length === 1) {
        if (words[0].length >= 4 && prose.has(words[0])) add(words[0], recipe.id);
        continue;
      }

      clauses.push(words);
    }

    clausesByVideo.push({ id: recipe.id, clauses });

    for (const clause of clauses) {
      for (const entry of maximal(candidates(clause))) add(entry.phrase, recipe.id);
    }
  }

  return { phrases, clausesByVideo };
}

/**
 * The pattern a phrase has to appear as, in the whole post corpus.
 *
 * Words are allowed to touch anything that is not a letter or digit between
 * them, because a post writes "high-protein" and a hashtag writes "HighProtein".
 */
const phraseRegex = (phrase) =>
  new RegExp(
    `(?:^|[^a-z0-9])${phrase
      .split(" ")
      .map(wordRegex)
      .join("[^a-z0-9]+")}(?:[^a-z0-9]|$)`,
  );

/**
 * Phrases no post contains — one per clause, then one per finding.
 *
 * Within a clause the windows overlap, so the clause reports its *rightmost*
 * uncovered phrase: the end of a noun phrase is its head, and "banana leaf fry"
 * says more about a dish than "high protein bangda" from the same title. The
 * other windows in that clause are ways of naming the same subject, and drop.
 *
 * Across clauses, a phrase contained in a longer phrase published by the same
 * videos is dropped for the same reason — "banana leaf fish" and "banana leaf
 * fry" are one hole, not two. Phrases with *different* video sets stay: two
 * separate holes, however similar the words.
 */
function phraseGaps({ phrases, clausesByVideo }, posts, recipes) {
  const corpus = posts
    .map((post) => [post.title, post.description, post.tags.join(" "), post.prose].join("\n"))
    .join("\n")
    .toLowerCase();

  const gaps = [...phrases]
    .filter(([phrase]) => !phraseRegex(phrase).test(corpus))
    .map(([phrase, ids]) => ({ phrase, ids: [...ids] }));
  const gapPhrases = new Set(gaps.map((gap) => gap.phrase));

  /* The one phrase a clause reports, and the windows it speaks for. */
  const shadowed = new Set();
  for (const { clauses } of clausesByVideo) {
    for (const clause of clauses) {
      const open = maximal(candidates(clause)).filter((entry) => gapPhrases.has(entry.phrase));
      if (open.length === 0) continue;

      const chosen = [...open].sort(
        (a, b) => b.start - a.start || b.size - a.size || a.phrase.localeCompare(b.phrase),
      )[0];

      /* Every window in the clause names the same subject, so the others speak
         for nothing once one is reported. */
      for (const entry of open) if (entry !== chosen) shadowed.add(entry.phrase);
    }
  }

  /* The newest video publishing a phrase, so two single-video findings are
     ordered by how recently the channel said them. */
  const newestOf = (ids) =>
    ids.map((id) => recipes.find((recipe) => recipe.id === id)?.published ?? "").sort().at(-1) ?? "";

  const sorted = gaps
    .filter((gap) => !shadowed.has(gap.phrase))
    .sort(
      (a, b) =>
        b.ids.length - a.ids.length ||
        newestOf(b.ids).localeCompare(newestOf(a.ids)) ||
        b.phrase.length - a.phrase.length ||
        a.phrase.localeCompare(b.phrase),
    );

  const wordsOfPhrase = (phrase) => new Set(phrase.split(" "));
  const kept = [];
  for (const gap of sorted) {
    const duplicate = kept.some((other) => {
      /* Every video publishing this phrase also publishes the other one. */
      if (!gap.ids.every((id) => other.ids.includes(id))) return false;
      /* A phrase inside a longer one from the same videos is the rarer finding
         written less completely. */
      if (` ${other.phrase} `.includes(` ${gap.phrase} `)) return true;
      /* So is a phrase sharing two words with one from the same videos. */
      const shared = [...wordsOfPhrase(gap.phrase)].filter((word) =>
        wordsOfPhrase(other.phrase).has(word),
      );
      return shared.length >= 2;
    });
    if (!duplicate) kept.push(gap);
  }

  return { published: phrases.size, gaps: kept };
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
  const posts = await readPosts();
  const { built, hubs } = await readHubs();

  const { published, gaps } = phraseGaps(collectPhrases(recipes), posts, recipes);

  /* How many posts show each video — the difference between "no post names
     this" and "no post has this at all". */
  const embedsByVideo = new Map();
  for (const post of posts) {
    for (const id of post.embeds) embedsByVideo.set(id, (embedsByVideo.get(id) ?? 0) + 1);
  }
  const unembedded = recipes.filter((recipe) => !embedsByVideo.has(recipe.id));

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
      const shown = embedsByVideo.get(id) ?? 0;
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
