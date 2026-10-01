# Launch settings — the parts that live outside this repository

Everything on this page is configured in a dashboard. None of it can be
discovered by reading the code, and none of it is covered by `npm run verify` or
by CI. The values below are what is actually configured, as of
**1 October 2026**.

If you are picking this project up later, read this before changing anything
about hosting or DNS: several of these settings fail *silently* when they are
missing, and two of them (an apex `A` record, or GoDaddy nameservers) will
actively break the site.

## Status at a glance

**Live since 1 October 2026.** `https://healthaali.in` and
`https://www.healthaali.in` both serve the Pages project, each with its own
valid certificate.

- [x] Domain registered and registrar verification (KYC) cleared
- [x] Repository pushed to GitHub; CI green
- [x] Cloudflare zone active; GoDaddy nameservers replaced
- [x] Pages project created from the repository
- [x] `healthaali.in` and `www.healthaali.in` attached as custom domains
- [x] First production deployment succeeded — `b0a782f`, the repository HEAD
- [x] Uptime workflow green — `Uptime #4`, dispatched by hand against
      `40f8b0c`, is the first run to pass: all four paths 200 in under a third of
      a second, certificate 89 days out. The scheduled run before it failed only
      because it predated the domain answering
- [ ] `info@healthaali.in` can receive mail — no MX records exist yet
- [ ] A repository bundle copied somewhere **off this machine** —
      `npm run backup` writes one, §8; nothing in the repository can make the copy
      that matters
- [ ] A second git host keeping a mirror of this repository — `npm run mirror`
      does the push and verifies it; `mirror.yml` switches on the moment a
      `MIRROR_URL` secret exists (§8, `MIRROR.md`)
- [ ] Google Search Console: the property verified and `sitemap-index.xml`
      submitted — see §7. Nothing about the site's ranking can be measured until
      this exists, because this is the only place the queries it is found for
      are reported

`npm run check:launch` re-derives every line above from public DNS, RDAP and
HTTPS. It marks items that are merely not done yet with `○` and exits non-zero
only for real problems, so it is safe to run on any morning. With a read-only
`CLOUDFLARE_API_TOKEN` in the environment it checks the dashboard settings
themselves too — see §5.

## 1. Registrar — GoDaddy (registration only, no DNS)

| Setting | Value |
| --- | --- |
| Domain | `healthaali.in` |
| Registered / expires | 28 Sep 2026 → 28 Sep 2027 |
| Auto-renew | **must stay on** — it was off at launch |
| Nameservers | `amber.ns.cloudflare.com`, `remy.ns.cloudflare.com` |
| Was | `ns51.domaincontrol.com`, `ns52.domaincontrol.com` (replaced 30 Sep 2026) |

- **Turn auto-renew on and leave it on.** If the domain lapses, the site, the
  published email address and the brand go with it.
- **Answer any registrar verification request immediately.** Between 28 and 30
  September the domain sat on registry `client hold` — published by nobody,
  resolving nowhere — purely because verification was outstanding. A `client
  hold` is invisible in the dashboard's normal view and total in effect.
- Since the nameserver change, **DNS is edited in Cloudflare only**; GoDaddy's
  DNS page is read-only for this domain.
- Decline the upsells: *Connect Email* (use Cloudflare Email Routing instead) and
  the domain protection plans.

## 2. Cloudflare zone — `healthaali.in`

- Account `92269d1e218ec2efd663a454a2d59954` (a dashboard identifier, not a
  credential), Free plan, zone added 30 Sep 2026, status **Active**.

**The zone deliberately holds no manually created records.** Do not re-import
the GoDaddy parking entries the scan originally offered:

| Record that must NOT exist | Why |
| --- | --- |
| `A @ → 3.33.130.190`, `15.197.148.33` | an apex `A` record blocks Pages from claiming the hostname |
| `CNAME www → healthaali.in` | points `www` at the apex instead of the project |

Once the custom domains are attached, Pages creates these itself — do not add
them by hand:

| Record | Target | Proxy |
| --- | --- | --- |
| `healthaali.in` | CNAME → `<project>.pages.dev` (Cloudflare flattens it at the apex) | proxied |
| `www.healthaali.in` | CNAME → `<project>.pages.dev` | proxied |

Proxying must stay on: Pages serves these hostnames through Cloudflare's edge,
and the certificate is issued on the zone. There is no origin server, so no `A`
or `AAAA` record belongs on the apex.

**Mail:** there are no `MX` or `TXT` records, so `info@healthaali.in` — the
address the site publishes — cannot receive mail yet. Cloudflare Email Routing
(free) fixes it when you are ready.

## 3. Cloudflare Pages project

| Setting | Value |
| --- | --- |
| Project name | `healthaali` → `https://healthaali.pages.dev` |
| Git | GitHub `mdsalmanmasood/healthaali-website` |
| Production branch | `main` |
| Root directory (advanced) | `website` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Build watch paths — include | `*` (the dashboard default, left as-is) |
| Build watch paths — exclude | *(empty)* |
| Build cache (Beta) | Disabled (also the default) |
| Build system version | 3 |
| Node version | from the committed `website/.nvmrc` (22) |

- **Root directory is the setting that breaks the build when missed.** The
  repository root has no `package.json`; without it the build runs in the wrong
  place and fails.
- **Do not set `NODE_VERSION`.** A committed `.nvmrc` takes precedence over the
  dashboard variable, so the two would silently disagree.
- **Build watch paths** were left at the dashboard default, `*`: every push
  rebuilds, including commits that touch only `.github/` or the files at the
  root. Narrowing *include* to `website/*` would scope rebuilds to the site —
  wildcards match across `/`, so that covers nested files such as
  `website/src/pages/index.astro`. That is a saving rather than a correctness
  fix, and the project was created without it. Pages ignores path matching and
  always builds when a push has no file changes, or spans 3000+ files / 20+
  commits.
- **Custom domains** are added on the project's *Custom domains* tab:
  `healthaali.in` first, then `www.healthaali.in`. Because the zone sits in the
  same account, Cloudflare writes the records and issues the certificate.

Environment variables (*Settings* → *Environment variables*, Production scope;
adding one needs a redeploy). All are optional — with none set the build is the
honest "coming soon" state, which is what CI verifies:

| Variable | Effect when set |
| --- | --- |
| `PUBLIC_SITE_URL` | canonical origin; defaults to `https://healthaali.in` |
| `PUBLIC_WEBAPP_URL` | activates the web app link instead of "coming soon" |
| `PUBLIC_ANDROID_URL` | activates the Play Store link instead of "coming soon" |
| `PUBLIC_CONTACT_EMAIL` | shown on `/contact` and in the footer; blank keeps `info@healthaali.in` |
| `PUBLIC_CONTACT_ENDPOINT` | enables the contact form; until then the CSP omits `form-action` on purpose |
| `PUBLIC_ANALYTICS_ID` | Cloudflare Web Analytics token; empty means no analytics at all |
| `PUBLIC_GOOGLE_SITE_VERIFICATION` | Search Console ownership token, emitted as `<meta name="google-site-verification">`; unset emits no tag at all — see §7 |

Every pull request also gets a preview deployment; only `main` is production.

### Why `healthaali.pages.dev` can still be NXDOMAIN

The project exists and has deployed, so this is now a regression guide rather
than a to-do: every row still fails exactly the way it did before launch.

A Pages project is handed its `*.pages.dev` hostname by its **first successful
production deployment**. Until one lands, Cloudflare publishes no DNS record for
it at all, so the symptom is `NXDOMAIN` — not a 404, not a blank page, not a
certificate warning, and nothing that changes by waiting. One symptom, four
causes:

| What the project's *Deployments* tab shows | What it means | What to do |
| --- | --- | --- |
| no project, and the account lists none | it was never created — or it lives in a different Cloudflare account | create it above, or mint the token in the account that owns the zone |
| a project, but under another name | the name `healthaali` was taken, so the hostname is not the one anything expects | point the check at the real name with `--pages-project`, and read `<that-name>.pages.dev` |
| *No deployments yet* | the Git repository was never connected, or nothing has been pushed since | connect `mdsalmanmasood/healthaali-website`, then push to `main` |
| a failed deployment | the failing stage names the suspect: `clone_repo` is source access, `build` is the build command, `deploy` is publishing | fix that setting, then retry the deployment |
| only preview deployments | the production branch is not the branch being pushed | set it to `main` |
| a successful production deployment, yet the hostname still does not resolve | the disagreement is real, not slow — minutes is all provisioning takes | check the project is in the zone's account, then re-read the name |

`check:launch` reads every row of that table from the Cloudflare API when it is
given a read-only token, and prints the tail of a failed build's log (§5).

## 4. GitHub repository

- `mdsalmanmasood/healthaali-website`, public, default branch `main`, no secrets.

| Workflow | Trigger | What it gates |
| --- | --- | --- |
| `ci.yml` | push / PR to `main`, manual | install, typecheck, recipes, blog links and dates, build, placeholders, links, page weight, SEO invariants, a11y, the launch check's deep-mode tests |
| `sync-recipes.yml` | daily 03:00 UTC, manual | proposes the YouTube snapshot as a PR only when it really changed |
| `uptime.yml` | every six hours at :17, manual | probes the live domain and its certificate |
| `launch-check.yml` | every six hours at :47, manual | re-runs `check:launch`, so launch regressions are caught without anyone looking; also asserts the deployed revision comes from this repository |
| `mirror.yml` | push to `main`, daily at 04:23, manual | pushes every branch and tag to a second git host and verifies the refs by object id — the copy of this repository that is not GitHub (§8, `MIRROR.md`). Reports `not configured` and passes until the `MIRROR_URL` secret exists |

`uptime.yml` was red until the domain began serving the Pages project — the
intended signal, not a broken workflow. Now that it answers, a red run means a
real outage. `launch-check.yml` is the same idea one level deeper: it runs `check:launch` on a schedule, so a reinstated parking
record, a registrar hold, a lost CSP or a certificate running out of validity
fails a run instead of waiting to be noticed. It installs nothing but Node, so a
broken lockfile cannot disguise a deployment problem. Optionally set a read-only
`CLOUDFLARE_API_TOKEN` **repository secret** and it performs the deep checks
there too; without the secret it reports them as outstanding and passes.

GitHub disables scheduled workflows after 60 days without repository activity;
any commit resets that clock.

### The Cloudflare GitHub App

Cloudflare builds this project through the **Cloudflare Workers and Pages**
GitHub App. That is a GitHub-side grant: it is invisible in this repository, and
nothing here can notice it going away.

| | |
| --- | --- |
| Account | `mdsalmanmasood` (personal) |
| Repository access | **Only select repositories** → `healthaali-website` |
| Permissions | read metadata; read/write administration, checks, code, deployments, pull requests |
| Installed | 1 October 2026 |
| Manage or revoke | <https://github.com/settings/installations> |

- **"All repositories" was not granted.** One repository is all this needs, and
  a narrow grant is checkable later.
- **If it is revoked, deploys stop silently.** Pushing to `main` still succeeds,
  CI still passes, and nothing publishes; the only symptom is a project whose
  *Deployments* tab stops growing.
- The dashboard's *Create application* flow now offers Workers first. Pages sits
  behind **Continue to Pages** at the bottom of that page, and the repository list
  stays empty until this app is installed — with *Connect GitHub* as the way in.

### What is never committed, and why

The repository holds the website and everything needed to build it. Everything
else is ignored for one of two reasons: it is the *input* to the site rather than
the site, or it can be regenerated from what is committed. The root
`.gitignore` and `website/.gitignore` each carry one rule per reason — the sizes
below were measured on 1 October 2026.

| Path | Measured here | Why it is ignored |
| --- | --- | --- |
| `/asset/` | 44 MB, 164 files | The supplied brand drop, and the read-only **input** to `npm run assets` (`website/scripts/extract-assets.mjs`), which derives every image the site serves. For scale: the whole tracked repository is 7.5 MB, and the drop carries its own `node_modules` (sharp, `libvips-42.dll`). Committing it would grow a fresh clone from 7.5 MB to about 52 MB, to ship files that no build step reads. |
| `HealthAali_Astro_Website_Build_Guide.md` | 2,412 lines | The specification this site was built against, written for that one build. It is a working document, not repository documentation; the parts that outlive it are in `website/README.md` and this file. |
| `website/dist/` | 5.3 MB here | Generated output: rebuilt on every push and published by the host. A committed copy is a second version of the site, able to disagree with the source it came from. |
| `website/.astro/` | — | Astro's own build cache. |
| `website/node_modules/` | — | Installed dependencies, reproduced exactly from the committed `package-lock.json` by `npm ci`. |
| `website/.env`, `.env.local`, `.env.*.local` | — | Secrets and machine-specific overrides. `website/.env.example` documents the variable names and *is* committed. |
| `/.freebuff/` | — | Local agent tooling state. Nothing about the site depends on it, and it changes on every run. |
| `/backups/` | 7.2 MB per bundle | Off-machine backups from `npm run backup` (§8). A bundle of the whole history must not live inside the history it duplicates — the point is to copy it elsewhere. |
| `/.restore-drill/` | — | The scratch clone `npm run backup -- --drill` restores into and builds, to prove the bundle still restores. Removed again on success. |
| `/.mirror-drill/` | — | The throwaway bare repository `npm run mirror -- --self-test` pushes to, which proves the mirror mechanism with no second host and no credential. Removed again on success. |
| `lighthouse-*.json` | — | Reports from the manual measurement in §6: regenerated on demand, and a number in a file is not a record of anything. |
| `.DS_Store`, `Thumbs.db`, `Desktop.ini`, `*~` | — | Operating-system cruft, from either operating system. |

**What is committed is the extracted result.** `website/src/assets/**` (35 files,
6.2 MB) holds the resized, compressed images the build actually imports. That
folder sits deliberately outside `/asset/`, which keeps the rule simple: if the
build reads it, it is committed; if only a person reads it, it is not.

**The test that keeps the list honest:** a fresh clone has to build. `git archive
HEAD` — byte-for-byte what a host clones — installs with `npm ci` and builds with
`npm run build`, exit 0, 52 pages. Nothing in the table is needed for that, which
is exactly why the Pages build (§3) works from the repository alone.

Two cautions, because both are one command from going wrong:

- `git add -A` from the root is safe *because* of these rules, not in spite of
  them. Weaken a rule and that is the command that sweeps the brand drop into a
  commit, where it can never be quietly taken back out.
- To commit something from an ignored path on purpose, add a `!` exception to the
  ignore file rather than reaching for `git add -f`. The exception is reviewable
  and says why; a force-add leaves no trace of the decision.

## 5. Checking any of this without dashboard access

```bash
# Everything on this page, re-derived from the outside in one command. Run it
# inside website/. Exit code 1 means a real problem — a suspended domain, the
# parking records back, a host serving someone else's page — never an item that
# simply has not been done yet.
npm run check:launch
npm run check:launch -- --site https://healthaali.pages.dev

# Registrar side: who the domain is delegated to, and whether it is suspended.
# A "client hold" status here means nothing will resolve, whatever DNS says.
curl -sL https://rdap.org/domain/healthaali.in | tr ',' '\n' | grep '"ldhName"'

# Delegation and answers, as the public internet sees them.
nslookup -type=ns healthaali.in 1.1.1.1
nslookup -type=a  healthaali.in 1.1.1.1

# What the site actually serves.
curl -sS -o /dev/null -w '%{http_code}\n' https://healthaali.in/
curl -sSI https://healthaali.in/ | grep -i 'content-security-policy'

# CI and scheduled runs.
curl -s "https://api.github.com/repos/mdsalmanmasood/healthaali-website/actions/runs?per_page=3"
```

A resolver can keep serving the previous delegation until its TTL expires, so
immediately after a nameserver change two resolvers disagreeing is normal rather
than broken. Querying the zone's own nameservers shows the authoritative answer
the moment the change lands.

### Deep mode: reading the dashboards themselves

Everything above is inferred from the outside, which is exactly why it cannot
see the settings on this page: a build command, a root directory or an unvalidated
custom domain leaves no public trace. Put a **read-only** token in the
environment and `check:launch` also reads the Cloudflare API directly:

```bash
# Create at: My Profile → API Tokens → Create Custom Token, with these three
# permissions and nothing else. Scope it to this account (or this zone).
#   Zone    → Zone             → Read
#   Zone    → DNS              → Read
#   Account → Cloudflare Pages → Read
export CLOUDFLARE_API_TOKEN=…
npm run check:launch
```

It then also verifies: the zone's status and whether it is paused; the zone's own
nameservers against what the domain publishes; every record in the zone, with the
apex and `www` checked for ownership and proxying rather than for presence; the
Pages `root_dir`, build command and output directory against the values above;
the git source and production branch, **against the branches this repository
actually has** (a project watching `master` that is pushed to `main` builds
previews forever and never publishes); which environment variables exist
(**names only** — values are never read or printed); and each custom domain's
status, including its validation error message when one fails.

It also reads the **Deployments** tab, which is the only place the four causes in
§3 can be told apart. It reports whether a project exists under this name at all
(and lists the names it did find when one does not), whether anything has ever
been built, whether the newest *production* deployment succeeded, failed, was
skipped or is still running — and when it failed, the tail of that build's log,
indented under the failure, plus a direct link to the deployment in the
dashboard. A failed build and a hostname the API calls live but DNS will not
resolve are both exit code 1; a project that exists but has never been built is
outstanding, not broken.

Without the variable the deep checks report themselves as outstanding and change
nothing else. With a token that is expired or under-scoped, they fail loudly with
the API's own error rather than passing quietly — a dead token must not look like
a healthy deployment. A token that cannot read a project at all is reported as
such rather than as "the project does not exist".

`CLOUDFLARE_API` exists for one reason: so the deep mode can be pointed at a
local stub while its own logic is being changed. Leave it unset, and the token
only ever travels to `api.cloudflare.com`.

**What has and has not been verified.** As of 1 October 2026 the deep mode has
*never* run against a real token: it was developed against a local stub reached
through `CLOUDFLARE_API`, so treat its Cloudflare API branch — the Deployments
reading included — as unproven. That is not a formality; it is the one part of
this file with no evidence behind it yet. Everything in §1–§3 that leaves a
public trace has been verified against the live site: the launch run reported
**9 satisfied, 2 outstanding, 0 problems**, and the outstanding pair is exactly
the absent MX records and the skipped deep mode.

The same check runs unattended as `launch-check.yml` every six hours. It reads
the token from a repository secret of the same name when one exists, so a
deployment problem is reported by a failed run rather than by a visitor.

### Which revision is actually deployed

Every page carries `<meta name="build-commit">`, filled at build time from the
host's environment — `CF_PAGES_COMMIT_SHA` on Pages, `GITHUB_SHA` in Actions,
`COMMIT_REF` on Netlify, `VERCEL_GIT_COMMIT_SHA` on Vercel — and `unknown` when
the build was given none of them.

`check:launch` compares that stamp against the repository's `HEAD`, and the three
outcomes are deliberately different:

| Stamp vs HEAD | Reported as | Because |
| --- | --- | --- |
| equal | ✓ | the deployment is this commit |
| an ancestor | ○ outstanding | that is what a build in flight looks like |
| not in this history, or missing/`unknown` | ✗ | the host is serving code this repository does not contain |

## 6. Measuring the deployed site

The Lighthouse numbers in the website README were taken against a **local**
server: HTTP/1.1, no compression, no CDN. They are a floor, not the production
figure — the deployed site is served over HTTP/2 with compression and the headers
from `_headers` applied at the edge, which is a different measurement. Run this
only once `check:launch` shows the site answering.

```bash
# From the repository root. Needs a Chrome binary — the same one the
# accessibility gate uses, so if `npm run check:a11y` passes here, this runs.
npx --yes lighthouse@12 https://healthaali.in/ \
  --output=json --output-path=./lighthouse-mobile.json --quiet

npx --yes lighthouse@12 https://healthaali.in/ \
  --preset=desktop --output=json --output-path=./lighthouse-desktop.json --quiet
```

`lighthouse` is deliberately **not** a devDependency. It is a periodic manual
measurement, and a dependency would grow the tree that `npm ci` installs on every
push — for a number that only changes when the deployment does. `npx` puts it in
the npm cache instead, and the two report files are gitignored.

Read the four scores and the three timings (LCP, TBT, CLS) out of each report and
replace the table in `website/README.md`, including its caveat sentence, which
should then describe the real edge rather than a local server. Record the date the
measurement was taken: a performance number without one is a rumour.

## 7. Search — the pages built to be found, and what is still missing

The site's earlier pages were written for people who already know the brand (a
features page, an about page). Three pages now exist for people who do not:
`/no-oil-recipes`, `/high-protein-recipes` and `/weight-loss-recipes` — one per
way of cooking somebody types into a search box.

| Page | The query it answers | Its entries come from |
| --- | --- | --- |
| `/no-oil-recipes` | no-oil recipes, zero-oil cooking, cooking with less oil | dishes whose own published title says "no oil" or "zero oil", plus the two posts tagged *Zero oil* |
| `/high-protein-recipes` | high-protein recipes, protein-rich Indian food | dishes whose title says "high protein", plus the eight posts tagged *High protein* |
| `/weight-loss-recipes` | weight-loss recipes, diet recipes | dishes whose title says "weight loss" or "lose weight", plus the five posts tagged *Weight loss* |

**Membership is derived, not curated, and that is the point.** `recipes.json` is
regenerated from the channel's feed by the daily sync, so a hand-written list of
video ids would be stale within a week. Instead each page applies one rule to the
titles the channel published, at build time:

- a dish joins by its **title**, never its description — descriptions are mostly
  hashtags, and matching those would eventually file a dessert under weight loss;
- a post joins by its frontmatter tag, so the writing side stays in one place;
- a topic that matches **nothing** fails the build (`src/data/topics.ts`) rather
  than publishing an empty landing page.

Each page works the same way: the dishes, the posts on the same subject, the
numbers the posts already publish, and answers to the questions those posts are
about. The copy refuses what the posts refuse — that oil is bad for you, that a
rate of loss can be promised — because a landing page is the easiest place on a
site to overclaim.

Wired in: both directions between a topic page and its blog tag, a rail on
`/recipes`, buttons on the homepage, chips on a dish's own page when its title
puts it in a collection, and a "Cook this way" footer group sitewide.

### What is verified automatically

`npm run check:seo` (gate 11 of `ci.yml`, and part of `npm run verify`) reads the
built HTML and fails on the invariants a review does not keep:

- one `<h1>` per page, a unique `<title>` and meta description, a canonical URL
  that agrees with the sitemap, and JSON-LD that parses;
- **mark-up that matches the page**: every `FAQPage` question and every
  `CollectionPage` entry must be text a visitor can find on that same page —
  schema describing content that is not there is the one thing Google treats as
  spam rather than as a mistake;
- the three topic pages linked from the homepage, each with a `CollectionPage`,
  an `FAQPage` and a `BreadcrumbList`, and each claiming at least one dish and
  one post;
- the sitemap and the build agreeing in both directions: every page built is
  listed, and every URL listed exists.

It also **reports** (without failing) the 20 pages whose `<title>` is longer than
70 characters, which is roughly where a search result cuts it. Most are the
videos' own titles, kept verbatim because they are the channel's words — the same
reason the dish pages carry no invented `Recipe` markup: there is no ingredient
table and no per-dish calorie count on this site, so claiming a recipe page in
structured data would describe something that does not exist.

### What to write next — `npm run report:gaps`

Knowing the hubs exist is not the same as knowing where the library is thin.
That question is a command, run from `website/`:

```bash
npm run report:gaps            # 30 phrase findings at most
npm run report:gaps -- --limit 60
```

It reads the repository rather than the live site. The title and hashtags of
every video in `src/data/recipes.json` are the corpus of phrases the channel
publishes; a phrase is a gap when no published post contains it anywhere — its
title, description, tags or body — which is the generous reading, so what
survives is something no post has touched at all. Each finding names the videos
that publish it and says whether any post at least *shows* the video (`shown in 2
posts` against `no post shows it`), because "no post ever named this" and "no post
has ever carried this" are different jobs.

The hub table that follows is read from `dist/`, so its counts are the built
pages' own `CollectionPage` entries rather than a second copy of the rules in
`src/data/topics.ts` — which also means the build has to exist first. Without a
`dist/` the phrase findings still run and the hub sections are skipped, naming
why. Beside the table it lists the dishes no hub rule claims, the tags no hub is
built on, the posts filed under no hub, and the videos no post embeds.

It is a report, not a gate: it exits 0 however empty the list is, and it is not
part of `npm run verify` or CI. Run against the library on 1 October 2026, once
the writing it asked for had been done, it reports **no uncovered phrase out of 63
published**, `/no-oil-recipes/` still the thinnest hub (5 dishes, 4 posts), and one
dish with no rule to claim it (the yogurt bowl). Every one of the 15 videos now
appears in at least one post.

The first pass found 10 phrases and one unembedded video. Of the last five
phrases, three needed pages — the fruit bowl, and a weight-loss and zero-oil
breakfast — while two, `protein evening snack` and `high protein snack`, were the
channel's own labels for subjects two posts already covered, and closed when
those posts named what they were about. That is worth knowing about the report:
a phrase it calls uncovered can mean "no post has written about this", and it can
also mean "a post covers this and never says so", and only a person can tell
which. A finding whose phrase is close to one already covered is worth reading
before a new post is commissioned for it.

The daily sync asks the same question, at the moment it is worth asking. When
`npm run recipes` picks up a new video, the report the scheduled workflow writes
now names the phrases that video publishes which no post answers, and says
whether any post carries it yet — so the reminder arrives in the pull request that
updates the snapshot, the morning after the video goes out, instead of waiting for
somebody to remember the report. Both go through the same rules, in
`website/scripts/lib/editorial-gaps.mjs`, so the two can never disagree about the
same video; and like the report it is a note rather than a failure, because a new
video with nothing written about it is the normal state of a new video.

A pull request gets merged, which is a poor place for a reminder, so the same job
also keeps the finding in the issue tracker: one labelled issue per video no post
carries, with the phrases that need answering in the body, closed again with a
comment naming the post once one is written. That step runs on every scheduled
run rather than only the ones with news, because closing is the half that needs no
news — the writing lands in an ordinary push and the next run tidies up. The
command is `npm run reminders`, and it is safe to run by hand: `--dry-run` prints
the plan, `--issues-json` plans offline against a captured issue list, and an open
issue that names no video in the snapshot is reported rather than closed.

### What is not done, and cannot be done from here

Search Console is the one step with no CLI path, because it authenticates as the
site owner:

1. **Verify the property.** Either a DNS `TXT` record on `healthaali.in` in the
   Cloudflare dashboard, or an HTML tag: set `PUBLIC_GOOGLE_SITE_VERIFICATION` in
   the Pages project's environment variables (§3) and redeploy — it is emitted as
   `<meta name="google-site-verification">` on every page, and omitted entirely
   when unset. Clearing it later does not unverify the property.
2. **Submit `https://healthaali.in/sitemap-index.xml`** under *Sitemaps*, then
   request indexing for the three topic pages under *URL inspection*.

Two honest limits on all of this. **Nothing here is a ranking**: the pages,
`FAQPage`/`CollectionPage` markup, canonicals and sitemap make the site legible
and eligible, and the rest is content depth over time and links from elsewhere —
neither of which a change to this repository can create. And **the recipes are not
all low-oil or high-protein dishes**; each page states the rule that matched and
lists what it matched, rather than implying the whole library belongs to it.

## 8. Backing this up, and restoring it

The site is built so that losing everything except the repository loses nothing
that matters: the dashboard settings are written down in this file, the recipes
live on YouTube as well as in the committed snapshot, and the built output is
regenerated on every push. What is left is the code and the writing — and a copy
of that can sit anywhere.

```bash
# From website/. Writes ../backups/healthaali-website-<date>.bundle plus a
# manifest beside it, then verifies the file with git's own check.
npm run backup

# The same, then the only test that counts: restore that file into a scratch
# clone, npm ci, full build, and check the topic pages came out of it.
npm run backup -- --drill
```

`RESTORE.md` at the repository root is written for whoever finds the file with no
context — clone, build, re-attach the domain, in four commands and a table of
what is missing. It travels *inside* the bundle, so a restored clone contains the
instructions for restoring itself.

A bundle is a `git bundle`: one file holding every commit and every ref, which
git can clone from as if it were a server. A zip of the working tree would not do
this — it cannot be cloned, it loses the history that explains every decision in
it, and whatever was half-edited when it was taken is captured as if it were
finished.

### The other half: a mirror on a second host

A bundle is a copy somebody has to remember to make and then carry. A *mirror* is
the same history pushed to a host that is not GitHub, one push behind on every
push, with no memory required:

```bash
npm run mirror                 # to the `mirror` remote, or MIRROR_URL
npm run mirror -- --self-test  # prove the mechanism with no host and no account
```

`mirror.yml` runs both: the self-test on every push, so the tooling cannot rot
while nothing is configured, and the real push whenever a `MIRROR_URL` secret
exists. It reports `not configured` and passes otherwise — outstanding rather than
broken, the same contract `check:launch` uses without a token.

The push is verified rather than trusted: every ref is compared against the
target's own answer by object id, and a target whose default branch does not
resolve fails the run, because that is a mirror which holds every commit and
still shows nothing when browsed. Nothing on the target is ever deleted, and no
credential reaches the log. Its own unfixable gap is the same as the bundle's:
the 44 MB brand drop in `/asset/` is not in git and therefore not on the mirror
either. `MIRROR.md` has the setup and the restore path.

Four things are deliberately not in a bundle, and each has a different answer:

| Not in the bundle | Why | If it is all you ever have |
| --- | --- | --- |
| `/asset/` — 44 MB, 164 files | gitignored input; committing it would take a fresh clone from 7.5 MB to about 52 MB (§4) | the derived images are committed, so the site builds and looks identical — but the sources for new crops, sizes or posts are gone. Copy that folder somewhere off this machine; nothing else does |
| Pages project, DNS records, the GitHub App grant | dashboard state, described in §1–§3 | recreate from those sections; `npm run check:launch` then verifies the result from the outside |
| The deployed build | regenerated on push | `npm ci && npm run build` in `website/` |
| Anything uncommitted | a bundle records commits, not files | this is what the dirty-tree warning is for: the command refuses to drill a working tree with uncommitted changes, so a green run is never mistaken for a complete backup |

**A bundle on the same machine is not a backup,** and the command says so on
every run. Nothing in this repository can make the copy that matters: the file
has to leave the laptop — cloud storage, another computer, a USB stick.
