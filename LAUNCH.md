# Launch settings — the parts that live outside this repository

Everything on this page is configured in a dashboard. None of it can be
discovered by reading the code, and none of it is covered by `npm run verify` or
by CI. The values below are what is actually configured, as of
**30 September 2026**.

If you are picking this project up later, read this before changing anything
about hosting or DNS: several of these settings fail *silently* when they are
missing, and two of them (an apex `A` record, or GoDaddy nameservers) will
actively break the site.

## Status at a glance

- [x] Domain registered and registrar verification (KYC) cleared
- [x] Repository pushed to GitHub; CI green
- [x] Cloudflare zone active; GoDaddy nameservers replaced
- [ ] Pages project created from the repository
- [ ] `healthaali.in` and `www.healthaali.in` attached as custom domains
- [ ] Uptime workflow green — it is red until the domain serves the site
- [ ] `info@healthaali.in` can receive mail — no MX records exist yet

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
| Build watch paths — include | `website/*` |
| Build watch paths — exclude | *(empty)* |
| Node version | from the committed `website/.nvmrc` (22) |

- **Root directory is the setting that breaks the build when missed.** The
  repository root has no `package.json`; without it the build runs in the wrong
  place and fails.
- **Do not set `NODE_VERSION`.** A committed `.nvmrc` takes precedence over the
  dashboard variable, so the two would silently disagree.
- **Build watch paths** scope rebuilds to the site. The dashboard default is
  `*` (every push rebuilds, including commits that only touch `.github/` or this
  file's neighbours at the root). Wildcards match across `/`, so `website/*`
  covers nested files such as `website/src/pages/index.astro`. Pages ignores path
  matching and always builds when a push has no file changes, or spans 3000+
  files / 20+ commits.
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

Every pull request also gets a preview deployment; only `main` is production.

## 4. GitHub repository

- `mdsalmanmasood/healthaali-website`, public, default branch `main`, no secrets.

| Workflow | Trigger | What it gates |
| --- | --- | --- |
| `ci.yml` | push / PR to `main`, manual | install, typecheck, recipes, build, placeholders, links, a11y |
| `sync-recipes.yml` | daily 03:00 UTC, manual | proposes the YouTube snapshot as a PR only when it really changed |
| `uptime.yml` | every six hours at :17, manual | probes the live domain and its certificate |

`uptime.yml` fails until the domain serves the Pages project — that is the
intended signal, not a broken workflow. GitHub disables scheduled workflows
after 60 days without repository activity; any commit resets that clock.

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
the git source and production branch; which environment variables exist (**names
only** — values are never read or printed); and each custom domain's status,
including its validation error message when one fails.

Without the variable the deep checks report themselves as outstanding and change
nothing else. With a token that is expired or under-scoped, they fail loudly with
the API's own error rather than passing quietly — a dead token must not look like
a healthy deployment.
