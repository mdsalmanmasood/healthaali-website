/**
 * HealThaali — page weight budget
 * ------------------------------
 *   npm run check:weight
 *
 * The Lighthouse table in the README is a periodic manual measurement, and that
 * is the right shape for a performance *score* — runner CPU makes scores flaky in
 * CI. Weight is different: it is deterministic, it is measured from the artefact
 * the build just produced, and it is the thing that actually regresses. A page
 * that quietly gains a second stylesheet or a charting library still scores well
 * on an idle laptop and still passes every other gate here; the only place it
 * shows up is in the bytes.
 *
 * So this gate watches bytes, not milliseconds.
 *
 * What it counts, per built page:
 *
 *   1. the page's own HTML,
 *   2. every same-origin `<link rel="stylesheet">` it loads,
 *   3. every same-origin `<script src>` and `<link rel="modulepreload">` it
 *      loads, since a preloaded module is downloaded either way,
 *   4. each distinct file once, no matter how many times a page references it —
 *      a shared stylesheet is not paid for twice by one visitor.
 *
 * What it deliberately does not count, and why:
 *
 *   - **Images and fonts.** They are content, not code: a hero photograph is a
 *     product decision, not a regression, and the link checker already proves
 *     every referenced asset exists in the build. Folding them in would make the
 *     budget a proxy for "did we add a picture", and a gate that cries wolf is a
 *     gate that gets raised.
 *   - **Third-party requests.** There are none by design — the CSP forbids them —
 *     and if one appeared, that is a CSP test's job, not a byte budget's.
 *
 * All sizes are gzipped, because that is what crosses the network, and gzip
 * rather than Brotli because it is the conservative bound: the edge will send
 * something smaller.
 *
 * Exit code 0 = every page inside budget, 1 = at least one page over it.
 */

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");

/* ── arguments ────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const numberOption = (name, fallback) => {
  const raw = option(name, "");
  const value = Number(raw);
  return raw !== "" && Number.isFinite(value) ? value : fallback;
};

const DIST = path.resolve(ROOT, option("--dist", "dist"));

/**
 * Budgets in KB (1024 bytes) of gzipped transfer.
 *
 * Measured on 30 September 2026, the heaviest page (`/recipes/`) was 13.7 KB of
 * HTML, 8.4 KB of CSS and 4.7 KB of JS — 26.8 KB in total. Each budget sits at
 * roughly double that, which is the point: ordinary edits pass, and a change
 * that *doubles* a category — a new dependency, a second stylesheet, a stray
 * client island — fails. Tighten these as the site settles; raise one only with
 * a reason, and put the reason here.
 */
const BUDGET = {
  js: numberOption("--js", 12),
  css: numberOption("--css", 20),
  total: numberOption("--total", 60),
};

/** How many of the heaviest pages to print. The full list only matters on failure. */
const HEADLINES = 8;

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

const kb = (bytes) => bytes / 1024;

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
 * The file a reference points at, or null when it is not ours to count.
 *
 * Query strings and fragments are stripped (the browser downloads the file, not
 * the query), and anything absolute or protocol-relative is skipped: it is
 * somebody else's bytes.
 */
function resolveReference(reference, pageFile) {
  if (!reference) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(reference) || reference.startsWith("//")) return null;

  const clean = reference.split("#")[0].split("?")[0];
  if (!clean) return null;

  const resolved = clean.startsWith("/")
    ? path.join(DIST, clean)
    : path.resolve(path.dirname(pageFile), clean);

  // Never measure something outside the build output.
  return resolved.startsWith(DIST) ? resolved : null;
}

/** Gzipped size of a file, cached: shared assets are measured once. */
const sizes = new Map();

async function gzipped(file) {
  if (sizes.has(file)) return sizes.get(file);

  const size = existsSync(file) ? gzipSync(await readFile(file)).length : null;
  sizes.set(file, size);
  return size;
}

/* ── measuring one page ───────────────────────────────────────────────────── */

const SCRIPT_TAG = /<script\b[^>]*>/gi;
const LINK_TAG = /<link\b[^>]*>/gi;

async function measure(pageFile) {
  const html = await readFile(pageFile, "utf8");

  const css = new Set();
  const js = new Set();

  for (const [tag] of html.matchAll(LINK_TAG)) {
    const rel = attribute(tag, "rel").toLowerCase();
    const href = attribute(tag, "href");
    const as = attribute(tag, "as").toLowerCase();

    if (rel === "stylesheet") css.add(href);
    else if (rel === "modulepreload" || (rel === "preload" && as === "script")) js.add(href);
  }

  for (const [tag] of html.matchAll(SCRIPT_TAG)) {
    if (attribute(tag, "src")) js.add(attribute(tag, "src"));
  }

  const missing = [];
  const sum = async (references) => {
    let bytes = 0;
    for (const reference of references) {
      const file = resolveReference(reference, pageFile);
      if (!file) continue;

      const size = await gzipped(file);
      if (size === null) missing.push(reference);
      else bytes += size;
    }
    return bytes;
  };

  const [cssBytes, jsBytes] = [await sum(css), await sum(js)];

  return {
    route: routeOf(pageFile),
    html: gzipSync(Buffer.from(html, "utf8")).length,
    css: cssBytes,
    js: jsBytes,
    missing,
    get total() {
      return this.html + this.css + this.js;
    },
  };
}

/* ── main ─────────────────────────────────────────────────────────────────── */

async function main() {
  if (!existsSync(DIST)) {
    console.error(
      `\n✗ Weight check failed — nothing built at ${path.relative(ROOT, DIST).split(path.sep).join("/")}.\n  Run \`npm run build\` first.\n`
    );
    process.exit(1);
  }

  const pages = (await walk(DIST)).filter((file) => file.endsWith(".html")).sort();
  if (pages.length === 0) {
    console.error(`\n✗ Weight check failed — no .html files in the build output.\n`);
    process.exit(1);
  }

  const measured = await Promise.all(pages.map(measure));
  const heaviest = [...measured].sort((a, b) => b.total - a.total);

  const line = (page) =>
    [
      page.route.padEnd(24),
      `${kb(page.html).toFixed(1)} KB`.padStart(9),
      `${kb(page.css).toFixed(1)} KB`.padStart(9),
      `${kb(page.js).toFixed(1)} KB`.padStart(9),
      `${kb(page.total).toFixed(1)} KB`.padStart(9),
    ].join(" ");

  console.log(
    `\n  Page weight — ${measured.length} page(s), gzipped, budgets ` +
      `js ${BUDGET.js} KB · css ${BUDGET.css} KB · total ${BUDGET.total} KB\n`
  );
  console.log(`  ${"page".padEnd(24)} ${"html".padStart(9)} ${"css".padStart(9)} ${"js".padStart(9)} ${"total".padStart(9)}`);
  for (const page of heaviest.slice(0, HEADLINES)) console.log(`  ${line(page)}`);
  if (heaviest.length > HEADLINES) {
    console.log(`  … ${heaviest.length - HEADLINES} lighter page(s) not shown`);
  }
  console.log("");

  const overBudget = [];
  for (const page of measured) {
    for (const metric of ["js", "css", "total"]) {
      if (kb(page[metric]) > BUDGET[metric]) {
        overBudget.push({ page, metric, size: kb(page[metric]), budget: BUDGET[metric] });
      }
    }
  }

  const broken = measured.filter((page) => page.missing.length > 0);

  if (broken.length > 0) {
    console.error(`✗ ${broken.length} page(s) reference files that are not in the build:\n`);
    for (const page of broken) {
      console.error(`  ${page.route}`);
      for (const reference of page.missing) console.error(`    ${reference}`);
    }
    console.error(
      `\n  The measurement above is an undercount, so this is a failure rather than a\n` +
        `  note. \`npm run check:links\` reports the same references as broken links.\n`
    );
  }

  if (overBudget.length > 0) {
    console.error(`✗ ${overBudget.length} budget breach(es):\n`);
    for (const { page, metric, size, budget } of overBudget.sort((a, b) => b.size - b.budget - (a.size - a.budget))) {
      console.error(
        `  ${page.route} — ${metric} is ${size.toFixed(1)} KB, budget ${budget} KB ` +
          `(over by ${(size - budget).toFixed(1)} KB)`
      );
    }
    console.error(
      `\n  Either bring the page back inside its budget, or raise the budget in\n` +
        `  scripts/check-weight.mjs in the same commit and say why there.\n`
    );
  }

  if (overBudget.length > 0 || broken.length > 0) {
    console.error(`✗ Weight check failed.\n`);
    process.exit(1);
  }

  console.log(
    `✓ Weight check passed — heaviest page is ${heaviest[0].route} at ` +
      `${kb(heaviest[0].total).toFixed(1)} KB gzipped (budget ${BUDGET.total} KB).\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
