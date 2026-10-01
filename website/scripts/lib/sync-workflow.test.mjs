/**
 * Regression tests for the reminder guard's contract.
 *
 * The contract has two rules and no runtime of its own: whether a workflow step
 * survives a failure, and whether it is allowed to write issues. Both are read
 * out of the workflow file, so both are exercised here against workflows built
 * by hand — the alternative, editing `.github/workflows/sync-recipes.yml` inside
 * a test, would be testing the edit rather than the rule.
 *
 * Every case starts from the workflow this repository ships and breaks exactly
 * one thing, so a failure names its own cause. `workflowFor` is the whole world
 * of these tests: a job, its steps, and the two permission blocks.
 *
 * Where a case is one GitHub would accept but that this gate deliberately
 * rejects — an `if:` that is equivalent but spelled differently, say — the test
 * says so and asserts the rejection, rather than leaving the intent of the
 * rule to be guessed from the code.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FAILURE_TOLERANT_IF,
  issuesWritable,
  normaliseIf,
  reminderGuard,
} from "./sync-workflow.mjs";

/** The step under test, as the workflow writes it. */
const REMINDER_STEP = Object.freeze({
  name: "Open or close the editorial reminders",
  if: "always()",
  run: "npm run reminders",
});

/** The permissions the workflow grants, in the shape the file uses. */
const WRITABLE = Object.freeze({
  contents: "write",
  "pull-requests": "write",
  issues: "write",
});

/**
 * A workflow with one job, and the reminder step as the last of its steps.
 *
 * `jobPermissions` is only set when a case asks for it, because its absence is
 * itself meaningful: the step then inherits the workflow's block.
 */
function workflowFor({ steps, permissions = WRITABLE, jobPermissions, jobName = "sync" } = {}) {
  const job = {
    name: "Sync from the YouTube feed",
    steps: steps ?? [{ name: "Sync the recipe snapshot", run: "npm run recipes" }, REMINDER_STEP],
  };

  if (jobPermissions !== undefined) job.permissions = jobPermissions;

  return { name: "Sync recipes", permissions, jobs: { [jobName]: job } };
}

/** The ids of every problem found, in the order they were found. */
const idsOf = (workflow) => reminderGuard(workflow).problems.map((problem) => problem.id);

/** The one problem found, asserting there is exactly one. */
function onlyProblem(workflow) {
  const { problems } = reminderGuard(workflow);
  assert.equal(problems.length, 1, `expected one problem, got ${JSON.stringify(problems, null, 1)}`);
  return problems[0];
}

describe("normaliseIf", () => {
  it("reduces every spelling of one expression to the same string", () => {
    const equivalent = [
      "always()",
      "always() ",
      "${{ always() }}",
      "${{always()}}",
      "  ${{ ALWAYS() }}  ",
    ];

    for (const value of equivalent) {
      assert.equal(normaliseIf(value), "always()", `${JSON.stringify(value)} should reduce to always()`);
    }
  });

  it("reads an absent if: as absent, not as an expression", () => {
    for (const value of [undefined, null, ""]) {
      assert.equal(normaliseIf(value), "");
    }
  });
});

describe("issuesWritable", () => {
  it("wants the scope granted, in either shape GitHub accepts", () => {
    assert.equal(issuesWritable({ issues: "write" }), true);
    assert.equal(issuesWritable("write-all"), true);
  });

  it("reads an absent block as no access, which is what GitHub does", () => {
    assert.equal(issuesWritable(undefined), false);
    assert.equal(issuesWritable({}), false);
    assert.equal(issuesWritable(null), false);
  });

  it("does not accept a narrower level", () => {
    assert.equal(issuesWritable({ issues: "read" }), false);
    assert.equal(issuesWritable("read-all"), false);
    assert.equal(issuesWritable({ contents: "write" }), false);
  });
});

describe("reminderGuard", () => {
  it("passes the guard this repository ships, and reports what it found", () => {
    const { steps, problems } = reminderGuard(workflowFor());

    assert.deepEqual(problems, []);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].name, "Open or close the editorial reminders");
    assert.equal(steps[0].if, "always()");
    assert.deepEqual(steps[0].permissions, { source: "workflow", value: WRITABLE });
  });

  it("accepts every expression that survives a failure", () => {
    for (const value of FAILURE_TOLERANT_IF) {
      assert.deepEqual(idsOf(workflowFor({ steps: [{ ...REMINDER_STEP, if: value }] })), [], value);
      assert.deepEqual(
        idsOf(workflowFor({ steps: [{ ...REMINDER_STEP, if: `\${{ ${value} }}` }] })),
        [],
        `\${{ ${value} }}`
      );
    }
  });

  it("fails a step that has no if:, because a missing if: means success()", () => {
    const problem = onlyProblem(workflowFor({ steps: [{ ...REMINDER_STEP, if: undefined }] }));

    assert.equal(problem.id, "gated-reminder-step");
    assert.match(problem.message, /has no if:/);
    assert.match(problem.message, /if: always\(\)/);
  });

  it("fails an if: that only runs when everything above succeeded", () => {
    const problem = onlyProblem(workflowFor({ steps: [{ ...REMINDER_STEP, if: "success()" }] }));

    assert.equal(problem.id, "gated-reminder-step");
    assert.match(problem.message, /if: success\(\)/);
  });

  it("fails the condition the pull-request steps use, and names the accepted forms", () => {
    const problem = onlyProblem(
      workflowFor({
        steps: [{ ...REMINDER_STEP, if: "steps.changes.outputs.changed == 'true'" }],
      })
    );

    assert.equal(problem.id, "gated-reminder-step");
    for (const accepted of FAILURE_TOLERANT_IF) {
      assert.ok(problem.message.includes(accepted), `the message should offer ${accepted}`);
    }
  });

  it("fails a step that would only run after a failure, which skips every quiet day", () => {
    assert.equal(onlyProblem(workflowFor({ steps: [{ ...REMINDER_STEP, if: "failure()" }] })).id, "gated-reminder-step");
  });

  it("fails a workflow where nothing runs the reminders at all", () => {
    const problem = onlyProblem(
      workflowFor({ steps: [{ name: "Sync the recipe snapshot", run: "npm run recipes" }] })
    );

    assert.equal(problem.id, "no-reminder-step");
    assert.match(problem.message, /npm run reminders/);
  });

  it("reads the command out of run:, not the step's name", () => {
    // A step that is called the right thing and does the wrong thing.
    const named = onlyProblem(
      workflowFor({ steps: [{ name: "Open or close the editorial reminders", run: "echo ok" }] })
    );
    assert.equal(named.id, "no-reminder-step");

    // And the reverse: the command is the mechanism, whatever the step is called.
    const renamed = reminderGuard(
      workflowFor({
        steps: [{ name: "Reminders", if: "always()", run: "npm run reminders -- --dry-run" }],
      })
    );
    assert.deepEqual(renamed.problems, []);
    assert.equal(renamed.steps.length, 1);
  });

  it("checks every step that runs the reminders, not the first one", () => {
    const problems = reminderGuard(
      workflowFor({
        steps: [
          { name: "Reminder sweep", if: "always()", run: "npm run reminders" },
          { name: "Reminder sweep, second call", run: "npm run reminders" },
        ],
      })
    ).problems;

    assert.equal(problems.length, 1);
    assert.equal(problems[0].id, "gated-reminder-step");
    assert.match(problems[0].message, /second call/);
  });

  it("fails a file with no jobs, rather than passing a workflow-shaped file", () => {
    assert.equal(onlyProblem({}).id, "no-jobs");
    assert.equal(onlyProblem({ jobs: {} }).id, "no-jobs");
  });

  it("fails when the workflow grants no issues permission", () => {
    const problem = onlyProblem(
      workflowFor({
        permissions: { contents: "write", "pull-requests": "write" },
      })
    );

    assert.equal(problem.id, "issues-not-writable");
    assert.match(problem.message, /workflow/);
  });

  it("fails when a job's own permissions take the grant away", () => {
    const problem = onlyProblem(workflowFor({ jobPermissions: { contents: "write" } }));

    assert.equal(problem.id, "issues-not-writable");
    assert.match(problem.message, /"sync" job/);
  });

  it("accepts a job that grants issues: write for itself", () => {
    assert.deepEqual(
      idsOf(workflowFor({ permissions: { contents: "read" }, jobPermissions: { issues: "write" } })),
      []
    );
  });

  it("checks the permissions of the job that runs the step, not of its neighbour", () => {
    const workflow = workflowFor({ permissions: { contents: "read" }, jobPermissions: {} });
    workflow.jobs.other = {
      name: "Some other job",
      permissions: { issues: "write" },
      steps: [{ name: "Not the reminders", run: "echo hi" }],
    };

    assert.equal(onlyProblem(workflow).id, "issues-not-writable");
  });
});
