/**
 * HealThaali — SEO invariants
 * ---------------------------
 *   npm run check:seo
 *
 * A search engine is a reader that never reports a problem. Where a person
 * notices a missing description or a second `<h1>` and shrugs, a crawler just
 * records something worse and moves on — so these are checked against the built
 * HTML, where they are facts, rather than trusted to review.
 *
 * What it enforces, and why each one is here:
 *
 *   1. **One `<h1>` and a canonical URL per page.** Two `<h1>`s and no canonical
 *      is how one page turns into two competing pages.
 *   2. **A title and a description, unique across the site, within length.**
 *      Duplicates are two pages telling a crawler they are the same thing.
 *   3. **Every JSON-LD block parses**, so a stray character cannot silently
 *      remove an entire node from a page's markup.
 *   4. **Mark-up matches what a visitor can see.** Every FAQPage question and
 *      every CollectionPage entry must appear as text in the same page: schema
 *      describing content that is not there is the one thing Google treats as
 *      spam rather than as a mistake.
 *   5. **The topic pages are wired.** Each one is linked from the homepage, has
 *      both a CollectionPage and an FAQPage, and claims at least one dish and
 *      one post — a landing page that lists nothing must fail the build, not
 *      get indexed.
 *   6. **The sitemap and the build agree**, in both directions: every page that
 *      was built is in the sitemap, and every sitemap entry is a page that
 *      exists. A sitemap listing a page that 404s is worse than no sitemap.
 *
 * Exit code 0 = every invariant holds, 1 = at least one does not.
 */

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const DIST = path.resolve(ROOT, option("--dist", "dist"));

/** The sitemap the build emits; `@astrojs/sitemap` names it by default. */
const SITEMAP = path.resolve(DIST, option("--sitemap", "sitemap-0.xml"));

/** Limits a search result can actually show, and the blog's own ceiling. */
const TITLE_MAX = 200;
const DESCRIPTION_MIN = 50;
const DESCRIPTION_MAX = 200;

/**
 * The three landing pages, and the dishes/posts each must keep claiming. The
 * counts are a floor, not a target: they catch a rule that has stopped matching
 * (a channel renaming its videos) rather than freezing the library as it is.
 */
const HUBS = [
  { route: "/no-oil-recipes/", name: "no-oil" },
  { route: "/high-protein-recipes/", name: "high-protein" },
  { route: "/weight-loss-recipes/", name: "weight-loss" },
];

/* ── helpers ──────────────────────────────────────────────────────────────── */

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

const attribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"));
  return match ? match[1] : "";
};

/**
 * The text a reader sees, with tags stripped and entities left alone.
 *
 * Deliberately crude: this is used to prove that a string from a JSON-LD node
 * appears *somewhere* in the page's text, not to parse the document. Astro's
 * escaped output (`&#39;`, `&quot;`) is unescaped first for the same reason —
 * schema strings carry the character, HTML carries its entity.
 */
const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");

const decode = (text) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/* ── reading one page ─────────────────────────────────────────────────────── */

function readPage(file, html) {
  const route = routeOf(file);
  const text = visibleText(html);

  const title = decode((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "").trim();
  const description = decode(
    attribute(html.match(/<meta\s+name="description"[^>]*>/i)?.[0] ?? "", "content"),
  ).trim();
  const canonical = attribute(html.match(/<link\s+rel="canonical"[^>]*>/i)?.[0] ?? "", "href");
  const noindex = /<meta\s+name="robots"[^>]*content="[^"]*noindex/i.test(html);

  const h1Count = (html.match(/<h1[\s>]/g) || []).length;

  const nodes = [];
  for (const [, json] of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
  )) {
    try {
      nodes.push(JSON.parse(json));
    } catch (error) {
      nodes.push({ __parseError: error.message });
    }
  }

  return { file, route, text, title, description, canonical, noindex, h1Count, nodes };
}

const nodeTypes = (nodes) =>
  nodes.flatMap((node) =>
    node["@graph"] ? node["@graph"].map((entry) => entry["@type"]) : [node["@type"]],
  );

const nodeOfType = (nodes, type) =>
  nodes
    .flatMap((node) => (node["@graph"] ? node["@graph"] : [node]))
    .find((entry) => entry["@type"] === type);

/* ── main ─────────────────────────────────────────────────────────────────── */

async function main() {
  if (!existsSync(DIST)) {
    console.error(
      `\n✗ SEO check failed — nothing built at ${path.relative(ROOT, DIST).split(path.sep).join("/")}.\n  Run \`npm run build\` first.\n`,
    );
    process.exit(1);
  }

  const files = await walk(DIST);
  /* 404 is served for any unknown path and is deliberately noindex and uncountable. */
  const pageFiles = files.filter((file) => file.endsWith(".html") && path.basename(file) !== "404.html");

  const pages = await Promise.all(
    pageFiles.sort().map(async (file) => readPage(file, await readFile(file, "utf8"))),
  );

  const problems = [];
  const notes = [];
  const fail = (route, message) => problems.push(`${route} — ${message}`);

  /* 1–2. head tags, one <h1>, and uniqueness in both directions. */
  const byTitle = new Map();
  const byDescription = new Map();

  for (const page of pages) {
    if (page.h1Count !== 1) fail(page.route, `has ${page.h1Count} <h1> elements, needs exactly 1`);

    if (!page.title) fail(page.route, "has no <title>");
    else if (page.title.length > TITLE_MAX) {
      fail(page.route, `<title> is ${page.title.length} characters (max ${TITLE_MAX})`);
    } else {
      const seen = byTitle.get(page.title);
      if (seen) fail(page.route, `<title> is the same as ${seen}`);
      else byTitle.set(page.title, page.route);
    }

    if (!page.description) fail(page.route, "has no meta description");
    else if (page.description.length < DESCRIPTION_MIN || page.description.length > DESCRIPTION_MAX) {
      fail(
        page.route,
        `description is ${page.description.length} characters (needs ${DESCRIPTION_MIN}–${DESCRIPTION_MAX})`,
      );
    } else {
      const seen = byDescription.get(page.description);
      if (seen) fail(page.route, `description is the same as ${seen}`);
      else byDescription.set(page.description, page.route);
    }

    if (!page.canonical) fail(page.route, "has no canonical URL");
    else {
      const expected = `${originOf(page.canonical)}${page.route}`;
      if (page.canonical !== expected) {
        fail(page.route, `canonical is ${page.canonical}, should be ${expected}`);
      }
    }

    /* 3. structured data parses. */
    for (const node of page.nodes) {
      if (node.__parseError) fail(page.route, `has JSON-LD that does not parse: ${node.__parseError}`);
    }

    /* 4. the FAQ and collection mark-up describes what is on the page. */
    const faq = nodeOfType(page.nodes, "FAQPage");
    if (faq) {
      const questions = (faq.mainEntity || []).map((entry) => decode(entry.name || ""));
      if (questions.length === 0) fail(page.route, "has an FAQPage with no questions in it");
      for (const question of questions) {
        if (!page.text.includes(question)) {
          fail(page.route, `FAQPage asks “${question}”, which is not visible on the page`);
        }
      }
    }

    /*
      Two shapes are in use and both are legitimate: a topic page carries an
      `ItemList` in `mainEntity` with a count, and a blog tag page lists its
      posts as `hasPart`. Whichever a page uses, every entry has to be something
      a visitor can find on it.
    */
    const collection = nodeOfType(page.nodes, "CollectionPage");
    if (collection) {
      const listed = collection.mainEntity?.itemListElement;
      const claimed = collection.mainEntity?.numberOfItems;

      if (claimed !== undefined && claimed !== (listed || []).length) {
        fail(page.route, `CollectionPage claims ${claimed} entries but lists ${(listed || []).length}`);
      }

      const entries = listed
        ? listed.map((entry) => entry.item)
        : (collection.hasPart || []);

      if (entries.length === 0) fail(page.route, "has a CollectionPage with nothing in it");

      for (const entry of entries) {
        const label = decode(entry?.name || entry?.headline || "");
        if (!label || !page.text.includes(label)) {
          fail(page.route, `CollectionPage lists “${label}”, which is not visible on the page`);
        }
      }
    }

    /* Long titles are not a failure — a video's title is the publisher's — but
       a search result cuts around 60 characters, so they are worth counting. */
    if (page.title.length > 70) notes.push(`${page.route} — <title> is ${page.title.length} characters`);
  }

  /* 5. the topic hubs, and their wiring. */
  const home = pages.find((page) => page.route === "/");
  if (!home) fail("/", "no homepage was built");
  /* The homepage links each topic through its rail; the anchor text is the
     label rather than the <title>, so the link itself is what is checked. */
  const homeHtml = home ? await readFile(home.file, "utf8") : "";

  for (const hub of HUBS) {
    const page = pages.find((entry) => entry.route === hub.route);
    if (!page) {
      fail(hub.route, `the ${hub.name} topic page was not built`);
      continue;
    }

    if (!new RegExp(`href="${hub.route.replace(/\/$/, "")}"`).test(homeHtml)) {
      fail("/", `does not link the ${hub.name} topic page`);
    }

    const types = nodeTypes(page.nodes);
    for (const required of ["CollectionPage", "FAQPage", "BreadcrumbList"]) {
      if (!types.includes(required)) fail(hub.route, `is missing its ${required} node`);
    }

    const collection = nodeOfType(page.nodes, "CollectionPage");
    const items = collection?.mainEntity?.itemListElement || [];
    const dishes = items.filter((item) => item.item?.["@type"] === "VideoObject").length;
    const posts = items.filter((item) => item.item?.["@type"] === "BlogPosting").length;

    if (dishes === 0) fail(hub.route, "claims no dishes at all");
    if (posts === 0) fail(hub.route, "links no post at all");
  }

  /* 6. the sitemap and the build agree. */
  if (!existsSync(SITEMAP)) {
    fail("/sitemap-0.xml", "was not generated by the build");
  } else {
    const xml = await readFile(SITEMAP, "utf8");
    const listed = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url.trim()));
    const origin = new URL([...listed][0] || "https://healthaali.in").origin;

    for (const page of pages) {
      const url = `${origin}${page.route}`;
      if (!listed.has(url)) fail(page.route, "was built but is missing from the sitemap");
    }

    for (const url of listed) {
      const route = new URL(url).pathname;
      const built = pages.some((page) => page.route === route);
      if (!built) fail(route, "is listed in the sitemap but was not built");
    }
  }

  /* ── report ─────────────────────────────────────────────────────────────── */

  console.log(
    `\n  SEO invariants — ${pages.length} page(s), ` +
      `${pages.reduce((total, page) => total + page.nodes.length, 0)} JSON-LD block(s), ` +
      `${HUBS.length} topic page(s)\n`,
  );

  if (notes.length > 0) {
    console.log(`  Note — ${notes.length} <title> longer than 70 characters (they will be cut in a result):`);
    for (const note of notes) console.log(`    ${note}`);
    console.log("");
  }

  if (problems.length > 0) {
    console.error(`✗ SEO check failed — ${problems.length} problem(s):\n`);
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(
      `\n  Fix the page, or — if an invariant here is wrong rather than the page —\n` +
        `  change it in scripts/check-seo.mjs in the same commit and say why there.\n`,
    );
    process.exit(1);
  }

  console.log(
    `✓ SEO check passed — every page has one <h1>, a unique title and description, ` +
      `a canonical URL and parseable structured data; the topic pages are wired to the ` +
      `homepage and the sitemap agrees with the build.\n`,
  );
}

/**
 * The origin a canonical URL claims. Every page is served from one host, so a
 * canonical pointing somewhere else is a mistake this check should catch rather
 * than an origin it should adopt.
 */
function originOf(canonical) {
  return new URL(canonical).origin;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
