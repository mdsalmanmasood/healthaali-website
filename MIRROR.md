# Mirroring this repository to a second host

GitHub is where this site is hosted, built from and deployed by. That makes it
the one place where losing access means losing the ability to rebuild the site;
this directory's code and writing exist nowhere else that a machine can reach.

Two mechanisms fix that, and they are different things:

| | What it is | Who makes it happen | How current it stays |
| --- | --- | --- | --- |
| **`npm run backup`** | a `git bundle` — the whole history in one file | you, when you remember; then you carry the file somewhere | as current as the last run — see [RESTORE.md](RESTORE.md) |
| **`npm run mirror`** | the same history, *pushed* to another host | the `mirror.yml` workflow, on every push to `main` | one push behind, always |

The mirror is the one that needs no memory: once it is configured, every push to
`main` copies the repository somewhere else, and a daily run catches the case a
push cannot — a revoked token or a renamed repository, where the workflow is fine
and the copy has quietly stopped updating.

## One-time setup (about two minutes)

**1. Create an empty repository on the second host.** Any host that speaks git:
Codeberg, GitLab, Bitbucket, a self-hosted Gitea/Forgejo. Do not initialise it
with a README — the push brings everything.

**2. Point this clone at it, or give the workflow a secret.**

```bash
# Local, one command to re-run any time you want a fresh copy:
git remote add mirror https://codeberg.org/<you>/healthaali-website.git
npm run mirror

# Or per shell, without touching the clone's remotes:
MIRROR_URL=https://codeberg.org/<you>/healthaali-website.git npm run mirror
```

For a **private** target, the URL needs a credential. Either put it in the URL
itself, or keep it separate:

```bash
MIRROR_URL=https://codeberg.org/<you>/healthaali-website.git \
MIRROR_TOKEN=<push token> \
npm run mirror
```

An SSH URL (`git@codeberg.org:<you>/healthaali-website.git`) is used as-is: it
authenticates with a key, and there is nothing for the script to insert.

**3. For the automatic case, add the secrets in GitHub.** Repository → Settings →
Secrets and variables → Actions:

| Secret | Required | What it is |
| --- | --- | --- |
| `MIRROR_URL` | yes | the target's clone URL. Setting it is what switches the mirror on |
| `MIRROR_TOKEN` | for a private target | a push token for that host |
| `MIRROR_USER` | sometimes | the account name, when the host will not accept the token as the username |

Until `MIRROR_URL` exists, the workflow reports `Mirror not configured` and
passes — an item that has not been done yet is outstanding, not broken. The
*mechanism* is still tested on every push, so it cannot rot while you decide.

## The one command someone can re-run

```bash
cd website
npm run mirror                      # to the target above (--to <url> to override)
npm run mirror -- --self-test        # prove it works, with no host at all
npm run mirror -- --optional         # do not fail when nothing is configured
```

It resolves the target in this order: `--to`, then the `mirror` remote, then
`MIRROR_URL`. With nothing configured it prints the setup above rather than
guessing a host and publishing a copy of this repository somewhere nobody chose.

**What it does, in order:**

1. prints `main` at the current commit, and how many refs and commits that is;
2. pushes **every branch and tag** (`--all` then `--tags`);
3. asks the target for its refs and compares them to ours **by object id** — a
   push that returned 0 while leaving the target behind fails here;
4. checks that the target's default branch actually resolves, because a fresh
   repository whose default is `master` will hold every commit while browsing it
   shows nothing and `git clone` checks out no files — a copy that looks empty is
   worse than no copy, since nobody investigates a directory that seems to work;
5. with `--self-test`, clones the result and confirms it is this repository at
   this commit with this many commits, then deletes the throwaway copy.

It never deletes anything on the target. `git push --mirror` would also remove
refs that exist only there — the wrong default for a backup of someone's work —
so the push is additive by design. It also never prints a credential: output goes
through a redaction pass, because git echoes the remote URL and CI logs are
forever.

Exit code 0 means pushed and verified. Anything else is a failure with the reason
in the output.

## What a mirror does not contain

Same gaps as a bundle, plus the host-side things GitHub holds:

| Not mirrored | Where it lives | Restore with |
| --- | --- | --- |
| `/asset/` — the 44 MB brand drop | only on the machine the site was built on | it is gitignored on purpose (LAUNCH.md §4); copy it off the machine by hand. The *derived* images the site serves are committed, so a restored clone builds identically |
| Issues, pull requests, Actions secrets | GitHub | re-create as needed; the workflows are in the repository, the secrets are not |
| Pages project, DNS records, the GitHub App grant | Cloudflare dashboards | LAUNCH.md §1–§3 |
| The deployed build | regenerated on push | `npm ci && npm run build` |

## Restoring *from* the mirror

If GitHub is gone, the mirror is a full clone source. Follow
[RESTORE.md](RESTORE.md) with the mirror's URL in place of the bundle:

```bash
git clone https://codeberg.org/<you>/healthaali-website.git
cd healthaali-website
git log --oneline -5              # the history is there, not just the latest files
```

Then push it to a new GitHub repository — or to whatever host you are using
instead — and re-point the Pages project at it, as RESTORE.md §3 describes. The
Cloudflare side is unchanged: Pages builds from a repository, whichever one it is.
