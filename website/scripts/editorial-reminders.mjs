/**
 * HealThaali — editorial reminders
 * -------------------------------
 *   npm run reminders                          open and close what the repo says
 *   npm run reminders -- --dry-run             print the plan, change nothing
 *   npm run reminders -- --issues-json list.json
 *                                              plan against a captured issue list
 *
 * `npm run report:gaps` says what to write next, and the recipe sync says it in
 * the pull request it opens. Neither survives the pull request being merged,
 * which is fine for a report and not fine for a reminder — so this keeps the
 * same finding in the issue tracker, where it sits until somebody does it.
 *
 * What it treats as unfinished
 * ----------------------------
 * A video no post carries. That is this repository's own answer to "has anything
 * been written about this?", read through the same module the report and the sync
 * use (`lib/editorial-gaps.mjs`), so all three agree about what is missing. The
 * issue body then says which of the video's phrases no post covers yet, because
 * that is the part a writer can act on: a phrase the channel publishes that no
 * post says is either a post that has not been written or a post that covers the
 * subject without naming it, and the second one is a sentence rather than a page.
 *
 * What it treats as finished
 * --------------------------
 * An open reminder whose video a post now embeds. It is closed with a comment
 * naming the posts, so the tracker never becomes a list of things that were done
 * last month. Nothing else is touched: an open reminder that names no video in
 * the snapshot is reported and left alone, because that is a decision for a
 * person rather than a script.
 *
 * What is here, and what is not
 * -----------------------------
 * This file reads the state (the snapshot, the posts, the open reminders) and
 * carries the plan out with three `gh` calls. The plan itself — what should be
 * open, what should be closed, what is already in place, and what each reminder
 * says — is in `lib/editorial-reminders.mjs`, where it can be tested without a
 * token, a repository or a network.
 *
 * Why `gh`, and what it needs
 * ---------------------------
 * The GitHub CLI, authenticated — the scheduled workflow supplies both (`GH_TOKEN`
 * at job level). The label is created or updated by this script on the first run
 * that has something to open, so nothing has to be set up by hand.
 *
 * `--issues-json <path>` reads the open reminders from a file instead of asking
 * `gh`, which is how this is planned offline. `--dry-run` prints every call it
 * would make instead of making it.
 *
 * Exit code 0 = the plan was carried out (or printed, under --dry-run). Exit 1 =
 * the sources it reads are missing, or `gh` could not be run, because a reminder
 * that silently fails to open is worse than one that never existed.
 */

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findGaps, readPosts, readSnapshot } from "./lib/editorial-gaps.mjs";
import { plan } from "./lib/editorial-reminders.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");

/* ── arguments ────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const RECIPES_FILE = path.resolve(ROOT, option("--recipes", path.join("src", "data", "recipes.json")));
const POSTS_DIR = path.resolve(ROOT, option("--posts", path.join("src", "content", "blog")));
const LABEL = option("--label", "editorial");
const SITE = (option("--site", process.env.PUBLIC_SITE_URL || "https://healthaali.in")).replace(/\/$/, "");
const ISSUES_JSON = option("--issues-json", null);
const LIMIT = Math.max(1, Number.parseInt(option("--limit", "200"), 10) || 200);
const DRY_RUN = hasFlag("--dry-run");

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(
    [
      "",
      "  npm run reminders                       open and close the reminders this repo calls for",
      "  npm run reminders -- --dry-run          print the plan, change nothing",
      "  npm run reminders -- --issues-json <f>  plan against a captured gh issue list",
      "",
      "  Options: --label <name> --site <origin> --recipes <file> --posts <dir> --limit <n>",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const log = (message) => process.stdout.write(`${message}\n`);
const fail = (message) => {
  process.stderr.write(`\n✗ ${message}\n\n`);
  process.exit(1);
};

/* ── gh ───────────────────────────────────────────────────────────────────── */

/**
 * Run one `gh` command.
 *
 * Arguments go through as an array rather than a shell string, because a video
 * title contains quotes, dashes and emoji — the same reason this is a script and
 * not a shell block in the workflow.
 */
function gh(args) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    if (error.code === "ENOENT") {
      fail(
        "The GitHub CLI (`gh`) is not installed, so the reminders cannot be read or written.\n" +
          "  It runs in the scheduled sync, where `gh` and `GH_TOKEN` are provided.\n" +
          "  To plan offline, pass --issues-json with a captured `gh issue list` response.",
      );
    }
    const detail = String(error.stderr ?? error.message).trim();
    fail(`gh ${args.join(" ")} failed.\n  ${detail}`);
  }
}

/** The open reminders, as `gh` reports them. */
const listOpen = () =>
  JSON.parse(
    gh([
      "issue",
      "list",
      "--label",
      LABEL,
      "--state",
      "open",
      "--limit",
      String(LIMIT),
      "--json",
      "number,title,url",
    ]),
  );

/** Create the label if it is not there yet, and keep its description current. */
const ensureLabel = () =>
  gh([
    "label",
    "create",
    LABEL,
    "--description",
    "A video the channel has published that no post has been written about yet",
    "--color",
    "0E8A16",
    "--force",
  ]);

/* ── main ─────────────────────────────────────────────────────────────────── */

async function main() {
  let recipes;
  let posts;

  try {
    ({ recipes } = await readSnapshot(RECIPES_FILE, { root: ROOT }));
    posts = await readPosts(POSTS_DIR, { root: ROOT });
  } catch (error) {
    fail(error.message);
  }

  const issues = ISSUES_JSON
    ? JSON.parse(await readFile(path.resolve(ROOT, ISSUES_JSON), "utf8"))
    : listOpen();

  const { gaps } = findGaps({ recipes, posts });
  const { open, close, waiting, orphaned } = plan({ recipes, posts, gaps, issues, site: SITE });

  const unwritten = recipes.filter(
    (recipe) => !posts.some((post) => post.embeds.has(recipe.id)),
  ).length;

  log("");
  log(
    `  Editorial reminders — ${recipes.length} video(s), ` +
      `${unwritten} with no post behind ${unwritten === 1 ? "it" : "them"}, ` +
      `${issues.length} open reminder(s)`,
  );
  log(`  label ${LABEL} · site ${SITE}${DRY_RUN ? " · dry run, nothing will be written" : ""}`);
  log("");

  for (const entry of open) log(`    open        ${entry.title}`);
  for (const entry of close) log(`    close       #${entry.issue.number}  ${entry.issue.title}`);
  for (const entry of waiting) log(`    waiting     #${entry.issue.number}  ${entry.issue.title}`);
  for (const issue of orphaned) {
    log(`    ignored     #${issue.number}  ${issue.title} — names no video in the snapshot`);
  }

  if (open.length === 0 && close.length === 0) {
    log(
      unwritten === 0
        ? "    Nothing to do — every video in the snapshot is carried by a post."
        : "    Nothing to do — every video still unwritten is already tracked.",
    );
  }
  log("");

  if (DRY_RUN) {
    for (const entry of open) {
      log(`  would run: gh issue create --label ${LABEL} --title ${JSON.stringify(entry.title)}`);
      log("");
      log(entry.body.replace(/^/gm, "    "));
      log("");
    }
    for (const entry of close) {
      log(`  would run: gh issue close ${entry.issue.number} --comment`);
      log("");
      log(entry.comment.replace(/^/gm, "    "));
      log("");
    }
    log("  dry run: nothing was written.\n");
    return;
  }

  if (open.length > 0) ensureLabel();

  for (const entry of open) {
    const url = gh([
      "issue",
      "create",
      "--label",
      LABEL,
      "--title",
      entry.title,
      "--body",
      entry.body,
    ]).trim();
    log(`  ✓ opened ${entry.recipe.id} — ${url}`);
  }

  for (const entry of close) {
    gh(["issue", "close", String(entry.issue.number), "--comment", entry.comment]);
    log(`  ✓ closed #${entry.issue.number} — ${entry.recipe.id} is written about now`);
  }

  log(
    open.length + close.length === 0
      ? "\n  Nothing to do.\n"
      : `\n  ✓ ${open.length} opened, ${close.length} closed, ${waiting.length} still waiting.\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
