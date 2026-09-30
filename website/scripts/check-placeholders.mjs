/**
 * HealThaali — placeholder-scaffolding guard
 * ------------------------------------------
 *   npm run check:placeholders
 *
 * The `/privacy` and `/terms` pages were written first as drafts, with a
 * "Pre-launch draft" banner and `[square-bracket]` notes everywhere a fact had
 * not been supplied (the legal entity, the registered address, retention
 * periods, sub-processors, backup windows …). They have since been replaced
 * with real, operator-supplied details, and no bracketed note is left.
 *
 * Nothing stopped that scaffolding from coming back, though. A new policy
 * section, a hurried edit, or a merge that resurrects an old draft would ship
 * `[confirm provider and regions]` to a visitor, and no existing gate would
 * notice: brackets are valid text, so the typecheck, the link checker and the
 * accessibility audit all pass. This script is the missing gate.
 *
 * Scope, and why it is what it is:
 *
 *   1. It runs against the *built* output (`dist/`), like the link and a11y
 *      gates, so it inspects what a visitor actually receives rather than what
 *      the source hopes to render. A placeholder hidden behind a conditional
 *      that happens to be false does not exist, and is not reported.
 *   2. It scans **every** built page, not only the two legal ones. The rule is
 *      "no bracketed scaffolding in anything we publish", and the extra pages
 *      cost nothing to check.
 *   3. It scans visible text *and* attribute values, so `alt="[chart]"` or
 *      `aria-label="[todo]"` cannot slip through either.
 *   4. `<script>`, `<style>` and HTML comments are removed first, because those
 *      three legitimately contain square brackets: JSON-LD arrays, CSS
 *      attribute selectors such as `[data-theme-toggle]`, and the bundled
 *      theme/menu scripts. Only markup a reader can see is judged.
 *   5. Bracket characters written as HTML entities (`&#91;`, `&lbrack;`, …)
 *      are decoded before scanning, so a placeholder cannot hide behind
 *      escaping.
 *   6. The two legal pages must be present in the build. If a refactor silently
 *      drops the routes, an empty scan would otherwise look like a pass.
 *
 * There is deliberately no opt-out comment. A legitimate `[1]` citation, or any
 * other real square bracket, would therefore fail this gate — and that is the
 * point: at the moment no page needs one, so the convention is "square brackets
 * mean unfinished". If that ever changes, change this script in the same commit
 * and say why, rather than adding a silent bypass.
 *
 * Exit code 0 = clean, 1 = at least one bracketed placeholder.
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

const DIST = path.resolve(ROOT, option("--dist", "dist"));

/* ── rules ────────────────────────────────────────────────────────────────── */

/**
 * Routes that must be in the build. Astro emits `/privacy` as
 * `privacy/index.html`; the `.html` form is accepted too so a change to
 * `trailingSlash` cannot turn this guard into a false alarm.
 */
const REQUIRED_PAGES = ["privacy", "terms"];

/** A bracketed run, on a single line, short enough to be a human's note. */
const PLACEHOLDER = /\[[^\]\n]{1,120}\]/g;

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

/**
 * Blank out the three places where `[` and `]` are legitimate, keeping the
 * surrounding markup so offsets stay meaningful. Replacing with a space (not
 * an empty string) prevents two tokens either side of a removed block from
 * being glued into one.
 */
const stripNonVisible = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

/** Decode the character references that could smuggle a bracket past the scan. */
const decodeBracketEntities = (value) =>
  value
    .replace(/&#x5b;|&#91;|&lbrack;/gi, "[")
    .replace(/&#x5d;|&#93;|&rbrack;/gi, "]");

/** A little readable context around a hit, for the error message. */
const contextAround = (markup, index, length) => {
  const from = Math.max(0, index - 45);
  const to = Math.min(markup.length, index + length + 45);
  const start = index > from ? "…" : "";
  const end = to < markup.length ? "…" : "";
  return `${start}${markup.slice(from, to).replace(/\s+/g, " ").trim()}${end}`;
};

const relative = (file) => path.relative(ROOT, file).split(path.sep).join("/");

/* ── main ─────────────────────────────────────────────────────────────────── */

async function main() {
  if (!existsSync(DIST)) {
    console.error(
      `\n✗ Placeholder check failed — nothing built at ${relative(DIST)}.\n  Run \`npm run build\` first.\n`
    );
    process.exit(1);
  }

  const pages = (await walk(DIST)).filter((file) => file.endsWith(".html")).sort();

  const missing = REQUIRED_PAGES.filter(
    (route) =>
      !existsSync(path.join(DIST, route, "index.html")) &&
      !existsSync(path.join(DIST, `${route}.html`))
  );
  if (missing.length > 0) {
    console.error(
      `\n✗ Placeholder check failed — required page(s) missing from the build:\n` +
        missing.map((route) => `  ${route}`).join("\n") +
        `\n  These pages must exist for this gate to mean anything.\n`
    );
    process.exit(1);
  }

  if (pages.length === 0) {
    console.error(`\n✗ Placeholder check failed — no .html files in ${relative(DIST)}.\n`);
    process.exit(1);
  }

  const findings = [];
  for (const file of pages) {
    const markup = decodeBracketEntities(stripNonVisible(await readFile(file, "utf8")));
    for (const match of markup.matchAll(PLACEHOLDER)) {
      findings.push({
        file: relative(file),
        text: match[0],
        context: contextAround(markup, match.index, match[0].length),
      });
    }
  }

  if (findings.length > 0) {
    console.error(
      `\n✗ ${findings.length} bracketed placeholder(s) in ${pages.length} page(s):\n`
    );
    console.error(
      findings
        .map((hit) => `  ${hit.file}\n    ${hit.text}\n    ${hit.context}`)
        .join("\n")
    );
    console.error(
      `\n✗ Placeholder check failed — square brackets mean "unfinished" here.\n` +
        `  Replace each bracket with a real, confirmed value, or delete the sentence.\n`
    );
    process.exit(1);
  }

  console.log(
    `\n✓ Placeholder check passed — no bracketed placeholders in ${pages.length} page(s).\n` +
      `  Scanned visible text and attributes; scripts, styles and comments excluded.\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
