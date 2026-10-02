/**
 * Regression tests for the workflow sweep's contract.
 *
 * The contract is small and entirely about the edge between "a file GitHub
 * runs" and "a file GitHub never mentions again": the extensions it reads, and
 * what a source has to load into for there to be a workflow in it at all.
 *
 * Every case here is a source string, because that is all the module reads —
 * there is no fixture directory to keep in step with the tests, and no chance of
 * a test passing because the file on disk happened to change.
 *
 * The case worth reading twice is the last: a workflow with jobs but no `on:` is
 * accepted on purpose. GitHub would refuse it at run time, loudly, in the
 * Actions tab. This gate exists for the files that say nothing.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWorkflowFile, parseWorkflows } from "./workflows.mjs";

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

  it("accepts a workflow with jobs but no on:, which GitHub rejects loudly, not silently", () => {
    const { workflows, problems } = parseWorkflows([
      { path: "quiet.yml", source: "jobs:\n  build:\n    steps:\n      - run: echo hi\n" },
    ]);

    assert.deepEqual(problems, []);
    assert.equal(workflows.length, 1);
  });
});
