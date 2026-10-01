/**
 * HealThaali — the reminder guard, as a library
 * --------------------------------------------
 * `.github/workflows/sync-recipes.yml` ends with a step that keeps the editorial
 * reminders alive in the issue tracker: it opens a labelled issue for every video
 * no post carries, and closes it again once a post does. Two things about that
 * step are load-bearing, and neither is visible in a diff of the code around it.
 *
 * **It has to run after a failure.** A step with no `if:` runs only if every step
 * before it succeeded, and the first thing the sync does is fetch the YouTube
 * feed — which answered a transient HTTP 404 on the first scheduled run
 * (1 October). Everything after the sync step was skipped, including the half of
 * the reminders that needs no news at all: closing a reminder whose video a post
 * now carries. The step therefore carries an explicit failure-tolerant `if:`.
 *
 * **It has to be allowed to write issues.** Without `issues: write` the step is
 * green on every quiet run and fails on the first morning there is something to
 * open — the worst possible day to discover a permission, and the day nobody is
 * watching for it.
 *
 * Both are one-line deletions away from being undone, and neither breaks the
 * build, the types or any other gate: the workflow simply stops doing the thing
 * it was fixed to do. `scripts/check-sync-workflow.mjs` is the gate that refuses
 * to let that happen quietly, and this module is its whole decision.
 *
 * Nothing here reads a file, parses YAML or prints anything. The workflow
 * arrives already parsed — which is also why every case in
 * `sync-workflow.test.mjs` can be built by hand.
 */

/**
 * The `if:` expressions that run a step even when an earlier step failed.
 *
 * GitHub's own names for this: `always()` runs whatever happened, `!cancelled()`
 * runs unless the whole run was cancelled, and the disjunction of success and
 * failure is the same set written out. `failure()` on its own is deliberately
 * *not* here — it would skip the step on every quiet run, which is most of them.
 *
 * Only these are accepted, so a future `if:` that is subtly narrower than it
 * looks fails here rather than on the morning it matters. The failure message
 * names every accepted form, so writing a novel-but-equivalent expression costs
 * one line rather than a debugging session.
 */
export const FAILURE_TOLERANT_IF = Object.freeze([
  "always()",
  "!cancelled()",
  "success()||failure()",
  "failure()||success()",
]);

/**
 * How the workflow invokes the reminders. Matched against the step's `run`, not
 * its name: the name is prose and may be reworded, the command is the mechanism.
 */
export const REMINDER_COMMAND = /npm run reminders\b/;

/**
 * An `if:` reduced to the form the comparison above speaks.
 *
 * GitHub accepts the expression bare (`if: always()`) or wrapped
 * (`if: ${{ always() }}`), ignores the whitespace inside it, and does not care
 * about case. All four variants mean the same thing, so all four compare equal.
 */
export const normaliseIf = (value) =>
  String(value ?? "")
    .replace(/\$\{\{|\}\}/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();

/**
 * Whether a `permissions:` block lets the holder write issues.
 *
 * GitHub accepts two shapes: a shorthand string (`write-all`, `read-all`) or a
 * mapping of scope to level. An absent block grants nothing — the default for a
 * workflow that says nothing is read-only for most scopes, and for `issues` it is
 * no access at all — so "not mentioned" has to read as "cannot write", not as
 * "unset, therefore fine".
 */
export const issuesWritable = (permissions) => {
  if (typeof permissions === "string") return permissions === "write-all";
  if (permissions && typeof permissions === "object") return permissions.issues === "write";
  return false;
};

/** A step's name, or its position when it has none. */
const stepLabel = (step, index) => step?.name || `step ${index + 1}`;

/** `job` permissions override the workflow's; both may be absent. */
const effectivePermissions = (workflow, job) => ({
  source: job?.permissions === undefined ? "workflow" : "job",
  value: job?.permissions === undefined ? workflow?.permissions : job.permissions,
});

/**
 * Every problem with the reminder guard in this workflow, and the facts behind
 * them.
 *
 * `problems` is empty exactly when the workflow is still allowed to do what it
 * was fixed to do. `steps` carries what was found, for the report — an empty list
 * means nothing runs the reminders at all, which is itself a problem.
 */
export function reminderGuard(workflow) {
  const problems = [];
  const jobs = workflow?.jobs;

  if (!jobs || typeof jobs !== "object" || Object.keys(jobs).length === 0) {
    problems.push({
      id: "no-jobs",
      message:
        "this file has no jobs, so nothing here can run anything — refusing to pass " +
        "on a workflow-shaped file that is not one",
    });
    return { steps: [], problems };
  }

  const steps = [];

  for (const [jobName, job] of Object.entries(jobs)) {
    const jobSteps = Array.isArray(job?.steps) ? job.steps : [];

    jobSteps.forEach((step, index) => {
      if (!REMINDER_COMMAND.test(String(step?.run ?? ""))) return;

      const ifValue = step.if;
      const normalised = normaliseIf(ifValue);
      const permissions = effectivePermissions(workflow, job);

      steps.push({
        job: jobName,
        index,
        name: stepLabel(step, index),
        if: ifValue ?? null,
        normalised,
        permissions,
      });

      if (normalised === "") {
        problems.push({
          id: "gated-reminder-step",
          message:
            `"${stepLabel(step, index)}" has no if:, and a step with no if: runs only ` +
            `when every step before it succeeded — so a transient failure anywhere above ` +
            `it skips the reminders entirely, which is what the feed's HTTP 404 did to ` +
            `this step on 1 October. Give it: if: always()`,
        });
      } else if (!FAILURE_TOLERANT_IF.includes(normalised)) {
        problems.push({
          id: "gated-reminder-step",
          message:
            `"${stepLabel(step, index)}" is guarded by if: ${String(ifValue).trim()}, ` +
            `which is not one of the expressions that survive a failed step, so the ` +
            `reminders are skipped whenever anything above them fails. Accepted forms: ` +
            FAILURE_TOLERANT_IF.map((value) => `if: ${value}`).join(", ") +
            ` (written bare or wrapped in \${{ }}).`,
        });
      }

      if (!issuesWritable(permissions.value)) {
        problems.push({
          id: "issues-not-writable",
          message:
            `the ${permissions.source} permissions do not grant issues: write, so ` +
            `"${stepLabel(step, index)}" fails the first morning a video actually needs ` +
            `a reminder — every quiet run in between is green and says nothing. Add ` +
            `\`issues: write\` to the ${permissions.source === "job" ? `"${jobName}" job` : "workflow"}.`,
        });
      }
    });
  }

  if (steps.length === 0) {
    problems.push({
      id: "no-reminder-step",
      message:
        "nothing in this workflow runs `npm run reminders`, so the daily sync would " +
        "update the snapshot and leave the finding in a pull request that gets merged " +
        "and forgotten. See scripts/editorial-reminders.mjs for what the step is for.",
    });
  }

  return { steps, problems };
}
