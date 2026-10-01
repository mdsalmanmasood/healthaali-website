# Restoring this website from a backup

You are reading this because you have a `.bundle` file and no idea what it is.
It is the complete HealThaali website repository — every commit — in one file,
and it is enough on its own to rebuild the code, the content and the live site.
Nothing here assumes you have seen this project before.

```
healthaali-website-2026-10-01-1940.bundle       the repository
healthaali-website-2026-10-01-1940.bundle.txt   what is in it, what is not, and which commit
```

## 1. Restore the repository (2 minutes, no accounts needed)

A bundle is a git remote, so it is restored by cloning, exactly like a server:

```bash
git clone healthaali-website-2026-10-01-1940.bundle healthaali-website
cd healthaali-website
git log --oneline -5              # the history is there, not just the latest files
git bundle verify ../healthaali-website-2026-10-01-1940.bundle   # optional: re-check the file
```

If you only have the file and no copy of this document, the four commands above
are the whole procedure — everything after this point is about putting the site
back *online*.

## 2. Build the site (2 minutes, needs Node and network)

The website is the `website/` subdirectory of the repository; the repository root
has no `package.json`, which is the usual first stumble.

```bash
cd website
npm ci                # installs exactly the versions in the committed lockfile
npm run build         # → dist/, 51 pages plus dist/404.html
npm run verify        # every gate: links, weights, accessibility, SEO invariants
```

`npm ci` is deliberate rather than `npm install`: it installs the lockfile as
written and fails if the lockfile and `package.json` disagree, which is the check
you want when rebuilding someone else's project from a file.

To see it in a browser: `npm run preview` (or any static server pointed at
`website/dist/`).

## 3. Put it back online (10 minutes, needs the Cloudflare account)

The live site is a **Cloudflare Pages** project that builds from a GitHub
repository — there is no server to restore, only a project to point at the code.

1. Push the restored clone to a GitHub repository (the original is
   `mdsalmanmasood/healthaali-website`, `main`).
2. In Cloudflare, a Pages project named `healthaali` with: production branch
   `main`, **root directory `website`**, build command `npm run build`, output
   directory `dist`, Node version from the committed `website/.nvmrc`. The root
   directory is the setting that breaks the build when it is missed.
3. Attach `healthaali.in` and `www.healthaali.in` as custom domains. Because the
   DNS zone is in the same account, Cloudflare writes the CNAME records itself.
   Do **not** add an apex `A` record: it blocks Pages from claiming the hostname.

`LAUNCH.md` in the restored repository is the full, corrected list of settings —
registrar, DNS, the Pages project, environment variables, the GitHub App grant —
written for exactly this moment. Read §1–§4 before changing anything.

## What is *not* in the bundle

A restored clone builds and serves the same website, but four things live
outside the repository and cannot be inside it:

| Missing | Where it lives | Consequence |
| --- | --- | --- |
| `/asset/` — the 44 MB brand drop, 164 files | only ever on the machine the site was built on (it is gitignored on purpose) | the site still builds and looks identical: the *derived* images are committed. What is lost is the ability to re-derive them at other sizes, or to extend the asset set |
| Cloudflare, DNS and registrar settings | dashboards, described in `LAUNCH.md` | recreate by hand, using that file as the source of truth |
| The deployment itself | Cloudflare Pages | rebuilds from the repository on push; the built output is not kept in the bundle |
| The YouTube channel's videos | YouTube (`@healthaali`) | not needed: `website/src/data/recipes.json` is a committed snapshot, and the nightly sync regenerates it from the channel's feed |

## Making a new one

From `website/` in a real checkout:

```bash
npm run backup            # writes ../backups/healthaali-website-<date>.bundle + a manifest
npm run backup -- --drill # the same, then restores it into a scratch clone and builds it
```

Two things worth knowing about the output:

- **A bundle records commits, so uncommitted work is not in it.** The command
  warns when the tree is dirty and refuses to drill a dirty tree, because a green
  run must never be mistaken for a complete backup.
- **The file is written to `backups/`, which is gitignored.** An off-machine
  backup is the point: copy it to cloud storage, another computer, or a USB
  stick. A bundle that only exists on the machine it came from is not a backup.

`--drill` is the part that matters over time. A backup nobody has restored is a
hope, so the drill clones the bundle, installs from the lockfile, runs a full
build and checks that the topic pages came out — roughly a minute, and it fails
loudly if the file has quietly stopped being restorable.
