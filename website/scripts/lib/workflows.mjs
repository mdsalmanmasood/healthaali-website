/**
 * HealThaali — the workflow directory, as a library
 * -------------------------------------------------
 * GitHub reads `.github/workflows` at push time and nothing else reads it at all.
 * A file in there that YAML cannot load — or that carries no jobs — is a workflow
 * that never runs: it does not appear in the Actions tab, it logs nothing, and no
 * other gate in this repository opens the file. The failure is silent by
 * construction, which is the same failure the sync's reminder guard was written
 * about one level down.
 *
 * `scripts/check-sync-workflow.mjs` sweeps the whole directory with this module
 * before it checks that guard, so a workflow GitHub could not run fails a push
 * instead of going quiet.
 *
 * Nothing here touches the filesystem or prints: the sources arrive already read
 * as `{ path, source }`, and the answer is `{ workflows, problems }`. Whether the
 * reminder guard applies to a particular file is the caller's decision; this
 * module's only question is whether each file is one GitHub could run at all.
 *
 * Deliberately not asserted: the triggers a workflow needs, its permissions, and
 * anything its steps are supposed to do. A file with jobs that GitHub would still
 * reject at run time is a different, louder failure — this module is about the
 * ones that leave no trace anywhere.
 */

import yaml from "js-yaml";

/**
 * Where GitHub looks for workflows, relative to the repository root. The leading
 * dot is the directory's, not a hidden file's.
 */
export const WORKFLOW_DIR = ".github/workflows";

/**
 * Whether a name is a file GitHub would read as a workflow.
 *
 * GitHub reads `.yml` and `.yaml` files that sit directly in the directory and
 * nothing else — a subdirectory is not searched at all. Hidden names are skipped
 * here for a narrower reason: `._ci.yml` is what a macOS filesystem leaves beside
 * a copy, and an editor's `.ci.yml` is a draft, not a workflow anybody expects to
 * run. Both are still YAML, and a broken one would otherwise fail the gate for a
 * file that was never meant to be read.
 */
export const isWorkflowFile = (name) =>
  typeof name === "string" && !name.startsWith(".") && /\.ya?ml$/.test(name);

/** What a parsed YAML document actually is, for a message that has to say so. */
const describe = (value) => {
  if (Array.isArray(value)) return "a list";
  if (typeof value !== "object") return `a single ${typeof value} value`;
  return "a mapping with no jobs";
};

/**
 * Parse every source and judge each one.
 *
 * `files` is `[{ path, source }]` in the order it should be reported; `path` is
 * only a label, echoed back on each problem so the caller can name the file.
 *
 * A source is a workflow when it loads as YAML into a mapping with at least one
 * job. Anything else is a problem, because anything else is a file GitHub would
 * refuse or ignore — and either way it never runs. Every source is judged on its
 * own: one broken file does not stop the others from being read, so one push
 * reports every workflow it broke rather than the first.
 */
export function parseWorkflows(files) {
  const workflows = [];
  const problems = [];

  for (const { path, source } of files) {
    let workflow;

    try {
      workflow = yaml.load(source);
    } catch (error) {
      // js-yaml names the line and column; its first line is the whole message.
      const [detail = String(error.message)] = String(error.message).split("\n");
      problems.push({
        id: "unparseable-workflow",
        path,
        message:
          "is not valid YAML, so GitHub would ignore the file entirely and never " +
          `run it:\n      ${detail}`,
      });
      continue;
    }

    const empty = workflow === null || workflow === undefined;
    const jobs = empty || typeof workflow !== "object" ? undefined : workflow.jobs;
    const runnable =
      jobs && typeof jobs === "object" && !Array.isArray(jobs) && Object.keys(jobs).length > 0;

    if (!runnable) {
      problems.push({
        id: "no-jobs",
        path,
        message: empty
          ? "parses to nothing at all — an empty file is not a workflow, and GitHub " +
            "would never run it"
          : `parses to ${describe(workflow)} rather than a workflow, so GitHub would ` +
            "never run it",
      });
      continue;
    }

    workflows.push({ path, workflow, jobCount: Object.keys(jobs).length });
  }

  return { workflows, problems };
}
