/**
 * HealThaali — reminder guard gate
 * --------------------------------
 *   npm run check:sync-workflow
 *   npm run check:sync-workflow -- --workflow path/to/other.yml
 *
 * One rule: **`.github/workflows/sync-recipes.yml` must still be able to keep its
 * editorial reminders alive.**
 *
 * The workflow's last step opens a labelled issue for every video no post
 * carries, and closes it again once a post does. Two facts about that step are
 * one-line deletions away from being untrue, and neither shows up anywhere else:
 *
 *   1. It runs even when a step above it failed. A step with no `if:` runs only
 *      when everything before it succeeded, and the first thing this job does is
 *      fetch the YouTube feed — which answered a transient HTTP 404 on the first
 *      scheduled run (1 October, run #1, attempt 1). Every later step was skipped,
 *      including the one that would have tidied up. The step now carries
 *      `if: always()`.
 *   2. It is allowed to write issues. Without `issues: write` the step is green on
 *      every quiet run and fails on the first morning there is something to open.
 *
 * Neither failure breaks the build, the types, the links or any other gate: the
 * workflow simply stops doing the thing it was fixed to do, and nothing says so.
 * That is the whole reason this check exists, and why it runs in `ci.yml` as well
 * as in `npm run verify` — the edit that would undo it arrives as an ordinary
 * push, which is exactly the event `verify` alone never sees.
 *
 * What it asserts, exactly: every step in the file whose `run` invokes
 * `npm run reminders` has an `if:` that survives a failure, and the job that
 * holds it is granted `issues: write`. The decision lives in
 * `lib/sync-workflow.mjs`, where it is tested; this file reads the YAML, prints
 * the verdict and exits.
 *
 * Deliberately not asserted: the `schedule` trigger (a manual-only sync would be
 * a different, visible problem), the `GH_TOKEN` the step needs (its absence fails
 * loudly the moment it runs, unlike a permission), and anything about the other
 * workflows — a check that lectured about files it does not read would be worse
 * than one that says what it covers.
 *
 * Exit code 0 = the guard is intact, 1 = it is not, or the file could not be read.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

import { FAILURE_TOLERANT_IF, reminderGuard } from "./lib/sync-workflow.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const REPO_ROOT = path.resolve(ROOT, "..");

/* ── arguments ────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

if (argv.includes("--help")) {
  console.log(
    "\n  npm run check:sync-workflow [-- --workflow <path>]\n\n" +
      "  Asserts that every step of the sync workflow which runs `npm run reminders`\n" +
      `  survives a failed step above it, and that its job may write issues.\n` +
      `  Defaults to .github/workflows/sync-recipes.yml.\n`
  );
  process.exit(0);
}

const WORKFLOW = path.resolve(
  REPO_ROOT,
  option("--workflow", path.join(".github", "workflows", "sync-recipes.yml"))
);

const relative = path.relative(REPO_ROOT, WORKFLOW).split(path.sep).join("/");

const refuse = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

/* ── reading the workflow ─────────────────────────────────────────────────── */

let source;
try {
  source = await readFile(WORKFLOW, "utf8");
} catch (error) {
  refuse(
    `No workflow at ${relative} (${error.code || error.message}).\n` +
      "  Pass --workflow <path> if it lives somewhere else. Refusing to pass on a\n" +
      "  file that is not there: a check that reads nothing proves nothing, and this\n" +
      "  one is the only thing standing between the reminders and a quiet deletion."
  );
}

let workflow;
try {
  workflow = yaml.load(source);
} catch (error) {
  // A workflow GitHub cannot parse never runs at all, so this is a failure of
  // the same kind rather than a problem with the checker.
  refuse(
    `${relative} is not valid YAML, so GitHub would not run it:\n` +
      `  ${String(error.message).split("\n")[0]}`
  );
}

/* ── the verdict ──────────────────────────────────────────────────────────── */

const { steps, problems } = reminderGuard(workflow);

console.log(`\n  Reminder guard — ${relative}\n`);

/** How a `permissions:` block reads in one line, whatever shape it has. */
const grant = (permissions) => {
  if (typeof permissions === "string") return permissions;
  if (permissions && typeof permissions === "object") return permissions.issues ?? "(not granted)";
  return "(nothing granted)";
};

if (steps.length === 0) {
  console.log("  no step runs `npm run reminders`\n");
} else {
  for (const step of steps) {
    console.log(`  ${step.name}   (job "${step.job}", step ${step.index + 1})`);
    console.log(
      `      if: ${step.if === null ? "(none)" : String(step.if).trim()}` +
        (FAILURE_TOLERANT_IF.includes(step.normalised)
          ? "  — runs even if a step above it failed"
          : "")
    );
    console.log(
      `      issues: ${grant(step.permissions.value)} — from the ${step.permissions.source} permissions`
    );
  }
  console.log("");
}

if (problems.length > 0) {
  console.error(`✗ The reminder guard is broken — ${problems.length} problem(s) in ${relative}:\n`);
  for (const problem of problems) {
    console.error(`  ✗ ${problem.message}\n`);
  }
  console.error(
    "  `.github/workflows/sync-recipes.yml` exists to keep a reminder in the issue\n" +
      "  tracker until somebody writes the post. See scripts/editorial-reminders.mjs\n" +
      "  for what the step does, and lib/sync-workflow.mjs for the rule enforced here.\n"
  );
  process.exit(1);
}

console.log(
  `✓ Reminder guard holds — every step that runs \`npm run reminders\` survives a\n` +
    `  failure above it, and may write the issues it needs.\n`
);
