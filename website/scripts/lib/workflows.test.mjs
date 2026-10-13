/**
 * Regression tests for the workflow sweep's contract.
 *
 * The contract is small and entirely about the edge between "a file GitHub
 * runs" and "a file GitHub never mentions again": the extensions it reads, and
 * what a source has to load into — a job *and* a trigger — for there to be a
 * workflow in it at all.
 *
 * Every case here is a source string, because that is all the module reads —
 * there is no fixture directory to keep in step with the tests, and no chance of
 * a test passing because the file on disk happened to change.
 *
 * The rule that matters most is the trigger one: a workflow with jobs but no
 * `on:` is listed as invalid by GitHub and can never be started — no push, no
 * schedule, no hand dispatch. It is the same silent failure as broken YAML, one
 * line further in.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasTrigger, isWorkflowFile, parseWorkflows } from "./workflows.mjs";

/** A workflow-shaped source, minimal but real. */
const GOOD = [
  "name: CI",
  "on:",
  "  push:",
  "    branches: [main]",
  "jobs:",
  "  build:",
  "    runs-on: ubuntu-latest",
  "    steps:",
  "      - name: Check out",
  "        uses: actions/checkout@v4",
  "",
].join("\n");

/** The one problem found, asserting there is exactly one. */
function onlyProblem(source, path = "workflow.yml") {
  const { problems } = parseWorkflows([{ path, source }]);
  assert.equal(problems.length, 1, `expected one problem, got ${JSON.stringify(problems, null, 1)}`);
  return problems[0];
}

describe("isWorkflowFile", () => {
  it("accepts the two extensions GitHub reads", () => {
    assert.equal(isWorkflowFile("ci.yml"), true);
    assert.equal(isWorkflowFile("sync-recipes.yaml"), true);
  });

  it("rejects names GitHub never reads, rather than guessing at them", () => {
    for (const name of ["ci.yml.bak", "workflows.md", "ci.yaml.orig", "notes.txt", "yml"]) {
      assert.equal(isWorkflowFile(name), false, name);
    }
  });

  it("skips hidden names, which are the filesystem's or the editor's", () => {
    assert.equal(isWorkflowFile(".ci.yml"), false);
    assert.equal(isWorkflowFile("._ci.yml"), false);
  });

  it("does not treat a missing name as a workflow", () => {
    assert.equal(isWorkflowFile(undefined), false);
    assert.equal(isWorkflowFile(null), false);
  });
});

describe("hasTrigger", () => {
  it("accepts every shape GitHub accepts, when it is not empty", () => {
    assert.equal(hasTrigger({ on: "push" }), true);
    assert.equal(hasTrigger({ on: ["push", "pull_request"] }), true);
    assert.equal(hasTrigger({ on: { push: { branches: ["main"] } } }), true);
    assert.equal(hasTrigger({ on: { schedule: [{ cron: "0 3 * * *" }] } }), true);
  });

  it("reads an absent or empty trigger as no trigger at all", () => {
    assert.equal(hasTrigger({}), false);
    assert.equal(hasTrigger(undefined), false);
    assert.equal(hasTrigger({ on: null }), false);
    assert.equal(hasTrigger({ on: "" }), false);
    assert.equal(hasTrigger({ on: "   " }), false);
    assert.equal(hasTrigger({ on: [] }), false);
    assert.equal(hasTrigger({ on: {} }), false);
    assert.equal(hasTrigger({ on: true }), false);
  });
});

describe("parseWorkflows", () => {
  it("reads a real workflow, and says how many jobs it carries", () => {
    const { workflows, problems } = parseWorkflows([
      { path: ".github/workflows/ci.yml", source: GOOD },
    ]);

    assert.deepEqual(problems, []);
    assert.equal(workflows.length, 1);
    assert.equal(workflows[0].path, ".github/workflows/ci.yml");
    assert.equal(workflows[0].jobCount, 1);
    assert.equal(workflows[0].workflow.name, "CI");
  });

  it("fails YAML that does not load, naming the line", () => {
    const problem = onlyProblem(
      ["name: Broken", "jobs:", "  build:", "    steps:", "      - name: One", "       run: one"].join(
        "\n"
      )
    );

    assert.equal(problem.id, "unparseable-workflow");
    assert.match(problem.message, /not valid YAML/);
    assert.match(problem.message, /\(\d+:\d+\)/, problem.message);
  });

  it("fails an empty file, which is the accident that looks most like a workflow", () => {
    const problem = onlyProblem("");

    assert.equal(problem.id, "no-jobs");
    assert.match(problem.message, /empty file/);
  });

  it("fails a document that is not a mapping at all", () => {
    assert.match(onlyProblem("just a string").message, /a single string value/);
    assert.match(onlyProblem("- one\n- two").message, /a list/);
    assert.match(onlyProblem("---\nnull").message, /nothing at all/);
  });

  it("fails a mapping with no jobs, and one whose jobs are empty", () => {
    assert.match(onlyProblem("on: push").message, /a mapping with no jobs/);
    assert.equal(onlyProblem("on: push\njobs:\n").id, "no-jobs");
    assert.equal(onlyProblem("on: push\njobs: {}\n").id, "no-jobs");
  });

  it("fails a job list rather than a job map, which YAML allows and GitHub does not", () => {
    assert.equal(onlyProblem("on: push\njobs:\n  - build\n").id, "no-jobs");
  });

  it("judges every file on its own, so one broken file does not hide the others", () => {
    const { workflows, problems } = parseWorkflows([
      { path: "a.yml", source: GOOD },
      { path: "b.yml", source: "jobs:\n  build:\n    steps: [\n" },
      { path: "c.yml", source: GOOD },
    ]);

    assert.deepEqual(
      workflows.map((workflow) => workflow.path),
      ["a.yml", "c.yml"]
    );
    assert.equal(problems.length, 1);
    assert.equal(problems[0].path, "b.yml");
  });

  it("echoes the path on every problem, so the caller can name the file", () => {
    const { problems } = parseWorkflows([
      { path: ".github/workflows/uptime.yml", source: "" },
      { path: ".github/workflows/mirror.yml", source: "jobs: {}\n" },
    ]);

    assert.deepEqual(
      problems.map((problem) => problem.path),
      [".github/workflows/uptime.yml", ".github/workflows/mirror.yml"]
    );
  });

  it("accepts each trigger shape GitHub accepts, once jobs are there", () => {
    const triggers = ["on: push\n", "on: [push, schedule]\n", "on:\n  push:\n    branches: [main]\n"];

    for (const on of triggers) {
      const { workflows, problems } = parseWorkflows([
        { path: "triggered.yml", source: `${on}jobs:\n  build:\n    steps:\n      - run: echo hi\n` },
      ]);

      assert.deepEqual(problems, [], JSON.stringify(on));
      assert.equal(workflows.length, 1, JSON.stringify(on));
    }
  });

  it("fails a workflow with jobs but no trigger, which nothing could ever start", () => {
    const problem = onlyProblem("jobs:\n  build:\n    steps:\n      - run: echo hi\n");

    assert.equal(problem.id, "no-trigger");
    assert.match(problem.message, /no usable `on:` trigger/);
  });

  it("fails a trigger that is there and empty, whatever shape the emptiness has", () => {
    const jobs = "jobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n";

    for (const on of ["on:\n", 'on: ""\n', "on: []\n", "on: {}\n", "on: null\n"]) {
      const problem = onlyProblem(`${on}${jobs}`);
      assert.equal(problem.id, "no-trigger", JSON.stringify(on));
    }
  });
});
