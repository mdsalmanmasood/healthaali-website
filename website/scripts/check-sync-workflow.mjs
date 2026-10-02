/**
 * HealThaali — the workflow gate
 * ------------------------------
 *   npm run check:sync-workflow
 *   npm run check:sync-workflow -- --workflow path/to/other.yml
 *
 * Two duties, one command.
 *
 * **Every workflow in `.github/workflows` must be one GitHub can run.** A file
 * that YAML cannot load is not a broken build — it is nothing at all: GitHub
 * ignores it, the Actions tab does not list it, and no other gate in this
 * repository opens the file. Nobody notices until the morning the workflow was
 * supposed to do something, which is weeks after the edit that broke it. So
 * every `.yml`/`.yaml` file directly in the directory is parsed here and must
 * hold at least one job. That rule lives in `lib/workflows.mjs`, where it is
 * tested.
 *
 * **`.github/workflows/sync-recipes.yml` must still be able to keep its
 * editorial reminders alive.** The workflow's last step opens a labelled issue
 * for every video no post carries, and closes it again once a post does. Two
 * facts about that step are one-line deletions away from being untrue, and
 * neither shows up anywhere else:
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
 * What it asserts, exactly: every file directly in `.github/workflows` is YAML
 * that loads into a mapping with at least one job, and every step in the sync
 * workflow whose `run` invokes `npm run reminders` has an `if:` that survives a
 * failure while its job is granted `issues: write`. The decisions live in
 * `lib/workflows.mjs` and `lib/sync-workflow.mjs`, where they are tested; this
 * file reads the files, prints the verdict and exits.
 *
 * Deliberately not asserted: any other workflow's triggers, permissions or
 * steps (a file GitHub would also reject at run time is a loud failure, not this
 * one), the sync's `schedule` trigger (a manual-only sync would be a different,
 * visible problem), and the `GH_TOKEN` the reminder step needs (its absence
 * fails loudly the moment it runs, unlike a permission). `--workflow <path>`
 * moves the reminder guard to another file; the sweep always covers the real
 * directory.
 *
 * Exit code 0 = every workflow runs and the guard is intact, 1 = it is not, or a
 * file could not be read.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FAILURE_TOLERANT_IF, reminderGuard } from "./lib/sync-workflow.mjs";
import { WORKFLOW_DIR, isWorkflowFile, parseWorkflows } from "./lib/workflows.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const REPO_ROOT = path.resolve(ROOT, "..");

const relative = (absolute) => path.relative(REPO_ROOT, absolute).split(path.sep).join("/");

/* ── arguments ────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

if (argv.includes("--help")) {
  console.log(
    "\n  npm run check:sync-workflow [-- --workflow <path>]\n\n" +
      "  Parses every .yml/.yaml file in .github/workflows, so a workflow GitHub\n" +
      "  could not run — broken YAML, no jobs — fails here instead of going silent\n" +
      "  in the Actions tab. Then asserts that every step of the sync workflow\n" +
      "  which runs `npm run reminders` survives a failed step above it, and that\n" +
      "  its job may write the issues it needs.\n\n" +
      "  --workflow <path>  the file the reminder guard applies to, resolved from\n" +
      "                     the repository root, not the working directory\n" +
      "                     (default: .github/workflows/sync-recipes.yml).\n" +
      "                     The sweep always covers the real directory.\n"
  );
  process.exit(0);
}

const WORKFLOWS = path.resolve(REPO_ROOT, WORKFLOW_DIR);
const WORKFLOW = path.resolve(
  REPO_ROOT,
  option("--workflow", path.join(WORKFLOW_DIR, "sync-recipes.yml"))
);

const refuse = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

/* ── every workflow in the directory ──────────────────────────────────────── */

let entries;
try {
  entries = await readdir(WORKFLOWS, { withFileTypes: true });
} catch (error) {
  refuse(
    `No workflow directory at ${WORKFLOW_DIR} (${error.code || error.message}).\n` +
      "  This gate is the only thing that reads that directory; refusing to pass when\n" +
      "  it is not there, because then this check proves nothing about anything."
  );
}

const names = entries
  .filter((entry) => entry.isFile() && isWorkflowFile(entry.name))
  .map((entry) => entry.name)
  .sort();

if (names.length === 0) {
  refuse(
    `${WORKFLOW_DIR} holds no .yml or .yaml file at all, so this check read nothing.\n` +
      "  A directory that is empty, renamed or moved would otherwise pass silently —\n" +
      "  which is the failure this gate exists to make loud."
  );
}

const unreadable = [];
const files = [];

for (const name of names) {
  const absolute = path.join(WORKFLOWS, name);
  try {
    files.push({ path: absolute, source: await readFile(absolute, "utf8") });
  } catch (error) {
    unreadable.push({
      id: "unreadable-workflow",
      path: absolute,
      message:
        `could not be read (${error.code || error.message}), so whether GitHub could ` +
        "run it is unknown — refusing to pass on a file this check cannot read",
    });
  }
}

const { workflows, problems: parseProblems } = parseWorkflows(files);
const problems = [...unreadable, ...parseProblems];

/* ── the reminder guard, on the workflow that carries it ──────────────────── */

const swept = workflows.find((workflow) => workflow.path === WORKFLOW);
const sweptPaths = new Set(files.map((file) => file.path));
let guard = null;

if (swept) {
  guard = reminderGuard(swept.workflow);
  problems.push(...guard.problems.map((problem) => ({ ...problem, path: WORKFLOW })));
} else if (!sweptPaths.has(WORKFLOW)) {
  // Outside the directory: a fixture, or a copy of the workflow kept elsewhere.
  // Read it on its own, the way this check did before the sweep existed.
  let source;
  try {
    source = await readFile(WORKFLOW, "utf8");
  } catch (error) {
    refuse(
      `No workflow at ${relative(WORKFLOW)} (${error.code || error.message}).\n` +
        "  Pass --workflow <path> if it lives somewhere else. Refusing to pass on a\n" +
        "  file that is not there: a check that reads nothing proves nothing, and this\n" +
        "  one is the only thing standing between the reminders and a quiet deletion."
    );
  }

  const result = parseWorkflows([{ path: WORKFLOW, source }]);

  if (result.workflows.length > 0) {
    guard = reminderGuard(result.workflows[0].workflow);
    problems.push(...guard.problems.map((problem) => ({ ...problem, path: WORKFLOW })));
  } else {
    // The file is not a workflow GitHub could run; parseWorkflows said why, and
    // the guard has nothing to read until that is fixed.
    problems.push(...result.problems);
  }
}

/* ── the report ───────────────────────────────────────────────────────────── */

const jobCount = (count) => `${count} ${count === 1 ? "job" : "jobs"}`;
const parsedPaths = new Map(workflows.map((workflow) => [workflow.path, workflow]));

console.log(`\n  Workflows — ${WORKFLOW_DIR} (${names.length} files)\n`);

for (const name of names) {
  const parsed = parsedPaths.get(path.join(WORKFLOWS, name));
  console.log(parsed ? `  ✓ ${name} — ${jobCount(parsed.jobCount)}` : `  ✗ ${name}`);
}

console.log("");

if (guard) {
  console.log(`  Reminder guard — ${relative(WORKFLOW)}\n`);

  /** How a `permissions:` block reads in one line, whatever shape it has. */
  const grant = (permissions) => {
    if (typeof permissions === "string") return permissions;
    if (permissions && typeof permissions === "object") return permissions.issues ?? "(not granted)";
    return "(nothing granted)";
  };

  if (guard.steps.length === 0) {
    console.log("  no step runs `npm run reminders`\n");
  } else {
    for (const step of guard.steps) {
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
}

if (problems.length > 0) {
  console.error(`✗ The workflow gate is not satisfied — ${problems.length} problem(s):\n`);
  for (const problem of problems) {
    console.error(`  ✗ ${relative(problem.path)}: ${problem.message}\n`);
  }
  console.error(
    "  GitHub reads `.github/workflows` at push time: a file it cannot parse, or one\n" +
      "  with no jobs, never appears in the Actions tab and never says anything — and\n" +
      "  the sync's reminder step is one line away from being skipped on the morning\n" +
      "  it matters. See scripts/editorial-reminders.mjs for what that step does, and\n" +
      "  lib/workflows.mjs + lib/sync-workflow.mjs for the rules enforced here.\n"
  );
  process.exit(1);
}

console.log(
  `✓ Every file in ${WORKFLOW_DIR} is a workflow GitHub can run (${workflows.length}), and the\n` +
    "  reminder guard holds — every step that runs `npm run reminders` survives a\n" +
    "  failure above it, and may write the issues it needs.\n"
);
