/**
 * HealThaali — repository backup
 * ------------------------------
 *   npm run backup                  bundle the whole history, then verify it
 *   npm run backup -- --drill       also restore it and build, in a scratch dir
 *   npm run backup -- --out <file>  write somewhere other than ../backups/
 *
 * Why a bundle and not a zip or a copy of the folder
 * -------------------------------------------------
 * `git bundle` writes the whole repository — every commit, every ref — into one
 * file, and that file is a *git remote*: `git clone backup.bundle` produces a
 * working repository with its history intact. A zip of the working tree is not a
 * backup of this project: it cannot be cloned, it loses the history that explains
 * every decision in it, and whatever was half-edited at the moment it was taken
 * is captured as if it were finished. One file, 7 MB, and the restore is one
 * command that a person who has never seen this repository can run.
 *
 * What it holds, and what it cannot
 * --------------------------------
 * The bundle contains **commits**. Anything not committed is not in it — hence
 * the dirty-tree warning below, which fails a `--drill` outright rather than
 * producing a backup that is quietly missing the work in progress. It also does
 * not contain anything the repository deliberately ignores: the 44 MB brand drop
 * in `/asset/` (the input images the site's assets were derived from), or the
 * dashboard settings in LAUNCH.md — those are documented, not backed up. See
 * RESTORE.md, which is written to be read by someone with no context at all.
 *
 * Why it lives outside the repository
 * -----------------------------------
 * `backups/` is gitignored. A backup inside the history it backs up survives
 * exactly the failures the history survives, which is none of them. The file is
 * meant to be copied somewhere else — cloud storage, another machine, a USB
 * stick — and the manifest printed beside it says so.
 *
 * Exit code 0 = bundle written and verified (and restored, with --drill),
 * 1 = it was not.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
/** `website/scripts` → the repository root, which is what gets bundled. */
const REPO_ROOT = path.resolve(here, "..", "..");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const DRILL = flag("--drill");
const KEEP = flag("--keep");
const BACKUP_DIR = path.resolve(REPO_ROOT, option("--dir", "backups"));
/** Where a drill restores to. Gitignored, and removed afterwards on success. */
const DRILL_ROOT = path.resolve(REPO_ROOT, ".restore-drill");

/* ── git, safely ──────────────────────────────────────────────────────────── */

const git = (args, options = {}) =>
  execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", ...options });

const gitQuiet = (args) => git(args, { stdio: ["ignore", "pipe", "pipe"] }).trim();

/**
 * npm, however it was started.
 *
 * `npm_execpath` is set whenever this runs through an npm script and points at
 * npm's own entry file, so running it with the current Node binary works on
 * every platform. Invoked directly with `node scripts/backup.mjs` there is no
 * such variable, and Windows needs the shell to find `npm.cmd`.
 */
function runNpm(args, cwd) {
  const cli = process.env.npm_execpath;
  if (cli) return execFileSync(process.execPath, [cli, ...args], { cwd, stdio: "inherit" });
  return execFileSync("npm", args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** `2026-10-01T19:40:00Z` → `2026-10-01-1940`, for a file name that sorts. */
const stamp = (date) =>
  date.toISOString().slice(0, 16).replace("T", "-").replace(":", "");

/**
 * Files the build reads that are *not* in the repository, so the manifest does
 * not imply a restored clone rebuilds the identical site from nothing.
 */
const NOT_IN_THE_BUNDLE = [
  "/asset/ — the 44 MB brand drop: the input images every site asset was derived from (gitignored, LAUNCH.md §4)",
  "Cloudflare, DNS and registrar settings — documented in LAUNCH.md, not stored anywhere machine-readable",
  "The deployed build itself — regenerate with `npm ci && npm run build` in website/",
];

/* ── main ─────────────────────────────────────────────────────────────────── */

async function main() {
  const now = new Date();
  const target = path.join(BACKUP_DIR, `healthaali-website-${stamp(now)}.bundle`);

  /* The one thing a bundle cannot carry is uncommitted work. Say so before
     writing anything, so a green run is never mistaken for a complete one. */
  const dirty = gitQuiet(["status", "--porcelain"]);
  if (dirty) {
    const lines = dirty.split("\n");
    console.error(
      `\n! The working tree is not committed — ${lines.length} changed path(s) will NOT be in this bundle:\n`,
    );
    for (const line of lines.slice(0, 10)) console.error(`    ${line}`);
    if (lines.length > 10) console.error(`    … ${lines.length - 10} more`);
    console.error(
      `\n  A bundle records commits, so anything uncommitted is simply absent from it.\n` +
        (DRILL
          ? `  Commit first, or run without --drill to bundle what is committed anyway.\n`
          : `  Commit and re-run for a backup that is complete.\n`),
    );
    if (DRILL) process.exit(1);
  }

  await mkdir(BACKUP_DIR, { recursive: true });

  /* Create. `--all` records every branch and tag, not just the current one. */
  console.log(`\n  Bundling the whole repository\n`);
  git(["bundle", "create", target, "--all"], { stdio: ["ignore", "inherit", "inherit"] });

  /* Verify. This is git's own answer, not ours: it checks the pack is intact,
     that the refs inside it are all present, and that no prerequisite this
     repository does not already have is missing. */
  const verification = gitQuiet(["bundle", "verify", target]);

  if (!/complete history|prerequisite/i.test(verification)) {
    console.error(`\n✗ git did not confirm this bundle is complete:\n\n${verification}\n`);
    process.exit(1);
  }

  const head = gitQuiet(["rev-parse", "HEAD"]);
  const shortHead = head.slice(0, 7);
  const commits = Number(gitQuiet(["rev-list", "--count", "HEAD"]));
  const branch = gitQuiet(["rev-parse", "--abbrev-ref", "HEAD"]);
  const tracked = Number(gitQuiet(["ls-files"]).split("\n").filter(Boolean).length);
  const { size } = await stat(target);
  const refs = verification
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[0-9a-f]{7,40} refs\//.test(line));

  const relative = path.relative(REPO_ROOT, target).split(path.sep).join("/");

  /* A manifest beside the bundle, because the bundle is only useful to whoever
     finds it if it says what it is and what is missing from it. */
  const manifest = `HealThaali — repository backup
==============================

Taken      ${now.toISOString()}
Bundle     ${path.basename(target)}
From       ${branch} at ${shortHead} (${commits} commits, ${tracked} tracked files, ${mb(size)})
Length     the complete history: this is a full clone source, not a patch

What is inside
--------------
Every commit and every ref in the repository, as of ${shortHead}. Restore it with
\`git clone\` — see RESTORE.md beside this file in the repository, or the four
lines below.

    git clone ${path.basename(target)} healthaali-website
    cd healthaali-website/website
    npm ci
    npm run build          # → dist/ — 51 pages plus 404.html

Refs recorded (${refs.length})
${refs.map((line) => `    ${line}`).join("\n") || "    (none listed)"}

What is NOT inside — a restored clone is not yet the live site
-------------------------------------------------------------
${NOT_IN_THE_BUNDLE.map((line) => `  - ${line}`).join("\n")}

A bundle on this machine is not an off-machine backup. Copy it somewhere else —
cloud storage, another computer, a USB stick — and keep the copy out of the
working repository: backups/ is gitignored for exactly this reason.

Made by \`npm run backup\` (website/scripts/backup.mjs).
`;

  await writeFile(`${target}.txt`, manifest, "utf8");

  console.log(`  written   ${relative} (${mb(size)})`);
  console.log(`  verified  complete history — ${commits} commit(s), ${refs.length} ref(s), from ${shortHead}`);
  console.log(`  manifest  ${relative}.txt`);
  console.log(`  contents  commits only: /asset/ and the dashboard settings are not in it (see RESTORE.md)`);

  /* The drill: would this file actually restore? */
  let restored = null;

  if (DRILL) {
    const scratch = path.join(DRILL_ROOT, stamp(now));

    await rm(DRILL_ROOT, { recursive: true, force: true });
    await mkdir(DRILL_ROOT, { recursive: true });

    console.log(`\n  Drill — restoring this bundle into ${path.relative(REPO_ROOT, scratch).split(path.sep).join("/")}/ and building it\n`);

    /* Cloning from a bundle is cloning from any other source; the local path and
       the bundle are the only two things this needs. */
    git(["clone", target, scratch], { stdio: ["ignore", "inherit", "inherit"] });

    const restoredHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: scratch, encoding: "utf8" }).trim();
    if (restoredHead !== head) {
      console.error(`\n✗ The restored clone is at ${restoredHead.slice(0, 7)}, not ${shortHead}.\n`);
      process.exit(1);
    }

    const siteDir = path.join(scratch, "website");
    console.log("");
    runNpm(["ci"], siteDir);
    runNpm(["run", "build"], siteDir);

    /* A build that exits 0 while emitting nothing would still be a failed
       restore, so the output is inspected rather than trusted. */
    const built = path.join(siteDir, "dist");
    const pages = existsSync(built) ? countIndexFiles(built) : 0;
    const hubs = ["no-oil-recipes", "high-protein-recipes", "weight-loss-recipes"].filter((slug) =>
      existsSync(path.join(built, slug, "index.html")),
    );

    if (pages === 0 || hubs.length !== 3) {
      console.error(
        `\n✗ The restored clone built ${pages} page(s) and ${hubs.length}/3 topic page(s).\n` +
          `  Left in place for inspection: ${path.relative(REPO_ROOT, scratch).split(path.sep).join("/")}/\n`,
      );
      process.exit(1);
    }

    restored = { scratch, pages, hubs: hubs.length };

    if (!KEEP) await rm(DRILL_ROOT, { recursive: true, force: true });
  }

  console.log("");
  if (restored) {
    console.log(
      `✓ Backup verified and restored — cloned at ${shortHead}, npm ci clean, ` +
        `${restored.pages} page(s) built including all ${restored.hubs} topic page(s).` +
        (KEEP ? `\n  The restored copy is still at ${path.relative(REPO_ROOT, restored.scratch).split(path.sep).join("/")}/.` : ``),
    );
  } else {
    console.log(
      `✓ Backup written and verified — ${relative}, ${mb(size)}, complete history at ${shortHead}.\n` +
        `  Restoring it has not been tested by this run: \`npm run backup -- --drill\` does that, and\n` +
        `  takes about a minute (it runs \`npm ci\` and a full build in a scratch clone).`,
    );
  }
  console.log(
    `  Copy ${relative} somewhere other than this machine. Nothing else here is a backup.\n`,
  );
}

/** How many pages a restored build produced: one per `index.html`. */
function countIndexFiles(dir) {
  let count = 0;
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.html") count += 1;
    }
  };
  walk(dir);
  return count;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
