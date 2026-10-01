/**
 * HealThaali — mirror this repository to a second git host
 * --------------------------------------------------------
 *   npm run mirror                    mirror to the configured target
 *   npm run mirror -- --to <url>      mirror to a specific URL
 *   npm run mirror -- --self-test     prove the mechanism against a local bare repo
 *   npm run mirror -- --optional      a missing target is not a failure (used by CI)
 *
 * Why a mirror as well as a bundle
 * --------------------------------
 * `npm run backup` writes a bundle, which is a copy somebody has to remember to
 * make and then carry somewhere. A mirror is the other half: the same history,
 * pushed to a host that is not GitHub, one push behind on every push — so the
 * second copy is never more than a commit old and needs no memory at all.
 *
 * Where it goes, in the order it is looked for
 * -------------------------------------------
 *   1. `--to <url>`
 *   2. the `mirror` git remote (`git remote add mirror <url>` — set once)
 *   3. `MIRROR_URL`, with `MIRROR_TOKEN` / `MIRROR_USER` if the target is private
 *
 * Nothing is pushed unless it was asked for: an unconfigured run explains how to
 * configure it instead of guessing a host and publishing a copy of this
 * repository somewhere nobody chose.
 *
 * What it does, and what it deliberately does not
 * -----------------------------------------------
 * It pushes every local branch and tag and then **verifies the result by asking
 * the target for its refs** — a push that returned 0 while leaving the target
 * behind fails here, because an unverified mirror is the same hope a bundle
 * nobody restored is.
 *
 * It does *not* use `git push --mirror`, which would delete any ref that exists
 * on the target but not here: a backup of someone's work should never be the
 * thing that removes it. It also does not mirror what a git host keeps outside
 * the repository — issues, pull requests, Actions secrets, Pages settings, or
 * the 44 MB brand drop in `/asset/` (see RESTORE.md).
 *
 * Exit code 0 = pushed and verified (or, with --optional, nothing to do),
 * 1 = not mirrored.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "..", "..");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const OPTIONAL = flag("--optional");
const SELF_TEST = flag("--self-test");
const TO_FLAG = option("--to", "");
/** Where a self-test builds its throwaway bare repository. Gitignored. */
const DRILL = path.resolve(REPO_ROOT, ".mirror-drill");

/* ── secrets never reach a log ────────────────────────────────────────────── */

const secrets = () =>
  [process.env.MIRROR_TOKEN, process.env.MIRROR_PASSWORD].filter((value) => value && value.length > 3);

/**
 * Everything this script prints goes through here first.
 *
 * A push URL carries the credential, git echoes the URL back, and CI logs are
 * forever. Two shapes are covered: `scheme://user:password@host` and
 * `scheme://token@host`. The scheme and host survive so a failure is still
 * readable.
 */
function redact(text) {
  let out = String(text);
  for (const secret of secrets()) out = out.split(secret).join("***");
  return out
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/@\s]+:[^/@\s]+@/gi, "$1***:***@")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/gi, "$1***@");
}

const say = (line = "") => console.log(redact(line));
const complain = (line = "") => console.error(redact(line));

/* ── git ──────────────────────────────────────────────────────────────────── */

/**
 * Run git in the repository and return its output.
 *
 * Output is captured rather than inherited for the one command that prints a URL
 * with credentials in it. Callers that want the user to see something print it
 * themselves, through `say()`.
 */
function git(args, { cwd = REPO_ROOT } = {}) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr).trim() : error.message;
    throw new Error(`git ${args[0]} failed:\n${redact(stderr)}`);
  }
}

const tryGit = (args) => {
  try {
    return git(args).trim();
  } catch {
    return "";
  }
};

/* ── the target ───────────────────────────────────────────────────────────── */

/**
 * The URL to push to, with credentials applied if they were supplied separately.
 *
 * A URL that already carries them (`https://user:token@host/…`, which is how a
 * CI secret is usually stored) is used as it is. An SSH URL
 * (`git@host:owner/repo.git`) is left alone entirely: it authenticates with a
 * key, and there is nothing for this script to insert.
 */
function resolveTarget() {
  const raw = TO_FLAG || tryGit(["remote", "get-url", "mirror"]) || (process.env.MIRROR_URL || "").trim();
  if (!raw) return "";

  const token = (process.env.MIRROR_TOKEN || "").trim();
  if (!token) return raw;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    /* Not a URL this can parse — an scp-style SSH remote, most likely. */
    return raw;
  }

  if (parsed.username || parsed.password) return raw;

  /* `MIRROR_USER` when the host wants a real account name; otherwise the token
     itself, which is what Gitea/Forgejo and several other hosts accept. */
  parsed.username = (process.env.MIRROR_USER || "").trim() || token;
  parsed.password = token;
  return parsed.toString();
}

/* ── refs, both sides ─────────────────────────────────────────────────────── */

/** Every branch and tag here, as `refname` → object id. */
function localRefs() {
  const out = git(["for-each-ref", "--format=%(refname) %(objectname)", "refs/heads", "refs/tags"]);
  return new Map(
    out
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [ref, sha] = line.split(" ");
        return [ref, sha];
      }),
  );
}

/**
 * What the target's `HEAD` resolves to.
 *
 * Worth asking, because a host hands a new repository a default branch — `main`
 * on GitHub and Codeberg today, `master` on anything older — and if that is not
 * the branch being pushed, the mirror still holds every commit while browsing it
 * shows nothing and a plain `git clone` checks out nothing. A copy that looks
 * empty is worse than no copy: nobody investigates a directory that seems to
 * have worked.
 *
 * Three answers are possible, and the middle one is why this reads `ls-remote`
 * rather than trusting a pattern to match:
 *
 *   `ref: refs/heads/main` and a commit id  → healthy
 *   a commit id, no `ref:` line             → the host does not advertise symref
 *                                             (fine: HEAD resolves somewhere)
 *   nothing at all                          → HEAD points at a branch that does
 *                                             not exist, which is the state a
 *                                             fresh repository is left in when
 *                                             its default branch is not ours
 */
function targetHead(url) {
  const out = tryGit(["ls-remote", "--symref", url, "HEAD"]);
  const symbolic = out.match(/^ref:\s+(\S+)\s+HEAD$/m);
  const resolves = /^[0-9a-f]{7,40}\tHEAD$/m.test(out);
  return { ref: symbolic ? symbolic[1] : "", resolves };
}

/** Every branch and tag the target reports. `--refs` drops the peeled `^{}` lines. */
function targetRefs(url) {
  const out = git(["ls-remote", "--refs", "--heads", "--tags", url]);
  return new Map(
    out
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [sha, ref] = line.split("\t");
        return [ref, sha];
      }),
  );
}

/* ── main ─────────────────────────────────────────────────────────────────── */

async function main() {
  let target = resolveTarget();
  let selfTest = false;

  if (SELF_TEST) {
    if (target) {
      say(`\n  --self-test ignores the configured target and uses a local bare repository.\n`);
    }
    await rm(DRILL, { recursive: true, force: true });
    await mkdir(DRILL, { recursive: true });
    const bare = path.join(DRILL, "mirror.git");
    git(["init", "--bare", "--quiet", bare]);
    /* A host would have set this when the repository was created. Done here so
       the self-test exercises the same path a real target takes, rather than
       tripping over a scratch repository that was never configured. */
    const current = git(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
    git(["symbolic-ref", "HEAD", `refs/heads/${current}`], { cwd: bare });
    target = bare;
    selfTest = true;
  }

  if (!target) {
    const instructions = `
  No mirror target is configured, so nothing was pushed.

  One-time setup — any second host works (Codeberg, GitLab, Bitbucket, a
  self-hosted Gitea). Create an empty repository there, then either:

    git remote add mirror <url>          # once per clone, then: npm run mirror
    export MIRROR_URL=<url>              # or per shell
    export MIRROR_URL=<url> MIRROR_TOKEN=<token>   # private target

  In GitHub, add MIRROR_URL and MIRROR_TOKEN as repository secrets and
  .github/workflows/mirror.yml keeps the copy current on every push.
  MIRROR.md has the whole setup, including what a mirror does not contain.
`;
    if (OPTIONAL) {
      say(`\n  Mirror not configured — set MIRROR_URL (see MIRROR.md). Nothing to do.\n`);
      process.exit(0);
    }
    complain(instructions);
    process.exit(1);
  }

  const head = git(["rev-parse", "HEAD"]).trim();
  const shortHead = head.slice(0, 7);
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  const commits = Number(git(["rev-list", "--count", "HEAD"]).trim());
  const local = localRefs();

  say(`\n  Mirroring ${branch} at ${shortHead} (${commits} commits, ${local.size} ref${local.size === 1 ? "" : "s"})`);
  say(`  to ${target}${selfTest ? "  (self-test: a local bare repository)" : ""}\n`);

  /* Push. `--porcelain` is the stable, machine-readable form; the lines are
     printed through redact() because they name refs and the remote. */
  for (const args of [["push", "--porcelain", target, "--all"], ["push", "--porcelain", target, "--tags"]]) {
    const output = git(args);
    for (const line of output.split("\n").map((entry) => entry.trim()).filter(Boolean)) say(`  ${line}`);
  }

  /* Verify against the target's own answer, not against the push's exit code. */
  const remote = targetRefs(target);
  const missing = [];
  const different = [];

  for (const [ref, sha] of local) {
    if (!remote.has(ref)) missing.push(ref);
    else if (remote.get(ref) !== sha) different.push(`${ref} is ${remote.get(ref).slice(0, 7)}, should be ${sha.slice(0, 7)}`);
  }

  const extra = [...remote.keys()].filter((ref) => !local.has(ref));

  /* The target's default branch has to resolve to something that just arrived,
     or the mirror is browsable nowhere and clones empty. */
  const defaultBranch = targetHead(target);
  const danglingHead = defaultBranch.resolves
    ? ""
    : defaultBranch.ref || "refs/heads/(unknown)";

  if (missing.length > 0 || different.length > 0) {
    complain(`\n✗ The mirror does not match this repository:\n`);
    for (const ref of missing) complain(`    missing on the target: ${ref}`);
    for (const line of different) complain(`    ${line}`);
    complain(`\n  Pushed but not equal, which is a failure rather than a warning: a second copy`);
    complain(`  that disagrees with the first is worse than knowing there is no second copy.\n`);
    process.exit(1);
  }

  /* What a restored copy would be: cloned from the target, at this commit, with
     the same number of commits. The self-test proves that end to end. */
  let proof = "";
  if (selfTest) {
    const clone = path.join(DRILL, "clone");
    /* `--branch` explicitly: the point of the drill is that the commits arrived,
       and it should not depend on the throwaway repository's own HEAD. */
    git(["clone", "--quiet", "--branch", branch, target, clone]);
    const cloneHead = git(["rev-parse", "HEAD"], { cwd: clone }).trim();
    const cloneCommits = Number(git(["rev-list", "--count", "HEAD"], { cwd: clone }).trim());

    if (cloneHead !== head || cloneCommits !== commits) {
      complain(
        `\n✗ A clone of the mirror is at ${cloneHead.slice(0, 7)} with ${cloneCommits} commits,\n` +
          `  not ${shortHead} with ${commits}. Left in place: ${path.relative(REPO_ROOT, DRILL)}\n`,
      );
      process.exit(1);
    }

    proof = `clones to ${shortHead} with all ${cloneCommits} commits`;
  }

  say(`  verified  ${local.size} ref${local.size === 1 ? "" : "s"} match on the target, by object id`);
  if (extra.length > 0) {
    say(`  note      ${extra.length} ref(s) exist only on the target and were left alone:`);
    for (const ref of extra.slice(0, 5)) say(`              ${ref}`);
  }
  if (proof) say(`  restored  ${proof}`);

  if (danglingHead) {
    complain(
      `\n✗ The target's default branch is ${danglingHead}, which is not a branch this\n` +
        `  repository has — so ${branch} was pushed but the mirror shows nothing when browsed\n` +
        `  and a plain \`git clone\` of it checks out no files.\n\n` +
        `  Fix it on the host: set the repository's default branch to ${branch}\n` +
        `  (Codeberg: Settings → Branches; GitLab: Settings → Repository → Default branch).\n`,
    );
    process.exit(1);
  }

  if (selfTest) {
    await rm(DRILL, { recursive: true, force: true });
    say(`\n✓ Mirror mechanism verified — this repository pushes to a bare repository, the refs match,`);
    say(`  and a clone of it is this repository. No host, account or credential was involved.`);
    say(`  The throwaway copy has been removed.\n`);
  } else {
    say(`\n✓ Mirrored to ${target} — ${local.size} ref${local.size === 1 ? "" : "s"}, ${commits} commits, ${shortHead}.`);
    say(`  This is a full copy of the history on a host that is not GitHub.\n`);
  }
}

if (!existsSync(path.join(REPO_ROOT, ".git"))) {
  console.error(`\n✗ Not a git repository: ${REPO_ROOT}\n`);
  process.exit(1);
}

main().catch((error) => {
  console.error(redact(error.message));
  process.exit(1);
});
